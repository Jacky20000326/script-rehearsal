import type { ReactElement } from "react";
import { MAX_OCR_FILES, type OcrImportState } from "@/hooks/useOcrImport";

const OCR_ACCEPT = "image/jpeg,image/png,image/webp";

type Props = {
  state: OcrImportState;
  files: File[];
  onFilesAdded: (newFiles: File[]) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onStart: () => void;
  onCancel: () => void;
  busy: boolean;
};

export function OcrTab({
  state,
  files,
  onFilesAdded,
  onRemove,
  onClear,
  onStart,
  onCancel,
  busy,
}: Props): ReactElement {
  const recognizing = state.kind === "recognizing";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    onFilesAdded(Array.from(list));
    e.target.value = "";
  };

  return (
    <section className="space-y-4">
      <label htmlFor="ocr-files" className="block text-sm text-zinc-400">
        選擇圖片（JPEG／PNG／WebP，多張將視為多頁；最多 {MAX_OCR_FILES} 張）
      </label>
      <input
        id="ocr-files"
        type="file"
        accept={OCR_ACCEPT}
        multiple
        onChange={handleChange}
        disabled={recognizing || busy}
        className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-md file:border file:border-zinc-700 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <p
        className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400"
        role="note"
      >
        首次辨識需從 CDN 下載繁中＋英文模型約 10 MB（之後瀏覽器會快取）。
        中文辨識準確率有限，請於下一步編輯頁修正錯字／空白。
      </p>

      {files.length > 0 && (
        <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-950 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-zinc-500">
              已選擇 {files.length} 張
            </span>
            <button
              type="button"
              onClick={onClear}
              disabled={recognizing}
              className="text-xs text-zinc-500 transition hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              全部清除
            </button>
          </div>
          <ul className="space-y-1">
            {files.map((f, idx) => (
              <li
                key={`${idx}-${f.name}-${f.size}`}
                className="flex items-center justify-between gap-3 rounded border border-zinc-800 bg-black px-3 py-2 text-xs text-zinc-300"
              >
                <span className="flex-1 truncate font-mono">
                  {idx + 1}. {f.name}
                  <span className="ml-2 text-zinc-600">
                    ({Math.round(f.size / 1024)} KB)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  disabled={recognizing}
                  className="text-zinc-500 transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`移除 ${f.name}`}
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onStart}
          disabled={files.length === 0 || recognizing}
          className="rounded-md border border-zinc-600 px-5 py-2 text-base text-zinc-100 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          開始辨識
        </button>
        {recognizing && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-red-700 px-5 py-2 text-base text-red-300 transition hover:bg-red-950"
          >
            取消
          </button>
        )}
      </div>

      {state.kind === "recognizing" && (
        <div
          className="space-y-2 rounded-md border border-zinc-700 bg-zinc-950 p-3"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-zinc-300">
            辨識中：第 {state.progress.fileIndex + 1} / {state.progress.total} 張
            <span className="ml-2 text-zinc-500">
              （{state.progress.status}）
            </span>
          </p>
          <div className="h-2 w-full overflow-hidden rounded bg-zinc-800">
            <div
              className="h-full bg-white transition-all"
              style={{
                width: `${Math.round(
                  Math.max(0, Math.min(1, state.progress.progress)) * 100,
                )}%`,
              }}
            />
          </div>
          <p className="font-mono text-xs text-zinc-500">
            {Math.round(state.progress.progress * 100)}%
          </p>
        </div>
      )}

      {state.kind === "ready" && (
        <p className="text-sm text-zinc-400">
          辨識完成：共 {files.length} 張圖片 → {files.length} 頁。
          請於下方檢查解析結果後建立。
        </p>
      )}
    </section>
  );
}
