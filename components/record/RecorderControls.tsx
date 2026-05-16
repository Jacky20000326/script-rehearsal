import { useEffect, useRef, type ReactElement } from "react";
import type { RecorderError, RecorderState } from "@/hooks/useRecorder";

const MAX_DURATION_MS = 60_000;
const WARN_THRESHOLD_MS = 55_000;

function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export type RecorderControlsProps = {
  readonly state: RecorderState;
  readonly blob: Blob | null;
  readonly durationMs: number;
  readonly currentRecordingMs: number;
  readonly previewUrl: string | null;
  readonly error: RecorderError | null;
  readonly savingError: string | null;
  readonly onMainAction: () => void;
  readonly onRetake: () => void;
  readonly onConfirm: () => void;
  readonly onRetryPermission: () => void;
  readonly onCancelError: () => void;
};

export function RecorderControls({
  state,
  blob,
  durationMs,
  currentRecordingMs,
  previewUrl,
  error,
  savingError,
  onMainAction,
  onRetake,
  onConfirm,
  onRetryPermission,
  onCancelError,
}: RecorderControlsProps): ReactElement {
  // MediaRecorder 產出的 webm 沒有 duration metadata，audio.duration 載入後為 Infinity，
  // 導致第一次點播放沒聲音。loadedmetadata 後 seek 到極遠處強迫瀏覽器掃完整段算出 duration，
  // 再 reset 回 0，後續 play 即可正常出聲。
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (state !== "preview" || !previewUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    let cancelled = false;

    const primeDuration = (): void => {
      if (cancelled) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) return;
      const onTimeUpdate = (): void => {
        audio.removeEventListener("timeupdate", onTimeUpdate);
        if (!cancelled) {
          try {
            audio.currentTime = 0;
          } catch {
            // 部分瀏覽器在尚未 buffered 時 seek 會丟錯，忽略即可
          }
        }
      };
      audio.addEventListener("timeupdate", onTimeUpdate);
      try {
        audio.currentTime = Number.MAX_SAFE_INTEGER;
      } catch {
        audio.removeEventListener("timeupdate", onTimeUpdate);
      }
    };

    if (audio.readyState >= 1) {
      primeDuration();
    } else {
      audio.addEventListener("loadedmetadata", primeDuration, { once: true });
    }

    return () => {
      cancelled = true;
      audio.removeEventListener("loadedmetadata", primeDuration);
    };
  }, [state, previewUrl]);

  return (
    <div className="flex flex-col items-center gap-5">
      {state === "idle" && (
        <button
          type="button"
          onClick={onMainAction}
          className="rounded-full border border-zinc-700 bg-zinc-950 px-8 py-4 text-base text-zinc-100 transition hover:bg-zinc-900"
        >
          ⏺ 點擊開始錄音
        </button>
      )}

      {state === "recording" && (
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
            onClick={onMainAction}
            className="rounded-full border border-red-700/60 bg-red-950/40 px-8 py-4 text-base text-red-200 transition hover:bg-red-900/40"
          >
            ⏹ 點擊停止（再點一次）
          </button>
        </>
      )}

      {state === "preview" && blob && previewUrl && (
        <div className="flex w-full max-w-md flex-col items-stretch gap-3">
          <p className="text-center text-sm text-zinc-400">
            時長 {formatMmSs(durationMs)} ·{" "}
            {(blob.size / 1024).toFixed(1)} KB
          </p>
          <audio
            ref={audioRef}
            src={previewUrl}
            controls
            className="w-full"
            aria-label="試聽剛才錄音"
          />
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onRetake}
              className="rounded-md border border-zinc-700 bg-transparent px-5 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
            >
              🔁 重錄
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-md bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              ✓ 確認下一行
            </button>
          </div>
          {savingError && (
            <p className="text-center text-sm text-red-400">{savingError}</p>
          )}
        </div>
      )}

      {state === "error" && error && (
        <div className="flex w-full max-w-md flex-col items-stretch gap-3 text-center">
          <p className="text-base text-red-400">{error.message}</p>
          <p className="text-xs text-zinc-600">
            錯誤代碼：<span className="font-mono">{error.code}</span>
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onRetryPermission}
              className="rounded-md border border-zinc-600 bg-transparent px-5 py-2 text-sm text-zinc-100 transition hover:bg-zinc-900"
            >
              重新請求權限
            </button>
            <button
              type="button"
              onClick={onCancelError}
              className="rounded-md border border-zinc-800 bg-transparent px-5 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
