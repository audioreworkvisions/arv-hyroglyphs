/**
 * Thumbnail concept service.
 *
 * Assembles a full ThumbnailConcept from the generated titles, the Foundry IQ
 * creative brand memory and the style profile. Builds:
 *  - the final image prompt (which asks the image model to compose the exact
 *    simple title together with the background),
 *  - the negative prompt,
 *  - a local overlay config used only as a fallback/export hint,
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

const FINAL_THUMBNAIL_PROMPT_CONSTRAINTS = [
  '16:9 YouTube thumbnail, final composed image',
  'one simple integrated title only',
  'title should feel designed into the image, not pasted on top',
  'medium title scale, never huge, never covering most of the frame',
  'keep at least 60 percent of the background visible',
  'no subtitle, no topline, no footer slogan, no icons, no extra words',
  'dark analog techno transmission aesthetic',
  'damaged photocopy / black paper texture',
  'cyan / amber / magenta accents',
  'high contrast',
  'readable composition',
  'no logos',
  'no watermark',
  'no celebrity likeness',
  'no copyrighted characters',
];

const BACKGROUND_ONLY_PROMPT_CONSTRAINTS = [
  '16:9 YouTube thumbnail background',
  'no readable text',
  'leave clear calm space for a small title if needed later',
  ...FINAL_THUMBNAIL_PROMPT_CONSTRAINTS.slice(7),
  'no generated words',
];

const NEGATIVE_PROMPT_BASE = [
  'misspelled text',
  'extra letters',
  'extra words',
  'multiple titles',
  'giant typography',
  'oversized headline',
  'text covering the full image',
  'subtitle',
  'footer slogan',
  'topline',
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
      return `Simple title composition; exact title integrated into a restrained analog background, no extra text.`;
    case 'full-youtube-thumbnail':
      return `Full YouTube thumbnail generated as one image; exact title plus background together, no topline, no subtitle, no footer, ${dominantLayout}.`;
    case 'final-composed-thumbnail':
    default:
      return `Final composed thumbnail generated as one image; one simple title designed into the background at restrained scale, ${dominantLayout}.`;
  }
};

const shouldGenerateTitleInImage = (mode: ThumbnailMode): boolean => mode !== 'background-only';

const buildBackgroundPrompt = (input: ConceptGenerationInput, theme: string, selectedTitle: string): string => {
  const genre = input.genre || 'Raw Hardgroove Techno';
  const mood = (input.mood || []).join(', ') || 'dark, underground, analog';
  const motifs = input.styleProfile.visualMotifs.slice(0, 4).join(', ') || 'waveform/signal background, xerox grain, scanlines';
  const iqPatterns = input.memory.patterns.slice(0, 3).join('; ');
  const includeTitle = shouldGenerateTitleInImage(input.thumbnailMode);

  const sceneLine = `${genre} broadcast scene, ${mood} mood, theme: ${theme}. Visual motifs: ${motifs}.${iqPatterns ? ` Foundry IQ patterns: ${iqPatterns}.` : ''}`;
  const titleLine = includeTitle
    ? `Render exactly this title as the only readable text: "${selectedTitle}". Keep it simple, intentional, legible, and integrated with the background.`
    : '';

  return [sceneLine, titleLine, ...(includeTitle ? FINAL_THUMBNAIL_PROMPT_CONSTRAINTS : BACKGROUND_ONLY_PROMPT_CONSTRAINTS)]
    .filter(Boolean)
    .join('\n- ');
};

const buildNegativePrompt = (memory: FoundryIqMemoryResult, styleProfile: ThumbnailStyleProfile, includeTitle: boolean): string => {
  const forbidden = memory.forbidden.map((entry) => entry.toLowerCase());
  const profileRules = styleProfile.negativeStyleRules.map((entry) => entry.toLowerCase());
  const textlessRules = includeTitle ? [] : ['readable text', 'letters', 'words'];
  return Array.from(new Set([...NEGATIVE_PROMPT_BASE, ...textlessRules, ...forbidden, ...profileRules])).join(', ');
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
    topline: '',
    mainTitle: selectedTitle,
    subtitle: '',
    footer: '',
    streamNumber: input.streamNumber || '',
    position: 'center',
    safeArea: true,
    fontStyle: textStyle === 'brutal-industrial' ? 'bold condensed industrial' : 'bold condensed',
    colorLogic,
    textStyle,
    icons: [],
    localOverlay: shouldGenerateTitleInImage(input.thumbnailMode) ? 'none' : 'minimal',
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
    'large pasted-on local typography overlays',
    'extra thumbnail copy beyond the chosen title',
  ].slice(0, 6);

  return {
    whyTitle: input.title
      ? `The user-provided title "${titles.selectedTitle}" was kept and normalized to uppercase ARV style.`
      : `"${titles.selectedTitle}" was selected because it is short, uppercase and built from the ARV word field, matching Audioreworkvisions / Techno Transmissions tone without generic EDM language.`,
    whyTheme: `Theme "${titles.theme}" fits the ${input.genre || 'Raw Hardgroove Techno'} vibe and the ${(input.mood || []).join('/') || 'dark/underground'} mood.`,
    whyLayout: `Layout: ${layout}`,
    whyPalette: `Palette ${palette.join(', ')} was derived from the analyzed ARV reference profile and Foundry IQ palette guidance.`,
    whyLocalText: shouldGenerateTitleInImage(input.thumbnailMode)
      ? 'The final thumbnail prompt asks the image model to compose the exact simple title together with the background. The local renderer exports that generated image without adding a second title overlay.'
      : 'Background-only mode keeps local text available as a small fallback, but the normal final thumbnail mode avoids the large overlay.',
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
  const backgroundPrompt = buildBackgroundPrompt(input, theme, titles.selectedTitle);
  const negativePrompt = buildNegativePrompt(input.memory, input.styleProfile, shouldGenerateTitleInImage(input.thumbnailMode));
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
