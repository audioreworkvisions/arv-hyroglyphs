import type { StylePreset } from './types';

export type StyleFlexMode = 'strict' | 'balanced' | 'loose';

export const DEFAULT_STYLE_FLEX_MODE: StyleFlexMode = 'balanced';

export const STYLE_FLEX_OPTIONS: Array<{ value: StyleFlexMode; label: string; description: string }> = [
  { value: 'strict', label: 'Fokus', description: 'enger am ARV-Kern bleiben' },
  { value: 'balanced', label: 'Balance', description: 'geführt, aber offen variieren' },
  { value: 'loose', label: 'Vielfalt', description: 'mehr Drift und Abweichung erlauben' },
];

export const STYLE_TASTE_NAME = 'Open Signal Core';

export const STYLE_TASTE_SUMMARY =
  'Calm but high-contrast ARV image language with one dominant subject or event, strong first-frame readability, quiet signal geometry, nocturnal control-room atmosphere, flexible material logic, and controlled loop motion. Favor atmosphere, precision, and slightly uncanny calm over formula, mascot polish, or decorative clutter.';

export const STYLE_TASTE_PALETTE =
  'possible palette anchors: matte black, void blue, pearl white, phosphor cyan, rotten CRT green, ember amber, sodium orange, oxidized copper, bruised violet, metallic silver, deep teal, dust beige, wet concrete, and restrained synthetic glow';

export const STYLE_TASTE_MOTIFS =
  'possible motifs: signal rings, eclipse overlaps, hex cores, corner rails, control frames, monitor stacks, machines, structures, synthetic ecologies, weather systems, miniature worlds, abstract fields, bodies reduced to operator gesture or silhouette, reflective objects, pressure diagrams, particles, membranes, seams, fractures, void objects, and evolving material systems';

export const STYLE_TASTE_TEXTURE =
  'available surface cues: phosphor grain, scanline residue, smoked glass, lacquer cracks, matte metal, dust, fog, sediment, paper fiber, CRT haze, fabric weave, wet reflections, magnetic debris, soft bloom, and hard poster contrast';

export const STYLE_TASTE_MOTION =
  'possible motion languages: breathing rings, orbital slips, cursor crawl, slow drift, structural opening and closing, control-light pulsing, corner expansion, code rain, chain reaction, ripple, sway, material leakage, one clear transformation payoff, and a loop-ready return';

export const STYLE_TASTE_TARGET =
  'calm, nocturnal, tactile, legible, atmospheric, slightly uncanny, and immediately readable';

export const STYLE_TASTE_SAFETY =
  'no strobe lights, no rapidly blinking lights, no very fast rotating objects, no nervous motifs, movements, patterns, colors, shapes, or lights, and no hectic pacing';

export const STYLE_TASTE_AVOID =
  'cute or playful mascots, smiling characters, big expressive eyes, soft pastel palettes, glossy toy-like 3D, rainbow fantasy gradients, anime or childrens-book framing, literal mystical cosplay, decorative pseudo-sacred costume illustration, crowded narrative clutter, photoreal people, frantic glitch spam, and defaulting every scene back into paper-cut witnesses, archive relic theatre, monolith idols, or stone-object folklore when the prompt does not ask for them';

export const STYLE_TASTE_SHORT_LABEL =
  'open ARV core · tactile tension · controlled motion';

export const STYLE_TASTE_PLACEHOLDER_PROMPT =
  'A lone structure of light, dust, and pressure shifts once inside a dark field while one material reaction ripples through the scene and returns to the opening pose.';

const STYLE_TASTE_LOCK_HEADER = `STYLE TASTE LOCK (${STYLE_TASTE_NAME}):`;

const STRUCTURED_PROMPT_METADATA_PREFIXES = [
  'Visual identity:',
  'Visual mood:',
  'Motion:',
  'Motion rule:',
  'Camera:',
  'Texture:',
  'Color rule:',
  'OBS rule:',
  'Avoid:',
] as const;

const normalizePromptWhitespace = (value: string): string =>
  value
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export function extractPromptCore(prompt: string): string {
  const normalized = normalizePromptWhitespace(prompt);

  if (!normalized) {
    return '';
  }

  const styleLockIndex = normalized.indexOf(STYLE_TASTE_LOCK_HEADER);
  const withoutStyleLock = styleLockIndex >= 0
    ? normalized.slice(0, styleLockIndex).trim()
    : normalized;

  const stillframeRenderLockIndex = withoutStyleLock.indexOf('\n\nStillframe render lock:');
  const withoutRenderLock = stillframeRenderLockIndex >= 0
    ? withoutStyleLock.slice(0, stillframeRenderLockIndex).trim()
    : withoutStyleLock;

  const lines = withoutRenderLock.split('\n');
  const hadStructuredMetadata = lines.some((line) =>
    STRUCTURED_PROMPT_METADATA_PREFIXES.some((prefix) => line.trim().startsWith(prefix)),
  );

  const keptLines = lines.filter((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return true;
    }

    if (/^SELECTED VISUAL PRESET \(/.test(trimmed)) {
      return false;
    }

    return !STRUCTURED_PROMPT_METADATA_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  });

  while (keptLines.length > 0 && !keptLines[0]?.trim()) {
    keptLines.shift();
  }

  while (keptLines.length > 0 && !keptLines[keptLines.length - 1]?.trim()) {
    keptLines.pop();
  }

  if (hadStructuredMetadata && keptLines.length >= 2) {
    const first = keptLines[0].trim();
    const second = keptLines[1].trim();
    const firstLooksLikeLabel =
      first.length > 0
      && first.split(/\s+/).length <= 8
      && !/[,:.!?]/.test(first)
      && second.split(/\s+/).length > 6;

    if (firstLooksLikeLabel) {
      keptLines.shift();
    }
  }

  return normalizePromptWhitespace(keptLines.join('\n'));
}

function getStyleFlexInstruction(styleMode: StyleFlexMode): {
  headline: string;
  anchorRule: string;
  variationRule: string;
  presetRule: string;
} {
  switch (styleMode) {
    case 'strict':
      return {
        headline: 'Stay inside a recognizable ARV family resemblance without falling back to the old archive-witness formula.',
        anchorRule: 'Choose 2-4 anchor traits, keep one dominant subject or event, and preserve negative space around it.',
        variationRule: 'Allow variation across signal icons, nocturnal control rooms, material systems, and geometric void studies, but keep palette, pacing, and composition controlled.',
        presetRule: 'If a preset is active, treat it as a strong guide while still allowing subject-specific nuance.',
      };
    case 'loose':
      return {
        headline: 'Keep the result intentional and adult while allowing strong departures in material, palette, and world logic.',
        anchorRule: 'Choose 1-2 anchor traits, but still keep one dominant subject, sparse composition, and controlled motion.',
        variationRule: 'Allow stronger shifts between signal-void geometry, control-room interiors, material worlds, graphic abstractions, and color behavior, as long as the result stays adult, legible, and non-cartoon.',
        presetRule: 'If a preset is active, treat it as a light mood influence rather than a hard constraint.',
      };
    case 'balanced':
    default:
      return {
        headline: 'Treat the style as a controlled family resemblance, not a costume kit or motif checklist.',
        anchorRule: 'Choose 1-3 anchor traits that sharpen the subject; keep one dominant subject or event and leave room around it.',
        variationRule: 'Allow signal-void icons, nocturnal control interiors, industrial, synthetic, abstract, architectural, atmospheric, ecological, or graphic interpretations, but keep the result hard-edged, sparse, and adult.',
        presetRule: 'If a preset is active, blend it with scene-specific variation instead of flattening the result.',
      };
  }
}

export function getStyleTasteSystemInstruction(styleMode: StyleFlexMode = DEFAULT_STYLE_FLEX_MODE): string {
  const flex = getStyleFlexInstruction(styleMode);

  return `HOUSE STYLE GUIDE (${styleMode.toUpperCase()}): ${STYLE_TASTE_SUMMARY}

${flex.headline}
- ${flex.anchorRule}
- Safety: ${STYLE_TASTE_SAFETY}
- Target feel: ${STYLE_TASTE_TARGET}
- Palette: choose one dominant family and at most 1-2 accents from ${STYLE_TASTE_PALETTE}
- Motifs: rotate motifs in and out; do not force all of these into the same scene: ${STYLE_TASTE_MOTIFS}
- Surface: use only the texture cues that help the scene: ${STYLE_TASTE_TEXTURE}
- Motion: vary cadence and intensity scene by scene: ${STYLE_TASTE_MOTION}
- Variation targets: ${flex.variationRule}
- Preset handling: ${flex.presetRule}
- Avoid: ${STYLE_TASTE_AVOID}

Every scene should still feel curated and intentional, but not formulaic or locked to the same recurring symbols.`;
}

function buildPresetInflection(preset?: StylePreset | null, styleMode: StyleFlexMode = DEFAULT_STYLE_FLEX_MODE): string {
  if (!preset || preset.id === 'neutral') return '';
  const presetLead = styleMode === 'strict'
    ? 'follow closely alongside the house style'
    : styleMode === 'loose'
      ? 'stay available as a loose color and mood influence'
      : 'blend with the house style without flattening variation';
  const visualIdentity = preset.visualIdentity?.trim() || preset.atmosphere;
  const mainPrompt = preset.examplePrompt?.trim();
  const shortPrompt = preset.shortPrompt?.trim() || mainPrompt;
  const negativePrompt = preset.negativePrompt?.trim() || preset.soraAvoid?.trim();
  const motionRule = preset.motionRule?.trim() || `Motion grammar: ${preset.motionStyle}`;
  const colorRule = preset.colorRule?.trim() || `Color anchor: ${preset.colorPalette}`;
  const obsRule = preset.obsRule?.trim() || 'Keep the lower third dark and uncluttered for OBS overlays.';

  return `Secondary preset inflection (${preset.name}) - ${presetLead}:
- Colors: ${preset.colorPalette}
- Lighting: ${preset.lighting}
- Camera: ${preset.cameraPerspective}
- Textures: ${preset.textures}
- Motion: ${preset.motionStyle}
- Symbols: ${preset.recurringSymbols}
- Atmosphere: ${preset.atmosphere}
- Visual identity: ${visualIdentity}
${mainPrompt ? `- Main prompt: ${mainPrompt}
` : ''}${shortPrompt ? `- Short prompt: ${shortPrompt}
` : ''}${negativePrompt ? `- Negative prompt: ${negativePrompt}
` : ''}- Motion rule: ${motionRule}
- Color rule: ${colorRule}
- OBS rule: ${obsRule}`;
}

export function buildStyleTasteLock(options: {
  preset?: StylePreset | null;
  userStyleContext?: string | null;
  extraNotes?: string[];
  styleMode?: StyleFlexMode;
} = {}): string {
  const styleMode = options.styleMode ?? DEFAULT_STYLE_FLEX_MODE;
  const flex = getStyleFlexInstruction(styleMode);
  const sections = [
    `STYLE TASTE LOCK (${STYLE_TASTE_NAME}):
- Identity: ${STYLE_TASTE_SUMMARY}
- Mode: ${styleMode.toUpperCase()}
- ${flex.headline}
- ${flex.anchorRule}
- Safety: ${STYLE_TASTE_SAFETY}
- Target feel: ${STYLE_TASTE_TARGET}
- Palette: ${STYLE_TASTE_PALETTE}
- Motifs: ${STYLE_TASTE_MOTIFS}
- Texture: ${STYLE_TASTE_TEXTURE}
- Motion: ${STYLE_TASTE_MOTION}
- Variation: ${flex.variationRule}
- Preset handling: ${flex.presetRule}
- Avoid: ${STYLE_TASTE_AVOID}`,
  ];

  const presetSection = buildPresetInflection(options.preset, styleMode);
  if (presetSection) sections.push(presetSection);

  const userStyleContext = options.userStyleContext?.trim();
  if (userStyleContext) sections.push(userStyleContext);

  const extraNotes = (options.extraNotes ?? []).map((note) => note.trim()).filter(Boolean);
  if (extraNotes.length > 0) {
    sections.push(`Scene emphasis:\n- ${extraNotes.join('\n- ')}`);
  }

  return sections.join('\n\n');
}

export function withStyleTaste(
  prompt: string,
  options: {
    preset?: StylePreset | null;
    userStyleContext?: string | null;
    extraNotes?: string[];
    styleMode?: StyleFlexMode;
  } = {},
): string {
  const basePrompt = prompt.trim();
  const lock = buildStyleTasteLock(options);

  if (!basePrompt) {
    return lock;
  }

  if (basePrompt.includes(STYLE_TASTE_LOCK_HEADER)) {
    const additions: string[] = [];
    const presetSection = buildPresetInflection(options.preset, options.styleMode ?? DEFAULT_STYLE_FLEX_MODE);
    if (presetSection && !basePrompt.includes(`Secondary preset inflection (${options.preset?.name})`)) {
      additions.push(presetSection);
    }

    const userStyleContext = options.userStyleContext?.trim();
    if (userStyleContext && !basePrompt.includes(userStyleContext)) {
      additions.push(userStyleContext);
    }

    const extraNotes = (options.extraNotes ?? []).map((note) => note.trim()).filter(Boolean);
    if (extraNotes.length > 0) {
      additions.push(`Scene emphasis:\n- ${extraNotes.join('\n- ')}`);
    }

    return additions.length > 0 ? `${basePrompt}\n\n${additions.join('\n\n')}` : basePrompt;
  }

  return `${basePrompt}\n\n${lock}`;
}
