import type { StylePreset } from './types';

export type StyleFlexMode = 'strict' | 'balanced' | 'loose';

export const DEFAULT_STYLE_FLEX_MODE: StyleFlexMode = 'loose';

export const STYLE_FLEX_OPTIONS: Array<{ value: StyleFlexMode; label: string; description: string }> = [
  { value: 'strict', label: 'Fokus', description: 'enger am ARV-Kern bleiben' },
  { value: 'balanced', label: 'Balance', description: 'geführt, aber offen variieren' },
  { value: 'loose', label: 'Vielfalt', description: 'mehr Drift und Abweichung erlauben' },
];

export const STYLE_TASTE_NAME = 'Raw Loop Core';

export const STYLE_TASTE_SUMMARY =
  'Raw early-ARV loop language: abstract geometric forms, saturated signal color, damaged analog texture, absurd underground reality, and one unmistakable loop event. Treat presets as ignition material, not cages; favor strange visual decisions, hard rhythm, and GIF-like repeatability over polished cinematic mood or recurring canon motifs.';

export const STYLE_TASTE_PALETTE =
  'possible palette anchors: dead black, cheap scanner white, phosphor cyan, hot magenta, signal red, acid lime, sodium orange, dirty yellow, bruised violet, cobalt blue, oxidized copper, wet concrete gray, photocopy beige, and abrupt synthetic color collisions';

export const STYLE_TASTE_MOTIFS =
  'possible motifs: crude signal rings, wobbling spirals, rectangles, scanner bands, barcode bars, folding grids, rubbery apertures, bent triangles, target marks, broken halos, color blocks, torn flyer geometry, cheap CRT diagrams, leaking silhouettes, pressure dots, absurd machine props, underground club residues, and ordinary objects behaving like signal organisms';

export const STYLE_TASTE_TEXTURE =
  'available surface cues: photocopy dirt, toner dust, VHS crawl, scanline residue, CRT bleed, cheap poster ink, spray overspray, wet concrete, scratched plastic, paper fiber, pixel smear, magnetic debris, soft bloom, rough compression, and hard flyer contrast';

export const STYLE_TASTE_MOTION =
  'possible motion languages: GIF-loop wobble, scanner sweep, one-frame color slip, spiral inhale, grid fold, barcode shuffle, dot burst, shape recoil, rubbery aperture open-close, photocopy duplicate collapse, slow drift into hard snapback, and visible return to frame one';

export const STYLE_TASTE_TARGET =
  'raw, tactile, legible, absurd, underground, rhythm-aware, loopable, high-contrast, and visually singular';

export const STYLE_TASTE_SAFETY =
  'no strobe lights, no rapidly blinking lights, no very fast rotating objects, no nervous motifs, movements, patterns, colors, shapes, or lights, and no hectic pacing';

export const STYLE_TASTE_AVOID =
  'cute or playful mascots, smiling characters, big expressive eyes, soft pastel palettes, glossy toy-like 3D, clean corporate motion graphics, luxury sci-fi moodboards, stock cinematic realism, anime or childrens-book framing, literal mystical cosplay, decorative pseudo-sacred costume illustration, crowded narrative clutter, photoreal people, frantic glitch spam, and defaulting every scene back into paper-cut witnesses, archive relic theatre, monolith idols, stone-object folklore, or any single preset family when the prompt does not ask for it';

export const STYLE_TASTE_SHORT_LABEL =
  'raw ARV loops · abstract forms · underground signal reality';

export const STYLE_TASTE_PLACEHOLDER_PROMPT =
  'A crooked geometric signal object wobbles inside black space, flashes one impossible color reaction, duplicates like a bad photocopy, then snaps back into the first frame.';

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
        headline: 'Keep the early ARV raw-loop identity recognizable without forcing any old motif family.',
        anchorRule: 'Choose 2-3 anchor traits, keep one dominant form or event, and make the loop mechanics obvious.',
        variationRule: 'Allow variation across geometry, color blocks, scanner errors, underground rooms, absurd objects, and signal organisms while keeping the frame readable.',
        presetRule: 'If a preset is active, treat it as a strong ingredient, not a scene recipe.',
      };
    case 'loose':
      return {
        headline: 'Open the style back up: let the idea mutate into strange abstract loop reality while retaining ARV texture and rhythm.',
        anchorRule: 'Choose 1-2 anchor traits, but still keep one dominant form, a clear loop event, and strong first-frame readability.',
        variationRule: 'Allow hard shifts between geometric voids, cheap broadcast graphics, underground room fragments, absurd object rituals, color-field accidents, and tactile material glitches.',
        presetRule: 'If a preset is active, sample it like a record: steal one useful color, motion, or texture cue and then let the scene find its own form.',
      };
    case 'balanced':
    default:
      return {
        headline: 'Treat the style as a raw loop language, not a costume kit or motif checklist.',
        anchorRule: 'Choose 1-3 traits that sharpen the image; keep one dominant form or event and make the loop return visible.',
        variationRule: 'Allow signal geometry, underground interiors, industrial scraps, absurd objects, abstract fields, crude diagrams, color accidents, and material mutations, but keep the result hard-edged and readable.',
        presetRule: 'If a preset is active, blend only the useful parts with scene-specific invention instead of flattening the result.',
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
