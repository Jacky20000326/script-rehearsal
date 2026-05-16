import type { ReactElement } from "react";
import type { PdfImportState } from "@/hooks/usePdfImport";

type Props = {
  state: PdfImportState;
  onFileChosen: (file: File) => void;
  busy: boolean;
};

export function PdfTab({ state, onFileChosen, busy }: Props): ReactElement {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    onFileChosen(file);
    e.target.value = "";
  };

  return (
    <section className="space-y-3">
      <label htmlFor="pdf-file" className="block text-sm text-zinc-400">
        選擇 PDF 檔（將以瀏覽器端 pdfjs-dist 抽取文字層）
      </label>
      <input
        id="pdf-file"
        type="file"
        accept="application/pdf"
        onChange={handleChange}
        disabled={state.kind === "extracting" || busy}
        className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-md file:border file:border-zinc-700 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {state.kind === "extracting" && (
        <p className="text-sm text-zinc-400">
          正在解析「{state.fileName}」…（首次載入 pdfjs 約 1-2 秒）
        </p>
      )}
      {state.kind === "ready" && state.needsOcr && (
        <p
          className="rounded-md border border-amber-700 bg-amber-950 px-3 py-2 text-sm text-amber-300"
          role="alert"
        >
          「{state.fileName}」似乎不含可選取文字層（可能為掃描／圖片型 PDF）。請改用「圖片 OCR」分頁匯入。
        </p>
      )}
      {state.kind === "ready" && !state.needsOcr && (
        <p className="text-sm text-zinc-400">
          已抽取「{state.fileName}」共 {state.pages.length} 頁文字。
        </p>
      )}
    </section>
  );
}
