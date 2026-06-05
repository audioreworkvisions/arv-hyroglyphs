import { Constants, type Material } from '@babylonjs/core';
import {
  createDefaultARVLiveLayerState,
  type ARVLayerBlendMode,
  type ARVLayerSchema,
  type ARVLiveLayerState,
  type ARVLiveCameraState,
  type ARVLiveMixState,
  type ARVLivePostFxState,
} from '../../types';

export const CAMERA_MODE_OPTIONS = [
  { value: 'locked', label: 'Locked' },
  { value: 'slowPush', label: 'Slow Push' },
  { value: 'slowOrbit', label: 'Slow Orbit' },
  { value: 'handheldFake', label: 'Handheld Fake' },
] as const;

export const createLayerState = (
  controls: ARVLiveLayerState['controls'],
  overrides: Partial<Omit<ARVLiveLayerState, 'controls'>> = {},
): ARVLiveLayerState => {
  return {
    ...createDefaultARVLiveLayerState(),
    ...overrides,
    controls,
  };
};

export const getLayerState = (mix: ARVLiveMixState, layerId: string): ARVLiveLayerState => {
  return mix.layers[layerId] ?? createDefaultARVLiveLayerState();
};

export const getLayerControlNumber = (
  mix: ARVLiveMixState,
  layerId: string,
  controlId: string,
  fallback: number,
): number => {
  const value = mix.layers[layerId]?.controls[controlId];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

export const getLayerControlBoolean = (
  mix: ARVLiveMixState,
  layerId: string,
  controlId: string,
  fallback: boolean,
): boolean => {
  const value = mix.layers[layerId]?.controls[controlId];
  return typeof value === 'boolean' ? value : fallback;
};

export const getLayerControlString = (
  mix: ARVLiveMixState,
  layerId: string,
  controlId: string,
  fallback: string,
): string => {
  const value = mix.layers[layerId]?.controls[controlId];
  return typeof value === 'string' && value.trim() ? value : fallback;
};

export const resolveBlendModeAlphaMode = (blendMode: ARVLayerBlendMode): number => {
  switch (blendMode) {
    case 'add':
      return Constants.ALPHA_ADD;
    case 'multiply':
      return Constants.ALPHA_MULTIPLY;
    case 'screen':
      return Constants.ALPHA_SCREENMODE;
    default:
      return Constants.ALPHA_COMBINE;
  }
};

export const applyMaterialBlendMode = (
  blendMode: ARVLayerBlendMode,
  materials: Array<Material | null | undefined>,
): void => {
  const alphaMode = resolveBlendModeAlphaMode(blendMode);
  materials.forEach((material) => {
    if (!material) {
      return;
    }

    material.alphaMode = alphaMode;
  });
};

export const setNodeEnabled = (
  nodes: Array<{ setEnabled: (enabled: boolean) => unknown } | null | undefined>,
  enabled: boolean,
): void => {
  nodes.forEach((node) => {
    node?.setEnabled(enabled);
  });
};

export const createPostFxSchema = (defaults: ARVLivePostFxState): ARVLayerSchema => {
  return {
    id: 'postFx',
    label: 'Post FX',
    kind: 'postFx',
    controls: [
      { key: 'bloom', label: 'Bloom', type: 'slider', target: 'postFx', min: 0, max: 2, step: 0.01, defaultValue: defaults.bloom },
      { key: 'scanlines', label: 'Scanlines', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: defaults.scanlines },
      { key: 'rgbSplit', label: 'RGB Split', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: defaults.rgbSplit },
      { key: 'noise', label: 'Noise', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: defaults.noise },
      { key: 'vignette', label: 'Vignette', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: defaults.vignette },
    ],
  };
};

export const createCameraSchema = (defaults: ARVLiveCameraState): ARVLayerSchema => {
  return {
    id: 'camera',
    label: 'Camera',
    kind: 'camera',
    controls: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        target: 'camera',
        defaultValue: defaults.mode,
        options: CAMERA_MODE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
      },
      { key: 'zoom', label: 'Zoom', type: 'slider', target: 'camera', min: 0.4, max: 2, step: 0.01, defaultValue: defaults.zoom },
      { key: 'orbitSpeed', label: 'Orbit Speed', type: 'slider', target: 'camera', min: 0, max: 2, step: 0.01, defaultValue: defaults.orbitSpeed },
      { key: 'shake', label: 'Shake', type: 'slider', target: 'camera', min: 0, max: 1, step: 0.01, defaultValue: defaults.shake },
    ],
  };
};