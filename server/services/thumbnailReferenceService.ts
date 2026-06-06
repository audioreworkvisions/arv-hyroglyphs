/**
 * Thumbnail reference analysis service.
 *
 * Analyzes existing ARV thumbnails to derive a style profile. Works two ways:
 *  1. Local dev: a server-side folderPath is read directly (png/jpg/jpeg/webp).
 *  2. Hackathon / App Service demo: drag & drop / multi-upload base64 dataUrls.
 *
 * Uses `sharp` for metadata, resize and color analysis. Fails soft: a single bad
 * image is skipped (counted in skippedCount) instead of crashing the request.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type {
  ThumbnailReferenceAnalysis,
  ThumbnailReferenceImageAnalysis,
  ThumbnailUploadedImage,
} from '../../lib/thumbnailTypes';

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MAX_IMAGES = 80;
const ANALYSIS_SAMPLE_SIZE = 48;

const SEMANTIC_KEYWORDS = [
  'SIGNAL',
  'FREQUENCY',
  'BACKPROPAGATION',
  'HYPNOTIC',
  'TECHNO TRANSMISSIONS',
  'RITUAL',
  'UNDERGROUND',
  'MACHINE',
  'NO KINGS',
  'DEMOCRACY',
  'BEAT',
] as const;

interface RawImage {
  fileName: string;
  buffer: Buffer;
}

const toHex = (value: number): string => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');

const rgbToHex = (r: number, g: number, b: number): string => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

const quantizeChannel = (value: number): number => Math.round(value / 51) * 51;

const extractSemanticHints = (fileName: string): string[] => {
  const haystack = fileName.toUpperCase().replace(/[_-]+/g, ' ');
  return SEMANTIC_KEYWORDS.filter((keyword) => haystack.includes(keyword));
};

const computeAspectRatio = (width: number, height: number): string => {
  if (!width || !height) {
    return 'unknown';
  }
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height) || 1;
  const w = Math.round(width / divisor);
  const h = Math.round(height / divisor);
  // Collapse near-16:9 noise into a clean label.
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.04) return '16:9';
  if (Math.abs(ratio - 1) < 0.04) return '1:1';
  if (Math.abs(ratio - 4 / 3) < 0.04) return '4:3';
  return `${w}:${h}`;
};

interface PixelStats {
  dominantColors: string[];
  averageBrightness: number;
  estimatedContrast: number;
  brightnessGrid: number[]; // 9 cells, row-major, normalized 0..1
}

const analyzePixels = async (image: sharp.Sharp): Promise<PixelStats> => {
  const { data, info } = await image
    .clone()
    .resize(ANALYSIS_SAMPLE_SIZE, ANALYSIS_SAMPLE_SIZE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const width = info.width;
  const height = info.height;
  const colorBuckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  const cellBrightnessSum = new Array(9).fill(0);
  const cellBrightnessCount = new Array(9).fill(0);
  let brightnessSum = 0;
  let pixelCount = 0;
  let minBrightness = 255;
  let maxBrightness = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];

      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      brightnessSum += brightness;
      pixelCount += 1;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);

      const col = Math.min(2, Math.floor((x / width) * 3));
      const row = Math.min(2, Math.floor((y / height) * 3));
      const cellIndex = row * 3 + col;
      cellBrightnessSum[cellIndex] += brightness;
      cellBrightnessCount[cellIndex] += 1;

      const key = `${quantizeChannel(r)}-${quantizeChannel(g)}-${quantizeChannel(b)}`;
      const bucket = colorBuckets.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
      } else {
        colorBuckets.set(key, { count: 1, r, g, b });
      }
    }
  }

  const dominantColors = Array.from(colorBuckets.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)
    .map((bucket) => rgbToHex(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count));

  const averageBrightness = pixelCount > 0 ? brightnessSum / pixelCount / 255 : 0;
  const estimatedContrast = (maxBrightness - minBrightness) / 255;
  const brightnessGrid = cellBrightnessSum.map((sum, index) =>
    cellBrightnessCount[index] > 0 ? sum / cellBrightnessCount[index] / 255 : 0,
  );

  return {
    dominantColors,
    averageBrightness: Number(averageBrightness.toFixed(3)),
    estimatedContrast: Number(estimatedContrast.toFixed(3)),
    brightnessGrid,
  };
};

const inferComposition = (stats: PixelStats, fileName: string): string[] => {
  const composition: string[] = [];
  const grid = stats.brightnessGrid;
  const center = grid[4] ?? 0;
  const edgesAverage =
    [grid[0], grid[1], grid[2], grid[3], grid[5], grid[6], grid[7], grid[8]].reduce((sum, value) => sum + value, 0) / 8;
  const leftAverage = ((grid[0] ?? 0) + (grid[3] ?? 0) + (grid[6] ?? 0)) / 3;
  const rightAverage = ((grid[2] ?? 0) + (grid[5] ?? 0) + (grid[8] ?? 0)) / 3;
  const topAverage = ((grid[0] ?? 0) + (grid[1] ?? 0) + (grid[2] ?? 0)) / 3;

  if (center > edgesAverage + 0.08) composition.push('center-heavy');
  if (leftAverage > rightAverage + 0.1) composition.push('left-title');
  if (rightAverage > leftAverage + 0.1) composition.push('right-subject');
  if (topAverage > center + 0.06) composition.push('title-band');
  if (stats.averageBrightness < 0.32) composition.push('dark-background');
  if (stats.averageBrightness > 0.72) composition.push('typography-heavy');

  const hints = extractSemanticHints(fileName);
  if (hints.some((hint) => /SIGNAL|FREQUENCY|BACKPROPAGATION/.test(hint))) composition.push('waveform/signal-background');
  if (hints.some((hint) => /HYPNOTIC|RITUAL/.test(hint))) composition.push('cosmic-background');

  return composition.length > 0 ? Array.from(new Set(composition)) : ['center-heavy'];
};

const analyzeSingleImage = async (raw: RawImage): Promise<ThumbnailReferenceImageAnalysis> => {
  const image = sharp(raw.buffer, { failOn: 'none' });
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const stats = await analyzePixels(image);

  return {
    fileName: raw.fileName,
    width,
    height,
    aspectRatio: computeAspectRatio(width, height),
    dominantColors: stats.dominantColors,
    averageBrightness: stats.averageBrightness,
    estimatedContrast: stats.estimatedContrast,
    composition: inferComposition(stats, raw.fileName),
    semanticHints: extractSemanticHints(raw.fileName),
  };
};

const readFolderImages = async (folderPath: string): Promise<{ images: RawImage[]; warnings: string[] }> => {
  const warnings: string[] = [];
  const resolved = path.isAbsolute(folderPath) ? folderPath : path.join(process.cwd(), folderPath);

  let entries: string[] = [];
  try {
    entries = await fs.readdir(resolved);
  } catch {
    warnings.push(`Reference folder not readable: ${folderPath}`);
    return { images: [], warnings };
  }

  const images: RawImage[] = [];
  for (const entry of entries) {
    if (images.length >= MAX_IMAGES) break;
    const ext = path.extname(entry).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
    try {
      const buffer = await fs.readFile(path.join(resolved, entry));
      images.push({ fileName: entry, buffer });
    } catch {
      warnings.push(`Could not read file: ${entry}`);
    }
  }

  return { images, warnings };
};

const decodeUploadedImages = (
  uploaded: ThumbnailUploadedImage[],
): { images: RawImage[]; warnings: string[] } => {
  const warnings: string[] = [];
  const images: RawImage[] = [];

  for (const item of uploaded) {
    if (images.length >= MAX_IMAGES) break;
    if (!item || typeof item.dataUrl !== 'string') {
      warnings.push('Skipped an upload without a valid dataUrl.');
      continue;
    }
    const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(item.dataUrl);
    if (!match) {
      warnings.push(`Unsupported upload format: ${item.fileName || 'unknown'}`);
      continue;
    }
    try {
      images.push({
        fileName: item.fileName || `upload-${images.length + 1}.${match[1]}`,
        buffer: Buffer.from(match[2], 'base64'),
      });
    } catch {
      warnings.push(`Could not decode upload: ${item.fileName || 'unknown'}`);
    }
  }

  return { images, warnings };
};

const buildSummary = (images: ThumbnailReferenceImageAnalysis[]): string => {
  if (images.length === 0) {
    return 'No reference thumbnails were analyzed.';
  }

  const avgBrightness = images.reduce((sum, image) => sum + image.averageBrightness, 0) / images.length;
  const avgContrast = images.reduce((sum, image) => sum + image.estimatedContrast, 0) / images.length;
  const compositionCounts = new Map<string, number>();
  images.forEach((image) =>
    image.composition.forEach((entry) => compositionCounts.set(entry, (compositionCounts.get(entry) ?? 0) + 1)),
  );
  const topCompositions = Array.from(compositionCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([entry]) => entry);

  const brightnessLabel = avgBrightness < 0.35 ? 'predominantly dark' : avgBrightness > 0.65 ? 'bright' : 'mid-key';
  const contrastLabel = avgContrast > 0.6 ? 'high-contrast' : 'moderate-contrast';

  return `Analyzed ${images.length} ARV reference thumbnails: ${brightnessLabel}, ${contrastLabel}, dominant compositions ${topCompositions.join(', ') || 'center-heavy'}.`;
};

export interface AnalyzeReferencesInput {
  folderPath?: string;
  uploadedImages?: ThumbnailUploadedImage[];
}

export const analyzeThumbnailReferences = async (
  input: AnalyzeReferencesInput,
): Promise<ThumbnailReferenceAnalysis> => {
  const warnings: string[] = [];
  const rawImages: RawImage[] = [];
  let usedFolder = false;
  let usedUpload = false;

  const folderPath = (input.folderPath || process.env.ARV_THUMBNAIL_DEFAULT_REFERENCE_DIR || '').trim();
  if (folderPath) {
    const folderResult = await readFolderImages(folderPath);
    rawImages.push(...folderResult.images);
    warnings.push(...folderResult.warnings);
    usedFolder = folderResult.images.length > 0;
  }

  if (Array.isArray(input.uploadedImages) && input.uploadedImages.length > 0) {
    const uploadResult = decodeUploadedImages(input.uploadedImages);
    rawImages.push(...uploadResult.images);
    warnings.push(...uploadResult.warnings);
    usedUpload = uploadResult.images.length > 0;
  }

  const limited = rawImages.slice(0, MAX_IMAGES);
  const analyzed: ThumbnailReferenceImageAnalysis[] = [];
  let skippedCount = rawImages.length - limited.length;

  for (const raw of limited) {
    try {
      analyzed.push(await analyzeSingleImage(raw));
    } catch {
      skippedCount += 1;
      warnings.push(`Could not analyze image: ${raw.fileName}`);
    }
  }

  const source: ThumbnailReferenceAnalysis['source'] =
    usedFolder && usedUpload ? 'mixed' : usedUpload ? 'upload' : 'folder';

  return {
    source,
    analyzedCount: analyzed.length,
    skippedCount,
    images: analyzed,
    summary: buildSummary(analyzed),
    warnings,
  };
};
