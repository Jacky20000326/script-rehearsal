"use client";

/**
 * useScript — 客戶端載入劇本 hook
 *
 * 回傳：
 *   - script  原始劇本物件（未載入或失敗時為 null）
 *   - flat    扁平化後的 FlatLine[]（未載入或失敗時為空陣列）
 *   - loading 載入中
 *   - error   錯誤物件（無錯誤時為 null）
 *
 * 來源順序（M18+）：
 *   1. IndexedDB 的 active scriptId 對應 ScriptRecord
 *   2. 上述任一缺失 → fallback 至 loadScript()（fetch /script.json）以維持向後相容
 *
 * 當 active scriptId 變動（透過 setActiveScriptId 或跨分頁 storage event），
 * 會自動重新載入。
 *
 * Hydration 安全：首次 render 即為 `{ loading: true }`，且所有副作用在 useEffect
 * 內觸發，server 與 client 首幀輸出一致，不會 mismatch。
 */

import { useEffect, useState } from "react";
import { flattenScript, loadScript } from "@/lib/script";
import {
  getActiveScriptId,
  getScript,
  subscribeActiveScriptId,
} from "@/lib/scriptStorage";
import type { FlatLine, Script } from "@/lib/types";

export type UseScriptResult = {
  script: Script | null;
  flat: FlatLine[];
  loading: boolean;
  error: Error | null;
};

export function useScript(): UseScriptResult {
  const [script, setScript] = useState<Script | null>(null);
  const [flat, setFlat] = useState<FlatLine[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        let resolved: Script | null = null;
        const activeId = getActiveScriptId();
        if (activeId) {
          const record = await getScript(activeId);
          if (record) resolved = record.script;
        }
        if (!resolved) {
          resolved = await loadScript();
        }
        if (cancelled) return;
        setScript(resolved);
        setFlat(flattenScript(resolved));
        setError(null);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setScript(null);
        setFlat([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    const unsubscribe = subscribeActiveScriptId(() => {
      setReloadToken((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  return { script, flat, loading, error };
}
