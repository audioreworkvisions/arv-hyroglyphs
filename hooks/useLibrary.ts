import { useState, useEffect, useCallback } from 'react';
import { getAllItems, saveItem, deleteItem, clearAllItems, LibraryItem } from '../lib/libraryDB';

export function useLibrary() {
  const [items, setItems] = useState<LibraryItem[]>([]);

  const load = useCallback(async () => {
    const all = await getAllItems();
    setItems(all);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (item: LibraryItem) => {
      await saveItem(item);
      setItems((prev) => {
        const next = [item, ...prev.filter((existing) => existing.id !== item.id)];
        next.sort((left, right) => right.createdAt - left.createdAt);
        return next;
      });
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    await deleteItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    await clearAllItems();
    setItems([]);
  }, []);

  return { items, save, remove, clearAll, reload: load };
}
