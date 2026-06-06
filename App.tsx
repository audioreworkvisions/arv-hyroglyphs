import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { BookOpen, Film, Loader2, Moon, Sparkles, Sun } from 'lucide-react';
import type { LibraryIdeaItem } from './lib/libraryDB';
import { useLibrary } from './hooks/useLibrary';
import { useFeedback } from './hooks/useFeedback';
import { useAzureUsage } from './hooks/useAzureUsage';
import type { ARVStorySequence } from './lib/arvTypes';
import { generateStorySequence } from './lib/arvEngine';
import { DEFAULT_STYLE_FLEX_MODE } from './lib/styleTaste';

const Library = lazy(() => import('./components/Library'));
const StillframeHarness = lazy(() => import('./components/StillframeHarness'));
const ThumbnailStudio = lazy(() => import('./components/ThumbnailStudio'));
const AzureUsagePanel = lazy(() => import('./components/AzureUsagePanel'));
const RandomGifGenerator = lazy(() => import('./components/arv-live/RandomGifGenerator'));
const RandomVideoGenerator = lazy(() => import('./components/arv-live/RandomVideoGenerator'));

interface BrowserLocationState {
  pathname: string;
  search: string;
}

const STILLFRAME_IDEA_REMIX_STORAGE_KEY = 'hyroglyphis:stillframe-ideas-remix';

const getBrowserLocationState = (): BrowserLocationState => {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '' };
  }

  return {
    pathname: window.location.pathname,
    search: window.location.search,
  };
};

function SurfaceFallback({ label, fullScreen = false }: { label: string; fullScreen?: boolean }) {
  return (
    <div className={`${fullScreen ? 'min-h-screen' : 'min-h-[320px]'} flex items-center justify-center bg-stone-50 text-stone-500 dark:bg-zinc-950 dark:text-stone-400`}>
      <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white/80 px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [browserLocation, setBrowserLocation] = useState<BrowserLocationState>(getBrowserLocationState);
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
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handlePopState = () => {
      setBrowserLocation(getBrowserLocationState());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);

    try {
      window.localStorage.setItem('hyroglyphis-theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage failures
    }
  }, [darkMode]);

  useEffect(() => {
    if (browserLocation.pathname === '/library') {
      document.title = 'Hyroglyphs Library';
    } else if (browserLocation.pathname === '/thumbnail-studio') {
      document.title = 'ARV Thumbnail Studio';
    } else {
      document.title = 'Hyroglyphs Stillframe Studio';
    }
  }, [browserLocation.pathname]);

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

  const showSavedToast = useCallback(() => {
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 3000);
  }, []);

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

  const isLibraryRoute = browserLocation.pathname === '/library';
  const isThumbnailStudioRoute = browserLocation.pathname === '/thumbnail-studio';

  return (
    <>
      {isThumbnailStudioRoute ? (
        <Suspense fallback={<SurfaceFallback label="ARV Thumbnail Studio wird geladen" fullScreen />}>
          <ThumbnailStudio
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((current) => !current)}
            onNavigateStillframe={() => navigate('/stillframe')}
            onNavigateLibrary={() => navigate('/library')}
          />
        </Suspense>
      ) : isLibraryRoute ? (
        <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-zinc-950 dark:text-stone-100">
          <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/stillframe')}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300"
                >
                  <Film size={14} />
                  Stillframe Studio
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/thumbnail-studio')}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:border-amber-300 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                >
                  <Sparkles size={14} />
                  Thumbnail Studio
                </button>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
                Bibliothek · {libraryItems.length} Items
              </div>
              <button
                type="button"
                onClick={() => setDarkMode((current) => !current)}
                className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 transition hover:border-stone-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-stone-300"
                title="Theme umschalten"
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-8">
            <Suspense fallback={<SurfaceFallback label="Bibliothek wird geladen" />}>
              <Library
                items={libraryItems}
                onDelete={removeFromLibrary}
                onClearAll={clearLibrary}
                onRemixIdeaPack={handleRemixIdeaPack}
                onSubmitFeedback={submitFeedback}
                onFollowUp={(concept) => {
                  const board = generateStorySequence(concept, undefined, styleMode);
                  setArvStoryboard(board);
                  navigate('/stillframe');
                }}
                getFeedbackFor={getFeedbackFor}
                styleProfile={styleProfile}
              />
            </Suspense>
          </main>
        </div>
      ) : (
        <Suspense fallback={<SurfaceFallback label="Stillframe Studio wird geladen" fullScreen />}>
          <StillframeHarness
            model={model}
            setModel={setModel}
            saveToLibrary={saveToLibrary}
            onStorySaved={showSavedToast}
            preloadedStoryboard={arvStoryboard}
            onAzureUsage={addAzureUsageEntry}
            onNavigateLibrary={() => navigate('/library')}
            onNavigateThumbnailStudio={() => navigate('/thumbnail-studio')}
            libraryCount={libraryItems.length}
          />
        </Suspense>
      )}

      {savedToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-xl dark:bg-white dark:text-zinc-900">
          <BookOpen size={16} />
          In Bibliothek gespeichert
        </div>
      )}

      {azureUsageEntries.length > 0 && (
        <Suspense fallback={null}>
          <AzureUsagePanel entries={azureUsageEntries} totals={azureUsageTotals} onClear={clearAzureUsage} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <RandomGifGenerator />
      </Suspense>

      <Suspense fallback={null}>
        <RandomVideoGenerator />
      </Suspense>
    </>
  );
}
