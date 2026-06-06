/**
 * Thumbnail concept service.
 *
 * Assembles a full ThumbnailConcept from the generated titles, the Foundry IQ
 * creative brand memory and the style profile. Builds:
 *  - the background prompt (which NEVER asks the image model to render the final
 *    title text — the exact title is rendered locally by thumbnailRenderService),
 *  - the negative prompt,
 *  - the exact text overlay config,
 *  - and a Creative Decision Explanation for the Hackathon demo.
 */

import type {
  CreativeDecisionExplanation,
  FoundryIqMemoryResult,
  ThumbnailConcept,
  ThumbnailMode,
  ThumbnailStyleProfile,
  ThumbnailTextOverlayConfig,
  ThumbnailTextStyle,
} from '../../lib/thumbnailTypes';
import { ARV_FOOTER, ARV_TOPLINE } from '../../lib/thumbnailTypes';
import { generateThumbnailTitles, type TitleGenerationResult } from './thumbnailTitleService';

export interface ConceptGenerationInput {
  title?: string;
  theme?: string;
  genre?: string;
  mood?: string[];
  streamNumber?: string;
  variantCount: number;
  thumbnailMode: ThumbnailMode;
  styleProfile: ThumbnailStyleProfile;
  memory: FoundryIqMemoryResult;
}

// Background prompt constraints that must ALWAYS be present (never render text).
const BACKGROUND_PROMPT_CONSTRAINTS = [
  '16:9 YouTube thumbnail background',
  'no readable text',
  'leave clear space for title overlay',
  'dark analog techno transmission aesthetic',
  'damaged photocopy / black paper texture',
  'cyan / amber / magenta accents',
  'high contrast',
  'readable composition',
  'no logos',
  'no watermark',
  'no celebrity likeness',
  'no copyrighted characters',
  'no generated words',
];

const NEGATIVE_PROMPT_BASE = [
  'readable text',
  'letters',
  'words',
  'typography',
  'logos',
  'watermark',
  'signature',
  'celebrity likeness',
  'copyrighted characters',
  'glossy EDM festival wallpaper',
  'cute mascots',
  'low contrast mush',
  'blurry',
];

const pickTextStyle = (mood: string[]): ThumbnailTextStyle => {
  const moodSet = new Set((mood || []).map((entry) => entry.toLowerCase()));
  if (moodSet.has('machine') || moodSet.has('industrial') || moodSet.has('political')) {
    return 'brutal-industrial';
  }
  if (moodSet.has('cosmic') || moodSet.has('emotional') || moodSet.has('analog')) {
    return 'signal-minimal';
  }
  return 'arv-transmission';
};

const buildLayoutDescription = (mode: ThumbnailMode, styleProfile: ThumbnailStyleProfile): string => {
  const dominantLayout = styleProfile.layoutPatterns[0] || 'center-heavy brutal typography';
  switch (mode) {
    case 'background-only':
      return `Background-only composition (${dominantLayout}); full bleed analog texture with a clear central title safe-area.`;
    case 'title-only-banner':
      return `Title-only banner; flat dark band with centered brutal industrial typography, minimal background.`;
    case 'full-youtube-thumbnail':
      return `Full YouTube thumbnail; centered title, topline above, footer slogan in a clean lower third, ${dominantLayout}.`;
    case 'final-composed-thumbnail':
    default:
      return `Final composed thumbnail; centered brutal typography over a dark analog background, topline TECHNO TRANSMISSIONS above, PEACE LOVE TECHNO footer, ${dominantLayout}.`;
  }
};

const buildBackgroundPrompt = (input: ConceptGenerationInput, theme: string): string => {
  const genre = input.genre || 'Raw Hardgroove Techno';
  const mood = (input.mood || []).join(', ') || 'dark, underground, analog';
  const motifs = input.styleProfile.visualMotifs.slice(0, 4).join(', ') || 'waveform/signal background, xerox grain, scanlines';
  const iqPatterns = input.memory.patterns.slice(0, 3).join('; ');

  const sceneLine = `${genre} broadcast scene, ${mood} mood, theme: ${theme}. Visual motifs: ${motifs}.${iqPatterns ? ` Foundry IQ patterns: ${iqPatterns}.` : ''}`;

  return [sceneLine, ...BACKGROUND_PROMPT_CONSTRAINTS].join('\n- ');
};

const buildNegativePrompt = (memory: FoundryIqMemoryResult, styleProfile: ThumbnailStyleProfile): string => {
  const forbidden = memory.forbidden.map((entry) => entry.toLowerCase());
  const profileRules = styleProfile.negativeStyleRules.map((entry) => entry.toLowerCase());
  return Array.from(new Set([...NEGATIVE_PROMPT_BASE, ...forbidden, ...profileRules])).join(', ');
};

const buildTextOverlay = (
  input: ConceptGenerationInput,
  selectedTitle: string,
  subtitle: string,
): ThumbnailTextOverlayConfig => {
  const textStyle = pickTextStyle(input.mood || []);
  const colorLogic =
    textStyle === 'signal-minimal'
      ? 'thin spaced uppercase off-white with blue/amber glow'
      : 'off-white title with cyan/amber accents';
  return {
    topline: ARV_TOPLINE,
    mainTitle: selectedTitle,
    subtitle,
    footer: ARV_FOOTER,
    streamNumber: input.streamNumber || '',
    position: 'center',
    safeArea: true,
    fontStyle: textStyle === 'brutal-industrial' ? 'bold condensed industrial' : 'bold condensed',
    colorLogic,
    textStyle,
    icons: ['peace', 'heart', 'vinyl'],
  };
};

const buildCreativeDecision = (
  input: ConceptGenerationInput,
  titles: TitleGenerationResult,
  layout: string,
  palette: string[],
): CreativeDecisionExplanation => {
  const usedIqRules = [...input.memory.styleRules, ...input.memory.patterns].slice(0, 6);
  const avoidedPatterns = [
    ...input.memory.forbidden,
    'copying any previous thumbnail 1:1',
    'rendering the final title inside the AI background image',
  ].slice(0, 6);

  return {
    whyTitle: input.title
      ? `The user-provided title "${titles.selectedTitle}" was kept and normalized to uppercase ARV style.`
      : `"${titles.selectedTitle}" was selected because it is short, uppercase and built from the ARV word field, matching Audioreworkvisions / Techno Transmissions tone without generic EDM language.`,
    whyTheme: `Theme "${titles.theme}" fits the ${input.genre || 'Raw Hardgroove Techno'} vibe and the ${(input.mood || []).join('/') || 'dark/underground'} mood.`,
    whyLayout: `Layout: ${layout}`,
    whyPalette: `Palette ${palette.join(', ')} was derived from the analyzed ARV reference profile and Foundry IQ palette guidance.`,
    whyLocalText: 'The exact title is rendered locally via Sharp + SVG because AI image generators frequently misspell text; the background only provides scene and posterspace.',
    usedIqRules,
    avoidedPatterns,
    iqProvider: input.memory.provider,
    usedRemote: input.memory.usedRemote,
  };
};

export const generateThumbnailConcept = async (
  input: ConceptGenerationInput,
): Promise<ThumbnailConcept> => {
  const titles = await generateThumbnailTitles({
    title: input.title,
    theme: input.theme,
    genre: input.genre,
    mood: input.mood,
    streamNumber: input.streamNumber,
    variantCount: input.variantCount,
    styleProfile: input.styleProfile,
    memory: input.memory,
  });

  const subtitle = titles.titleVariants.find((variant) => variant.title === titles.selectedTitle)?.subtitle
    || titles.titleVariants[0]?.subtitle
    || (input.genre || '').toUpperCase();

  const palette = input.styleProfile.detectedPalettes.slice(0, 6);
  const layout = buildLayoutDescription(input.thumbnailMode, input.styleProfile);
  const theme = titles.theme;

  const textOverlay = buildTextOverlay(input, titles.selectedTitle, subtitle);
  const backgroundPrompt = buildBackgroundPrompt(input, theme);
  const negativePrompt = buildNegativePrompt(input.memory, input.styleProfile);
  const creativeDecision = buildCreativeDecision(input, titles, layout, palette);

  return {
    selectedTitle: titles.selectedTitle,
    theme,
    shortConcept: `${input.genre || 'Raw Hardgroove Techno'} session — ${theme}`.slice(0, 240),
    titleVariants: titles.titleVariants,
    topPicks: titles.topPicks,
    youtubeTitle: titles.youtubeTitle,
    description: titles.description,
    hashtags: titles.hashtags,
    seoKeywords: titles.seoKeywords,
    layout,
    palette,
    visualMotifs: input.styleProfile.visualMotifs.slice(0, 6),
    backgroundPrompt,
    negativePrompt,
    textOverlay,
    creativeDecision,
    generatedByAzure: titles.generatedByAzure,
  };
};
