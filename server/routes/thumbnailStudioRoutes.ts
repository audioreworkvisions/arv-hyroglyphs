/**
 * ARV Thumbnail Studio — Express routes.
 *
 * Mounted via createThumbnailStudioRoutes() in server/index.ts. Uses only Azure
 * AI Foundry / Azure OpenAI / Foundry IQ. Every handler has robust error handling
 * and degrades gracefully when Azure / Foundry IQ are not configured.
 */

import { Router } from 'express';
import {
  foundryImageGenerate,
} from '../../services/foundryService';
import type {
  ThumbnailBackgroundResult,
  ThumbnailMemoryCard,
  ThumbnailMode,
  ThumbnailRenderRequest,
  ThumbnailStudioHealth,
  ThumbnailStudioRequest,
  ThumbnailStudioSession,
  ThumbnailTextOverlayConfig,
  ThumbnailUploadedImage,
} from '../../lib/thumbnailTypes';
import { THUMBNAIL_MODES } from '../../lib/thumbnailTypes';
import { asNonEmptyString, toErrorMessage } from '../utils/http';
import {
  isFoundryIqConfigured,
  normalizeMemorySearchInput,
  resolveThumbnailCreativeMemory,
} from '../services/foundryIqMemoryService';
import { analyzeThumbnailReferences } from '../services/thumbnailReferenceService';
import {
  buildStyleProfileFromAnalysis,
  resolveStyleProfile,
  saveStyleProfile,
} from '../services/thumbnailStyleProfileService';
import { generateThumbnailConcept } from '../services/thumbnailConceptService';
import { renderThumbnail } from '../services/thumbnailRenderService';
import {
  listRecentSessions,
  loadSession,
  saveSession,
  writeMemoryCard,
} from '../services/thumbnailMemoryService';
import { createId, getThumbnailDataDir } from '../services/thumbnailPaths';

const isAzureTextConfigured = (): boolean => {
  const endpoint = (process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT || process.env.AZURE_AI_FOUNDRY_ENDPOINT || '').trim();
  const key = (process.env.AZURE_AI_FOUNDRY_KEY || process.env.AZURE_OPENAI_COMPLETIONS_KEY || process.env.OPENAI_API_KEY || '').trim();
  return Boolean(endpoint && key) || Boolean((process.env.OPENAI_API_KEY || '').trim());
};

const isAzureImageConfigured = (): boolean => {
  const key = (process.env.AZURE_OPENAI_KEY || process.env.AZURE_AI_FOUNDRY_KEY || '').trim();
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT || '').trim();
  return Boolean(key && endpoint);
};

const normalizeMoodList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
    .slice(0, 10);
};

const normalizeUploadedImages = (value: unknown): ThumbnailUploadedImage[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry): ThumbnailUploadedImage | null => {
      if (!entry || typeof entry !== 'object') return null;
      const draft = entry as Record<string, unknown>;
      const dataUrl = asNonEmptyString(draft.dataUrl);
      if (!dataUrl) return null;
      return {
        fileName: asNonEmptyString(draft.fileName) || 'upload',
        dataUrl,
      };
    })
    .filter((entry): entry is ThumbnailUploadedImage => Boolean(entry))
    .slice(0, 80);
};

const normalizeThumbnailMode = (value: unknown): ThumbnailMode => {
  const candidate = asNonEmptyString(value) as ThumbnailMode | null;
  return candidate && (THUMBNAIL_MODES as readonly string[]).includes(candidate)
    ? candidate
    : 'final-composed-thumbnail';
};

const normalizeStudioRequest = (body: unknown): ThumbnailStudioRequest => {
  const draft = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const variantCount = Number(draft.variantCount);
  return {
    title: asNonEmptyString(draft.title) || undefined,
    theme: asNonEmptyString(draft.theme) || undefined,
    genre: asNonEmptyString(draft.genre) || undefined,
    mood: normalizeMoodList(draft.mood),
    streamNumber: asNonEmptyString(draft.streamNumber) || undefined,
    variantCount: Number.isFinite(variantCount) && variantCount > 0 ? Math.min(20, Math.round(variantCount)) : 10,
    thumbnailMode: normalizeThumbnailMode(draft.thumbnailMode),
    styleProfileId: asNonEmptyString(draft.styleProfileId) || undefined,
    useFoundryIq: typeof draft.useFoundryIq === 'boolean' ? draft.useFoundryIq : true,
  };
};

const normalizeTextOverlayPatch = (value: unknown): Partial<ThumbnailTextOverlayConfig> => {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const draft = value as Record<string, unknown>;
  const patch: Partial<ThumbnailTextOverlayConfig> = {};
  if (asNonEmptyString(draft.topline)) patch.topline = String(draft.topline);
  if (asNonEmptyString(draft.mainTitle)) patch.mainTitle = String(draft.mainTitle);
  if (asNonEmptyString(draft.subtitle)) patch.subtitle = String(draft.subtitle);
  if (asNonEmptyString(draft.footer)) patch.footer = String(draft.footer);
  if (asNonEmptyString(draft.streamNumber)) patch.streamNumber = String(draft.streamNumber);
  if (asNonEmptyString(draft.fontStyle)) patch.fontStyle = String(draft.fontStyle);
  if (asNonEmptyString(draft.colorLogic)) patch.colorLogic = String(draft.colorLogic);
  const textStyle = asNonEmptyString(draft.textStyle);
  if (textStyle === 'brutal-industrial' || textStyle === 'signal-minimal' || textStyle === 'arv-transmission') {
    patch.textStyle = textStyle;
  }
  const localOverlay = asNonEmptyString(draft.localOverlay);
  if (localOverlay === 'none' || localOverlay === 'minimal' || localOverlay === 'full') {
    patch.localOverlay = localOverlay;
  }
  if (Array.isArray(draft.icons)) {
    patch.icons = draft.icons
      .map((icon) => asNonEmptyString(icon))
      .filter((icon): icon is 'peace' | 'heart' | 'vinyl' =>
        icon === 'peace' || icon === 'heart' || icon === 'vinyl');
  }
  return patch;
};

export const createThumbnailStudioRoutes = () => {
  const router = Router();

  /** GET /api/thumbnail-studio/health */
  router.get('/api/thumbnail-studio/health', (_req, res) => {
    const azureTextConfigured = isAzureTextConfigured();
    const azureImageConfigured = isAzureImageConfigured();
    const foundryIqConfigured = isFoundryIqConfigured();
    const health: ThumbnailStudioHealth = {
      ok: true,
      azureTextConfigured,
      azureImageConfigured,
      foundryIqConfigured,
      dataDir: getThumbnailDataDir(),
      capabilities: {
        referenceAnalysis: true,
        titleGeneration: true,
        backgroundGeneration: azureImageConfigured,
        localRender: true,
      },
    };
    return res.json(health);
  });

  /** POST /api/thumbnail-studio/analyze-references */
  router.post('/api/thumbnail-studio/analyze-references', async (req, res) => {
    try {
      const folderPath = asNonEmptyString(req.body?.folderPath) || undefined;
      const uploadedImages = normalizeUploadedImages(req.body?.uploadedImages);

      const analysis = await analyzeThumbnailReferences({ folderPath, uploadedImages });
      const styleProfile = buildStyleProfileFromAnalysis(analysis);

      let savedPath: string | null = null;
      if (analysis.analyzedCount > 0) {
        try {
          savedPath = await saveStyleProfile(styleProfile);
        } catch (saveError) {
          analysis.warnings.push(`Style profile could not be persisted: ${toErrorMessage(saveError)}`);
        }
      }

      return res.json({ success: true, analysis, styleProfile, savedPath });
    } catch (error) {
      console.error('Thumbnail analyze-references error:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Reference analysis failed') });
    }
  });

  /** POST /api/thumbnail-studio/memory/search */
  router.post('/api/thumbnail-studio/memory/search', async (req, res) => {
    try {
      const input = normalizeMemorySearchInput(req.body);
      const styleProfile = await resolveStyleProfile(asNonEmptyString(req.body?.styleProfileId) || undefined);
      const memory = await resolveThumbnailCreativeMemory({ ...input, styleProfile });
      return res.json({ success: true, memory });
    } catch (error) {
      console.error('Thumbnail memory/search error:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Foundry IQ memory search failed') });
    }
  });

  /** POST /api/thumbnail-studio/generate-concept */
  router.post('/api/thumbnail-studio/generate-concept', async (req, res) => {
    try {
      const input = normalizeStudioRequest(req.body);
      const styleProfile = await resolveStyleProfile(input.styleProfileId);

      const memory = await resolveThumbnailCreativeMemory({
        title: input.title,
        theme: input.theme,
        genre: typeof input.genre === 'string' ? input.genre : undefined,
        mood: input.mood as string[],
        referenceSummary: styleProfile.summary,
        styleProfile,
        useFoundryIq: input.useFoundryIq,
      });

      const concept = await generateThumbnailConcept({
        title: input.title,
        theme: input.theme,
        genre: typeof input.genre === 'string' ? input.genre : undefined,
        mood: input.mood as string[],
        streamNumber: input.streamNumber,
        variantCount: input.variantCount ?? 10,
        thumbnailMode: input.thumbnailMode ?? 'final-composed-thumbnail',
        styleProfile,
        memory,
      });

      const session: ThumbnailStudioSession = {
        id: createId('session'),
        createdAt: new Date().toISOString(),
        input,
        styleProfile,
        foundryIqMemory: memory,
        concept,
        background: null,
        render: null,
        exports: [],
      };

      try {
        await saveSession(session);
      } catch (persistError) {
        console.warn('Thumbnail session not persisted:', toErrorMessage(persistError));
      }

      return res.json({ success: true, sessionId: session.id, concept, memory, styleProfile });
    } catch (error) {
      console.error('Thumbnail generate-concept error:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Concept generation failed') });
    }
  });

  /** POST /api/thumbnail-studio/generate-background */
  router.post('/api/thumbnail-studio/generate-background', async (req, res) => {
    const backgroundPrompt = asNonEmptyString(req.body?.backgroundPrompt);
    if (!backgroundPrompt) {
      return res.status(400).json({ error: 'backgroundPrompt is required.' });
    }

    if (!isAzureImageConfigured()) {
      const unavailable: ThumbnailBackgroundResult = {
        available: false,
        imageDataUrl: null,
        model: null,
        provider: 'none',
        note: 'background generation unavailable — Azure image generation is not configured. Upload your own background instead.',
      };
      return res.json({ success: true, background: unavailable });
    }

    try {
      const size = asNonEmptyString(req.body?.size) || '1792x1024';
      const negativePrompt = asNonEmptyString(req.body?.negativePrompt);
      const composedPrompt = negativePrompt
        ? `${backgroundPrompt}\n\nAvoid: ${negativePrompt}`
        : backgroundPrompt;

      const result = await foundryImageGenerate({ prompt: composedPrompt, size, quality: 'high' });
      const background: ThumbnailBackgroundResult = {
        available: true,
        imageDataUrl: result.imageData,
        model: result.model,
        provider: 'foundry',
        revisedPrompt: result.revisedPrompt,
        note: 'Background generated with Azure AI Foundry image generation.',
      };
      return res.json({ success: true, background });
    } catch (error) {
      console.error('Thumbnail generate-background error:', error);
      const fallback: ThumbnailBackgroundResult = {
        available: false,
        imageDataUrl: null,
        model: null,
        provider: 'none',
        note: `background generation unavailable — ${toErrorMessage(error)}. Upload your own background instead.`,
      };
      return res.json({ success: true, background: fallback });
    }
  });

  /** POST /api/thumbnail-studio/render */
  router.post('/api/thumbnail-studio/render', async (req, res) => {
    try {
      const title = asNonEmptyString(req.body?.title);
      if (!title) {
        return res.status(400).json({ error: 'title is required for rendering.' });
      }

      const renderRequest: ThumbnailRenderRequest = {
        backgroundImagePath: asNonEmptyString(req.body?.backgroundImagePath) || undefined,
        backgroundDataUrl: asNonEmptyString(req.body?.backgroundDataUrl) || undefined,
        title,
        subtitle: asNonEmptyString(req.body?.subtitle) || undefined,
        topline: asNonEmptyString(req.body?.topline) || undefined,
        footer: asNonEmptyString(req.body?.footer) || undefined,
        streamNumber: asNonEmptyString(req.body?.streamNumber) || undefined,
        layout: normalizeTextOverlayPatch(req.body?.layout),
        outputFormat: req.body?.outputFormat === 'jpg' ? 'jpg' : 'png',
      };

      const render = await renderThumbnail(renderRequest);

      const sessionId = asNonEmptyString(req.body?.sessionId);
      if (sessionId) {
        try {
          const session = await loadSession(sessionId);
          if (session) {
            session.render = render;
            session.exports = Array.from(new Set([...(session.exports || []), render.fileName]));
            await saveSession(session);
          }
        } catch (persistError) {
          console.warn('Thumbnail render not attached to session:', toErrorMessage(persistError));
        }
      }

      return res.json({ success: true, render });
    } catch (error) {
      console.error('Thumbnail render error:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Thumbnail rendering failed') });
    }
  });

  /** POST /api/thumbnail-studio/memory/write */
  router.post('/api/thumbnail-studio/memory/write', async (req, res) => {
    try {
      const rawCard = req.body?.memoryCard;
      if (!rawCard || typeof rawCard !== 'object') {
        return res.status(400).json({ error: 'memoryCard is required.' });
      }

      const card = rawCard as Record<string, unknown>;
      const title = asNonEmptyString(card.title);
      if (!title) {
        return res.status(400).json({ error: 'memoryCard.title is required.' });
      }

      const overlay = (card.textOverlay && typeof card.textOverlay === 'object'
        ? card.textOverlay
        : {}) as Partial<ThumbnailTextOverlayConfig>;

      const memoryCard: ThumbnailMemoryCard = {
        type: 'thumbnail_memory',
        brand: asNonEmptyString(card.brand) || 'Audioreworkvisions',
        title,
        theme: asNonEmptyString(card.theme) || '',
        genre: asNonEmptyString(card.genre) || '',
        mood: normalizeMoodList(card.mood),
        palette: Array.isArray(card.palette)
          ? card.palette.map((entry) => String(entry)).filter(Boolean).slice(0, 12)
          : [],
        layout: asNonEmptyString(card.layout) || '',
        whatGenerated: asNonEmptyString(card.whatGenerated) || '',
        whatWorked: asNonEmptyString(card.whatWorked) || '',
        avoidNextTime: asNonEmptyString(card.avoidNextTime) || '',
        backgroundPrompt: asNonEmptyString(card.backgroundPrompt) || '',
        negativePrompt: asNonEmptyString(card.negativePrompt) || '',
        textOverlay: {
          topline: overlay.topline || 'TECHNO TRANSMISSIONS',
          mainTitle: overlay.mainTitle || title,
          subtitle: overlay.subtitle || '',
          footer: overlay.footer || 'PEACE LOVE TECHNO',
          streamNumber: overlay.streamNumber || '',
          position: overlay.position || 'center',
          safeArea: overlay.safeArea ?? true,
          fontStyle: overlay.fontStyle || 'bold condensed industrial',
          colorLogic: overlay.colorLogic || 'off-white title with cyan/amber accents',
          textStyle: overlay.textStyle || 'arv-transmission',
          icons: overlay.icons && overlay.icons.length > 0 ? overlay.icons : ['peace', 'heart', 'vinyl'],
        },
        foundryIqSources: Array.isArray(card.foundryIqSources)
          ? card.foundryIqSources.map((entry) => String(entry)).filter(Boolean).slice(0, 12)
          : [],
        createdAt: new Date().toISOString(),
      };

      const writeLocal = req.body?.writeLocal !== false;
      const result = await writeMemoryCard(memoryCard, writeLocal);

      return res.json({ success: true, ...result, memoryCard });
    } catch (error) {
      console.error('Thumbnail memory/write error:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Memory card write failed') });
    }
  });

  /** GET /api/thumbnail-studio/history */
  router.get('/api/thumbnail-studio/history', async (_req, res) => {
    try {
      const sessions = await listRecentSessions(20);
      return res.json({ success: true, sessions });
    } catch (error) {
      console.error('Thumbnail history error:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'History lookup failed') });
    }
  });

  /** GET /api/thumbnail-studio/export/:id */
  router.get('/api/thumbnail-studio/export/:id', async (req, res) => {
    try {
      const id = asNonEmptyString(req.params?.id);
      if (!id) {
        return res.status(400).json({ error: 'Session id is required.' });
      }
      const session = await loadSession(id);
      if (!session) {
        return res.status(404).json({ error: 'Session not found.' });
      }
      return res.json({ success: true, session });
    } catch (error) {
      console.error('Thumbnail export error:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Export failed') });
    }
  });

  return router;
};
