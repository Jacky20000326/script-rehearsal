/**
 * useRehearsal — 對練核心整合 hook（v5 / M26 拆分後）
 *
 * 把狀態機（lib/stateMachine）+ 4 個子 effect hook 組裝起來：
 *   - useAudioPlaybackEffect   進 system_speaking → 抓 segment；命中播音檔，失敗 onFallback
 *   - useTTSEffect             進 system_speaking 且 (stage_direction 或 ttsForced) → 走 TTS / timer
 *   - useSTTEffect             進 waiting_actor → 啟動 STT，onMatch 推進
 *   - useRehearsalPersistence  節流寫 lastLineIndex + done 計數 + unmount 補寫
 *
 * 互斥啟動：
 *   - 兩個 system_speaking 副作用透過 ttsForced flag 接力：useAudioPlaybackEffect 先試音檔，
 *     失敗呼叫 onFallback → setTtsForced(true) → useTTSEffect 啟動。stage_direction 一律
 *     由 useTTSEffect 的 timer 路徑處理（useAudioPlaybackEffect 內部會直接 skip）。
 *
 * mountedRef 守衛保留：防 unmount 後 dispatch。
 *
 * 對外 API 完全不變（caller：app/rehearse/page.tsx）。
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSTT } from "./useSTT";
import { useTTS } from "./useTTS";
import { useTTSEffect } from "./useTTSEffect";
import { useSTTEffect } from "./useSTTEffect";
import { useAudioPlaybackEffect } from "./useAudioPlaybackEffect";
import { useRehearsalPersistence } from "./useRehearsalPersistence";
import {
  initialState,
  isActorLine,
  rehearsalReducer,
  type RehearsalEvent,
  type RehearsalState,
} from "@/lib/stateMachine";
import { AudioPlayer } from "@/lib/audioPlayer";
import type { SessionConfig } from "@/lib/sessionConfig";
import {
  isStageDirection,
  type AudioSegmentRecord,
  type FlatLine,
} from "@/lib/types";

export type UseRehearsalOptions = {
  readonly lines: readonly FlatLine[];
  readonly config: SessionConfig;
  readonly characters: ReadonlyArray<{ key: string; name: string }>;
  readonly startIndex?: number;
  readonly getSegment?: (
    characterKey: string,
    globalIndex: number,
  ) => Promise<AudioSegmentRecord | null>;
};

export type CurrentPlaybackSource = "audio" | "tts" | null;

export type UseRehearsalReturn = {
  readonly state: RehearsalState;
  readonly dispatch: (event: RehearsalEvent) => void;
  readonly currentLine: FlatLine | undefined;
  readonly isActorTurn: boolean;
  readonly start: () => void;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly forceAdvance: () => void;
  readonly goBack: () => void;
  readonly repeat: () => void;
  readonly gotoIndex: (i: number) => void;
  readonly ttsReady: boolean;
  readonly ttsUnsupported: boolean;
  readonly ttsSpeaking: boolean;
  readonly voicesAvailable: boolean;
  readonly sttSupported: boolean;
  readonly sttListening: boolean;
  readonly ttsAssignments: ReadonlyArray<{
    characterKey: string;
    voiceName: string | null;
    pitch: number;
    rate: number;
  }>;
  readonly currentPlaybackSource: CurrentPlaybackSource;
};

export function useRehearsal(options: UseRehearsalOptions): UseRehearsalReturn {
  const { lines, config, characters, startIndex, getSegment } = options;

  // ---------- reducer ----------

  const [state, dispatch] = useReducer(
    rehearsalReducer,
    undefined,
    (): RehearsalState =>
      initialState({
        lines,
        actorCharacterKey: config.character,
        hintMode: config.hintMode,
        startIndex,
      }),
  );

  // ---------- TTS / STT / AudioPlayer ----------

  const tts = useTTS(characters);
  const stt = useSTT(0.6);

  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    audioPlayerRef.current = new AudioPlayer();
    return () => {
      audioPlayerRef.current?.dispose();
      audioPlayerRef.current = null;
    };
  }, []);

  // ---------- mountedRef + safeDispatch ----------

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeDispatch = useCallback((event: RehearsalEvent): void => {
    if (!mountedRef.current) return;
    dispatch(event);
  }, []);

  // ---------- 衍生 ----------

  const currentLine = lines[state.currentIndex];
  const isActorTurn = isActorLine(currentLine, state.actorCharacterKey);

  // ---------- system_speaking 互斥旗標 ----------

  /**
   * 「音檔不可用 → 走 TTS」旗標。值為「此 fallback 旗標對應到哪一行 globalIndex」，
   * 用 globalIndex 而非 boolean，避免「換行了但 effect 還沒重置 → 上一輪 true 被錯誤套用到新行」的競態。
   */
  const [ttsForcedForGlobalIndex, setTtsForcedForGlobalIndex] = useState<
    number | null
  >(null);
  /** UI 用：當前對手台詞的播放來源 */
  const [currentPlaybackSource, setCurrentPlaybackSource] =
    useState<CurrentPlaybackSource>(null);

  // status / currentIndex 切換時：清空 UI playbackSource（fallback 旗標靠 globalIndex 比對自動失效）
  useEffect(() => {
    setCurrentPlaybackSource(null);
  }, [state.status, state.currentIndex]);

  // ---------- 副作用：system_speaking 推進回呼（穩定參考） ----------

  const handleSystemComplete = useCallback((): void => {
    safeDispatch({ type: "TTS_END" });
  }, [safeDispatch]);

  const handleAudioFallback = useCallback((globalIndex: number): void => {
    if (!mountedRef.current) return;
    setTtsForcedForGlobalIndex(globalIndex);
  }, []);

  const handleAudioStart = useCallback((): void => {
    setCurrentPlaybackSource("audio");
  }, []);

  const handleTtsStart = useCallback((): void => {
    setCurrentPlaybackSource("tts");
  }, []);

  const systemSpeakingEnabled = state.status === "system_speaking";

  useAudioPlaybackEffect({
    enabled: systemSpeakingEnabled,
    currentLine,
    currentIndex: state.currentIndex,
    audioPlayerRef,
    getSegment,
    onComplete: handleSystemComplete,
    onFallback: handleAudioFallback,
    onAudioStart: handleAudioStart,
  });

  // TTS 啟動條件：system_speaking 且（stage_direction 或「本行 fallback 旗標已置位」或無 getSegment）
  // 用 globalIndex 比對：上一行的 fallback 旗標永遠不會被誤套到當前行
  const ttsEffectTtsOnly =
    !!currentLine && !isStageDirection(currentLine)
      ? ttsForcedForGlobalIndex === currentLine.globalIndex || !getSegment
      : false;

  useTTSEffect({
    enabled: systemSpeakingEnabled,
    currentLine,
    ttsOnly: ttsEffectTtsOnly,
    ttsSpeak: tts.speak,
    ttsCancel: tts.cancel,
    onComplete: handleSystemComplete,
    onTtsStart: handleTtsStart,
  });

  // ---------- 副作用：waiting_actor STT ----------

  const handleSttMatch = useCallback(
    (text: string, score: number): void => {
      safeDispatch({ type: "STT_MATCH", text, score });
      safeDispatch({ type: "ACTOR_LINE_DONE" });
    },
    [safeDispatch],
  );

  const handleSttInterim = useCallback(
    (text: string): void => {
      safeDispatch({ type: "STT_INTERIM", text });
    },
    [safeDispatch],
  );

  useSTTEffect({
    enabled: state.status === "waiting_actor",
    currentLine,
    sttSupported: stt.isSupported,
    sttStartListening: stt.startListening,
    sttStopListening: stt.stopListening,
    onMatch: handleSttMatch,
    onInterim: handleSttInterim,
  });

  // ---------- 副作用：持久化 ----------

  useRehearsalPersistence({
    status: state.status,
    currentIndex: state.currentIndex,
    lines,
    characterKey: config.character,
  });

  // ---------- API ----------

  const stateRef = useRef(state);
  stateRef.current = state;

  const start = useCallback(
    (): void => safeDispatch({ type: "START" }),
    [safeDispatch],
  );
  const pause = useCallback(
    (): void => safeDispatch({ type: "PAUSE" }),
    [safeDispatch],
  );
  const resume = useCallback(
    (): void => safeDispatch({ type: "RESUME" }),
    [safeDispatch],
  );
  const goBack = useCallback(
    (): void => safeDispatch({ type: "BACK" }),
    [safeDispatch],
  );
  const repeat = useCallback(
    (): void => safeDispatch({ type: "REPEAT" }),
    [safeDispatch],
  );
  const gotoIndex = useCallback(
    (i: number): void => safeDispatch({ type: "GOTO", index: i }),
    [safeDispatch],
  );

  const forceAdvance = useCallback((): void => {
    const s = stateRef.current;
    if (s.status === "waiting_actor") {
      safeDispatch({ type: "ACTOR_LINE_DONE" });
    } else if (s.status === "system_speaking") {
      safeDispatch({ type: "TTS_END" });
    } else if (s.status === "idle") {
      safeDispatch({ type: "START" });
    }
  }, [safeDispatch]);

  const exposedDispatch = useMemo(() => safeDispatch, [safeDispatch]);

  return {
    state,
    dispatch: exposedDispatch,
    currentLine,
    isActorTurn,
    start,
    pause,
    resume,
    forceAdvance,
    goBack,
    repeat,
    gotoIndex,
    ttsReady: tts.isReady,
    ttsUnsupported: tts.isUnsupported,
    ttsSpeaking: tts.isSpeaking,
    voicesAvailable: tts.voicesAvailable,
    sttSupported: stt.isSupported,
    sttListening: stt.isListening,
    ttsAssignments: tts.assignments,
    currentPlaybackSource,
  };
}
