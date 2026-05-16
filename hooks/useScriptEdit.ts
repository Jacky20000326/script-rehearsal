"use client";

/**
 * useScriptEdit — 劇本編輯 hook
 *
 * 封裝：
 *   - 載入 ScriptRecord、轉成 WorkingCopy
 *   - dirty/saving/savedAt 狀態管理
 *   - mutate(fn)：對外暴露不可變更新點
 *   - save()：序列化 working → script，呼叫 putScript
 *   - reset()：回到目前 record 的 working snapshot
 *   - beforeunload 警告
 *   - 衍生值：characterKeys / usageByKey / totalLines
 *
 * UI side effect（alert / confirm / navigation）一律留在元件層。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getScript, putScript } from "@/lib/scriptStorage";
import { toScript, toWorking, type WorkingCopy } from "@/lib/scriptEdit";
import type { ScriptId, ScriptRecord } from "@/lib/types";

export type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ready"; record: ScriptRecord };

export type SaveResult =
  | { ok: true }
  | { ok: false; message: string };

export type UseScriptEdit = {
  state: LoadState;
  working: WorkingCopy | null;
  dirty: boolean;
  saving: boolean;
  savedAt: number | null;
  totalLines: number;
  characterKeys: string[];
  usageByKey: Record<string, number>;
  mutate: (fn: (wc: WorkingCopy) => WorkingCopy) => void;
  save: () => Promise<SaveResult>;
  reset: () => void;
};

export function useScriptEdit(scriptId: ScriptId): UseScriptEdit {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [working, setWorking] = useState<WorkingCopy | null>(null);
  const [dirty, setDirty] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // 載入
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const record = await getScript(scriptId);
        if (cancelled) return;
        if (!record) {
          setState({ kind: "missing" });
          return;
        }
        setState({ kind: "ready", record });
        setWorking(toWorking(record));
        setDirty(false);
      } catch (e: unknown) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scriptId]);

  // dirty 提示（離開頁面）
  useEffect(() => {
    if (!dirty) return;
    if (typeof window === "undefined") return;
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const mutate = useCallback((fn: (wc: WorkingCopy) => WorkingCopy): void => {
    setWorking((prev) => (prev ? fn(prev) : prev));
    setDirty(true);
  }, []);

  const reset = useCallback((): void => {
    setState((cur) => {
      if (cur.kind === "ready") {
        setWorking(toWorking(cur.record));
        setDirty(false);
      }
      return cur;
    });
  }, []);

  const save = useCallback(async (): Promise<SaveResult> => {
    if (state.kind !== "ready" || !working) {
      return { ok: false, message: "尚未載入完成" };
    }
    setSaving(true);
    try {
      const nextScript = toScript(working);
      const next: ScriptRecord = {
        ...state.record,
        script: nextScript,
        updatedAt: Date.now(),
      };
      await putScript(next);
      setState({ kind: "ready", record: next });
      setDirty(false);
      setSavedAt(Date.now());
      return { ok: true };
    } catch (e: unknown) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
      };
    } finally {
      setSaving(false);
    }
  }, [state, working]);

  const characterKeys = useMemo(
    () => (working ? Object.keys(working.characters) : []),
    [working],
  );

  const usageByKey = useMemo(() => {
    const map: Record<string, number> = {};
    if (!working) return map;
    for (const p of working.pages) {
      for (const l of p.lines) {
        if (l.kind === "dialogue") {
          map[l.character] = (map[l.character] ?? 0) + 1;
        }
      }
    }
    return map;
  }, [working]);

  const totalLines = useMemo(() => {
    if (!working) return 0;
    return working.pages.reduce((sum, p) => sum + p.lines.length, 0);
  }, [working]);

  return {
    state,
    working,
    dirty,
    saving,
    savedAt,
    totalLines,
    characterKeys,
    usageByKey,
    mutate,
    save,
    reset,
  };
}
