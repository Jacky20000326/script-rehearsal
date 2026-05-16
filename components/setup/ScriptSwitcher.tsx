"use client";

/**
 * ScriptSwitcher — 劇本切換器（M18，M28 放寬限制）
 *
 * 功能：
 *   1. 顯示所有已儲存劇本（依 updatedAt desc）
 *   2. 切換 active scriptId（觸發 useScript 重新載入）
 *   3. inline rename
 *   4. 刪除（含 confirm；可刪光所有劇本，刪光後 clearActiveScriptId → 首頁回到空狀態）
 *
 * 自管 state：元件內部呼叫 lib/scriptStorage，並訂閱 active scriptId 變更
 * 以同步顯示。父層僅需放置 `<ScriptSwitcher />`。
 *
 * SSR 安全：所有 storage 呼叫在 useEffect 內觸發，首幀回傳 loading skeleton。
 */

import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import {
  clearActiveScriptId,
  deleteScript,
  getActiveScriptId,
  listScripts,
  renameScript,
  setActiveScriptId,
  subscribeActiveScriptId,
} from "@/lib/scriptStorage";
import type { ScriptId, ScriptRecord } from "@/lib/types";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; scripts: ScriptRecord[]; activeId: ScriptId | null }
  | { kind: "error"; message: string };

export function ScriptSwitcher(): ReactElement {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [editingId, setEditingId] = useState<ScriptId | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const list = await listScripts();
      const active = getActiveScriptId();
      setState({ kind: "ready", scripts: list, activeId: active });
    } catch (e: unknown) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = subscribeActiveScriptId(() => {
      void refresh();
    });
    return unsubscribe;
  }, [refresh]);

  const handleSwitch = (id: ScriptId): void => {
    if (state.kind !== "ready" || id === state.activeId) return;
    setActiveScriptId(id);
  };

  const handleStartRename = (record: ScriptRecord): void => {
    setEditingId(record.id);
    setEditingValue(record.name);
  };

  const handleCancelRename = (): void => {
    setEditingId(null);
    setEditingValue("");
  };

  const handleCommitRename = async (id: ScriptId): Promise<void> => {
    const next = editingValue.trim();
    if (next.length === 0) {
      handleCancelRename();
      return;
    }
    if (state.kind === "ready") {
      const target = state.scripts.find((s) => s.id === id);
      if (target && target.name === next) {
        handleCancelRename();
        return;
      }
    }
    setBusy(true);
    try {
      await renameScript(id, next);
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      window.alert(`重命名失敗：${msg}`);
    } finally {
      setBusy(false);
      handleCancelRename();
    }
  };

  const handleDelete = async (record: ScriptRecord): Promise<void> => {
    if (state.kind !== "ready") return;
    const isLast = state.scripts.length <= 1;
    const confirmed = window.confirm(
      isLast
        ? `確定要刪除「${record.name}」嗎？這是最後一份劇本，刪除後將回到空狀態（需重新匯入才能對練）。此動作無法復原。`
        : `確定要刪除「${record.name}」嗎？此動作無法復原。`,
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await deleteScript(record.id);
      // 重新撈一次最新清單，依結果決定如何處置 active id
      const remaining = await listScripts();
      if (remaining.length === 0) {
        clearActiveScriptId();
      } else if (record.id === state.activeId) {
        const fallback = remaining[0];
        if (fallback) setActiveScriptId(fallback.id);
      }
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      window.alert(`刪除失敗：${msg}`);
    } finally {
      setBusy(false);
    }
  };

  if (state.kind === "loading") {
    return (
      <section
        aria-label="劇本切換"
        className="rounded-md border border-zinc-800 bg-zinc-950 p-5"
      >
        <p className="text-sm text-zinc-500">載入劇本清單中…</p>
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section
        aria-label="劇本切換"
        className="rounded-md border border-zinc-800 bg-zinc-950 p-5"
      >
        <p className="text-sm text-red-400">劇本清單載入失敗：{state.message}</p>
      </section>
    );
  }

  const { scripts, activeId } = state;

  return (
    <section
      aria-label="劇本切換"
      className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950 p-5"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm uppercase tracking-widest text-zinc-500">
          劇本
        </h2>
        <span className="font-mono text-xs text-zinc-600">
          {scripts.length} 份
        </span>
      </div>

      {scripts.length === 0 ? (
        <p className="text-sm text-zinc-500">尚無劇本記錄。</p>
      ) : (
        <ul className="space-y-2">
          {scripts.map((record) => {
            const isActive = record.id === activeId;
            const isEditing = record.id === editingId;
            return (
              <li
                key={record.id}
                className={
                  isActive
                    ? "flex items-center gap-2 rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2"
                    : "flex items-center gap-2 rounded-md border border-zinc-800 bg-transparent px-3 py-2"
                }
              >
                {isEditing ? (
                  <input
                    autoFocus
                    type="text"
                    value={editingValue}
                    disabled={busy}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => void handleCommitRename(record.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCommitRename(record.id);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        handleCancelRename();
                      }
                    }}
                    className="flex-1 rounded-sm border border-zinc-700 bg-black px-2 py-1 text-sm text-white focus:border-zinc-500 focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSwitch(record.id)}
                    aria-pressed={isActive}
                    className={
                      isActive
                        ? "flex-1 truncate text-left text-sm text-white"
                        : "flex-1 truncate text-left text-sm text-zinc-300 transition hover:text-white"
                    }
                  >
                    {record.name}
                    {isActive && (
                      <span className="ml-2 font-mono text-xs text-zinc-500">
                        使用中
                      </span>
                    )}
                  </button>
                )}

                {!isEditing && (
                  <>
                    <Link
                      href={`/scripts/${encodeURIComponent(record.id)}/edit`}
                      className="rounded-sm border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
                    >
                      ✎ 編輯
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleStartRename(record)}
                      disabled={busy}
                      className="rounded-sm border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(record)}
                      disabled={busy}
                      className="rounded-sm border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      刪除
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
