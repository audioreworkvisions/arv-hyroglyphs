import type OpenAI from 'openai';
import { asNonEmptyString } from './http';

const OPENAI_VIDEO_DEFAULT_SIZE = '1280x720';
const OPENAI_VIDEO_SUPPORTED_SIZES = new Set(['720x1280', '1280x720', '1024x1792', '1792x1024']);

export const VIDEO_SUCCESS_STATUSES = new Set(['completed', 'succeeded', 'done']);
export const VIDEO_FAILURE_STATUSES = new Set(['failed', 'cancelled', 'canceled', 'rejected', 'error']);

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const asDataUrl = (base64: string, mimeType: string): string => {
  if (base64.startsWith('data:')) return base64;
  return `data:${mimeType};base64,${base64}`;
};

const isSora2Model = (model: string): boolean => model.toLowerCase().startsWith('sora-2');

export const normalizeOpenAIVideoSize = (model: string, requestedSize: string | null): string | null => {
  if (!isSora2Model(model)) {
    return requestedSize;
  }

  const value = (requestedSize || '').trim().toLowerCase();

  if (!value) {
    return OPENAI_VIDEO_DEFAULT_SIZE;
  }

  if (value === '1:1' || value === 'square' || value === '1024x1024') {
    return OPENAI_VIDEO_DEFAULT_SIZE;
  }

  if (value === '16:9' || value === 'landscape') {
    return OPENAI_VIDEO_DEFAULT_SIZE;
  }

  if (value === '720x1280' || value === '1024x1792' || value === '9:16' || value === 'portrait') {
    return OPENAI_VIDEO_DEFAULT_SIZE;
  }

  if (OPENAI_VIDEO_SUPPORTED_SIZES.has(value)) {
    return value;
  }

  return OPENAI_VIDEO_DEFAULT_SIZE;
};

export const pickOpenAIVideoStatus = (video: any): string => {
  const rawStatus = asNonEmptyString(video?.status) || asNonEmptyString(video?.state) || '';
  return rawStatus.toLowerCase();
};

export const pickOpenAIVideoUrl = (video: any): string | null => {
  return (
    asNonEmptyString(video?.url) ||
    asNonEmptyString(video?.video_url) ||
    asNonEmptyString(video?.download_url) ||
    asNonEmptyString(video?.result?.url) ||
    asNonEmptyString(video?.result?.video?.url) ||
    asNonEmptyString(video?.output?.url) ||
    asNonEmptyString(video?.output?.video?.url) ||
    asNonEmptyString(video?.output?.[0]?.url) ||
    asNonEmptyString(video?.data?.[0]?.url) ||
    null
  );
};

export const pickOpenAIVideoBase64 = (video: any): string | null => {
  return (
    asNonEmptyString(video?.b64_json) ||
    asNonEmptyString(video?.video_b64) ||
    asNonEmptyString(video?.result?.b64_json) ||
    asNonEmptyString(video?.result?.video_b64) ||
    asNonEmptyString(video?.output?.b64_json) ||
    asNonEmptyString(video?.output?.video_b64) ||
    asNonEmptyString(video?.output?.[0]?.b64_json) ||
    asNonEmptyString(video?.output?.[0]?.video_b64) ||
    null
  );
};

export const normalizeImageDataUrl = async (openAIImageResponse: any): Promise<string> => {
  const imageItem = openAIImageResponse?.data?.[0];

  const b64 = asNonEmptyString(imageItem?.b64_json);
  if (b64) {
    return asDataUrl(b64, 'image/png');
  }

  const url = asNonEmptyString(imageItem?.url);
  if (url) {
    const imageResponse = await fetch(url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download generated image: ${imageResponse.statusText}`);
    }
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    return asDataUrl(buffer.toString('base64'), contentType);
  }

  throw new Error('OpenAI image response did not contain image data.');
};

export const downloadOpenAIVideoDataUrl = async (client: OpenAI, videoId: string): Promise<string> => {
  const response = await client.videos.downloadContent(videoId, { variant: 'video' });
  if (!response.ok) {
    throw new Error(`OpenAI video download failed: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'video/mp4';
  const buffer = Buffer.from(await response.arrayBuffer());
  return asDataUrl(buffer.toString('base64'), contentType);
};

export const normalizeGifAspectRatio = (aspectRatio: unknown): '1:1' | '16:9' | null => {
  return aspectRatio === '1:1' ? '1:1' : aspectRatio === '16:9' ? '16:9' : null;
};

export const normalizeGifOutputSize = (outputSize: unknown): number => {
  const parsedOutputSize = Number(outputSize);
  return [480, 720, 1080].includes(parsedOutputSize) ? parsedOutputSize : 480;
};

const makeEven = (value: number) => Math.max(2, Math.round(value / 2) * 2);

export const buildGifVideoFilter = (aspectRatio: '1:1' | '16:9' | null, outputSize: number): string => {
  const targetHeight16x9 = makeEven((outputSize * 9) / 16);

  if (aspectRatio === '1:1') {
    return `fps=10,scale=${outputSize}:${outputSize}:flags=lanczos:force_original_aspect_ratio=increase,crop=${outputSize}:${outputSize},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
  }

  if (aspectRatio === '16:9') {
    return `fps=10,scale=${outputSize}:${targetHeight16x9}:flags=lanczos:force_original_aspect_ratio=increase,crop=${outputSize}:${targetHeight16x9},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
  }

  return `fps=10,scale=${outputSize}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
};