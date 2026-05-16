"use client";

/**
 * RecordClient — 錄音頁主元件（M13）
 *
 * 流程：
 *   1. 載入 script.json → 過濾出該角色的全部對白行
 *   2. 從 IndexedDB 拉已存在的片段，標記「已完成」
 *   3. 逐行錄音：idle → recording → preview → 確認後寫入 IndexedDB → 下一行
 *   4. 可前/後切換行；preview 未確認時提示丟棄
 *
 * 視覺：黑底白字、提詞器一致風格（與 /rehearse 對齊）。
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useScript } from "@/hooks/useScript";
import { useRecorder } from "@/hooks/useRecorder";
import { getCharacterLines } from "@/lib/script";
import {
  getAllSegments,
  putAudioSegment,
} from "@/lib/audioStorage";
import { computeScriptHash } from "@/lib/scriptHash";
import type { AudioSegmentRecord, FlatLine } from "@/lib/types";

export type RecordClientProps = {
  readonly characterKey: string;
};

const MAX_DURATION_MS = 60_000;
const WARN_THRESHOLD_MS = 55_000;

// ---------- 顯示輔助 ----------

function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

// ---------- 主元件 ----------

export function RecordClient({
  characterKey,
}: RecordClientProps): ReactElement {
  const router = useRouter();
  const { script, loading: scriptLoading, error: scriptError } = useScript();

  // 該角色的所有對白行
  const lines = useMemo<FlatLine[]>(() => {
    if (!script) return [];
    return getCharacterLines(script, characterKey);
  }, [script, characterKey]);

  const characterFullName = script?.characters[characterKey] ?? characterKey;

  // 已完成的 globalIndex 集合（從 IndexedDB）
  const [doneIndices, setDoneIndices] = useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );
  const [segmentsLoading, setSegmentsLoading] = useState<boolean>(true);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSegmentsLoading(true);
    setSegmentsError(null);
    (async () => {
      try {
        const segments: AudioSegmentRecord[] =
          await getAllSegments(characterKey);
        if (cancelled) return;
        setDoneIndices(new Set(segments.map((s) => s.globalIndex)));
      } catch (e: unknown) {
        if (cancelled) return;
        setSegmentsError(
          e instanceof Error ? e.message : "讀取已錄片段失敗",
        );
      } finally {
        if (!cancelled) setSegmentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [characterKey]);

  // 當前行 index（在 lines 陣列內，0-based）
  const [cursor, setCursor] = useState<number>(0);

  // 錄音 hook
  const recorder = useRecorder({ maxDurationMs: MAX_DURATION_MS });

  // recording 時的 tick（每 200ms 重繪一次計時器）
  const [tick, setTick] = useState<number>(0);
  const recordingStartedAtRef = useRef<number>(0);
  useEffect(() => {
    if (recorder.state !== "recording") {
      recordingStartedAtRef.current = 0;
      return;
    }
    if (recordingStartedAtRef.current === 0) {
      recordingStartedAtRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
    }
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, [recorder.state]);

  const currentRecordingMs = useMemo<number>(() => {
    if (recorder.state !== "recording") return 0;
    if (recordingStartedAtRef.current === 0) return 0;
    void tick;
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    return Math.max(0, Math.round(now - recordingStartedAtRef.current));
  }, [recorder.state, tick]);

  // preview 的物件 URL
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (recorder.state !== "preview" || !recorder.blob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(recorder.blob);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [recorder.state, recorder.blob]);

  // 切換行（含 preview 未確認的丟棄提示）
  const gotoCursor = useCallback(
    (next: number): void => {
      if (next < 0 || next >= lines.length) return;
      if (next === cursor) return;
      if (recorder.state === "preview") {
        const ok = window.confirm(
          "目前已錄但尚未確認，切換行將丟棄這次錄音。確定要切換嗎？",
        );
        if (!ok) return;
        recorder.reset();
      } else if (recorder.state === "recording") {
        window.alert("正在錄音中，請先停止再切換");
        return;
      }
      setCursor(next);
    },
    [cursor, lines.length, recorder],
  );

  const goPrev = useCallback(() => gotoCursor(cursor - 1), [cursor, gotoCursor]);
  const goNext = useCallback(() => gotoCursor(cursor + 1), [cursor, gotoCursor]);

  // 進入新行時清掉前一輪 recorder 狀態
  const lastCursorRef = useRef<number>(cursor);
  useEffect(() => {
    if (lastCursorRef.current !== cursor) {
      lastCursorRef.current = cursor;
      if (recorder.state !== "idle") {
        recorder.reset();
      }
    }
  }, [cursor, recorder]);

  // 點擊主控制鈕（idle → start；recording → stop）
  const handleMainAction = useCallback((): void => {
    if (recorder.state === "idle" || recorder.state === "error") {
      void recorder.start();
      return;
    }
    if (recorder.state === "recording") {
      recorder.stop();
      return;
    }
  }, [recorder]);

  // 確認此行：寫入 IndexedDB，並前進到下一未錄的行
  const [savingError, setSavingError] = useState<string | null>(null);
  const handleConfirm = useCallback(async (): Promise<void> => {
    if (recorder.state !== "preview" || !recorder.blob) return;
    const currentLine = lines[cursor];
    if (!currentLine) return;
    if (!script) return;
    setSavingError(null);
    let scriptHash: string;
    try {
      scriptHash = await computeScriptHash(script);
    } catch (e: unknown) {
      setSavingError(e instanceof Error ? e.message : "計算劇本雜湊失敗");
      return;
    }
    const record: AudioSegmentRecord = {
      characterKey,
      globalIndex: currentLine.globalIndex,
      blob: recorder.blob,
      mimeType: recorder.mimeType,
      durationMs: recorder.durationMs,
      sizeBytes: recorder.blob.size,
      recordedAt: Date.now(),
      scriptHash,
    };
    try {
      await putAudioSegment(record);
    } catch (e: unknown) {
      setSavingError(e instanceof Error ? e.message : "寫入 IndexedDB 失敗");
      return;
    }
    setDoneIndices((prev) => {
      const next = new Set(prev);
      next.add(currentLine.globalIndex);
      return next;
    });
    recorder.reset();
    // 自動前進到下一行（若已在最末行則停留）
    if (cursor < lines.length - 1) {
      setCursor(cursor + 1);
    }
  }, [characterKey, cursor, lines, recorder, script]);

  // 重錄
  const handleRetake = useCallback((): void => {
    recorder.reset();
  }, [recorder]);

  // ---------- 載入態 / 錯誤態 ----------

  if (scriptLoading || segmentsLoading) {
    return (
      <PageShell>
        <p className="text-zinc-500">載入中…</p>
      </PageShell>
    );
  }

  if (scriptError) {
    return (
      <PageShell>
        <h1 className="text-3xl">載入劇本失敗</h1>
        <p className="text-red-400 font-mono">{scriptError.message}</p>
        <BackToSetup />
      </PageShell>
    );
  }

  if (!script) {
    return (
      <PageShell>
        <h1 className="text-3xl">劇本不存在</h1>
        <BackToSetup />
      </PageShell>
    );
  }

  if (lines.length === 0) {
    return (
      <PageShell>
        <h1 className="text-3xl">此角色沒有任何台詞</h1>
        <p className="text-zinc-400">
          找不到角色「{characterFullName}」的任何對白行，請確認角色設定。
        </p>
        <BackToSetup />
      </PageShell>
    );
  }

  if (segmentsError) {
    return (
      <PageShell>
        <h1 className="text-3xl">讀取已錄片段失敗</h1>
        <p className="text-red-400 font-mono">{segmentsError}</p>
        <BackToSetup />
      </PageShell>
    );
  }

  const currentLine = lines[cursor];
  if (!currentLine) {
    return (
      <PageShell>
        <h1 className="text-3xl">行索引無效</h1>
        <BackToSetup />
      </PageShell>
    );
  }

  const doneCount = doneIndices.size;
  const totalCount = lines.length;
  const isCurrentDone = doneIndices.has(currentLine.globalIndex);

  // ---------- 主畫面 ----------

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-30 border-b border-zinc-900 bg-black/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div className="min-w-0 truncate text-sm text-zinc-300">
            <span className="text-white">{characterFullName} 的錄音</span>
            <span className="mx-2 text-zinc-700">｜</span>
            <span className="text-zinc-500">
              進度 {doneCount} / {totalCount}
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="whitespace-nowrap rounded border border-zinc-800 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-900"
          >
            返回設定
          </button>
        </div>
      </header>

      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-stretch justify-center gap-10 px-6 pb-24 pt-24">
        {/* 行資訊 */}
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            第 {cursor + 1} / {totalCount} 行
            <span className="ml-3 text-zinc-700">
              page {currentLine.page} · #{currentLine.globalIndex}
            </span>
            {isCurrentDone && (
              <span className="ml-3 text-emerald-400">✓ 已錄</span>
            )}
          </p>
          <p className="text-3xl leading-relaxed text-white sm:text-4xl">
            {currentLine.text}
          </p>
        </div>

        {/* 控制區（依錄音狀態切換） */}
        <div className="flex flex-col items-center gap-5">
          {recorder.state === "idle" && (
            <button
              type="button"
              onClick={handleMainAction}
              className="rounded-full border border-zinc-700 bg-zinc-950 px-8 py-4 text-base text-zinc-100 transition hover:bg-zinc-900"
            >
              ⏺ 點擊開始錄音
            </button>
          )}

          {recorder.state === "recording" && (
            <>
              <p
                className={
                  currentRecordingMs >= WARN_THRESHOLD_MS
                    ? "font-mono text-3xl text-amber-400"
                    : "font-mono text-3xl text-zinc-200"
                }
                aria-live="polite"
              >
                {formatMmSs(currentRecordingMs)}
                <span className="ml-2 text-sm text-zinc-500">
                  / {formatMmSs(MAX_DURATION_MS)}
                </span>
              </p>
              {currentRecordingMs >= WARN_THRESHOLD_MS && (
                <p className="text-sm text-amber-300">
                  接近 60 秒上限，將自動停止
                </p>
              )}
              <button
                type="button"
                onClick={handleMainAction}
                className="rounded-full border border-red-700/60 bg-red-950/40 px-8 py-4 text-base text-red-200 transition hover:bg-red-900/40"
              >
                ⏹ 點擊停止（再點一次）
              </button>
            </>
          )}

          {recorder.state === "preview" && recorder.blob && previewUrl && (
            <div className="flex w-full max-w-md flex-col items-stretch gap-3">
              <p className="text-center text-sm text-zinc-400">
                時長 {formatMmSs(recorder.durationMs)} ·{" "}
                {(recorder.blob.size / 1024).toFixed(1)} KB
              </p>
              <audio
                src={previewUrl}
                controls
                className="w-full"
                aria-label="試聽剛才錄音"
              />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="rounded-md border border-zinc-700 bg-transparent px-5 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
                >
                  🔁 重錄
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleConfirm();
                  }}
                  className="rounded-md bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
                >
                  ✓ 確認下一行
                </button>
              </div>
              {savingError && (
                <p className="text-center text-sm text-red-400">
                  {savingError}
                </p>
              )}
            </div>
          )}

          {recorder.state === "error" && recorder.error && (
            <div className="flex w-full max-w-md flex-col items-stretch gap-3 text-center">
              <p className="text-base text-red-400">
                {recorder.error.message}
              </p>
              <p className="text-xs text-zinc-600">
                錯誤代碼：
                <span className="font-mono">{recorder.error.code}</span>
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void recorder.start();
                  }}
                  className="rounded-md border border-zinc-600 bg-transparent px-5 py-2 text-sm text-zinc-100 transition hover:bg-zinc-900"
                >
                  重新請求權限
                </button>
                <button
                  type="button"
                  onClick={() => recorder.reset()}
                  className="rounded-md border border-zinc-800 bg-transparent px-5 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900"
                >
                  取消
                </button>
              </div>
            </div>
          )}

        </div>

        {/* 前後切換 */}
        <div className="flex items-center justify-between gap-3 border-t border-zinc-900 pt-6">
          <button
            type="button"
            onClick={goPrev}
            disabled={cursor === 0}
            className="rounded-md border border-zinc-800 bg-transparent px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ◀ 上一行
          </button>
          <LineMiniMap
            lines={lines}
            cursor={cursor}
            doneIndices={doneIndices}
            onJump={gotoCursor}
          />
          <button
            type="button"
            onClick={goNext}
            disabled={cursor >= lines.length - 1}
            className="rounded-md border border-zinc-800 bg-transparent px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-30"
          >
            下一行 ▶
          </button>
        </div>
      </section>
    </main>
  );
}

// ---------- 小元件 ----------

function PageShell({
  children,
}: {
  readonly children: React.ReactNode;
}): ReactElement {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-12">{children}</div>
    </main>
  );
}

function BackToSetup(): ReactElement {
  return (
    <Link
      href="/"
      className="inline-block rounded border border-zinc-700 px-5 py-2 text-base text-zinc-100 transition hover:bg-zinc-900"
    >
      返回設定
    </Link>
  );
}

function LineMiniMap({
  lines,
  cursor,
  doneIndices,
  onJump,
}: {
  readonly lines: readonly FlatLine[];
  readonly cursor: number;
  readonly doneIndices: ReadonlySet<number>;
  readonly onJump: (idx: number) => void;
}): ReactElement {
  return (
    <ul className="flex max-w-full flex-wrap items-center justify-center gap-1 overflow-x-auto">
      {lines.map((line, idx) => {
        const isDone = doneIndices.has(line.globalIndex);
        const isCurrent = idx === cursor;
        const base =
          "inline-flex h-6 w-6 items-center justify-center rounded text-[10px] font-mono transition";
        const className = isCurrent
          ? `${base} border border-white bg-white text-black`
          : isDone
            ? `${base} border border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40`
            : `${base} border border-zinc-800 bg-transparent text-zinc-500 hover:bg-zinc-900`;
        return (
          <li key={line.globalIndex}>
            <button
              type="button"
              aria-label={`跳到第 ${idx + 1} 行`}
              onClick={() => onJump(idx)}
              className={className}
            >
              {isDone ? "✓" : idx + 1}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
