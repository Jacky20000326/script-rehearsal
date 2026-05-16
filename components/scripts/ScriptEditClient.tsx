"use client";

/**
 * ScriptEditClient — 劇本編輯器（M23 拆分後）
 *
 * 角色：
 *   - 透過 useScriptEdit 取得 working / dirty / handlers
 *   - 負責 UI side effect（alert / confirm / 路由）並把 mutation 委派給純函式 + mutate
 *   - 版面組裝：EditHeader / CharacterPanel / PageEditor
 */

import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useScriptEdit } from "@/hooks/useScriptEdit";
import * as scriptEdit from "@/lib/scriptEdit";
import type { MutableLine } from "@/lib/scriptEdit";
import { EditHeader } from "./edit/EditHeader";
import { CharacterPanel } from "./edit/CharacterPanel";
import { PageEditor } from "./edit/PageEditor";
import { EditFallback } from "./edit/EditFallback";

export type ScriptEditClientProps = {
  readonly scriptId: string;
};

export function ScriptEditClient({
  scriptId,
}: ScriptEditClientProps): ReactElement {
  const router = useRouter();
  const {
    state,
    working,
    dirty,
    saving,
    savedAt,
    totalLines,
    characterKeys,
    usageByKey,
    mutate,
    save,
  } = useScriptEdit(scriptId);

  // ---------- 角色 ----------
  const handleRenameKey = (oldKey: string, newKeyRaw: string): void => {
    const newKey = newKeyRaw.trim();
    if (newKey.length === 0 || newKey === oldKey) return;
    if (working && Object.prototype.hasOwnProperty.call(working.characters, newKey)) {
      window.alert(`角色簡稱「${newKey}」已存在，請改用其他簡稱。`);
      return;
    }
    mutate((wc) => scriptEdit.renameCharacterKey(wc, oldKey, newKey));
  };

  const handleRenameName = (key: string, newName: string): void =>
    mutate((wc) => scriptEdit.renameCharacterName(wc, key, newName));

  const handleAddCharacter = (): void => {
    if (!working) return;
    mutate((wc) => scriptEdit.addCharacter(wc).wc);
  };

  const handleDeleteCharacter = (key: string): void => {
    const used = usageByKey[key] ?? 0;
    const baseMsg = `確定要刪除角色「${key}」？`;
    const fullMsg =
      used > 0
        ? `${baseMsg}\n注意：目前仍有 ${used} 行台詞引用此角色，刪除後這些行的角色欄位會變成空字串，請於台詞清單重新指派。`
        : baseMsg;
    if (!window.confirm(fullMsg)) return;
    mutate((wc) => scriptEdit.deleteCharacter(wc, key));
  };

  // ---------- 頁面 ----------
  const handleRenamePage = (pageIdx: number, newPageRaw: string): void => {
    const next = Number.parseInt(newPageRaw, 10);
    if (!Number.isFinite(next) || next <= 0) return;
    mutate((wc) => scriptEdit.setPageNumber(wc, pageIdx, next));
  };

  const handleDeletePage = (pageIdx: number): void => {
    if (!working) return;
    const target = working.pages[pageIdx];
    if (!target) return;
    if (working.pages.length === 1) {
      window.alert("至少需保留一頁。請改清空此頁的台詞，或先新增一頁再刪除。");
      return;
    }
    const lineCount = target.lines.length;
    const msg =
      lineCount > 0
        ? `確定刪除第 ${target.page} 頁？此頁含 ${lineCount} 行台詞，刪除後無法復原。`
        : `確定刪除第 ${target.page} 頁？`;
    if (!window.confirm(msg)) return;
    mutate((wc) => scriptEdit.deletePage(wc, pageIdx));
  };

  const handleAppendPage = (): void => mutate((wc) => scriptEdit.appendPage(wc));

  // ---------- 行 ----------
  const handleSetType = (p: number, l: number, kind: MutableLine["kind"]): void =>
    mutate((wc) => scriptEdit.setLineType(wc, p, l, kind));

  const handleSetCharacter = (p: number, l: number, key: string): void =>
    mutate((wc) => scriptEdit.setLineCharacter(wc, p, l, key));

  const handleSetText = (p: number, l: number, text: string): void =>
    mutate((wc) => scriptEdit.setLineText(wc, p, l, text));

  const handleMove = (p: number, l: number, direction: "up" | "down"): void =>
    mutate((wc) => scriptEdit.moveLineInPage(wc, p, l, direction));

  const handleDeleteLine = (p: number, l: number): void => {
    if (!window.confirm("確定要刪除這一行？")) return;
    mutate((wc) => scriptEdit.deleteLine(wc, p, l));
  };

  const handleInsertAfter = (p: number, l: number): void =>
    mutate((wc) => scriptEdit.insertLineAfter(wc, p, l));

  const handleAppendLine = (p: number): void =>
    mutate((wc) => scriptEdit.appendLine(wc, p));

  // ---------- 儲存 / 返回 ----------
  const handleSave = async (): Promise<void> => {
    const result = await save();
    if (!result.ok) {
      window.alert(`儲存失敗：${result.message}`);
    }
  };

  const handleBack = (): void => {
    if (dirty) {
      const ok = window.confirm("尚未儲存，確定要返回首頁？未存變更將遺失。");
      if (!ok) return;
    }
    router.push("/setup");
  };

  // ---------- Render ----------

  const goHome = (): void => router.push("/setup");

  if (state.kind === "loading") {
    return <EditFallback state={{ kind: "loading" }} onHome={goHome} />;
  }
  if (state.kind === "missing") {
    return <EditFallback state={{ kind: "missing", scriptId }} onHome={goHome} />;
  }
  if (state.kind === "error" || !working) {
    const message = state.kind === "error" ? state.message : null;
    return <EditFallback state={{ kind: "error", message }} onHome={goHome} />;
  }

  const { record } = state;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-12">
        <EditHeader
          record={record}
          dirty={dirty}
          savedAt={savedAt}
          pageCount={working.pages.length}
          totalLines={totalLines}
          characterCount={characterKeys.length}
          onBack={handleBack}
        />

        <CharacterPanel
          characterKeys={characterKeys}
          characters={working.characters}
          usageByKey={usageByKey}
          onAdd={handleAddCharacter}
          onRenameKey={handleRenameKey}
          onRenameName={handleRenameName}
          onDelete={handleDeleteCharacter}
        />

        <section aria-label="頁面與台詞" className="space-y-6">
          {working.pages.map((page, pageIdx) => (
            <PageEditor
              key={pageIdx}
              pageIdx={pageIdx}
              page={page}
              characterKeys={characterKeys}
              characters={working.characters}
              onRenamePage={handleRenamePage}
              onAppendLine={handleAppendLine}
              onDeletePage={handleDeletePage}
              onSetType={handleSetType}
              onSetCharacter={handleSetCharacter}
              onSetText={handleSetText}
              onMove={handleMove}
              onInsertAfter={handleInsertAfter}
              onDeleteLine={handleDeleteLine}
            />
          ))}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAppendPage}
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
            >
              + 新增頁面
            </button>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-6">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-md border border-zinc-600 px-5 py-2 text-base text-zinc-100 transition hover:bg-zinc-900"
          >
            返回首頁
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!dirty || saving}
            className={
              dirty && !saving
                ? "rounded-md bg-white px-6 py-2 text-base text-black transition hover:bg-zinc-200"
                : "cursor-not-allowed rounded-md bg-zinc-800 px-6 py-2 text-base text-zinc-500"
            }
          >
            {saving ? "儲存中…" : dirty ? "儲存變更" : "已儲存"}
          </button>
        </section>
      </div>
    </main>
  );
}
