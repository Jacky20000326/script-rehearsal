"use client";

/**
 * useLocalStorage — 泛型 localStorage hook（SSR safe）
 *
 * 行為：
 *   - 首次 render：固定回傳 `initial`，server 與 client 首幀一致，不會 hydration mismatch
 *   - 掛載後（useEffect）：才從 localStorage 讀取真實值並覆寫 state
 *   - setValue：同步更新 React state 與 localStorage
 *
 * 限制：
 *   - 值必須能用 JSON.stringify / parse 序列化
 *   - 跨分頁同步未實作（如需可在 'storage' 事件補上）
 */

import { useCallback, useEffect, useState } from "react";

export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (value: T) => void] {
  // 首幀一律回 initial，避免 SSR ↔ CSR 首幀內容不一致
  const [value, setValue] = useState<T>(initial);

  // 掛載後同步真實 storage 值
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return;
      const parsed: unknown = JSON.parse(raw);
      // 此處無法在執行期驗證泛型 T 的形狀，故信任呼叫端的儲存 schema。
      // 若資料毀損會由呼叫端的 validator 處理（例如 lib/storage.ts）。
      setValue(parsed as T);
    } catch {
      // 解析失敗 → 維持 initial
    }
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // 寫入失敗（配額、私密模式等）靜默忽略
      }
    },
    [key],
  );

  return [value, update];
}
