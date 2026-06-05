import { useState, useEffect, useCallback } from 'react';
import {
  ItemFeedback,
  saveFeedback,
  getAllFeedback,
  getFeedbackForItem,
  clearAllFeedback,
} from '../lib/feedbackDB';
import { buildStyleProfile, StyleProfile } from '../lib/styleMemory';

export function useFeedback() {
  const [allFeedback, setAllFeedback] = useState<ItemFeedback[]>([]);
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  // Map itemId → latest feedback for fast lookup
  const [feedbackByItemId, setFeedbackByItemId] = useState<Record<string, ItemFeedback>>({});

  const load = useCallback(async () => {
    const feedbacks = await getAllFeedback();
    setAllFeedback(feedbacks);
    setStyleProfile(buildStyleProfile(feedbacks));
    const map: Record<string, ItemFeedback> = {};
    for (const f of feedbacks) {
      // keep most recent per item
      if (!map[f.itemId] || f.createdAt > map[f.itemId].createdAt) {
        map[f.itemId] = f;
      }
    }
    setFeedbackByItemId(map);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitFeedback = useCallback(
    async (feedback: ItemFeedback) => {
      await saveFeedback(feedback);
      await load();
    },
    [load],
  );

  const getFeedbackFor = useCallback(
    (itemId: string): ItemFeedback | undefined => feedbackByItemId[itemId],
    [feedbackByItemId],
  );

  const resetAll = useCallback(async () => {
    await clearAllFeedback();
    await load();
  }, [load]);

  return {
    allFeedback,
    styleProfile,
    feedbackByItemId,
    submitFeedback,
    getFeedbackFor,
    resetAll,
    reload: load,
  };
}
