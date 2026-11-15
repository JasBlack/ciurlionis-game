// What the app remembers between visits, all of it in this browser only:
// settings and per-mask fit in localStorage, imported .glb files in IndexedDB.

// The key carries a version: change it when the shape of what is stored changes, and old settings are left behind.
const PREFIX = 'mask-v1.';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* private window: carry on without */ }
}

function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('mask-layer', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('masks', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('masks', mode);
    const req = fn(t.objectStore('masks'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

/** @returns {Promise<{ id: string, name: string, buffer: ArrayBuffer }[]>} */
export async function savedMasks() {
  try { return (await tx('readonly', (s) => s.getAll())) ?? []; } catch { return []; }
}

export async function keepMask(entry) {
  try { await tx('readwrite', (s) => s.put(entry)); } catch { /* not remembered, still usable now */ }
}

export async function forgetMask(id) {
  try { await tx('readwrite', (s) => s.delete(id)); } catch { /* nothing to do */ }
}
