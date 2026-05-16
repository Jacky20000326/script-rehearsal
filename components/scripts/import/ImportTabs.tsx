import type { ReactElement } from "react";

export type ImportTabKey = "plain-text" | "pdf" | "image-ocr";

const OPTIONS: ReadonlyArray<{ key: ImportTabKey; label: string }> = [
  { key: "plain-text", label: "純文字" },
  { key: "pdf", label: "PDF" },
  { key: "image-ocr", label: "圖片 OCR" },
];

type Props = {
  active: ImportTabKey;
  onSwitch: (next: ImportTabKey) => void;
};

export function ImportTabs({ active, onSwitch }: Props): ReactElement {
  return (
    <nav aria-label="匯入來源" className="flex gap-2 border-b border-zinc-800">
      {OPTIONS.map((opt) => {
        const isActive = active === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onSwitch(opt.key)}
            className={[
              "border-b-2 px-3 py-2 text-sm transition",
              isActive
                ? "border-white text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </nav>
  );
}
