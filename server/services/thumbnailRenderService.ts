/**
 * Thumbnail render service.
 *
 * Exports a 1920x1080 PNG (or JPG). In the normal AI-composed thumbnail flow,
 * the image model already renders the simple title together with the background,
 * so this service only resizes/exports. A small local overlay remains available
 * as a fallback for background-only/manual uploads.
 *
 * If no background is supplied, a dark analog ARV gradient is generated so the
 * tool always produces a usable thumbnail (offline fallback tier).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type {
  ThumbnailRenderRequest,
  ThumbnailRenderResult,
  ThumbnailTextStyle,
} from '../../lib/thumbnailTypes';
import { ARV_FOOTER, ARV_TOPLINE } from '../../lib/thumbnailTypes';
import { createId, ensureDir, getThumbnailSubdir, isoDatePart, slugify } from './thumbnailPaths';

const WIDTH = 1920;
const HEIGHT = 1080;
const MARGIN_X = 140;
const SAFE_WIDTH = WIDTH - MARGIN_X * 2;

const FONT_STACK = "'Arial Black', Impact, 'system-ui', sans-serif";

interface StylePalette {
  title: string;
  accent: string;
  secondaryAccent: string;
  shadow: string;
  line: string;
}

const STYLE_PALETTES: Record<ThumbnailTextStyle, StylePalette> = {
  'brutal-industrial': {
    title: '#f3efe7',
    accent: '#e23b3b',
    secondaryAccent: '#28d2dc',
    shadow: '#000000',
    line: '#e23b3b',
  },
  'signal-minimal': {
    title: '#eef1f6',
    accent: '#39a0ff',
    secondaryAccent: '#f0aa28',
    shadow: '#05070d',
    line: '#39a0ff',
  },
  'arv-transmission': {
    title: '#f3efe7',
    accent: '#28d2dc',
    secondaryAccent: '#f0aa28',
    shadow: '#000000',
    line: '#dc32a0',
  },
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Estimate average glyph width for a bold condensed uppercase face.
 * ~0.62 of the font size per character is a safe heuristic for auto-fit.
 */
const estimateTextWidth = (text: string, fontSize: number): number => text.length * fontSize * 0.62;

const splitTitleIntoLines = (title: string, fontSize: number, maxWidth: number, maxLines = 3): string[] => {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const atLastLine = lines.length === maxLines - 1;
    if (!current || estimateTextWidth(candidate, fontSize) <= maxWidth || atLastLine) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [title];
};

const fitTitle = (title: string): { fontSize: number; lines: string[] } => {
  let fontSize = 122;
  const minFontSize = 54;

  while (fontSize > minFontSize) {
    const lines = splitTitleIntoLines(title, fontSize, SAFE_WIDTH, 3);
    const longestLineWidth = Math.max(...lines.map((line) => estimateTextWidth(line, fontSize)));
    const totalHeight = lines.length * fontSize * 1.05;
    if (longestLineWidth <= SAFE_WIDTH && totalHeight <= 300) {
      return { fontSize, lines };
    }
    fontSize -= 8;
  }

  return { fontSize: minFontSize, lines: splitTitleIntoLines(title, minFontSize, SAFE_WIDTH, 3) };
};

const buildIconMarkup = (icon: 'peace' | 'heart' | 'vinyl', cx: number, cy: number, color: string): string => {
  const r = 26;
  switch (icon) {
    case 'peace':
      return `<g stroke="${color}" stroke-width="5" fill="none">
        <circle cx="${cx}" cy="${cy}" r="${r}" />
        <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}" />
        <line x1="${cx}" y1="${cy}" x2="${cx - r * 0.7}" y2="${cy + r * 0.7}" />
        <line x1="${cx}" y1="${cy}" x2="${cx + r * 0.7}" y2="${cy + r * 0.7}" />
      </g>`;
    case 'heart':
      return `<path d="M ${cx} ${cy + r * 0.8}
        C ${cx - r * 1.4} ${cy - r * 0.4}, ${cx - r * 0.5} ${cy - r * 1.1}, ${cx} ${cy - r * 0.2}
        C ${cx + r * 0.5} ${cy - r * 1.1}, ${cx + r * 1.4} ${cy - r * 0.4}, ${cx} ${cy + r * 0.8} Z"
        fill="${color}" />`;
    case 'vinyl':
    default:
      return `<g fill="none" stroke="${color}" stroke-width="5">
        <circle cx="${cx}" cy="${cy}" r="${r}" />
        <circle cx="${cx}" cy="${cy}" r="${r * 0.45}" />
        <circle cx="${cx}" cy="${cy}" r="3" fill="${color}" />
      </g>`;
  }
};

interface OverlayParams {
  title: string;
  subtitle: string;
  topline: string;
  footer: string;
  streamNumber: string;
  textStyle: ThumbnailTextStyle;
  icons: Array<'peace' | 'heart' | 'vinyl'>;
  overlayMode: 'minimal' | 'full';
}

const buildOverlaySvg = (params: OverlayParams): string => {
  const palette = STYLE_PALETTES[params.textStyle] || STYLE_PALETTES['arv-transmission'];
  const fitted = fitTitle(params.title || 'UNTITLED');
  const fontSize = params.overlayMode === 'minimal' ? Math.min(fitted.fontSize, 88) : fitted.fontSize;
  const lines = splitTitleIntoLines(params.title || 'UNTITLED', fontSize, SAFE_WIDTH, 3);
  const lineHeight = fontSize * 1.05;
  const titleBlockHeight = lines.length * lineHeight;
  const centerY = HEIGHT * 0.56;
  const titleStartY = centerY - titleBlockHeight / 2 + fontSize * 0.78;

  const titleSpans = lines
    .map((line, index) => {
      const y = titleStartY + index * lineHeight;
      return `<text x="${WIDTH / 2}" y="${y}" text-anchor="middle" font-family="${FONT_STACK}" font-size="${fontSize}" font-weight="850" letter-spacing="${params.textStyle === 'signal-minimal' ? 4 : 1}" fill="${palette.title}" stroke="${palette.shadow}" stroke-width="${Math.max(2, fontSize * 0.018)}" paint-order="stroke">${escapeXml(line)}</text>`;
    })
    .join('\n');

  const topY = 150;
  const toplineMarkup = params.overlayMode === 'full' && params.topline
    ? `<text x="${WIDTH / 2}" y="${topY}" text-anchor="middle" font-family="${FONT_STACK}" font-size="52" font-weight="800" letter-spacing="16" fill="${palette.accent}">${escapeXml(params.topline.toUpperCase())}</text>
       <line x1="${MARGIN_X}" y1="${topY + 34}" x2="${WIDTH - MARGIN_X}" y2="${topY + 34}" stroke="${palette.line}" stroke-width="4" opacity="0.8" />`
    : '';

  const subtitleY = titleStartY + titleBlockHeight + 70;
  const subtitleMarkup = params.overlayMode === 'full' && params.subtitle
    ? `<text x="${WIDTH / 2}" y="${subtitleY}" text-anchor="middle" font-family="${FONT_STACK}" font-size="58" font-weight="700" letter-spacing="6" fill="${palette.secondaryAccent}">${escapeXml(params.subtitle.toUpperCase())}</text>`
    : '';

  const footerY = HEIGHT - 90;
  const footerMarkup = params.overlayMode === 'full' && params.footer
    ? `<text x="${WIDTH / 2}" y="${footerY}" text-anchor="middle" font-family="${FONT_STACK}" font-size="50" font-weight="800" letter-spacing="14" fill="${palette.title}">${escapeXml(params.footer.toUpperCase())}</text>`
    : '';

  const streamMarkup = params.overlayMode === 'full' && params.streamNumber
    ? `<text x="${WIDTH - MARGIN_X}" y="${topY}" text-anchor="end" font-family="${FONT_STACK}" font-size="64" font-weight="900" fill="${palette.accent}">#${escapeXml(params.streamNumber)}</text>`
    : '';

  const iconY = footerY - 64;
  const iconSpacing = 80;
  const iconStartX = WIDTH / 2 - ((params.icons.length - 1) * iconSpacing) / 2;
  const iconsMarkup = params.overlayMode === 'full' ? params.icons
    .map((icon, index) => buildIconMarkup(icon, iconStartX + index * iconSpacing, iconY, palette.secondaryAccent))
    .join('\n') : '';

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="titleScrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.15" />
      <stop offset="45%" stop-color="#000000" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.7" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#titleScrim)" opacity="${params.overlayMode === 'minimal' ? '0.22' : '0.45'}" />
  ${toplineMarkup}
  ${streamMarkup}
  ${titleSpans}
  ${subtitleMarkup}
  ${iconsMarkup}
  ${footerMarkup}
</svg>`;
};

const buildFallbackBackground = async (): Promise<Buffer> => {
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg" cx="50%" cy="42%" r="75%">
        <stop offset="0%" stop-color="#1a1d24" />
        <stop offset="55%" stop-color="#0c0d11" />
        <stop offset="100%" stop-color="#040405" />
      </radialGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
    ${Array.from({ length: 40 })
      .map((_, index) => `<line x1="0" y1="${index * 27}" x2="${WIDTH}" y2="${index * 27}" stroke="#ffffff" stroke-width="1" opacity="0.025" />`)
      .join('')}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
};

const decodeBackgroundDataUrl = (dataUrl: string): Buffer | null => {
  const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[2], 'base64');
  } catch {
    return null;
  }
};

const resolveBackgroundBuffer = async (request: ThumbnailRenderRequest): Promise<Buffer> => {
  if (request.backgroundDataUrl) {
    const decoded = decodeBackgroundDataUrl(request.backgroundDataUrl);
    if (decoded) return decoded;
  }

  if (request.backgroundImagePath) {
    const resolved = path.isAbsolute(request.backgroundImagePath)
      ? request.backgroundImagePath
      : path.join(process.cwd(), request.backgroundImagePath);
    try {
      return await fs.readFile(resolved);
    } catch {
      // fall through to generated background
    }
  }

  return buildFallbackBackground();
};

export const renderThumbnail = async (
  request: ThumbnailRenderRequest,
): Promise<ThumbnailRenderResult> => {
  const format: 'png' | 'jpg' = request.outputFormat === 'jpg' ? 'jpg' : 'png';
  const layout = request.layout || {};

  const backgroundBuffer = await resolveBackgroundBuffer(request);
  const normalizedBackground = await sharp(backgroundBuffer, { failOn: 'none' })
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
    .toBuffer();

  const overlayMode = layout.localOverlay === 'full' ? 'full' : 'minimal';
  const shouldApplyOverlay = layout.localOverlay !== 'none';
  const overlaySvg = shouldApplyOverlay ? buildOverlaySvg({
    title: request.title || layout.mainTitle || 'UNTITLED',
    subtitle: request.subtitle ?? layout.subtitle ?? '',
    topline: request.topline ?? layout.topline ?? ARV_TOPLINE,
    footer: request.footer ?? layout.footer ?? ARV_FOOTER,
    streamNumber: request.streamNumber ?? layout.streamNumber ?? '',
    textStyle: layout.textStyle || 'arv-transmission',
    icons: layout.icons && layout.icons.length > 0 ? layout.icons : ['peace', 'heart', 'vinyl'],
    overlayMode,
  }) : null;

  const composited = overlaySvg
    ? sharp(normalizedBackground).composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    : sharp(normalizedBackground);
  const outputBuffer =
    format === 'jpg'
      ? await composited.jpeg({ quality: 92 }).toBuffer()
      : await composited.png().toBuffer();

  const id = createId('render');
  const fileName = `${isoDatePart()}_${slugify(request.title || 'untitled')}_${WIDTH}x${HEIGHT}.${format}`;
  const dir = getThumbnailSubdir('exports');
  await ensureDir(dir);
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, outputBuffer);

  return {
    id,
    width: WIDTH,
    height: HEIGHT,
    format,
    imageDataUrl: `data:image/${format === 'jpg' ? 'jpeg' : 'png'};base64,${outputBuffer.toString('base64')}`,
    fileName,
    filePath,
    createdAt: new Date().toISOString(),
  };
};
