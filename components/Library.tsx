import React, { useState } from 'react';
import { Trash2, Download, Film, ImagePlus, ChevronDown, ChevronUp, BookOpen, AlertTriangle, MessageSquare, Star, Copy, CheckCircle2, Sparkles } from 'lucide-react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { LibraryItem, LibraryGifItem, LibraryIdeaItem, LibraryStoryItem } from '../lib/libraryDB';
import { ItemFeedback } from '../lib/feedbackDB';
import { StyleProfile, RATING_LABELS } from '../lib/styleMemory';
import FeedbackPanel from './FeedbackPanel';

interface LibraryProps {
  items: LibraryItem[];
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onRemixIdeaPack: (item: LibraryIdeaItem) => void;
  onSubmitFeedback: (feedback: ItemFeedback) => Promise<void>;
  onFollowUp: (concept: string) => void;
  getFeedbackFor: (itemId: string) => ItemFeedback | undefined;
  styleProfile: StyleProfile | null;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

function RatingBadge({ feedback }: { feedback: ItemFeedback }) {
  const { emoji, color } = RATING_LABELS[feedback.rating];
  return (
    <span className={`text-base leading-none ${color}`} title={`Bewertung: ${feedback.rating}/5`}>
      {emoji}
    </span>
  );
}

function GifCard({
  item,
  onDelete,
  existingFeedback,
  styleProfile,
  onSubmitFeedback,
  onFollowUp,
}: {
  item: LibraryGifItem;
  onDelete: () => void;
  existingFeedback?: ItemFeedback;
  styleProfile: StyleProfile | null;
  onSubmitFeedback: (f: ItemFeedback) => Promise<void>;
  onFollowUp: (concept: string) => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);

  const handleDownload = () => {
    saveAs(item.gifData, `hyroglyph_${item.id.slice(-6)}.gif`);
  };

  return (
    <div className="group relative bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-video bg-stone-100 dark:bg-zinc-950 flex items-center justify-center overflow-hidden">
        <img
          src={item.gifData}
          alt={item.prompt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
              <ImagePlus size={11} />
              {item.model.toUpperCase()}
            </span>
            {existingFeedback && <RatingBadge feedback={existingFeedback} />}
          </div>
          <span className="text-xs text-stone-400 dark:text-stone-500">{formatDate(item.createdAt)}</span>
        </div>
        <p className="text-sm text-stone-700 dark:text-stone-300 line-clamp-2 leading-snug">{item.prompt}</p>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors"
          >
            <Download size={14} />
            Download
          </button>
          <button
            onClick={() => setShowFeedback((v) => !v)}
            className={`p-2 rounded-lg transition-colors ${
              showFeedback
                ? 'text-indigo-400 bg-indigo-900/20'
                : 'text-stone-400 hover:text-indigo-400 hover:bg-indigo-900/20'
            }`}
            title="Feedback geben"
          >
            <MessageSquare size={15} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Löschen"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {showFeedback && (
        <FeedbackPanel
          item={item}
          existingFeedback={existingFeedback}
          styleProfile={styleProfile}
          onSubmit={onSubmitFeedback}
          onFollowUp={onFollowUp}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}

function StoryCard({
  item,
  onDelete,
  existingFeedback,
  styleProfile,
  onSubmitFeedback,
  onFollowUp,
}: {
  item: LibraryStoryItem;
  onDelete: () => void;
  existingFeedback?: ItemFeedback;
  styleProfile: StyleProfile | null;
  onSubmitFeedback: (f: ItemFeedback) => Promise<void>;
  onFollowUp: (concept: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const completedScenes = item.scenes.filter((s) => s.gifData);
  const firstThumb = item.scenes.find((s) => s.gifData);

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    const safeName = item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'story';
    item.scenes.forEach((scene, i) => {
      if (scene.gifData) {
        const base64Data = scene.gifData.split(',')[1];
        zip.file(`${safeName}_scene_${i + 1}.gif`, base64Data, { base64: true });
      }
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${safeName}.zip`);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-video bg-stone-100 dark:bg-zinc-950 flex items-center justify-center overflow-hidden relative">
        {firstThumb ? (
          <img
            src={firstThumb.gifData}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Film size={40} className="text-stone-300 dark:text-zinc-700" />
        )}
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {completedScenes.length}/{item.scenes.length} Szenen
        </div>
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
              <Film size={11} />
              Story · {item.model.toUpperCase()}
            </span>
            {existingFeedback && <RatingBadge feedback={existingFeedback} />}
          </div>
          <span className="text-xs text-stone-400 dark:text-stone-500">{formatDate(item.createdAt)}</span>
        </div>
        <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 leading-snug">{item.title}</p>
        <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2">{item.prompt}</p>

        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Szenen verbergen' : 'Szenen anzeigen'}
        </button>

        {expanded && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {item.scenes.map((scene, i) =>
              scene.gifData ? (
                <div key={i} className="relative rounded-lg overflow-hidden bg-stone-100 dark:bg-zinc-950">
                  <img src={scene.gifData} alt={`Szene ${i + 1}`} className="w-full object-cover" loading="lazy" />
                  <span className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1.5 rounded-full">
                    {i + 1}
                  </span>
                  <button
                    onClick={() => scene.gifData && saveAs(scene.gifData, `scene_${i + 1}.gif`)}
                    className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full transition-colors"
                    title="Herunterladen"
                  >
                    <Download size={11} />
                  </button>
                </div>
              ) : (
                <div
                  key={i}
                  className="aspect-video rounded-lg bg-stone-100 dark:bg-zinc-950 flex items-center justify-center text-stone-400 dark:text-stone-600 text-xs"
                >
                  Szene {i + 1}
                </div>
              )
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          {completedScenes.length > 0 && (
            <button
              onClick={handleDownloadZip}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors"
            >
              <Download size={14} />
              ZIP Download
            </button>
          )}
          <button
            onClick={() => setShowFeedback((v) => !v)}
            className={`p-2 rounded-lg transition-colors ${
              showFeedback
                ? 'text-indigo-400 bg-indigo-900/20'
                : 'text-stone-400 hover:text-indigo-400 hover:bg-indigo-900/20'
            }`}
            title="Feedback geben"
          >
            <MessageSquare size={15} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Löschen"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {showFeedback && (
        <FeedbackPanel
          item={item}
          existingFeedback={existingFeedback}
          styleProfile={styleProfile}
          onSubmit={onSubmitFeedback}
          onFollowUp={onFollowUp}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}

function IdeaPackCard({
  item,
  onDelete,
  onRemixIdeaPack,
}: {
  item: LibraryIdeaItem;
  onDelete: () => void;
  onRemixIdeaPack: (item: LibraryIdeaItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyText(item.clipboardText);
    if (!success) {
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const blob = new Blob([item.clipboardText], { type: 'text/plain;charset=utf-8' });
    const safeName = item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'ideas_pack';
    saveAs(blob, `${safeName}.txt`);
  };

  const sections: Array<{ label: string; items: string[] }> = [
    { label: 'Themen', items: item.themes },
    { label: 'Charaktere', items: item.characters },
    { label: 'Ereignisse', items: item.events },
    { label: 'Handlungen', items: item.actions },
    { label: 'Geschichten', items: item.stories },
    { label: 'Styles', items: item.styles },
    { label: 'Prompt Seeds', items: item.promptSeeds },
    { label: 'Preset Seeds', items: item.presetSeeds },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="aspect-video bg-[radial-gradient(circle_at_top,rgba(120,80,220,0.18),transparent_58%),linear-gradient(180deg,rgba(26,18,40,0.95),rgba(10,12,20,1))] border-b border-stone-200 dark:border-zinc-800 p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300">
            <Sparkles size={11} />
            Ideenpack · {item.mode === 'satire' ? 'Satire' : 'Ritual'}
          </span>
          <span className="text-xs text-stone-300 dark:text-zinc-500">{formatDate(item.createdAt)}</span>
        </div>

        <div className="space-y-2">
          <div className="text-lg font-semibold text-white leading-snug">{item.title}</div>
          <p className="text-sm text-fuchsia-100/85 line-clamp-3 leading-relaxed">{item.prompt}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-fuchsia-100/80">
          <span>{item.visions.length} Vision Cards</span>
          <span>·</span>
          <span>{item.promptSeeds.length} Prompt Seeds</span>
          <span>·</span>
          <span>{item.presetSeeds.length} Preset Seeds</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-stone-500 dark:text-stone-400">
            {item.seed ? <>Seed: <span className="font-medium text-stone-700 dark:text-stone-200">{item.seed}</span></> : 'Kein expliziter Seed gespeichert'}
          </div>
          <button
            onClick={() => setExpanded((value) => !value)}
            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Details verbergen' : 'Details anzeigen'}
          </button>
        </div>

        {item.referenceSummary && (
          <div className="rounded-xl bg-stone-50 dark:bg-zinc-950 px-3 py-2 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
            Referenz-DNA: {item.referenceSummary}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onRemixIdeaPack(item)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-fuchsia-500"
          >
            <Sparkles size={14} />
            Remix
          </button>
          <span className="text-xs text-stone-500 dark:text-stone-400">Startet in Stillframe direkt eine neue Variantenrunde aus diesem Pack.</span>
        </div>

        {expanded && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {sections.map((section) => (
                <div key={section.label} className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 p-3 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">{section.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {section.items.length > 0 ? section.items.map((entry, index) => (
                      <span key={`${section.label}-${index}`} className="inline-flex rounded-full bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 px-2 py-1 text-[11px] text-stone-700 dark:text-stone-300">
                        {entry}
                      </span>
                    )) : (
                      <span className="text-xs text-stone-400 dark:text-stone-500">Keine Eintraege</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {item.visions.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Vision Cards</div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {item.visions.map((vision, index) => (
                    <div key={`${vision.title}-${index}`} className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 p-3 space-y-2">
                      <div className="font-medium text-stone-800 dark:text-stone-200">{vision.title}</div>
                      <div className="text-xs leading-relaxed text-stone-600 dark:text-stone-400">{vision.story}</div>
                      <div className="text-[11px] text-indigo-600 dark:text-indigo-400">Prompt: {vision.promptSeed}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => void handleCopy()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors"
          >
            {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? 'Kopiert' : 'Pack kopieren'}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-sm font-medium transition-colors"
          >
            <Download size={14} />
            TXT Download
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Löschen"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Library({ items, onDelete, onClearAll, onRemixIdeaPack, onSubmitFeedback, onFollowUp, getFeedbackFor, styleProfile }: LibraryProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  const gifItems = items.filter((i): i is LibraryGifItem => i.type === 'gif');
  const storyItems = items.filter((i): i is LibraryStoryItem => i.type === 'story');
  const ideaItems = items.filter((i): i is LibraryIdeaItem => i.type === 'ideas');

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-stone-400 dark:text-stone-600">
        <BookOpen size={56} className="mb-4 opacity-40" />
        <p className="text-lg font-medium">Bibliothek ist leer</p>
        <p className="text-sm mt-1">Generierte GIFs, Stories und Ideenpacks werden hier automatisch gespeichert.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bibliothek</h2>
          <p className="text-stone-500 dark:text-stone-400 mt-1">
            {items.length} gespeicherte{items.length !== 1 ? '' : 's'} Ergebnis{items.length !== 1 ? 'se' : ''}
            {styleProfile && styleProfile.totalFeedback > 0 && (
              <span className="ml-3 text-indigo-400 font-mono text-xs">
                · Stil-Profil aktiv: {styleProfile.totalFeedback} Bewertungen · ∅ {styleProfile.avgRating.toFixed(1)}/5
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {confirmClear ? (
            <>
              <span className="text-sm text-red-500 font-medium">Wirklich alles löschen?</span>
              <button
                onClick={() => { onClearAll(); setConfirmClear(false); }}
                className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                Ja, löschen
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-3 py-1.5 rounded-lg bg-stone-200 dark:bg-zinc-800 text-sm font-medium transition-colors"
              >
                Abbrechen
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
            >
              <AlertTriangle size={14} />
              Alles löschen
            </button>
          )}
        </div>
      </div>

      {gifItems.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-stone-700 dark:text-stone-300">
            <ImagePlus size={18} />
            Single GIFs ({gifItems.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {gifItems.map((item) => (
              <GifCard
                key={item.id}
                item={item}
                onDelete={() => onDelete(item.id)}
                existingFeedback={getFeedbackFor(item.id)}
                styleProfile={styleProfile}
                onSubmitFeedback={onSubmitFeedback}
                onFollowUp={onFollowUp}
              />
            ))}
          </div>
        </section>
      )}

      {storyItems.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-stone-700 dark:text-stone-300">
            <Film size={18} />
            Stories ({storyItems.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {storyItems.map((item) => (
              <StoryCard
                key={item.id}
                item={item}
                onDelete={() => onDelete(item.id)}
                existingFeedback={getFeedbackFor(item.id)}
                styleProfile={styleProfile}
                onSubmitFeedback={onSubmitFeedback}
                onFollowUp={onFollowUp}
              />
            ))}
          </div>
        </section>
      )}

      {ideaItems.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-stone-700 dark:text-stone-300">
            <Star size={18} />
            Ideenpacks ({ideaItems.length})
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ideaItems.map((item) => (
              <IdeaPackCard
                key={item.id}
                item={item}
                onDelete={() => onDelete(item.id)}
                onRemixIdeaPack={onRemixIdeaPack}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
