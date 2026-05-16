"use client";

/**
 * useRecorder — 麥克風錄音 hook（M13）
 *
 * 設計目標：
 *   - 提供「申請權限 → 錄製 → 預覽 → 重置」狀態機，輸出單一段錄音 Blob
 *   - getUserMedia 在 start() 內 lazy 申請（避免進頁面就跳權限）
 *   - mimeType 自動 fallback：webm;opus → webm → mp4
 *   - 預設 60 秒上限，內部 timer 自動停止
 *   - reset / unmount 必呼 tracks.stop() 釋放麥克風
 *   - 全程 SSR 安全：所有 Web API 操作均在 handler 或 useEffect 內
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ---------- 型別 ----------

export type RecorderState = "idle" | "recording" | "preview" | "error";

export type RecorderErrorCode =
  | "permission"
  | "no-device"
  | "unsupported"
  | "aborted"
  | "unknown";

export type RecorderError = {
  readonly code: RecorderErrorCode;
  readonly message: string;
};

export type UseRecorderOptions = {
  /** 自動停止的時間上限（ms），預設 60_000 */
  readonly maxDurationMs?: number;
};

export type UseRecorderResult = {
  state: RecorderState;
  blob: Blob | null;
  mimeType: string;
  durationMs: number;
  error: RecorderError | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
};

// ---------- 常數 ----------

const DEFAULT_MAX_DURATION_MS = 60_000;
const AUDIO_BITS_PER_SECOND = 64_000;

/** 依序嘗試的 mimeType 候選 */
const MIME_CANDIDATES: readonly string[] = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

// ---------- 內部工具 ----------

function pickSupportedMimeType(): string | null {
  if (typeof window === "undefined") return null;
  if (typeof window.MediaRecorder === "undefined") return null;
  for (const candidate of MIME_CANDIDATES) {
    try {
      if (window.MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      // 某些瀏覽器在傳入特定字串時會丟例外；忽略並嘗試下一個
    }
  }
  return null;
}

/**
 * 將 getUserMedia 的錯誤名規格化為 RecorderErrorCode。
 * 對應 MDN 的 NotAllowedError / NotFoundError / NotReadableError…
 */
function classifyGetUserMediaError(err: unknown): RecorderError {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
      case "SecurityError":
        return {
          code: "permission",
          message: "麥克風權限被拒絕，請於瀏覽器設定允許後重試",
        };
      case "NotFoundError":
      case "OverconstrainedError":
        return {
          code: "no-device",
          message: "找不到可用的麥克風裝置",
        };
      case "NotReadableError":
        return {
          code: "no-device",
          message: "麥克風被其他程式佔用或無法讀取",
        };
      case "AbortError":
        return { code: "aborted", message: "錄音請求被中斷" };
      default:
        return {
          code: "unknown",
          message: `麥克風存取失敗：${err.name}`,
        };
    }
  }
  if (err instanceof Error) {
    return { code: "unknown", message: err.message };
  }
  return { code: "unknown", message: "未知錯誤" };
}

// ---------- Hook ----------

export function useRecorder(options?: UseRecorderOptions): UseRecorderResult {
  const maxDurationMs = options?.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;

  const [state, setState] = useState<RecorderState>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [durationMs, setDurationMs] = useState<number>(0);
  const [error, setError] = useState<RecorderError | null>(null);

  // refs：保存跨 render 的可變物件
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeMimeTypeRef = useRef<string>("");

  /** 停 timer（不釋放麥克風） */
  const clearAutoStopTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** 釋放 MediaStream + 清除 recorder ref（不重設 state） */
  const releaseStream = useCallback((): void => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  /** 完整重置：釋放裝置、清除狀態、回到 idle */
  const reset = useCallback((): void => {
    clearAutoStopTimer();
    releaseStream();
    chunksRef.current = [];
    startedAtRef.current = 0;
    activeMimeTypeRef.current = "";
    setBlob(null);
    setMimeType("");
    setDurationMs(0);
    setError(null);
    setState("idle");
  }, [clearAutoStopTimer, releaseStream]);

  /** 停止錄音（觸發 onstop → blob / state 切換） */
  const stop = useCallback((): void => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === "inactive") return;
    clearAutoStopTimer();
    try {
      rec.stop();
    } catch {
      // 已停止 / 已釋放 → 忽略
    }
  }, [clearAutoStopTimer]);

  /** 開始錄音；getUserMedia / MediaRecorder 均在此 lazy 取得 */
  const start = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined") return;

    // 先清掉前一輪殘留（不影響 idle）
    clearAutoStopTimer();
    releaseStream();
    chunksRef.current = [];
    setBlob(null);
    setDurationMs(0);
    setError(null);
    // 若是從 error 重試，先回到 idle，避免 UI 短暫殘留錯誤態
    setState((s) => (s === "error" ? "idle" : s));

    // 環境檢查
    if (
      typeof window.MediaRecorder === "undefined" ||
      !window.navigator?.mediaDevices?.getUserMedia
    ) {
      setError({
        code: "unsupported",
        message: "此瀏覽器不支援錄音功能（MediaRecorder / getUserMedia）",
      });
      setState("error");
      return;
    }

    const chosenMime = pickSupportedMimeType();
    if (chosenMime === null) {
      setError({
        code: "unsupported",
        message: "此瀏覽器無法以 webm/opus、webm 或 mp4 編碼錄音",
      });
      setState("error");
      return;
    }

    // 取得麥克風串流
    let stream: MediaStream;
    try {
      stream = await window.navigator.mediaDevices.getUserMedia({
        audio: true,
      });
    } catch (err) {
      setError(classifyGetUserMediaError(err));
      setState("error");
      return;
    }
    streamRef.current = stream;

    // 建立 MediaRecorder
    let recorder: MediaRecorder;
    try {
      recorder = new window.MediaRecorder(stream, {
        mimeType: chosenMime,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
    } catch (err) {
      releaseStream();
      setError(classifyGetUserMediaError(err));
      setState("error");
      return;
    }
    recorderRef.current = recorder;
    activeMimeTypeRef.current = chosenMime;

    recorder.ondataavailable = (e: BlobEvent): void => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onerror = (): void => {
      clearAutoStopTimer();
      releaseStream();
      setError({ code: "unknown", message: "錄音過程發生錯誤" });
      setState("error");
    };

    recorder.onstop = (): void => {
      clearAutoStopTimer();
      // 釋放麥克風裝置（保留 chunks 供下方組裝 blob）
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }

      const elapsed =
        startedAtRef.current > 0
          ? Math.round(performance.now() - startedAtRef.current)
          : 0;

      const activeMime = activeMimeTypeRef.current;
      const finalBlob = new Blob(chunksRef.current, {
        type: activeMime,
      });
      chunksRef.current = [];
      recorderRef.current = null;

      if (finalBlob.size === 0) {
        setBlob(null);
        setMimeType("");
        setDurationMs(0);
        setError({ code: "unknown", message: "錄音結果為空" });
        setState("error");
        return;
      }

      setBlob(finalBlob);
      setMimeType(activeMime);
      setDurationMs(elapsed);
      setState("preview");
    };

    // 啟動錄製
    startedAtRef.current = performance.now();
    try {
      recorder.start();
    } catch (err) {
      releaseStream();
      setError(classifyGetUserMediaError(err));
      setState("error");
      return;
    }

    setState("recording");

    // 上限 timer：到時自動停止
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          // 忽略
        }
      }
    }, maxDurationMs);
  }, [clearAutoStopTimer, maxDurationMs, releaseStream]);

  // unmount：釋放裝置 + 清 timer
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          // 忽略
        }
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
      recorderRef.current = null;
      chunksRef.current = [];
    };
  }, []);

  return {
    state,
    blob,
    mimeType,
    durationMs,
    error,
    start,
    stop,
    reset,
  };
}
