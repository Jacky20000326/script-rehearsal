/**
 * IndexedDB Promise 化工具 + SSR 守衛（v5 / M27）
 *
 * 純工具層：不依賴專案任何業務型別，僅將 IDBRequest / IDBTransaction
 * 包成 Promise，並提供共用的瀏覽器端守衛。
 *
 * 不可在此引入任何 store / schema 常數，避免循環依賴。
 */

/**
 * SSR 守衛：在 server 端呼叫一律拋錯，避免吞掉開發者錯誤。
 *
 * @param api 呼叫者識別字串（用於錯誤訊息），例 "audioStorage.openAudioDB"
 */
export function assertClient(api: string): void {
  if (typeof window === "undefined") {
    throw new Error(`${api}() 僅可於瀏覽器端呼叫`);
  }
  if (typeof window.indexedDB === "undefined") {
    throw new Error("此瀏覽器不支援 IndexedDB，無法使用此功能");
  }
}

/**
 * 將 IDBRequest 包成 Promise。
 * 結果是否符合預期型別由呼叫端透過 type guard 自行 narrow。
 */
export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
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
export function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB 交易失敗（未提供詳細錯誤）"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB 交易被中止"));
  });
}
