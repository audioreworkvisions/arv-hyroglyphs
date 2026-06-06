/**
 * Thumbnail style profile service.
 *
 * Turns a ThumbnailReferenceAnalysis into a persisted ThumbnailStyleProfile
 * stored under data/thumbnail-studio/style-profiles. Provides load helpers and a
 * built-in default ARV profile so the tool works even with zero references.
 */

import path from 'node:path';
import type {
  ThumbnailReferenceAnalysis,
  ThumbnailStyleProfile,
} from '../../lib/thumbnailTypes';
import {
  createId,
  ensureDir,
  getThumbnailSubdir,
  listJsonFiles,
  readJsonFile,
  writeJsonFile,
} from './thumbnailPaths';

const DEFAULT_PALETTES = ['black', 'off-white', 'cyan', 'amber', 'magenta'];

const DEFAULT_PROFILE: ThumbnailStyleProfile = {
  id: 'arv-default-style-profile',
  brand: 'Audioreworkvisions',
  sourceCount: 0,
  summary:
    'Default ARV thumbnail style: dark analog techno-transmission aesthetic, damaged photocopy / black paper texture, high contrast, bold condensed industrial typography with cyan / amber / magenta accents.',
  detectedPalettes: DEFAULT_PALETTES,
  layoutPatterns: ['center-heavy brutal typography', 'title-band', 'dark-background'],
  titlePatterns: ['short uppercase noun-verb', 'two-word transmission titles', 'roman-numeral series (e.g. BACKPROPAGATION IV)'],
  visualMotifs: ['waveform/signal background', 'xerox grain', 'scanlines', 'analog broadcast residue'],
  typographyNotes: ['bold condensed industrial', 'off-white title with cyan/amber accents', 'clean lower third reserved for footer'],
  negativeStyleRules: [
    'no readable AI-generated text in the background',
    'no logos or watermarks',
    'no celebrity likeness or copyrighted characters',
    'no glossy EDM festival wallpaper',
  ],
  exampleFileNames: [],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const NAMED_COLORS: Array<{ name: string; rgb: [number, number, number] }> = [
  { name: 'black', rgb: [10, 10, 12] },
  { name: 'off-white', rgb: [235, 232, 226] },
  { name: 'cyan', rgb: [40, 210, 220] },
  { name: 'amber', rgb: [240, 170, 40] },
  { name: 'magenta', rgb: [220, 50, 160] },
  { name: 'red', rgb: [210, 50, 50] },
  { name: 'deep-blue', rgb: [30, 50, 120] },
  { name: 'grey', rgb: [120, 120, 124] },
  { name: 'green', rgb: [60, 180, 90] },
  { name: 'violet', rgb: [130, 70, 200] },
];

const hexToRgb = (hex: string): [number, number, number] | null => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const intVal = parseInt(match[1], 16);
  return [(intVal >> 16) & 255, (intVal >> 8) & 255, intVal & 255];
};

const nearestColorName = (hex: string): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let best = NAMED_COLORS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of NAMED_COLORS) {
    const distance =
      (rgb[0] - candidate.rgb[0]) ** 2 + (rgb[1] - candidate.rgb[1]) ** 2 + (rgb[2] - candidate.rgb[2]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best.name;
};

const dedupe = (values: string[], limit: number): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);

export const buildStyleProfileFromAnalysis = (
  analysis: ThumbnailReferenceAnalysis,
): ThumbnailStyleProfile => {
  if (analysis.images.length === 0) {
    return { ...DEFAULT_PROFILE, id: createId('arv-style-profile'), updatedAt: new Date().toISOString() };
  }

  const paletteNames = analysis.images.flatMap((image) => image.dominantColors.map(nearestColorName));
  const layoutPatterns = analysis.images.flatMap((image) => image.composition);
  const semanticHints = analysis.images.flatMap((image) => image.semanticHints);
  const avgBrightness =
    analysis.images.reduce((sum, image) => sum + image.averageBrightness, 0) / analysis.images.length;
  const avgContrast =
    analysis.images.reduce((sum, image) => sum + image.estimatedContrast, 0) / analysis.images.length;

  const now = new Date().toISOString();

  return {
    id: createId('arv-style-profile'),
    brand: 'Audioreworkvisions',
    sourceCount: analysis.images.length,
    summary: `${analysis.summary} Average brightness ${avgBrightness.toFixed(2)}, contrast ${avgContrast.toFixed(2)}. Recurring motifs: ${dedupe(semanticHints, 6).join(', ') || 'signal / transmission'}.`,
    detectedPalettes: dedupe([...paletteNames, ...DEFAULT_PALETTES], 8),
    layoutPatterns: dedupe([...layoutPatterns, ...DEFAULT_PROFILE.layoutPatterns], 6),
    titlePatterns: dedupe(
      [...semanticHints.map((hint) => `${hint} themed title`), ...DEFAULT_PROFILE.titlePatterns],
      6,
    ),
    visualMotifs: dedupe(
      [...semanticHints.map((hint) => hint.toLowerCase()), ...DEFAULT_PROFILE.visualMotifs],
      8,
    ),
    typographyNotes: [...DEFAULT_PROFILE.typographyNotes],
    negativeStyleRules: [...DEFAULT_PROFILE.negativeStyleRules],
    exampleFileNames: dedupe(analysis.images.map((image) => image.fileName), 12),
    createdAt: now,
    updatedAt: now,
  };
};

export const saveStyleProfile = async (profile: ThumbnailStyleProfile): Promise<string> => {
  const dir = getThumbnailSubdir('styleProfiles');
  await ensureDir(dir);
  const filePath = path.join(dir, `${profile.id}.json`);
  await writeJsonFile(filePath, profile);
  return filePath;
};

export const loadStyleProfile = async (id: string): Promise<ThumbnailStyleProfile | null> => {
  if (!id || id === DEFAULT_PROFILE.id) {
    return getDefaultStyleProfile();
  }
  const dir = getThumbnailSubdir('styleProfiles');
  return readJsonFile<ThumbnailStyleProfile>(path.join(dir, `${id}.json`));
};

export const loadLatestStyleProfile = async (): Promise<ThumbnailStyleProfile | null> => {
  const dir = getThumbnailSubdir('styleProfiles');
  const files = await listJsonFiles(dir);
  if (files.length === 0) {
    return null;
  }

  const profiles = await Promise.all(files.map((file) => readJsonFile<ThumbnailStyleProfile>(file)));
  const valid = profiles.filter((profile): profile is ThumbnailStyleProfile => Boolean(profile));
  if (valid.length === 0) {
    return null;
  }

  return valid.sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1))[0];
};

export const getDefaultStyleProfile = (): ThumbnailStyleProfile => ({
  ...DEFAULT_PROFILE,
  detectedPalettes: [...DEFAULT_PROFILE.detectedPalettes],
  layoutPatterns: [...DEFAULT_PROFILE.layoutPatterns],
  titlePatterns: [...DEFAULT_PROFILE.titlePatterns],
  visualMotifs: [...DEFAULT_PROFILE.visualMotifs],
  typographyNotes: [...DEFAULT_PROFILE.typographyNotes],
  negativeStyleRules: [...DEFAULT_PROFILE.negativeStyleRules],
  exampleFileNames: [],
});

export const resolveStyleProfile = async (styleProfileId?: string): Promise<ThumbnailStyleProfile> => {
  if (styleProfileId) {
    const explicit = await loadStyleProfile(styleProfileId);
    if (explicit) return explicit;
  }
  const latest = await loadLatestStyleProfile();
  return latest ?? getDefaultStyleProfile();
};
