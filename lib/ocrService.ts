/**
 * 圖片 OCR 服務（M21）
 *
 * 將一或多張圖片以 Tesseract.js（純前端 WASM）辨識為文字，
 * 每張圖片對應一「頁」，結果可直接餵給 `parsePdfPages`。
 *
 * 設計要點：
 *   1. 動態 import 'tesseract.js'：避免進 SSR / root bundle。
 *   2. workerPath / corePath / langPath 走 jsDelivr / tessdata CDN：
 *      - 不把 ~10 MB 語言包塞進 git
 *      - 避免 Next.js webpack 把 worker / wasm 拉進 client bundle
 *      - 首次需網路下載（約 10 MB），UI 端須提示使用者
 *   3. 雙語 `chi_tra+eng`：劇本常見中英數字混排，雙語明顯優於單 chi_tra。
 *   4. 進度回報：tesseract logger callback → 透過 `onProgress` 上拋，
 *      callback shape 為 `{ fileIndex, total, status, progress }`，
 *      `progress` 範圍 0..1。
 *   5. 取消：`signal.addEventListener('abort', ...)` → `worker.terminate()`，
 *      並在 abort 後拋 `DOMException('Aborted', 'AbortError')`。
 *   6. 容錯：單檔失敗只併入 warnings，不致整批 fail（除非 abort）。
 *
 * SSR 守衛：明確檢查 `typeof window === 'undefined'`。
 */

const TESSERACT_VERSION = "7.0.0";
const WORKER_PATH = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`;
const CORE_PATH = `https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0`;
const LANG_PATH = "https://tessdata.projectnaptha.com/4.0.0_best";
const LANGS = "chi_tra+eng";

export type OcrProgress = {
  readonly fileIndex: number;
  readonly total: number;
  readonly status: string;
  readonly progress: number;
};

export type RecognizeOptions = {
  readonly onProgress?: (p: OcrProgress) => void;
  readonly signal?: AbortSignal;
};

export type RecognizeImagesResult = {
  readonly pages: string[];
  readonly warnings: string[];
};

function makeAbortError(): DOMException {
  if (typeof DOMException === "function") {
    return new DOMException("Aborted", "AbortError");
  }
  const err = new Error("Aborted");
  err.name = "AbortError";
  return err as unknown as DOMException;
}

function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

/**
 * 將多張圖片依序辨識，每張對應 result.pages 的一個字串。
 * 即使中途某張失敗，仍會回傳已完成頁面 + warnings；abort 則拋出 AbortError。
 */
export async function recognizeImages(
  files: readonly File[],
  opts: RecognizeOptions = {},
): Promise<RecognizeImagesResult> {
  if (typeof window === "undefined") {
    throw new Error("recognizeImages() 僅可於瀏覽器端呼叫");
  }
  const total = files.length;
  const pages: string[] = [];
  const warnings: string[] = [];

  if (total === 0) {
    return { pages, warnings };
  }

  const { signal, onProgress } = opts;
  if (signal?.aborted) throw makeAbortError();

  // 動態 import：避免進 root bundle / SSR
  const mod = await import("tesseract.js");
  // tesseract.js 預設 export 為 namespace，createWorker 在 default 上
  const createWorker = mod.createWorker;

  let currentFileIndex = 0;

  const worker = await createWorker(LANGS, 1, {
    workerPath: WORKER_PATH,
    corePath: CORE_PATH,
    langPath: LANG_PATH,
    // workerBlobURL: true → tesseract 把 worker 包成 blob URL，繞過跨 origin 限制
    workerBlobURL: true,
    gzip: true,
    logger: (m): void => {
      if (!onProgress) return;
      // tesseract 進度 m.progress 範圍 0..1；status 例：
      //   'loading tesseract core'、'loading language traineddata'、
      //   'initializing api'、'recognizing text'
      onProgress({
        fileIndex: currentFileIndex,
        total,
        status: m.status,
        progress: typeof m.progress === "number" ? m.progress : 0,
      });
    },
  });

  // signal abort → 立刻 terminate worker
  let aborted = false;
  const onAbort = (): void => {
    aborted = true;
    // terminate 為 async 但不需 await（火後忘記）
    void worker.terminate();
  };
  signal?.addEventListener("abort", onAbort);

  try {
    for (let i = 0; i < total; i++) {
      currentFileIndex = i;
      if (aborted || signal?.aborted) throw makeAbortError();

      const file = files[i];
      if (!file) {
        pages.push("");
        warnings.push(`第 ${i + 1} 張圖片：檔案物件遺失，已略過。`);
        continue;
      }
      try {
        const { data } = await worker.recognize(file);
        const text = typeof data.text === "string" ? data.text.trim() : "";
        pages.push(text);
        if (text.length === 0) {
          warnings.push(
            `第 ${i + 1} 張圖片（${file.name}）：辨識結果為空，可能解析度過低或非文字內容。`,
          );
        }
      } catch (e: unknown) {
        if (isAbortError(e) || aborted) throw makeAbortError();
        pages.push("");
        warnings.push(
          `第 ${i + 1} 張圖片（${file.name}）辨識失敗：${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
    return { pages, warnings };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (!aborted) {
      try {
        await worker.terminate();
      } catch {
        // 終止失敗忽略
      }
    }
  }
}
