"use client";

/**
 * useAudioSegments — 角色「逐行真人錄音」進度查詢 hook（v4 / M22）
 *
 * 提供：
 *   - progress  角色簡稱 → { recorded, total, scriptChanged }
 *   - loading   首次查詢中（含 script 尚未載入 / scriptId 尚未確定）
 *   - refresh   重新從 IndexedDB 取一次計數
 *   - removeAll 刪除指定角色的所有片段並 refresh
 *
 * 設計重點：
 *   1. recorded 用 `countSegmentsByCharacter(scriptId)` 一次取齊，避免每角色一筆 query
 *   2. total 透過 lib/script 的 `getCharacterLines(script, key).length` 算出
 *   3. SSR-safe：window 不存在時略過 IndexedDB 操作，loading 維持 true 直到 mount 後
 *   4. scriptChanged 透過比對「該（scriptId, 角色）任一筆 segment 的 scriptHash」與
 *      「當前劇本的 scriptHash」得出；無錄音時固定 false
 *   5. refresh 以世代計數（gen）做 cancellation：較新一輪 refresh 啟動時，
 *      舊一輪的非同步結果將被丟棄，避免覆蓋新狀態
 *   6. scriptId 變動時 totals / counts / changedMap 一律重算（multi-script 不串音）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countSegmentsByCharacter,
  deleteAllSegmentsForCharacter,
  getFirstSegment,
} from "@/lib/audioStorage";
import { getCharacterLines } from "@/lib/script";
import { computeScriptHash } from "@/lib/scriptHash";
import type { Script } from "@/lib/types";

export type CharacterProgress = {
  readonly recorded: number;
  readonly total: number;
  readonly scriptChanged: boolean;
};

export type UseAudioSegmentsResult = {
  readonly progress: Readonly<Record<string, CharacterProgress>>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly removeAll: (characterKey: string) => Promise<void>;
};

export function useAudioSegments(
  scriptId: string | null,
  characters: readonly { key: string }[],
  script: Script | null,
): UseAudioSegmentsResult {
  const keysSignature = useMemo(
    () => characters.map((c) => c.key).join("|"),
    [characters],
  );

  // 把 characters 放進 ref 給 refresh 取用，避免 callback 識別碼變動
  const charactersRef = useRef<readonly { key: string }[]>(characters);
  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  const scriptRef = useRef<Script | null>(script);
  useEffect(() => {
    scriptRef.current = script;
  }, [script]);

  const scriptIdRef = useRef<string | null>(scriptId);
  useEffect(() => {
    scriptIdRef.current = scriptId;
  }, [scriptId]);

  // totals 依 script 算一次；script 為 null 則為空 map
  const totals = useMemo<Record<string, number>>(() => {
    if (!script) return {};
    const out: Record<string, number> = {};
    for (const c of characters) {
      out[c.key] = getCharacterLines(script, c.key).length;
    }
    return out;
  }, [script, characters]);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [changedMap, setChangedMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /** refresh 世代計數：每次啟動 +1，回呼比對是否仍為最新世代 */
  const refreshGenRef = useRef<number>(0);

  const refresh = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined") return;
    const script = scriptRef.current;
    const sid = scriptIdRef.current;
    if (!script || !sid) {
      setLoading(true);
      setCounts({});
      setChangedMap({});
      return;
    }
    const myGen = ++refreshGenRef.current;
    try {
      const [raw, currentHash] = await Promise.all([
        countSegmentsByCharacter(sid),
        computeScriptHash(script),
      ]);
      if (myGen !== refreshGenRef.current) return;

      const keys = charactersRef.current.map((c) => c.key);
      const keep: Record<string, number> = {};
      for (const key of keys) {
        keep[key] = raw[key] ?? 0;
      }

      // 逐角色撈一筆 segment 比對 scriptHash；無錄音的角色直接 false
      const hashEntries = await Promise.all(
        keys.map(async (key): Promise<[string, boolean]> => {
          if ((keep[key] ?? 0) === 0) return [key, false];
          const first = await getFirstSegment(sid, key);
          if (!first) return [key, false];
          return [key, first.scriptHash !== currentHash];
        }),
      );
      if (myGen !== refreshGenRef.current) return;

      const changed: Record<string, boolean> = {};
      for (const [key, value] of hashEntries) {
        changed[key] = value;
      }

      setCounts(keep);
      setChangedMap(changed);
      setError(null);
    } catch (e: unknown) {
      if (myGen !== refreshGenRef.current) return;
      // 讀取失敗時保留舊計數；UI 可選擇顯示 error 訊息
      setError(e instanceof Error ? e.message : "讀取片段計數失敗");
    } finally {
      if (myGen === refreshGenRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // 首次掛載 + characters / script / scriptId 變動時重新查詢
  useEffect(() => {
    if (!script || !scriptId) {
      setLoading(true);
      setCounts({});
      setChangedMap({});
      return;
    }
    void refresh();
  }, [keysSignature, script, scriptId, refresh]);

  const removeAll = useCallback(
    async (characterKey: string): Promise<void> => {
      if (typeof window === "undefined") return;
      const sid = scriptIdRef.current;
      if (!sid) return;
      try {
        await deleteAllSegmentsForCharacter(sid, characterKey);
        await refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "刪除角色片段失敗");
        throw e;
      }
    },
    [refresh],
  );

  const progress = useMemo<Record<string, CharacterProgress>>(() => {
    const out: Record<string, CharacterProgress> = {};
    for (const c of characters) {
      const recorded = counts[c.key] ?? 0;
      out[c.key] = {
        recorded,
        total: totals[c.key] ?? 0,
        scriptChanged: recorded > 0 && (changedMap[c.key] ?? false),
      };
    }
    return out;
  }, [characters, counts, totals, changedMap]);

  return { progress, loading, error, refresh, removeAll };
}
