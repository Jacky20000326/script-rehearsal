/**
 * IndexedDB 連線層（v5 / M27）
 *
 * 集中宣告 schema 常數（DB_NAME / DB_VERSION / store 名 / index 名）與
 * 單例連線 `openAudioDB()`。
 *
 * - **SSR 安全**：所有公開函式進入時先以 `assertClient` 守衛。
 * - **單例**：用 module-level Promise cache 避免重複 open。
 * - **onclose / onversionchange / onblocked**：清 cache 允許下次重開。
 * - **schema 升級**：onupgradeneeded 內委派給 `lib/idb/migration.ts` 的 `applyMigration`。
 *
 * 業務 CRUD 不在此檔；參見 `lib/audioStorage.ts` 與 `lib/scriptStorage.ts`。
 */

import { assertClient } from "./promise";
import { applyMigration } from "./migration";

// ---------- 常數（schema 單一定義） ----------

export const DB_NAME = "script-rehearsal-audio";
export const DB_VERSION = 6;

/** audioSegments store 名稱（v3 起即為唯一保留的 segment store） */
export const STORE_AUDIO_SEGMENTS = "audioSegments";
/** byCharacter 索引（v3 起為非 unique；v5 仍以單欄 `characterKey` 作為 index path） */
export const INDEX_BY_CHARACTER = "byCharacter";
/** v4 新增：多劇本管理 store（keyPath: 'id'，無 index） */
export const STORE_SCRIPTS = "scripts";

// ---------- DB 連線（單例） ----------

/**
 * 連線 cache：module 等級的 Promise。
 *
 * 採 Promise 而非 IDBDatabase 直接 cache，可避免「open 中重複呼叫」造成
 * 同時開多條連線；任何呼叫者都會 await 同一個 Promise。
 *
 * 若連線被外部關閉（versionchange / close），會在下次呼叫時重新開啟。
 */
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * 開啟（或取得）資料庫連線。
 *
 * - 首次呼叫：執行 indexedDB.open；onupgradeneeded 內依 oldVersion 升級 schema
 * - 後續呼叫：直接回傳 cache 的 Promise
 * - 若連線被瀏覽器關閉（onclose）→ 清掉 cache 讓下次重開
 */
export function openAudioDB(): Promise<IDBDatabase> {
  assertClient("openAudioDB");

  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      applyMigration(req.result, event);
    };

    req.onsuccess = () => {
      const db = req.result;
      // 連線意外關閉時清 cache，允許下次重開
      db.onclose = () => {
        if (dbPromise) dbPromise = null;
      };
      // 若 server 端觸發 versionchange（其他分頁升級 schema），主動關閉本連線
      db.onversionchange = () => {
        db.close();
        if (dbPromise) dbPromise = null;
      };
      resolve(db);
    };

    req.onerror = () => {
      // open 失敗 → 清 cache，避免後續呼叫一直 await 失敗 Promise
      dbPromise = null;
      reject(
        req.error ?? new Error("無法開啟 IndexedDB（未提供詳細錯誤）"),
      );
    };

    req.onblocked = () => {
      // 其他分頁拒絕關閉舊版連線 → 提示使用者
      dbPromise = null;
      reject(new Error("資料庫開啟被其他分頁阻擋，請關閉其他分頁後重試"));
    };
  });

  return dbPromise;
}
