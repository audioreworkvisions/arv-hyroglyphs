import { ItemFeedback } from './feedbackDB';
import { LibraryItem } from './libraryDB';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface TagScore {
  tag: string;
  score: number;
  count: number;
}

export interface StyleProfile {
  totalFeedback: number;
  avgRating: number;
  topLikes: TagScore[];
  topDislikes: TagScore[];
  wantMoreThemes: string[];
  wantLessThemes: string[];
  recentComments: string[];
  /** Ready-to-inject suffix for prompts */
  promptContext: string;
  lastUpdated: number;
}

// ─── TAG VOCABULARY ───────────────────────────────────────────────────────────

export const LIKE_TAGS = [
  'Farben', 'Geometrie', 'Motion', 'Stimmung', 'Tempo',
  'Komposition', 'Atmosphäre', 'Charakter', 'Kontrast', 'Textur',
  'Narration', 'Pacing',
];

export const QUALITY_ADJUSTMENTS = [
  'Dunkler', 'Heller', 'Langsamer', 'Schneller',
  'Minimalistischer', 'Detaillierter', 'Geometrischer', 'Organischer',
  'Abstrakter', 'Konkreter', 'Dramatischer', 'Ruhiger',
  'Mehr Glitch', 'Mehr Charakter', 'Kosmischer', 'Bürokratischer',
];

// ─── PROFILE BUILDER ─────────────────────────────────────────────────────────

function aggregateTags(
  feedbacks: ItemFeedback[],
  field: 'likeTags' | 'dislikeTags',
): TagScore[] {
  const map = new Map<string, { score: number; count: number }>();
  for (const f of feedbacks) {
    const weight = field === 'dislikeTags' ? (6 - f.rating) : f.rating;
    for (const tag of f[field]) {
      const prev = map.get(tag) ?? { score: 0, count: 0 };
      map.set(tag, { score: prev.score + weight, count: prev.count + 1 });
    }
  }
  return [...map.entries()]
    .map(([tag, { score, count }]) => ({ tag, score, count }))
    .sort((a, b) => b.score - a.score);
}

function aggregateThemes(
  feedbacks: ItemFeedback[],
  field: 'wantMore' | 'wantLess',
): string[] {
  const map = new Map<string, number>();
  for (const f of feedbacks) {
    for (const t of f[field]) map.set(t, (map.get(t) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map((e) => e[0]);
}

function buildPromptContext(profile: Omit<StyleProfile, 'promptContext' | 'lastUpdated' | 'totalFeedback'>): string {
  const parts: string[] = [];
  if (profile.topLikes.length > 0)
    parts.push(`Can lean toward: ${profile.topLikes.slice(0, 3).map((t) => t.tag).join(', ')}`);
  if (profile.wantMoreThemes.length > 0)
    parts.push(`Explore more of: ${profile.wantMoreThemes.slice(0, 3).join(', ')}`);
  if (profile.wantLessThemes.length > 0)
    parts.push(`Use less of: ${profile.wantLessThemes.slice(0, 2).join(', ')}`);
  if (profile.topDislikes.length > 0)
    parts.push(`Deprioritize: ${profile.topDislikes.slice(0, 3).map((t) => t.tag).join(', ')}`);
  if (parts.length === 0) return '';
  return (
    `\n\n[USER STYLE PROFILE · ${profile.avgRating.toFixed(1)}/5 avg]\n` +
    `Treat these as soft tendencies, not fixed rules. Keep surprise, contrast, and novelty available.\n` +
    parts.join('\n')
  );
}

export function buildStyleProfile(feedbacks: ItemFeedback[]): StyleProfile {
  if (feedbacks.length === 0) {
    return {
      totalFeedback: 0,
      avgRating: 0,
      topLikes: [],
      topDislikes: [],
      wantMoreThemes: [],
      wantLessThemes: [],
      recentComments: [],
      promptContext: '',
      lastUpdated: Date.now(),
    };
  }

  const avgRating = feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length;
  const topLikes = aggregateTags(feedbacks, 'likeTags').slice(0, 8);
  const topDislikes = aggregateTags(feedbacks, 'dislikeTags').slice(0, 6);
  const wantMoreThemes = aggregateThemes(feedbacks, 'wantMore');
  const wantLessThemes = aggregateThemes(feedbacks, 'wantLess');
  const recentComments = feedbacks
    .filter((f) => f.comment.trim().length > 5)
    .slice(0, 5)
    .map((f) => f.comment.trim());

  const partial = { avgRating, topLikes, topDislikes, wantMoreThemes, wantLessThemes, recentComments };
  const promptContext = buildPromptContext(partial);

  return {
    totalFeedback: feedbacks.length,
    ...partial,
    promptContext,
    lastUpdated: Date.now(),
  };
}

// ─── FOLLOW-UP CONCEPT ────────────────────────────────────────────────────────

export function generateFollowUpConcept(item: LibraryItem, profile: StyleProfile): string {
  const base =
    item.type === 'story'
      ? `Fortsetzung von: "${item.title}" — ${item.prompt}`
      : item.type === 'ideas'
        ? `Neue Ausarbeitung aus Ideenpack: "${item.title}" — ${item.prompt.slice(0, 120)}`
      : `Visuelle Weiterentwicklung von: ${item.prompt.slice(0, 80)}`;
  const more = profile.wantMoreThemes.slice(0, 3).join(', ');
  const less = profile.wantLessThemes.slice(0, 2).join(', ');
  let concept = base;
  if (more) concept += ` · mit mehr ${more}`;
  if (less) concept += ` · weniger ${less}`;
  if (profile.topLikes.length > 0)
    concept += ` · Stärke: ${profile.topLikes.slice(0, 2).map((t) => t.tag).join(', ')}`;
  return concept;
}

// ─── RATING LABEL ────────────────────────────────────────────────────────────

export const RATING_LABELS: Record<number, { emoji: string; label: string; color: string }> = {
  1: { emoji: '💀', label: 'Nicht meins', color: 'text-zinc-500' },
  2: { emoji: '😐', label: 'Geht so', color: 'text-stone-400' },
  3: { emoji: '🙂', label: 'Solide', color: 'text-amber-400' },
  4: { emoji: '✨', label: 'Gut!', color: 'text-indigo-400' },
  5: { emoji: '🔥', label: 'Perfekt!', color: 'text-rose-400' },
};
