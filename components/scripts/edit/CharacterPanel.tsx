import { useEffect, useState, type ReactElement } from "react";

export type CharacterPanelProps = {
  readonly characterKeys: readonly string[];
  readonly characters: Readonly<Record<string, string>>;
  readonly usageByKey: Readonly<Record<string, number>>;
  readonly onAdd: () => void;
  readonly onRenameKey: (oldKey: string, newKey: string) => void;
  readonly onRenameName: (key: string, newName: string) => void;
  readonly onDelete: (key: string) => void;
};

export function CharacterPanel({
  characterKeys,
  characters,
  usageByKey,
  onAdd,
  onRenameKey,
  onRenameName,
  onDelete,
}: CharacterPanelProps): ReactElement {
  return (
    <section
      aria-label="角色面板"
      className="space-y-3 rounded-md border border-zinc-800 bg-zinc-950 p-5"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm uppercase tracking-widest text-zinc-500">
          角色
        </h2>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-sm border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
        >
          + 新增角色
        </button>
      </div>

      {characterKeys.length === 0 ? (
        <p className="text-sm text-zinc-500">尚無角色。</p>
      ) : (
        <ul className="space-y-2">
          {characterKeys.map((key) => {
            const used = usageByKey[key] ?? 0;
            return (
              <li
                key={key}
                className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-800 bg-black px-3 py-2"
              >
                <CharKeyEditor currentKey={key} onCommit={onRenameKey} />
                <input
                  type="text"
                  value={characters[key] ?? ""}
                  onChange={(e) => onRenameName(key, e.target.value)}
                  placeholder="全名"
                  className="flex-1 rounded-sm border border-zinc-700 bg-black px-2 py-1 text-sm text-white focus:border-zinc-500 focus:outline-none"
                />
                <span className="font-mono text-xs text-zinc-600">
                  {used} 行
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(key)}
                  className="rounded-sm border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800"
                >
                  刪除
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------- 子元件：角色 key 編輯（onBlur commit） ----------

type CharKeyEditorProps = {
  readonly currentKey: string;
  readonly onCommit: (oldKey: string, newKey: string) => void;
};

function CharKeyEditor({ currentKey, onCommit }: CharKeyEditorProps): ReactElement {
  const [draft, setDraft] = useState<string>(currentKey);

  useEffect(() => {
    setDraft(currentKey);
  }, [currentKey]);

  const commit = (): void => {
    const next = draft.trim();
    if (next.length === 0 || next === currentKey) {
      setDraft(currentKey);
      return;
    }
    onCommit(currentKey, next);
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDraft(currentKey);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="簡稱"
      className="w-20 rounded-sm border border-zinc-700 bg-black px-2 py-1 text-sm text-white focus:border-zinc-500 focus:outline-none"
    />
  );
}
