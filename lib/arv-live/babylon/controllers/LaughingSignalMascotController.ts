import type { Camera } from '@babylonjs/core';
import { createArcadeMascotScene } from '../scenes/createArcadeMascotScene';
import {
  createDefaultARVLiveLayerState,
  type ARVLayerSchema,
  type ARVLiveLayerState,
  type ARVLiveMixState,
} from '../../types';
import type { ARVAudioFrame, ARVSceneContext, ARVSceneController, ARVVisualEvent } from './ARVSceneController';
import {
  createDefaultControllerPhase,
  createImpulseFromVisualEvent,
  extractPhaseState,
  isStandbyPhaseEvent,
  reactionKindFromVisualEvent,
  toAudioReactiveSnapshot,
} from './controllerUtils';

const createLayerState = (
  controls: ARVLiveLayerState['controls'],
  overrides: Partial<Omit<ARVLiveLayerState, 'controls'>> = {},
): ARVLiveLayerState => {
  return {
    ...createDefaultARVLiveLayerState(),
    ...overrides,
    controls,
  };
};

const CAMERA_MODE_OPTIONS = [
  { value: 'locked', label: 'Locked' },
  { value: 'slowPush', label: 'Slow Push' },
  { value: 'slowOrbit', label: 'Slow Orbit' },
  { value: 'handheldFake', label: 'Handheld Fake' },
] as const;

const LAUGHING_SIGNAL_LAYER_SCHEMA: ARVLayerSchema[] = [
  {
    id: 'background',
    label: 'Background',
    controls: [
      {
        key: 'ambientIntensity',
        label: 'Ambient Intensity',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 1.5,
        step: 0.01,
        defaultValue: 1,
      },
    ],
  },
  {
    id: 'gridFloor',
    label: 'Grid Floor',
    controls: [
      {
        key: 'movementSpeed',
        label: 'Movement Speed',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 2.5,
        step: 0.01,
        defaultValue: 1,
      },
    ],
  },
  {
    id: 'mascotHead',
    label: 'Witness Head',
    controls: [
      {
        key: 'scale',
        label: 'Scale',
        type: 'slider',
        target: 'controls',
        min: 0.4,
        max: 1.8,
        step: 0.01,
        defaultValue: 1,
      },
      {
        key: 'gloss',
        label: 'Surface Sheen',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 1.5,
        step: 0.01,
        defaultValue: 1,
      },
      {
        key: 'hoverAmount',
        label: 'Drift Amount',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 1.8,
        step: 0.01,
        defaultValue: 1,
      },
    ],
  },
  {
    id: 'spiralEyes',
    label: 'Aperture Discs',
    controls: [
      {
        key: 'rotationSpeed',
        label: 'Disc Rotation',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 3,
        step: 0.01,
        defaultValue: 1,
      },
      {
        key: 'magentaIntensity',
        label: 'Cream Intensity',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1,
      },
      {
        key: 'greenIntensity',
        label: 'Cobalt Intensity',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1,
      },
    ],
  },
  {
    id: 'grin',
    label: 'Signal Slit',
    controls: [
      {
        key: 'brightness',
        label: 'Brightness',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1,
      },
      {
        key: 'bassPulse',
        label: 'Fracture Pulse',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1,
      },
    ],
  },
  {
    id: 'sidePanels',
    label: 'Side Panels',
    controls: [
      {
        key: 'orangeIntensity',
        label: 'Orange Intensity',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1,
      },
      {
        key: 'blueIntensity',
        label: 'Blue Intensity',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 0.84,
      },
    ],
  },
  {
    id: 'toyBlocks',
    label: 'Relay Monoliths',
    controls: [
      {
        key: 'count',
        label: 'Count',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 7,
        step: 1,
        defaultValue: 7,
      },
      {
        key: 'drift',
        label: 'Drift',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1,
      },
    ],
  },
  {
    id: 'postFx',
    label: 'Post FX',
    kind: 'postFx',
    controls: [
      { key: 'bloom', label: 'Bloom', type: 'slider', target: 'postFx', min: 0, max: 2, step: 0.01, defaultValue: 0.78 },
      { key: 'scanlines', label: 'Scanlines', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.72 },
      { key: 'rgbSplit', label: 'RGB Split', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.52 },
      { key: 'noise', label: 'Noise', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.34 },
      { key: 'vignette', label: 'Vignette', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.6 },
    ],
  },
  {
    id: 'camera',
    label: 'Camera',
    kind: 'camera',
    controls: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        target: 'camera',
        defaultValue: 'locked',
        options: CAMERA_MODE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
      },
      {
        key: 'zoom',
        label: 'Zoom',
        type: 'slider',
        target: 'camera',
        min: 0.4,
        max: 2,
        step: 0.01,
        defaultValue: 1,
      },
      {
        key: 'orbitSpeed',
        label: 'Orbit Speed',
        type: 'slider',
        target: 'camera',
        min: 0,
        max: 1.5,
        step: 0.01,
        defaultValue: 0.18,
      },
      {
        key: 'shake',
        label: 'Shake',
        type: 'slider',
        target: 'camera',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.06,
      },
    ],
  },
];

export const createLaughingSignalDefaultMixState = (presetId: string): ARVLiveMixState => {
  return {
    presetId,
    layers: {
      background: createLayerState({ ambientIntensity: 1 }, { audioReactive: false }),
      gridFloor: createLayerState({ movementSpeed: 1 }, { audioReactive: true, blendMode: 'screen' }),
      mascotHead: createLayerState({ scale: 1, gloss: 0.72, hoverAmount: 0.52 }, { audioReactive: false }),
      spiralEyes: createLayerState({ rotationSpeed: 0.52, magentaIntensity: 0.92, greenIntensity: 0.72 }, { audioReactive: true, blendMode: 'add' }),
      grin: createLayerState({ brightness: 0.9, bassPulse: 0.54 }, { audioReactive: true, blendMode: 'screen' }),
      sidePanels: createLayerState({ orangeIntensity: 0.72, blueIntensity: 0.68 }, { audioReactive: false, blendMode: 'add' }),
      toyBlocks: createLayerState({ count: 4, drift: 0.56 }, { audioReactive: true, blendMode: 'add' }),
    },
    postFx: {
      bloom: 0.62,
      scanlines: 0.72,
      rgbSplit: 0.34,
      vignette: 0.6,
      noise: 0.28,
    },
    camera: {
      mode: 'locked',
      zoom: 1,
      orbitSpeed: 0.18,
      shake: 0.03,
    },
  };
};

export class LaughingSignalMascotController implements ARVSceneController {
  readonly id = 'arv-laughing-signal-mascot' as const;
  camera: Camera | null = null;

  private sceneController: ReturnType<typeof createArcadeMascotScene> | null = null;
  private fallbackColor = '#00f4ff';
  private phase = createDefaultControllerPhase(this.fallbackColor);

  constructor(private readonly preset = null as ARVSceneContext['preset'] | null) {}

  init(ctx: ARVSceneContext): void {
    this.dispose();
    const preset = this.preset || ctx.preset;
    this.fallbackColor = preset.portalHex;
    this.phase = createDefaultControllerPhase(preset.accentHex);
    this.sceneController = createArcadeMascotScene({
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
    return LAUGHING_SIGNAL_LAYER_SCHEMA;
  }

  getDefaultMixState(): ARVLiveMixState {
    return createLaughingSignalDefaultMixState(this.preset?.id || 'arv-laughing-signal-mascot');
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