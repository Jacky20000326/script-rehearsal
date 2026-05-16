"use client";

/**
 * usePdfImport — PDF 文字層抽取 hook（M24）
 *
 * 封裝 `lib/pdfExtract.extractPdfText` 的非同步流程與狀態機，
 * 不做解析（解析交由呼叫端使用 parsePdfPages）；不持有 File 本體。
 *
 * SSR 安全：動態 import 在 extract() 內進行。
 */

import { useCallback, useState } from "react";

export type PdfImportState =
  | { kind: "idle" }
  | { kind: "extracting"; fileName: string }
  | { kind: "ready"; fileName: string; pages: string[]; needsOcr: boolean }
  | { kind: "error"; message: string };

export type UsePdfImport = {
  state: PdfImportState;
  extract: (file: File) => Promise<void>;
  reset: () => void;
};

export function usePdfImport(): UsePdfImport {
  const [state, setState] = useState<PdfImportState>({ kind: "idle" });

  const extract = useCallback(async (file: File): Promise<void> => {
    setState({ kind: "extracting", fileName: file.name });
    try {
      const { extractPdfText } = await import("@/lib/pdfExtract");
      const result = await extractPdfText(file);
      setState({
        kind: "ready",
        fileName: file.name,
        pages: result.pages,
        needsOcr: result.needsOcr,
      });
    } catch (e: unknown) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  const reset = useCallback((): void => {
    setState({ kind: "idle" });
  }, []);

  return { state, extract, reset };
}
