"use client";

/**
 * RecordClient — 錄音頁主元件（M13；M25 拆分後僅負責編排）
 *
 * 子層：
 *   - hooks/useRecorder        錄音狀態機
 *   - hooks/useRecordingTimer  200ms tick 計時
 *   - hooks/usePreviewUrl      Blob → object URL（自動 revoke）
 *   - lib/recordingFlow        純函式（buildSegmentRecord / computeNextCursor）
 *   - components/record/*      Header / LineDisplay / RecorderControls / MiniMap
 *                              + RecordStatusScreens（載入 / 各錯誤畫面）
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { useRouter } from "next/navigation";
import { useScript } from "@/hooks/useScript";
import { useRecorder } from "@/hooks/useRecorder";
import { useRecordingTimer } from "@/hooks/useRecordingTimer";
import { usePreviewUrl } from "@/hooks/usePreviewUrl";
import { useDoneSegments } from "@/hooks/useDoneSegments";
import { getCharacterLines } from "@/lib/script";
import { putAudioSegment } from "@/lib/audioStorage";
import { computeScriptHash } from "@/lib/scriptHash";
import {
  buildSegmentRecord,
  computeNextCursor,
} from "@/lib/recordingFlow";
import type { FlatLine } from "@/lib/types";
import { RecordHeader } from "./RecordHeader";
import { LineDisplay } from "./LineDisplay";
import { RecorderControls } from "./RecorderControls";
import { MiniMap } from "./MiniMap";
import {
  InvalidCursorScreen,
  LoadingScreen,
  NoLinesScreen,
  ScriptErrorScreen,
  ScriptMissingScreen,
  SegmentsErrorScreen,
} from "./RecordStatusScreens";

export type RecordClientProps = {
  readonly characterKey: string;
};

const MAX_DURATION_MS = 60_000;

export function RecordClient({
  characterKey,
}: RecordClientProps): ReactElement {
  const router = useRouter();
  const {
    script,
    scriptId,
    loading: scriptLoading,
    error: scriptError,
  } = useScript();

  const lines = useMemo<FlatLine[]>(() => {
    if (!script) return [];
    return getCharacterLines(script, characterKey);
  }, [script, characterKey]);

  const characterFullName = script?.characters[characterKey] ?? characterKey;

  const {
    doneIndices,
    setDoneIndices,
    loading: segmentsLoading,
    error: segmentsError,
  } = useDoneSegments(scriptId, characterKey);

  const [cursor, setCursor] = useState<number>(0);
  const recorder = useRecorder({ maxDurationMs: MAX_DURATION_MS });
  const currentRecordingMs = useRecordingTimer(recorder.state === "recording");
  const previewUrl = usePreviewUrl(
    recorder.state === "preview" ? recorder.blob : null,
  );
  const [savingError, setSavingError] = useState<string | null>(null);

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

  const goPrev = useCallback(() => {
    const next = computeNextCursor(lines, cursor, "prev");
    if (next !== null) gotoCursor(next);
  }, [cursor, gotoCursor, lines]);

  const goNext = useCallback(() => {
    const next = computeNextCursor(lines, cursor, "next");
    if (next !== null) gotoCursor(next);
  }, [cursor, gotoCursor, lines]);

  const lastCursorRef = useRef<number>(cursor);
  useEffect(() => {
    if (lastCursorRef.current !== cursor) {
      lastCursorRef.current = cursor;
      if (recorder.state !== "idle") recorder.reset();
    }
  }, [cursor, recorder]);

  const handleMainAction = useCallback((): void => {
    if (recorder.state === "idle" || recorder.state === "error") {
      void recorder.start();
      return;
    }
    if (recorder.state === "recording") recorder.stop();
  }, [recorder]);

  const handleConfirm = useCallback(async (): Promise<void> => {
    if (recorder.state !== "preview" || !recorder.blob) return;
    const currentLine = lines[cursor];
    if (!currentLine || !script) return;
    if (!scriptId) {
      setSavingError("尚未確定當前劇本 ID（請重新整理後再試）");
      return;
    }
    setSavingError(null);
    let scriptHash: string;
    try {
      scriptHash = await computeScriptHash(script);
    } catch (e: unknown) {
      setSavingError(e instanceof Error ? e.message : "計算劇本雜湊失敗");
      return;
    }
    const record = buildSegmentRecord({
      scriptId,
      characterKey,
      globalIndex: currentLine.globalIndex,
      blob: recorder.blob,
      mimeType: recorder.mimeType,
      durationMs: recorder.durationMs,
      scriptHash,
    });
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
    const nextCursor = computeNextCursor(lines, cursor, "next");
    if (nextCursor !== null) setCursor(nextCursor);
  }, [characterKey, cursor, lines, recorder, script, scriptId]);

  const handleConfirmClick = useCallback((): void => {
    void handleConfirm();
  }, [handleConfirm]);
  const handleRetake = useCallback((): void => recorder.reset(), [recorder]);
  const handleRetryPermission = useCallback((): void => {
    void recorder.start();
  }, [recorder]);
  const handleCancelError = useCallback((): void => recorder.reset(), [recorder]);
  const handleBackToSetup = useCallback((): void => router.push("/setup"), [router]);

  if (scriptLoading || segmentsLoading) return <LoadingScreen />;
  if (scriptError) return <ScriptErrorScreen message={scriptError.message} />;
  if (!script) return <ScriptMissingScreen />;
  if (lines.length === 0)
    return <NoLinesScreen characterFullName={characterFullName} />;
  if (segmentsError) return <SegmentsErrorScreen message={segmentsError} />;

  const currentLine = lines[cursor];
  if (!currentLine) return <InvalidCursorScreen />;

  const doneCount = doneIndices.size;
  const totalCount = lines.length;
  const isCurrentDone = doneIndices.has(currentLine.globalIndex);

  return (
    <main className="min-h-screen bg-black text-white">
      <RecordHeader
        characterFullName={characterFullName}
        doneCount={doneCount}
        totalCount={totalCount}
        onBackToSetup={handleBackToSetup}
      />

      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-stretch justify-center gap-10 px-6 pb-24 pt-24">
        <LineDisplay
          currentLine={currentLine}
          cursor={cursor}
          totalCount={totalCount}
          isCurrentDone={isCurrentDone}
        />

        <RecorderControls
          state={recorder.state}
          blob={recorder.blob}
          durationMs={recorder.durationMs}
          currentRecordingMs={currentRecordingMs}
          previewUrl={previewUrl}
          error={recorder.error}
          savingError={savingError}
          onMainAction={handleMainAction}
          onRetake={handleRetake}
          onConfirm={handleConfirmClick}
          onRetryPermission={handleRetryPermission}
          onCancelError={handleCancelError}
        />

        <MiniMap
          lines={lines}
          cursor={cursor}
          doneIndices={doneIndices}
          onJump={gotoCursor}
          onPrev={goPrev}
          onNext={goNext}
        />
      </section>
    </main>
  );
}
