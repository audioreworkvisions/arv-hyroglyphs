import type { AudioReactiveSnapshot } from '../../AudioReactiveUniforms';
import type { RitualPhaseState } from '../../RitualPhaseController';
import { ARV_REACTION_PRESETS, type ARVReactionKind, type ARVVisualImpulse } from '../../types';
import type { ARVAudioFrame, ARVVisualEvent } from './ARVSceneController';

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

export const createDefaultControllerPhase = (accentHex: string): RitualPhaseState => ({
  name: 'dormant',
  label: 'Dormant Ritual',
  accentHex,
  energy: 0,
  crowdMultiplier: 0.82,
  portalMultiplier: 0.72,
  bloomBoost: 0.08,
});

export const toAudioReactiveSnapshot = (audio: ARVAudioFrame): AudioReactiveSnapshot => ({
  active: true,
  bass: audio.bass,
  mid: audio.mid,
  high: audio.high,
  rms: audio.rms,
  kick: audio.kick,
  bpm: audio.bpm ?? 0,
  permission: 'active',
});

export const reactionKindFromVisualEvent = (
  type: ARVVisualEvent['type'],
): ARVReactionKind | null => {
  switch (type) {
    case 'reaction.fire':
      return 'fire';
    case 'reaction.acid':
      return 'acid';
    case 'reaction.dark':
      return 'dark';
    case 'reaction.peaceLoveTechno':
      return 'peace-love-techno';
    case 'reaction.pulse':
      return 'pulse';
    default:
      return null;
  }
};

export const extractPhaseState = (event: ARVVisualEvent): RitualPhaseState | null => {
  if (event.type !== 'system.phaseChange') {
    return null;
  }

  const phase = event.payload?.phase;
  if (!phase || typeof phase !== 'object') {
    return null;
  }

  const candidate = phase as Partial<RitualPhaseState>;
  if (
    typeof candidate.name !== 'string'
    || typeof candidate.label !== 'string'
    || typeof candidate.accentHex !== 'string'
    || !isFiniteNumber(candidate.energy)
    || !isFiniteNumber(candidate.crowdMultiplier)
    || !isFiniteNumber(candidate.portalMultiplier)
    || !isFiniteNumber(candidate.bloomBoost)
  ) {
    return null;
  }

  return {
    name: candidate.name,
    label: candidate.label,
    accentHex: candidate.accentHex,
    energy: candidate.energy,
    crowdMultiplier: candidate.crowdMultiplier,
    portalMultiplier: candidate.portalMultiplier,
    bloomBoost: candidate.bloomBoost,
  };
};

export const isStandbyPhaseEvent = (event: ARVVisualEvent): boolean => {
  return event.type === 'system.phaseChange' && event.payload?.standby === true;
};

export const createImpulseFromVisualEvent = (
  event: ARVVisualEvent,
  fallbackColor: string,
): ARVVisualImpulse | null => {
  if (event.type === 'system.phaseChange') {
    return null;
  }

  const reaction = reactionKindFromVisualEvent(event.type);
  const reactionPreset = reaction ? ARV_REACTION_PRESETS[reaction] : null;
  const intensity = Math.min(
    1.35,
    Math.max(
      0.16,
      event.intensity
      ?? reactionPreset?.intensity
      ?? (event.type.startsWith('chat.') ? 0.44 : 0.72),
    ),
  );
  const isChat = event.type === 'chat.message' || event.type === 'chat.emoji';
  const isDrop = event.type === 'audio.drop';
  const colorHex = event.color || reactionPreset?.palette || fallbackColor;
  const burst = reaction === 'fire'
    ? intensity * 0.95
    : reaction === 'acid'
      ? intensity * 0.76
      : isChat
        ? intensity * 0.34
        : isDrop
          ? intensity * 0.82
          : intensity * 0.58;
  const sparkle = reaction === 'acid'
    ? intensity * 0.86
    : event.type === 'chat.emoji'
      ? intensity * 0.84
      : isChat
        ? intensity * 0.62
        : intensity * 0.36;
  const phaseBias = reaction === 'peace-love-techno'
    ? 0.88
    : reaction === 'dark'
      ? -0.35
      : intensity * 0.24;

  return {
    colorHex,
    intensity,
    burst,
    sparkle,
    phaseBias,
    label: typeof event.payload?.label === 'string' ? event.payload.label : event.type,
    isChat,
  };
};