import React, { useCallback, useRef } from 'react';
import { Download, Image as ImageIcon, Loader2, Upload, Wand2 } from 'lucide-react';
import type { ThumbnailBackgroundResult, ThumbnailRenderResult } from '../../lib/thumbnailTypes';

interface ThumbnailPreviewPanelProps {
  background: ThumbnailBackgroundResult | null;
  render: ThumbnailRenderResult | null;
  backgroundConfigured: boolean;
  uploadedBackground: string | null;
  generatingBackground: boolean;
  rendering: boolean;
  canRender: boolean;
  onGenerateBackground: () => void;
  onUploadBackground: (dataUrl: string) => void;
  onRender: () => void;
}

const activeBackgroundDataUrl = (
  uploadedBackground: string | null,
  background: ThumbnailBackgroundResult | null,
): string | null => uploadedBackground || background?.imageDataUrl || null;

export default function ThumbnailPreviewPanel({
  background,
  render,
  backgroundConfigured,
  uploadedBackground,
  generatingBackground,
  rendering,
  canRender,
  onGenerateBackground,
  onUploadBackground,
  onRender,
}: ThumbnailPreviewPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgPreview = activeBackgroundDataUrl(uploadedBackground, background);

  const handleFile = useCallback(
    (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onUploadBackground(String(reader.result));
      reader.readAsDataURL(file);
    },
    [onUploadBackground],
  );

  const handleDownload = useCallback(() => {
    if (!render) return;
    const link = document.createElement('a');
    link.href = render.imageDataUrl;
    link.download = render.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [render]);

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-center gap-2">
        <ImageIcon size={18} className="text-cyan-400" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-200">Thumbnail Preview</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGenerateBackground}
          disabled={generatingBackground || !backgroundConfigured}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-cyan-700 disabled:cursor-not-allowed disabled:opacity-40"
          title={backgroundConfigured ? 'Finales Thumbnail mit einfachem Titel über Azure generieren' : 'Azure Image Generation nicht konfiguriert'}
        >
          {generatingBackground ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Thumbnail mit Titel generieren
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-cyan-700"
        >
          <Upload size={14} />
          Eigenes Bild hochladen
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => handleFile(event.target.files)}
        />
        <button
          type="button"
          onClick={onRender}
          disabled={rendering || !canRender}
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-700 bg-cyan-950/50 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {rendering ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
          Thumbnail exportieren
        </button>
        {render && (
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-500"
          >
            <Download size={14} />
            Export PNG
          </button>
        )}
      </div>

      {!backgroundConfigured && (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          background generation unavailable — Azure image generation is not configured. Upload your own background instead.
        </p>
      )}

      {background?.note && background.provider !== 'foundry' && backgroundConfigured && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">{background.note}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        {render ? (
          <img src={render.imageDataUrl} alt="Rendered thumbnail" className="aspect-video w-full object-cover" />
        ) : bgPreview ? (
          <img src={bgPreview} alt="Background preview" className="aspect-video w-full object-cover opacity-80" />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center text-sm text-zinc-600">
            Noch kein Thumbnail gerendert
          </div>
        )}
      </div>

      {render && (
        <p className="text-[11px] text-zinc-500">
          {render.width}×{render.height} {render.format.toUpperCase()} · gespeichert als <span className="font-mono text-zinc-400">{render.fileName}</span>
        </p>
      )}
    </section>
  );
}
