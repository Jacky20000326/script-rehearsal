/**
 * PDF 文字抽取（M20）
 *
 * 流程：
 *   1. 動態 import 'pdfjs-dist'（避免進 SSR / root bundle）
 *   2. 設定 GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
 *      （worker 檔由 public 提供，避免 webpack 處理 worker URL）
 *   3. 對每頁呼叫 getTextContent()，依 hasEOL 切行、串成單頁字串
 *   4. 整份 PDF 文字 < MIN_TEXT_THRESHOLD 字 → 判定為圖片型 PDF（needsOcr）
 *
 * SSR：明確守衛 typeof window === 'undefined'。
 */

const PDF_WORKER_SRC = "/pdf.worker.min.mjs";
const MIN_TEXT_THRESHOLD = 50;

export type ExtractPdfTextResult = {
  pages: string[];
  needsOcr: boolean;
};

let workerConfigured = false;

async function loadPdfJs(): Promise<typeof import("pdfjs-dist")> {
  const mod = await import("pdfjs-dist");
  if (!workerConfigured) {
    mod.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
    workerConfigured = true;
  }
  return mod;
}

function isTextItem(item: unknown): item is { str: string; hasEOL: boolean } {
  if (typeof item !== "object" || item === null) return false;
  const rec = item as Record<string, unknown>;
  return typeof rec.str === "string" && typeof rec.hasEOL === "boolean";
}

function joinPageItems(items: readonly unknown[]): string {
  const parts: string[] = [];
  for (const item of items) {
    if (!isTextItem(item)) continue;
    parts.push(item.str);
    if (item.hasEOL) parts.push("\n");
  }
  return parts.join("").replace(/[ \t]+\n/g, "\n").trim();
}

export async function extractPdfText(
  file: File | Blob,
): Promise<ExtractPdfTextResult> {
  if (typeof window === "undefined") {
    throw new Error("extractPdfText() 僅可於瀏覽器端呼叫");
  }

  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const doc = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      try {
        const content = await page.getTextContent();
        pages.push(joinPageItems(content.items));
      } finally {
        page.cleanup();
      }
    }
    const total = pages.reduce((sum, p) => sum + p.trim().length, 0);
    if (total < MIN_TEXT_THRESHOLD) {
      return { pages: [], needsOcr: true };
    }
    return { pages, needsOcr: false };
  } finally {
    await doc.destroy();
  }
}
