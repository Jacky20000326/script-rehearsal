import type { ReactElement } from "react";
import type { MutableLine } from "@/lib/scriptEdit";

export type LineRowProps = {
  readonly pageIdx: number;
  readonly lineIdx: number;
  readonly line: MutableLine;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly characterKeys: readonly string[];
  readonly characters: Readonly<Record<string, string>>;
  readonly onSetType: (pageIdx: number, lineIdx: number, kind: MutableLine["kind"]) => void;
  readonly onSetCharacter: (pageIdx: number, lineIdx: number, key: string) => void;
  readonly onSetText: (pageIdx: number, lineIdx: number, text: string) => void;
  readonly onMove: (pageIdx: number, lineIdx: number, direction: "up" | "down") => void;
  readonly onInsertAfter: (pageIdx: number, lineIdx: number) => void;
  readonly onDelete: (pageIdx: number, lineIdx: number) => void;
};

export function LineRow({
  pageIdx,
  lineIdx,
  line,
  isFirst,
  isLast,
  characterKeys,
  characters,
  onSetType,
  onSetCharacter,
  onSetText,
  onMove,
  onInsertAfter,
  onDelete,
}: LineRowProps): ReactElement {
  return (
    <li className="space-y-2 rounded-md border border-zinc-800 bg-black p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-zinc-500">#{lineIdx + 1}</span>
        <select
          value={line.kind}
          onChange={(e) =>
            onSetType(pageIdx, lineIdx, e.target.value as MutableLine["kind"])
          }
          className="rounded-sm border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
        >
          <option value="dialogue">對白</option>
          <option value="stage_direction">舞台指示</option>
        </select>

        {line.kind === "dialogue" && (
          <select
            value={line.character}
            onChange={(e) => onSetCharacter(pageIdx, lineIdx, e.target.value)}
            className="rounded-sm border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
          >
            <option value="">— 未指派 —</option>
            {characterKeys.map((k) => (
              <option key={k} value={k}>
                {k}
                {characters[k] && characters[k] !== k
                  ? `（${characters[k]}）`
                  : ""}
              </option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(pageIdx, lineIdx, "up")}
            disabled={isFirst}
            className="rounded-sm border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(pageIdx, lineIdx, "down")}
            disabled={isLast}
            className="rounded-sm border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => onInsertAfter(pageIdx, lineIdx)}
            className="rounded-sm border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            + 下方
          </button>
          <button
            type="button"
            onClick={() => onDelete(pageIdx, lineIdx)}
            className="rounded-sm border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            刪除
          </button>
        </div>
      </div>

      <textarea
        value={line.text}
        onChange={(e) => onSetText(pageIdx, lineIdx, e.target.value)}
        rows={2}
        placeholder={
          line.kind === "dialogue" ? "輸入台詞…" : "輸入舞台指示…"
        }
        className="w-full rounded-sm border border-zinc-800 bg-black px-2 py-1 text-sm text-white focus:border-zinc-500 focus:outline-none"
      />
    </li>
  );
}
