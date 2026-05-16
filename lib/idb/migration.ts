/**
 * IndexedDB schema 升級（v5 / M27）
 *
 * 將 `onupgradeneeded` 的 stepwise 升級邏輯獨立為純函式，方便閱讀與測試。
 *
 * **嚴格約束**：
 *   1. 所有 migration 動作必須在傳入的 `event.target.transaction`（versionchange tx）
 *      內完成 — 不開新 transaction、**不 await 任何外部 Promise**。
 *   2. IDB transaction 採 auto-commit：一旦 microtask queue 清空且無 pending request，
 *      tx 即 commit。如需在 cursor 完成後再做動作，使用 `void promise.then(...)`
 *      串接（cursor request 仍 keep-alive tx）。
 *   3. v4 → v5 的 cursor 收集 → recreate 流程亦遵守此 pattern。
 *
 * 跨版本升級（v0/v2/v3/v4 → v5）由 `applyMigration` 內的 stepwise `if` 分支自動串接，
 * 同一個 `onupgradeneeded` 內完成。
 */

// 常數同源於 connection.ts（schema 與連線單一定義）；
// connection.ts 不反向 import migration 的常數，因此無循環依賴。
import {
  INDEX_BY_CHARACTER,
  STORE_AUDIO_SEGMENTS,
  STORE_SCRIPTS,
} from "./connection";

/** v5 之前缺乏 scriptId 的舊 record，migration 時補上的 fallback id */
const LEGACY_SCRIPT_ID = "default";

/**
 * v5 migration helper：以 cursor 同步遍歷舊 `audioSegments`，把所有 record
 * 暫存到陣列中。**必須在 versionchange transaction 內呼叫**，且回傳的 Promise
 * 不可被 await 後再開新交易（會跨 transaction 邊界）。
 */
function collectLegacySegments(
  store: IDBObjectStore,
): Promise<Array<Record<string, unknown>>> {
  return new Promise((resolve, reject) => {
    const out: Array<Record<string, unknown>> = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      const value = cursor.value as unknown;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        out.push(value as Record<string, unknown>);
      }
      cursor.continue();
    };
    req.onerror = () =>
      reject(
        req.error ?? new Error("IndexedDB 遷移：讀取舊 audioSegments 失敗"),
      );
  });
}

/**
 * v1 → v2：拋棄舊三 store（audioFiles / transcriptions / alignments），
 * 建立初版 audioSegments（keyPath: [characterKey, globalIndex]）。
 */
function migrateV0ToV2(db: IDBDatabase): void {
  if (db.objectStoreNames.contains("audioFiles")) {
    db.deleteObjectStore("audioFiles");
  }
  if (db.objectStoreNames.contains("transcriptions")) {
    db.deleteObjectStore("transcriptions");
  }
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

/**
 * v2 → v3：以 cursor 遍歷 audioSegments，補齊舊 record 缺少的 scriptHash 欄位。
 * 補上空字串 sentinel（與當前 script hash 必不相符），讓 useAudioSegments
 * 將該角色自動標為「劇本變更」，提示使用者重錄取得乾淨資料。
 */
function migrateV2ToV3(db: IDBDatabase, upgradeTx: IDBTransaction | null): void {
  if (!upgradeTx) return;
  if (!db.objectStoreNames.contains(STORE_AUDIO_SEGMENTS)) return;
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

/**
 * v3 → v4：新增 scripts store（多劇本管理）。不動既有 audioSegments。
 */
function migrateV3ToV4(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_SCRIPTS)) {
    db.createObjectStore(STORE_SCRIPTS, { keyPath: "id" });
  }
}

/**
 * v4 → v5：擴充 audioSegments keyPath 為 [scriptId, characterKey, globalIndex]。
 *
 * IDB 不支援 alter keyPath → 必須 delete + recreate；migration 全程
 * 都在 versionchange transaction 內完成（不可 await 外部 promise，
 * 否則 transaction 會自動 commit / abort）。
 *
 * 流程：
 *   1. 若舊 store 不存在 → 直接建立新 schema（edge case，理論上 v0→v5 已由 v0→v2 分支建立）
 *   2. 若無 versionchange tx → 保守 delete + recreate（理論上不可能）
 *   3. 正常路徑：cursor 收集舊 records（不 await）→ 在 then 內 delete + recreate + 補 scriptId 寫回
 */
function migrateV4ToV5(db: IDBDatabase, upgradeTx: IDBTransaction | null): void {
  const recreate = (): void => {
    db.createObjectStore(STORE_AUDIO_SEGMENTS, {
      keyPath: ["scriptId", "characterKey", "globalIndex"],
    }).createIndex(INDEX_BY_CHARACTER, "characterKey", {
      unique: false,
    });
  };

  if (!db.objectStoreNames.contains(STORE_AUDIO_SEGMENTS)) {
    recreate();
    return;
  }
  if (!upgradeTx) {
    db.deleteObjectStore(STORE_AUDIO_SEGMENTS);
    recreate();
    return;
  }

  const oldStore = upgradeTx.objectStore(STORE_AUDIO_SEGMENTS);
  void collectLegacySegments(oldStore).then((records) => {
    db.deleteObjectStore(STORE_AUDIO_SEGMENTS);
    const newStore = db.createObjectStore(STORE_AUDIO_SEGMENTS, {
      keyPath: ["scriptId", "characterKey", "globalIndex"],
    });
    newStore.createIndex(INDEX_BY_CHARACTER, "characterKey", {
      unique: false,
    });
    for (const value of records) {
      const next: Record<string, unknown> = { ...value };
      if (typeof next.scriptId !== "string" || next.scriptId === "") {
        next.scriptId = LEGACY_SCRIPT_ID;
      }
      if (typeof next.scriptHash !== "string") {
        next.scriptHash = "";
      }
      newStore.put(next);
    }
  });
}

/**
 * v6 safety net：兜底確保 audioSegments / scripts 兩個 store 必定存在。
 * 修復 v4→v5 在 oldVersion=0 路徑因 `.then` microtask 與 versionchange tx
 * auto-commit 競態而漏建 store 的場景；對既有完整 DB 為 no-op。
 */
function ensureRequiredStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_AUDIO_SEGMENTS)) {
    const store = db.createObjectStore(STORE_AUDIO_SEGMENTS, {
      keyPath: ["scriptId", "characterKey", "globalIndex"],
    });
    store.createIndex(INDEX_BY_CHARACTER, "characterKey", { unique: false });
  }
  if (!db.objectStoreNames.contains(STORE_SCRIPTS)) {
    db.createObjectStore(STORE_SCRIPTS, { keyPath: "id" });
  }
}

/**
 * 套用 schema 升級。由 `openAudioDB()` 在 `onupgradeneeded` 內同步呼叫。
 *
 * @param db          目標資料庫（req.result）
 * @param event       IDBVersionChangeEvent，內含 oldVersion
 *
 * 內部以 stepwise `if (oldVersion < N)` 串接 v0/v2/v3/v4/v5 → v6 升級路徑。
 * 例如 oldVersion = 0（首次安裝）會依序執行：v0→v2 建初版 store、v3→v4 建 scripts store、v4→v5 升級 keyPath、v5→v6 safety net 兜底。
 */
export function applyMigration(
  db: IDBDatabase,
  event: IDBVersionChangeEvent,
): void {
  const oldVersion = event.oldVersion;
  // event.target 在 onupgradeneeded 內為 IDBOpenDBRequest，transaction 為 versionchange tx
  const target = event.target as IDBOpenDBRequest | null;
  const upgradeTx = target ? target.transaction : null;

  if (oldVersion < 2) {
    migrateV0ToV2(db);
  }
  if (oldVersion < 3 && oldVersion >= 2) {
    migrateV2ToV3(db, upgradeTx);
  }
  if (oldVersion < 4) {
    migrateV3ToV4(db);
  }
  if (oldVersion < 5) {
    migrateV4ToV5(db, upgradeTx);
  }
  if (oldVersion < 6) {
    ensureRequiredStores(db);
  }
}
