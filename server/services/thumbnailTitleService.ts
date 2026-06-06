/**
 * Thumbnail title + YouTube metadata service.
 *
 * Tier 1: Azure AI Foundry / Azure OpenAI text (via foundryGenerateText) produces
 *         titles, theme, YouTube metadata informed by the Foundry IQ memory.
 * Tier 3: a fully local template generator (word pools) keeps the tool working
 *         with zero Azure configuration.
 *
 * No Gemini / Fal. Slogan is always PEACE LOVE TECHNO.
 */

import { foundryGenerateText } from '../../services/foundryService';
import type {
  FoundryIqMemoryResult,
  ThumbnailStyleProfile,
  ThumbnailTitleVariant,
} from '../../lib/thumbnailTypes';
import { ARV_FOOTER } from '../../lib/thumbnailTypes';

const WORD_FIELD = [
  'SIGNAL', 'RHYTHM', 'MACHINE', 'FREQUENCY', 'UNDERGROUND', 'TRANSMISSION', 'RITUAL',
  'XEROX', 'GROOVE', 'PULSE', 'SYSTEM', 'AFTER MIDNIGHT', 'VOID', 'NOISE', 'BEAT',
  'CODEC', 'RESISTANCE', 'BACKPROPAGATION', 'ELECTRONIC FUNK', 'SUBTERRANEAN',
  'HYPNOTIC', 'RAW', 'ANALOG', 'BROADCAST',
];

const TITLE_TEMPLATES = [
  (a: string, b: string) => `${a} AGAINST THE ${b}`,
  (a: string, b: string) => `${a} AFTER MIDNIGHT`,
  (a: string, b: string) => `${a} ${b}`,
  (a: string, b: string) => `${a} FROM BELOW`,
  (a: string, b: string) => `RAW ${a} ${b}`,
  (a: string, b: string) => `THE ${a} WON'T COMPLY`,
  (a: string, b: string) => `${a} TRANSMISSION`,
  (a: string, b: string) => `${a} // ${b}`,
];

export interface TitleGenerationInput {
  title?: string;
  theme?: string;
  genre?: string;
  mood?: string[];
  streamNumber?: string;
  variantCount: number;
  styleProfile: ThumbnailStyleProfile;
  memory: FoundryIqMemoryResult;
}

export interface TitleGenerationResult {
  selectedTitle: string;
  theme: string;
  titleVariants: ThumbnailTitleVariant[];
  topPicks: string[];
  youtubeTitle: string;
  description: string;
  hashtags: string[];
  seoKeywords: string[];
  generatedByAzure: boolean;
}

const pick = <T>(list: readonly T[], seed: number): T => list[Math.abs(seed) % list.length];

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
};

const toUpperTitle = (value: string): string => value.trim().toUpperCase().replace(/\s+/g, ' ');

const buildLocalTitleVariants = (input: TitleGenerationInput): ThumbnailTitleVariant[] => {
  const seedBase = hashString(
    [input.title, input.theme, input.genre, (input.mood || []).join(','), input.streamNumber, Date.now()]
      .filter(Boolean)
      .join('|'),
  );
  const count = Math.max(3, Math.min(20, input.variantCount || 10));
  const variants: ThumbnailTitleVariant[] = [];
  const used = new Set<string>();

  for (let index = 0; variants.length < count && index < count * 4; index += 1) {
    const seed = seedBase + index * 7919;
    const a = pick(WORD_FIELD, seed);
    const b = pick(WORD_FIELD, seed >> 3);
    if (a === b) continue;
    const template = pick(TITLE_TEMPLATES, seed >> 5);
    const title = toUpperTitle(template(a, b));
    if (used.has(title)) continue;
    used.add(title);
    variants.push({
      title,
      subtitle: toUpperTitle(`${input.genre || 'RAW HARDGROOVE TECHNO'}`),
      score: 60 + ((Math.abs(seed) % 40)),
      reason: `Built from ARV word field (${a} + ${b}) on a ${template.name || 'transmission'} pattern; uppercase and YouTube-ready.`,
    });
  }

  return variants.sort((left, right) => right.score - left.score);
};

const buildLocalResult = (input: TitleGenerationInput): TitleGenerationResult => {
  const userTitle = (input.title || '').trim();
  const variants = buildLocalTitleVariants(input);
  const selectedTitle = userTitle ? toUpperTitle(userTitle) : variants[0]?.title || 'RAW SIGNAL TRANSMISSION';
  const theme =
    (input.theme || '').trim()
    || 'Machine resistance, underground rhythm, analog broadcast ritual between body, signal and system failure.';
  const genre = input.genre || 'Raw Hardgroove Techno';
  const moodLine = (input.mood || []).join(', ') || 'dark, underground, analog';
  const streamSuffix = input.streamNumber ? ` #${input.streamNumber}` : '';

  const description = [
    `${genre}, analog Xerox visuals, dark broadcast energy and machine-resistant rhythm.`,
    `Audioreworkvisions transmits another underground session between body, signal and system failure.`,
    '',
    ARV_FOOTER,
  ].join('\n');

  return {
    selectedTitle,
    theme,
    titleVariants: variants,
    topPicks: variants.slice(0, 3).map((variant) => variant.title),
    youtubeTitle: `${selectedTitle} | TECHNO TRANSMISSIONS${streamSuffix}`,
    description,
    hashtags: ['#techno', '#hardgroove', '#rawtechno', '#audioreworkvisions', '#technotransmissions', '#peacelovetechno'],
    seoKeywords: [
      'raw techno', 'hardgroove techno', 'underground techno livestream', 'analog techno visuals',
      genre.toLowerCase(), ...(input.mood || []).map((mood) => `${mood} techno`),
    ].slice(0, 12),
    generatedByAzure: false,
  };
};

const buildSystemPrompt = (input: TitleGenerationInput): string => {
  const iqRules = [
    ...input.memory.styleRules,
    ...input.memory.patterns,
  ].slice(0, 8);
  const forbidden = input.memory.forbidden.slice(0, 6);

  return [
    'You generate YouTube livestream titles and metadata for Audioreworkvisions (ARV), a Techno Transmissions channel.',
    'Return ONLY valid JSON. No markdown, no commentary.',
    '',
    'Title rules:',
    '- Always UPPERCASE.',
    '- Short, strong, YouTube-ready.',
    '- No generic EDM titles, no long academic titles, no mainstream influencer language.',
    '- Must fit Audioreworkvisions and Techno Transmissions.',
    '- Do not copy old titles 1:1 unless an explicit continuation is requested.',
    `- Good word fields: ${WORD_FIELD.join(', ')}.`,
    '',
    'The footer slogan is always exactly "PEACE LOVE TECHNO" (never "Peace Love Vinyl").',
    '',
    iqRules.length > 0 ? `Foundry IQ creative brand memory (curated ARV rules to honor):\n- ${iqRules.join('\n- ')}` : 'No Foundry IQ memory available; rely on ARV defaults.',
    forbidden.length > 0 ? `Negative rules to avoid:\n- ${forbidden.join('\n- ')}` : '',
    '',
    'Return exactly this JSON shape:',
    `{
  "selectedTitle": "",
  "theme": "",
  "titleVariants": [{ "title": "", "subtitle": "", "score": 0, "reason": "" }],
  "topPicks": [],
  "youtubeTitle": "",
  "description": "",
  "hashtags": [],
  "seoKeywords": []
}`,
  ]
    .filter(Boolean)
    .join('\n');
};

const buildUserPrompt = (input: TitleGenerationInput): string =>
  [
    input.title ? `Requested main title: ${input.title}` : 'No main title provided — generate a fresh ARV title.',
    input.theme ? `Requested theme/concept: ${input.theme}` : 'No theme provided — invent a fitting ARV theme.',
    `Genre / vibe: ${input.genre || 'Raw Hardgroove Techno'}`,
    `Mood: ${(input.mood || []).join(', ') || 'dark, underground, analog'}`,
    input.streamNumber ? `Stream number: ${input.streamNumber}` : 'No stream number.',
    `Generate ${Math.max(3, Math.min(20, input.variantCount || 10))} title variants, plus 3 top picks.`,
    `Style profile summary: ${input.styleProfile.summary}`,
    `Detected palettes: ${input.styleProfile.detectedPalettes.join(', ')}`,
    'Description tone example: "Raw Hardgroove Techno, analog Xerox visuals, dark broadcast energy and machine-resistant rhythm. Audioreworkvisions transmits another underground session between body, signal and system failure. PEACE LOVE TECHNO"',
  ].join('\n');

const extractJson = (raw: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
};

const asStringArray = (value: unknown, limit: number): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
    .slice(0, limit);
};

const normalizeVariants = (value: unknown, limit: number): ThumbnailTitleVariant[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): ThumbnailTitleVariant | null => {
      if (!entry || typeof entry !== 'object') return null;
      const draft = entry as Record<string, unknown>;
      const title = typeof draft.title === 'string' ? toUpperTitle(draft.title) : '';
      if (!title) return null;
      return {
        title,
        subtitle: typeof draft.subtitle === 'string' ? draft.subtitle.trim() : '',
        score: Number.isFinite(Number(draft.score)) ? Number(draft.score) : 70,
        reason: typeof draft.reason === 'string' ? draft.reason.trim() : 'ARV title variant.',
      };
    })
    .filter((variant): variant is ThumbnailTitleVariant => Boolean(variant))
    .slice(0, limit);
};

const ensureSlogan = (description: string): string =>
  description.includes(ARV_FOOTER) ? description : `${description.trim()}\n\n${ARV_FOOTER}`;

export const generateThumbnailTitles = async (
  input: TitleGenerationInput,
): Promise<TitleGenerationResult> => {
  const local = buildLocalResult(input);

  try {
    const response = await foundryGenerateText(buildUserPrompt(input), buildSystemPrompt(input));
    const parsed = extractJson(response.text || '');
    if (!parsed) {
      return local;
    }

    const variants = normalizeVariants(parsed.titleVariants, Math.max(3, Math.min(20, input.variantCount || 10)));
    const selectedTitle =
      typeof parsed.selectedTitle === 'string' && parsed.selectedTitle.trim()
        ? toUpperTitle(parsed.selectedTitle)
        : variants[0]?.title || local.selectedTitle;

    const description = typeof parsed.description === 'string' && parsed.description.trim()
      ? ensureSlogan(parsed.description)
      : local.description;

    return {
      selectedTitle,
      theme: typeof parsed.theme === 'string' && parsed.theme.trim() ? parsed.theme.trim() : local.theme,
      titleVariants: variants.length > 0 ? variants : local.titleVariants,
      topPicks: asStringArray(parsed.topPicks, 3).length > 0
        ? asStringArray(parsed.topPicks, 3).map(toUpperTitle)
        : (variants.length > 0 ? variants : local.titleVariants).slice(0, 3).map((variant) => variant.title),
      youtubeTitle: typeof parsed.youtubeTitle === 'string' && parsed.youtubeTitle.trim()
        ? parsed.youtubeTitle.trim()
        : local.youtubeTitle,
      description,
      hashtags: asStringArray(parsed.hashtags, 12).length > 0 ? asStringArray(parsed.hashtags, 12) : local.hashtags,
      seoKeywords: asStringArray(parsed.seoKeywords, 14).length > 0 ? asStringArray(parsed.seoKeywords, 14) : local.seoKeywords,
      generatedByAzure: true,
    };
  } catch {
    return local;
  }
};
