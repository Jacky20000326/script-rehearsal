/**
 * localStorage 包裝
 *
 * 提供：
 *   - STORAGE_KEY              localStorage 鍵名常數
 *   - loadPracticeState()      讀取持久化狀態（SSR safe，無資料時回 null）
 *   - savePracticeState()      寫入持久化狀態（SSR 中為 no-op）
 *   - incrementPracticeCount() 純函式，回傳累加後的新 state（不直接寫 storage）
 *
 * SSR 安全策略：所有 `window` / `localStorage` 存取前都先以
 * `typeof window === 'undefined'` 守衛。
 */

import type { PracticeState } from "./types";

export const STORAGE_KEY = "script-rehearsal:practice-state";

// ---------- 內部驗證 ----------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  if (!isObject(value)) return false;
  for (const v of Object.values(value)) {
    if (typeof v !== "number" || !Number.isFinite(v)) return false;
  }
  return true;
}

function validatePracticeState(value: unknown): PracticeState | null {
  if (!isObject(value)) return null;
  if (typeof value.lastCharacter !== "string") return null;
  if (
    typeof value.lastLineIndex !== "number" ||
    !Number.isFinite(value.lastLineIndex)
  ) {
    return null;
  }
  if (!isNumberRecord(value.practiceCountByCharacter)) return null;
  return {
    lastCharacter: value.lastCharacter,
    lastLineIndex: value.lastLineIndex,
    practiceCountByCharacter: value.practiceCountByCharacter,
  };
}

// ---------- Public API ----------

/**
 * 從 localStorage 讀取練習狀態。
 *
 * - SSR 環境（無 window）：回 null
 * - 鍵不存在：回 null
 * - JSON 解析失敗或結構不符：回 null（不拋錯，視為首次使用）
 */
export function loadPracticeState(): PracticeState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return validatePracticeState(parsed);
  } catch {
    // 解析失敗（例如 storage 被外部寫壞）→ 視為無狀態
    return null;
  }
}

/**
 * 將練習狀態寫入 localStorage。
 *
 * - SSR 環境：no-op
 * - localStorage 配額爆炸等例外：吞掉錯誤（讓上層不至於崩潰），不阻塞主流程
 */
export function savePracticeState(state: PracticeState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 寫入失敗時靜默忽略，下一輪儲存有機會再試
  }
}

/**
 * 對指定角色的練習次數 +1，回傳新的 PracticeState（純函式，不寫 storage）。
 *
 * 設計理由：將「計算新狀態」與「持久化」拆開，方便 UI 在同一個 transition
 * 中同時更新 React state 與 storage。
 */
export function incrementPracticeCount(
  state: PracticeState,
  character: string,
): PracticeState {
  const prev = state.practiceCountByCharacter[character] ?? 0;
  return {
    ...state,
    practiceCountByCharacter: {
      ...state.practiceCountByCharacter,
      [character]: prev + 1,
    },
  };
}
