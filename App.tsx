import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { BookOpen, Cpu, Film, Loader2, Moon, Sparkles, Sun } from 'lucide-react';
import type { LibraryIdeaItem } from './lib/libraryDB';
import { useLibrary } from './hooks/useLibrary';
import { useFeedback } from './hooks/useFeedback';
import { useAzureUsage } from './hooks/useAzureUsage';
import type { ARVStorySequence } from './lib/arvTypes';
import { generateStorySequence } from './lib/arvEngine';
import { DEFAULT_STYLE_FLEX_MODE } from './lib/styleTaste';

const Library = lazy(() => import('./components/Library'));
const FictionStoryDesigner = lazy(() => import('./components/FictionStoryDesigner'));
const StillframeHarness = lazy(() => import('./components/StillframeHarness'));
const AzureUsagePanel = lazy(() => import('./components/AzureUsagePanel'));

type StudioTab = 'fiction' | 'library';

interface BrowserLocationState {
  pathname: string;
  search: string;
}

const STILLFRAME_IDEA_REMIX_STORAGE_KEY = 'hyroglyphis:stillframe-ideas-remix';

const storeStillframeSeed = (seed: string, sourceTitle?: string): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const normalizedSeed = seed.trim();
  if (!normalizedSeed) {
    return false;
  }

  try {
    window.sessionStorage.setItem(
      STILLFRAME_IDEA_REMIX_STORAGE_KEY,
      JSON.stringify({
        mode: 'ritual',
        seed: normalizedSeed,
        sourceTitle,
      }),
    );
    return true;
  } catch {
    return false;
  }
};

const getBrowserLocationState = (): BrowserLocationState => {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '' };
  }

  return {
    pathname: window.location.pathname,
    search: window.location.search,
  };
};

const resolveStudioTab = (location: BrowserLocationState): StudioTab => {
  if (location.pathname === '/library') {
    return 'library';
  }

  return 'fiction';
};

function SurfaceFallback({ label, fullScreen = false }: { label: string; fullScreen?: boolean }) {
  return (
    <div className={`signal-fallback ${fullScreen ? 'min-h-screen' : 'min-h-[320px]'} flex items-center justify-center bg-stone-50 dark:bg-zinc-950 text-stone-500 dark:text-stone-400`}>
      <div className="signal-fallback__panel flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 px-5 py-4 shadow-sm">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [browserLocation, setBrowserLocation] = useState<BrowserLocationState>(getBrowserLocationState);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handlePopState = () => {
      setBrowserLocation(getBrowserLocationState());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((target: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextUrl = new URL(target, window.location.origin);
    const nextLocation = {
      pathname: nextUrl.pathname,
      search: nextUrl.search,
    };
    const currentLocation = getBrowserLocationState();

    if (
      nextLocation.pathname === currentLocation.pathname
      && nextLocation.search === currentLocation.search
    ) {
      return;
    }

    window.history.pushState({}, '', `${nextLocation.pathname}${nextLocation.search}`);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setBrowserLocation(nextLocation);
  }, []);

  if (browserLocation.pathname === '/stillframe') {
    return (
      <Suspense fallback={<SurfaceFallback label="Stillframe Rituals wird geladen" fullScreen />}>
        <StillframeHarness onNavigateBack={() => navigate('/')} />
      </Suspense>
    );
  }

  return <StudioApp navigate={navigate} browserLocation={browserLocation} />;
}

interface StudioAppProps {
  navigate: (target: string) => void;
  browserLocation: BrowserLocationState;
}

function StudioApp({ navigate, browserLocation }: StudioAppProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>(() => resolveStudioTab(browserLocation));
  const { items: libraryItems, save: saveToLibrary, remove: removeFromLibrary, clearAll: clearLibrary } = useLibrary();
  const { styleProfile, getFeedbackFor, submitFeedback } = useFeedback();
  const { entries: azureUsageEntries, addEntry: addAzureUsageEntry, clearEntries: clearAzureUsage, totals: azureUsageTotals } = useAzureUsage();
  const [savedToast, setSavedToast] = useState(false);
  const [arvStoryboard, setArvStoryboard] = useState<ARVStorySequence | null>(null);
  const [model, setModel] = useState<'openai' | 'foundry'>('foundry');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    try {
      return window.localStorage.getItem('hyroglyphis-theme') !== 'light';
    } catch {
      return document.documentElement.classList.contains('dark');
    }
  });
  const styleMode = DEFAULT_STYLE_FLEX_MODE;

  useEffect(() => {
    setActiveTab(resolveStudioTab(browserLocation));
  }, [browserLocation]);

  useEffect(() => {
    if (browserLocation.pathname === '/library') {
      document.title = 'Hyroglyphs Library';
      return;
    }

    document.title = 'Hyroglyphs ARV Story Studio';
  }, [browserLocation.pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);

    try {
      window.localStorage.setItem('hyroglyphis-theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage failures
    }
  }, [darkMode]);

  const handleTabChange = useCallback((tab: StudioTab) => {
    setActiveTab(tab);

    if (tab === 'library') {
      navigate('/library');
      return;
    }

    navigate('/');
  }, [navigate]);

  const handleRemixIdeaPack = useCallback((item: LibraryIdeaItem) => {
    if (typeof window === 'undefined') {
      return;
    }

    const remixSeed = [
      item.seed || item.prompt,
      ...item.themes.slice(0, 2),
      ...item.characters.slice(0, 1),
      ...item.events.slice(0, 1),
      ...item.styles.slice(0, 2),
      ...item.promptSeeds.slice(0, 2),
      ...item.visions.slice(0, 2).map((vision) => vision.story),
    ]
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .join(' | ');

    const payload = {
      mode: item.mode,
      seed: remixSeed || item.prompt,
      sourceTitle: item.title,
      referenceStyle: item.referenceSummary ? { summary: item.referenceSummary } : null,
    };

    try {
      window.sessionStorage.setItem(STILLFRAME_IDEA_REMIX_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      return;
    }

    navigate('/stillframe');
  }, [navigate]);

  const handleOpenStillframeSeed = useCallback((prompt: string) => {
    if (!storeStillframeSeed(prompt, 'ARV Story Studio Seed')) {
      return;
    }

    navigate('/stillframe');
  }, [navigate]);

  return (
    <div className="signal-shell min-h-screen bg-stone-50 dark:bg-zinc-950 text-stone-900 dark:text-stone-100 transition-colors duration-300 font-sans">
      <header className="signal-header border-b border-stone-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="signal-header__inner max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => handleTabChange('fiction')}
            className="signal-brand flex items-center gap-3 text-left"
          >
            <div className="signal-brand__mark">
              <img src="/arv-symbole_logo.png" alt="Hyroglyphs Logo" className="signal-brand__logo w-8 h-8 rounded-lg object-contain" />
            </div>
            <div className="signal-brand__copy">
              <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 font-semibold">
                Hyroglyphs / ARV Story Studio
              </div>
              <h1 className="text-xl font-bold tracking-tight text-stone-950 dark:text-stone-100">
                Story-first Surface
              </h1>
            </div>
          </button>

          <div className="signal-header__controls flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/stillframe')}
              className="flex items-center gap-2 rounded-full border border-indigo-300 dark:border-indigo-800/70 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300 transition-colors hover:border-indigo-400 dark:hover:border-indigo-700"
              title="Stillframe Rituals"
            >
              <Film size={14} />
              Stillframe
            </button>
            <button
              type="button"
              onClick={() => setDarkMode((current) => !current)}
              className="signal-theme-toggle p-2 rounded-full hover:bg-stone-200 dark:hover:bg-zinc-800 transition-colors"
              title="Toggle Dark Mode"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main className="signal-main max-w-7xl mx-auto px-4 py-8 md:py-12 space-y-10">
        <section className="relative overflow-hidden rounded-[32px] border border-stone-200 dark:border-zinc-800 bg-gradient-to-br from-stone-100 via-white to-indigo-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950/40 p-6 md:p-8 shadow-sm">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_38%),radial-gradient(circle_at_bottom_left,_rgba(34,211,238,0.16),_transparent_32%)] dark:bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.2),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(34,211,238,0.16),_transparent_32%)]" />
          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] xl:items-end">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400 font-semibold">
                <span className="rounded-full border border-stone-300/80 dark:border-zinc-700 bg-white/80 dark:bg-zinc-950/70 px-3 py-1">ARV Seed Engine</span>
                <span className="rounded-full border border-indigo-300/70 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/40 px-3 py-1 text-indigo-600 dark:text-indigo-300">Story Scene Composer</span>
                <span className="rounded-full border border-cyan-300/70 dark:border-cyan-800/60 bg-cyan-50/80 dark:bg-cyan-950/30 px-3 py-1 text-cyan-700 dark:text-cyan-300">Stillframe Rituals</span>
              </div>

              <div>
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-stone-950 dark:text-stone-100 max-w-4xl">
                  Eine reduzierte Oberfläche für Story-Seeds, Stillframe-Rituale, Library und Azure Usage.
                </h2>
                <p className="mt-4 max-w-3xl text-sm md:text-base text-stone-600 dark:text-stone-300 leading-relaxed">
                  Die Root-Surface konzentriert sich jetzt vollständig auf ARV Story Studio: Seeds erzeugen, Szenen komponieren,
                  Stillframe-Ideen öffnen, Ergebnisse speichern und den Azure-Verbrauch nachvollziehen.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleTabChange('fiction')}
                  className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-stone-200 dark:hover:border-zinc-500"
                >
                  Story Studio oeffnen
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/stillframe')}
                  className="rounded-full border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:border-indigo-400 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:border-indigo-700"
                >
                  Stillframe Rituals
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('library')}
                  className="rounded-full border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition-colors hover:border-cyan-400 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300 dark:hover:border-cyan-700"
                >
                  Library / Export
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-stone-200/80 dark:border-zinc-800 bg-stone-950 text-stone-100 p-5 md:p-6 shadow-xl shadow-stone-950/10">
              <div className="text-[11px] uppercase tracking-[0.22em] text-stone-500 font-semibold">Studio focus</div>
              <div className="mt-4 space-y-4 text-sm text-stone-300">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <Cpu size={16} />
                  Story-first Root
                </div>
                <p>
                  Keine Single-GIF-Surface mehr. Prompt-Aktionen aus ARV und Fiction gehen direkt als Stillframe-Seed weiter.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Aktiver Renderer</div>
                    <div className="mt-1 text-sm font-semibold text-white">{model === 'foundry' ? 'Azure Foundry' : 'OpenAI'}</div>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Story Seed</div>
                    <div className="mt-1 text-sm font-semibold text-white">{arvStoryboard ? 'bereit' : 'leer'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-center">
          <div className="signal-tabs bg-stone-200/50 dark:bg-zinc-800/50 p-1.5 rounded-2xl flex gap-2">
            <button
              type="button"
              onClick={() => handleTabChange('fiction')}
              className={`signal-tab flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'fiction'
                  ? 'signal-tab--active bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <Sparkles size={20} />
              Story Studio
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('library')}
              className={`signal-tab flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'library'
                  ? 'signal-tab--active bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <BookOpen size={20} />
              Bibliothek
              {libraryItems.length > 0 && (
                <span className="signal-badge ml-1 px-1.5 py-0.5 text-xs rounded-full bg-indigo-500 text-white">
                  {libraryItems.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {savedToast && (
          <div className="signal-toast fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xl text-sm font-medium animate-fade-in">
            <BookOpen size={16} />
            In Bibliothek gespeichert
          </div>
        )}

        <Suspense fallback={<SurfaceFallback label="Panel wird geladen" />}>
          {activeTab === 'fiction' ? (
            <FictionStoryDesigner
              model={model}
              setModel={setModel}
              onStorySaved={() => {
                setSavedToast(true);
                window.setTimeout(() => setSavedToast(false), 3000);
              }}
              saveToLibrary={saveToLibrary}
              preloadedStoryboard={arvStoryboard}
              onAzureUsage={addAzureUsageEntry}
              onUseStillframeSeed={handleOpenStillframeSeed}
              onStoryboardCreated={setArvStoryboard}
              styleProfile={styleProfile}
              styleMode={styleMode}
            />
          ) : (
            <Library
              items={libraryItems}
              onDelete={removeFromLibrary}
              onClearAll={clearLibrary}
              onRemixIdeaPack={handleRemixIdeaPack}
              onSubmitFeedback={submitFeedback}
              onFollowUp={(concept) => {
                const board = generateStorySequence(concept, undefined, styleMode);
                setArvStoryboard(board);
                handleTabChange('fiction');
              }}
              getFeedbackFor={getFeedbackFor}
              styleProfile={styleProfile}
            />
          )}
        </Suspense>
      </main>

      {azureUsageEntries.length > 0 && (
        <Suspense fallback={null}>
          <AzureUsagePanel entries={azureUsageEntries} totals={azureUsageTotals} onClear={clearAzureUsage} />
        </Suspense>
      )}
    </div>
  );
}
