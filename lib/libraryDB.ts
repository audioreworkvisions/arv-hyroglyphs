export interface LibraryGifItem {
  id: string;
  type: 'gif';
  createdAt: number;
  prompt: string;
  model: string;
  gifData: string;
  presetId?: string;
}

export interface LibraryStoryItem {
  id: string;
  type: 'story';
  createdAt: number;
  prompt: string;
  model: string;
  title: string;
  scenes: Array<{
    scenePrompt: string;
    finalPrompt: string;
    gifData?: string;
    videoId?: string | null;
    remixedFromVideoId?: string | null;
    videoTransformMode?: 'remix' | 'extend' | null;
  }>;
}

export interface LibraryIdeaItem {
  id: string;
  type: 'ideas';
  createdAt: number;
  prompt: string;
  title: string;
  mode: 'ritual' | 'satire' | 'signal';
  seed?: string;
  referenceSummary?: string;
  clipboardText: string;
  themes: string[];
  characters: string[];
  events: string[];
  actions: string[];
  stories: string[];
  styles: string[];
  promptSeeds: string[];
  presetSeeds: string[];
  visions: Array<{
    title: string;
    theme: string;
    character: string;
    event: string;
    action: string;
    story: string;
    style: string;
    promptSeed: string;
    presetSeed: string;
  }>;
}

export type LibraryItem = LibraryGifItem | LibraryStoryItem | LibraryIdeaItem;

const DB_NAME = 'hyroglyphs-library';
const DB_VERSION = 1;
const STORE_NAME = 'items';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveItem(item: LibraryItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllItems(): Promise<LibraryItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () =>
      resolve((request.result as LibraryItem[]).sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
}

export async function deleteItem(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllItems(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
