import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  createId,
  ensureDir,
  isoDatePart,
  listJsonFiles,
  readJsonFile,
  slugify,
  writeJsonFile,
} from './thumbnailPaths';
import { invalidateLocalKnowledgeCache } from '../utils/iq';

const execFileAsync = promisify(execFile);

export interface StillframeStoryMemoryScene {
  index: number;
  beat: string;
  title: string;
  prompt: string;
  motion: string;
  durationSeconds?: number;
  videoId?: string | null;
  remixedFromVideoId?: string | null;
  videoTransformMode?: 'remix' | 'extend' | null;
}

export interface StillframeStoryMemoryCard {
  type: 'stillframe_story_memory';
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  sourcePrompt: string;
  storyConcept: string;
  continuationOf?: string | null;
  referenceStyle?: {
    summary?: string;
    subjectFocus?: string;
    palette?: string;
    motion?: string;
    promptDNA?: string;
    keywords?: string[];
  } | null;
  stylePresets: Array<{
    id: string;
    name: string;
    visualIdentity?: string;
    colorPalette?: string;
    lighting?: string;
    motionStyle?: string;
    shortPrompt?: string;
  }>;
  scenes: StillframeStoryMemoryScene[];
  notes?: string;
}

const DEFAULT_STORY_DATA_DIR = 'data/stillframe/story-memory-cards';
const STORY_MARKDOWN_DIR = path.join(process.cwd(), 'memories', 'stillframe-stories');

const getStoryMemoryJsonDir = (): string => {
  const configured = (process.env.ARV_STILLFRAME_STORY_MEMORY_DATA_DIR || '').trim();
  const relativeOrAbsolute = configured || DEFAULT_STORY_DATA_DIR;
  return path.isAbsolute(relativeOrAbsolute)
    ? relativeOrAbsolute
    : path.join(process.cwd(), relativeOrAbsolute);
};

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeStylePresets = (value: unknown): StillframeStoryMemoryCard['stylePresets'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      id: clean(entry.id) || clean(entry.name) || 'preset',
      name: clean(entry.name) || clean(entry.id) || 'Preset',
      visualIdentity: clean(entry.visualIdentity),
      colorPalette: clean(entry.colorPalette),
      lighting: clean(entry.lighting),
      motionStyle: clean(entry.motionStyle),
      shortPrompt: clean(entry.shortPrompt),
    }))
    .slice(0, 12);
};

const normalizeReferenceStyle = (value: unknown): StillframeStoryMemoryCard['referenceStyle'] => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const draft = value as Record<string, unknown>;
  return {
    summary: clean(draft.summary),
    subjectFocus: clean(draft.subjectFocus),
    palette: clean(draft.palette),
    motion: clean(draft.motion),
    promptDNA: clean(draft.promptDNA),
    keywords: Array.isArray(draft.keywords)
      ? draft.keywords.map((entry) => clean(entry)).filter(Boolean).slice(0, 12)
      : [],
  };
};

const normalizeScenes = (value: unknown): StillframeStoryMemoryScene[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry, index): StillframeStoryMemoryScene => ({
      index: Number.isFinite(Number(entry.index)) ? Number(entry.index) : index + 1,
      beat: clean(entry.beat) || `scene-${index + 1}`,
      title: clean(entry.title) || `Szene ${index + 1}`,
      prompt: clean(entry.prompt),
      motion: clean(entry.motion),
      durationSeconds: Number.isFinite(Number(entry.durationSeconds)) ? Number(entry.durationSeconds) : undefined,
      videoId: clean(entry.videoId) || null,
      remixedFromVideoId: clean(entry.remixedFromVideoId) || null,
      videoTransformMode: entry.videoTransformMode === 'extend' ? 'extend' : entry.videoTransformMode === 'remix' ? 'remix' : null,
    }))
    .filter((scene) => scene.prompt.length > 0)
    .slice(0, 16);
};

const buildStoryMarkdown = (card: StillframeStoryMemoryCard): string => {
  const reference = card.referenceStyle;
  const frontMatter = [
    '---',
    `type: ${card.type}`,
    `id: ${card.id}`,
    `title: ${card.title}`,
    `createdAt: ${card.createdAt}`,
    `updatedAt: ${card.updatedAt}`,
    card.continuationOf ? `continuationOf: ${card.continuationOf}` : '',
    `sceneCount: ${card.scenes.length}`,
    `keywords: [${reference?.keywords?.join(', ') || ''}]`,
    '---',
  ].filter(Boolean).join('\n');

  const styleBlock = reference
    ? [
      `- Summary: ${reference.summary || 'n/a'}`,
      `- Subject focus: ${reference.subjectFocus || 'n/a'}`,
      `- Palette: ${reference.palette || 'n/a'}`,
      `- Motion: ${reference.motion || 'n/a'}`,
      `- Prompt DNA: ${reference.promptDNA || 'n/a'}`,
      `- Keywords: ${reference.keywords?.join(', ') || 'n/a'}`,
    ].join('\n')
    : '- none';

  const presetBlock = card.stylePresets.length > 0
    ? card.stylePresets.map((preset) => [
      `### ${preset.name}`,
      '',
      `- ID: ${preset.id}`,
      preset.visualIdentity ? `- Visual identity: ${preset.visualIdentity}` : '',
      preset.colorPalette ? `- Palette: ${preset.colorPalette}` : '',
      preset.motionStyle ? `- Motion: ${preset.motionStyle}` : '',
      preset.shortPrompt ? `- Prompt seed: ${preset.shortPrompt}` : '',
    ].filter(Boolean).join('\n')).join('\n\n')
    : 'none';

  const sceneBlock = card.scenes.map((scene) => [
    `## Scene ${scene.index}: ${scene.title}`,
    '',
    `- Beat: ${scene.beat}`,
    scene.durationSeconds ? `- Duration: ${scene.durationSeconds}s` : '',
    scene.videoId ? `- Video ID: ${scene.videoId}` : '',
    scene.remixedFromVideoId ? `- Continued/remixed from: ${scene.remixedFromVideoId}` : '',
    '',
    '### Prompt',
    '',
    scene.prompt,
    '',
    '### Motion / Continuity',
    '',
    scene.motion || 'n/a',
  ].filter(Boolean).join('\n')).join('\n\n');

  return [
    frontMatter,
    '',
    `# Stillframe Story Memory: ${card.title}`,
    '',
    '## Source prompt',
    '',
    card.sourcePrompt || 'n/a',
    '',
    '## Story concept',
    '',
    card.storyConcept || 'n/a',
    '',
    card.continuationOf ? `Continuation of: ${card.continuationOf}` : '',
    '',
    '## Extracted reference style',
    '',
    styleBlock,
    '',
    '## Style presets',
    '',
    presetBlock,
    '',
    '## Scenes',
    '',
    sceneBlock,
    '',
    '## Continuation instructions for Foundry IQ',
    '',
    'When this memory is retrieved, preserve the extracted style DNA, recurring motifs, palette, motion grammar, and scene chronology. Continuations should add new scenes after the latest numbered scene instead of rebooting the story world.',
    '',
    card.notes ? ['## Notes', '', card.notes, ''].join('\n') : '',
  ].filter((entry) => entry !== '').join('\n');
};

export const normalizeStoryMemoryCard = (value: unknown): StillframeStoryMemoryCard => {
  if (!value || typeof value !== 'object') {
    throw new Error('memoryCard is required.');
  }

  const draft = value as Record<string, unknown>;
  const title = clean(draft.title) || clean(draft.storyTitle) || 'ARV Story Memory';
  const scenes = normalizeScenes(draft.scenes);
  if (scenes.length === 0) {
    throw new Error('memoryCard.scenes must contain at least one prompted scene.');
  }

  const now = new Date().toISOString();
  return {
    type: 'stillframe_story_memory',
    id: clean(draft.id) || createId('story-memory'),
    createdAt: clean(draft.createdAt) || now,
    updatedAt: now,
    title,
    sourcePrompt: clean(draft.sourcePrompt),
    storyConcept: clean(draft.storyConcept),
    continuationOf: clean(draft.continuationOf) || null,
    referenceStyle: normalizeReferenceStyle(draft.referenceStyle),
    stylePresets: normalizeStylePresets(draft.stylePresets),
    scenes,
    notes: clean(draft.notes),
  };
};

export interface StoryMemoryWriteResult {
  jsonPath: string;
  markdownPath: string;
  syncHint: string;
}

export interface StoryMemorySyncOptions {
  includeStylePack?: boolean;
  recreateKnowledgeBase?: boolean;
}

export interface StoryMemorySyncResult {
  markdownCount: number;
  stdout: string;
  stderr: string;
}

export const writeStoryMemoryCard = async (card: StillframeStoryMemoryCard): Promise<StoryMemoryWriteResult> => {
  const slug = slugify(card.title, 'story');
  const jsonDir = getStoryMemoryJsonDir();
  const jsonPath = path.join(jsonDir, `${isoDatePart()}_${slug}_${card.id}.json`);
  const markdownPath = path.join(STORY_MARKDOWN_DIR, `${isoDatePart()}_${slug}_story.md`);

  await writeJsonFile(jsonPath, card);
  await ensureDir(STORY_MARKDOWN_DIR);
  await fs.writeFile(markdownPath, buildStoryMarkdown(card), 'utf8');
  invalidateLocalKnowledgeCache();

  return {
    jsonPath,
    markdownPath,
    syncHint: 'To add saved stillframe stories to Foundry IQ long-term memory, run scripts/sync-stillframe-story-memory.ps1 from the repo root.',
  };
};

export const listStoryMemoryCards = async (limit = 20): Promise<StillframeStoryMemoryCard[]> => {
  const files = await listJsonFiles(getStoryMemoryJsonDir());
  const cards = await Promise.all(files.map((file) => readJsonFile<StillframeStoryMemoryCard>(file)));
  return cards
    .filter((card): card is StillframeStoryMemoryCard => Boolean(card))
    .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1))
    .slice(0, limit);
};

export const syncStoryMemoryToFoundryIq = async (
  options: StoryMemorySyncOptions = {},
): Promise<StoryMemorySyncResult> => {
  await ensureDir(STORY_MARKDOWN_DIR);
  const markdownFiles = (await fs.readdir(STORY_MARKDOWN_DIR))
    .filter((fileName) => fileName.toLowerCase().endsWith('.md'));

  if (markdownFiles.length === 0) {
    throw new Error('No stillframe story-memory markdown files found. Save a story first.');
  }

  const scriptPath = path.join(process.cwd(), 'scripts', 'sync-stillframe-story-memory.ps1');
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
  ];

  if (options.includeStylePack) {
    args.push('-IncludeStylePack');
  }
  if (options.recreateKnowledgeBase) {
    args.push('-RecreateKnowledgeBase');
  }

  const { stdout, stderr } = await execFileAsync(shell, args, {
    cwd: process.cwd(),
    timeout: 10 * 60 * 1000,
    maxBuffer: 1024 * 1024 * 5,
    windowsHide: true,
  });

  return {
    markdownCount: markdownFiles.length,
    stdout: stdout.toString(),
    stderr: stderr.toString(),
  };
};
