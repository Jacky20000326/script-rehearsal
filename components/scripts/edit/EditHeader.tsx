import type { ReactElement } from "react";
import type { ScriptRecord } from "@/lib/types";

export type EditHeaderProps = {
  readonly record: ScriptRecord;
  readonly dirty: boolean;
  readonly savedAt: number | null;
  readonly pageCount: number;
  readonly totalLines: number;
  readonly characterCount: number;
  readonly onBack: () => void;
};

export function EditHeader({
  record,
  dirty,
  savedAt,
  pageCount,
  totalLines,
  characterCount,
  onBack,
}: EditHeaderProps): ReactElement {
  return (
    <header className="space-y-2">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        ← 返回首頁
      </button>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-wide sm:text-4xl">
          編輯劇本
        </h1>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="font-mono">id: {record.id.slice(0, 8)}…</span>
          <span className="font-mono">source: {record.source}</span>
          {dirty ? (
            <span className="text-amber-400">● 未儲存變更</span>
          ) : savedAt ? (
            <span className="text-emerald-400">
              ✓ 已儲存 {new Date(savedAt).toLocaleTimeString()}
            </span>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-zinc-500">
        劇本名稱「{record.name}」（如需改名請於首頁劇本列表使用「重命名」）。
        共 {pageCount} 頁 / {totalLines} 行 / {characterCount} 角色。
      </p>
    </header>
  );
}
