"use client";

/**
 * useOcrImport — 圖片 OCR 匯入 hook（M24）
 *
 * 封裝：檔案管理（含上限 20）、AbortController 生命週期、進度回報、
 * 與 `lib/ocrService.recognizeImages` 的整合。不做解析（交由呼叫端）。
 *
 * SSR 安全：動態 import 與 AbortController 皆在 start() 內。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { OcrProgress } from "@/lib/ocrService";

export const MAX_OCR_FILES = 20;

export type OcrImportState =
  | { kind: "idle" }
  | { kind: "recognizing"; progress: OcrProgress }
  | { kind: "ready"; pages: string[]; warnings: string[] }
  | { kind: "error"; message: string }
  | { kind: "aborted" };

export type UseOcrImport = {
  state: OcrImportState;
  files: File[];
  addFiles: (newFiles: File[]) => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  start: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
};

export function useOcrImport(): UseOcrImport {
  const [state, setState] = useState<OcrImportState>({ kind: "idle" });
  const [files, setFiles] = useState<File[]>([]);
  const filesRef = useRef<File[]>(files);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const addFiles = useCallback((newFiles: File[]): void => {
    setFiles((prev) => [...prev, ...newFiles].slice(0, MAX_OCR_FILES));
    setState({ kind: "idle" });
  }, []);

  const removeFile = useCallback((index: number): void => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setState({ kind: "idle" });
  }, []);

  const clearFiles = useCallback((): void => {
    setFiles([]);
    setState({ kind: "idle" });
  }, []);

  const reset = useCallback((): void => {
    setState({ kind: "idle" });
  }, []);

  const cancel = useCallback((): void => {
    abortRef.current?.abort();
  }, []);

  const start = useCallback(async (): Promise<void> => {
    const current = filesRef.current;
    if (current.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setState({
      kind: "recognizing",
      progress: {
        fileIndex: 0,
        total: current.length,
        status: "initializing",
        progress: 0,
      },
    });
    try {
      const { recognizeImages } = await import("@/lib/ocrService");
      const result = await recognizeImages(current, {
        signal: controller.signal,
        onProgress: (p) => {
          setState({ kind: "recognizing", progress: p });
        },
      });
      setState({
        kind: "ready",
        pages: result.pages,
        warnings: result.warnings,
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        setState({ kind: "aborted" });
      } else {
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    } finally {
      abortRef.current = null;
    }
  }, []);

  return {
    state,
    files,
    addFiles,
    removeFile,
    clearFiles,
    start,
    cancel,
    reset,
  };
}
