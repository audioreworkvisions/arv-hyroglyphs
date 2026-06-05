import { ARV_DEFAULT_LIVE_CONTROL_PRESET_ID } from './presets';

export type ARVCommunityEventType = 'reaction' | 'chat' | 'system' | 'ritual';

export type ARVReactionKind =
  | 'pulse'
  | 'fire'
  | 'acid'
  | 'dark'
  | 'peace-love-techno';

export type ARVPhaseLock =
  | 'auto'
  | 'dormant'
  | 'invocation'
  | 'surge'
  | 'peak'
  | 'euphoria';

export type ARVLayerBlendMode = 'normal' | 'add' | 'screen' | 'multiply';

export type ARVLiveCameraMode = 'locked' | 'slowPush' | 'slowOrbit' | 'handheldFake';

export type ARVLayerControlTarget = 'layer' | 'controls' | 'postFx' | 'camera';

export type ARVLayerControlValue = boolean | number | string;

export interface ARVLiveLayerState {
  enabled: boolean;
  opacity: number;
  intensity: number;
  audioReactive: boolean;
  blendMode: ARVLayerBlendMode;
  controls: Record<string, ARVLayerControlValue>;
}

export interface ARVLivePostFxState {
  bloom: number;
  scanlines: number;
  rgbSplit: number;
  vignette: number;
  noise: number;
}

export interface ARVLiveCameraState {
  mode: ARVLiveCameraMode;
  zoom: number;
  orbitSpeed: number;
  shake: number;
}

export type ARVLayerControl =
  | {
    key: string;
    label: string;
    type: 'slider';
    target?: ARVLayerControlTarget;
    min: number;
    max: number;
    step?: number;
    defaultValue: number;
  }
  | {
    key: string;
    label: string;
    type: 'toggle';
    target?: ARVLayerControlTarget;
    defaultValue: boolean;
  }
  | {
    key: string;
    label: string;
    type: 'select';
    target?: ARVLayerControlTarget;
    defaultValue: string;
    options: Array<{ value: string; label: string }>;
  };

export interface ARVLayerSchema {
  id: string;
  label: string;
  kind?: 'layer' | 'postFx' | 'camera';
  description?: string;
  controls: ARVLayerControl[];
}

export interface ARVLiveMixState {
  presetId: string;
  layers: Record<string, ARVLiveLayerState>;
  postFx: ARVLivePostFxState;
  camera: ARVLiveCameraState;
}

export interface ARVLiveMixSnapshot {
  id: string;
  name: string;
  presetId: string;
  slotIndex?: number;
  createdAt: number;
  mix: ARVLiveMixState;
}

export type ARVCommunityEventSource =
  | 'viewer'
  | 'obs'
  | 'mock-youtube'
  | 'system'
  | 'moderation';

export interface ARVCommunityEvent {
  id: string;
  type: ARVCommunityEventType;
  source: ARVCommunityEventSource;
  createdAt: number;
  intensity: number;
  palette: string;
  label: string;
  text?: string;
  userId?: string;
  phaseHint?: string;
  tags?: string[];
  payload?: Record<string, unknown>;
}

export interface ARVLiveControlState {
  presetId: string;
  phaseLock: ARVPhaseLock;
  mix: ARVLiveMixState;
}

const ARV_LAYER_BLEND_MODES: ARVLayerBlendMode[] = ['normal', 'add', 'screen', 'multiply'];
const ARV_LIVE_CAMERA_MODES: ARVLiveCameraMode[] = ['locked', 'slowPush', 'slowOrbit', 'handheldFake'];

const clampRange = (value: unknown, min: number, max: number, fallback: number): number => {
  const normalized = typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback;

  return Math.min(max, Math.max(min, normalized));
};

const normalizeLayerControls = (value: unknown): Record<string, ARVLayerControlValue> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, ARVLayerControlValue>>((accumulator, [key, rawControlValue]) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return accumulator;
    }

    if (typeof rawControlValue === 'boolean' || typeof rawControlValue === 'string') {
      accumulator[normalizedKey] = rawControlValue;
      return accumulator;
    }

    if (typeof rawControlValue === 'number' && Number.isFinite(rawControlValue)) {
      accumulator[normalizedKey] = rawControlValue;
    }

    return accumulator;
  }, {});
};

export const isARVLayerBlendMode = (value: unknown): value is ARVLayerBlendMode => {
  return typeof value === 'string' && ARV_LAYER_BLEND_MODES.includes(value as ARVLayerBlendMode);
};

export const isARVLiveCameraMode = (value: unknown): value is ARVLiveCameraMode => {
  return typeof value === 'string' && ARV_LIVE_CAMERA_MODES.includes(value as ARVLiveCameraMode);
};

export const createDefaultARVLiveLayerState = (): ARVLiveLayerState => {
  return {
    enabled: true,
    opacity: 1,
    intensity: 1,
    audioReactive: false,
    blendMode: 'normal',
    controls: {},
  };
};

export const normalizeARVLiveLayerState = (
  raw: Partial<ARVLiveLayerState> | null | undefined,
): ARVLiveLayerState => {
  const defaults = createDefaultARVLiveLayerState();
  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : defaults.enabled,
    opacity: clampRange(raw?.opacity, 0, 1, defaults.opacity),
    intensity: clampRange(raw?.intensity, 0, 2, defaults.intensity),
    audioReactive: typeof raw?.audioReactive === 'boolean' ? raw.audioReactive : defaults.audioReactive,
    blendMode: isARVLayerBlendMode(raw?.blendMode) ? raw.blendMode : defaults.blendMode,
    controls: normalizeLayerControls(raw?.controls),
  };
};

export const createEmptyARVLiveMixState = (
  presetId = ARV_DEFAULT_LIVE_CONTROL_PRESET_ID,
): ARVLiveMixState => {
  return {
    presetId,
    layers: {},
    postFx: {
      bloom: 0,
      scanlines: 0,
      rgbSplit: 0,
      vignette: 0,
      noise: 0,
    },
    camera: {
      mode: 'locked',
      zoom: 1,
      orbitSpeed: 0,
      shake: 0,
    },
  };
};

export const normalizeARVLiveMixState = (
  raw: Partial<ARVLiveMixState> | null | undefined,
  fallbackPresetId = ARV_DEFAULT_LIVE_CONTROL_PRESET_ID,
): ARVLiveMixState => {
  const presetId = raw?.presetId?.trim() || fallbackPresetId;
  const defaults = createEmptyARVLiveMixState(presetId);

  const layers = raw?.layers && typeof raw.layers === 'object' && !Array.isArray(raw.layers)
    ? Object.entries(raw.layers).reduce<Record<string, ARVLiveLayerState>>((accumulator, [layerId, layerState]) => {
      const normalizedLayerId = layerId.trim();
      if (!normalizedLayerId) {
        return accumulator;
      }

      accumulator[normalizedLayerId] = normalizeARVLiveLayerState(layerState);
      return accumulator;
    }, {})
    : defaults.layers;

  return {
    presetId,
    layers,
    postFx: {
      bloom: clampRange(raw?.postFx?.bloom, 0, 2, defaults.postFx.bloom),
      scanlines: clampRange(raw?.postFx?.scanlines, 0, 1, defaults.postFx.scanlines),
      rgbSplit: clampRange(raw?.postFx?.rgbSplit, 0, 1, defaults.postFx.rgbSplit),
      vignette: clampRange(raw?.postFx?.vignette, 0, 1, defaults.postFx.vignette),
      noise: clampRange(raw?.postFx?.noise, 0, 1, defaults.postFx.noise),
    },
    camera: {
      mode: isARVLiveCameraMode(raw?.camera?.mode) ? raw.camera.mode : defaults.camera.mode,
      zoom: clampRange(raw?.camera?.zoom, 0.4, 2.4, defaults.camera.zoom),
      orbitSpeed: clampRange(raw?.camera?.orbitSpeed, 0, 2, defaults.camera.orbitSpeed),
      shake: clampRange(raw?.camera?.shake, 0, 1, defaults.camera.shake),
    },
  };
};

export const ARV_DEFAULT_LIVE_CONTROL_STATE: ARVLiveControlState = {
  presetId: ARV_DEFAULT_LIVE_CONTROL_PRESET_ID,
  phaseLock: 'dormant',
  mix: createEmptyARVLiveMixState(ARV_DEFAULT_LIVE_CONTROL_PRESET_ID),
};

export interface ARVSocketEnvelope {
  type: 'hello' | 'event' | 'snapshot' | 'warning' | 'pong' | 'control';
  event?: ARVCommunityEvent;
  events?: ARVCommunityEvent[];
  control?: ARVLiveControlState;
  message?: string;
  now?: number;
  stats?: {
    clients: number;
    totalEvents: number;
    recentReactions: Partial<Record<ARVReactionKind, number>>;
  };
}

export interface ARVReactionDescriptor {
  key: ARVReactionKind;
  label: string;
  palette: string;
  intensity: number;
  phaseHint: string;
  tags: string[];
}

export interface ARVVisualImpulse {
  colorHex: string;
  intensity: number;
  burst: number;
  sparkle: number;
  phaseBias: number;
  label: string;
  isChat: boolean;
}

export const ARV_REACTION_PRESETS: Record<ARVReactionKind, ARVReactionDescriptor> = {
  pulse: {
    key: 'pulse',
    label: 'Pulse',
    palette: '#60a5fa',
    intensity: 0.66,
    phaseHint: 'surge',
    tags: ['beat', 'pulse', 'crowd'],
  },
  fire: {
    key: 'fire',
    label: 'Fire',
    palette: '#fb7185',
    intensity: 0.92,
    phaseHint: 'peak',
    tags: ['heat', 'ignition', 'peak'],
  },
  acid: {
    key: 'acid',
    label: 'Acid',
    palette: '#a3e635',
    intensity: 0.85,
    phaseHint: 'spiral',
    tags: ['acid', 'spiral', 'shimmer'],
  },
  dark: {
    key: 'dark',
    label: 'Dark',
    palette: '#818cf8',
    intensity: 0.58,
    phaseHint: 'dormant',
    tags: ['dark', 'low-end', 'fog'],
  },
  'peace-love-techno': {
    key: 'peace-love-techno',
    label: 'Peace Love Techno',
    palette: '#f59e0b',
    intensity: 1,
    phaseHint: 'euphoria',
    tags: ['anthem', 'unity', 'love'],
  },
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

export const createARVEventId = (): string => {
  return `arv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const isARVPhaseLock = (value: unknown): value is ARVPhaseLock => {
  return value === 'auto'
    || value === 'dormant'
    || value === 'invocation'
    || value === 'surge'
    || value === 'peak'
    || value === 'euphoria';
};

export const normalizeARVLiveControlState = (
  raw: Partial<ARVLiveControlState>,
): ARVLiveControlState => {
  const presetId = raw.presetId?.trim() || ARV_DEFAULT_LIVE_CONTROL_STATE.presetId;

  return {
    presetId,
    phaseLock: isARVPhaseLock(raw.phaseLock)
      ? raw.phaseLock
      : ARV_DEFAULT_LIVE_CONTROL_STATE.phaseLock,
    mix: normalizeARVLiveMixState(
      raw.mix,
      raw.mix?.presetId?.trim() || presetId,
    ),
  };
};

export const normalizeARVCommunityEvent = (
  raw: Partial<ARVCommunityEvent> & Pick<ARVCommunityEvent, 'type' | 'source' | 'label'>,
): ARVCommunityEvent => {
  const createdAt = Number.isFinite(raw.createdAt) ? Number(raw.createdAt) : Date.now();
  return {
    id: raw.id?.trim() || createARVEventId(),
    type: raw.type,
    source: raw.source,
    createdAt,
    intensity: clamp01(raw.intensity ?? 0.5),
    palette: raw.palette?.trim() || '#8b5cf6',
    label: raw.label.trim() || 'ARV Signal',
    ...(raw.text?.trim() ? { text: raw.text.trim() } : {}),
    ...(raw.userId?.trim() ? { userId: raw.userId.trim() } : {}),
    ...(raw.phaseHint?.trim() ? { phaseHint: raw.phaseHint.trim() } : {}),
    ...(raw.tags?.length ? { tags: raw.tags.filter(Boolean) } : {}),
    ...(raw.payload ? { payload: raw.payload } : {}),
  };
};

export const createReactionEvent = (
  reaction: ARVReactionKind,
  source: ARVCommunityEventSource,
  userId?: string,
): ARVCommunityEvent => {
  const preset = ARV_REACTION_PRESETS[reaction];
  return normalizeARVCommunityEvent({
    type: 'reaction',
    source,
    label: preset.label,
    palette: preset.palette,
    intensity: preset.intensity,
    phaseHint: preset.phaseHint,
    tags: preset.tags,
    userId,
    payload: { reaction },
  });
};
