/**
 * 音檔片段業務 API（v5 / M27 後）
 *
 * 本檔只負責 `audioSegments` store 的 CRUD 與配額查詢業務邏輯。
 * - schema 常數 / 升級 / 連線：見 `lib/idb/connection.ts` 與 `lib/idb/migration.ts`
 * - Promise / SSR 工具：見 `lib/idb/promise.ts`
 *
 * v5 schema：`audioSegments` 的 keyPath 為 `[scriptId, characterKey, globalIndex]`，
 * `byCharacter` index（單欄 `characterKey`）；多劇本同名角色由結果端以 scriptId 過濾。
 *
 * 6 個業務 API 簽名與行為對 v4 結束時的版本維持 100% 一致；M27 僅做檔案層級拆分。
 */

import {
  INDEX_BY_CHARACTER,
  STORE_AUDIO_SEGMENTS,
  openAudioDB,
} from "./idb/connection";
import {
  assertClient,
  awaitTransaction,
  promisifyRequest,
} from "./idb/promise";
import type { AudioSegmentRecord } from "./types";

// ---------- 內部 helper ----------

/**
 * 包裝一筆 readwrite / readonly 交易並 await 其完成。
 *
 * fn 必須在「同步呼叫鏈內」啟動所有 request，否則 transaction 會自動 commit。
 */
async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openAudioDB();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const resultPromise = fn(store);
  await awaitTransaction(tx);
  return resultPromise;
}

// ---------- audioSegments（v5） ----------

/**
 * 寫入或覆蓋指定（scriptId, characterKey, globalIndex）的音檔片段。
 * 使用 `put`：若三段複合 key 已存在則覆蓋，不存在則新增。
 */
export async function putAudioSegment(
  record: AudioSegmentRecord,
): Promise<void> {
  assertClient("audioStorage.putAudioSegment");
  await withStore(STORE_AUDIO_SEGMENTS, "readwrite", async (store) => {
    await promisifyRequest(store.put(record));
  });
}

/**
 * 讀取指定（scriptId, characterKey, globalIndex）的音檔片段；不存在回 null。
 */
export async function getAudioSegment(
  scriptId: string,
  characterKey: string,
  globalIndex: number,
): Promise<AudioSegmentRecord | null> {
  assertClient("audioStorage.getAudioSegment");
  return withStore(STORE_AUDIO_SEGMENTS, "readonly", async (store) => {
    const result = await promisifyRequest<unknown>(
      store.get([scriptId, characterKey, globalIndex]),
    );
    return isAudioSegmentRecord(result) ? result : null;
  });
}

/**
 * 取得指定（scriptId, characterKey）任一筆音檔片段（不存在回 null）。
 *
 * 用途：scriptHash 比對只需任意一筆 segment 即可判斷劇本是否變更，
 *      避免為了 hash 比對而把整批 Blob 載入記憶體。
 */
export async function getFirstSegment(
  scriptId: string,
  characterKey: string,
): Promise<AudioSegmentRecord | null> {
  assertClient("audioStorage.getFirstSegment");
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
        if (isAudioSegmentRecord(value) && value.scriptId === scriptId) {
          resolve(value);
          return;
        }
        cursor.continue();
      };
      req.onerror = () =>
        reject(
          req.error ?? new Error("IndexedDB 讀取片段失敗（未提供詳細錯誤）"),
        );
    });
  });
}

/**
 * 列出指定（scriptId, characterKey）的所有音檔片段。
 * `byCharacter` index 不含 scriptId，需在 getAll 結果上以 scriptId 過濾。
 */
export async function getAllSegments(
  scriptId: string,
  characterKey: string,
): Promise<AudioSegmentRecord[]> {
  assertClient("audioStorage.getAllSegments");
  return withStore(STORE_AUDIO_SEGMENTS, "readonly", async (store) => {
    const index = store.index(INDEX_BY_CHARACTER);
    const all = await promisifyRequest<unknown[]>(index.getAll(characterKey));
    return all
      .filter(isAudioSegmentRecord)
      .filter((r) => r.scriptId === scriptId);
  });
}

/**
 * 刪除指定（scriptId, characterKey）的所有音檔片段。
 *
 * 透過 `byCharacter` index 取得該角色全部 record，過濾 scriptId 後逐一 delete。
 */
export async function deleteAllSegmentsForCharacter(
  scriptId: string,
  characterKey: string,
): Promise<void> {
  assertClient("audioStorage.deleteAllSegmentsForCharacter");
  const db = await openAudioDB();
  const tx = db.transaction(STORE_AUDIO_SEGMENTS, "readwrite");
  const store = tx.objectStore(STORE_AUDIO_SEGMENTS);
  const index = store.index(INDEX_BY_CHARACTER);
  const records = await promisifyRequest<unknown[]>(
    index.getAll(characterKey),
  );
  const deleteRequests: Array<Promise<unknown>> = [];
  for (const value of records) {
    if (!isAudioSegmentRecord(value)) continue;
    if (value.scriptId !== scriptId) continue;
    deleteRequests.push(
      promisifyRequest(
        store.delete([value.scriptId, value.characterKey, value.globalIndex]),
      ),
    );
  }
  await Promise.all(deleteRequests);
  await awaitTransaction(tx);
}

/**
 * 統計指定 scriptId 下，每個角色的音檔片段數量。
 * 用 cursor 遍歷 `byCharacter` index value，避免一次把所有 record 載入記憶體。
 */
export async function countSegmentsByCharacter(
  scriptId: string,
): Promise<Record<string, number>> {
  assertClient("audioStorage.countSegmentsByCharacter");
  return withStore(STORE_AUDIO_SEGMENTS, "readonly", async (store) => {
    const index = store.index(INDEX_BY_CHARACTER);
    return new Promise<Record<string, number>>((resolve, reject) => {
      const counts: Record<string, number> = {};
      const cursorReq = index.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve(counts);
          return;
        }
        const value = cursor.value as unknown;
        if (isAudioSegmentRecord(value) && value.scriptId === scriptId) {
          counts[value.characterKey] = (counts[value.characterKey] ?? 0) + 1;
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
 * 不支援或失敗回 null（呼叫端應以「未知」處理，不阻擋功能）。
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
    typeof value.scriptId === "string" &&
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
