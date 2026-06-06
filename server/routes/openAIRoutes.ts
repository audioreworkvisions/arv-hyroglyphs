import { Router } from 'express';
import OpenAI from 'openai';
import { PRESETS } from '../../lib/presets';
import { buildStoryboardRequestPrompt } from '../../lib/promptTemplates';
import { extractPromptCore, withStyleTaste } from '../../lib/styleTaste';
import { asNonEmptyString, toErrorMessage } from '../utils/http';
import {
  VIDEO_FAILURE_STATUSES,
  VIDEO_SUCCESS_STATUSES,
  asDataUrl,
  downloadOpenAIVideoDataUrl,
  normalizeImageDataUrl,
  normalizeOpenAIVideoSize,
  pickOpenAIVideoBase64,
  pickOpenAIVideoStatus,
  pickOpenAIVideoUrl,
  sleep,
} from '../utils/video';
import {
  buildStoryEngineSystemInstruction,
  parseJsonObjectFromModelText,
  sanitizeStoryboard,
} from '../utils/storyboard';
import { mergeIQSceneContext, normalizeIQBriefForDebug, resolveIQBrief } from '../utils/iq';

const OPENAI_VIDEO_POLL_INTERVAL_MS = 3000;
const OPENAI_VIDEO_MAX_WAIT_MS = 10 * 60 * 1000;
const OPENAI_VIDEO_TERMINAL_STATUSES = new Set([
  ...VIDEO_SUCCESS_STATUSES,
  ...VIDEO_FAILURE_STATUSES,
]);
const SORA_SUPPORTED_VIDEO_SECONDS = [4, 8, 12] as const;
const SORA_DEFAULT_VIDEO_SECONDS = 4;

const getOpenAITextModel = (): string => process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini';
const getOpenAIStoryboardModel = (): string => process.env.OPENAI_STORYBOARD_MODEL || getOpenAITextModel();
const getOpenAIImageModel = (): string => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const getOpenAIVideoModel = (): string => process.env.OPENAI_VIDEO_MODEL || 'sora-2';
const getAzureCompletionsEndpoint = (): string => process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT || '';
const getAzureCompletionsKey = (): string => process.env.AZURE_AI_FOUNDRY_KEY || process.env.AZURE_OPENAI_COMPLETIONS_KEY || '';
const getAzureStoryboardModel = (): string => process.env.AZURE_OPENAI_STORYBOARD_MODEL || getOpenAIStoryboardModel();

const normalizeSoraVideoSeconds = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return SORA_DEFAULT_VIDEO_SECONDS;
  }

  return SORA_SUPPORTED_VIDEO_SECONDS.reduce((closest, seconds) => {
    const closestDistance = Math.abs(closest - parsed);
    const secondsDistance = Math.abs(seconds - parsed);
    return secondsDistance < closestDistance ? seconds : closest;
  }, SORA_DEFAULT_VIDEO_SECONDS);
};

const prefersDefaultTemperature = (modelName: string): boolean =>
  /(^|[^a-z])gpt-5([.-]|$)|(^|[^a-z])gpt-5\.2([.-]|$)|(^|[^a-z])gpt-5\.2-chat([.-]|$)/i.test(modelName);

const buildStoryboardSamplingOptions = (modelName: string) =>
  prefersDefaultTemperature(modelName) ? {} : { temperature: 0.7 };

const getOpenAIClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is missing. Please add it to .env.local.');
  }
  return new OpenAI({ apiKey });
};

const postOpenAIVideoJob = async (
  path: '/videos/edits' | '/videos/extensions',
  body: Record<string, unknown>,
) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is missing. Please add it to .env.local.');
  }

  const response = await fetch(`https://api.openai.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json() as any;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message
      || payload?.message
      || `OpenAI video request failed with HTTP ${response.status}`,
    );
  }

  return payload;
};

const getAzureCompletionsClient = (): OpenAI => {
  const endpoint = getAzureCompletionsEndpoint();
  const key = getAzureCompletionsKey();

  if (!endpoint) {
    throw new Error('AZURE_EXISTING_AIPROJECT_ENDPOINT fehlt. Bitte in .env.local eintragen.');
  }
  if (!key) {
    throw new Error('AZURE_AI_FOUNDRY_KEY fehlt. Bitte in .env.local eintragen.');
  }

  return new OpenAI({
    baseURL: endpoint.replace(/\/$/, ''),
    apiKey: key,
  });
};

const hasAzureCompletions = (): boolean => Boolean(getAzureCompletionsEndpoint() && getAzureCompletionsKey());

export const createOpenAIRoutes = () => {
  const router = Router();

  router.post('/api/openai/text', async (req, res) => {
    try {
      const { prompt, instructions, model } = req.body || {};
      const userPrompt = asNonEmptyString(prompt);

      if (!userPrompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const selectedModel = asNonEmptyString(model) || getOpenAITextModel();
      const selectedInstructions = asNonEmptyString(instructions);

      const client = getOpenAIClient();
      const response = await client.responses.create({
        model: selectedModel,
        input: userPrompt,
        ...(selectedInstructions ? { instructions: selectedInstructions } : {}),
      });

      return res.json({
        success: true,
        model: selectedModel,
        text: response.output_text || '',
      });
    } catch (error) {
      console.error('Error generating OpenAI text:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'OpenAI text generation failed') });
    }
  });

  router.post('/api/openai/storyboard', async (req, res) => {
    try {
      const { prompt, presetId, promptTemplateId, model, storyArcMode } = req.body || {};
      const userPrompt = asNonEmptyString(prompt);

      if (!userPrompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const preset = asNonEmptyString(presetId)
        ? (PRESETS.find((p) => p.id === presetId) ?? null)
        : null;
      const storyboardPromptDebug = buildStoryboardRequestPrompt(userPrompt, {
        promptTemplateId: asNonEmptyString(promptTemplateId),
      });
      const storyboardPrompt = storyboardPromptDebug.normalizedPrompt || userPrompt;
      const selectedArcMode = storyArcMode === 'cinematic' ? 'cinematic' : 'iconic';
      const selectedModel = asNonEmptyString(model) || getOpenAIStoryboardModel();
      const systemInstruction = buildStoryEngineSystemInstruction(storyboardPrompt, preset, 'en', selectedArcMode);
      const modelInput = `Generate a story sequence based on this idea: "${storyboardPrompt}"`;

      let rawText: string | null = null;
      let azureUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;

      if (hasAzureCompletions()) {
        const azureClient = getAzureCompletionsClient();
        const azureModel = asNonEmptyString(model) || getAzureStoryboardModel();
        const azureResponse = await azureClient.chat.completions.create({
          model: azureModel,
          messages: [
            { role: 'developer', content: systemInstruction },
            { role: 'user', content: modelInput },
          ],
        });
        rawText = asNonEmptyString(azureResponse.choices?.[0]?.message?.content ?? null);
        if (azureResponse.usage) {
          azureUsage = {
            promptTokens: azureResponse.usage.prompt_tokens,
            completionTokens: azureResponse.usage.completion_tokens,
            totalTokens: azureResponse.usage.total_tokens,
          };
        }
      } else {
        const client = getOpenAIClient();
        const response = await client.responses.create({
          model: selectedModel,
          instructions: systemInstruction,
          input: modelInput,
          ...buildStoryboardSamplingOptions(selectedModel),
        } as any);
        rawText = asNonEmptyString(response.output_text);
      }

      if (!rawText) {
        throw new Error('Storyboard response was empty.');
      }

      const rawStoryboard = parseJsonObjectFromModelText(rawText);
      const story = sanitizeStoryboard(rawStoryboard, preset, storyboardPrompt, selectedArcMode);

      return res.json({
        success: true,
        model: selectedModel,
        story,
        ...(azureUsage ? { usage: azureUsage } : {}),
        debug: {
          storyboardPrompt: storyboardPromptDebug,
          systemInstruction,
          modelInput,
        },
      });
    } catch (error) {
      console.error('Error generating OpenAI storyboard:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'OpenAI storyboard generation failed') });
    }
  });

  router.post('/api/openai/image', async (req, res) => {
    try {
      const { prompt, model, size } = req.body || {};
      const userPrompt = asNonEmptyString(prompt);

      if (!userPrompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const selectedModel = asNonEmptyString(model) || getOpenAIImageModel();
      const selectedSize = asNonEmptyString(size) || '1024x1024';

      const client = getOpenAIClient();
      const finalPrompt = withStyleTaste(extractPromptCore(userPrompt) || userPrompt);
      const imageResponse = await client.images.generate({
        model: selectedModel,
        prompt: finalPrompt,
        size: selectedSize,
        n: 1,
      } as any);

      const imageData = await normalizeImageDataUrl(imageResponse);

      return res.json({
        success: true,
        model: selectedModel,
        imageData,
      });
    } catch (error) {
      console.error('Error generating OpenAI image:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'OpenAI image generation failed') });
    }
  });

  router.post('/api/openai/video', async (req, res) => {
    try {
      const { prompt, presetId, model, size, seconds } = req.body || {};
      const userPrompt = asNonEmptyString(prompt);
      const remixVideoId = asNonEmptyString(req.body?.remixVideoId);
      const videoTransform = remixVideoId
        ? (req.body?.videoTransform === 'extend' ? 'extend' : 'remix')
        : null;

      if (!userPrompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const selectedModel = asNonEmptyString(model) || getOpenAIVideoModel();
      const selectedSize = asNonEmptyString(size);
      const normalizedSize = normalizeOpenAIVideoSize(selectedModel, selectedSize);
      const normalizedSeconds = normalizeSoraVideoSeconds(seconds);
      const preset = asNonEmptyString(presetId)
        ? (PRESETS.find((entry) => entry.id === presetId) ?? null)
        : null;
      const promptCore = extractPromptCore(userPrompt) || userPrompt;
      const iqContext = mergeIQSceneContext({
        mode: 'story',
        renderTarget: 'video',
        purpose: videoTransform ?? 'create',
        prompt: promptCore,
        presetId: preset?.id ?? null,
        presetName: preset?.name ?? null,
        stylePresetIds: preset?.id ? [preset.id] : [],
        remixVideoId: remixVideoId ?? null,
      }, req.body?.iqContext);
      const iqBrief = await resolveIQBrief(iqContext);
      const finalPrompt = withStyleTaste(promptCore, {
        preset,
        userStyleContext: iqBrief?.promptBlock ?? null,
      });
      const debug = {
        rawPrompt: userPrompt,
        cleanedPrompt: promptCore,
        finalPrompt,
        presetId: preset?.id ?? null,
        renderMode: videoTransform ?? 'create',
        sourceVideoId: remixVideoId ?? null,
        iqBrief: normalizeIQBriefForDebug(iqBrief),
      };

      const client = getOpenAIClient();
      let video: any;

      if (videoTransform === 'extend') {
        video = await postOpenAIVideoJob('/videos/extensions', {
          video: { id: remixVideoId! },
          prompt: finalPrompt,
          ...(normalizedSeconds ? { seconds: String(normalizedSeconds) } : {}),
        });
      } else if (videoTransform === 'remix') {
        video = await postOpenAIVideoJob('/videos/edits', {
          video: { id: remixVideoId! },
          prompt: finalPrompt,
        });
      } else {
        const createParams: Record<string, unknown> = {
          model: selectedModel,
          prompt: finalPrompt,
        };

        if (normalizedSize) {
          createParams.size = normalizedSize;
        }
        if (normalizedSeconds) {
          createParams.seconds = normalizedSeconds;
        }

        video = await client.videos.create(createParams as any);
      }
      const videoId = asNonEmptyString(video?.id);

      if (!videoId) {
        throw new Error('OpenAI video response did not include a video id.');
      }

      const startedAt = Date.now();

      while (Date.now() - startedAt < OPENAI_VIDEO_MAX_WAIT_MS) {
        const status = pickOpenAIVideoStatus(video);

        if (status && OPENAI_VIDEO_TERMINAL_STATUSES.has(status)) {
          if (VIDEO_FAILURE_STATUSES.has(status)) {
            const providerError =
              asNonEmptyString(video?.error?.message) ||
              asNonEmptyString(video?.error?.code) ||
              'OpenAI video generation failed.';
            return res.status(500).json({ error: providerError, status, videoId });
          }

          const videoUrl = pickOpenAIVideoUrl(video);
          const videoBase64Raw = pickOpenAIVideoBase64(video);

          if (videoUrl || videoBase64Raw) {
            return res.json({
              success: true,
              videoId,
              status,
              size: normalizedSize || undefined,
              videoUrl: videoUrl || undefined,
              videoBase64: videoBase64Raw ? asDataUrl(videoBase64Raw, 'video/mp4') : undefined,
              debug: {
                ...debug,
                resultVideoId: videoId,
              },
            });
          }

          try {
            const downloadedVideoDataUrl = await downloadOpenAIVideoDataUrl(client, videoId);
            return res.json({
              success: true,
              videoId,
              status,
              size: normalizedSize || undefined,
              videoBase64: downloadedVideoDataUrl,
              debug: {
                ...debug,
                resultVideoId: videoId,
              },
            });
          } catch {
            await sleep(OPENAI_VIDEO_POLL_INTERVAL_MS);
            video = await client.videos.retrieve(videoId);
            continue;
          }
        }

        const directUrl = pickOpenAIVideoUrl(video);
        const directBase64 = pickOpenAIVideoBase64(video);
        if (!status && (directUrl || directBase64)) {
          return res.json({
            success: true,
            videoId,
            status: 'completed',
            size: normalizedSize || undefined,
            videoUrl: directUrl || undefined,
            videoBase64: directBase64 ? asDataUrl(directBase64, 'video/mp4') : undefined,
            debug: {
              ...debug,
              resultVideoId: videoId,
            },
          });
        }

        await sleep(OPENAI_VIDEO_POLL_INTERVAL_MS);
        video = await client.videos.retrieve(videoId);
      }

      return res.status(504).json({
        error: 'OpenAI video generation timed out. Please retry with a shorter prompt or smaller duration.',
        videoId,
      });
    } catch (error) {
      console.error('Error generating OpenAI video:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'OpenAI video generation failed') });
    }
  });

  return router;
};