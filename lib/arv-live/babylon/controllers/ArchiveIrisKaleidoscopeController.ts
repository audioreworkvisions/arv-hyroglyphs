import type { Camera } from '@babylonjs/core';
import {
  ARCHIVE_IRIS_LAYER_SCHEMA,
  createArchiveIrisDefaultMixState,
  createArchiveIrisScene,
} from '../scenes/createArchiveIrisScene';
import type { ARVLayerSchema, ARVLiveMixState } from '../../types';
import {
  type ARVAudioFrame,
  type ARVSceneContext,
  type ARVSceneController,
  type ARVVisualEvent,
} from './ARVSceneController';
import {
  createDefaultControllerPhase,
  createImpulseFromVisualEvent,
  extractPhaseState,
  isStandbyPhaseEvent,
  reactionKindFromVisualEvent,
  toAudioReactiveSnapshot,
} from './controllerUtils';

export class ArchiveIrisKaleidoscopeController implements ARVSceneController {
  readonly id = 'arv-archive-iris-kaleidoscope' as const;
  camera: Camera | null = null;

  private sceneController: ReturnType<typeof createArchiveIrisScene> | null = null;
  private fallbackColor = '#e9dfd1';
  private phase = createDefaultControllerPhase(this.fallbackColor);

  constructor(private readonly preset = null as ARVSceneContext['preset'] | null) {}

  init(ctx: ARVSceneContext): void {
    this.dispose();
    const preset = this.preset || ctx.preset;
    this.fallbackColor = preset.portalHex;
    this.phase = createDefaultControllerPhase(preset.accentHex);
    this.sceneController = createArchiveIrisScene({
      scene: ctx.scene,
      quality: ctx.quality,
      preset,
    });
    this.camera = this.sceneController.camera;
    this.sceneController.applyMixState(this.getDefaultMixState());
  }

  getLayerSchema(): ARVLayerSchema[] {
    return ARCHIVE_IRIS_LAYER_SCHEMA;
  }

  getDefaultMixState(): ARVLiveMixState {
    return createArchiveIrisDefaultMixState(this.preset?.id || 'archiveIrisKaleidoscope');
  }

  applyMixState(mix: ARVLiveMixState): void {
    this.sceneController?.applyMixState(mix);
  }

  update(audio: ARVAudioFrame): void {
    if (!this.sceneController) {
      return;
    }

    this.sceneController.update(audio.dt, audio.time, toAudioReactiveSnapshot(audio), this.phase);
  }

  onEvent(event: ARVVisualEvent): void {
    if (!this.sceneController) {
      return;
    }

    const phase = extractPhaseState(event);
    if (phase) {
      this.phase = phase;
      if (isStandbyPhaseEvent(event)) {
        this.sceneController.setStandby(phase);
      }
      return;
    }

    const impulse = createImpulseFromVisualEvent(event, this.fallbackColor);
    if (!impulse) {
      return;
    }

    this.sceneController.applyVisualImpulse(impulse, reactionKindFromVisualEvent(event.type));
  }

  resize(_width: number, _height: number): void {}

  dispose(): void {
    this.sceneController?.dispose();
    this.sceneController = null;
    this.camera = null;
  }
}