/**
 * Filesystem helpers + small utilities for ARV Thumbnail Studio persistence.
 *
 * All data lives under ARV_THUMBNAIL_DATA_DIR (default: data/thumbnail-studio),
 * resolved relative to process.cwd(). Nothing is hardcoded to an absolute path.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_DATA_DIR = 'data/thumbnail-studio';

export const getThumbnailDataDir = (): string => {
  const configured = (process.env.ARV_THUMBNAIL_DATA_DIR || '').trim();
  const relativeOrAbsolute = configured || DEFAULT_DATA_DIR;
  return path.isAbsolute(relativeOrAbsolute)
    ? relativeOrAbsolute
    : path.join(process.cwd(), relativeOrAbsolute);
};

export const THUMBNAIL_SUBDIRS = {
  styleProfiles: 'style-profiles',
  sessions: 'sessions',
  exports: 'exports',
  memoryCards: 'memory-cards',
} as const;

export const getThumbnailSubdir = (key: keyof typeof THUMBNAIL_SUBDIRS): string =>
  path.join(getThumbnailDataDir(), THUMBNAIL_SUBDIRS[key]);

export const getThumbnailMemoryMarkdownDir = (): string =>
  path.join(process.cwd(), 'memories', 'thumbnail-studio');

export const ensureDir = async (dir: string): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
};

export const writeJsonFile = async (filePath: string, value: unknown): Promise<void> => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
};

export const readJsonFile = async <T>(filePath: string): Promise<T | null> => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const listJsonFiles = async (dir: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
};

export const slugify = (value: string, fallback = 'untitled'): string => {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return slug || fallback;
};

export const isoDatePart = (date = new Date()): string => date.toISOString().slice(0, 10);

export const createId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
