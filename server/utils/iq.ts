import { promises as fs } from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { DefaultAzureCredential, type AccessToken, type TokenCredential } from '@azure/identity';

export type IQMode = 'stillframe' | 'story' | 'thumbnail';
export type IQRenderTarget = 'sketch' | 'video' | 'thumbnail' | 'image';
export type IQPurpose = 'create' | 'remix' | 'extend';

interface IQKnowledgeChunk {
  source: string;
  text: string;
  keywords: string[];
  category: 'style' | 'narrative' | 'pattern' | 'continuity' | 'reference';
}

export interface IQChronologyEntry {
  sceneIndex: number;
  sceneTitle?: string;
  sceneBeat?: string;
  action?: string;
  continuityNotes?: string;
}

export interface IQSceneContext {
  mode: IQMode;
  renderTarget: IQRenderTarget;
  purpose: IQPurpose;
  prompt: string;
  sceneIndex?: number;
  sceneTitle?: string;
  sceneBeat?: string;
  action?: string;
  motion?: string;
  continuityNotes?: string;
  storyTitle?: string;
  storyConcept?: string;
  settingDescription?: string;
  characterDefinition?: string;
  tone?: string;
  presetId?: string | null;
  presetName?: string | null;
  stylePresetIds?: string[];
  referenceStyleSummary?: string | null;
  referenceStylePalette?: string | null;
  referenceStyleMotion?: string | null;
  remixVideoId?: string | null;
  chronology?: IQChronologyEntry[];
}

export interface IQCitation {
  source: string;
  excerpt: string;
}

export interface IQBrief {
  provider: 'foundry-iq-agent' | 'local-knowledge';
  query: string;
  promptBlock: string;
  styleRules: string[];
  patterns: string[];
  dramaturgy: string[];
  continuity: string[];
  forbidden: string[];
  citations: IQCitation[];
  usedRemote: boolean;
}

interface IQStructuredResult {
  styleRules?: string[];
  patterns?: string[];
  dramaturgy?: string[];
  continuity?: string[];
  forbidden?: string[];
  citations?: Array<{ source?: string; excerpt?: string }>;
}

const getIqProvider = (): string =>
  (process.env.HYROGLYPHIS_IQ_PROVIDER || 'auto').trim().toLowerCase();
const getIqAgentName = (): string =>
  (process.env.AZURE_FOUNDRY_IQ_AGENT_NAME || '').trim();
const getIqAgentVersion = (): string =>
  (process.env.AZURE_FOUNDRY_IQ_AGENT_VERSION || '').trim();
const getIqModel = (): string =>
  (
    process.env.AZURE_OPENAI_IQ_MODEL
    || process.env.AZURE_OPENAI_TEXT_MODEL
    || process.env.AZURE_OPENAI_STORYBOARD_MODEL
    || 'gpt-4.1-mini'
  ).trim();

// Auth mode for the Foundry IQ agent. Agents whose tools use OBO (on-behalf-of)
// auth cannot be called with an API key and require a Microsoft Entra ID token.
// 'auto' (default) tries Entra ID first and falls back to the API key.
const getIqAuthMode = (): string =>
  (process.env.AZURE_FOUNDRY_IQ_AUTH || 'auto').trim().toLowerCase();
const getIqTokenScope = (): string =>
  (process.env.AZURE_FOUNDRY_IQ_SCOPE || 'https://ai.azure.com/.default').trim();

let cachedCredential: TokenCredential | null = null;
let cachedToken: AccessToken | null = null;

const getCredential = (): TokenCredential => {
  if (!cachedCredential) {
    cachedCredential = new DefaultAzureCredential();
  }
  return cachedCredential;
};

/**
 * Acquire a Microsoft Entra ID access token for the Foundry IQ agent.
 * Returns null when token acquisition is disabled or fails (e.g. no `az login`,
 * no managed identity), so the caller can fall back to API-key auth.
 */
const acquireAgentEntraToken = async (): Promise<string | null> => {
  const mode = getIqAuthMode();
  if (mode === 'api-key' || mode === 'apikey' || mode === 'key') {
    return null;
  }

  // Reuse a cached token until ~2 minutes before expiry.
  if (cachedToken && cachedToken.expiresOnTimestamp - Date.now() > 120_000) {
    return cachedToken.token;
  }

  try {
    const token = await getCredential().getToken(getIqTokenScope());
    if (token?.token) {
      cachedToken = token;
      return token.token;
    }
    return null;
  } catch (error) {
    cachedToken = null;
    if (getIqAuthMode() === 'aad' || getIqAuthMode() === 'entra') {
      console.warn(
        '[iq] Entra ID token acquisition failed for Foundry IQ agent (run `az login` or assign a managed identity):',
        error instanceof Error ? `${error.name}: ${error.message}` : error,
      );
    }
    return null;
  }
};

const LOCAL_KB_TEXT_FILES = [
  'memories/repo/arv-style.md',
  'memories/repo/story-generation.md',
  'prompt_storys.md',
  'story_prompts.md',
  'stillframe_rituals_sketches.md',
  'audio_titel_liste.md',
  'arv-foundry-iq-style-pack/README.md',
  'graffitti_morph_style.md',
  'README.md',
] as const;

const LOCAL_KB_TEXT_DIRS = [
  'memories/stillframe-stories',
  'memories/thumbnail-studio',
] as const;

const LOCAL_KB_ASSET_DIRS = [
  'ARV',
  path.join('ARV', 'GRAFFITTI'),
] as const;

const MAX_LOCAL_CHUNK_CHARS = 480;
const MAX_LOCAL_RESULTS = 6;

let localKnowledgePromise: Promise<IQKnowledgeChunk[]> | null = null;

const trim = (value: string | null | undefined): string => value?.trim() || '';

const normalizeWhitespace = (value: string): string =>
  value.replace(/\r\n?/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

const tokenize = (value: string): string[] => {
  const normalized = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return [];
  }

  return Array.from(new Set(
    normalized
      .split(' ')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length >= 3),
  ));
};

const uniqueList = (values: Array<string | null | undefined>, limit: number): string[] => {
  const result: string[] = [];

  for (const value of values) {
    const cleaned = trim(value);
    if (!cleaned || result.some((entry) => entry.toLowerCase() === cleaned.toLowerCase())) {
      continue;
    }

    result.push(cleaned);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
};

const splitIntoSegments = (text: string): string[] => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n\n+/)
    .flatMap((segment) => segment.split(/\n(?=- |\* |\d+\.)/g))
    .map((segment) => normalizeWhitespace(segment))
    .filter((segment) => segment.length > 0);
};

const inferChunkCategory = (source: string, text: string): IQKnowledgeChunk['category'] => {
  const haystack = `${source} ${text}`.toLowerCase();

  if (/avoid|verbot|forbidden|don't|do not/.test(haystack)) {
    return 'style';
  }

  if (/continuity|chronology|character|motif|world|history|sequence/.test(haystack)) {
    return 'continuity';
  }

  if (/pattern|geometry|material|palette|color|motion|graffiti|signal|glyph|loop/.test(haystack)) {
    return 'pattern';
  }

  if (/story|narrative|dramaturg|phase|scene|beat/.test(haystack)) {
    return 'narrative';
  }

  return 'reference';
};

const makeChunksFromText = (source: string, text: string): IQKnowledgeChunk[] =>
  splitIntoSegments(text)
    .map((segment) => segment.slice(0, MAX_LOCAL_CHUNK_CHARS))
    .filter((segment) => segment.length > 0)
    .map((segment) => ({
      source,
      text: segment,
      keywords: tokenize(`${source} ${segment}`),
      category: inferChunkCategory(source, segment),
    }));

const safeReadText = async (relativePath: string): Promise<IQKnowledgeChunk[]> => {
  try {
    const content = await fs.readFile(path.join(process.cwd(), relativePath), 'utf8');
    return makeChunksFromText(relativePath, content);
  } catch {
    return [];
  }
};

const walkTextDirectory = async (absoluteDir: string, sourcePrefix: string): Promise<IQKnowledgeChunk[]> => {
  try {
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    const chunks: IQKnowledgeChunk[] = [];

    for (const entry of entries) {
      const nextAbsolute = path.join(absoluteDir, entry.name);
      const nextSource = path.posix.join(sourcePrefix, entry.name);

      if (entry.isDirectory()) {
        chunks.push(...await walkTextDirectory(nextAbsolute, nextSource));
        continue;
      }

      if (!/\.(md|txt)$/i.test(entry.name)) {
        continue;
      }

      chunks.push(...await safeReadText(nextSource));
    }

    return chunks;
  } catch {
    return [];
  }
};

const sanitizeAssetName = (value: string): string =>
  value
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const walkAssetDirectory = async (absoluteDir: string, sourcePrefix: string): Promise<IQKnowledgeChunk[]> => {
  try {
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    const chunks: IQKnowledgeChunk[] = [];

    for (const entry of entries) {
      const nextAbsolute = path.join(absoluteDir, entry.name);
      const nextSource = path.posix.join(sourcePrefix, entry.name);

      if (entry.isDirectory()) {
        chunks.push(...await walkAssetDirectory(nextAbsolute, nextSource));
        continue;
      }

      if (!/\.(gif|png|jpe?g|webp)$/i.test(entry.name)) {
        continue;
      }

      const sanitizedName = sanitizeAssetName(entry.name);
      if (!sanitizedName) {
        continue;
      }

      chunks.push({
        source: nextSource,
        text: `Visual archetype from asset filename: ${sanitizedName}`,
        keywords: tokenize(`${nextSource} ${sanitizedName}`),
        category: 'pattern',
      });
    }

    return chunks;
  } catch {
    return [];
  }
};

const loadLocalKnowledge = async (): Promise<IQKnowledgeChunk[]> => {
  const textChunks = await Promise.all(LOCAL_KB_TEXT_FILES.map((file) => safeReadText(file)));
  const dynamicTextChunks = await Promise.all(
    LOCAL_KB_TEXT_DIRS.map((relativeDir) => walkTextDirectory(path.join(process.cwd(), relativeDir), relativeDir.split(path.sep).join('/'))),
  );
  const assetChunks = await Promise.all(
    LOCAL_KB_ASSET_DIRS.map((relativeDir) => walkAssetDirectory(path.join(process.cwd(), relativeDir), relativeDir.split(path.sep).join('/'))),
  );

  return [...textChunks.flat(), ...dynamicTextChunks.flat(), ...assetChunks.flat()];
};

export const invalidateLocalKnowledgeCache = (): void => {
  localKnowledgePromise = null;
};

const getLocalKnowledge = (): Promise<IQKnowledgeChunk[]> => {
  if (!localKnowledgePromise) {
    localKnowledgePromise = loadLocalKnowledge();
  }

  return localKnowledgePromise;
};

const getAzureProjectClient = (): OpenAI | null => {
  const endpoint = trim(process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT);
  const apiKey = trim(process.env.AZURE_AI_FOUNDRY_KEY) || trim(process.env.AZURE_OPENAI_COMPLETIONS_KEY);

  if (!endpoint || !apiKey) {
    return null;
  }

  return new OpenAI({
    baseURL: endpoint.replace(/\/$/, ''),
    apiKey,
  });
};

/**
 * Resolve the base URL of the Foundry *project* responses surface, which is where
 * the Foundry IQ agent (agent_reference) actually lives. This is intentionally
 * different from AZURE_EXISTING_AIPROJECT_ENDPOINT (the openai.azure.com surface),
 * because agent calls must go to the project endpoint
 * (…services.ai.azure.com/api/projects/<project>/openai/v1).
 */
const resolveAgentBaseUrl = (): string => {
  const explicit = trim(process.env.AZURE_FOUNDRY_IQ_ENDPOINT);
  if (explicit) {
    return explicit.replace(/\/(responses)\/?$/i, '').replace(/\/$/, '');
  }

  const completions = trim(process.env.AZURE_OPENAI_COMPLETIONS_ENDPOINT);
  if (completions) {
    // e.g. …/openai/v1/responses → …/openai/v1
    return completions.replace(/\/(responses)\/?$/i, '').replace(/\/$/, '');
  }

  const projectEndpoint = trim(process.env.AZURE_AI_FOUNDRY_ENDPOINT);
  if (projectEndpoint) {
    const base = projectEndpoint.replace(/\/$/, '');
    return /\/openai\/v\d+$/i.test(base) ? base : `${base}/openai/v1`;
  }

  return '';
};

const getAgentApiKey = (): string =>
  trim(process.env.AZURE_AI_FOUNDRY_KEY)
  || trim(process.env.AZURE_OPENAI_COMPLETIONS_KEY)
  || trim(process.env.AZURE_OPENAI_KEY);

/**
 * Build the Foundry agent client. Prefers a Microsoft Entra ID bearer token
 * (required when the agent's tools use OBO auth); otherwise uses the API key.
 * The OpenAI SDK sends the provided credential as `Authorization: Bearer <value>`,
 * which Azure accepts for both API keys and Entra tokens on the v1 surface.
 */
const getAzureAgentClient = (bearer?: string | null): OpenAI | null => {
  const baseURL = resolveAgentBaseUrl();
  const apiKey = bearer || getAgentApiKey();

  if (!baseURL || !apiKey) {
    return null;
  }

  return new OpenAI({
    baseURL,
    apiKey,
  });
};

const hasRemoteIQAgent = (): boolean =>
  Boolean(resolveAgentBaseUrl() && getAgentApiKey() && getIqAgentName());


const buildChronologySummary = (chronology: IQChronologyEntry[] | undefined): string => {
  if (!chronology || chronology.length === 0) {
    return 'Keine vorherige Szenen-Chronologie uebergeben.';
  }

  return chronology
    .slice(0, 8)
    .map((entry) => [
      `Szene ${entry.sceneIndex + 1}`,
      trim(entry.sceneTitle) || 'ohne Titel',
      trim(entry.sceneBeat) ? `Beat ${trim(entry.sceneBeat)}` : '',
      trim(entry.action),
      trim(entry.continuityNotes) ? `Kontinuitaet: ${trim(entry.continuityNotes)}` : '',
    ].filter(Boolean).join(' · '))
    .join('\n');
};

const buildIQQuery = (context: IQSceneContext): string => {
  if (context.mode === 'thumbnail') {
    return [
      'Welche kuratierten ARV-Style-Regeln, Paletten und Titelmuster gelten fuer ein YouTube-Livestream-Thumbnail von Audioreworkvisions / Techno Transmissions?',
      'Welche Negative Rules und verbotenen Stilbrueche muessen fuer ein Techno-Thumbnail beachtet werden?',
      'Welche Prompt-DNA-Fragmente und Layout-Muster passen zu einem 16:9 Techno-Thumbnail mit lokal gerendertem Titeltext?',
    ].join(' ');
  }

  const queryParts = [
    `Welche ARV-Regeln, Pattern und dramaturgischen Hinweise gelten fuer diese ${context.mode === 'stillframe' ? 'Stillframe-' : 'Story-'}Szene?`,
    'Welche visuellen Motive, Material- und Farbregeln muessen erhalten bleiben?',
    context.mode === 'story'
      ? 'Welche Kontinuitaet aus frueheren Szenen, Motiven und Weltregeln darf nicht gebrochen werden?'
      : 'Welche Variation ist fuer diesen Render erlaubt, ohne die Stil-DNA zu verlieren?',
    context.purpose === 'extend'
      ? 'Welche Bewegungs-, Kamera- und Kontinuitaetslogik muss fuer eine Video-Extension unbedingt weitergefuehrt werden?'
      : context.purpose === 'remix'
      ? 'Welche Variationen sind fuer einen Remix erlaubt und welche Abweichungen sollten vermieden werden?'
      : 'Welche verbotenen Abweichungen oder Stilbrueche sollten vermieden werden?',
  ];

  return queryParts.join(' ');
};

const buildContextSummary = (context: IQSceneContext): string => [
  `Modus: ${context.mode}`,
  `Ziel: ${context.renderTarget}`,
  `Zweck: ${context.purpose}`,
  trim(context.storyTitle) ? `Story-Titel: ${trim(context.storyTitle)}` : '',
  trim(context.storyConcept) ? `Story-Konzept: ${trim(context.storyConcept)}` : '',
  trim(context.settingDescription) ? `Setting: ${trim(context.settingDescription)}` : '',
  trim(context.characterDefinition) ? `Charaktere: ${trim(context.characterDefinition)}` : '',
  trim(context.tone) ? `Ton: ${trim(context.tone)}` : '',
  Number.isFinite(context.sceneIndex) ? `Szenenindex: ${context.sceneIndex! + 1}` : '',
  trim(context.sceneTitle) ? `Szenentitel: ${trim(context.sceneTitle)}` : '',
  trim(context.sceneBeat) ? `Beat: ${trim(context.sceneBeat)}` : '',
  trim(context.action) ? `Aktion: ${trim(context.action)}` : '',
  trim(context.motion) ? `Motion: ${trim(context.motion)}` : '',
  trim(context.continuityNotes) ? `Kontinuitaet: ${trim(context.continuityNotes)}` : '',
  trim(context.presetId) ? `Preset-ID: ${trim(context.presetId)}` : '',
  trim(context.presetName) ? `Preset-Name: ${trim(context.presetName)}` : '',
  context.stylePresetIds && context.stylePresetIds.length > 0 ? `Style-Presets: ${context.stylePresetIds.join(', ')}` : '',
  trim(context.referenceStyleSummary) ? `Referenz-DNA: ${trim(context.referenceStyleSummary)}` : '',
  trim(context.referenceStylePalette) ? `Referenz-Palette: ${trim(context.referenceStylePalette)}` : '',
  trim(context.referenceStyleMotion) ? `Referenz-Motion: ${trim(context.referenceStyleMotion)}` : '',
  trim(context.remixVideoId) ? `Quellvideo: ${trim(context.remixVideoId)}` : '',
  `Prompt-Core: ${normalizeWhitespace(context.prompt)}`,
  `Chronologie:\n${buildChronologySummary(context.chronology)}`,
].filter(Boolean).join('\n');

const extractJsonObject = (raw: string): IQStructuredResult | null => {
  try {
    return JSON.parse(raw) as IQStructuredResult;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as IQStructuredResult;
      } catch {
        return null;
      }
    }
  }

  return null;
};

const toBrief = (
  provider: IQBrief['provider'],
  query: string,
  structured: IQStructuredResult,
  citations: IQCitation[],
  usedRemote: boolean,
): IQBrief | null => {
  const styleRules = uniqueList(structured.styleRules ?? [], 4);
  const patterns = uniqueList(structured.patterns ?? [], 4);
  const dramaturgy = uniqueList(structured.dramaturgy ?? [], 4);
  const continuity = uniqueList(structured.continuity ?? [], 4);
  const forbidden = uniqueList(structured.forbidden ?? [], 4);

  if (
    styleRules.length === 0
    && patterns.length === 0
    && dramaturgy.length === 0
    && continuity.length === 0
    && forbidden.length === 0
  ) {
    return null;
  }

  const promptLines = [
    'IQ_BRIEF:',
    styleRules.length > 0 ? `- Stilregeln: ${styleRules.join(' | ')}` : '',
    patterns.length > 0 ? `- Pattern: ${patterns.join(' | ')}` : '',
    dramaturgy.length > 0 ? `- Dramaturgie: ${dramaturgy.join(' | ')}` : '',
    continuity.length > 0 ? `- Kontinuitaet: ${continuity.join(' | ')}` : '',
    forbidden.length > 0 ? `- Verbotene Abweichungen: ${forbidden.join(' | ')}` : '',
    citations.length > 0 ? `- Quellen: ${citations.map((citation) => citation.source).join(' | ')}` : '',
  ].filter(Boolean);

  return {
    provider,
    query,
    promptBlock: promptLines.join('\n'),
    styleRules,
    patterns,
    dramaturgy,
    continuity,
    forbidden,
    citations,
    usedRemote,
  };
};

const extractResponseText = (response: any): string => {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const output = Array.isArray(response?.output) ? response.output : [];
  const parts = output.flatMap((item: any) => {
    if (!Array.isArray(item?.content)) {
      return [];
    }

    return item.content.flatMap((entry: any) => {
      if (typeof entry?.text === 'string') {
        return [entry.text];
      }
      if (typeof entry?.content === 'string') {
        return [entry.content];
      }
      return [];
    });
  });

  return parts.join('\n').trim();
};

const extractChatText = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }
        if (entry && typeof entry === 'object' && 'text' in entry && typeof (entry as any).text === 'string') {
          return (entry as any).text;
        }
        return '';
      })
      .join('');
  }

  return '';
};

const scoreChunk = (chunk: IQKnowledgeChunk, context: IQSceneContext, queryTokens: string[]): number => {
  let score = 0;
  const chunkTokenSet = new Set(chunk.keywords);

  for (const token of queryTokens) {
    if (chunkTokenSet.has(token)) {
      score += 2;
    }
    if (chunk.text.toLowerCase().includes(token)) {
      score += 1;
    }
  }

  if (context.mode === 'stillframe' && /stillframe|arv-style|ARV\//i.test(chunk.source)) {
    score += 2;
  }

  if (context.mode === 'story' && /story|prompt_storys|story-generation/i.test(chunk.source)) {
    score += 2;
  }

  if (context.mode === 'thumbnail' && /arv-style|ARV\/|style-pack|thumbnail|techno|audio_titel/i.test(chunk.source)) {
    score += 2;
  }

  if (context.purpose === 'remix' && /variation|avoid|pattern|motion|color|material/i.test(chunk.text)) {
    score += 2;
  }

  if (context.purpose === 'extend' && /continuity|continue|camera|motion|sequence|transition|after|before/i.test(chunk.text)) {
    score += 2;
  }

  if (chunk.source.endsWith('memories/repo/arv-style.md')) {
    score += 3;
  }

  if (chunk.category === 'continuity' && context.mode === 'story') {
    score += 2;
  }

  if (chunk.category === 'pattern' && context.referenceStyleSummary) {
    score += 1;
  }

  return score;
};

const selectLocalChunks = async (context: IQSceneContext, query: string): Promise<IQKnowledgeChunk[]> => {
  const chunks = await getLocalKnowledge();
  const queryTokens = tokenize([query, buildContextSummary(context)].join(' '));

  return chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, context, queryTokens) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_LOCAL_RESULTS)
    .map((entry) => entry.chunk);
};

const buildLocalFallbackPrompt = (context: IQSceneContext, query: string, chunks: IQKnowledgeChunk[]): string => {
  const chunkText = chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.source}\n${chunk.text}`)
    .join('\n\n');

  return [
    'Erzeuge ein kompaktes, extraktives Szene-Briefing fuer ein Render-System.',
    'Nutze ausschliesslich die gelieferten Wissensauszuege. Erfinde keine Regeln oder Quellen.',
    'Antworte nur mit gueltigem JSON in dieser Form:',
    '{"styleRules":["..."],"patterns":["..."],"dramaturgy":["..."],"continuity":["..."],"forbidden":["..."]}',
    '',
    `Abfrage: ${query}`,
    buildContextSummary(context),
    '',
    'Wissensauszuege:',
    chunkText,
  ].join('\n');
};

const buildHeuristicBrief = (query: string, chunks: IQKnowledgeChunk[]): IQBrief | null => {
  const styleRules = uniqueList(
    chunks.filter((chunk) => chunk.category === 'style' || chunk.source.endsWith('memories/repo/arv-style.md')).map((chunk) => chunk.text),
    3,
  );
  const patterns = uniqueList(
    chunks.filter((chunk) => chunk.category === 'pattern' || chunk.source.startsWith('ARV/')).map((chunk) => chunk.text),
    3,
  );
  const dramaturgy = uniqueList(
    chunks.filter((chunk) => chunk.category === 'narrative').map((chunk) => chunk.text),
    3,
  );
  const continuity = uniqueList(
    chunks.filter((chunk) => chunk.category === 'continuity').map((chunk) => chunk.text),
    3,
  );
  const forbidden = uniqueList(
    chunks.filter((chunk) => /avoid|verbot|forbidden|don't|do not/i.test(chunk.text)).map((chunk) => chunk.text),
    3,
  );
  const citations = chunks.slice(0, 4).map((chunk) => ({ source: chunk.source, excerpt: chunk.text }));

  return toBrief('local-knowledge', query, {
    styleRules,
    patterns,
    dramaturgy,
    continuity,
    forbidden,
  }, citations, false);
};

const queryRemoteIQ = async (context: IQSceneContext, query: string): Promise<IQBrief | null> => {
  const agentName = getIqAgentName();
  if (!agentName || !resolveAgentBaseUrl()) {
    return null;
  }

  // Prefer an Entra ID token (required for OBO-auth tools); fall back to API key.
  const entraToken = await acquireAgentEntraToken();
  const client = getAzureAgentClient(entraToken);
  if (!client) {
    return null;
  }

  const response = await client.responses.create({
    input: [
      'Du bist ein IQ-Briefing-Generator fuer Hyroglyphs.',
      'Nutze die angebundene Knowledge Base als primaere Quelle und antworte nur mit gueltigem JSON.',
      'Format:',
      '{"styleRules":["..."],"patterns":["..."],"dramaturgy":["..."],"continuity":["..."],"forbidden":["..."],"citations":[{"source":"...","excerpt":"..."}]}',
      '',
      `Abfrage: ${query}`,
      buildContextSummary(context),
    ].join('\n'),
    agent_reference: {
      name: agentName,
      type: 'agent_reference',
      ...(getIqAgentVersion() ? { version: getIqAgentVersion() } : {}),
    },
  } as any);

  const rawText = extractResponseText(response);
  const parsed = extractJsonObject(rawText);

  if (!parsed) {
    return toBrief('foundry-iq-agent', query, {
      styleRules: rawText ? [rawText] : [],
    }, [], true);
  }

  const citations = (parsed.citations ?? [])
    .map((citation) => ({
      source: trim(citation.source),
      excerpt: trim(citation.excerpt),
    }))
    .filter((citation) => citation.source.length > 0 && citation.excerpt.length > 0)
    .slice(0, 5);

  return toBrief('foundry-iq-agent', query, parsed, citations, true);
};

const queryLocalKnowledge = async (context: IQSceneContext, query: string): Promise<IQBrief | null> => {
  const localChunks = await selectLocalChunks(context, query);
  if (localChunks.length === 0) {
    return null;
  }

  const citations = localChunks.map((chunk) => ({ source: chunk.source, excerpt: chunk.text }));
  const client = getAzureProjectClient();

  if (!client) {
    return buildHeuristicBrief(query, localChunks);
  }

  try {
    const response = await client.chat.completions.create({
      model: getIqModel(),
      messages: [
        {
          role: 'developer',
          content: 'Du extrahierst nur Regeln aus den gelieferten Wissensauszuegen. Antworte ausschliesslich mit gueltigem JSON im Schema {"styleRules":[],"patterns":[],"dramaturgy":[],"continuity":[],"forbidden":[]} und halte jede Liste kurz, konkret und extraktiv.',
        },
        {
          role: 'user',
          content: buildLocalFallbackPrompt(context, query, localChunks),
        },
      ],
    } as any);

    const rawText = extractChatText(response.choices?.[0]?.message?.content ?? '');
    const parsed = extractJsonObject(rawText);
    if (!parsed) {
      return buildHeuristicBrief(query, localChunks);
    }

    return toBrief('local-knowledge', query, parsed, citations.slice(0, 5), false);
  } catch {
    return buildHeuristicBrief(query, localChunks);
  }
};

export async function resolveIQBrief(context: IQSceneContext): Promise<IQBrief | null> {
  const normalizedPrompt = normalizeWhitespace(context.prompt);
  if (!normalizedPrompt) {
    return null;
  }

  const normalizedContext: IQSceneContext = {
    ...context,
    prompt: normalizedPrompt,
  };
  const query = buildIQQuery(normalizedContext);

  const iqProvider = getIqProvider();
  if (iqProvider === 'off' || iqProvider === 'disabled') {
    return null;
  }

  if (iqProvider === 'remote' || (iqProvider === 'auto' && hasRemoteIQAgent())) {
    try {
      const remoteBrief = await queryRemoteIQ(normalizedContext, query);
      if (remoteBrief) {
        return remoteBrief;
      }
      console.warn('[iq] Foundry IQ remote agent returned no brief — falling back to local knowledge.');
    } catch (error) {
      console.warn(
        '[iq] Foundry IQ remote agent call failed — falling back to local knowledge:',
        error instanceof Error ? `${error.name}: ${error.message}` : error,
      );
    }
  }

  return queryLocalKnowledge(normalizedContext, query);
}

export const normalizeIQChronology = (value: unknown): IQChronologyEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: IQChronologyEntry[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const draft = entry as Record<string, unknown>;
    const sceneIndex = Number.isFinite(Number(draft.sceneIndex)) ? Number(draft.sceneIndex) : index;

    entries.push({
      sceneIndex,
      sceneTitle: trim(typeof draft.sceneTitle === 'string' ? draft.sceneTitle : ''),
      sceneBeat: trim(typeof draft.sceneBeat === 'string' ? draft.sceneBeat : ''),
      action: trim(typeof draft.action === 'string' ? draft.action : ''),
      continuityNotes: trim(typeof draft.continuityNotes === 'string' ? draft.continuityNotes : ''),
    });
  }

  return entries;
};

export const mergeIQSceneContext = (defaults: IQSceneContext, value: unknown): IQSceneContext => {
  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const draft = value as Record<string, unknown>;
  const chronology = normalizeIQChronology(draft.chronology);
  const stylePresetIds = Array.isArray(draft.stylePresetIds)
    ? uniqueList(draft.stylePresetIds.map((entry) => (typeof entry === 'string' ? entry : '')), 8)
    : defaults.stylePresetIds;

  return {
    ...defaults,
    prompt: trim(typeof draft.prompt === 'string' ? draft.prompt : '') || defaults.prompt,
    sceneIndex: Number.isFinite(Number(draft.sceneIndex)) ? Number(draft.sceneIndex) : defaults.sceneIndex,
    sceneTitle: trim(typeof draft.sceneTitle === 'string' ? draft.sceneTitle : '') || defaults.sceneTitle,
    sceneBeat: trim(typeof draft.sceneBeat === 'string' ? draft.sceneBeat : '') || defaults.sceneBeat,
    action: trim(typeof draft.action === 'string' ? draft.action : '') || defaults.action,
    motion: trim(typeof draft.motion === 'string' ? draft.motion : '') || defaults.motion,
    continuityNotes: trim(typeof draft.continuityNotes === 'string' ? draft.continuityNotes : '') || defaults.continuityNotes,
    storyTitle: trim(typeof draft.storyTitle === 'string' ? draft.storyTitle : '') || defaults.storyTitle,
    storyConcept: trim(typeof draft.storyConcept === 'string' ? draft.storyConcept : '') || defaults.storyConcept,
    settingDescription: trim(typeof draft.settingDescription === 'string' ? draft.settingDescription : '') || defaults.settingDescription,
    characterDefinition: trim(typeof draft.characterDefinition === 'string' ? draft.characterDefinition : '') || defaults.characterDefinition,
    tone: trim(typeof draft.tone === 'string' ? draft.tone : '') || defaults.tone,
    presetId: trim(typeof draft.presetId === 'string' ? draft.presetId : '') || defaults.presetId,
    presetName: trim(typeof draft.presetName === 'string' ? draft.presetName : '') || defaults.presetName,
    stylePresetIds,
    referenceStyleSummary: trim(typeof draft.referenceStyleSummary === 'string' ? draft.referenceStyleSummary : '') || defaults.referenceStyleSummary,
    referenceStylePalette: trim(typeof draft.referenceStylePalette === 'string' ? draft.referenceStylePalette : '') || defaults.referenceStylePalette,
    referenceStyleMotion: trim(typeof draft.referenceStyleMotion === 'string' ? draft.referenceStyleMotion : '') || defaults.referenceStyleMotion,
    remixVideoId: trim(typeof draft.remixVideoId === 'string' ? draft.remixVideoId : '') || defaults.remixVideoId,
    chronology: chronology.length > 0 ? chronology : defaults.chronology,
  };
};

export const normalizeIQBriefForDebug = (brief: IQBrief | null) => brief;

