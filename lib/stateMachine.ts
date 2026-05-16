/**
 * 對練狀態機（純函式 reducer）
 *
 * 對應 SPEC §4.2 的五態：
 *   idle             尚未開始（一開 mount 的狀態）
 *   system_speaking  系統說話中（TTS 或 stage_direction 等待）
 *   waiting_actor    等待演員念出己方台詞（STT 中）
 *   paused           暫停（保留 currentIndex，resume 後依當前行重新判斷）
 *   done             已練到範圍結尾
 *
 * 設計重點：
 *   1. 純函式：不觸發任何副作用（TTS / STT 啟動皆由 useRehearsal effect 處理）
 *   2. currentIndex 是「在切片後 lines 內的本地索引」，不是 globalIndex
 *   3. paused 狀態保留先前 status 不行，因為從 paused 回到「該繼續做什麼」
 *      可由當前行的種類完全推導出來 → resume 就重新走 deriveStatus 即可
 *   4. STT_INTERIM 與 STT_MATCH 只更新 lastInterim / lastMatchScore，
 *      推進由 ACTOR_LINE_DONE 統一處理（避免狀態機與 STT 抽象耦合過深）
 *
 * 邊界處理：
 *   - GOTO 超出範圍 → 自動 clamp 在 [0, lines.length-1]，並重設 lastInterim/score
 *   - BACK 在第 0 行 → no-op（保持當前狀態）
 *   - 進入空陣列範圍 → 直接 done
 */

import { isStageDirection, type FlatLine, type HintMode, type RehearsalStatus } from "./types";

// ---------- 對外型別 ----------

export type RehearsalState = {
  readonly status: RehearsalStatus;
  /** 在 lines 切片內的本地索引（非 globalIndex） */
  readonly currentIndex: number;
  /** 切片後的台詞陣列 */
  readonly lines: readonly FlatLine[];
  /** 玩家角色 key（簡稱） */
  readonly actorCharacterKey: string;
  /** 提示模式 */
  readonly hintMode: HintMode;
  /** 最近一次 STT 累積文字（debug 與 UI 顯示用） */
  readonly lastInterim?: string;
  /** 最近一次 STT 比對分數（0–1，UI debug 用） */
  readonly lastMatchScore?: number;
};

export type RehearsalEvent =
  /** 從 idle 啟動 */
  | { readonly type: "START" }
  /** 系統說話結束（TTS onend 或 stage_direction 時間到） */
  | { readonly type: "TTS_END" }
  /** 演員念完（STT match 或空白鍵備援） */
  | { readonly type: "ACTOR_LINE_DONE" }
  /** 跳到指定本地索引（測試 / 點擊行跳轉） */
  | { readonly type: "GOTO"; readonly index: number }
  /** 上一句 */
  | { readonly type: "BACK" }
  /** 重念目前句（重置 STT 累積，狀態維持 waiting_actor 或 system_speaking） */
  | { readonly type: "REPEAT" }
  /** 暫停 */
  | { readonly type: "PAUSE" }
  /** 繼續（從 paused 回到 idle/system_speaking/waiting_actor/done） */
  | { readonly type: "RESUME" }
  /** 切換提示模式 */
  | { readonly type: "SET_HINT_MODE"; readonly mode: HintMode }
  /** STT interim 文字更新（不推進） */
  | { readonly type: "STT_INTERIM"; readonly text: string }
  /** STT 達門檻（會由 useRehearsal 再 dispatch ACTOR_LINE_DONE） */
  | { readonly type: "STT_MATCH"; readonly text: string; readonly score: number };

// ---------- 輔助：判斷當前行該進入哪個狀態 ----------

/**
 * 判斷某行是否為玩家角色台詞。
 *
 * stage_direction 永遠不是玩家行（即使其文字含玩家角色名也不算）。
 */
export function isActorLine(
  line: FlatLine | undefined,
  actorKey: string,
): boolean {
  if (!line) return false;
  if (isStageDirection(line)) return false;
  return line.character === actorKey;
}

/**
 * 是否到達結尾。
 */
export function isDone(state: RehearsalState): boolean {
  return state.status === "done" || state.currentIndex >= state.lines.length;
}

/**
 * 給定行與玩家角色，推出該行的「期望 status」。
 *
 * - 範圍外 → done
 * - stage_direction → system_speaking（外層 hook 處理 1.5 秒 timer）
 * - 玩家行 → waiting_actor
 * - 其他角色行 → system_speaking
 */
function deriveStatusFromIndex(
  lines: readonly FlatLine[],
  index: number,
  actorKey: string,
): RehearsalStatus {
  if (index < 0 || index >= lines.length) return "done";
  const line = lines[index];
  if (!line) return "done";
  if (isStageDirection(line)) return "system_speaking";
  if (line.character === actorKey) return "waiting_actor";
  return "system_speaking";
}

// ---------- initial state ----------

export type InitialStateInput = {
  readonly lines: readonly FlatLine[];
  readonly actorCharacterKey: string;
  readonly hintMode: HintMode;
  /** 可選：起始本地索引；預設 0；超出範圍會 clamp */
  readonly startIndex?: number;
};

/**
 * 建立初始狀態（永遠是 idle，等使用者按開始）。
 */
export function initialState(input: InitialStateInput): RehearsalState {
  const lastIdx = Math.max(0, input.lines.length - 1);
  const startIndex = clampIndex(input.startIndex ?? 0, input.lines.length);
  return {
    status: input.lines.length === 0 ? "done" : "idle",
    currentIndex: input.lines.length === 0 ? 0 : Math.min(startIndex, lastIdx),
    lines: input.lines,
    actorCharacterKey: input.actorCharacterKey,
    hintMode: input.hintMode,
  };
}

/** 將索引 clamp 在 [0, length-1]，length 為 0 時回 0 */
function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(0, Math.trunc(index)), length - 1);
}

// ---------- reducer ----------

/**
 * 對練 reducer — 純函式。
 *
 * 注意：所有副作用（TTS speak、STT start、setTimeout）都由 useRehearsal effect
 *      根據 status / currentIndex 變化驅動，本 reducer 不負責。
 */
export function rehearsalReducer(
  state: RehearsalState,
  event: RehearsalEvent,
): RehearsalState {
  // 空範圍：所有事件除了 RESUME（從 done 也只能回 done）都維持 done
  if (state.lines.length === 0) {
    return state.status === "done" ? state : { ...state, status: "done" };
  }

  switch (event.type) {
    case "START": {
      // 只允許從 idle 啟動；其他狀態不重啟（避免誤觸）
      if (state.status !== "idle") return state;
      const nextStatus = deriveStatusFromIndex(
        state.lines,
        state.currentIndex,
        state.actorCharacterKey,
      );
      return {
        ...state,
        status: nextStatus,
        lastInterim: undefined,
        lastMatchScore: undefined,
      };
    }

    case "TTS_END": {
      // 只在 system_speaking 中有效
      if (state.status !== "system_speaking") return state;
      return advance(state);
    }

    case "ACTOR_LINE_DONE": {
      // 只在 waiting_actor 中有效；其他狀態忽略（避免 STT 殘留 callback 推進）
      if (state.status !== "waiting_actor") return state;
      return advance(state);
    }

    case "GOTO": {
      const clamped = clampIndex(event.index, state.lines.length);
      const nextStatus = deriveStatusFromIndex(
        state.lines,
        clamped,
        state.actorCharacterKey,
      );
      return {
        ...state,
        currentIndex: clamped,
        // 從 paused 跳轉後保持 paused（resume 才實際播）；其他狀態用 derived
        status: state.status === "paused" ? "paused" : nextStatus,
        lastInterim: undefined,
        lastMatchScore: undefined,
      };
    }

    case "BACK": {
      if (state.currentIndex <= 0) return state;
      const prev = state.currentIndex - 1;
      const nextStatus = deriveStatusFromIndex(
        state.lines,
        prev,
        state.actorCharacterKey,
      );
      return {
        ...state,
        currentIndex: prev,
        status: state.status === "paused" ? "paused" : nextStatus,
        lastInterim: undefined,
        lastMatchScore: undefined,
      };
    }

    case "REPEAT": {
      // 重念目前行：重置 STT 累積，並依目前行重新推導 status
      // （讓 useRehearsal effect 重新啟動 TTS 或 STT）
      const nextStatus = deriveStatusFromIndex(
        state.lines,
        state.currentIndex,
        state.actorCharacterKey,
      );
      return {
        ...state,
        status: state.status === "paused" ? "paused" : nextStatus,
        lastInterim: undefined,
        lastMatchScore: undefined,
      };
    }

    case "PAUSE": {
      if (state.status === "paused" || state.status === "done") return state;
      if (state.status === "idle") return state;
      return { ...state, status: "paused" };
    }

    case "RESUME": {
      if (state.status !== "paused") return state;
      const nextStatus = deriveStatusFromIndex(
        state.lines,
        state.currentIndex,
        state.actorCharacterKey,
      );
      return {
        ...state,
        status: nextStatus,
        // resume 時清空舊 interim（重新開始 STT）
        lastInterim: undefined,
        lastMatchScore: undefined,
      };
    }

    case "SET_HINT_MODE": {
      if (state.hintMode === event.mode) return state;
      return { ...state, hintMode: event.mode };
    }

    case "STT_INTERIM": {
      // 只在 waiting_actor 中更新（其他狀態忽略 STT 殘留回呼）
      if (state.status !== "waiting_actor") return state;
      if (state.lastInterim === event.text) return state;
      return { ...state, lastInterim: event.text };
    }

    case "STT_MATCH": {
      if (state.status !== "waiting_actor") return state;
      return {
        ...state,
        lastInterim: event.text,
        lastMatchScore: event.score,
      };
    }
  }
}

/**
 * 將 currentIndex 推進一格並判斷下一個狀態。
 *
 * 不在 reducer 內 inline 是為了讓 TTS_END / ACTOR_LINE_DONE 共用。
 */
function advance(state: RehearsalState): RehearsalState {
  const next = state.currentIndex + 1;
  if (next >= state.lines.length) {
    return {
      ...state,
      currentIndex: state.lines.length, // 越界一格便於 isDone 判斷
      status: "done",
      lastInterim: undefined,
      lastMatchScore: undefined,
    };
  }
  const nextStatus = deriveStatusFromIndex(
    state.lines,
    next,
    state.actorCharacterKey,
  );
  return {
    ...state,
    currentIndex: next,
    status: nextStatus,
    lastInterim: undefined,
    lastMatchScore: undefined,
  };
}
