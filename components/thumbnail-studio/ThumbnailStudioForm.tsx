import React, { useCallback, useRef } from 'react';
import { Upload, X } from 'lucide-react';
import {
  THUMBNAIL_GENRES,
  THUMBNAIL_MODES,
  THUMBNAIL_MOODS,
  type ThumbnailMode,
  type ThumbnailUploadedImage,
} from '../../lib/thumbnailTypes';

const MODE_LABELS: Record<ThumbnailMode, string> = {
  'background-only': 'Background only',
  'title-only-banner': 'Title-only banner',
  'full-youtube-thumbnail': 'Full YouTube thumbnail',
  'final-composed-thumbnail': 'Final composed thumbnail',
};

export interface ThumbnailFormState {
  title: string;
  theme: string;
  genre: string;
  mood: string[];
  streamNumber: string;
  variantCount: number;
  thumbnailMode: ThumbnailMode;
  folderPath: string;
  useFoundryIq: boolean;
}

interface ThumbnailStudioFormProps {
  state: ThumbnailFormState;
  uploads: ThumbnailUploadedImage[];
  busy: boolean;
  onChange: (patch: Partial<ThumbnailFormState>) => void;
  onUploadsChange: (uploads: ThumbnailUploadedImage[]) => void;
}

const fileToDataUrl = (file: File): Promise<ThumbnailUploadedImage> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ fileName: file.name, dataUrl: String(reader.result) });
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });

const fieldClass =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-600';
const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400';

export default function ThumbnailStudioForm({
  state,
  uploads,
  busy,
  onChange,
  onUploadsChange,
}: ThumbnailStudioFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) {
        return;
      }
      const accepted = Array.from(fileList).filter((file) => /image\/(png|jpe?g|webp)/i.test(file.type));
      const decoded = await Promise.all(accepted.map((file) => fileToDataUrl(file).catch(() => null)));
      const next = decoded.filter((entry): entry is ThumbnailUploadedImage => Boolean(entry));
      onUploadsChange([...uploads, ...next].slice(0, 80));
    },
    [onUploadsChange, uploads],
  );

  const toggleMood = useCallback(
    (mood: string) => {
      const active = state.mood.includes(mood);
      onChange({ mood: active ? state.mood.filter((entry) => entry !== mood) : [...state.mood, mood] });
    },
    [onChange, state.mood],
  );

  return (
    <div className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className={labelClass}>Haupttitel (optional)</span>
          <input
            className={fieldClass}
            value={state.title}
            placeholder="z.B. RHYTHM AGAINST THE MACHINE"
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>
        <label className="space-y-1.5">
          <span className={labelClass}>Streamnummer (optional)</span>
          <input
            className={fieldClass}
            value={state.streamNumber}
            placeholder="z.B. 029"
            onChange={(event) => onChange({ streamNumber: event.target.value })}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className={labelClass}>Thema / Konzept (optional)</span>
        <textarea
          className={`${fieldClass} min-h-[64px] resize-y`}
          value={state.theme}
          placeholder="z.B. Machine resistance, underground rhythm, analog broadcast ritual"
          onChange={(event) => onChange({ theme: event.target.value })}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className={labelClass}>Genre / Vibe</span>
          <select
            className={fieldClass}
            value={state.genre}
            onChange={(event) => onChange({ genre: event.target.value })}
          >
            {THUMBNAIL_GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className={labelClass}>Thumbnail-Modus</span>
          <select
            className={fieldClass}
            value={state.thumbnailMode}
            onChange={(event) => onChange({ thumbnailMode: event.target.value as ThumbnailMode })}
          >
            {THUMBNAIL_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <span className={labelClass}>Stimmung</span>
        <div className="flex flex-wrap gap-2">
          {THUMBNAIL_MOODS.map((mood) => {
            const active = state.mood.includes(mood);
            return (
              <button
                key={mood}
                type="button"
                onClick={() => toggleMood(mood)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'border-cyan-600 bg-cyan-950/50 text-cyan-300'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {mood}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className={labelClass}>Anzahl Titelvarianten</span>
          <input
            type="number"
            min={3}
            max={20}
            className={fieldClass}
            value={state.variantCount}
            onChange={(event) => onChange({ variantCount: Number(event.target.value) || 10 })}
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            checked={state.useFoundryIq}
            onChange={(event) => onChange({ useFoundryIq: event.target.checked })}
            className="h-4 w-4 accent-cyan-500"
          />
          <span className="text-sm text-zinc-300">Foundry IQ Creative Memory nutzen</span>
        </label>
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <span className={labelClass}>Referenzquellen</span>
        <label className="block space-y-1.5">
          <span className="text-xs text-zinc-500">Serverseitiger Ordnerpfad (nur lokale Entwicklung)</span>
          <input
            className={fieldClass}
            value={state.folderPath}
            placeholder="z.B. ARV/THUMBNAILS_DEMOS"
            onChange={(event) => onChange({ folderPath: event.target.value })}
          />
        </label>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleFiles(event.dataTransfer.files);
          }}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 px-4 py-6 text-center"
        >
          <Upload size={18} className="text-zinc-500" />
          <p className="text-xs text-zinc-400">Thumbnails hierher ziehen oder auswählen (PNG / JPG / WEBP)</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-cyan-700 disabled:opacity-40"
          >
            Dateien auswählen
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={(event) => void handleFiles(event.target.files)}
          />
        </div>

        {uploads.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {uploads.map((upload, index) => (
              <span
                key={`${upload.fileName}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300"
              >
                {upload.fileName}
                <button
                  type="button"
                  onClick={() => onUploadsChange(uploads.filter((_, i) => i !== index))}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
