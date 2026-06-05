import type { AudioReactiveSnapshot } from './AudioReactiveUniforms';
import type { ARVPhaseLock, ARVVisualImpulse } from './types';

export type RitualPhaseName = 'dormant' | 'invocation' | 'surge' | 'peak' | 'euphoria';

export interface RitualPhaseState {
  name: RitualPhaseName;
  label: string;
  accentHex: string;
  energy: number;
  crowdMultiplier: number;
  portalMultiplier: number;
  bloomBoost: number;
}

const PHASES: Array<RitualPhaseState & { threshold: number }> = [
  {
    name: 'dormant',
    label: 'Dormant Ritual',
    accentHex: '#818cf8',
    energy: 0,
    crowdMultiplier: 0.82,
    portalMultiplier: 0.72,
    bloomBoost: 0.08,
    threshold: 0,
  },
  {
    name: 'invocation',
    label: 'Invocation',
    accentHex: '#22d3ee',
    energy: 0,
    crowdMultiplier: 1,
    portalMultiplier: 1,
    bloomBoost: 0.18,
    threshold: 0.22,
  },
  {
    name: 'surge',
    label: 'Surge',
    accentHex: '#8b5cf6',
    energy: 0,
    crowdMultiplier: 1.22,
    portalMultiplier: 1.24,
    bloomBoost: 0.32,
    threshold: 0.45,
  },
  {
    name: 'peak',
    label: 'Peak Pressure',
    accentHex: '#fb7185',
    energy: 0,
    crowdMultiplier: 1.44,
    portalMultiplier: 1.5,
    bloomBoost: 0.48,
    threshold: 0.68,
  },
  {
    name: 'euphoria',
    label: 'Peace Love Techno',
    accentHex: '#f59e0b',
    energy: 0,
    crowdMultiplier: 1.72,
    portalMultiplier: 1.82,
    bloomBoost: 0.72,
    threshold: 0.88,
  },
];

export class RitualPhaseController {
  private energy = 0.16;
  private current = PHASES[0];

  registerImpulse(impulse: ARVVisualImpulse): void {
    this.energy = Math.min(1.25, this.energy + impulse.intensity * 0.26 + impulse.phaseBias * 0.22);
  }

  update(deltaSeconds: number, audio: AudioReactiveSnapshot, phaseLock: ARVPhaseLock = 'auto'): RitualPhaseState {
    const audioDrive = audio.rms * 0.34 + audio.bass * 0.28 + audio.kick * 0.52;
    this.energy = Math.min(1.25, this.energy + audioDrive * deltaSeconds * 2.4);
    this.energy = Math.max(0, this.energy - deltaSeconds * 0.11);

    if (phaseLock !== 'auto') {
      const lockedPhase = PHASES.find((phase) => phase.name === phaseLock) || PHASES[0];
      this.current = lockedPhase;
      this.energy = Math.max(this.energy, lockedPhase.threshold);
      return {
        ...lockedPhase,
        energy: Math.min(1, Math.max(this.energy, lockedPhase.threshold)),
      };
    }

    for (let index = PHASES.length - 1; index >= 0; index -= 1) {
      if (this.energy >= PHASES[index].threshold) {
        this.current = PHASES[index];
        break;
      }
    }

    return {
      ...this.current,
      energy: Math.min(1, this.energy),
    };
  }
}
