"use client";

/**
 * useRehearsal — 對練核心整合 hook
 *
 * 把狀態機（lib/stateMachine）、TTS（hooks/useTTS）、STT（hooks/useSTT）
 * 與持久化（lib/storage）組裝起來，對外提供乾淨的 API。
 *
 * 副作用驅動規則（依 state.status 變化）：
 *
 *   進入 system_speaking：
 *     - 當前行是 stage_direction → 啟動 1.5 秒 setTimeout，到時 dispatch TTS_END
 *     - 當前行是其他角色台詞 → 呼叫 TTS.speak，onEnd 時 dispatch TTS_END
 *
 *   進入 waiting_actor：
 *     - 啟動 STT，target 為當前行 text
 *     - onMatch 時 dispatch STT_MATCH + ACTOR_LINE_DONE
 *     - onInterim 時 dispatch STT_INTERIM
 *
 *   進入 paused：
 *     - cancel TTS + stop STT + 清 setTimeout
 *
 *   進入 done：
 *     - cancel TTS + stop STT
 *     - incrementPracticeCount + savePracticeState
 *
 *   進入 idle：no-op（等使用者 dispatch START）
 *
 * 持久化（lastLineIndex）：
 *   - 節流：每 5 行寫一次（避免每行都 IO）
 *   - 額外在 done / unmount 時補寫一次
 *   - 寫入時轉換本地索引 → globalIndex（取自 FlatLine.globalIndex）
 *
 * 設計細節：
 *   - 用 useRef 持有「最新一次 dispatch / state」以避免 effect 重執行造成 STT 重啟風暴
 *   - reducer 同步更新 currentIndex，但 effect 是 async 觸發，因此需要 cleanup 妥善處理
 *   - dispatch 在 setTimeout / TTS onEnd 回呼中可能於 unmount 後觸發，
 *     用「mountedRef」守衛
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSTT } from "./useSTT";
import { useTTS } from "./useTTS";
import {
  initialState,
  isActorLine,
  rehearsalReducer,
  type RehearsalEvent,
  type RehearsalState,
} from "@/lib/stateMachine";
import {
  incrementPracticeCount,
  loadPracticeState,
  savePracticeState,
} from "@/lib/storage";
import { AudioPlayer } from "@/lib/audioPlayer";
import type { SessionConfig } from "@/lib/sessionConfig";
import {
  isStageDirection,
  type AudioSegmentRecord,
  type FlatLine,
  type PracticeState,
} from "@/lib/types";

/** stage_direction 在不朗讀情況下的停留時間（毫秒） */
const STAGE_DIRECTION_DURATION_MS = 1500;

/** 每幾行寫一次 PracticeState.lastLineIndex */
const PERSIST_EVERY_N_LINES = 5;

export type UseRehearsalOptions = {
  /** 已切片後的台詞陣列（由 /rehearse page 用 filterByRange 處理） */
  readonly lines: readonly FlatLine[];
  /** 本次對練設定 */
  readonly config: SessionConfig;
  /** 角色清單（給 TTS 配音用） */
  readonly characters: ReadonlyArray<{ key: string; name: string }>;
  /** 對練起始本地索引；預設 0（M5 可從 SessionConfig 派生） */
  readonly startIndex?: number;
  /**
   * 取得指定角色 / 該行的真人錄音片段（v3 / M15）。可選；
   * 未提供時所有對手台詞走 TTS。
   *
   * 實作建議：直接接 `getAudioSegment(characterKey, globalIndex)`。
   * 回傳 null 代表該行未錄音，呼叫端會 fallback 至 TTS。
   */
  readonly getSegment?: (
    characterKey: string,
    globalIndex: number,
  ) => Promise<AudioSegmentRecord | null>;
};

/**
 * 當前對手台詞的播放來源（M10 新增）：
 *   - 'audio'  該行命中音檔對齊，正在播放真人錄音
 *   - 'tts'    fallback 至 Web Speech API 合成語音
 *   - null     當前不在 system_speaking（或當前行為玩家行 / 舞台指示）
 */
export type CurrentPlaybackSource = "audio" | "tts" | null;

export type UseRehearsalReturn = {
  readonly state: RehearsalState;
  readonly dispatch: (event: RehearsalEvent) => void;

  // 衍生
  readonly currentLine: FlatLine | undefined;
  readonly isActorTurn: boolean;

  // 副作用觸發（語意化包裝 dispatch）
  readonly start: () => void;
  readonly pause: () => void;
  readonly resume: () => void;
  /** 空白鍵備援：強制推進（不依賴 STT） */
  readonly forceAdvance: () => void;
  readonly goBack: () => void;
  readonly repeat: () => void;
  readonly gotoIndex: (i: number) => void;

  // TTS / STT 狀態暴露（debug UI 用）
  readonly ttsReady: boolean;
  /** 環境完全不支援 TTS（無 window.speechSynthesis） */
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
  /**
   * 當前對手台詞的播放來源（v2 / M10）。
   * 玩家行 / 舞台指示 / idle 時為 null。
   */
  readonly currentPlaybackSource: CurrentPlaybackSource;
};

export function useRehearsal(options: UseRehearsalOptions): UseRehearsalReturn {
  const { lines, config, characters, startIndex, getSegment } = options;

  // ---------- reducer ----------

  // lazy init：保證初始 lines / actorKey / hintMode 只在 mount 時建立
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

  // ---------- TTS / STT ----------

  const tts = useTTS(characters);
  const stt = useSTT(0.6);

  // ---------- AudioPlayer（v2 / M10） ----------

  /**
   * 單一 AudioPlayer 實例：mount 時建立、unmount 時 dispose。
   * 用 ref 而非 useState：本身不影響 render，且需要在 effect cleanup 內穩定取得。
   *
   * 改為 useEffect 內初始化（v3 / M16）：避免 React Strict Mode 重新 render
   * 期間留下未 dispose 的舊 instance，亦讓 SSR pass 完全不觸碰 AudioPlayer。
   */
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    audioPlayerRef.current = new AudioPlayer();
    return () => {
      audioPlayerRef.current?.dispose();
      audioPlayerRef.current = null;
    };
  }, []);

  /** 當前對手台詞的播放來源（UI 用，例：StatusBar 徽章） */
  const [currentPlaybackSource, setCurrentPlaybackSource] =
    useState<CurrentPlaybackSource>(null);

  /**
   * 把 getSegment 包成 ref，避免 effect 因 callback 識別碼變動反覆 cleanup。
   * 與舊版 alignmentQueryRef 模式一致。
   */
  const getSegmentRef = useRef<typeof getSegment>(getSegment);
  getSegmentRef.current = getSegment;

  /**
   * segment 非同步抓取的世代計數：每次進入 system_speaking 遞增；
   * 抓回來時若世代不符（已被 stop / 推進 / unmount）就丟棄結果。
   */
  const segmentFetchGen = useRef<number>(0);

  // ---------- ref：用於跨 callback 取最新值 ----------

  const stateRef = useRef(state);
  stateRef.current = state;

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** 安全 dispatch：unmount 後不發 */
  const safeDispatch = useCallback((event: RehearsalEvent): void => {
    if (!mountedRef.current) return;
    dispatch(event);
  }, []);

  // ---------- 衍生 ----------

  const currentLine = lines[state.currentIndex];
  const isActorTurn = isActorLine(currentLine, state.actorCharacterKey);

  // ---------- 持久化（節流寫 lastLineIndex） ----------

  /** 上次寫入的本地索引（用 ref 避免造成 effect 重跑） */
  const lastPersistedLocalIndexRef = useRef<number>(-1);

  const persistProgress = useCallback(
    (localIndex: number, force: boolean = false): void => {
      // localIndex 可能超出 lines.length（done 時為 lines.length）；clamp 一下
      if (lines.length === 0) return;
      const clamped = Math.min(Math.max(0, localIndex), lines.length - 1);
      // 節流
      if (
        !force &&
        Math.abs(clamped - lastPersistedLocalIndexRef.current) <
          PERSIST_EVERY_N_LINES
      ) {
        return;
      }
      lastPersistedLocalIndexRef.current = clamped;

      const line = lines[clamped];
      if (!line) return;
      const prev = loadPracticeState();
      const next: PracticeState = {
        lastCharacter: config.character,
        lastLineIndex: line.globalIndex,
        practiceCountByCharacter: prev?.practiceCountByCharacter ?? {},
      };
      savePracticeState(next);
    },
    [lines, config.character],
  );

  // ---------- 副作用：依 status 啟動 TTS / STT / timer ----------

  // 我們用一個 effect 監聽 (status, currentIndex)，內部以 switch 分派副作用，
  // cleanup 統一在 return 中處理。
  useEffect(() => {
    // 進入 idle / done 不啟動任何副作用，但 done 要處理持久化（見下面另一個 effect）
    if (state.status === "idle") {
      // 雙保險：對稱 paused 的處理，避免上一輪音檔在 idle 後繼續播
      audioPlayerRef.current?.stop();
      setCurrentPlaybackSource(null);
      return;
    }

    // paused 統一在 cleanup 處理（這個 effect 不需要 setup）
    if (state.status === "paused") {
      // 暫停時主動 stop 音檔 / TTS（雙保險，避免 cleanup race）
      audioPlayerRef.current?.stop();
      setCurrentPlaybackSource(null);
      return;
    }

    if (state.status === "done") {
      // 雙保險：對稱 paused 的處理，done 時若上一行的音檔仍在 schedule 也要停
      audioPlayerRef.current?.stop();
      setCurrentPlaybackSource(null);
      return;
    }

    const line = lines[state.currentIndex];
    if (!line) return;

    let cancelled = false;

    if (state.status === "system_speaking") {
      if (isStageDirection(line)) {
        // 舞台指示：不朗讀，1.5 秒後推進；不算 audio / tts
        setCurrentPlaybackSource(null);
        const timer = window.setTimeout(() => {
          if (cancelled) return;
          safeDispatch({ type: "TTS_END" });
        }, STAGE_DIRECTION_DURATION_MS);

        return () => {
          cancelled = true;
          window.clearTimeout(timer);
        };
      }

      // 共用：TTS 朗讀（v1.0 行為）
      const fallbackToTts = (): void => {
        if (cancelled) return;
        setCurrentPlaybackSource("tts");
        tts.speak({
          text: line.text,
          characterKey: line.character,
          onEnd: () => {
            if (cancelled) return;
            safeDispatch({ type: "TTS_END" });
          },
          onError: () => {
            if (cancelled) return;
            // 錯誤時保險推進，避免卡死
            safeDispatch({ type: "TTS_END" });
          },
        });
      };

      // 非己方角色台詞：非同步查 segment，命中則播音檔，否則 fallback TTS
      const fetchGen = ++segmentFetchGen.current;
      const myIndex = state.currentIndex;
      const fetcher = getSegmentRef.current;

      if (!fetcher) {
        fallbackToTts();
      } else {
        void fetcher(line.character, line.globalIndex)
          .then((segment) => {
            // 三重 race 防護：cancelled / fetchGen / currentIndex
            if (cancelled) return;
            if (fetchGen !== segmentFetchGen.current) return;
            if (stateRef.current.currentIndex !== myIndex) return;

            if (segment) {
              setCurrentPlaybackSource("audio");
              audioPlayerRef.current?.play(segment.blob, {
                onEnd: () => {
                  if (cancelled) return;
                  safeDispatch({ type: "TTS_END" });
                },
                onError: () => {
                  if (cancelled) return;
                  // 音檔播放失敗 → fallback TTS（不直接推進，給使用者聽到台詞）
                  fallbackToTts();
                },
              });
            } else {
              fallbackToTts();
            }
          })
          .catch(() => {
            if (cancelled) return;
            if (fetchGen !== segmentFetchGen.current) return;
            if (stateRef.current.currentIndex !== myIndex) return;
            // 讀取 segment 失敗 → fallback TTS，避免整個對練卡死
            fallbackToTts();
          });
      }

      return () => {
        cancelled = true;
        // 跳行 / 暫停 / unmount 時立即中斷音檔與 TTS
        audioPlayerRef.current?.stop();
        tts.cancel();
      };
    }

    if (state.status === "waiting_actor") {
      // 離開 system_speaking：不再有「對手播放」概念
      setCurrentPlaybackSource(null);
      // 啟動 STT；若不支援，使用者只能靠空白鍵 forceAdvance
      if (!stt.isSupported) {
        return;
      }
      stt.startListening(line.text, {
        onInterim: (text) => {
          if (cancelled) return;
          safeDispatch({ type: "STT_INTERIM", text });
        },
        onMatch: (text, score) => {
          if (cancelled) return;
          safeDispatch({ type: "STT_MATCH", text, score });
          safeDispatch({ type: "ACTOR_LINE_DONE" });
        },
        onError: () => {
          // 'no-speech' 等是常見情況；不做事，使用者可按空白鍵備援
        },
      });

      return () => {
        cancelled = true;
        stt.stopListening();
      };
    }
    // 此 effect 依 status / currentIndex 與 stt/tts 的 stable callback 重跑。
    // 注意：不可把整個 tts / stt 物件列為依賴。雖然其內部 callback 是 stable useCallback，
    //   但 isSpeaking / isListening 等 state 變動會使物件重建，導致 effect 被誤重觸發、
    //   cleanup 呼叫 tts.cancel() 中斷正在進行的 TTS。
    //   只列穩定的 callback 與必要 primitive 值。
  }, [
    state.status,
    state.currentIndex,
    lines,
    tts.speak,
    tts.cancel,
    stt.startListening,
    stt.stopListening,
    stt.isSupported,
    safeDispatch,
  ]);

  // ---------- 副作用：currentIndex 改變時節流寫入 storage ----------

  useEffect(() => {
    if (lines.length === 0) return;
    if (state.status === "done") return; // done 由另一個 effect 強制寫
    if (state.status === "idle") return;
    persistProgress(state.currentIndex);
  }, [state.currentIndex, state.status, lines.length, persistProgress]);

  // ---------- 副作用：進入 done 時補寫 + incrementPracticeCount ----------

  // 用 ref 防止 done 期間重 render 觸發多次計數
  const doneCountedRef = useRef(false);
  useEffect(() => {
    if (state.status !== "done") {
      doneCountedRef.current = false;
      return;
    }
    if (doneCountedRef.current) return;
    doneCountedRef.current = true;

    // 補寫進度（落在最後一行）
    if (lines.length > 0) {
      persistProgress(lines.length - 1, true);
    }

    // 練習次數 +1
    const prev = loadPracticeState();
    const base: PracticeState = prev ?? {
      lastCharacter: config.character,
      lastLineIndex:
        lines.length > 0 ? (lines[lines.length - 1]?.globalIndex ?? 0) : 0,
      practiceCountByCharacter: {},
    };
    const incremented = incrementPracticeCount(base, config.character);
    savePracticeState({
      ...incremented,
      lastCharacter: config.character,
      lastLineIndex:
        lines.length > 0
          ? (lines[lines.length - 1]?.globalIndex ?? base.lastLineIndex)
          : base.lastLineIndex,
    });
  }, [state.status, lines, config.character, persistProgress]);

  // ---------- 副作用：unmount 時補寫一次（避免最近 4 行內離開沒寫到） ----------

  useEffect(() => {
    return () => {
      if (lines.length === 0) return;
      const idx = stateRef.current.currentIndex;
      const clamped = Math.min(Math.max(0, idx), lines.length - 1);
      const line = lines[clamped];
      if (!line) return;
      const prev = loadPracticeState();
      savePracticeState({
        lastCharacter: config.character,
        lastLineIndex: line.globalIndex,
        practiceCountByCharacter: prev?.practiceCountByCharacter ?? {},
      });
    };
    // 只在 unmount 觸發；依賴最少
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- API ----------

  const start = useCallback((): void => {
    safeDispatch({ type: "START" });
  }, [safeDispatch]);

  const pause = useCallback((): void => {
    safeDispatch({ type: "PAUSE" });
  }, [safeDispatch]);

  const resume = useCallback((): void => {
    safeDispatch({ type: "RESUME" });
  }, [safeDispatch]);

  const forceAdvance = useCallback((): void => {
    const s = stateRef.current;
    // 空白鍵備援：
    // - waiting_actor → ACTOR_LINE_DONE
    // - system_speaking → TTS_END（不等 TTS 念完直接推進）
    // - idle → START
    // - paused / done → 忽略
    if (s.status === "waiting_actor") {
      safeDispatch({ type: "ACTOR_LINE_DONE" });
    } else if (s.status === "system_speaking") {
      safeDispatch({ type: "TTS_END" });
    } else if (s.status === "idle") {
      safeDispatch({ type: "START" });
    }
  }, [safeDispatch]);

  const goBack = useCallback((): void => {
    safeDispatch({ type: "BACK" });
  }, [safeDispatch]);

  const repeat = useCallback((): void => {
    safeDispatch({ type: "REPEAT" });
  }, [safeDispatch]);

  const gotoIndex = useCallback(
    (i: number): void => {
      safeDispatch({ type: "GOTO", index: i });
    },
    [safeDispatch],
  );

  // memo wrap dispatch（給呼叫端使用，與 internal safeDispatch 不同層級）
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
