import React, { useCallback, useState } from 'react';
import StoryMode from './StoryMode';
import StoryIdeasGeneratorPanel from './StoryIdeasGeneratorPanel';
import type { ARVStorySequence } from '../lib/arvTypes';
import type { LibraryItem } from '../lib/libraryDB';
import type { AzureUsageEntry } from '../hooks/useAzureUsage';

interface StoryGifComposerPageProps {
  model: 'openai' | 'foundry';
  setModel: (model: 'openai' | 'foundry') => void;
  saveToLibrary: (item: LibraryItem) => Promise<void>;
  onStorySaved: () => void;
  preloadedStoryboard?: ARVStorySequence | null;
  onAzureUsage?: (entry: Omit<AzureUsageEntry, 'id' | 'timestamp'>) => void;
}

export default function StoryGifComposerPage({
  model,
  setModel,
  saveToLibrary,
  onStorySaved,
  preloadedStoryboard,
  onAzureUsage,
}: StoryGifComposerPageProps) {
  const [externalPromptValue, setExternalPromptValue] = useState<string | undefined>(undefined);

  const handleUsePrompt = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    setExternalPromptValue(trimmed);
  }, []);

  const handleExternalPromptApplied = useCallback(() => {
    setExternalPromptValue(undefined);
  }, []);

  return (
    <div className="min-h-full text-[#f3f8ff]">
      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-8">
        <StoryIdeasGeneratorPanel onUsePrompt={handleUsePrompt} />

        <div className="rounded-[16px] border border-[rgba(114,228,255,0.16)] bg-[rgba(8,20,34,0.72)] px-4 py-3 font-mono text-[11px] leading-relaxed text-[#8ea6c3]">
          Hinweis: Vision Cards sowie Story- und Prompt-Seeds aus dem Ideen-Generator koennen den Story-Prompt direkt vorbefuellen.
        </div>

        <section className="rounded-[24px] border border-[rgba(232,169,74,0.16)] bg-[rgba(8,10,18,0.86)] p-5 backdrop-blur-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8a6a30]">Scene composing</div>
              <h1 className="mt-1 font-mono text-xl font-semibold text-[#f3f8ff]">Story Scenes GIF Composer</h1>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#8ea6c3]">
                Verarbeite freie Ideen oder ARV-Seeds zu editierbaren Szenen, generiere einzelne GIFs oder exportiere komplette Fiction-Runs als ZIP - fertiges Dia-Show-Material fuer Musikvideos und Techno-Livestreams auf @audioreworkvisions.
              </p>
            </div>
            {preloadedStoryboard && (
              <span className="rounded-full border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.68)] px-3 py-1.5 font-mono text-[10px] font-semibold text-[#72e4ff]">
                ARV Seed aktiv · {preloadedStoryboard.scenes.length} Szenen
              </span>
            )}
          </div>

          <div className="rounded-[20px] border border-[rgba(114,228,255,0.08)] bg-stone-50 p-4 text-stone-900 dark:bg-zinc-950 dark:text-stone-100">
            <StoryMode
              embedded
              model={model}
              setModel={setModel}
              onStorySaved={onStorySaved}
              saveToLibrary={saveToLibrary}
              preloadedStoryboard={preloadedStoryboard}
              onAzureUsage={onAzureUsage}
              externalPromptValue={externalPromptValue}
              onExternalPromptApplied={handleExternalPromptApplied}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
