import type { StoryArcMode, StorySceneBeat } from './types';

export interface StoryboardTuningPreset {
  id: string;
  name: string;
  colorPalette: string;
  lighting: string;
  cameraPerspective: string;
  textures: string;
  motionStyle: string;
  recurringSymbols: string;
  atmosphere: string;
  examplePrompt?: string;
  visualIdentity?: string;
  shortPrompt?: string;
  negativePrompt?: string;
  motionRule?: string;
  colorRule?: string;
  obsRule?: string;
  creativeDirection?: string;
  soraAvoid?: string;
}

export const STORY_SCENE_BEATS: readonly StorySceneBeat[] = ['emergence', 'lock-in', 'peak', 'afterimage'];

const STORY_SCENE_BEAT_LABELS: Record<StorySceneBeat, { en: string; de: string }> = {
  emergence: { en: 'Emergence', de: 'Auftauchen' },
  'lock-in': { en: 'Lock-In', de: 'Lock-in' },
  peak: { en: 'Peak', de: 'Peak' },
  afterimage: { en: 'Afterimage', de: 'Afterimage' },
};

const STORY_ENGINE_MASTER_ADDITIONS: Record<StoryArcMode, string> = {
  cinematic:
    'seamless looping GIF-style video, 4, 8, or 12 seconds, strong first-frame readability, no strobe lights, no rapid blinking',
  iconic:
    'seamless looping GIF-style video, 4, 8, or 12 seconds, one dominant motif, strong first-frame readability, no strobe lights, no rapid blinking',
};

export function getStoryEngineMasterAddition(arcMode: StoryArcMode = 'iconic'): string {
  return STORY_ENGINE_MASTER_ADDITIONS[arcMode];
}

export function normalizeStoryArcMode(value: unknown): StoryArcMode {
  return value === 'cinematic' ? 'cinematic' : 'iconic';
}

export function getStorySceneBeatByIndex(index: number): StorySceneBeat {
  return STORY_SCENE_BEATS[index] ?? 'afterimage';
}

export function normalizeStorySceneBeat(value: unknown, index: number): StorySceneBeat {
  if (typeof value === 'string' && STORY_SCENE_BEATS.includes(value as StorySceneBeat)) {
    return value as StorySceneBeat;
  }

  return getStorySceneBeatByIndex(index);
}

export function getStorySceneBeatLabel(
  beat: StorySceneBeat,
  language: 'en' | 'de' = 'en',
): string {
  return STORY_SCENE_BEAT_LABELS[beat][language];
}

export const STORY_ENGINE_MATERIAL_NEGATIVE_PROMPT =
  'avoid readable text, fake inscriptions, logos, watermarks, gore, and aggressive flashing';

export const STORY_ENGINE_SYMBOLIC_NEGATIVE_PROMPT =
  'avoid readable text, fake inscriptions, logos, watermarks, gore, stereotypes, and aggressive flashing';

export const STORY_ENGINE_GRAFFITI_NEGATIVE_PROMPT =
  'avoid logos, watermarks, gore, and aggressive flashing';

export type StoryPromptMode = 'material' | 'symbolic' | 'graffiti';

const SYMBOLIC_PROMPT_PATTERN = /\b(op-art|op art|oracle|halo|signal ring|signal rings|mask|mandala|totem|diagram|emblem|portal|aperture|sigil|symbolic|iconic|afterimage|silhouette)\b/i;

const RAW_ABSTRACT_PROMPT_PATTERN = /\b(loop|loops|gif|geometry|geometric|abstract|spiral|shape|barcode|scanner|scanline|crt|flyer|underground|absurd|color block|colour block|forms|formen|schleife|geometrisch|abstrakt)\b/i;

const GRAFFITI_PROMPT_PATTERN = /\b(graffiti|graffitti|mural|street art|spray paint|spray-painted|aerosol|boardwalk|seaside|surf|flamingo|floatie|raft|bottle|beach dog|cartoon creature|lowbrow)\b/i;

const GRAFFITI_TRACK_PRESET_IDS = new Set([
  'sunset-seawall-graffiti',
]);

const MATERIAL_TRACK_PRESET_IDS = new Set([
  'broadcast-archaeology',
  'bass-weather-laboratory',
  'cable-monastery',
  'micro-city-on-vinyl',
  'deep-server-reef',
  'the-laughing-protocol',
  'chromatic-shard-torus',
  'chromatic-shard-torus-soft-bloom',
  'chromatic-shard-torus-techno-reactor',
  'chromatic-shard-torus-glitch-breach',
  'arv-buzzer-control-arena',
  'arv-no-laugh-signal-room',
  'arv-laughing-signal-mascot',
  'arv-arcade-buzzer-goblin',
]);

function buildStoryArcInstruction(arcMode: StoryArcMode, language: 'en' | 'de'): string {
  if (language === 'de') {
    return arcMode === 'iconic'
      ? 'ARC-MODUS: ICONIC LOOP ARC. Jede Szene soll wie eine memorierbare Serien-Ident wirken: frontal lesbar, mit einem dominanten Motiv, einem klaren Impact-Moment und einem Endbild, das hart haften bleibt oder sauber in den Loop fuehrt.'
      : 'ARC-MODUS: CINEMATIC ARC. Halte die Viererfolge filmischer und zusammenhaengender: mehr Raum fuer Atmosphaere, Uebergaenge und sequenzielle Kontinuitaet, aber jede Szene bleibt klar lesbar und endet in einem loopfaehigen Bild.';
  }

  return arcMode === 'iconic'
    ? 'ARC MODE: ICONIC LOOP ARC. Each scene should behave like a memorable series ident: instantly readable, built around one dominant motif, one decisive impact moment, and an end image that sticks or loops cleanly.'
    : 'ARC MODE: CINEMATIC ARC. Keep the four-scene sequence more filmic and connective: allow atmosphere, transitions, and sequential continuity to carry more weight, while every scene still resolves into a readable loop-ready image.';
}

function buildStoryBeatInstruction(language: 'en' | 'de'): string {
  if (language === 'de') {
    return [
      'SZENENSTRUKTUR (EXAKT EINHALTEN):',
      '- Szene 1 muss sceneBeat "emergence" tragen und als Auftauchen funktionieren: fuehre das Weltanker-Motiv in eine klare, sofort lesbare Form.',
      '- Szene 2 muss sceneBeat "lock-in" tragen und als Lock-in funktionieren: verankere die Regelwelt, ziehe die Komposition enger und steigere den Druck.',
      '- Szene 3 muss sceneBeat "peak" tragen und als Peak funktionieren: liefere die staerkste Transformation, Entladung oder das ikonischste Impact-Bild.',
      '- Szene 4 muss sceneBeat "afterimage" tragen und als Afterimage funktionieren: hinterlasse Echo, Rueckstand, Restlicht oder eine loopfaehige Endfigur.',
    ].join('\n');
  }

  return [
    'SCENE STRUCTURE (FOLLOW EXACTLY):',
    '- Scene 1 must use sceneBeat "emergence" and function as emergence: introduce the world-anchor motif in a clear, instantly readable form.',
    '- Scene 2 must use sceneBeat "lock-in" and function as lock-in: commit to the rule set, tighten the composition, and raise tension.',
    '- Scene 3 must use sceneBeat "peak" and function as peak: deliver the strongest transformation, release, or most iconic impact image.',
    '- Scene 4 must use sceneBeat "afterimage" and function as afterimage: leave a residue, echo, remnant glow, or loop-facing end figure.',
  ].join('\n');
}

export function buildPresetStoryboardInstruction(
  preset: StoryboardTuningPreset,
  arcMode: StoryArcMode = 'iconic',
): string {
  const presetNegativePrompt = getPresetNegativePrompt(
    preset,
    getNegativePromptForMode(detectStoryPromptMode(preset.examplePrompt ?? preset.atmosphere, { preset })),
  );
  const creativeDirectionLine = preset.creativeDirection
    ? `- Preset-specific creative directive (high priority): ${preset.creativeDirection}`
    : '';
  const visualIdentityLine = preset.visualIdentity ? `- Visual identity: ${preset.visualIdentity}` : '';
  const mainPromptLine = preset.examplePrompt ? `- Main prompt: ${preset.examplePrompt}` : '';
  const shortPromptLine = preset.shortPrompt ? `- Short prompt: ${preset.shortPrompt}` : '';
  const negativePromptLine = presetNegativePrompt ? `- Negative prompt: ${presetNegativePrompt}` : '';
  const motionRuleLine = preset.motionRule ? `- Motion rule: ${preset.motionRule}` : '';
  const colorRuleLine = preset.colorRule ? `- Color rule: ${preset.colorRule}` : '';
  const obsRuleLine = preset.obsRule ? `- OBS rule: ${preset.obsRule}` : '';

  return `SELECTED VISUAL PRESET (${preset.name}):
- Colors: ${preset.colorPalette}
- Lighting: ${preset.lighting}
- Camera: ${preset.cameraPerspective}
- Texture: ${preset.textures}
- Motion: ${preset.motionStyle}
- Symbols: ${preset.recurringSymbols}
- Atmosphere: ${preset.atmosphere}
${visualIdentityLine}
${mainPromptLine}
${shortPromptLine}
${negativePromptLine}
${motionRuleLine}
${colorRuleLine}
${obsRuleLine}
${creativeDirectionLine}

Use this preset as ignition material, not a rigid cage. Extract its strongest color, texture, motion, or compositional pressure, then let scenes mutate into fresh loop images. ${arcMode === 'iconic' ? 'Bias toward poster-like GIF ident moments with one dominant subject, one memorable motion payoff, and an end pose that feels instantly replayable.' : 'Bias toward connected loop progression with clearer physical handoff, tactile transitions, and loop-capable scene endings.'}
Mandatory safety guardrails: no strobe lights, no rapidly blinking lights.`;
}

export function normalizeScenePrompt(prompt: string): string {
  return prompt.replace(/\s+/g, ' ').trim();
}

export function detectStoryPromptMode(
  prompt: string,
  options: {
    sourcePrompt?: string | null;
    preset?: StoryboardTuningPreset | null;
  } = {},
): StoryPromptMode {
  if (options.preset?.id && MATERIAL_TRACK_PRESET_IDS.has(options.preset.id)) {
    return 'material';
  }

  if (options.preset?.id && GRAFFITI_TRACK_PRESET_IDS.has(options.preset.id)) {
    return 'graffiti';
  }

  const haystack = [
    prompt,
    options.sourcePrompt ?? '',
    options.preset?.id ?? '',
    options.preset?.name ?? '',
    options.preset?.recurringSymbols ?? '',
    options.preset?.atmosphere ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (GRAFFITI_PROMPT_PATTERN.test(haystack)) {
    return 'graffiti';
  }

  return SYMBOLIC_PROMPT_PATTERN.test(haystack) || RAW_ABSTRACT_PROMPT_PATTERN.test(haystack) ? 'symbolic' : 'material';
}

function getNegativePromptForMode(mode: StoryPromptMode): string {
  if (mode === 'symbolic') {
    return STORY_ENGINE_SYMBOLIC_NEGATIVE_PROMPT;
  }

  if (mode === 'graffiti') {
    return STORY_ENGINE_GRAFFITI_NEGATIVE_PROMPT;
  }

  return STORY_ENGINE_MATERIAL_NEGATIVE_PROMPT;
}

function getPresetNegativePrompt(
  preset: StoryboardTuningPreset | null | undefined,
  fallback: string,
): string {
  return preset?.negativePrompt ?? preset?.soraAvoid ?? fallback;
}

export function buildStoryNegativePrompt(
  prompt: string,
  options: {
    sourcePrompt?: string | null;
    preset?: StoryboardTuningPreset | null;
  } = {},
): string {
  return getNegativePromptForMode(detectStoryPromptMode(prompt, options));
}

export function buildFinalStoryPrompt(
  prompt: string,
  options: {
    sourcePrompt?: string | null;
    preset?: StoryboardTuningPreset | null;
    arcMode?: StoryArcMode;
  } = {},
): string {
  const basePrompt = normalizeScenePrompt(prompt);
  const { preset } = options;

  if (preset) {
    const avoid = getPresetNegativePrompt(
      preset,
      getNegativePromptForMode(detectStoryPromptMode(basePrompt, options)),
    );
    return [
      preset.name,
      '',
      basePrompt,
      '',
      preset.visualIdentity ? `Visual identity: ${preset.visualIdentity}` : '',
      `Visual mood: ${preset.atmosphere}`,
      `Motion: ${preset.motionStyle}`,
      preset.motionRule ? `Motion rule: ${preset.motionRule}` : '',
      `Camera: ${preset.cameraPerspective}`,
      `Texture: ${preset.textures}`,
      preset.colorRule ? `Color rule: ${preset.colorRule}` : '',
      preset.obsRule ? `OBS rule: ${preset.obsRule}` : '',
      `Avoid: ${avoid}`,
    ].filter(Boolean).join('\n');
  }

  // No preset: clean minimal output
  const masterAddition = getStoryEngineMasterAddition(options.arcMode ?? 'iconic');
  const negativePrompt = getNegativePromptForMode(detectStoryPromptMode(basePrompt, options));
  return normalizeScenePrompt([basePrompt, masterAddition, `Avoid: ${negativePrompt}`].join('. '));
}

export function buildStoryEngineSystemInstruction(
  userPrompt: string,
  preset?: StoryboardTuningPreset | null,
  language: 'en' | 'de' = 'en',
  arcMode: StoryArcMode = 'iconic',
): string {
  const presetBlock = preset && preset.id !== 'neutral'
    ? buildPresetStoryboardInstruction(preset, arcMode)
    : language === 'de'
      ? 'Wenn kein Preset gewaehlt ist, ist das Stilspektrum komplett offen: Welt, Palette, Material, Stimmung und Bewegungssprache duerfen frei aus der Idee entstehen. Bevorzuge pro Szene ein dominantes Motiv und einen klaren Bewegungs-Payoff.'
      : 'If no preset is selected, the style spectrum is fully open: world, palette, materials, mood, and motion language may emerge freely from the idea. Favor one dominant motif per scene and one clear motion payoff.';
  const arcInstruction = buildStoryArcInstruction(arcMode, language);
  const beatInstruction = buildStoryBeatInstruction(language);
  const masterAddition = getStoryEngineMasterAddition(arcMode);

  if (language === 'de') {
    return `Du bist ein KI-Videoregisseur und Storyboard-Kuenstler.
Erstelle aus einer kurzen Idee eine Sequenz aus genau 4 Szenen fuer ein Text-zu-Video-Modell.

PFLICHTREGELN:
1. Erzeuge einen klaren Bogen ueber 4 Szenen: Auftauchen, Zuspitzung, Verwandlung, Nachbild.
2. Entwerfe jede Szene als sofort lesbaren Hero-Moment: ein dominantes Motiv oder Ereignis, ein klarer Bewegungs-Payoff und eine Komposition, die im ersten Frame haften bleibt.
3. Nutze mutige, durchgehende Bewegung und klare Uebergaenge. Kamerafahrten, Transformationen, Eskalationen und ueberraschende Reveals sind ausdruecklich erwuenscht, solange alles gut lesbar bleibt.
4. Nutze das gewaehlte Preset als primaeren Stimmungsanker, nicht als starre Schablone.
5. Kein Strobo, kein schnelles Blinken.
6. Suche nach ausgefallenen, klar lesbaren Bildern: das Stilspektrum ist offen, jede Welt, jedes Material und jede Stimmung ist erlaubt.
7. Jede gifSpecification soll kurz, produktionsnah und direkt verwendbar sein, idealerweise ein Satz oder zwei kurze Halbsatze, etwa 18 bis 48 Woerter. Nenne zuerst das dominante Motiv und dann den charakteristischen Bewegungs- oder Transformationsmoment.
8. Keine Feldnamen, Presetnamen oder Labels wie ACTION, MOTION oder CONTINUITY in gifSpecification.

${arcInstruction}

${beatInstruction}

- Der ausgewaehlte Arc-Modus ergaenzt jede finale Szene intern mit diesem Produktionszusatz: ${masterAddition}

${presetBlock}

Antworte NUR mit gueltigem JSON ohne Markdown und ohne Code-Fences im exakten Format:
{
  "title": string,
  "settingDescription": string,
  "characterDefinition": string,
  "tone": string,
  "scenes": [
    {
      "sceneBeat": string,
      "action": string,
      "motionDescription": string,
      "continuityNotes": string,
      "gifSpecification": string
    }
  ]
}

Regeln:
- scenes muss exakt 4 Eintraege enthalten
- die sceneBeat-Werte muessen in dieser Reihenfolge exakt lauten: emergence, lock-in, peak, afterimage
- halte die Sprache knapp, bildhaft und filmisch
- jede gifSpecification soll bereits Motiv, Bewegung, Stilhinweis und einen konkreten Hook oder eine kleine Ueberraschung enthalten
- JSON only`;
  }

  return `You are an expert AI Video Prompt Engineer, Cinematic Director, and Storyboard Artist.
Your task is to take a single sentence idea and expand it into an exactly 4-scene story sequence for a Text-to-Video AI model.

CRITICAL STORYTELLING RULES:
1. CREATE A NARRATIVE ARC: Do not output 4 static shots of the same thing. There must be clear progression across emergence, escalation, transformation, and afterimage.
2. ICONIC SCENE DESIGN: Each scene must read immediately as a hero moment with one dominant subject or event, one decisive motion payoff, and a composition that sticks in the first frame.
3. BOLD CONTINUOUS MOTION: Include clear scene-to-scene transitions and strong subject movement. Camera moves, transformations, escalations, and surprising reveals are welcome as long as everything stays readable.
4. VISUAL STYLE: Treat the selected preset as ignition material, not a cage; allow scene-specific mutation as long as the sequence stays cohesive.
5. VISUAL SAFETY: No strobe lights, no rapidly blinking lights.
6. ORIGINALITY: The style spectrum is open — any world, material, palette, mood, or genre is valid. Favor standout images and memorable loop hooks over safe repetition.
7. PROMPT DISCIPLINE: Each gifSpecification must be a short, punchy, production-ready prompt, ideally one sentence or two short clauses, roughly 18 to 48 words. Name the dominant subject first, then the signature action or transformation.
8. Do not put labels such as SCENE ACTION, MOTION, CONTINUITY, or preset names inside gifSpecification.

${arcInstruction}

${beatInstruction}

- The selected arc mode adds this production suffix to each final scene prompt: ${masterAddition}

${presetBlock}

Return ONLY valid JSON with this exact shape:
{
  "title": string,
  "presetName": string,
  "mainMotif": string,
  "visualDNA": string,
  "colorPalette": string,
  "motionGrammar": string,
  "hookTitle": string,
  "negativePrompt": string,
  "settingDescription": string,
  "characterDefinition": string,
  "tone": string,
  "scenes": [
    {
      "sceneBeat": string,
      "action": string,
      "motionDescription": string,
      "continuityNotes": string,
      "gifSpecification": string
    }
  ]
}

Rules:
- scenes length must be exactly 4
- sceneBeat values must appear in this exact order: emergence, lock-in, peak, afterimage
- presetName should feel like a named ARV series world or universe
- hookTitle should be short, clip-ready, and memorable for stream titles or thumbnails
- mainMotif should name the recurring figure, object family, machine, or world-anchor
- visualDNA, colorPalette, and motionGrammar should be compact but production-useful
- negativePrompt should be concise, model-ready, and aligned with the chosen universe
- keep concise but cinematic language
- every gifSpecification should already contain the key visual subject, motion, and style cues
- no markdown, no code fences, JSON only`;
}