export const ARV_SCENE_CONTROLLER_IDS = [
  'arv-laughing-signal-mascot',
  'arv-archive-iris-kaleidoscope',
  'arv-neon-micro-city',
  'arv-triangular-torus-bloom',
  'arv-orbital-data-sphere',
  'arv-last-connector',
  'arv-please-wait-terminal',
  'arv-glitch-portrait-transmission',
  'arv-operator-attic',
] as const;

export type ARVSceneControllerId = (typeof ARV_SCENE_CONTROLLER_IDS)[number];

export const isARVSceneControllerId = (value: string): value is ARVSceneControllerId => {
  return ARV_SCENE_CONTROLLER_IDS.includes(value as ARVSceneControllerId);
};