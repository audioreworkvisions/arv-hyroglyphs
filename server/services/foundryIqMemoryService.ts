/**
 * Foundry IQ Creative Brand Memory service.
 *
 * This is the central Hackathon demo point: before generating titles / concepts,
 * the Thumbnail Studio asks Foundry IQ (via the existing server/utils/iq.ts brief
 * resolver) which curated ARV style rules, palettes, title patterns, negative
 * rules and prompt-DNA fragments are relevant. The result is surfaced verbatim to
 * the UI so the creative decision is explainable.
 *
 * Only Azure AI Foundry / Foundry IQ / Azure OpenAI are used. There is always a
 * graceful local-knowledge fallback, and an "inactive" state if nothing resolves.
 */

import type { IQSceneContext } from '../utils/iq';
import { resolveIQBrief } from '../utils/iq';
import type { FoundryIqMemoryResult, ThumbnailStudioRequest, ThumbnailStyleProfile } from '../../lib/thumbnailTypes';

const FALLBACK_NOTE_INACTIVE =
  'Foundry IQ Memory inactive — using local ARV style profile fallback.';
const FALLBACK_NOTE_LOCAL =
  'Foundry IQ remote agent not used — answered from local curated ARV knowledge base.';
const FALLBACK_NOTE_REMOTE =
  'Foundry IQ remote agent retrieved curated ARV creative brand memory.';

export interface ResolveThumbnailMemoryInput {
  title?: string;
  theme?: string;
  genre?: string;
  mood?: string[];
  referenceSummary?: string;
  styleProfile?: ThumbnailStyleProfile | null;
  useFoundryIq?: boolean;
}

const toMoodList = (mood: unknown): string[] => {
  if (!Array.isArray(mood)) {
    return [];
  }
  return mood
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
};

const buildToneLine = (genre: string | undefined, mood: string[]): string => {
  const genrePart = (genre || '').trim();
  const moodPart = mood.join(', ');
  return [genrePart, moodPart].filter(Boolean).join(' / ') || 'Raw Hardgroove Techno / dark, underground';
};

const buildInactiveResult = (query: string): FoundryIqMemoryResult => ({
  provider: 'inactive',
  usedRemote: false,
  query,
  styleRules: [],
  patterns: [],
  dramaturgy: [],
  continuity: [],
  forbidden: [],
  citations: [],
  promptBlock: '',
  fallbackNote: FALLBACK_NOTE_INACTIVE,
});

/**
 * Resolves curated creative brand memory for a thumbnail session.
 * Never throws — always returns a usable FoundryIqMemoryResult.
 */
export const resolveThumbnailCreativeMemory = async (
  input: ResolveThumbnailMemoryInput,
): Promise<FoundryIqMemoryResult> => {
  const mood = toMoodList(input.mood);
  const title = (input.title || '').trim();
  const theme = (input.theme || '').trim();
  const styleProfile = input.styleProfile || null;

  const referenceSummary =
    (input.referenceSummary || '').trim()
    || styleProfile?.summary
    || 'No reference style profile available yet.';
  const palette = styleProfile?.detectedPalettes?.join(', ') || '';

  const context: IQSceneContext = {
    mode: 'thumbnail',
    renderTarget: 'thumbnail',
    purpose: 'create',
    prompt: 'Generate ARV YouTube livestream thumbnail concept (title, theme, background prompt, exact local typography overlay).',
    storyTitle: title || 'Untitled next livestream',
    storyConcept: theme || 'No explicit theme provided',
    tone: buildToneLine(input.genre, mood),
    referenceStyleSummary: referenceSummary,
    referenceStylePalette: palette || null,
    continuityNotes:
      'Use ARV Thumbnail Studio. Generate title, theme, background prompt and exact local typography overlay. Do not copy old thumbnails. Slogan must stay PEACE LOVE TECHNO. Topline TECHNO TRANSMISSIONS.',
  };

  const query = [
    'Which curated ARV style rules, palettes and title patterns apply?',
    'Which negative rules must be respected?',
    'Which prompt-DNA fragments and YouTube thumbnail layout patterns fit',
    title ? `the title "${title}"` : 'a fresh untitled ARV techno livestream',
    theme ? `and the theme "${theme}"` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  // Honor an explicit opt-out from the UI.
  if (input.useFoundryIq === false) {
    return buildInactiveResult(query);
  }

  let brief = null;
  try {
    brief = await resolveIQBrief(context);
  } catch (error) {
    console.warn(
      '[thumbnail-iq] resolveIQBrief threw — Foundry IQ memory inactive:',
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    brief = null;
  }

  if (!brief) {
    return buildInactiveResult(query);
  }

  const usedRemote = brief.provider === 'foundry-iq-agent';

  return {
    provider: brief.provider,
    usedRemote,
    query: brief.query || query,
    styleRules: brief.styleRules ?? [],
    patterns: brief.patterns ?? [],
    dramaturgy: brief.dramaturgy ?? [],
    continuity: brief.continuity ?? [],
    forbidden: brief.forbidden ?? [],
    citations: (brief.citations ?? []).map((citation) => ({
      source: citation.source,
      excerpt: citation.excerpt,
    })),
    promptBlock: brief.promptBlock ?? '',
    fallbackNote: usedRemote ? FALLBACK_NOTE_REMOTE : FALLBACK_NOTE_LOCAL,
  };
};

export const normalizeMemorySearchInput = (
  body: unknown,
): ResolveThumbnailMemoryInput => {
  if (!body || typeof body !== 'object') {
    return {};
  }
  const draft = body as Record<string, unknown>;
  return {
    title: typeof draft.title === 'string' ? draft.title : undefined,
    theme: typeof draft.theme === 'string' ? draft.theme : undefined,
    genre: typeof draft.genre === 'string' ? draft.genre : undefined,
    mood: toMoodList(draft.mood),
    referenceSummary: typeof draft.referenceSummary === 'string' ? draft.referenceSummary : undefined,
    useFoundryIq: typeof draft.useFoundryIq === 'boolean' ? draft.useFoundryIq : undefined,
  };
};

export const isFoundryIqConfigured = (): boolean => {
  const provider = (process.env.HYROGLYPHIS_IQ_PROVIDER || 'auto').trim().toLowerCase();
  if (provider === 'off' || provider === 'disabled') {
    return false;
  }
  const agentName = (process.env.AZURE_FOUNDRY_IQ_AGENT_NAME || '').trim();
  const endpoint = (
    process.env.AZURE_FOUNDRY_IQ_ENDPOINT
    || process.env.AZURE_OPENAI_COMPLETIONS_ENDPOINT
    || process.env.AZURE_AI_FOUNDRY_ENDPOINT
    || process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT
    || ''
  ).trim();
  const key = (
    process.env.AZURE_AI_FOUNDRY_KEY
    || process.env.AZURE_OPENAI_COMPLETIONS_KEY
    || process.env.AZURE_OPENAI_KEY
    || ''
  ).trim();
  return Boolean(agentName && endpoint && key);
};

export {
  FALLBACK_NOTE_INACTIVE,
  FALLBACK_NOTE_LOCAL,
  FALLBACK_NOTE_REMOTE,
};
