import { type ARVCommunityEvent, type ARVVisualImpulse } from './types';

const PHASE_BIAS: Record<string, number> = {
  dormant: 0.08,
  invocation: 0.18,
  spiral: 0.28,
  surge: 0.44,
  peak: 0.74,
  euphoria: 1,
};

const KEYWORD_PALETTES: Array<{ pattern: RegExp; colorHex: string; sparkle: number }> = [
  { pattern: /fire|ignite|burn|hot/i, colorHex: '#fb7185', sparkle: 0.72 },
  { pattern: /acid|303|squelch|neon/i, colorHex: '#a3e635', sparkle: 0.62 },
  { pattern: /dark|void|shadow|night/i, colorHex: '#818cf8', sparkle: 0.34 },
  { pattern: /peace|love|techno|anthem/i, colorHex: '#f59e0b', sparkle: 0.84 },
  { pattern: /portal|machine|soul|ritual/i, colorHex: '#8b5cf6', sparkle: 0.58 },
];

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const interpretCommunityEvent = (event: ARVCommunityEvent): ARVVisualImpulse => {
  if (event.type === 'reaction') {
    return {
      colorHex: event.palette,
      intensity: clamp01(event.intensity),
      burst: 0.7 + event.intensity * 0.9,
      sparkle: 0.24 + event.intensity * 0.56,
      phaseBias: PHASE_BIAS[event.phaseHint || 'surge'] || 0.32,
      label: event.label,
      isChat: false,
    };
  }

  if (event.type === 'chat') {
    const keywordMatch = KEYWORD_PALETTES.find((entry) => entry.pattern.test(event.text || ''));
    const intensity = clamp01(0.35 + event.intensity * 0.75);

    return {
      colorHex: keywordMatch?.colorHex || event.palette,
      intensity,
      burst: 0.28 + intensity * 0.46,
      sparkle: keywordMatch?.sparkle || 0.24 + intensity * 0.24,
      phaseBias: PHASE_BIAS[event.phaseHint || 'invocation'] || 0.18,
      label: event.text || event.label,
      isChat: true,
    };
  }

  return {
    colorHex: event.palette,
    intensity: clamp01(event.intensity),
    burst: 0.22,
    sparkle: 0.18,
    phaseBias: PHASE_BIAS[event.phaseHint || 'dormant'] || 0.12,
    label: event.label,
    isChat: false,
  };
};
