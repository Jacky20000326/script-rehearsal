import type { ReactElement } from "react";
import type { FlatLine } from "@/lib/types";

export type MiniMapProps = {
  readonly lines: readonly FlatLine[];
  readonly cursor: number;
  readonly doneIndices: ReadonlySet<number>;
  readonly onJump: (idx: number) => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
};

export function MiniMap({
  lines,
  cursor,
  doneIndices,
  onJump,
  onPrev,
  onNext,
}: MiniMapProps): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-900 pt-6">
      <button
        type="button"
        onClick={onPrev}
        disabled={cursor === 0}
        className="rounded-md border border-zinc-800 bg-transparent px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-30"
      >
        ◀ 上一行
      </button>
      <ul className="flex max-w-full flex-wrap items-center justify-center gap-1 overflow-x-auto">
        {lines.map((line, idx) => {
          const isDone = doneIndices.has(line.globalIndex);
          const isCurrent = idx === cursor;
          const base =
            "inline-flex h-6 w-6 items-center justify-center rounded text-[10px] font-mono transition";
          const className = isCurrent
            ? `${base} border border-white bg-white text-black`
            : isDone
              ? `${base} border border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40`
              : `${base} border border-zinc-800 bg-transparent text-zinc-500 hover:bg-zinc-900`;
          return (
            <li key={line.globalIndex}>
              <button
                type="button"
                aria-label={`跳到第 ${idx + 1} 行`}
                onClick={() => onJump(idx)}
                className={className}
              >
                {isDone ? "✓" : idx + 1}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onNext}
        disabled={cursor >= lines.length - 1}
        className="rounded-md border border-zinc-800 bg-transparent px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-30"
      >
        下一行 ▶
      </button>
    </div>
  );
}
