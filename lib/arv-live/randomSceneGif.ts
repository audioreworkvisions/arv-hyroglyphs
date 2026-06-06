import { Engine, Scene } from '@babylonjs/core';
import { createARVSceneController } from './babylon/controllers/registry';
import type { ARVAudioFrame, ARVSceneController } from './babylon/controllers/ARVSceneController';
import {
  ARV_CURATED_LIVE_PRESETS,
  getARVQualitySettings,
  type ARVLiveRuntimeOptions,
  type ARVLiveVisualPreset,
  type ARVQualityTier,
} from './presets';
import { RitualPhaseController } from './RitualPhaseController';
import type { AudioReactiveSnapshot } from './AudioReactiveUniforms';
// @ts-ignore - gifenc ships without bundled types
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export interface RandomSceneGifResult {
  blob: Blob;
  url: string;
  preset: ARVLiveVisualPreset;
  frameCount: number;
  width: number;
  height: number;
}

export interface RandomSceneGifOptions {
  /** Visible canvas the scene is rendered into while recording. */
  canvas: HTMLCanvasElement;
  /** Explicit preset; when omitted a random curated preset is chosen. */
  preset?: ARVLiveVisualPreset;
  /** Render quality tier (default: 'obs'). */
  qualityTier?: ARVQualityTier;
  /** GIF length in seconds (default: 3). */
  durationSeconds?: number;
  /** Captured frames per second (default: 12). */
  fps?: number;
  /** Output dimensions (default: 480 x 480). */
  width?: number;
  height?: number;
  /** Reports progress from 0..1 plus the current stage label. */
  onProgress?: (ratio: number, stage: 'init' | 'warmup' | 'render' | 'encode') => void;
  /** Allows cancellation while rendering. */
  signal?: AbortSignal;
}

const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 480;
const DEFAULT_FPS = 12;
const DEFAULT_DURATION_SECONDS = 3;
const WARMUP_FRAMES = 8;

/** Picks a random curated ARV preset, optionally avoiding the previous one. */
export const pickRandomScenePreset = (excludeId?: string): ARVLiveVisualPreset => {
  const pool = ARV_CURATED_LIVE_PRESETS.filter((preset) => preset.id !== excludeId);
  const list = pool.length > 0 ? pool : ARV_CURATED_LIVE_PRESETS;
  return list[Math.floor(Math.random() * list.length)];
};

const yieldToMainThread = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new DOMException('Random scene GIF generation aborted', 'AbortError');
  }
};

interface SyntheticAudio {
  bass: number;
  mid: number;
  high: number;
  rms: number;
  kick: number;
  bpm: number;
}

/** Generates a deterministic pseudo-audio signal so scenes pulse without a mic. */
const buildSyntheticAudio = (time: number, bpm = 124): SyntheticAudio => {
  const beat = (time * bpm) / 60;
  const beatPhase = beat - Math.floor(beat);
  const kick = Math.max(0, 1 - beatPhase * 6);
  const bass = Math.min(1, 0.32 + 0.42 * Math.abs(Math.sin(beat * Math.PI)) + kick * 0.22);
  const mid = 0.28 + 0.32 * (0.5 + 0.5 * Math.sin(time * 1.7 + 1));
  const high = 0.24 + 0.34 * (0.5 + 0.5 * Math.sin(time * 3.3 + 2));
  const rms = Math.min(1, (bass + mid + high) / 2.4);
  return { bass, mid, high, rms, kick, bpm };
};

const toSnapshot = (audio: SyntheticAudio): AudioReactiveSnapshot => ({
  active: true,
  bass: audio.bass,
  mid: audio.mid,
  high: audio.high,
  rms: audio.rms,
  kick: audio.kick,
  bpm: audio.bpm,
  permission: 'active',
});

const toAudioFrame = (audio: SyntheticAudio, time: number, dt: number): ARVAudioFrame => ({
  time,
  dt,
  bass: audio.bass,
  mid: audio.mid,
  high: audio.high,
  rms: audio.rms,
  kick: audio.kick,
  bpm: audio.bpm,
});

const buildRuntimeOptions = (preset: ARVLiveVisualPreset): ARVLiveRuntimeOptions => ({
  defaultHudMode: 'minimal',
  showFeed: false,
  feedCollapsedByDefault: true,
  viewerControls: 'hidden',
  keyboardReactions: false,
  transparentBackground: false,
  ...(preset.runtimeOptions ?? {}),
});

/**
 * Renders a random (or supplied) ARV scene into the given canvas and encodes the
 * captured frames into an animated GIF. Designed for a one-click "demo mode" button.
 */
export const generateRandomSceneGif = async (
  options: RandomSceneGifOptions,
): Promise<RandomSceneGifResult> => {
  const { canvas, signal } = options;
  const preset = options.preset ?? pickRandomScenePreset();
  const fps = options.fps ?? DEFAULT_FPS;
  const durationSeconds = options.durationSeconds ?? DEFAULT_DURATION_SECONDS;
  const totalFrames = Math.max(1, Math.round(durationSeconds * fps));
  const dt = 1 / fps;
  const frameDelayMs = 1000 / fps;
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;

  canvas.width = width;
  canvas.height = height;

  options.onProgress?.(0, 'init');
  throwIfAborted(signal);

  const quality = getARVQualitySettings(options.qualityTier ?? 'obs');
  const runtime = buildRuntimeOptions(preset);

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: quality.enableBloom,
  });
  engine.setHardwareScalingLevel(1);

  const scene = new Scene(engine);
  const ritual = new RitualPhaseController();

  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = width;
  captureCanvas.height = height;
  const captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });
  if (!captureCtx) {
    engine.dispose();
    throw new Error('2D canvas context konnte nicht erstellt werden.');
  }

  let controller: ARVSceneController | null = null;
  const gif = GIFEncoder();

  const renderStep = (time: number): void => {
    if (!controller) {
      return;
    }
    const audio = buildSyntheticAudio(time);
    const phase = ritual.update(dt, toSnapshot(audio));
    controller.onEvent({ type: 'system.phaseChange', payload: { phase, standby: false } });
    controller.update(toAudioFrame(audio, time, dt));
    scene.render();
  };

  const captureFrame = (): void => {
    captureCtx.fillStyle = preset.backgroundHex;
    captureCtx.fillRect(0, 0, width, height);
    captureCtx.drawImage(canvas, 0, 0, width, height);

    const { data } = captureCtx.getImageData(0, 0, width, height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, width, height, { palette, delay: frameDelayMs });
  };

  try {
    controller = await createARVSceneController(preset.controllerId, preset);
    throwIfAborted(signal);

    controller.init({
      engine,
      scene,
      canvas,
      mode: 'viewer',
      quality,
      preset,
      runtime,
    });
    controller.applyMixState(controller.getDefaultMixState());

    // Allow async texture / asset loads to settle before recording.
    options.onProgress?.(0, 'warmup');
    await new Promise((resolve) => setTimeout(resolve, 220));

    for (let frame = 0; frame < WARMUP_FRAMES; frame += 1) {
      throwIfAborted(signal);
      renderStep(frame * dt);
      await yieldToMainThread();
    }

    for (let frame = 0; frame < totalFrames; frame += 1) {
      throwIfAborted(signal);
      const time = (WARMUP_FRAMES + frame) * dt;
      renderStep(time);
      // Yield so the preserved drawing buffer is ready and the UI stays responsive.
      await yieldToMainThread();
      captureFrame();
      options.onProgress?.((frame + 1) / totalFrames, 'render');
    }

    options.onProgress?.(1, 'encode');
    gif.finish();
    const bytes = gif.bytes();
    const blob = new Blob([bytes], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);

    return { blob, url, preset, frameCount: totalFrames, width, height };
  } finally {
    controller?.dispose();
    scene.dispose();
    engine.dispose();
  }
};
