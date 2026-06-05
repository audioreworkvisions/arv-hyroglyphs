import { useState, useCallback } from 'react';

export type AzureUsageType = 'text' | 'storyboard' | 'image' | 'video';

export interface AzureUsageEntry {
  id: string;
  timestamp: number;
  type: AzureUsageType;
  model: string;
  // Text / Storyboard
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  // Image
  imageSize?: string;
  // Video
  videoSeconds?: number;
  videoSize?: string;
}

export interface AzureUsageTotals {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  imageCount: number;
  videoSeconds: number;
  videoCount: number;
}

export function useAzureUsage() {
  const [entries, setEntries] = useState<AzureUsageEntry[]>([]);

  const addEntry = useCallback((entry: Omit<AzureUsageEntry, 'id' | 'timestamp'>) => {
    setEntries(prev => [
      {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
      },
      ...prev,
    ]);
  }, []);

  const clearEntries = useCallback(() => setEntries([]), []);

  const totals: AzureUsageTotals = entries.reduce(
    (acc, e) => {
      acc.totalTokens += e.totalTokens ?? 0;
      acc.promptTokens += e.promptTokens ?? 0;
      acc.completionTokens += e.completionTokens ?? 0;
      if (e.type === 'image') acc.imageCount += 1;
      if (e.type === 'video') {
        acc.videoSeconds += e.videoSeconds ?? 0;
        acc.videoCount += 1;
      }
      return acc;
    },
    { totalTokens: 0, promptTokens: 0, completionTokens: 0, imageCount: 0, videoSeconds: 0, videoCount: 0 }
  );

  return { entries, addEntry, clearEntries, totals };
}
