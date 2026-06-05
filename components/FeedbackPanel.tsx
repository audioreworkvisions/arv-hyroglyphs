import React, { useState } from 'react';
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  TrendingDown,
  SendHorizonal,
  PlayCircle,
  X,
  CheckCircle2,
} from 'lucide-react';
import { ItemFeedback } from '../lib/feedbackDB';
import { LibraryItem } from '../lib/libraryDB';
import {
  StyleProfile,
  LIKE_TAGS,
  QUALITY_ADJUSTMENTS,
  RATING_LABELS,
  generateFollowUpConcept,
} from '../lib/styleMemory';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

// ─── RATING BUTTONS ───────────────────────────────────────────────────────────

function RatingRow({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {([1, 2, 3, 4, 5] as const).map((r) => {
        const { emoji, label, color } = RATING_LABELS[r];
        const active = value === r;
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            title={label}
            className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl border transition-all text-xs font-mono ${
              active
                ? `border-zinc-600 bg-zinc-800 ${color} ring-1 ring-current`
                : 'border-zinc-800 bg-zinc-900/50 text-stone-500 hover:border-zinc-700 hover:text-stone-300'
            }`}
          >
            <span className="text-lg leading-none">{emoji}</span>
            <span className="text-[9px] whitespace-nowrap">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── CHIP ROW ────────────────────────────────────────────────────────────────

function ChipRow({
  label,
  icon,
  chips,
  selected,
  onToggle,
  activeClass,
}: {
  label: string;
  icon: React.ReactNode;
  chips: string[];
  selected: string[];
  onToggle: (chip: string) => void;
  activeClass: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-stone-500 uppercase tracking-widest">
        {icon}
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => {
          const active = selected.includes(chip);
          return (
            <button
              key={chip}
              onClick={() => onToggle(chip)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-full border transition-all ${
                active
                  ? activeClass
                  : 'border-zinc-800 bg-zinc-900 text-stone-500 hover:border-zinc-700 hover:text-stone-300'
              }`}
            >
              {chip}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN FEEDBACK PANEL ─────────────────────────────────────────────────────

interface FeedbackPanelProps {
  item: LibraryItem;
  existingFeedback?: ItemFeedback;
  styleProfile: StyleProfile | null;
  onSubmit: (feedback: ItemFeedback) => Promise<void>;
  onFollowUp: (concept: string) => void;
  onClose: () => void;
}

export default function FeedbackPanel({
  item,
  existingFeedback,
  styleProfile,
  onSubmit,
  onFollowUp,
  onClose,
}: FeedbackPanelProps) {
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(existingFeedback?.rating ?? 3);
  const [likeTags, setLikeTags] = useState<string[]>(existingFeedback?.likeTags ?? []);
  const [dislikeTags, setDislikeTags] = useState<string[]>(existingFeedback?.dislikeTags ?? []);
  const [wantMore, setWantMore] = useState<string[]>(existingFeedback?.wantMore ?? []);
  const [wantLess, setWantLess] = useState<string[]>(existingFeedback?.wantLess ?? []);
  const [comment, setComment] = useState(existingFeedback?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    const feedback: ItemFeedback = {
      id: existingFeedback?.id ?? uid(),
      itemId: item.id,
      itemType: item.type,
      rating,
      comment: comment.trim(),
      likeTags,
      dislikeTags,
      wantMore,
      wantLess,
      originalPrompt: item.prompt,
      originalTitle: item.type === 'story' ? item.title : undefined,
      createdAt: existingFeedback?.createdAt ?? Date.now(),
    };
    await onSubmit(feedback);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleFollowUp = () => {
    if (!styleProfile) return;
    const concept = generateFollowUpConcept(item, styleProfile);
    onFollowUp(concept);
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 px-4 pb-4 pt-3 space-y-5 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-stone-300">
          <MessageSquare size={13} className="text-indigo-400" />
          Feedback & Bewertung
        </div>
        <button
          onClick={onClose}
          className="text-stone-600 hover:text-stone-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Rating */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
          Bewertung
        </div>
        <RatingRow value={rating} onChange={setRating} />
      </div>

      {/* What worked */}
      <ChipRow
        label="Was hat funktioniert?"
        icon={<ThumbsUp size={11} className="text-emerald-500" />}
        chips={LIKE_TAGS}
        selected={likeTags}
        onToggle={(c) => setLikeTags(toggleItem(likeTags, c))}
        activeClass="border-emerald-700/60 bg-emerald-950/40 text-emerald-300"
      />

      {/* What didn't work */}
      <ChipRow
        label="Was nicht?"
        icon={<ThumbsDown size={11} className="text-rose-500" />}
        chips={LIKE_TAGS}
        selected={dislikeTags}
        onToggle={(c) => setDislikeTags(toggleItem(dislikeTags, c))}
        activeClass="border-rose-700/60 bg-rose-950/40 text-rose-300"
      />

      {/* Want more */}
      <ChipRow
        label="Mehr davon beim nächsten Mal:"
        icon={<TrendingUp size={11} className="text-violet-400" />}
        chips={QUALITY_ADJUSTMENTS}
        selected={wantMore}
        onToggle={(c) => {
          setWantMore(toggleItem(wantMore, c));
          if (wantLess.includes(c)) setWantLess(wantLess.filter((x) => x !== c));
        }}
        activeClass="border-violet-700/60 bg-violet-950/40 text-violet-300"
      />

      {/* Want less */}
      <ChipRow
        label="Weniger davon:"
        icon={<TrendingDown size={11} className="text-amber-500" />}
        chips={QUALITY_ADJUSTMENTS}
        selected={wantLess}
        onToggle={(c) => {
          setWantLess(toggleItem(wantLess, c));
          if (wantMore.includes(c)) setWantMore(wantMore.filter((x) => x !== c));
        }}
        activeClass="border-amber-700/60 bg-amber-950/40 text-amber-300"
      />

      {/* Comment */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
          Kommentar (optional)
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Was gefällt dir? Was soll sich ändern? Welchen Stil möchtest du beim nächsten Mal?"
          className="w-full px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900 text-stone-200 text-xs font-mono placeholder-stone-600 focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none resize-none transition-all"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-white text-xs font-bold transition-colors"
        >
          {saved ? (
            <CheckCircle2 size={13} className="text-emerald-300" />
          ) : (
            <SendHorizonal size={13} />
          )}
          {saved ? 'Gespeichert!' : saving ? 'Speichern...' : 'Feedback speichern'}
        </button>

        {styleProfile && styleProfile.totalFeedback >= 1 && (
          <button
            onClick={handleFollowUp}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 text-xs font-bold transition-colors"
          >
            <PlayCircle size={13} />
            Folge-Story generieren →
          </button>
        )}
      </div>

      {/* Style profile hint */}
      {styleProfile && styleProfile.totalFeedback > 0 && (
        <div className="text-[9px] text-stone-600 border-t border-zinc-800/50 pt-2">
          Stil-Profil aktiv · {styleProfile.totalFeedback} Bewertungen · ∅ {styleProfile.avgRating.toFixed(1)}/5
          {styleProfile.promptContext
            ? ' · Wird bei nächster Generierung angewendet.'
            : ''}
        </div>
      )}
    </div>
  );
}
