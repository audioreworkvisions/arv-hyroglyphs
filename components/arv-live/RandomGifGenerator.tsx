import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, Shuffle, Sparkles, X } from 'lucide-react';
import {
  generateRandomSceneGif,
  pickRandomScenePreset,
  type RandomSceneGifResult,
} from '../../lib/arv-live/randomSceneGif';

type DemoStatus = 'idle' | 'rendering' | 'done' | 'error';

const GIF_WIDTH = 480;
const GIF_HEIGHT = 480;

const sanitizeFileName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'arv-scene';

/**
 * Floating "Demo Mode" button: renders a random ARV scene and exports it as a GIF.
 */
export default function RandomGifGenerator() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<RandomSceneGifResult | null>(null);
  const lastPresetIdRef = useRef<string | null>(null);

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DemoStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [presetTitle, setPresetTitle] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearResult = useCallback(() => {
    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current.url);
      resultRef.current = null;
    }
    setGifUrl(null);
  }, []);

  const runGeneration = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    clearResult();
    setStatus('rendering');
    setProgress(0);
    setErrorMessage(null);

    const preset = pickRandomScenePreset(lastPresetIdRef.current ?? undefined);
    lastPresetIdRef.current = preset.id;
    setPresetTitle(preset.title);

    try {
      const result = await generateRandomSceneGif({
        canvas,
        preset,
        width: GIF_WIDTH,
        height: GIF_HEIGHT,
        durationSeconds: 3,
        fps: 12,
        signal: controller.signal,
        onProgress: (ratio) => setProgress(ratio),
      });

      if (controller.signal.aborted) {
        URL.revokeObjectURL(result.url);
        return;
      }

      resultRef.current = result;
      setGifUrl(result.url);
      setPresetTitle(result.preset.title);
      setStatus('done');
      setProgress(1);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('Random scene GIF generation failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unbekannter Fehler beim Rendern.');
      setStatus('error');
    }
  }, [clearResult]);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
  }, []);

  const handleDownload = useCallback(() => {
    const result = resultRef.current;
    if (!result) {
      return;
    }
    const link = document.createElement('a');
    link.href = result.url;
    link.download = `${sanitizeFileName(result.preset.title)}-demo.gif`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Auto-start a render when the panel opens for the first time.
  useEffect(() => {
    if (open && status === 'idle') {
      void runGeneration();
    }
  }, [open, status, runGeneration]);

  useEffect(() => () => {
    abortRef.current?.abort();
    clearResult();
  }, [clearResult]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="fixed bottom-6 left-6 z-40 inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500 dark:border-indigo-500/60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
        title="Zufällige Szene als GIF generieren"
      >
        <Sparkles size={16} />
        Demo-GIF
      </button>
    );
  }

  const isRendering = status === 'rendering';
  const progressPercent = Math.round(progress * 100);

  return (
    <div className="fixed bottom-6 left-6 z-40 w-[320px] max-w-[calc(100vw-3rem)] rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-800 dark:text-stone-100">
          <Sparkles size={16} className="text-indigo-500" />
          Demo-GIF Generator
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
          <canvas
            ref={canvasRef}
            className={`h-full w-full ${gifUrl && status === 'done' ? 'hidden' : 'block'}`}
          />
          {gifUrl && status === 'done' && (
            <img src={gifUrl} alt="Generiertes Demo-GIF" className="h-full w-full object-cover" />
          )}
          {isRendering && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 text-white">
              <Loader2 size={22} className="animate-spin" />
              <span className="text-xs font-medium">Rendere… {progressPercent}%</span>
            </div>
          )}
        </div>
      </div>

      {presetTitle && (
        <div className="mt-2 truncate font-mono text-[11px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
          {presetTitle}
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
          disabled={isRendering}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRendering ? <Loader2 size={15} className="animate-spin" /> : <Shuffle size={15} />}
          {isRendering ? 'Läuft…' : 'Zufällige Szene'}
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
