import { useEffect, useState, type ReactElement } from "react";
import type { MutableLine, MutablePage } from "@/lib/scriptEdit";
import { LineRow } from "./LineRow";

export type PageEditorProps = {
  readonly pageIdx: number;
  readonly page: MutablePage;
  readonly characterKeys: readonly string[];
  readonly characters: Readonly<Record<string, string>>;
  readonly onRenamePage: (pageIdx: number, newPageRaw: string) => void;
  readonly onAppendLine: (pageIdx: number) => void;
  readonly onDeletePage: (pageIdx: number) => void;
  readonly onSetType: (pageIdx: number, lineIdx: number, kind: MutableLine["kind"]) => void;
  readonly onSetCharacter: (pageIdx: number, lineIdx: number, key: string) => void;
  readonly onSetText: (pageIdx: number, lineIdx: number, text: string) => void;
  readonly onMove: (pageIdx: number, lineIdx: number, direction: "up" | "down") => void;
  readonly onInsertAfter: (pageIdx: number, lineIdx: number) => void;
  readonly onDeleteLine: (pageIdx: number, lineIdx: number) => void;
};

export function PageEditor({
  pageIdx,
  page,
  characterKeys,
  characters,
  onRenamePage,
  onAppendLine,
  onDeletePage,
  onSetType,
  onSetCharacter,
  onSetText,
  onMove,
  onInsertAfter,
  onDeleteLine,
}: PageEditorProps): ReactElement {
  return (
    <article className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 pb-3">
        <span className="text-sm uppercase tracking-widest text-zinc-500">
          頁面
        </span>
        <PageNumberEditor
          currentPage={page.page}
          onCommit={(next) => onRenamePage(pageIdx, next)}
        />
        <span className="font-mono text-xs text-zinc-600">
          共 {page.lines.length} 行
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onAppendLine(pageIdx)}
            className="rounded-sm border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
          >
            + 新增行
          </button>
          <button
            type="button"
            onClick={() => onDeletePage(pageIdx)}
            className="rounded-sm border border-zinc-700 px-2 py-1 text-xs text-red-300 transition hover:bg-red-950"
          >
            刪除此頁
          </button>
        </div>
      </div>

      {page.lines.length === 0 ? (
        <p className="text-sm text-zinc-500">
          此頁尚無台詞，點上方「新增行」開始。
        </p>
      ) : (
        <ol className="space-y-2">
          {page.lines.map((line, lineIdx) => (
            <LineRow
              key={lineIdx}
              pageIdx={pageIdx}
              lineIdx={lineIdx}
              line={line}
              isFirst={lineIdx === 0}
              isLast={lineIdx === page.lines.length - 1}
              characterKeys={characterKeys}
              characters={characters}
              onSetType={onSetType}
              onSetCharacter={onSetCharacter}
              onSetText={onSetText}
              onMove={onMove}
              onInsertAfter={onInsertAfter}
              onDelete={onDeleteLine}
            />
          ))}
        </ol>
      )}
    </article>
  );
}

// ---------- 子元件：頁碼編輯（onBlur commit） ----------

type PageNumberEditorProps = {
  readonly currentPage: number;
  readonly onCommit: (newPageRaw: string) => void;
};

function PageNumberEditor({
  currentPage,
  onCommit,
}: PageNumberEditorProps): ReactElement {
  const [draft, setDraft] = useState<string>(String(currentPage));

  useEffect(() => {
    setDraft(String(currentPage));
  }, [currentPage]);

  const commit = (): void => {
    const next = Number.parseInt(draft, 10);
    if (!Number.isFinite(next) || next <= 0 || next === currentPage) {
      setDraft(String(currentPage));
      return;
    }
    onCommit(draft);
  };

  return (
    <div className="flex items-center gap-1 text-sm text-zinc-300">
      <span>第</span>
      <input
        type="number"
        min={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(String(currentPage));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-16 rounded-sm border border-zinc-700 bg-black px-2 py-1 text-sm text-white focus:border-zinc-500 focus:outline-none"
      />
      <span>頁</span>
    </div>
  );
}
