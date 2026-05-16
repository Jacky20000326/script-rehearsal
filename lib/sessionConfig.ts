/**
 * 對練設定（單次 session）跨頁傳遞工具
 *
 * 設計：
 *   設定頁將「角色 / 範圍 / 提示模式」寫入 sessionStorage，
 *   對練頁讀取後啟動。使用 sessionStorage 而非 query string，
 *   避免角色簡稱、自訂索引被惡意操作或被加入瀏覽歷史。
 *
 * SSR safe：
 *   所有 window 存取前都先以 typeof window === 'undefined' 守衛。
 *
 * Schema 驗證：
 *   讀取時做 narrow type guard；資料毀損視同沒有設定（回 null）。
 */

import type { HintMode, Range } from "./types";

/** sessionStorage 鍵名（單次 session 設定） */
export const SESSION_CONFIG_KEY = "script-rehearsal:session-config";

/**
 * 一次對練 session 所需的完整設定。
 *
 * - character：角色簡稱（例「維」）
 * - range：練習範圍（all / page / custom）
 * - hintMode：提示模式
 */
export type SessionConfig = {
  readonly character: string;
  readonly range: Range;
  readonly hintMode: HintMode;
};

// ---------- 內部驗證 ----------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRange(value: unknown): Range | null {
  if (!isObject(value)) return null;
  const kind = value.kind;
  if (kind === "all") {
    return { kind: "all" };
  }
  if (kind === "page") {
    if (typeof value.page !== "number" || !Number.isFinite(value.page)) {
      return null;
    }
    return { kind: "page", page: value.page };
  }
  if (kind === "custom") {
    if (
      typeof value.startIndex !== "number" ||
      !Number.isFinite(value.startIndex) ||
      typeof value.endIndex !== "number" ||
      !Number.isFinite(value.endIndex)
    ) {
      return null;
    }
    return {
      kind: "custom",
      startIndex: value.startIndex,
      endIndex: value.endIndex,
    };
  }
  return null;
}

function validateHintMode(value: unknown): HintMode | null {
  if (value === "full" || value === "first5" || value === "hidden") {
    return value;
  }
  return null;
}

function validateSessionConfig(value: unknown): SessionConfig | null {
  if (!isObject(value)) return null;
  if (typeof value.character !== "string" || value.character.length === 0) {
    return null;
  }
  const range = validateRange(value.range);
  if (!range) return null;
  const hintMode = validateHintMode(value.hintMode);
  if (!hintMode) return null;
  return { character: value.character, range, hintMode };
}

// ---------- Public API ----------

/** 寫入 session 設定（SSR no-op、寫入錯誤靜默忽略）。 */
export function saveSessionConfig(config: SessionConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // sessionStorage 配額爆炸或私密模式 → 靜默
  }
}

/** 讀取 session 設定（SSR 回 null、資料毀損回 null）。 */
export function loadSessionConfig(): SessionConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_CONFIG_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return validateSessionConfig(parsed);
  } catch {
    return null;
  }
}

/** 清除 session 設定（離開對練頁時可選用）。 */
export function clearSessionConfig(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_CONFIG_KEY);
  } catch {
    // 失敗靜默
  }
}
