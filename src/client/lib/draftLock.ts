// Each callback performs one synchronous device-storage mutation. Older browsers
// can serialize it in an IndexedDB read/write transaction without storing any writing there.
export function withDraftLock<T>(name: string, update: () => T): Promise<T> {
  if (navigator.locks) return navigator.locks.request(name, update);
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('lucilio-draft-locks', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('locks');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction('locks', 'readwrite');
      let result: T;
      transaction.objectStore('locks').get(name).onsuccess = () => {
        try { result = update(); }
        catch (error) { transaction.abort(); reject(error); }
      };
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  });
}
