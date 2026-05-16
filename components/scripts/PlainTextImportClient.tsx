"use client";

// 劇本匯入主元件：三來源（純文字／PDF／OCR）共用 tab、名稱、preview、建立流程。
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ImportHeader } from "@/components/scripts/import/ImportHeader";
import { ImportPreview } from "@/components/scripts/import/ImportPreview";
import { ImportTabs, type ImportTabKey } from "@/components/scripts/import/ImportTabs";
import { OcrTab } from "@/components/scripts/import/OcrTab";
import { PdfTab } from "@/components/scripts/import/PdfTab";
import { PlainTextTab } from "@/components/scripts/import/PlainTextTab";
import { useCreateScript } from "@/hooks/useCreateScript";
import { useOcrImport } from "@/hooks/useOcrImport";
import { usePdfImport } from "@/hooks/usePdfImport";
import { flattenScript } from "@/lib/script";
import { parsePdfPages, parsePlainText, type ParseResult } from "@/lib/scriptParser";
import type { ScriptRecord } from "@/lib/types";

const TAB_TO_SOURCE: Record<ImportTabKey, ScriptRecord["source"]> = {
  "plain-text": "plain-text",
  pdf: "pdf",
  "image-ocr": "image-ocr",
};

export function PlainTextImportClient(): ReactElement {
  const [tab, setTab] = useState<ImportTabKey>("plain-text");
  const [name, setName] = useState<string>("");
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [raw, setRaw] = useState<string>("");
  const [preview, setPreview] = useState<ParseResult | null>(null);

  const pdf = usePdfImport();
  const ocr = useOcrImport();
  const creator = useCreateScript();
  const lastPdfStateRef = useRef(pdf.state);
  const lastOcrStateRef = useRef(ocr.state);

  useEffect(() => {
    const prev = lastPdfStateRef.current;
    lastPdfStateRef.current = pdf.state;
    if (pdf.state === prev) return;
    if (pdf.state.kind === "error") {
      setSourceError(pdf.state.message);
      setPreview(null);
    } else if (pdf.state.kind === "ready" && !pdf.state.needsOcr) {
      setPreview(parsePdfPages(pdf.state.pages));
    }
  }, [pdf.state]);

  useEffect(() => {
    const prev = lastOcrStateRef.current;
    lastOcrStateRef.current = ocr.state;
    if (ocr.state === prev) return;
    if (ocr.state.kind === "error") {
      setSourceError(ocr.state.message);
      setPreview(null);
    } else if (ocr.state.kind === "aborted") {
      setSourceError("已取消 OCR 辨識。");
      setPreview(null);
    } else if (ocr.state.kind === "ready") {
      const parsed = parsePdfPages(ocr.state.pages);
      setPreview({
        script: parsed.script,
        warnings: [...ocr.state.warnings, ...parsed.warnings],
      });
    }
  }, [ocr.state]);

  const totalLines = useMemo(
    () => (preview ? flattenScript(preview.script).length : 0),
    [preview],
  );

  const handleSwitchTab = (next: ImportTabKey): void => {
    if (tab === next) return;
    ocr.cancel();
    setTab(next);
    setPreview(null);
    setSourceError(null);
    creator.clearError();
  };

  const handlePreviewPlainText = (): void => {
    setSourceError(null);
    try {
      setPreview(parsePlainText(raw));
    } catch (e: unknown) {
      setSourceError(e instanceof Error ? e.message : String(e));
      setPreview(null);
    }
  };

  const handlePdfFile = (file: File): void => {
    setSourceError(null);
    setPreview(null);
    void pdf.extract(file);
  };

  const handleStartOcr = (): void => {
    setSourceError(null);
    setPreview(null);
    void ocr.start();
  };

  const canCreate =
    !creator.busy &&
    preview !== null &&
    totalLines > 0 &&
    name.trim().length > 0;

  const handleCreate = (): void => {
    if (!canCreate || !preview) return;
    setSourceError(null);
    void creator.create({ name, source: TAB_TO_SOURCE[tab], preview });
  };

  const displayError = sourceError ?? creator.error;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <ImportHeader />

        <ImportTabs active={tab} onSwitch={handleSwitchTab} />

        <section className="space-y-3">
          <label htmlFor="script-name" className="block text-sm text-zinc-400">
            劇本名稱
          </label>
          <input
            id="script-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：第三幕第二場"
            className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-base text-white focus:border-white focus:outline-none"
          />
        </section>

        {tab === "plain-text" && (
          <PlainTextTab
            raw={raw}
            onChange={setRaw}
            onPreview={handlePreviewPlainText}
            busy={creator.busy}
          />
        )}

        {tab === "pdf" && (
          <PdfTab
            state={pdf.state}
            onFileChosen={handlePdfFile}
            busy={creator.busy}
          />
        )}

        {tab === "image-ocr" && (
          <OcrTab
            state={ocr.state}
            files={ocr.files}
            onFilesAdded={ocr.addFiles}
            onRemove={ocr.removeFile}
            onClear={ocr.clearFiles}
            onStart={handleStartOcr}
            onCancel={ocr.cancel}
            busy={creator.busy}
          />
        )}

        <section className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            className={
              canCreate
                ? "rounded-md bg-white px-5 py-2 text-base text-black transition hover:bg-zinc-200"
                : "cursor-not-allowed rounded-md bg-zinc-800 px-5 py-2 text-base text-zinc-500"
            }
          >
            建立並進入編輯
          </button>
        </section>

        {displayError && (
          <p className="text-sm text-red-400" role="alert">
            {displayError}
          </p>
        )}

        {preview && <ImportPreview preview={preview} />}
      </div>
    </main>
  );
}
