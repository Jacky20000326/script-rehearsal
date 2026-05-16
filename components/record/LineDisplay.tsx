import type { ReactElement } from "react";
import type { FlatLine } from "@/lib/types";

export type LineDisplayProps = {
  readonly currentLine: FlatLine;
  readonly cursor: number;
  readonly totalCount: number;
  readonly isCurrentDone: boolean;
};

export function LineDisplay({
  currentLine,
  cursor,
  totalCount,
  isCurrentDone,
}: LineDisplayProps): ReactElement {
  return (
    <div className="space-y-3 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
        第 {cursor + 1} / {totalCount} 行
        <span className="ml-3 text-zinc-700">
          page {currentLine.page} · #{currentLine.globalIndex}
        </span>
        {isCurrentDone && (
          <span className="ml-3 text-emerald-400">✓ 已錄</span>
        )}
      </p>
      <p className="text-3xl leading-relaxed text-white sm:text-4xl">
        {currentLine.text}
      </p>
    </div>
  );
}
