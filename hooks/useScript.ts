"use client";

/**
 * useScript — 客戶端載入劇本 hook
 *
 * 回傳：
 *   - script  IDB 中 active ScriptRecord 的 script；未匯入或 active id 失效時為 null（**非錯誤狀態**）
 *   - flat    扁平化後的 FlatLine[]；script 為 null 時為空陣列
 *   - loading 載入中
 *   - error   錯誤物件（無錯誤時為 null）
 *   - scriptId 當前載入的 scriptId；未匯入時為 null（M22 起用於 audio 子系統 segment 隔離 key）
 *
 * 來源（M28 起）：
 *   - IndexedDB 的 active scriptId 對應 ScriptRecord
 *   - active id 為空或對應 record 不存在 → 回傳 `{ script: null, scriptId: null }`，由上層渲染空狀態
 *
 * v6（M28）起已移除 fetch `/script.json` 的 fallback；首頁不再自動 seed 預設劇本，
 * 使用者需主動匯入。
 *
 * 當 active scriptId 變動（透過 setActiveScriptId / clearActiveScriptId 或跨分頁
 * storage event），會自動重新載入。
 *
 * Hydration 安全：首次 render 即為 `{ loading: true }`，且所有副作用在 useEffect
 * 內觸發，server 與 client 首幀輸出一致，不會 mismatch。
 */

import { useEffect, useState } from "react";
import { flattenScript } from "@/lib/script";
import {
  getActiveScriptId,
  getScript,
  subscribeActiveScriptId,
} from "@/lib/scriptStorage";
import type { FlatLine, Script, ScriptId } from "@/lib/types";

export type UseScriptResult = {
  script: Script | null;
  flat: FlatLine[];
  loading: boolean;
  error: Error | null;
  scriptId: ScriptId | null;
};

export function useScript(): UseScriptResult {
  const [script, setScript] = useState<Script | null>(null);
  const [flat, setFlat] = useState<FlatLine[]>([]);
  const [scriptId, setScriptId] = useState<ScriptId | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const activeId = getActiveScriptId();
        let resolved: Script | null = null;
        let resolvedId: ScriptId | null = null;
        if (activeId) {
          const record = await getScript(activeId);
          if (record) {
            resolved = record.script;
            resolvedId = record.id;
          }
        }
        if (cancelled) return;
        setScript(resolved);
        setFlat(resolved ? flattenScript(resolved) : []);
        setScriptId(resolvedId);
        setError(null);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setScript(null);
        setFlat([]);
        setScriptId(null);
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

  return { script, flat, loading, error, scriptId };
}
