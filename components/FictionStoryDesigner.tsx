import React, { useCallback, useRef } from 'react';
import { ArrowDownRight, Cpu, Film, Sparkles } from 'lucide-react';
import StoryMode from './StoryMode';
import ARVEngine from './ARVEngine';
import { ARVStorySequence } from '../lib/arvTypes';
import { AzureUsageEntry } from '../hooks/useAzureUsage';
import { LibraryItem } from '../lib/libraryDB';
import { StyleProfile } from '../lib/styleMemory';
import { StyleFlexMode } from '../lib/styleTaste';

type SupportedModel = 'openai' | 'foundry';

interface FictionStoryDesignerProps {
  model: SupportedModel;
  setModel: (model: SupportedModel) => void;
  saveToLibrary: (item: LibraryItem) => Promise<void>;
  onStorySaved: () => void;
  preloadedStoryboard?: ARVStorySequence | null;
  onAzureUsage?: (entry: Omit<AzureUsageEntry, 'id' | 'timestamp'>) => void;
  onUseStillframeSeed: (prompt: string) => void;
  onStoryboardCreated: (board: ARVStorySequence) => void;
  styleProfile?: StyleProfile | null;
  styleMode: StyleFlexMode;
}

export default function FictionStoryDesigner({
  model,
  setModel,
  saveToLibrary,
  onStorySaved,
  preloadedStoryboard,
  onAzureUsage,
  onUseStillframeSeed,
  onStoryboardCreated,
  styleProfile,
  styleMode,
}: FictionStoryDesignerProps) {
  const storySectionRef = useRef<HTMLDivElement | null>(null);

  const handleStoryboardCreated = useCallback((board: ARVStorySequence) => {
    onStoryboardCreated(board);

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        storySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [onStoryboardCreated]);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-zinc-800 bg-gradient-to-br from-stone-100 via-white to-indigo-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950/40 px-6 py-7 md:px-8 md:py-8 shadow-sm">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_38%),radial-gradient(circle_at_bottom_left,_rgba(34,211,238,0.16),_transparent_32%)] dark:bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.2),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(34,211,238,0.16),_transparent_32%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] xl:items-end">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400 font-semibold">
              <span className="rounded-full border border-stone-300/80 dark:border-zinc-700 bg-white/80 dark:bg-zinc-950/70 px-3 py-1">Hyroglyphs fiction</span>
              <span className="rounded-full border border-indigo-300/70 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/40 px-3 py-1 text-indigo-600 dark:text-indigo-300">ARV seed engine</span>
              <span className="rounded-full border border-cyan-300/70 dark:border-cyan-800/60 bg-cyan-50/80 dark:bg-cyan-950/30 px-3 py-1 text-cyan-700 dark:text-cyan-300">Scene GIF pipeline</span>
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-stone-950 dark:text-stone-100">
                Hyroglyphs Fiction Story Scenes GIF Designer
              </h2>
              <p className="mt-3 max-w-3xl text-sm md:text-base text-stone-600 dark:text-stone-300 leading-relaxed">
                ARV liefert Figuren, Phasen, Satire-DNA und Sequenzlogik. Der Story-Composer nimmt diese Seeds direkt auf,
                macht jede Szene editierbar und rendert daraus exportierbare GIF-Story-Runs.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-stone-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/70 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 font-semibold">1. Seed</div>
                <div className="mt-2 flex items-center gap-2 text-stone-900 dark:text-stone-100 font-semibold">
                  <Cpu size={16} className="text-indigo-500" />
                  ARV Story Engine
                </div>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">Charaktere, Phasen und absurde Broadcast-Logik erzeugen den narrativen Kern.</p>
              </div>
              <div className="rounded-2xl border border-stone-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/70 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 font-semibold">2. Compose</div>
                <div className="mt-2 flex items-center gap-2 text-stone-900 dark:text-stone-100 font-semibold">
                  <Sparkles size={16} className="text-cyan-500" />
                  Story Scene Editor
                </div>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">Prompts pro Szene nachschleifen, Stil-Presets setzen und Render-Engine waehlen.</p>
              </div>
              <div className="rounded-2xl border border-stone-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/70 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 font-semibold">3. Export</div>
                <div className="mt-2 flex items-center gap-2 text-stone-900 dark:text-stone-100 font-semibold">
                  <Film size={16} className="text-emerald-500" />
                  Scene GIF Run
                </div>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">Einzelszenen oder ZIP-Run fuer komplette Fiction-Sequenzen direkt aus derselben Oberflaeche.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-stone-200/80 dark:border-zinc-800 bg-stone-950 text-stone-100 p-5 md:p-6 shadow-xl shadow-stone-950/10">
            <div className="text-[11px] uppercase tracking-[0.22em] text-stone-500 font-semibold">Active bridge</div>
            {preloadedStoryboard ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <ArrowDownRight size={16} />
                  ARV Seed liegt im Composer an
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">{preloadedStoryboard.title}</div>
                  <p className="mt-1 text-sm text-stone-300 leading-relaxed">{preloadedStoryboard.concept}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Szenen</div>
                    <div className="mt-1 text-xl font-bold text-white">{preloadedStoryboard.scenes.length}</div>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Quelle</div>
                    <div className="mt-1 text-sm font-semibold text-indigo-300">ARV narrative seed</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-stone-300">
                <p>
                  Sobald du im ARV-Panel eine Story-Sequenz, einen Sketch oder eine Transmission an den Composer sendest,
                  landet sie direkt im Szenen-Editor unten.
                </p>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 text-stone-400">
                  Nutze links den Story-, Sketch- oder Transmission-Tab. Der Composer springt danach automatisch zur geladenen Sequenz.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] items-start">
        <section className="rounded-[28px] border border-stone-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 p-5 md:p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400 font-semibold">World seeding</div>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-stone-950 dark:text-stone-100">ARV Fiction Engine</h3>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-300 max-w-xl">
                Entwickle den narrativen Kern und schiebe passende Storyboards ohne Tab-Wechsel direkt in den Story-Composer.
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
              <Cpu size={14} />
              Story-first mode
            </div>
          </div>
          <ARVEngine
            embedded
            onUsePrompt={onUseStillframeSeed}
            onSendToStoryboard={handleStoryboardCreated}
            styleProfile={styleProfile}
            styleMode={styleMode}
            onAzureUsage={onAzureUsage}
          />
        </section>

        <section ref={storySectionRef} className="rounded-[28px] border border-stone-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 p-5 md:p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400 font-semibold">Scene composing</div>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-stone-950 dark:text-stone-100">Story Scenes GIF Composer</h3>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-300 max-w-2xl">
                Verarbeite freie Ideen oder ARV-Seeds zu editierbaren Szenen, generiere einzelne GIFs oder exportiere komplette Fiction-Runs als ZIP.
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Film size={14} />
              Scene output
            </div>
          </div>
          <StoryMode
            embedded
            model={model}
            setModel={setModel}
            onStorySaved={onStorySaved}
            saveToLibrary={saveToLibrary}
            preloadedStoryboard={preloadedStoryboard}
            onAzureUsage={onAzureUsage}
          />
        </section>
      </div>
    </div>
  );
}