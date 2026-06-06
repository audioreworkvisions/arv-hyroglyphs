import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, Download, Loader2, Shuffle, X } from 'lucide-react';

type DemoStatus = 'idle' | 'writing' | 'rendering' | 'converting' | 'done' | 'error';

interface RandomVideoResponse {
  success?: boolean;
  prompt?: string;
  videoUrl?: string;
  videoBase64?: string;
  seconds?: number;
  error?: string;
}

interface ConvertGifResponse {
  gifData?: string;
  error?: string;
}

const STATUS_LABEL: Record<DemoStatus, string> = {
  idle: 'Bereit',
  writing: 'Prompt wird geschrieben…',
  rendering: 'Sora rendert Video…',
  converting: 'GIF wird erstellt…',
  done: 'Fertig',
  error: 'Fehler',
};

const dataUrlToObjectUrl = (dataUrl: string): string => {
  if (!dataUrl.startsWith('data:')) {
    return dataUrl;
  }
  const [header, payload] = dataUrl.split(',');
  const mimeType = header.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream';
  const binary = window.atob(payload || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
};

/**
 * Floating "Demo Video" button: lets Sora write its own random text-to-video
 * prompt, renders the clip, and converts it to a downloadable GIF.
 */
export default function RandomVideoGenerator() {
  const abortRef = useRef<AbortController | null>(null);
  const gifUrlRef = useRef<string | null>(null);

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DemoStatus>('idle');
  const [prompt, setPrompt] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearGif = useCallback(() => {
    if (gifUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(gifUrlRef.current);
    }
    gifUrlRef.current = null;
    setGifUrl(null);
  }, []);

  const runGeneration = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    clearGif();
    setPrompt(null);
    setErrorMessage(null);
    setStatus('writing');

    try {
      const videoRes = await fetch('/api/stillframe/random-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds: 4 }),
        signal: controller.signal,
      });

      // The model writes the prompt server-side; by the time we get a response
      // the clip is already rendered, so reflect the rendering stage meanwhile.
      setStatus('rendering');

      const videoData = (await videoRes.json()) as RandomVideoResponse;
      if (!videoRes.ok || !videoData.success) {
        throw new Error(videoData.error || 'Video-Generierung fehlgeschlagen.');
      }
      if (controller.signal.aborted) {
        return;
      }

      setPrompt(videoData.prompt ?? null);

      if (!videoData.videoUrl && !videoData.videoBase64) {
        throw new Error('Sora lieferte kein abspielbares Video zurück.');
      }

      setStatus('converting');
      const gifRes = await fetch('/api/convert-gif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(videoData.videoBase64
            ? { videoBase64: videoData.videoBase64 }
            : { videoUrl: videoData.videoUrl }),
          aspectRatio: '1:1',
          outputSize: 480,
        }),
        signal: controller.signal,
      });

      const gifData = (await gifRes.json()) as ConvertGifResponse;
      if (!gifRes.ok || !gifData.gifData) {
        throw new Error(gifData.error || 'GIF-Konvertierung fehlgeschlagen.');
      }
      if (controller.signal.aborted) {
        return;
      }

      const objectUrl = dataUrlToObjectUrl(gifData.gifData);
      gifUrlRef.current = objectUrl;
      setGifUrl(objectUrl);
      setStatus('done');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('Random video generation failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unbekannter Fehler.');
      setStatus('error');
    }
  }, [clearGif]);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
  }, []);

  const handleDownload = useCallback(() => {
    if (!gifUrlRef.current) {
      return;
    }
    const link = document.createElement('a');
    link.href = gifUrlRef.current;
    link.download = `arv-sora-demo-${Date.now()}.gif`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  useEffect(() => {
    if (open && status === 'idle') {
      void runGeneration();
    }
  }, [open, status, runGeneration]);

  useEffect(() => () => {
    abortRef.current?.abort();
    clearGif();
  }, [clearGif]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-44 z-40 inline-flex items-center gap-2 rounded-xl border border-fuchsia-300 bg-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-fuchsia-500 dark:border-fuchsia-500/60 dark:bg-fuchsia-600 dark:hover:bg-fuchsia-500"
        title="Zufälliges Sora-Video als GIF generieren"
      >
        <Clapperboard size={16} />
        Demo-Video
      </button>
    );
  }

  const isBusy = status === 'writing' || status === 'rendering' || status === 'converting';

  return (
    <div className="fixed bottom-6 left-6 z-40 w-[340px] max-w-[calc(100vw-3rem)] rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-800 dark:text-stone-100">
          <Clapperboard size={16} className="text-fuchsia-500" />
          Demo-Video (Sora)
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg border border-stone-200 bg-white p-1.5 text-stone-500 transition hover:text-stone-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-stone-400 dark:hover:text-stone-100"
          title="Schließen"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-black dark:border-zinc-800">
        <div className="relative aspect-square w-full">
          {gifUrl && status === 'done' ? (
            <img src={gifUrl} alt="Generiertes Sora Demo-GIF" className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center text-white">
              {isBusy ? <Loader2 size={22} className="animate-spin" /> : <Clapperboard size={22} className="opacity-60" />}
              <span className="text-xs font-medium">{STATUS_LABEL[status]}</span>
              {status === 'rendering' && (
                <span className="text-[10px] text-white/60">Sora kann ~1–2 Minuten brauchen.</span>
              )}
            </div>
          )}
        </div>
      </div>

      {prompt && (
        <div className="mt-2 max-h-24 overflow-y-auto rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] leading-relaxed text-stone-600 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-stone-400">
          {prompt}
        </div>
      )}

      {errorMessage && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void runGeneration()}
          disabled={isBusy}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? <Loader2 size={15} className="animate-spin" /> : <Shuffle size={15} />}
          {isBusy ? 'Läuft…' : 'Neue Szene'}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={status !== 'done' || !gifUrl}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-stone-200"
          title="GIF herunterladen"
        >
          <Download size={15} />
        </button>
      </div>
    </div>
  );
}
