/**
 * 劇本載入與扁平化
 *
 * 提供：
 *   - loadScript()        從 /script.json 載入並驗證
 *   - flattenScript()     將 pages × lines 攤平為 FlatLine[]
 *   - filterByRange()     依練習範圍切片
 *   - getCharacterList()  取得角色清單（給設定畫面）
 *
 * 注意：本檔案不引入外部驗證套件（如 zod），驗證以手寫 narrowing 完成。
 */

import {
  type FlatLine,
  type Line,
  type Page,
  type Range,
  type Script,
  isStageDirection,
} from "./types";

// ---------- 內部驗證輔助 ----------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isObject(value)) return false;
  for (const v of Object.values(value)) {
    if (typeof v !== "string") return false;
  }
  return true;
}

function validateLine(value: unknown, ctx: string): Line {
  if (!isObject(value)) {
    throw new Error(`${ctx} 不是物件`);
  }

  // 舞台指示
  if (value.type === "stage_direction") {
    if (typeof value.text !== "string") {
      throw new Error(`${ctx} 舞台指示缺少字串 text 欄位`);
    }
    return { type: "stage_direction", text: value.text };
  }

  // 角色台詞
  if (typeof value.character === "string" && typeof value.text === "string") {
    return { character: value.character, text: value.text };
  }

  throw new Error(
    `${ctx} 不符合任一 Line 形狀（既非 stage_direction 也非 dialogue）`,
  );
}

function validatePage(value: unknown, ctx: string): Page {
  if (!isObject(value)) {
    throw new Error(`${ctx} 不是物件`);
  }
  if (typeof value.page !== "number" || !Number.isFinite(value.page)) {
    throw new Error(`${ctx} page 欄位需為有限數字`);
  }
  if (!Array.isArray(value.lines)) {
    throw new Error(`${ctx} lines 欄位需為陣列`);
  }
  const lines: Line[] = value.lines.map((line, idx) =>
    validateLine(line, `${ctx}.lines[${idx}]`),
  );
  return { page: value.page, lines };
}

function validateScript(value: unknown): Script {
  if (!isObject(value)) {
    throw new Error("劇本根節點不是物件");
  }
  if (!isStringRecord(value.characters)) {
    throw new Error("劇本 characters 欄位需為 Record<string, string>");
  }
  if (!Array.isArray(value.pages)) {
    throw new Error("劇本 pages 欄位需為陣列");
  }
  const pages: Page[] = value.pages.map((page, idx) =>
    validatePage(page, `pages[${idx}]`),
  );
  return { characters: value.characters, pages };
}

// ---------- Public API ----------

/**
 * 從 /script.json 載入劇本並驗證結構。
 * 失敗時拋出帶有路徑提示的明確錯誤。
 *
 * 注意：此函式可同時在 Server / Client 端呼叫（fetch 為 isomorphic）；
 *      在 Server Component 中亦可改用 `import scriptJson from '@/public/script.json'`，
 *      但為與既有 useScript hook 一致，這裡統一走 fetch。
 */
export async function loadScript(): Promise<Script> {
  const res = await fetch("/script.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`載入 script.json 失敗：HTTP ${res.status}`);
  }
  const raw: unknown = await res.json();
  return validateScript(raw);
}

/**
 * 將 Script 攤平為 FlatLine 陣列。
 *
 * - 順序：依 pages 順序、頁內 lines 順序逐行展開。
 * - 每行附上 globalIndex、page、lineIndexInPage 便於狀態機定位。
 */
export function flattenScript(script: Script): FlatLine[] {
  const out: FlatLine[] = [];
  let globalIndex = 0;
  for (const p of script.pages) {
    for (let i = 0; i < p.lines.length; i++) {
      const line = p.lines[i];
      // i 在迴圈範圍內，line 必存在；保留型別收窄而非使用非空斷言。
      if (!line) continue;
      // 透過 spread 同時保留 discriminator（'type' 或 character）。
      if (isStageDirection(line)) {
        out.push({
          type: "stage_direction",
          text: line.text,
          globalIndex,
          page: p.page,
          lineIndexInPage: i,
        });
      } else {
        out.push({
          character: line.character,
          text: line.text,
          globalIndex,
          page: p.page,
          lineIndexInPage: i,
        });
      }
      globalIndex += 1;
    }
  }
  return out;
}

/**
 * 依練習範圍切片扁平化後的劇本。
 *
 * - all     回傳完整陣列（保留原順序）
 * - page    回傳指定 page 的所有行
 * - custom  以 globalIndex 為基準，含 startIndex、含 endIndex
 *           startIndex > endIndex 時自動交換以容錯。
 *
 * 注意：參數型別為 `readonly FlatLine[]`，呼叫端可直接傳 useScript 回傳的
 *      不可變陣列，無需 `as FlatLine[]` 型別斷言。回傳一律為新陣列副本。
 */
export function filterByRange(
  flat: readonly FlatLine[],
  range: Range,
): FlatLine[] {
  switch (range.kind) {
    case "all":
      return flat.slice();
    case "page":
      return flat.filter((l) => l.page === range.page);
    case "custom": {
      const lo = Math.min(range.startIndex, range.endIndex);
      const hi = Math.max(range.startIndex, range.endIndex);
      return flat.filter((l) => l.globalIndex >= lo && l.globalIndex <= hi);
    }
  }
}

/**
 * 取得設定畫面用的角色清單。
 *
 * 回傳順序：依 script.characters 物件鍵的插入順序
 * （與 JSON 一致，現代 JS 對非數字字串鍵保留插入順序）。
 */
export function getCharacterList(
  script: Script,
): { key: string; name: string }[] {
  return Object.entries(script.characters).map(([key, name]) => ({
    key,
    name,
  }));
}

/**
 * 取得指定角色的所有台詞行（排除舞台指示）。
 *
 * 用途：M13 錄音頁需要逐行讓使用者錄音，僅針對該角色的對白行。
 * 順序：依扁平化後的 globalIndex 順序。
 */
export function getCharacterLines(
  script: Script,
  characterKey: string,
): Array<FlatLine & { character: string }> {
  return flattenScript(script).filter(
    (line): line is FlatLine & { character: string } =>
      !isStageDirection(line) && line.character === characterKey,
  );
}
