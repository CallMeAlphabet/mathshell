// ── IndexedDB Persistence Layer ───────────────────────────────────────────────

const IDB_NAME  = "mash_vfs";
const IDB_STORE = "nodes";
const IDB_VER   = 1;

export function idbOpen() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE, { keyPath: "path" });
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

export async function idbPut(db, path, node) {
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({ path, ...node });
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
  });
}

export async function idbDelete(db, path) {
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(path);
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
  });
}

export async function idbDeletePrefix(db, prefix) {
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.openCursor();
    req.onsuccess = e => {
      const cursor = e.target.result;
      if (!cursor) return;
      const k = cursor.key;
      if (k === prefix || k.startsWith(prefix + "/")) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
  });
}

export async function idbLoadAll(db) {
  return new Promise((res, rej) => {
    const tx  = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
