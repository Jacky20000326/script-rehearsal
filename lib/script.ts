/**
 * 劇本扁平化與切片工具
 *
 * 提供：
 *   - flattenScript()     將 pages × lines 攤平為 FlatLine[]
 *   - filterByRange()     依練習範圍切片
 *   - getCharacterList()  取得角色清單（給設定畫面）
 *   - getCharacterLines() 取得指定角色的所有台詞行（給錄音頁）
 *
 * v6 起無內建預設劇本：使用者必須透過 /scripts/import 匯入。
 * 來源由 useScript 從 IndexedDB 的 active ScriptRecord 取得。
 */

import {
  type FlatLine,
  type Range,
  type Script,
  isStageDirection,
} from "./types";

// ---------- Public API ----------

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
