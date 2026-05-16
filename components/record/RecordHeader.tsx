import type { ReactElement } from "react";

export type RecordHeaderProps = {
  readonly characterFullName: string;
  readonly doneCount: number;
  readonly totalCount: number;
  readonly onBackToSetup: () => void;
};

export function RecordHeader({
  characterFullName,
  doneCount,
  totalCount,
  onBackToSetup,
}: RecordHeaderProps): ReactElement {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 border-b border-zinc-900 bg-black/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div className="min-w-0 truncate text-sm text-zinc-300">
          <span className="text-white">{characterFullName} 的錄音</span>
          <span className="mx-2 text-zinc-700">｜</span>
          <span className="text-zinc-500">
            進度 {doneCount} / {totalCount}
          </span>
        </div>
        <button
          type="button"
          onClick={onBackToSetup}
          className="whitespace-nowrap rounded border border-zinc-800 px-3 py-1 text-xs text-zinc-300 transition hover:bg-zinc-900"
        >
          返回設定
        </button>
      </div>
    </header>
  );
}
