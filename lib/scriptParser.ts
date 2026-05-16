/**
 * 劇本解析器（M19 純文字 + M20 PDF）
 *
 * 將「貼上的劇本純文字」或「PDF 每頁字串」轉成 Script 結構。
 *
 * 啟發式規則（共用 parseLines）：
 *   1. 頁碼標記：整行符合 `=== 第 N 頁 ===` 或 `--- p.N ---` → 開新頁
 *   2. 整行為括號內容（中／英括號、方括號）→ StageDirectionLine（保留括號）
 *   3. 「簡稱：台詞」格式 → DialogueLine
 *      - 冒號可為中文「：」或英文「:」
 *      - 簡稱限制 1-8 個字（中文、日文假名、英數）
 *   4. 連續空白行 → 純分頁，不產生 line
 *   5. 未能匹配任一規則的非空行 → warning（不丟入 lines）
 *   6. 行內 `（…）` 包夾段落 → 保留在台詞 text 內，發 warning 提示
 *
 * `parsePlainText`：無頁碼標記時整份歸入 page 1；遇頁碼標記則開新頁。
 * `parsePdfPages`：每個入參字串視為一頁（page = index + 1），各自呼叫 parseLines；
 *                  頁內頁碼標記會被忽略（僅作為文字，可能進 warning）。
 */

import type { DialogueLine, Line, Page, Script, StageDirectionLine } from "./types";

export type ParseResult = {
  script: Script;
  warnings: string[];
};

// ---------- Regex ----------

const DIALOGUE_RE = /^([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\w]{1,8})\s*[：:]\s*(.+)$/u;
const STAGE_RE = /^[\s]*[（(\[【][^]*[）)\]】][\s]*$/u;
const INLINE_PAREN_RE = /[（(][^（()）]*[）)]/u;
const PAGE_MARKER_RE = /^[\s]*(?:={2,}\s*第\s*(\d+)\s*頁\s*={2,}|-{2,}\s*p(?:age)?\.?\s*(\d+)\s*-{2,})[\s]*$/iu;

// ---------- Helpers ----------

function makeStage(text: string): StageDirectionLine {
  return { type: "stage_direction", text };
}

function makeDialogue(character: string, text: string): DialogueLine {
  return { character, text };
}

// ---------- 共用行解析（內部） ----------

type LineParseEvent =
  | { kind: "line"; line: Line }
  | { kind: "page_marker"; page: number }
  | { kind: "warning"; message: string };

/**
 * 把單一文字片段（純文字或 PDF 單頁）拆成行解析事件序列。
 * 由呼叫端決定要不要把 page_marker 事件解讀為「換頁」（純文字會，PDF 不會）。
 *
 * @param raw 待解析文字
 * @param lineOffset 行號偏移（給警告訊息用，第 N 行）；預設 0
 * @param warningPrefix 警告前綴（例 `第 3 頁 `）；預設空字串
 * @param charactersSet 共用的角色集合（保留插入順序）
 */
function parseLines(
  raw: string,
  charactersSet: Map<string, string>,
  warningPrefix: string,
): LineParseEvent[] {
  const events: LineParseEvent[] = [];
  const sourceLines = raw.replace(/\r\n?/g, "\n").split("\n");

  for (let i = 0; i < sourceLines.length; i++) {
    const rawLine = sourceLines[i] ?? "";
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) continue;

    const pageMatch = trimmed.match(PAGE_MARKER_RE);
    if (pageMatch) {
      const pageNum = Number.parseInt(pageMatch[1] ?? pageMatch[2] ?? "", 10);
      if (Number.isFinite(pageNum) && pageNum > 0) {
        events.push({ kind: "page_marker", page: pageNum });
        continue;
      }
      events.push({
        kind: "warning",
        message: `${warningPrefix}第 ${i + 1} 行：頁碼標記格式無法解析，已忽略。`,
      });
      continue;
    }

    if (STAGE_RE.test(trimmed)) {
      events.push({ kind: "line", line: makeStage(trimmed) });
      continue;
    }

    const dialogueMatch = trimmed.match(DIALOGUE_RE);
    if (dialogueMatch) {
      const key = dialogueMatch[1] ?? "";
      const text = (dialogueMatch[2] ?? "").trim();
      if (key.length === 0 || text.length === 0) {
        events.push({
          kind: "warning",
          message: `${warningPrefix}第 ${i + 1} 行：角色或台詞為空，已忽略。`,
        });
        continue;
      }
      if (!charactersSet.has(key)) {
        charactersSet.set(key, key);
      }
      if (INLINE_PAREN_RE.test(text)) {
        events.push({
          kind: "warning",
          message: `${warningPrefix}第 ${i + 1} 行：偵測到內嵌括號（…），本期保留於台詞文字中，可於編輯頁手動調整。`,
        });
      }
      events.push({ kind: "line", line: makeDialogue(key, text) });
      continue;
    }

    events.push({
      kind: "warning",
      message: `${warningPrefix}第 ${i + 1} 行：未能識別為角色台詞或舞台指示：「${trimmed.slice(0, 40)}${trimmed.length > 40 ? "…" : ""}」`,
    });
  }

  return events;
}

function charactersFromSet(set: Map<string, string>): Record<string, string> {
  const characters: Record<string, string> = {};
  for (const [k, v] of set) characters[k] = v;
  return characters;
}

// ---------- 公用：純文字 ----------

export function parsePlainText(raw: string): ParseResult {
  const warnings: string[] = [];
  const charactersSet = new Map<string, string>();

  type Bucket = { page: number; lines: Line[] };
  const buckets: Bucket[] = [{ page: 1, lines: [] }];
  let current: Bucket = buckets[0] as Bucket;

  const events = parseLines(raw, charactersSet, "");
  for (const ev of events) {
    if (ev.kind === "warning") {
      warnings.push(ev.message);
      continue;
    }
    if (ev.kind === "page_marker") {
      if (current.lines.length === 0 && buckets.length === 1) {
        current.page = ev.page;
      } else {
        const next: Bucket = { page: ev.page, lines: [] };
        buckets.push(next);
        current = next;
      }
      continue;
    }
    current.lines.push(ev.line);
  }

  const nonEmpty = buckets.filter((b) => b.lines.length > 0);
  const pages: Page[] =
    nonEmpty.length > 0
      ? nonEmpty.map((b) => ({ page: b.page, lines: b.lines }))
      : [{ page: 1, lines: [] }];

  const script: Script = {
    characters: charactersFromSet(charactersSet),
    pages,
  };
  return { script, warnings };
}

// ---------- 公用：PDF 多頁 ----------

/**
 * 把 PDF 各頁字串轉成 Script。
 * - page 編號採 index + 1（保留 PDF 原始順序與頁數）
 * - 每頁套用 parseLines；頁碼標記在 PDF 模式下不換頁，會被略過
 *   （若標記與 PDF 頁碼不同會混淆，採「以 PDF 物理頁為準」策略）
 * - 至少保留一頁（即使全空）
 */
export function parsePdfPages(pages: readonly string[]): ParseResult {
  const warnings: string[] = [];
  const charactersSet = new Map<string, string>();
  const out: Page[] = [];

  if (pages.length === 0) {
    return {
      script: { characters: {}, pages: [{ page: 1, lines: [] }] },
      warnings,
    };
  }

  for (let i = 0; i < pages.length; i++) {
    const raw = pages[i] ?? "";
    const pageNumber = i + 1;
    const prefix = `第 ${pageNumber} 頁 `;
    const events = parseLines(raw, charactersSet, prefix);
    const lines: Line[] = [];
    for (const ev of events) {
      if (ev.kind === "warning") {
        warnings.push(ev.message);
      } else if (ev.kind === "line") {
        lines.push(ev.line);
      }
      // page_marker：PDF 已有物理頁碼，內文頁碼標記忽略不換頁
    }
    out.push({ page: pageNumber, lines });
  }

  return {
    script: {
      characters: charactersFromSet(charactersSet),
      pages: out,
    },
    warnings,
  };
}
