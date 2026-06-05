import { GoogleGenAI } from '@google/genai';
import { Router } from 'express';
import { buildStoryboardRequestPrompt } from '../../lib/promptTemplates';
import { generateStorySequence } from '../../lib/storyGenerator';
import { asNonEmptyString, toErrorMessage } from '../utils/http';

const GEMINI_STORYBOARD_MODEL = 'gemini-3-flash-preview';
const GEMINI_VIDEO_MODEL = 'veo-3.1-fast-generate-preview';
const GEMINI_VIDEO_MAX_WAIT_MS = 5 * 60 * 1000;
const GEMINI_VIDEO_POLL_INTERVAL_MS = 5000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getGeminiApiKey = (): string => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing. Please add it to .env.local.');
  }

  return apiKey;
};

const getGeminiClient = (): GoogleGenAI => {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() });
};

const pollVideoOperation = async (ai: GoogleGenAI, operation: any) => {
  const startedAt = Date.now();
  let currentOperation = operation;

  while (!currentOperation.done) {
    if (Date.now() - startedAt > GEMINI_VIDEO_MAX_WAIT_MS) {
      throw new Error('Gemini video generation timed out.');
    }

    await sleep(GEMINI_VIDEO_POLL_INTERVAL_MS);
    currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation });
  }

  return currentOperation;
};

const fetchVideoAsDataUrl = async (uri: string): Promise<string> => {
  const apiKey = getGeminiApiKey();
  const response = await fetch(uri, {
    headers: {
      'x-goog-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const fallbackUrl = new URL(uri);
    fallbackUrl.searchParams.set('key', apiKey);
    const fallbackResponse = await fetch(fallbackUrl);
    if (!fallbackResponse.ok) {
      throw new Error(`Failed to fetch Gemini video: ${fallbackResponse.statusText}`);
    }

    const fallbackBuffer = Buffer.from(await fallbackResponse.arrayBuffer());
    return `data:video/mp4;base64,${fallbackBuffer.toString('base64')}`;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:video/mp4;base64,${buffer.toString('base64')}`;
};

export const createGeminiRoutes = () => {
  const router = Router();

  router.post('/api/gemini/storyboard', async (req, res) => {
    try {
      const { prompt, presetId, promptTemplateId, storyArcMode } = req.body || {};
      const userPrompt = asNonEmptyString(prompt);

      if (!userPrompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const storyboardPromptDebug = buildStoryboardRequestPrompt(userPrompt, {
        promptTemplateId: asNonEmptyString(promptTemplateId),
      });
      const storyboardPrompt = storyboardPromptDebug.normalizedPrompt || userPrompt;

      const story = await generateStorySequence(
        getGeminiApiKey(),
        storyboardPrompt,
        asNonEmptyString(presetId) || undefined,
        storyArcMode === 'cinematic' ? 'cinematic' : 'iconic',
      );

      return res.json({
        success: true,
        model: GEMINI_STORYBOARD_MODEL,
        story,
        debug: {
          storyboardPrompt: storyboardPromptDebug,
        },
      });
    } catch (error) {
      console.error('Error generating Gemini storyboard:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Gemini storyboard generation failed') });
    }
  });

  router.post('/api/gemini/video', async (req, res) => {
    try {
      const { prompt, aspectRatio, resolution } = req.body || {};
      const userPrompt = asNonEmptyString(prompt);

      if (!userPrompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const selectedAspectRatio = asNonEmptyString(aspectRatio) || '16:9';
      const selectedResolution = asNonEmptyString(resolution) || '720p';
      const ai = getGeminiClient();

      const operation = await ai.models.generateVideos({
        model: GEMINI_VIDEO_MODEL,
        prompt: userPrompt,
        config: {
          numberOfVideos: 1,
          resolution: selectedResolution,
          aspectRatio: selectedAspectRatio,
        },
      });

      const finalOperation = await pollVideoOperation(ai, operation);
      if (finalOperation.error) {
        const errorMessage = (finalOperation.error as { message?: string } | undefined)?.message;
        throw new Error(errorMessage || 'Gemini video generation failed.');
      }

      const videoUri = finalOperation.response?.generatedVideos?.[0]?.video?.uri;
      if (!videoUri) {
        throw new Error('Gemini video generation returned no video URI.');
      }

      const videoBase64 = await fetchVideoAsDataUrl(videoUri);

      return res.json({
        success: true,
        model: GEMINI_VIDEO_MODEL,
        aspectRatio: selectedAspectRatio,
        resolution: selectedResolution,
        videoBase64,
      });
    } catch (error) {
      console.error('Error generating Gemini video:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Gemini video generation failed') });
    }
  });

  return router;
};
