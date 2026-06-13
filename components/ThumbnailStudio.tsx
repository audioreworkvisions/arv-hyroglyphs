import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Save, Search, Sparkles } from 'lucide-react';
import type {
  FoundryIqMemoryResult,
  ThumbnailBackgroundResult,
  ThumbnailConcept,
  ThumbnailReferenceAnalysis,
  ThumbnailRenderResult,
  ThumbnailStudioHealth,
  ThumbnailStudioSession,
  ThumbnailStyleProfile,
  ThumbnailUploadedImage,
} from '../lib/thumbnailTypes';
import { THUMBNAIL_GENRES } from '../lib/thumbnailTypes';
import ThumbnailStudioForm, { type ThumbnailFormState } from './thumbnail-studio/ThumbnailStudioForm';
import FoundryIqMemoryPanel from './thumbnail-studio/FoundryIqMemoryPanel';
import ThumbnailConceptPanel from './thumbnail-studio/ThumbnailConceptPanel';
import ThumbnailPreviewPanel from './thumbnail-studio/ThumbnailPreviewPanel';
import ThumbnailHistoryPanel from './thumbnail-studio/ThumbnailHistoryPanel';

const DEFAULT_FORM: ThumbnailFormState = {
  title: '',
  theme: '',
  genre: THUMBNAIL_GENRES[0],
  mood: ['dark', 'underground'],
  streamNumber: '',
  variantCount: 10,
  thumbnailMode: 'final-composed-thumbnail',
  folderPath: '',
  useFoundryIq: true,
};

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error((data as { error?: string })?.error || `Request failed (${response.status})`);
  }
  return data;
};

const actionButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40';

export default function ThumbnailStudio() {
  const [form, setForm] = useState<ThumbnailFormState>(DEFAULT_FORM);
  const [uploads, setUploads] = useState<ThumbnailUploadedImage[]>([]);
  const [health, setHealth] = useState<ThumbnailStudioHealth | null>(null);

  const [analysis, setAnalysis] = useState<ThumbnailReferenceAnalysis | null>(null);
  const [styleProfile, setStyleProfile] = useState<ThumbnailStyleProfile | null>(null);
  const [memory, setMemory] = useState<FoundryIqMemoryResult | null>(null);
  const [concept, setConcept] = useState<ThumbnailConcept | null>(null);
  const [background, setBackground] = useState<ThumbnailBackgroundResult | null>(null);
  const [uploadedBackground, setUploadedBackground] = useState<string | null>(null);
  const [render, setRender] = useState<ThumbnailRenderResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<ThumbnailStudioSession[]>([]);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const patchForm = useCallback((patch: Partial<ThumbnailFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  const flashNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/thumbnail-studio/health')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ThumbnailStudioHealth | null) => {
        if (!cancelled && data) setHealth(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await fetch('/api/thumbnail-studio/history').then((response) => response.json());
      setHistory(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch {
      // ignore — history is non-critical
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const run = useCallback(
    async (key: string, action: () => Promise<void>) => {
      setBusy(key);
      setError(null);
      try {
        await action();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unbekannter Fehler');
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const handleAnalyze = useCallback(
    () =>
      run('analyze', async () => {
        const data = await postJson<{ analysis: ThumbnailReferenceAnalysis; styleProfile: ThumbnailStyleProfile }>(
          '/api/thumbnail-studio/analyze-references',
          { folderPath: form.folderPath || undefined, uploadedImages: uploads },
        );
        setAnalysis(data.analysis);
        setStyleProfile(data.styleProfile);
        flashNotice(`${data.analysis.analyzedCount} Referenzen analysiert — Style Profile erstellt.`);
      }),
    [flashNotice, form.folderPath, run, uploads],
  );

  const handleFetchMemory = useCallback(
    () =>
      run('memory', async () => {
        const data = await postJson<{ memory: FoundryIqMemoryResult }>('/api/thumbnail-studio/memory/search', {
          title: form.title,
          theme: form.theme,
          genre: form.genre,
          mood: form.mood,
          referenceSummary: styleProfile?.summary || '',
          styleProfileId: styleProfile?.id,
          useFoundryIq: form.useFoundryIq,
        });
        setMemory(data.memory);
      }),
    [form, run, styleProfile],
  );

  const handleGenerateConcept = useCallback(
    () =>
      run('concept', async () => {
        const data = await postJson<{
          sessionId: string;
          concept: ThumbnailConcept;
          memory: FoundryIqMemoryResult;
          styleProfile: ThumbnailStyleProfile;
        }>('/api/thumbnail-studio/generate-concept', {
          title: form.title,
          theme: form.theme,
          genre: form.genre,
          mood: form.mood,
          streamNumber: form.streamNumber,
          variantCount: form.variantCount,
          thumbnailMode: form.thumbnailMode,
          styleProfileId: styleProfile?.id,
          useFoundryIq: form.useFoundryIq,
        });
        setConcept(data.concept);
        setMemory(data.memory);
        setStyleProfile(data.styleProfile);
        setSessionId(data.sessionId);
        setRender(null);
        flashNotice('Neues Konzept generiert.');
        void refreshHistory();
      }),
    [flashNotice, form, refreshHistory, run, styleProfile],
  );

  const handleGenerateBackground = useCallback(
    () =>
      run('background', async () => {
        if (!concept) {
          throw new Error('Bitte zuerst ein Konzept generieren.');
        }
        const data = await postJson<{ background: ThumbnailBackgroundResult }>(
          '/api/thumbnail-studio/generate-background',
          {
            backgroundPrompt: concept.backgroundPrompt,
            negativePrompt: concept.negativePrompt,
            size: '1792x1024',
            provider: 'foundry',
          },
        );
        setBackground(data.background);
        if (data.background.imageDataUrl) {
          setUploadedBackground(null);
          const overlay = concept.textOverlay;
          const renderLayout = { ...overlay, localOverlay: 'none' as const };
          const renderData = await postJson<{ render: ThumbnailRenderResult }>('/api/thumbnail-studio/render', {
            backgroundDataUrl: data.background.imageDataUrl,
            title: concept.selectedTitle,
            subtitle: overlay.subtitle,
            topline: overlay.topline,
            footer: overlay.footer,
            streamNumber: overlay.streamNumber,
            layout: renderLayout,
            outputFormat: 'png',
            sessionId: sessionId || undefined,
          });
          setRender(renderData.render);
          flashNotice('Thumbnail mit Titel generiert.');
        } else {
          flashNotice(data.background.note);
        }
      }),
    [concept, flashNotice, run, sessionId],
  );

  const handleRender = useCallback(
    () =>
      run('render', async () => {
        if (!concept) {
          throw new Error('Bitte zuerst ein Konzept generieren.');
        }
        const overlay = concept.textOverlay;
        const renderLayout = background?.provider === 'foundry'
          ? { ...overlay, localOverlay: 'none' as const }
          : overlay;
        const data = await postJson<{ render: ThumbnailRenderResult }>('/api/thumbnail-studio/render', {
          backgroundDataUrl: uploadedBackground || background?.imageDataUrl || undefined,
          title: concept.selectedTitle,
          subtitle: overlay.subtitle,
          topline: overlay.topline,
          footer: overlay.footer,
          streamNumber: overlay.streamNumber,
          layout: renderLayout,
          outputFormat: 'png',
          sessionId: sessionId || undefined,
        });
        setRender(data.render);
        flashNotice('Thumbnail gerendert.');
      }),
    [background, concept, flashNotice, run, sessionId, uploadedBackground],
  );

  const handleSaveMemory = useCallback(
    () =>
      run('memorywrite', async () => {
        if (!concept) {
          throw new Error('Bitte zuerst ein Konzept generieren.');
        }
        const data = await postJson<{ syncHint: string; markdownPath: string }>(
          '/api/thumbnail-studio/memory/write',
          {
            writeLocal: true,
            memoryCard: {
              brand: 'Audioreworkvisions',
              title: concept.selectedTitle,
              theme: concept.theme,
              genre: form.genre,
              mood: form.mood,
              palette: concept.palette,
              layout: concept.layout,
              whatGenerated: `${concept.youtubeTitle} — ${concept.shortConcept}`,
              whatWorked: 'AI-composed exact-title thumbnail with Foundry IQ creative brand memory.',
              avoidNextTime: concept.creativeDecision.avoidedPatterns.join('; '),
              backgroundPrompt: concept.backgroundPrompt,
              negativePrompt: concept.negativePrompt,
              textOverlay: concept.textOverlay,
              foundryIqSources: (memory?.citations || []).map((citation) => citation.source),
            },
          },
        );
        flashNotice(data.syncHint);
      }),
    [concept, flashNotice, form.genre, form.mood, memory, run],
  );

  const handleExportJson = useCallback(() => {
    if (!concept) return;
    const blob = new Blob([JSON.stringify({ form, styleProfile, memory, concept, render }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `arv-thumbnail-${concept.selectedTitle.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [concept, form, memory, render, styleProfile]);

  const handleSelectSession = useCallback((session: ThumbnailStudioSession) => {
    setConcept(session.concept);
    setMemory(session.foundryIqMemory);
    setStyleProfile(session.styleProfile);
    setRender(session.render);
    setSessionId(session.id);
    setBackground(session.background);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const fallbackTier = useMemo(() => {
    if (!health) return 'wird geprüft …';
    if (health.foundryIqConfigured && health.azureTextConfigured && health.azureImageConfigured) {
      return 'Stufe 1 · Full Azure Demo';
    }
    if (health.azureTextConfigured || health.foundryIqConfigured) {
      return 'Stufe 2 · Text-only Azure (Upload Hintergrund)';
    }
    return 'Stufe 3 · Offline / lokaler Fallback';
  }, [health]);

  return (
    <div className="min-h-full text-zinc-100">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles size={22} className="text-amber-400" />
            <h1 className="text-2xl font-black tracking-tight text-zinc-50">ARV Thumbnail Studio</h1>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            {fallbackTier}
          </div>
          <p className="max-w-3xl text-sm text-zinc-400">
            Generiert Titel, Thema, YouTube-Metadaten und ein finales 16:9-Thumbnail für den nächsten Audioreworkvisions
            Livestream — gestützt auf Azure AI Foundry IQ als Creative Brand Memory.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            <AlertTriangle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="rounded-xl border border-cyan-900/60 bg-cyan-950/30 px-4 py-3 text-sm text-cyan-300">{notice}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-6">
            <ThumbnailStudioForm
              state={form}
              uploads={uploads}
              busy={busy !== null}
              onChange={patchForm}
              onUploadsChange={setUploads}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={busy !== null}
                className={`${actionButtonClass} border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-cyan-700`}
              >
                {busy === 'analyze' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Referenzen analysieren
              </button>
              <button
                type="button"
                onClick={handleFetchMemory}
                disabled={busy !== null}
                className={`${actionButtonClass} border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-cyan-700`}
              >
                {busy === 'memory' ? <Loader2 size={14} className="animate-spin" /> : null}
                Foundry IQ Memory abrufen
              </button>
              <button
                type="button"
                onClick={handleGenerateConcept}
                disabled={busy !== null}
                className={`${actionButtonClass} border border-amber-700 bg-amber-950/40 text-amber-200 hover:border-amber-500`}
              >
                {busy === 'concept' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Neues Konzept generieren
              </button>
              {concept && (
                <>
                  <button
                    type="button"
                    onClick={handleSaveMemory}
                    disabled={busy !== null}
                    className={`${actionButtonClass} border border-emerald-700 bg-emerald-950/40 text-emerald-200 hover:border-emerald-500`}
                  >
                    {busy === 'memorywrite' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    In Memory speichern
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className={`${actionButtonClass} border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-cyan-700`}
                  >
                    Export JSON
                  </button>
                </>
              )}
            </div>

            {analysis && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
                <p className="font-semibold text-zinc-100">Referenzanalyse</p>
                <p className="text-zinc-400">{analysis.summary}</p>
                {analysis.warnings.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-[11px] text-amber-400">
                    {analysis.warnings.slice(0, 4).map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <FoundryIqMemoryPanel memory={memory} />
            <ThumbnailHistoryPanel
              sessions={history}
              loading={historyLoading}
              onRefresh={() => void refreshHistory()}
              onSelect={handleSelectSession}
            />
          </div>

          <div className="space-y-6">
            <ThumbnailPreviewPanel
              background={background}
              render={render}
              backgroundConfigured={Boolean(health?.azureImageConfigured)}
              uploadedBackground={uploadedBackground}
              generatingBackground={busy === 'background'}
              rendering={busy === 'render'}
              canRender={Boolean(concept)}
              onGenerateBackground={handleGenerateBackground}
              onUploadBackground={setUploadedBackground}
              onRender={handleRender}
            />
            <ThumbnailConceptPanel concept={concept} />
          </div>
        </div>

        <footer className="border-t border-zinc-900 pt-6 text-[11px] text-zinc-600">
          To add a session to Foundry IQ long-term memory, run <span className="font-mono text-zinc-400">scripts/sync-thumbnail-memory.ps1</span> from the repo root.
        </footer>
      </main>
    </div>
  );
}
