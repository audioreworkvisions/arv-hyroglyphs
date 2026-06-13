import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { BookOpen, Loader2, Moon, Sun } from 'lucide-react';
import type { LibraryIdeaItem } from './lib/libraryDB';
import { useLibrary } from './hooks/useLibrary';
import { useFeedback } from './hooks/useFeedback';
import { useAzureUsage } from './hooks/useAzureUsage';
import type { ARVStorySequence } from './lib/arvTypes';
import { generateStorySequence } from './lib/arvEngine';
import { DEFAULT_STYLE_FLEX_MODE } from './lib/styleTaste';

const Library = lazy(() => import('./components/Library'));
const StillframeHarness = lazy(() => import('./components/StillframeHarness'));
const StoryGifComposerPage = lazy(() => import('./components/StoryGifComposerPage'));
const ThumbnailStudio = lazy(() => import('./components/ThumbnailStudio'));
const AzureUsagePanel = lazy(() => import('./components/AzureUsagePanel'));

interface BrowserLocationState {
  pathname: string;
  search: string;
}

const STILLFRAME_IDEA_REMIX_STORAGE_KEY = 'hyroglyphis:stillframe-ideas-remix';
const ARV_COPYRIGHT_TEXT = 'ARV COPYRIGHT 2026 AUDIOREWORKVISIONS';

type AppRouteId = 'stillframe' | 'thumbnail-studio' | 'story-gif-composer' | 'library';

interface AppChromeProps {
  activeRoute: AppRouteId;
  children: React.ReactNode;
  darkMode: boolean;
  libraryCount: number;
  onNavigate: (target: string) => void;
  onToggleDarkMode: () => void;
}

const ROUTE_META: Record<AppRouteId, { path: string; label: string; detail: string }> = {
  stillframe: { path: '/stillframe', label: 'Stillframe Studio', detail: 'Visual Engine' },
  'thumbnail-studio': { path: '/thumbnail-studio', label: 'Thumbnail Studio', detail: 'YouTube Assets' },
  'story-gif-composer': { path: '/story-gif-composer', label: 'Story GIF Composer', detail: 'Scene ZIPs' },
  library: { path: '/library', label: 'Library', detail: 'Memory' },
};

function AppChrome({ activeRoute, children, darkMode, libraryCount, onNavigate, onToggleDarkMode }: AppChromeProps) {
  return (
    <div className="signal-shell flex min-h-screen flex-col bg-[#02040e] text-[#f3f8ff]">
      <header className="sticky top-0 z-40 border-b border-[rgba(114,228,255,0.16)] bg-[rgba(4,6,16,0.92)] px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/stillframe')}
            className="flex min-w-[220px] items-center gap-3 rounded-2xl border border-transparent px-1 py-1 text-left transition hover:border-[rgba(114,228,255,0.18)] hover:bg-[rgba(7,14,28,0.72)]"
          >
            <img src="/arv_logo.png" alt="ARV" className="h-12 w-12 rounded-xl border border-[rgba(210,255,77,0.28)] bg-black/40 object-contain p-1 shadow-[0_0_28px_rgba(210,255,77,0.16)]" />
            <span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.24em] text-[#d2ff4d]">Audioreworkvisions</span>
              <span className="block font-mono text-sm font-semibold text-[#f3f8ff]">Hyroglyphs</span>
            </span>
          </button>

          <nav className="flex flex-1 flex-wrap items-center gap-2" aria-label="App Navigation">
            {(Object.keys(ROUTE_META) as AppRouteId[]).map((routeId) => {
              const route = ROUTE_META[routeId];
              const active = routeId === activeRoute;
              return (
                <button
                  key={routeId}
                  type="button"
                  onClick={() => onNavigate(route.path)}
                  className={`rounded-xl border px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition ${active
                    ? 'border-[rgba(210,255,77,0.35)] bg-[rgba(35,46,12,0.68)] text-[#d2ff4d] shadow-[0_0_24px_rgba(210,255,77,0.08)]'
                    : 'border-[rgba(114,228,255,0.14)] bg-[rgba(7,14,28,0.68)] text-[#8ea6c3] hover:border-[rgba(114,228,255,0.32)] hover:text-[#72e4ff]'}`}
                >
                  <span className="block">{route.label}</span>
                  <span className="mt-0.5 block text-[9px] font-normal tracking-[0.08em] opacity-60">
                    {routeId === 'library' ? `${libraryCount} Items` : route.detail}
                  </span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={onToggleDarkMode}
            className="rounded-xl border border-[rgba(114,228,255,0.16)] bg-[rgba(7,14,28,0.82)] p-2 text-[#8ea6c3] transition hover:border-[rgba(114,228,255,0.35)] hover:text-[#72e4ff]"
            title="Theme umschalten"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-[rgba(114,228,255,0.14)] bg-[rgba(4,6,16,0.82)] px-4 py-5">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 text-[11px] uppercase tracking-[0.22em] text-[#8ea6c3]">
          <span>{ARV_COPYRIGHT_TEXT}</span>
          <img src="/arv_logo.png" alt="ARV" className="h-7 w-7 rounded-md object-contain opacity-70" />
        </div>
      </footer>
    </div>
  );
}

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
    } else if (browserLocation.pathname === '/story-gif-composer') {
      document.title = 'Hyroglyphs Story GIF Composer';
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
  const isStoryGifComposerRoute = browserLocation.pathname === '/story-gif-composer';
  const activeRoute: AppRouteId = isLibraryRoute
    ? 'library'
    : isThumbnailStudioRoute
      ? 'thumbnail-studio'
      : isStoryGifComposerRoute
        ? 'story-gif-composer'
        : 'stillframe';

  return (
    <AppChrome
      activeRoute={activeRoute}
      darkMode={darkMode}
      libraryCount={libraryItems.length}
      onNavigate={navigate}
      onToggleDarkMode={() => setDarkMode((current) => !current)}
    >
      {isStoryGifComposerRoute ? (
        <Suspense fallback={<SurfaceFallback label="Story GIF Composer wird geladen" fullScreen />}>
          <StoryGifComposerPage
            model={model}
            setModel={setModel}
            saveToLibrary={saveToLibrary}
            onStorySaved={showSavedToast}
            preloadedStoryboard={arvStoryboard}
            onAzureUsage={addAzureUsageEntry}
          />
        </Suspense>
      ) : isThumbnailStudioRoute ? (
        <Suspense fallback={<SurfaceFallback label="ARV Thumbnail Studio wird geladen" fullScreen />}>
          <ThumbnailStudio />
        </Suspense>
      ) : isLibraryRoute ? (
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
                  navigate('/story-gif-composer');
                }}
                getFeedbackFor={getFeedbackFor}
                styleProfile={styleProfile}
              />
            </Suspense>
          </main>
      ) : (
        <Suspense fallback={<SurfaceFallback label="Stillframe Studio wird geladen" fullScreen />}>
          <StillframeHarness />
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
    </AppChrome>
  );
}
