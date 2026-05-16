/**
 * scriptEdit — 劇本編輯的純資料層
 *
 * 從 ScriptEditClient 抽出的純函式集合：
 *   - WorkingCopy / MutablePage / MutableLine：UI 端可變結構
 *   - toWorking / toScript：record ⇄ working 雙向轉換
 *   - 各種對 WorkingCopy 的不可變更新（rename / add / delete / move / insert）
 *
 * 設計原則：
 *   1. 純函式：不 alert / 不 confirm / 不 setState，UI side effect 留在元件
 *   2. 不可變：每個操作回傳新的 WorkingCopy（或無變化時回原值），便於與 React state 配合
 *   3. 不依賴 React
 */

import type {
  DialogueLine,
  Line,
  Script,
  ScriptRecord,
  StageDirectionLine,
} from "./types";
import { isStageDirection } from "./types";

// ---------- Working copy 結構 ----------

export type MutableLine =
  | { kind: "dialogue"; character: string; text: string }
  | { kind: "stage_direction"; text: string };

export type MutablePage = {
  page: number;
  lines: MutableLine[];
};

export type WorkingCopy = {
  characters: Record<string, string>;
  pages: MutablePage[];
};

// ---------- record ⇄ working ----------

export function toWorking(record: ScriptRecord): WorkingCopy {
  const pages: MutablePage[] =
    record.script.pages.length === 0
      ? [{ page: 1, lines: [] }]
      : record.script.pages.map((p) => {
          const lines: MutableLine[] = [];
          for (const line of p.lines) {
            if (isStageDirection(line)) {
              lines.push({ kind: "stage_direction", text: line.text });
            } else {
              lines.push({
                kind: "dialogue",
                character: line.character,
                text: line.text,
              });
            }
          }
          return { page: p.page, lines };
        });
  return {
    characters: { ...record.script.characters },
    pages,
  };
}

export function toScript(wc: WorkingCopy): Script {
  const pages = wc.pages.map((p) => {
    const lines: Line[] = p.lines.map((l): Line => {
      if (l.kind === "stage_direction") {
        const sd: StageDirectionLine = { type: "stage_direction", text: l.text };
        return sd;
      }
      const d: DialogueLine = { character: l.character, text: l.text };
      return d;
    });
    return { page: p.page, lines };
  });
  return {
    characters: { ...wc.characters },
    pages,
  };
}

export function findNextPageNumber(pages: readonly MutablePage[]): number {
  if (pages.length === 0) return 1;
  const max = pages.reduce((m, p) => (p.page > m ? p.page : m), 0);
  return max + 1;
}

// ---------- 角色操作 ----------

export function renameCharacterKey(
  wc: WorkingCopy,
  oldKey: string,
  newKey: string,
): WorkingCopy {
  const nextChars: Record<string, string> = {};
  for (const k of Object.keys(wc.characters)) {
    const name = wc.characters[k] ?? k;
    if (k === oldKey) nextChars[newKey] = name;
    else nextChars[k] = name;
  }
  const nextPages: MutablePage[] = wc.pages.map((p) => ({
    page: p.page,
    lines: p.lines.map((l) =>
      l.kind === "dialogue" && l.character === oldKey
        ? { ...l, character: newKey }
        : l,
    ),
  }));
  return { ...wc, characters: nextChars, pages: nextPages };
}

export function renameCharacterName(
  wc: WorkingCopy,
  key: string,
  newName: string,
): WorkingCopy {
  return { ...wc, characters: { ...wc.characters, [key]: newName } };
}

export function addCharacter(wc: WorkingCopy): {
  wc: WorkingCopy;
  newKey: string;
} {
  let suffix = 1;
  let candidate = `角色${suffix}`;
  while (Object.prototype.hasOwnProperty.call(wc.characters, candidate)) {
    suffix += 1;
    candidate = `角色${suffix}`;
  }
  const newKey = candidate;
  return {
    wc: { ...wc, characters: { ...wc.characters, [newKey]: newKey } },
    newKey,
  };
}

export function deleteCharacter(wc: WorkingCopy, key: string): WorkingCopy {
  const nextChars: Record<string, string> = {};
  for (const k of Object.keys(wc.characters)) {
    if (k !== key) nextChars[k] = wc.characters[k] ?? k;
  }
  const nextPages: MutablePage[] = wc.pages.map((p) => ({
    page: p.page,
    lines: p.lines.map((l) =>
      l.kind === "dialogue" && l.character === key
        ? { ...l, character: "" }
        : l,
    ),
  }));
  return { ...wc, characters: nextChars, pages: nextPages };
}

// ---------- 行操作 ----------

export function setLineType(
  wc: WorkingCopy,
  pageIdx: number,
  lineIdx: number,
  kind: MutableLine["kind"],
): WorkingCopy {
  const page = wc.pages[pageIdx];
  if (!page) return wc;
  const lines = page.lines.slice();
  const cur = lines[lineIdx];
  if (!cur || cur.kind === kind) return wc;
  if (kind === "dialogue") {
    const firstChar = Object.keys(wc.characters)[0] ?? "";
    lines[lineIdx] = { kind: "dialogue", character: firstChar, text: cur.text };
  } else {
    lines[lineIdx] = { kind: "stage_direction", text: cur.text };
  }
  const nextPages = wc.pages.slice();
  nextPages[pageIdx] = { ...page, lines };
  return { ...wc, pages: nextPages };
}

export function setLineCharacter(
  wc: WorkingCopy,
  pageIdx: number,
  lineIdx: number,
  character: string,
): WorkingCopy {
  const page = wc.pages[pageIdx];
  if (!page) return wc;
  const lines = page.lines.slice();
  const cur = lines[lineIdx];
  if (!cur || cur.kind !== "dialogue") return wc;
  lines[lineIdx] = { ...cur, character };
  const nextPages = wc.pages.slice();
  nextPages[pageIdx] = { ...page, lines };
  return { ...wc, pages: nextPages };
}

export function setLineText(
  wc: WorkingCopy,
  pageIdx: number,
  lineIdx: number,
  text: string,
): WorkingCopy {
  const page = wc.pages[pageIdx];
  if (!page) return wc;
  const lines = page.lines.slice();
  const cur = lines[lineIdx];
  if (!cur) return wc;
  lines[lineIdx] = { ...cur, text };
  const nextPages = wc.pages.slice();
  nextPages[pageIdx] = { ...page, lines };
  return { ...wc, pages: nextPages };
}

export function moveLineInPage(
  wc: WorkingCopy,
  pageIdx: number,
  lineIdx: number,
  direction: "up" | "down",
): WorkingCopy {
  const page = wc.pages[pageIdx];
  if (!page) return wc;
  const lines = page.lines.slice();
  const delta = direction === "up" ? -1 : 1;
  const target = lineIdx + delta;
  if (target < 0 || target >= lines.length) return wc;
  const a = lines[lineIdx];
  const b = lines[target];
  if (!a || !b) return wc;
  lines[lineIdx] = b;
  lines[target] = a;
  const nextPages = wc.pages.slice();
  nextPages[pageIdx] = { ...page, lines };
  return { ...wc, pages: nextPages };
}

export function deleteLine(
  wc: WorkingCopy,
  pageIdx: number,
  lineIdx: number,
): WorkingCopy {
  const page = wc.pages[pageIdx];
  if (!page) return wc;
  const lines = page.lines.slice();
  lines.splice(lineIdx, 1);
  const nextPages = wc.pages.slice();
  nextPages[pageIdx] = { ...page, lines };
  return { ...wc, pages: nextPages };
}

export function insertLineAfter(
  wc: WorkingCopy,
  pageIdx: number,
  lineIdx: number,
): WorkingCopy {
  const page = wc.pages[pageIdx];
  if (!page) return wc;
  const lines = page.lines.slice();
  const firstChar = Object.keys(wc.characters)[0] ?? "";
  const inserted: MutableLine = {
    kind: "dialogue",
    character: firstChar,
    text: "",
  };
  lines.splice(lineIdx + 1, 0, inserted);
  const nextPages = wc.pages.slice();
  nextPages[pageIdx] = { ...page, lines };
  return { ...wc, pages: nextPages };
}

export function appendLine(wc: WorkingCopy, pageIdx: number): WorkingCopy {
  const page = wc.pages[pageIdx];
  if (!page) return wc;
  const firstChar = Object.keys(wc.characters)[0] ?? "";
  const inserted: MutableLine = {
    kind: "dialogue",
    character: firstChar,
    text: "",
  };
  const nextPages = wc.pages.slice();
  nextPages[pageIdx] = { ...page, lines: [...page.lines, inserted] };
  return { ...wc, pages: nextPages };
}

// ---------- 頁面操作 ----------

export function setPageNumber(
  wc: WorkingCopy,
  pageIdx: number,
  page: number,
): WorkingCopy {
  const cur = wc.pages[pageIdx];
  if (!cur || cur.page === page) return wc;
  const nextPages = wc.pages.slice();
  nextPages[pageIdx] = { ...cur, page };
  return { ...wc, pages: nextPages };
}

export function deletePage(wc: WorkingCopy, pageIdx: number): WorkingCopy {
  const nextPages = wc.pages.slice();
  nextPages.splice(pageIdx, 1);
  return { ...wc, pages: nextPages };
}

export function appendPage(wc: WorkingCopy): WorkingCopy {
  const nextNumber = findNextPageNumber(wc.pages);
  const newPage: MutablePage = { page: nextNumber, lines: [] };
  return { ...wc, pages: [...wc.pages, newPage] };
}
