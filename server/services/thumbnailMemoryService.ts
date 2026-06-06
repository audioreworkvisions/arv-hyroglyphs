/**
 * Thumbnail session + memory card persistence service.
 *
 * - Sessions  → data/thumbnail-studio/sessions/<id>.json (history = latest 20)
 * - Memory    → data/thumbnail-studio/memory-cards/<file>.json
 *               + memories/thumbnail-studio/YYYY-MM-DD_slug_title.md
 *
 * The web app never shells out. The markdown memory card is written locally and
 * the UI shows the PowerShell sync command for Foundry IQ long-term memory.
 */

import path from 'node:path';
import type {
  ThumbnailMemoryCard,
  ThumbnailStudioSession,
} from '../../lib/thumbnailTypes';
import {
  createId,
  ensureDir,
  getThumbnailMemoryMarkdownDir,
  getThumbnailSubdir,
  isoDatePart,
  listJsonFiles,
  readJsonFile,
  slugify,
  writeJsonFile,
} from './thumbnailPaths';
import { promises as fs } from 'node:fs';

const HISTORY_LIMIT = 20;

export const saveSession = async (session: ThumbnailStudioSession): Promise<string> => {
  const dir = getThumbnailSubdir('sessions');
  await ensureDir(dir);
  const filePath = path.join(dir, `${session.id}.json`);
  await writeJsonFile(filePath, session);
  return filePath;
};

export const loadSession = async (id: string): Promise<ThumbnailStudioSession | null> => {
  const dir = getThumbnailSubdir('sessions');
  return readJsonFile<ThumbnailStudioSession>(path.join(dir, `${id}.json`));
};

export const listRecentSessions = async (limit = HISTORY_LIMIT): Promise<ThumbnailStudioSession[]> => {
  const dir = getThumbnailSubdir('sessions');
  const files = await listJsonFiles(dir);
  const sessions = await Promise.all(files.map((file) => readJsonFile<ThumbnailStudioSession>(file)));
  return sessions
    .filter((session): session is ThumbnailStudioSession => Boolean(session))
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))
    .slice(0, limit);
};

const buildMemoryMarkdown = (card: ThumbnailMemoryCard): string => {
  const frontMatter = [
    '---',
    `type: ${card.type}`,
    `brand: ${card.brand}`,
    `title: ${card.title}`,
    `theme: ${card.theme}`,
    `genre: ${card.genre}`,
    `mood: [${card.mood.join(', ')}]`,
    `palette: [${card.palette.join(', ')}]`,
    `layout: ${card.layout}`,
    `createdAt: ${card.createdAt}`,
    '---',
  ].join('\n');

  const overlay = card.textOverlay;
  const overlayBlock = [
    `- Topline: ${overlay.topline}`,
    `- Main title: ${overlay.mainTitle}`,
    overlay.subtitle ? `- Subtitle: ${overlay.subtitle}` : '',
    `- Footer: ${overlay.footer}`,
    overlay.streamNumber ? `- Stream number: ${overlay.streamNumber}` : '',
    `- Text style: ${overlay.textStyle}`,
    `- Color logic: ${overlay.colorLogic}`,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    frontMatter,
    '',
    `# Thumbnail Memory: ${card.title}`,
    '',
    '## What was generated',
    '',
    card.whatGenerated || 'n/a',
    '',
    '## What worked',
    '',
    card.whatWorked || 'n/a',
    '',
    '## Avoid next time',
    '',
    card.avoidNextTime || 'n/a',
    '',
    '## Background prompt',
    '',
    card.backgroundPrompt || 'n/a',
    '',
    '## Negative prompt',
    '',
    card.negativePrompt || 'n/a',
    '',
    '## Text overlay',
    '',
    overlayBlock,
    '',
    '## Foundry IQ sources used',
    '',
    card.foundryIqSources.length > 0
      ? card.foundryIqSources.map((source) => `- ${source}`).join('\n')
      : '- none (local fallback)',
    '',
  ].join('\n');
};

export interface MemoryWriteResult {
  jsonPath: string;
  markdownPath: string;
  syncHint: string;
}

export const writeMemoryCard = async (
  card: ThumbnailMemoryCard,
  writeLocal = true,
): Promise<MemoryWriteResult> => {
  const id = createId('memory');
  const slug = slugify(card.title);
  const jsonDir = getThumbnailSubdir('memoryCards');
  const jsonPath = path.join(jsonDir, `${isoDatePart()}_${slug}_${id}.json`);

  const markdownDir = getThumbnailMemoryMarkdownDir();
  const markdownPath = path.join(markdownDir, `${isoDatePart()}_${slug}.md`);

  const syncHint =
    'To add this session to Foundry IQ long-term memory, run scripts/sync-thumbnail-memory.ps1 from the repo root.';

  if (writeLocal) {
    await writeJsonFile(jsonPath, card);
    await ensureDir(markdownDir);
    await fs.writeFile(markdownPath, buildMemoryMarkdown(card), 'utf8');
  }

  return { jsonPath, markdownPath, syncHint };
};
