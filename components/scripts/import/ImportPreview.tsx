import type { ReactElement } from "react";
import { flattenScript } from "@/lib/script";
import type { ParseResult } from "@/lib/scriptParser";

type Props = {
  preview: ParseResult;
};

export function ImportPreview({ preview }: Props): ReactElement {
  const totalLines = flattenScript(preview.script).length;
  return (
    <section
      aria-label="解析結果"
      className="space-y-4 rounded-md border border-zinc-800 bg-zinc-950 p-5"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm uppercase tracking-widest text-zinc-500">
          解析結果
        </h2>
        <span className="font-mono text-xs text-zinc-600">
          {totalLines} 行 / {Object.keys(preview.script.characters).length} 角色 /{" "}
          {preview.script.pages.length} 頁
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs uppercase tracking-widest text-zinc-500">
          角色
        </h3>
        {Object.keys(preview.script.characters).length === 0 ? (
          <p className="text-sm text-zinc-500">尚未偵測到任何角色。</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {Object.entries(preview.script.characters).map(([k, v]) => (
              <li
                key={k}
                className="rounded-sm border border-zinc-700 px-2 py-1 font-mono text-xs text-zinc-300"
              >
                {k}
                {k !== v && <span className="ml-1 text-zinc-500">→ {v}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {preview.warnings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-widest text-amber-400">
            警告（{preview.warnings.length}）
          </h3>
          <ul className="space-y-1 text-xs text-amber-300">
            {preview.warnings.slice(0, 50).map((w, idx) => (
              <li key={`${idx}-${w.slice(0, 16)}`}>• {w}</li>
            ))}
            {preview.warnings.length > 50 && (
              <li className="text-amber-500">
                … 另有 {preview.warnings.length - 50} 條警告未顯示
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
