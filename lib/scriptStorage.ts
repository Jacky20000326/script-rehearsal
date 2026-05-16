/**
 * 多劇本資料層（v4 / M17+）
 *
 * 將「劇本記錄」（ScriptRecord）存於同一個 `script-rehearsal-audio` DB 的
 * `scripts` store；DB 連線與升級邏輯沿用 audioStorage.openAudioDB()，
 * 避免在 module 層另外開一條 IndexedDB 連線。
 *
 * Active scriptId 為輕量的「當前選用」指標，使用 localStorage 同步存取：
 *   key = 'script-rehearsal:active-script-id'
 *
 * SSR 守衛：與 audioStorage 同樣，所有公開函式進入時先檢查 `typeof window`。
 */

import { openAudioDB, STORE_SCRIPTS } from "./audioStorage";
import type { Script, ScriptId, ScriptRecord } from "./types";

// ---------- 常數 ----------

export const ACTIVE_SCRIPT_ID_KEY = "script-rehearsal:active-script-id";
export const ACTIVE_SCRIPT_CHANGED_EVENT = "script-rehearsal:active-script-changed";

// ---------- 內部工具 ----------

function assertClient(fnName: string): void {
  if (typeof window === "undefined") {
    throw new Error(`scriptStorage.${fnName}() 僅可於瀏覽器端呼叫`);
  }
  if (typeof window.indexedDB === "undefined") {
    throw new Error("此瀏覽器不支援 IndexedDB，無法使用劇本儲存功能");
  }
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("IndexedDB 操作失敗（未提供詳細錯誤）"),
      );
  });
}

function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB 交易失敗（未提供詳細錯誤）"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB 交易被中止"));
  });
}

// ---------- 結構驗證 ----------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScript(value: unknown): value is Script {
  if (!isPlainObject(value)) return false;
  const characters = value.characters;
  const pages = value.pages;
  return (
    isPlainObject(characters) &&
    Array.isArray(pages)
  );
}

const VALID_SOURCES: ReadonlySet<ScriptRecord["source"]> = new Set([
  "default",
  "plain-text",
  "pdf",
  "image-ocr",
]);

function isScriptRecord(value: unknown): value is ScriptRecord {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number" &&
    typeof value.source === "string" &&
    VALID_SOURCES.has(value.source as ScriptRecord["source"]) &&
    isScript(value.script)
  );
}

// ---------- ScriptRecord CRUD ----------

/**
 * 列出所有劇本記錄，依 updatedAt desc 排序。
 */
export async function listScripts(): Promise<ScriptRecord[]> {
  assertClient("listScripts");
  const db = await openAudioDB();
  const tx = db.transaction(STORE_SCRIPTS, "readonly");
  const store = tx.objectStore(STORE_SCRIPTS);
  const all = await promisifyRequest<unknown[]>(store.getAll());
  await awaitTransaction(tx);
  return all
    .filter(isScriptRecord)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * 讀取指定 id 的劇本記錄；不存在或結構不符回 null。
 */
export async function getScript(id: ScriptId): Promise<ScriptRecord | null> {
  assertClient("getScript");
  const db = await openAudioDB();
  const tx = db.transaction(STORE_SCRIPTS, "readonly");
  const store = tx.objectStore(STORE_SCRIPTS);
  const result = await promisifyRequest<unknown>(store.get(id));
  await awaitTransaction(tx);
  return isScriptRecord(result) ? result : null;
}

/**
 * 寫入或覆蓋劇本記錄（put：id 已存在則覆蓋）。
 */
export async function putScript(record: ScriptRecord): Promise<void> {
  assertClient("putScript");
  const db = await openAudioDB();
  const tx = db.transaction(STORE_SCRIPTS, "readwrite");
  const store = tx.objectStore(STORE_SCRIPTS);
  await promisifyRequest(store.put(record));
  await awaitTransaction(tx);
}

/**
 * 刪除指定 id 的劇本記錄。
 */
export async function deleteScript(id: ScriptId): Promise<void> {
  assertClient("deleteScript");
  const db = await openAudioDB();
  const tx = db.transaction(STORE_SCRIPTS, "readwrite");
  const store = tx.objectStore(STORE_SCRIPTS);
  await promisifyRequest(store.delete(id));
  await awaitTransaction(tx);
}

/**
 * 重命名指定 id 的劇本記錄；id 不存在則拋錯。
 * 同步更新 updatedAt。
 */
export async function renameScript(
  id: ScriptId,
  name: string,
): Promise<void> {
  assertClient("renameScript");
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error("劇本名稱不可為空");
  }
  const existing = await getScript(id);
  if (!existing) {
    throw new Error(`找不到劇本記錄：${id}`);
  }
  const updated: ScriptRecord = {
    ...existing,
    name: trimmed,
    updatedAt: Date.now(),
  };
  await putScript(updated);
}

// ---------- Active scriptId（localStorage 同步） ----------

/**
 * 讀取目前選用的 scriptId；SSR 或未設定時回 null。
 */
export function getActiveScriptId(): ScriptId | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ACTIVE_SCRIPT_ID_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * 設定目前選用的 scriptId；SSR 環境靜默 no-op。
 *
 * 寫入後會 dispatch CustomEvent，讓同分頁內的訂閱者（useScript / ScriptSwitcher）
 * 重新讀取。跨分頁同步則靠瀏覽器原生的 storage event。
 */
export function setActiveScriptId(id: ScriptId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_SCRIPT_ID_KEY, id);
  } catch {
    // 配額爆掉 / privacy mode → 靜默；上層不該因此爆掉
  }
  try {
    window.dispatchEvent(
      new CustomEvent<ScriptId>(ACTIVE_SCRIPT_CHANGED_EVENT, { detail: id }),
    );
  } catch {
    // 老瀏覽器或 jsdom 無 CustomEvent 構造器 → 忽略，同分頁更新失敗不影響資料正確性
  }
}

// ---------- 訂閱 active scriptId 變更 ----------

export type ActiveScriptChangeListener = (id: ScriptId | null) => void;

/**
 * 訂閱 active scriptId 變更。
 *
 * 監聽兩個來源：
 *   1. 同分頁：CustomEvent 'script-rehearsal:active-script-changed'（setActiveScriptId 內部發送）
 *   2. 跨分頁：原生 storage event（key 為 ACTIVE_SCRIPT_ID_KEY）
 *
 * 回傳 unsubscribe 函式。SSR 環境回傳 no-op。
 */
export function subscribeActiveScriptId(
  cb: ActiveScriptChangeListener,
): () => void {
  if (typeof window === "undefined") return () => {};

  const onCustom = (e: Event): void => {
    const detail = (e as CustomEvent<ScriptId | null | undefined>).detail;
    cb(typeof detail === "string" && detail.length > 0 ? detail : null);
  };

  const onStorage = (e: StorageEvent): void => {
    if (e.key !== ACTIVE_SCRIPT_ID_KEY) return;
    const value = e.newValue;
    cb(value && value.length > 0 ? value : null);
  };

  window.addEventListener(ACTIVE_SCRIPT_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ACTIVE_SCRIPT_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
