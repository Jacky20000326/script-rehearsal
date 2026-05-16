import type { ReactElement } from "react";

type Props = {
  raw: string;
  onChange: (next: string) => void;
  onPreview: () => void;
  busy: boolean;
};

export function PlainTextTab({
  raw,
  onChange,
  onPreview,
  busy,
}: Props): ReactElement {
  return (
    <section className="space-y-3">
      <label htmlFor="script-text" className="block text-sm text-zinc-400">
        劇本內容（支援「角色：台詞」、整行括號舞台指示、
        <span className="font-mono">=== 第 N 頁 ===</span> 頁碼標記）
      </label>
      <textarea
        id="script-text"
        value={raw}
        onChange={(e) => onChange(e.target.value)}
        rows={16}
        placeholder={"維：胡利安：\n胡：什麼？\n（兩人對視）\n娜塔：我？"}
        className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 font-mono text-sm text-white focus:border-white focus:outline-none"
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onPreview}
          disabled={raw.trim().length === 0 || busy}
          className="rounded-md border border-zinc-600 px-5 py-2 text-base text-zinc-100 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          解析預覽
        </button>
      </div>
    </section>
  );
}
