/**
 * 劇本內容雜湊
 *
 * 用途：M9+ 對齊功能將比對「對齊紀錄寫入時的 scriptHash」與「目前劇本的 scriptHash」，
 *      若不一致代表劇本已變更，UI 應提示使用者重新對齊。
 *
 * 設計：
 *   - 採 Web Crypto API（`crypto.subtle.digest`），瀏覽器與 Node ≥ 16 皆原生支援，
 *     無需引入 sha.js 等套件。
 *   - 序列化策略：將 Script 物件以「角色映射 + 每行 character/text」的最小規範形式
 *     序列化（避免被 JSON 鍵順序影響）。
 *   - 輸出：十六進位字串（長度 64，SHA-256）。
 *
 * SSR：`crypto.subtle` 在 Node ≥ 19 全域可用；在較舊環境若不存在則拋錯。
 *      Next.js 15 預設 Node ≥ 18.18，實務上不會缺。
 */

import { isStageDirection, type Script } from "./types";

/**
 * 將 Script 規範化為穩定字串。
 *
 * 重點：
 *   - characters 物件鍵依字典序排序後再串接，避免「等價內容因鍵順序不同產生不同 hash」
 *   - pages 依 page number 排序
 *   - 每行以 type-prefix 標明（dialogue / stage_direction），避免不同型別撞 hash
 *
 * 注意：本函式只負責「文本內容」的雜湊；不含 globalIndex 之類由執行期生成的欄位。
 */
function canonicalize(script: Script): string {
  // characters：依鍵字典序排序
  const charEntries = Object.entries(script.characters)
    .slice()
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("");

  // pages：依 page number 排序（雖然 JSON 通常已排序，仍主動規範以求穩定）
  const sortedPages = script.pages
    .slice()
    .sort((a, b) => a.page - b.page);

  const pageBlocks = sortedPages.map((p) => {
    const lineBlocks = p.lines.map((line) => {
      if (isStageDirection(line)) {
        return `S:${line.text}`;
      }
      return `D:${line.character}:${line.text}`;
    });
    return `P${p.page}${lineBlocks.join("")}`;
  });

  return `C${charEntries}${pageBlocks.join("")}`;
}

/** 將 ArrayBuffer 轉成 lower-case hex 字串。 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    // bytes[i] 在合法 Uint8Array 索引下不會是 undefined，但 TS strict 仍會視為可選
    const b = bytes[i] ?? 0;
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * 計算劇本的 SHA-256 雜湊（hex 字串）。
 *
 * 範例：
 * ```ts
 * const hash = await computeScriptHash(script);
 * // → "9a3f...（64 字）"
 * ```
 */
export async function computeScriptHash(script: Script): Promise<string> {
  const canonical = canonicalize(script);

  // 取得 SubtleCrypto：瀏覽器與現代 Node 皆有 globalThis.crypto.subtle
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "此環境不支援 Web Crypto API（crypto.subtle），無法計算劇本雜湊",
    );
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const digest = await subtle.digest("SHA-256", data);
  return bufferToHex(digest);
}
