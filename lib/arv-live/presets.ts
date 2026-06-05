import type { ARVSceneControllerId } from './babylon/controllers/controllerIds';

export type ARVLiveMode = 'obs' | 'viewer';
export type ARVHudMode = 'full' | 'minimal' | 'none' | 'preview';
export type ARVViewerControlMode = 'hidden' | 'compact' | 'full';
export type ARVQualityTier = 'eco' | 'obs' | 'ultra';

export interface ARVLiveRuntimeOptions {
  defaultHudMode?: Exclude<ARVHudMode, 'preview'>;
  showFeed?: boolean;
  feedCollapsedByDefault?: boolean;
  viewerControls?: ARVViewerControlMode;
  keyboardReactions?: boolean;
  transparentBackground?: boolean;
}

export interface ARVQualitySettings {
  tier: ARVQualityTier;
  hardwareScaling: number;
  particleCapacity: number;
  crowdRadius: number;
  baseEmitRate: number;
  emitBoost: number;
  enableBloom: boolean;
  cameraRadius: number;
}

export interface ARVLiveVisualPreset {
  id: string;
  title: string;
  controllerId: ARVSceneControllerId;
  sceneKind?: 'default' | 'arcadeMascot' | 'cyberpunkCity' | 'prismShards';
  runtimeOptions?: ARVLiveRuntimeOptions;
  backgroundHex: string;
  fogHex: string;
  portalHex: string;
  crowdHex: string;
  accentHex: string;
  titleHex: string;
}

export const ARV_LIVE_PRESETS: Record<string, ARVLiveVisualPreset> = {
  darkTechno: {
    id: 'darkTechno',
    title: 'ARV Witness Relay',
    controllerId: 'arv-laughing-signal-mascot',
    sceneKind: 'arcadeMascot',
    runtimeOptions: {
      defaultHudMode: 'minimal',
      showFeed: true,
      feedCollapsedByDefault: true,
      viewerControls: 'compact',
      keyboardReactions: true,
    },
    backgroundHex: '#06080d',
    fogHex: '#0a0d14',
    portalHex: '#7b96d8',
    crowdHex: '#4c5f73',
    accentHex: '#b87b55',
    titleHex: '#ece2d6',
  },
  archiveIrisKaleidoscope: {
    id: 'archiveIrisKaleidoscope',
    title: 'Archive Iris Kaleidoscope',
    controllerId: 'arv-archive-iris-kaleidoscope',
    sceneKind: 'default',
    runtimeOptions: {
      defaultHudMode: 'minimal',
      showFeed: true,
      feedCollapsedByDefault: true,
      viewerControls: 'compact',
      keyboardReactions: true,
    },
    backgroundHex: '#060607',
    fogHex: '#121418',
    portalHex: '#d7d1c8',
    crowdHex: '#2a2d34',
    accentHex: '#8e7865',
    titleHex: '#f1ebe1',
  },
  acidCathedral: {
    id: 'acidCathedral',
    title: 'Acid Cathedral',
    controllerId: 'arv-neon-micro-city',
    sceneKind: 'cyberpunkCity',
    runtimeOptions: {
      defaultHudMode: 'minimal',
      showFeed: true,
      feedCollapsedByDefault: true,
      viewerControls: 'compact',
      keyboardReactions: true,
    },
    backgroundHex: '#080918',
    fogHex: '#1a1330',
    portalHex: '#56ecff',
    crowdHex: '#ff66e8',
    accentHex: '#91f3ff',
    titleHex: '#d9fbff',
  },
  emberMachine: {
    id: 'emberMachine',
    title: 'Ember Machine',
    controllerId: 'arv-triangular-torus-bloom',
    sceneKind: 'prismShards',
    runtimeOptions: {
      defaultHudMode: 'minimal',
      showFeed: true,
      feedCollapsedByDefault: true,
      viewerControls: 'compact',
      keyboardReactions: true,
    },
    backgroundHex: '#030612',
    fogHex: '#0a1432',
    portalHex: '#4f7dff',
    crowdHex: '#8db5ff',
    accentHex: '#71e5ff',
    titleHex: '#d9e7ff',
  },
  'arv-laughing-signal-mascot': {
    id: 'arv-laughing-signal-mascot',
    title: 'ARV Signal Witness Chamber',
    controllerId: 'arv-laughing-signal-mascot',
    sceneKind: 'arcadeMascot',
    runtimeOptions: {
      defaultHudMode: 'minimal',
      showFeed: true,
      feedCollapsedByDefault: true,
      viewerControls: 'compact',
      keyboardReactions: true,
    },
    backgroundHex: '#05070b',
    fogHex: '#090d15',
    portalHex: '#8aa3d8',
    crowdHex: '#47596c',
    accentHex: '#b66f44',
    titleHex: '#eee4d5',
  },
  'arv-orbital-data-sphere': {
    id: 'arv-orbital-data-sphere',
    title: 'ARV Orbital Data Sphere',
    controllerId: 'arv-orbital-data-sphere',
    runtimeOptions: {
      defaultHudMode: 'minimal',
      showFeed: true,
      feedCollapsedByDefault: true,
      viewerControls: 'compact',
      keyboardReactions: true,
    },
    backgroundHex: '#030711',
    fogHex: '#08132a',
    portalHex: '#6cecff',
    crowdHex: '#9b8cff',
    accentHex: '#dffaff',
    titleHex: '#ecfeff',
  },
  'arv-last-connector': {
    id: 'arv-last-connector',
    title: 'ARV Last Connector',
    controllerId: 'arv-last-connector',
    runtimeOptions: {
      defaultHudMode: 'minimal',
      showFeed: true,
      feedCollapsedByDefault: true,
      viewerControls: 'compact',
      keyboardReactions: true,
    },
    backgroundHex: '#05070c',
    fogHex: '#0b111d',
    portalHex: '#7ecbff',
    crowdHex: '#aac7ff',
    accentHex: '#d8ecff',
    titleHex: '#f3f8ff',
  },
  'arv-please-wait-terminal': {
    id: 'arv-please-wait-terminal',
    title: 'ARV Please Wait Terminal',
    controllerId: 'arv-please-wait-terminal',
    runtimeOptions: {
      defaultHudMode: 'minimal',
      showFeed: true,
      feedCollapsedByDefault: true,
      viewerControls: 'compact',
      keyboardReactions: true,
    },
    backgroundHex: '#020913',
    fogHex: '#05111e',
    portalHex: '#4df7ff',
    crowdHex: '#7bf4ff',
    accentHex: '#6fd2ff',
    titleHex: '#d8fbff',
  },
  'arv-glitch-portrait-transmission': {
    id: 'arv-glitch-portrait-transmission',
    title: 'ARV Glitch Portrait Transmission',
    controllerId: 'arv-glitch-portrait-transmission',
    runtimeOptions: {
      defaultHudMode: 'minimal',
      showFeed: true,
      feedCollapsedByDefault: true,
      viewerControls: 'compact',
      keyboardReactions: true,
    },
    backgroundHex: '#030711',
    fogHex: '#0a1120',
    portalHex: '#68ecff',
    crowdHex: '#ff59cf',
    accentHex: '#f2fbff',
    titleHex: '#ecfeff',
  },
  'arv-operator-attic': {
    id: 'arv-operator-attic',
    title: 'ARV Operator Attic',
    controllerId: 'arv-operator-attic',
    runtimeOptions: {
      defaultHudMode: 'minimal',
      showFeed: true,
      feedCollapsedByDefault: true,
      viewerControls: 'compact',
      keyboardReactions: true,
    },
    backgroundHex: '#03070c',
    fogHex: '#091019',
    portalHex: '#67ffb0',
    crowdHex: '#84f6ff',
    accentHex: '#d6ffe7',
    titleHex: '#effff6',
  },
};

export const ARV_CURATED_LIVE_PRESET_IDS = [
  'archiveIrisKaleidoscope',
  'darkTechno',
  'arv-laughing-signal-mascot',
  'emberMachine',
  'arv-glitch-portrait-transmission',
  'arv-last-connector',
  'arv-operator-attic',
] as const;

const ARV_CURATED_LIVE_PRESET_ID_SET = new Set<string>(ARV_CURATED_LIVE_PRESET_IDS);

export const ARV_CURATED_LIVE_PRESETS: ARVLiveVisualPreset[] = ARV_CURATED_LIVE_PRESET_IDS
  .map((presetId) => ARV_LIVE_PRESETS[presetId])
  .filter((preset): preset is ARVLiveVisualPreset => Boolean(preset));

export const ARV_ORDERED_LIVE_PRESETS: ARVLiveVisualPreset[] = [
  ...ARV_CURATED_LIVE_PRESETS,
  ...Object.values(ARV_LIVE_PRESETS).filter((preset) => !ARV_CURATED_LIVE_PRESET_ID_SET.has(preset.id)),
];

export const ARV_DEFAULT_LIVE_CONTROL_PRESET_ID = 'darkTechno';

export const isKnownARVLivePresetId = (value: string): boolean => {
  return Object.prototype.hasOwnProperty.call(ARV_LIVE_PRESETS, value);
};

export const resolveARVLivePresetId = (
  value: string | null | undefined,
  fallback = ARV_DEFAULT_LIVE_CONTROL_PRESET_ID,
): string => {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  return isKnownARVLivePresetId(normalized) ? normalized : fallback;
};

const QUALITY_SETTINGS: Record<ARVQualityTier, ARVQualitySettings> = {
  ultra: {
    tier: 'ultra',
    hardwareScaling: 0.85,
    particleCapacity: 120000,
    crowdRadius: 11.5,
    baseEmitRate: 14500,
    emitBoost: 46000,
    enableBloom: true,
    cameraRadius: 10.1,
  },
  obs: {
    tier: 'obs',
    hardwareScaling: 1,
    particleCapacity: 90000,
    crowdRadius: 10.5,
    baseEmitRate: 12000,
    emitBoost: 38000,
    enableBloom: true,
    cameraRadius: 9.5,
  },
  eco: {
    tier: 'eco',
    hardwareScaling: 1.8,
    particleCapacity: 16000,
    crowdRadius: 7.2,
    baseEmitRate: 2800,
    emitBoost: 9000,
    enableBloom: false,
    cameraRadius: 8.4,
  },
};

export const detectARVQualityTier = (mode: ARVLiveMode): ARVQualityTier => {
  if (typeof navigator === 'undefined') {
    return mode === 'obs' ? 'obs' : 'ultra';
  }

  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigatorWithMemory.deviceMemory || 4;
  const lowEnd = cores <= 4 || memory <= 4;

  if (lowEnd) {
    return 'eco';
  }

  return mode === 'obs' ? 'obs' : 'ultra';
};

export const isARVQualityTier = (value: string): value is ARVQualityTier => {
  return value === 'eco' || value === 'obs' || value === 'ultra';
};

export const resolveARVQualityTier = (
  value: string | null | undefined,
  fallback: ARVQualityTier,
): ARVQualityTier => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || !isARVQualityTier(normalized)) {
    return fallback;
  }

  return normalized;
};

export const getARVQualitySettings = (tier: ARVQualityTier): ARVQualitySettings => {
  return QUALITY_SETTINGS[tier];
};

export const getARVLivePreset = (presetId: string): ARVLiveVisualPreset => {
  return ARV_LIVE_PRESETS[presetId] || ARV_LIVE_PRESETS.darkTechno;
};
