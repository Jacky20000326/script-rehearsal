"use client";

/**
 * useTTS — 將 TTSService 包裝為 React hook
 *
 * 行為：
 *   - mount 時建立 TTSService 並等待 voices 就緒
 *   - unmount 時自動 cancel 任何進行中的 utterance
 *   - 提供穩定參考的 speak / cancel（用 useCallback）
 *   - isReady：voices 載入完成
 *   - isSpeaking：reactive 狀態（在 onstart/onend 時 setState）
 *   - voicesAvailable：voices 是否有任何中文項目（純供 UI 顯示警告）
 *
 * SSR safe：所有 window 存取守衛在 useEffect 內。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TTSService, type TTSConfig } from "@/lib/tts";

export type UseTTSReturn = {
  /** voices 是否已就緒（可安全呼叫 speak） */
  readonly isReady: boolean;
  /** 環境完全不支援 TTS（無 window.speechSynthesis）。
   *  此旗標為 true 時，UI 應顯示「不支援 TTS」而非永久「載入中…」。 */
  readonly isUnsupported: boolean;
  /** 是否有任何中文 voice（供 UI 警示） */
  readonly voicesAvailable: boolean;
  /** 是否正在朗讀 */
  readonly isSpeaking: boolean;
  /** 朗讀（會自動包裝 onStart/onEnd 以同步 isSpeaking） */
  readonly speak: (config: TTSConfig) => void;
  /** 取消朗讀 */
  readonly cancel: () => void;
  /** Debug：當前 voice 分配快照 */
  readonly assignments: ReadonlyArray<{
    characterKey: string;
    voiceName: string | null;
    pitch: number;
    rate: number;
  }>;
};

export function useTTS(
  characters: ReadonlyArray<{ key: string; name: string }>,
): UseTTSReturn {
  const serviceRef = useRef<TTSService | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isUnsupported, setIsUnsupported] = useState(false);
  const [voicesAvailable, setVoicesAvailable] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [assignments, setAssignments] = useState<
    ReadonlyArray<{
      characterKey: string;
      voiceName: string | null;
      pitch: number;
      rate: number;
    }>
  >([]);

  // characters 陣列引用穩定性靠呼叫端 useMemo 維持；
  // 但為了即使呼叫端沒 memo 也不重建 service，我們以「角色 key 字串」做 dep。
  const charactersKey = useMemo(
    () => characters.map((c) => c.key).join("|"),
    [characters],
  );

  useEffect(() => {
    // SSR：保持 isReady=false，呼叫 speak 會直接 onEnd
    if (typeof window === "undefined") return;

    // 不支援的瀏覽器：標記 isUnsupported，讓 UI 顯示「不支援 TTS」而非「載入中…」
    if (typeof window.speechSynthesis === "undefined") {
      setIsUnsupported(true);
      return;
    }

    let cancelled = false;
    const service = new TTSService(characters);
    serviceRef.current = service;

    service.waitForVoices().then(() => {
      if (cancelled) return;
      setIsReady(true);
      const snap = service.getAssignmentsSnapshot();
      setAssignments(snap);
      setVoicesAvailable(snap.some((a) => a.voiceName !== null));
    });

    return () => {
      cancelled = true;
      // 清理：cancel 進行中的 utterance
      service.cancel();
      serviceRef.current = null;
      setIsReady(false);
      setIsSpeaking(false);
    };
    // 依角色 key 字串重建（角色變更才重建，例如 HMR 或新增角色）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charactersKey]);

  const speak = useCallback((config: TTSConfig): void => {
    const svc = serviceRef.current;
    if (!svc) {
      // 尚未就緒 → 直接視為立即結束（與 SSR fallback 行為一致）
      config.onEnd?.();
      return;
    }
    svc.speak({
      ...config,
      onStart: () => {
        setIsSpeaking(true);
        config.onStart?.();
      },
      onEnd: () => {
        setIsSpeaking(false);
        config.onEnd?.();
      },
      onError: (e) => {
        setIsSpeaking(false);
        config.onError?.(e);
      },
    });
  }, []);

  const cancel = useCallback((): void => {
    const svc = serviceRef.current;
    if (!svc) return;
    svc.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    isReady,
    isUnsupported,
    voicesAvailable,
    isSpeaking,
    speak,
    cancel,
    assignments,
  };
}
