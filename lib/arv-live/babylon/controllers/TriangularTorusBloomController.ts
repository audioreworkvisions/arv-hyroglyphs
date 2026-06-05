import type { Camera } from '@babylonjs/core';
import {
  createPrismShardsDefaultMixState,
  createPrismShardsScene,
  PRISM_SHARDS_LAYER_SCHEMA,
} from '../scenes/createPrismShardsScene';
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

export class TriangularTorusBloomController implements ARVSceneController {
  readonly id = 'arv-triangular-torus-bloom' as const;
  camera: Camera | null = null;

  private sceneController: ReturnType<typeof createPrismShardsScene> | null = null;
  private fallbackColor = '#4f7dff';
  private phase = createDefaultControllerPhase(this.fallbackColor);

  constructor(private readonly preset = null as ARVSceneContext['preset'] | null) {}

  init(ctx: ARVSceneContext): void {
    this.dispose();
    const preset = this.preset || ctx.preset;
    this.fallbackColor = preset.portalHex;
    this.phase = createDefaultControllerPhase(preset.accentHex);
    this.sceneController = createPrismShardsScene({
      scene: ctx.scene,
      canvas: ctx.canvas,
      mode: ctx.mode,
      quality: ctx.quality,
      preset,
    });
    this.camera = this.sceneController.camera;
    this.sceneController.applyMixState(this.getDefaultMixState());
  }

  getLayerSchema(): ARVLayerSchema[] {
    return PRISM_SHARDS_LAYER_SCHEMA;
  }

  getDefaultMixState(): ARVLiveMixState {
    return createPrismShardsDefaultMixState(this.preset?.id || 'arv-triangular-torus-bloom');
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