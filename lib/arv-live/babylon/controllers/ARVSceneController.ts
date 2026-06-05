import type { Camera, Engine, Scene } from '@babylonjs/core';
import type { ARVLiveMode, ARVLiveRuntimeOptions, ARVLiveVisualPreset, ARVQualitySettings } from '../../presets';
import { createEmptyARVLiveMixState, type ARVLayerSchema, type ARVLiveMixState } from '../../types';
import type { ARVSceneControllerId } from './controllerIds';

export type ARVAudioFrame = {
  time: number;
  dt: number;
  bass: number;
  mid: number;
  high: number;
  rms: number;
  kick: number;
  bpm?: number;
  spectralFlux?: number;
};

export type ARVVisualEvent = {
  type:
    | 'reaction.pulse'
    | 'reaction.fire'
    | 'reaction.acid'
    | 'reaction.dark'
    | 'reaction.peaceLoveTechno'
    | 'chat.message'
    | 'chat.emoji'
    | 'audio.drop'
    | 'system.phaseChange';
  intensity?: number;
  color?: string;
  payload?: Record<string, unknown>;
};

export type ARVSceneContext = {
  engine: Engine;
  scene: Scene;
  canvas: HTMLCanvasElement;
  mode: ARVLiveMode;
  quality: ARVQualitySettings;
  preset: ARVLiveVisualPreset;
  runtime: ARVLiveRuntimeOptions;
};

export interface ARVSceneController {
  id: ARVSceneControllerId;
  camera: Camera | null;
  init(ctx: ARVSceneContext): void;
  getLayerSchema(): ARVLayerSchema[];
  getDefaultMixState(): ARVLiveMixState;
  applyMixState(mix: ARVLiveMixState): void;
  update(audio: ARVAudioFrame): void;
  onEvent(event: ARVVisualEvent): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export const createNoopARVLayerSchema = (): ARVLayerSchema[] => {
  return [];
};

export const createNoopARVLiveMixState = (presetId: string): ARVLiveMixState => {
  return createEmptyARVLiveMixState(presetId);
};