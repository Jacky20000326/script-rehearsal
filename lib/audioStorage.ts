/**
 * IndexedDB 音檔儲存層（v3）
 *
 * v3 將 schema 收斂為單一 store：
 *   - audioSegments  以 `[characterKey, globalIndex]` 複合 key 儲存「逐行真人錄音片段」
 *
 * v2 的三個 store（audioFiles / transcriptions / alignments）已棄用；
 * 升級時會直接刪除舊 store。v2 留下的舊匯出仍保留為「軟著陸 stub」，
 * 讓 hooks / components 在 M13–M15 改寫前不會炸掉（讀回 null/[]、寫 no-op + 一次性 warn）。
 *
 * 設計重點：
 *   1. 不引入外部執行期依賴；直接包 IndexedDB 原生 API。
 *   2. **SSR 安全**：所有公開函式進入時先以 `typeof window === 'undefined'` 守衛拋錯。
 *   3. **單例連線**：用 module-level Promise cache 避免重複 open。
 *   4. **Promise 化**：將 IDBRequest / IDBTransaction 包裝為 Promise，附明確錯誤訊息。
 */

import type { AudioSegmentRecord } from "./types";

// ---------- 常數 ----------

export const DB_NAME = "script-rehearsal-audio";
export const DB_VERSION = 4;

/** v3 唯一保留的 store */
export const STORE_AUDIO_SEGMENTS = "audioSegments";
/** v3 byCharacter 索引（非 unique） */
export const INDEX_BY_CHARACTER = "byCharacter";
/** v4 新增：多劇本管理 store（keyPath: 'id'，無 index） */
export const STORE_SCRIPTS = "scripts";

// ---------- 內部工具 ----------

/** SSR 守衛：在 server 端呼叫一律拋錯，避免吞掉開發者錯誤。 */
function assertClient(fnName: string): void {
  if (typeof window === "undefined") {
    throw new Error(`audioStorage.${fnName}() 僅可於瀏覽器端呼叫`);
  }
  if (typeof window.indexedDB === "undefined") {
    throw new Error("此瀏覽器不支援 IndexedDB，無法使用音檔功能");
  }
}

/**
 * 將 IDBRequest 包成 Promise。
 * 同時提供「結果是否符合預期型別」的 narrowing 由呼叫端負責。
 */
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("IndexedDB 操作失敗（未提供詳細錯誤）"),
      );
  });
}

/**
 * 將 IDBTransaction 包成 Promise，待 transaction complete 後 resolve。
 * 用於確保「寫入」操作真的落地。
 */
function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB 交易失敗（未提供詳細錯誤）"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB 交易被中止"));
  });
}

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
      const db = req.result;
      const oldVersion = event.oldVersion;

      // v1 → v2：拋棄舊三 store，建立新的 audioSegments
      if (oldVersion < 2) {
        // v2 legacy store, dropped on upgrade
        if (db.objectStoreNames.contains("audioFiles")) {
          db.deleteObjectStore("audioFiles");
        }
        // v2 legacy store, dropped on upgrade
        if (db.objectStoreNames.contains("transcriptions")) {
          db.deleteObjectStore("transcriptions");
        }
        // v2 legacy store, dropped on upgrade
        if (db.objectStoreNames.contains("alignments")) {
          db.deleteObjectStore("alignments");
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO_SEGMENTS)) {
          const store = db.createObjectStore(STORE_AUDIO_SEGMENTS, {
            keyPath: ["characterKey", "globalIndex"],
          });
          store.createIndex(INDEX_BY_CHARACTER, "characterKey", {
            unique: false,
          });
        }
      }

      // v2 → v3：以 cursor 遍歷 audioSegments，補齊舊 record 缺少的 scriptHash 欄位。
      // 補上空字串 sentinel（與當前 script hash 必不相符），讓 useAudioSegments
      // 將該角色自動標為「劇本變更」，提示使用者重錄取得乾淨資料。
      if (oldVersion < 3 && oldVersion >= 2) {
        const upgradeTx = req.transaction;
        if (
          upgradeTx &&
          db.objectStoreNames.contains(STORE_AUDIO_SEGMENTS)
        ) {
          const store = upgradeTx.objectStore(STORE_AUDIO_SEGMENTS);
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) return;
            const value = cursor.value as Record<string, unknown>;
            if (typeof value.scriptHash !== "string") {
              cursor.update({ ...value, scriptHash: "" });
            }
            cursor.continue();
          };
        }
      }

      // v3 → v4：新增 scripts store（多劇本管理）。不動既有 audioSegments。
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains(STORE_SCRIPTS)) {
          db.createObjectStore(STORE_SCRIPTS, { keyPath: "id" });
        }
      }
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

/**
 * 內部輔助：執行一筆 readwrite / readonly 交易並 await 其完成。
 *
 * @param storeName  目標 store 名稱
 * @param mode       'readonly' / 'readwrite'
 * @param fn         交易內要做的操作；可回傳一個 Promise（通常是 promisifyRequest 的結果）
 *                   注意 fn 必須在「同步呼叫鏈內」啟動所有 request，否則 transaction 會自動 commit。
 * @returns          fn 回傳值的 Promise
 */
async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openAudioDB();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  // 同步啟動 request（fn 內部）
  const resultPromise = fn(store);
  // 等待 transaction 完成（確保寫入持久化）；readonly 也用同樣模式
  await awaitTransaction(tx);
  return resultPromise;
}

// ---------- audioSegments（v3） ----------

/**
 * 寫入或覆蓋指定（characterKey, globalIndex）的音檔片段。
 * 使用 `put`：若複合 key 已存在則覆蓋，不存在則新增。
 */
export async function putAudioSegment(
  record: AudioSegmentRecord,
): Promise<void> {
  assertClient("putAudioSegment");
  await withStore(STORE_AUDIO_SEGMENTS, "readwrite", async (store) => {
    await promisifyRequest(store.put(record));
  });
}

/**
 * 讀取指定（characterKey, globalIndex）的音檔片段；不存在回 null。
 */
export async function getAudioSegment(
  characterKey: string,
  globalIndex: number,
): Promise<AudioSegmentRecord | null> {
  assertClient("getAudioSegment");
  return withStore(STORE_AUDIO_SEGMENTS, "readonly", async (store) => {
    const result = await promisifyRequest<unknown>(
      store.get([characterKey, globalIndex]),
    );
    return isAudioSegmentRecord(result) ? result : null;
  });
}

/**
 * 取得指定角色任一筆音檔片段（不存在回 null）。
 * 用途：scriptHash 比對只需任意一筆 segment 即可判斷劇本是否變更，
 *      避免為了 hash 比對而把整批 Blob 載入記憶體。
 */
export async function getFirstSegment(
  characterKey: string,
): Promise<AudioSegmentRecord | null> {
  assertClient("getFirstSegment");
  return withStore(STORE_AUDIO_SEGMENTS, "readonly", async (store) => {
    const index = store.index(INDEX_BY_CHARACTER);
    return new Promise<AudioSegmentRecord | null>((resolve, reject) => {
      const req = index.openCursor(IDBKeyRange.only(characterKey));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve(null);
          return;
        }
        const value = cursor.value as unknown;
        resolve(isAudioSegmentRecord(value) ? value : null);
      };
      req.onerror = () =>
        reject(
          req.error ?? new Error("IndexedDB 讀取片段失敗（未提供詳細錯誤）"),
        );
    });
  });
}

/**
 * 列出指定角色的所有音檔片段。
 * 透過 `byCharacter` index 取得，順序依 IndexedDB 內部排序（依複合 key 第一欄）。
 */
export async function getAllSegments(
  characterKey: string,
): Promise<AudioSegmentRecord[]> {
  assertClient("getAllSegments");
  return withStore(STORE_AUDIO_SEGMENTS, "readonly", async (store) => {
    const index = store.index(INDEX_BY_CHARACTER);
    const all = await promisifyRequest<unknown[]>(index.getAll(characterKey));
    return all.filter(isAudioSegmentRecord);
  });
}

/**
 * 刪除指定角色的所有音檔片段。
 * 透過 `byCharacter` index 取得該角色全部 primary key，逐一 delete。
 */
export async function deleteAllSegmentsForCharacter(
  characterKey: string,
): Promise<void> {
  assertClient("deleteAllSegmentsForCharacter");
  const db = await openAudioDB();
  const tx = db.transaction(STORE_AUDIO_SEGMENTS, "readwrite");
  const store = tx.objectStore(STORE_AUDIO_SEGMENTS);
  const index = store.index(INDEX_BY_CHARACTER);
  // 取得該角色所有複合 primary key 後同步發起多筆 delete request
  const keys = await promisifyRequest<IDBValidKey[]>(
    index.getAllKeys(characterKey),
  );
  const deleteRequests = keys.map((key) => promisifyRequest(store.delete(key)));
  await Promise.all(deleteRequests);
  await awaitTransaction(tx);
}

/**
 * 統計每個角色的音檔片段數量。
 * 用 cursor 遍歷 `byCharacter` index，避免一次把所有 record 載入記憶體。
 */
export async function countSegmentsByCharacter(): Promise<
  Record<string, number>
> {
  assertClient("countSegmentsByCharacter");
  return withStore(STORE_AUDIO_SEGMENTS, "readonly", async (store) => {
    const index = store.index(INDEX_BY_CHARACTER);
    return new Promise<Record<string, number>>((resolve, reject) => {
      const counts: Record<string, number> = {};
      const cursorReq = index.openKeyCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve(counts);
          return;
        }
        const key = cursor.key;
        if (typeof key === "string") {
          counts[key] = (counts[key] ?? 0) + 1;
        }
        cursor.continue();
      };
      cursorReq.onerror = () =>
        reject(
          cursorReq.error ??
            new Error("IndexedDB 統計片段數量失敗（未提供詳細錯誤）"),
        );
    });
  });
}

// ---------- 配額查詢 ----------

/**
 * 查詢瀏覽器分配給本 origin 的儲存配額。
 *
 * - 支援 navigator.storage.estimate 的瀏覽器：回 { usage, quota }（單位 bytes）
 * - 不支援或失敗：回 null（呼叫端應以「未知」處理，不阻擋功能）
 *
 * 注意 usage / quota 數值是 origin 級別（涵蓋 IndexedDB、Cache API、localStorage 等），
 * 並非「僅本資料庫」。SPEC 中以此作粗略上限指示足夠。
 */
export async function estimateQuota(): Promise<{
  usage: number;
  quota: number;
} | null> {
  if (typeof window === "undefined") return null;
  const storage = window.navigator.storage;
  if (!storage || typeof storage.estimate !== "function") return null;
  try {
    const result = await storage.estimate();
    const usage = typeof result.usage === "number" ? result.usage : 0;
    const quota = typeof result.quota === "number" ? result.quota : 0;
    return { usage, quota };
  } catch {
    return null;
  }
}

// ---------- 結構驗證（讀取時收窄） ----------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAudioSegmentRecord(value: unknown): value is AudioSegmentRecord {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.characterKey === "string" &&
    Number.isInteger(value.globalIndex) &&
    (value.globalIndex as number) >= 0 &&
    typeof value.mimeType === "string" &&
    typeof value.durationMs === "number" &&
    typeof value.sizeBytes === "number" &&
    typeof value.recordedAt === "number" &&
    typeof value.scriptHash === "string" &&
    value.blob instanceof Blob
  );
}

