import type { RawApiPayload } from '../types/dashboard';

/**
 * 마지막으로 받은 API 응답을 브라우저에 저장해 다음 방문 때 먼저 그린다.
 * 응답이 5MB를 넘어 localStorage 한도를 넘기므로 IndexedDB 에 둔다.
 */
const DB_NAME = 'adi';
const STORE = 'cache';
const KEY = 'payload';
// 예전 localStorage 캐시 — 한 번 옮기고 지운다
const LEGACY_KEY = 'adi_data_cache';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readLegacy(): RawApiPayload | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    localStorage.removeItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as RawApiPayload) : null;
  } catch {
    return null;
  }
}

export async function readCachedPayload(): Promise<RawApiPayload | null> {
  try {
    const db = await openDb();
    const saved = await new Promise<RawApiPayload | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as RawApiPayload | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    const legacy = readLegacy();
    return saved || legacy;
  } catch {
    return readLegacy();
  }
}

export async function writeCachedPayload(payload: RawApiPayload): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(payload, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // 저장 공간이 없거나 사생활 보호 모드 — 다음 방문 때 실데이터를 다시 받으면 된다
  }
}
