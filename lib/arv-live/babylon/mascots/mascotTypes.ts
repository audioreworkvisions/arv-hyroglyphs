import type { Mesh, TransformNode } from '@babylonjs/core';

export type MascotImpulseReaction =
  | 'pulse'
  | 'fire'
  | 'acid'
  | 'dark'
  | 'peace-love-techno';

export interface MascotImpulse {
  intensity: number;
  bass?: number;
  kick?: number;
  reaction?: MascotImpulseReaction;
}

export interface LaughingSignalMascot {
  root: TransformNode;
  head: Mesh;
  leftEye: Mesh;
  rightEye: Mesh;
  grin: Mesh;
  applyImpulse: (impulse: MascotImpulse) => void;
  update: (dt: number, time: number) => void;
  dispose: () => void;
}