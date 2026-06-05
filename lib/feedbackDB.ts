// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface ItemFeedback {
  id: string;           // unique feedback id
  itemId: string;       // LibraryItem.id
  itemType: 'gif' | 'story' | 'ideas';
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  likeTags: string[];   // what worked visually
  dislikeTags: string[];
  wantMore: string[];   // "more of this quality"
  wantLess: string[];
  originalPrompt: string;
  originalTitle?: string;
  createdAt: number;
}

// ─── DB SETUP ────────────────────────────────────────────────────────────────

const DB_NAME = 'hyroglyphs-feedback';
const DB_VERSION = 1;
const STORE = 'feedback';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('itemId', 'itemId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function saveFeedback(feedback: ItemFeedback): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(feedback);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllFeedback(): Promise<ItemFeedback[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve((req.result as ItemFeedback[]).sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

export async function getFeedbackForItem(itemId: string): Promise<ItemFeedback[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const idx = tx.objectStore(STORE).index('itemId');
    const req = idx.getAll(itemId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFeedbackForItem(itemId: string): Promise<void> {
  const feedbacks = await getFeedbackForItem(itemId);
  if (feedbacks.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    feedbacks.forEach((f) => store.delete(f.id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllFeedback(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
