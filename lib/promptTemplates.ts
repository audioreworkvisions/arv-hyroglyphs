import { PRESETS } from './presets';

export interface PromptTemplate {
  id: string;
  label: string;
  prompt: string;
  category: string;
  target: 'single' | 'story' | 'both';
  suggestedPresetId?: string | null;
  requestPrompt?: string | null;
}

export interface StoryboardRequestPromptDebug {
  rawPrompt: string;
  normalizedPrompt: string;
  promptTemplateId: string | null;
  matchedTemplateId?: string;
  normalizationNotes: string[];
}

function normalizePromptWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function softenStoryProductionRestrictions(basePrompt: string): string {
  return basePrompt
    .replace(/,\s*no readable text/gi, '')
    .replace(/,\s*no logos?/gi, '')
    .replace(/,\s*no logo/gi, '')
    .replace(/,\s*no watermark/gi, '')
    .replace(/,\s*no direct show branding/gi, '')
    .replace(/,\s*no copyrighted branding/gi, '')
    .replace(/,\s*,/g, ', ')
    .replace(/,\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const GRAFFITI_PRESET_ID = 'sunset-seawall-graffiti';

const SINGLE_TEMPLATE_ARV_HARDENING =
  'Keep it tactile, adult, raw-trippy, and immediately loop-readable: one dominant geometric form, absurd object, or event, centered or clearly intentional composition, sparse frame, clean lower third for OBS overlays, locked or very slow camera, strong analog texture, brave scene-led color, and explicit snapback motion. Bias toward dark, nocturnal, void-held, or underground-room environments unless the concept strongly needs another setting. Let the world choose its own surfaces instead of defaulting to archive-witness, paper-cut, monolith, or stone-relic imagery. Avoid childish softness, mascot design, glossy fantasy-cartoon finish, stock cinematic realism, or crowd clutter.';

const SINGLE_TEMPLATE_GRAFFITI_HARDENING =
  'Keep it wall-readable and painted: one dominant creature, object, or mural gag, broad sunset gradient bands, thick outlines, spray-paint softness, and a loop-ready payoff. Allow deadpan cartoon creatures and surreal seaside object icons, but keep them hand-painted and dry rather than glossy or toy-like. Avoid photoreal humans, dense tag lettering, corporate vector polish, Pixar-style 3D, violent street cliches, or cluttered backgrounds.';

function hardenSingleTemplatePrompt(basePrompt: string, suggestedPresetId?: string | null): string {
  const hardening = suggestedPresetId === GRAFFITI_PRESET_ID
    ? SINGLE_TEMPLATE_GRAFFITI_HARDENING
    : SINGLE_TEMPLATE_ARV_HARDENING;

  return `${basePrompt.trim()} ${hardening}`.trim();
}

function buildStoryTemplatePrompt(
  basePrompt: string,
  extraDirection?: string,
  options: { suggestedPresetId?: string | null } = {},
): string {
  const direction = extraDirection ? ` ${extraDirection}` : '';
  const softenedBasePrompt = softenStoryProductionRestrictions(basePrompt);

  if (options.suggestedPresetId === GRAFFITI_PRESET_ID) {
    return `${softenedBasePrompt} Build it as an exact 4-scene video arc coded as scene 1 emergence, scene 2 lock-in, scene 3 peak, scene 4 afterimage, with increasingly memorable mural panels, one broad visual gag or transformation per scene, and at least one ARV-style spiral, diagram, portal, or signal interruption across the sequence. Treat every scene as a wall-readable loop moment with one dominant painted character or object, one decisive buoyant motion payoff, and a final mural pose that either hands off cleanly to the next scene or hangs as a repeatable afterimage. Keep continuity, but let the seaside graffiti world become bolder, stranger, sunnier, and more iconically hand-painted from scene to scene. Keep the style graphic, mural-flat, and tactile: frontal or side-on composition, shallow painted depth, spray-paint overspray, thick outlines, simple horizon or water bands, and visible loop logic. Allow deadpan lowbrow creatures and surreal object-characters; do not force the result back into dark archive-witness, paper-cut, monolith, or stone-relic canon. Explicitly avoid photoreal humans, dense lettering, glossy mascot render language, violent street stereotypes, and overpacked detail.${direction}`;
  }

  return `${softenedBasePrompt} Build it as an exact 4-scene video arc coded as scene 1 emergence, scene 2 lock-in, scene 3 peak, scene 4 afterimage, with escalating reveals, tactile motion in every scene, and at least one strange geometric transformation, color slip, scanner event, or material reaction. Treat every scene as a clear loop-ready moment with one dominant form, one decisive motion payoff, and a final image that either hands off cleanly to the next scene or snaps into a repeatable afterimage. Keep continuity, but let the world become bolder, odder, more raw, and more instantly readable from scene to scene. Keep the style adult, sparse, raw-trippy, and tactile: locked or very slow camera, centered or clearly intentional framing, clean lower third for OBS overlays, strong analog damage, coherent contrast, brave scene-specific palette, visible loop logic, and a preference for dark, nocturnal, void-biased, or underground-room space unless the prompt clearly needs another setting. Do not default back into archive-witness, paper-cut, monolith, or stone-relic canon unless the prompt explicitly asks for it. Explicitly avoid cute, mascot-like, whimsical, glossy, fantasy-cartoon language, stock cinematic realism, or random daylight realism. If text, labels, or branding appear, keep them subtle, secondary, and non-dominant.${direction}`;
}

const STORY_TEMPLATE_ARC_MARKER = /Build it as an exact 4-scene video arc coded as scene 1 emergence/i;
const STORY_TEMPLATE_SCENE_MARKER = /Scene 1 emergence:/i;
const STORY_TEMPLATE_DIRECTIVE_IN_THE_PREFIX = /^Create an? (?:exact )?4-scene(?: ARV)? story(?: sequence)? in the\s+/i;
const STORY_TEMPLATE_DIRECTIVE_THAT_PREFIX = /^Create an? (?:exact )?4-scene(?: ARV)? story(?: sequence)? that\s+/i;
const STORY_TEMPLATE_DIRECTIVE_PREFIX = /^Create an? (?:exact )?4-scene(?: ARV)? story(?: sequence)?\s+/i;

function finalizeCompactStoryPrompt(value: string): string {
  const compact = normalizePromptWhitespace(value).replace(/[\s,:;.-]+$/, '');

  if (!compact) {
    return '';
  }

  return /[.!?]$/.test(compact) ? compact : `${compact}.`;
}

function condenseStoryTemplatePrompt(prompt: string): { normalizedPrompt: string; normalizationNotes: string[] } {
  const normalizedPrompt = normalizePromptWhitespace(prompt);

  if (!normalizedPrompt) {
    return { normalizedPrompt: '', normalizationNotes: [] };
  }

  const arcMarkerMatch = STORY_TEMPLATE_ARC_MARKER.exec(normalizedPrompt);

  if (arcMarkerMatch && arcMarkerMatch.index > 0) {
    return {
      normalizedPrompt: finalizeCompactStoryPrompt(normalizedPrompt.slice(0, arcMarkerMatch.index)),
      normalizationNotes: ['Removed the built-in 4-scene arc instructions from the story request.'],
    };
  }

  const sceneMarkerMatch = STORY_TEMPLATE_SCENE_MARKER.exec(normalizedPrompt);

  if (!sceneMarkerMatch || sceneMarkerMatch.index <= 0) {
    return { normalizedPrompt, normalizationNotes: [] };
  }

  const leadSentence = normalizedPrompt.slice(0, sceneMarkerMatch.index).trim();
  const compactLead = normalizePromptWhitespace(
    leadSentence
      .replace(STORY_TEMPLATE_DIRECTIVE_IN_THE_PREFIX, '')
      .replace(STORY_TEMPLATE_DIRECTIVE_THAT_PREFIX, '')
      .replace(STORY_TEMPLATE_DIRECTIVE_PREFIX, ''),
  );

  if (!compactLead) {
    return {
      normalizedPrompt,
      normalizationNotes: [],
    };
  }

  return {
    normalizedPrompt: `Core story direction: ${finalizeCompactStoryPrompt(compactLead)}`,
    normalizationNotes: ['Condensed the selected story template to its world anchor before sending it to the model.'],
  };
}

const RETIRED_PRESET_TEMPLATE_IDS = new Set([
  'style-taste-archive',
  'archive-iris-kaleidoscope',
  'mirror-witness-duet',
  'ancestral-halo-witness',
  'stillframe-rituals',
  'enochian-sun-dance-codex',
]);

const RETIRED_PROMPT_TEMPLATE_IDS = new Set([
  'broadcast-archaeology',
  'the-laughing-protocol',
  'archive-iris-kaleidoscope',
  'broadcast-archaeology-storyworld',
  'laughing-protocol-storyworld',
  'archive-misremembers',
  'paper-prism',
  'cyber-oracle',
  'esdc-scene-01-first-drum',
  'esdc-scene-02-watchers-rhythm',
  'esdc-scene-03-glyphs-footwork',
  'esdc-scene-04-sun-disk-smiles',
  'esdc-scene-05-inca-stairway',
  'esdc-scene-06-maize-constellation',
  'esdc-scene-07-feathered-light-river',
  'esdc-scene-08-joy-archive',
  'esdc-scene-09-cosmic-circle',
  'esdc-scene-10-dancing-codex-remains',
  'esdc-story-arc',
  'sr-archiv-zeuge',
  'sr-maschinen-moench',
  'sr-mond-botin',
  'sr-fehler-heilige',
  'sr-projector-breath',
  'sr-mechanical-blink',
  'sr-moon-hand-signal',
  'sr-flatline-saint',
  'sr-dust-oracle',
  'sr-shadow-moves-first',
  'sr-orbit-error',
  'sr-candle-signal',
  'sr-archive-animal',
  'sr-signal-behind-mask',
]);

export const CURATED_STORY_IDENT_TEMPLATE_IDS = [
  'chromatic-shard-torus-storyworld',
  'chromatic-shard-cathedral-storyworld',
  'chromatic-shard-reactor-storyworld',
  'calm-signal-archive-storyline',
  'coded-mandala-cathedral-storyline',
  'story-preset-signal-ring-eclipse',
  'story-preset-glass-engine-breathing',
  'story-preset-magnetic-desert-crossing',
] as const;

export const CURATED_STORY_WORLD_TEMPLATE_IDS = [
  'story-preset-micro-city-on-vinyl',
  'story-preset-bass-weather-laboratory',
  'story-preset-cable-monastery',
  'story-preset-deep-server-reef',
  'story-preset-dead-channel-ministry',
  'story-preset-fossil-synth-excavation',
  'story-preset-cosmic-waiting-room',
  'story-preset-operator-after-midnight',
  'story-preset-sunset-seawall-graffiti',
  'attic-terminal-reverie-storyline',
] as const;

const BASE_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'broadcast-archaeology',
    label: 'Broadcast Archaeology',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'broadcast-archaeology',
    prompt: 'A forgotten broadcast archive wakes in a concrete room, anonymous CRT presenter face flickering behind diagonal warning tape while scanlines, dust, and cyan overexposure breathe in a slow ritual loop.',
  },
  {
    id: 'the-laughing-protocol',
    label: 'The Laughing Protocol',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'the-laughing-protocol',
    prompt: 'A damaged signal witness plate hangs in a black relay chamber, twin prism cores misregistered behind a crooked cyan mouth-line while projector dust and scanline wounds pulse with controlled institutional dread.',
  },
  {
    id: 'archive-iris-kaleidoscope',
    label: 'Archive Iris Kaleidoscope',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'archive-iris-kaleidoscope',
    prompt: 'A monochrome archive iris machine fills the frame in perfect radial symmetry, black eclipse wells ringing the edges while smoked-silver folded plates breathe inward toward a graphite center and photocopy bloom softens every seam.',
  },
  {
    id: 'micro-city-on-vinyl',
    label: 'Micro-City on Vinyl',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'micro-city-on-vinyl',
    prompt: 'A miniature neon city grows from the grooves of a black vinyl record, cyan rim light circling the disc while fog drifts between tiny towers and magenta windows wake one by one.',
  },
  {
    id: 'bass-weather-laboratory',
    label: 'Bass Weather Laboratory',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'bass-weather-laboratory',
    prompt: 'A giant black subwoofer cone inside a dark laboratory creates its own weather system, graphite dust lifting into a rotating storm ring while tiny cyan lightning crawls through vapor and copper grit hangs in the air.',
  },
  {
    id: 'cable-monastery',
    label: 'Cable Monastery',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'cable-monastery',
    prompt: 'A dark underground monastery made entirely of black audio cables grows into symmetrical archways, metallic connectors catching copper reflections while faint cyan jack plugs glow softly through drifting fog.',
  },
  {
    id: 'deep-server-reef',
    label: 'Deep Server Reef',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'deep-server-reef',
    prompt: 'A deep underwater data reef rests on the ocean floor, black server towers rising like coral while cables sway like sea grass and metallic fish carry blue memory particles through slow abyssal sediment.',
  },
  {
    id: 'dead-channel-ministry',
    label: 'Dead-Channel Ministry',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'dead-channel-ministry',
    prompt: 'A dark bureaucratic ministry for dead channels manages lost frequencies with muted green CRT rows, mechanical stamp arms approving blank black screens while drawers exhale cold signal fog through dusty cyan office light.',
  },
  {
    id: 'neon-court-of-algorithms',
    label: 'Neon Court of Algorithms',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'neon-court-of-algorithms',
    prompt: 'An algorithmic courtroom floats in a black marble void, cyan evidence cubes and unreadable holographic files orbiting an empty witness chair while dark judge pillars rotate with ceremonial techno calm.',
  },
  {
    id: 'fossil-synth-excavation',
    label: 'Fossil Synth Excavation',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'fossil-synth-excavation',
    prompt: 'A fossilized synthesizer is excavated from black volcanic sand inside a dark museum chamber, stone keys and ancient copper circuits glowing through cracks while turquoise vapor escapes in a slow archaeological loop.',
  },
  {
    id: 'cosmic-waiting-room',
    label: 'Cosmic Waiting Room',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'cosmic-waiting-room',
    prompt: 'An infinite cosmic waiting room stretches through a black void, empty chairs and a muted green ticket machine facing one closed door while a cyan waiting light breathes over drifting dust and stars.',
  },
  {
    id: 'magnetic-desert-crossing',
    label: 'Magnetic Desert Crossing',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'magnetic-desert-crossing',
    prompt: 'A small autonomous relic crosses a black magnetic dust desert, cyan headlights bending iron dunes while invisible force fields lift slow ridges and the ground heals behind the machine.',
  },
  {
    id: 'glass-engine-breathing',
    label: 'Glass Engine Breathing',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'glass-engine-breathing',
    prompt: 'A transparent glass engine floats in a dark laboratory void, black liquid and cyan-amber pulses moving through internal channels like artificial breath while small bubbles pause inside the machine.',
  },
  {
    id: 'neon-memory-cemetery',
    label: 'Neon Memory Cemetery',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'neon-memory-cemetery',
    prompt: 'A dark data cemetery of black memory stones emits faint cyan file ghosts over reflective ground while fog and corrupted particles drift through a melancholic archive night.',
  },
  {
    id: 'operator-after-midnight',
    label: 'Operator After Midnight',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'operator-after-midnight',
    prompt: 'A dark attic operator room after midnight holds a hooded silhouette before stacked green CRT monitors, cable roots across the desk and slow smoke drifting through one warm lamp beam.',
  },
  {
    id: 'subterranean-club-organism',
    label: 'Subterranean Club Organism',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'subterranean-club-organism',
    prompt: 'An underground club behaves like a living concrete organism, black walls breathing like lungs while speaker ribs release cyan fog pulses over wet reflections and empty bass architecture.',
  },
  {
    id: 'failed-future-museum',
    label: 'Failed Future Museum',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'failed-future-museum',
    prompt: 'A museum of failed futures glows in darkness, obsolete machines resting in glass cases while cyan display light and drifting dust reveal one artifact slowly opening a mechanical shutter.',
  },
  {
    id: 'signal-plague-orchestra',
    label: 'Signal Plague Orchestra',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'signal-plague-orchestra',
    prompt: 'Black geometric relics float in a dark void as tiny cyan signal spores spread elegant mechanical tremors and controlled magenta glitches across their surfaces in a calm contagion wave.',
  },
  {
    id: 'tram-to-nowhere',
    label: 'Tram to Nowhere',
    category: 'ARV Series',
    target: 'both',
    suggestedPresetId: 'tram-to-nowhere',
    prompt: 'A silent dark-glass tram moves through a black-blue city at night, cyan rails glowing beneath it while blank windows reflect magenta and teal light through drifting brutalist fog.',
  },
  {
    id: 'chromatic-shard-torus',
    label: 'Chromatic Shard Torus',
    category: 'Geometry',
    target: 'both',
    suggestedPresetId: 'chromatic-shard-torus',
    prompt: 'A dense torus of jagged low-poly prisms floats in a black void, acid-yellow and lime-green facets stacked into a spiked circular mass while cyan and red RGB edge splits create a precise analog-glitch afterimage.',
  },
  {
    id: 'chromatic-shard-torus-soft-bloom',
    label: 'Chromatic Shard Torus · Soft Bloom',
    category: 'Geometry',
    target: 'both',
    suggestedPresetId: 'chromatic-shard-torus-soft-bloom',
    prompt: 'A softer torus of translucent lime and acid-yellow shards hovers in a black void, cyan mist and gentle RGB fringing wrapping the spiked ring in a velvety bloom while the form breathes with calm low-contrast motion.',
  },
  {
    id: 'chromatic-shard-torus-techno-reactor',
    label: 'Chromatic Shard Torus · Techno Reactor',
    category: 'Geometry',
    target: 'both',
    suggestedPresetId: 'chromatic-shard-torus-techno-reactor',
    prompt: 'A hard-edged torus of interlocking neon prisms turns like a disciplined rave reactor in a black club void, acid-yellow and lime shard blades locked into a machine ring with crisp cyan-red channel offsets and precise industrial motion.',
  },
  {
    id: 'chromatic-shard-torus-glitch-breach',
    label: 'Chromatic Shard Torus · Glitch Breach',
    category: 'Geometry',
    target: 'both',
    suggestedPresetId: 'chromatic-shard-torus-glitch-breach',
    prompt: 'An aggressive spiked torus hangs in black space, lime-yellow shard clusters splitting into delayed cyan-red echo contours and torn scanline fringes while the ring flexes with slow high-tension glitch energy.',
  },
  {
    id: 'chromatic-shard-torus-storyworld',
    label: 'Story · Chromatic Shard Torus',
    category: 'ARV Series',
    target: 'story',
    suggestedPresetId: 'chromatic-shard-torus',
    requestPrompt: 'Chromatic Shard Torus universe as a brutal recurring series ident with one dominant torus event per scene and no characters.',
    prompt: 'Create a 4-scene ARV story in the Chromatic Shard Torus universe and treat it less like abstract coverage and more like a brutal recurring series ident. Scene 1 emergence: the torus condenses from dust, pressure, or a latent aperture into one instantly legible idol silhouette. Scene 2 lock-in: the spike ring hardens, symmetry bites down, and the void starts to obey the machine. Scene 3 peak: the torus breaches into RGB ghost shells, shard violence, and one unforgettable pressure image. Scene 4 afterimage: the reactor collapses to a haunted aperture or wounded residue that still feels replayable. One dominant torus event per scene, no characters, and any text or branding should stay subtle and secondary.',
  },
  {
    id: 'chromatic-shard-cathedral-storyworld',
    label: 'Story · Chromatic Shard Cathedral',
    category: 'ARV Series',
    target: 'story',
    suggestedPresetId: 'chromatic-shard-torus-soft-bloom',
    requestPrompt: 'Chromatic Shard Cathedral universe as a sacred machine ident with one dominant sanctuary event per scene and no characters.',
    prompt: 'Create a 4-scene ARV story in the Chromatic Shard Cathedral universe and treat it like a sacred machine ident that viewers should recognize in one frame. Scene 1 emergence: halo dust and cyan mist gather into one luminous nave silhouette. Scene 2 lock-in: shard petals and prism ribs click into an impossible cathedral with ceremonial pressure. Scene 3 peak: one uncanny rite or spatial mutation turns the sanctuary into stained-glass machine ecstasy. Scene 4 afterimage: the whole cathedral folds down to a thin living aperture or relic glow that can loop forever. One dominant sanctuary event per scene, no characters, and any text or branding should stay subtle and secondary.',
  },
  {
    id: 'chromatic-shard-reactor-storyworld',
    label: 'Story · Chromatic Shard Reactor',
    category: 'ARV Series',
    target: 'story',
    suggestedPresetId: 'chromatic-shard-torus-techno-reactor',
    requestPrompt: 'Chromatic Shard Reactor universe as a clip-ready broadcast ident for a violent machine cult with one dominant reactor event per scene and no characters.',
    prompt: 'Create a 4-scene ARV story in the Chromatic Shard Reactor universe and make it feel like a clip-ready broadcast ident for a violent machine cult. Scene 1 emergence: the pressure chamber wakes and one reactor core silhouette claims the frame. Scene 2 lock-in: prism blades snap into disciplined rhythm and the chamber starts behaving like a ritual engine. Scene 3 peak: the reactor overshoots into one dangerous, elegant impact image with orbiting debris and pressure waves. Scene 4 afterimage: the machine vents down to a scorched emblem, black core, or smoking residue that still dares a replay. One dominant reactor event per scene, no characters, and any text or branding should stay subtle and secondary.',
  },
  {
    id: 'broadcast-archaeology-storyworld',
    label: 'Story · Broadcast Archaeology Ident',
    category: 'ARV Series',
    target: 'story',
    suggestedPresetId: 'broadcast-archaeology',
    requestPrompt: 'Broadcast Archaeology universe as a forbidden station ident with one dominant transmission rupture per scene.',
    prompt: 'Create a 4-scene ARV story in the Broadcast Archaeology universe and aim for a forbidden station ident, not a vague art sequence. Scene 1 emergence: one blocked presenter face claws through concrete darkness and CRT snow. Scene 2 lock-in: warning tape, cracked monitors, and cyan overburn trap the broadcast inside a hard frontal tableau. Scene 3 peak: the archive tears inward through a spiral signal tunnel or transmission rupture that becomes the image everyone remembers. Scene 4 afterimage: the signal dies back to one haunted freeze-frame, lone cyan dot, or censored remnant. One dominant transmission event per scene, and any text or branding should stay subtle and secondary.',
  },
  {
    id: 'laughing-protocol-storyworld',
    label: 'Story · The Laughing Protocol Ident',
    category: 'ARV Series',
    target: 'story',
    suggestedPresetId: 'the-laughing-protocol',
    requestPrompt: 'The Laughing Protocol universe as a recurring underground transmission ident with one dominant signal event per scene.',
    prompt: 'Create a 4-scene ARV story in The Laughing Protocol universe and make it behave like a recurring underground transmission ident, not a mascot spot. Scene 1 emergence: one damaged faceplate appears from blackout with only a crooked mouth-line or one prism core alive. Scene 2 lock-in: the witness plate, relay chamber, and scrutiny geometry snap into hard symmetry. Scene 3 peak: one controlled mouth-line split or prism misregistration creates the unforgettable pressure image. Scene 4 afterimage: the witness burns back to a cyan slit, one surviving core, or a ghosted duplicate contour ready to loop. One dominant signal event per scene, and any text or branding should stay subtle and secondary.',
  },
  {
    id: 'calm-signal-archive-storyline',
    label: 'Story · Calm Signal Archive',
    category: 'ARV Series',
    target: 'story',
    suggestedPresetId: 'signal-ring-eclipse',
    requestPrompt: 'Merge the calm signal archive from prompt_storys with the broader ARV GIF folder into a recognizable recurring ident with one dominant calm-signal event per scene.',
    prompt: 'Create a 4-scene ARV story that merges the calm signal archive from prompt_storys with the broader ARV GIF folder and make it behave like a recognizable recurring ident, not a loose mood montage. Scene 1 emergence: one cyan-violet ring, white core, eclipse overlap, or quiet orbital icon appears in a velvet-black field. Scene 2 lock-in: the signal passes through one phosphor-lit attic terminal, control corner, stacked light rail, or room-scale frame that becomes the dominant anchor. Scene 3 peak: the world compresses into one hex chamber, aperture bloom, coded mandala, or layered geometry event with measured inner-core pressure. Scene 4 afterimage: the system resolves back to a sparse signal emblem, wave bridge, terminal residue, or low-lit relay scar that can loop forever. One dominant event per scene, dark or nocturnal backgrounds preferred, centered or clearly intentional composition, no text, no logo, no crowded lore props, and no aggressive glitch spam.',
  },
  {
    id: 'attic-terminal-reverie-storyline',
    label: 'Story · Attic Terminal Reverie',
    category: 'ARV Series',
    target: 'story',
    suggestedPresetId: 'deep-underground-hacker',
    requestPrompt: 'Attic Terminal Reverie universe as a recurring nocturnal machine rite with one dominant terminal activation event per scene.',
    prompt: 'Create a 4-scene ARV story in the Attic Terminal Reverie universe and make it feel like a recurring nocturnal machine rite, not generic hacker b-roll. Scene 1 emergence: one dusty CRT, desk lamp, or terminal stack wakes inside an attic blackout with steam and cable residue. Scene 2 lock-in: the room reveals its workbench order through keyboard rows, rotary ghosts, cooling fans, cursor trails, or one phosphor-lit control corner. Scene 3 peak: one machine-thought event lands, such as monitor bloom, signal spill, cable-root movement, or a small electrical weather change that briefly reorganizes the whole desk. Scene 4 afterimage: the system exhales back into a dim green screen, warm lamp pool, steam trace, or patient idle state that can loop forever. One dominant activation event per scene, dark nocturnal room logic, no text overlays, no logo, and no modern gamer-RGB clutter.',
  },
  {
    id: 'coded-mandala-cathedral-storyline',
    label: 'Story · Coded Mandala Cathedral',
    category: 'ARV Series',
    target: 'story',
    suggestedPresetId: 'coded-mandala-cathedral',
    requestPrompt: 'Coded Mandala Cathedral universe as a monumental signal ident with one dominant cathedral-core event per scene.',
    prompt: 'Create a 4-scene ARV story in the Coded Mandala Cathedral universe and make it behave like a monumental signal ident, not a vague cyberspace montage. Scene 1 emergence: one centered portal flower, coded ring, or dim cathedral iris appears from black with slow signal rain. Scene 2 lock-in: nested spokes, code curtains, and relay-glass architecture align into one impossible nave with hard symmetry. Scene 3 peak: the structure compresses inward through one unforgettable core event, such as stained circuit ignition, sulfur spokes, or a disciplined radial collapse that feels immense but calm. Scene 4 afterimage: the cathedral resolves to a sparse portal emblem, low-lit signal residue, or one surviving radiant core that can repeat forever. One dominant cathedral event per scene, dark void-biased backgrounds, no lore clutter, no text, no logo, and no frantic glitch spectacle.',
  },
  {
    id: 'ferrofluid-bass-lake',
    label: 'Ferrofluid Bass Lake',
    category: 'Material',
    target: 'both',
    suggestedPresetId: 'style-taste-archive',
    prompt: 'A pool of black ferrofluid rises into slow metallic spikes around an invisible bass field inside a dark laboratory void.',
  },
  {
    id: 'cable-forest',
    label: 'Cable Forest Wakes',
    category: 'Material',
    target: 'both',
    suggestedPresetId: 'deep-underground-hacker',
    prompt: 'Black audio cables grow slowly from a matte concrete floor, bending toward a hidden bass source until they form a temporary tunnel.',
  },
  {
    id: 'tape-river',
    label: 'Tape River',
    category: 'Material',
    target: 'both',
    suggestedPresetId: 'hypnotic-c4d-geometry',
    prompt: 'A river of black cassette tape flows through a dark room, reflecting blue and amber light as it twists like liquid memory.',
  },
  {
    id: 'concrete-temple',
    label: 'Concrete Sound Temple',
    category: 'Architecture',
    target: 'both',
    suggestedPresetId: 'signal-ring-eclipse',
    prompt: 'A concrete sound temple appears from darkness, all weight, shadow, fog, and slow structural motion, with no symbols and no floral forms.',
  },
  {
    id: 'speaker-weather',
    label: 'Speaker Weather',
    category: 'Physics',
    target: 'both',
    suggestedPresetId: 'coded-mandala-cathedral',
    prompt: 'A giant black speaker cone moves in extreme slow motion, lifting dust into a miniature storm field with faint blue internal light.',
  },
  {
    id: 'fossil-synth',
    label: 'Fossil Synth',
    category: 'Fossil Tech',
    target: 'both',
    suggestedPresetId: 'abstract-techno-visuals',
    prompt: 'A fossilized synthesizer emerges from black sand in a dark excavation chamber, stone keys and copper traces glowing faintly from inside.',
  },
  {
    id: 'glass-engine',
    label: 'Glass Engine',
    category: 'Machine',
    target: 'both',
    suggestedPresetId: 'glitch-matrix-vortex',
    prompt: 'A transparent glass engine turns without visible gears, only liquid pathways and suspended bubbles moving in slow rhythm through black fog.',
  },
  {
    id: 'data-jellyfish',
    label: 'Data Jellyfish',
    category: 'Data Animal',
    target: 'both',
    suggestedPresetId: 'ancestral-halo-witness',
    prompt: 'A translucent data jellyfish floats through black space, its tentacles made of thin cyan lines and soft drifting particles.',
  },
  {
    id: 'micro-city-disc',
    label: 'Micro-City Disc',
    category: 'Micro World',
    target: 'both',
    suggestedPresetId: 'acid-geometry',
    prompt: 'A tiny city grows on the surface of a black disc, buildings rising from grooves while fog moves between them.',
  },
  {
    id: 'archive-misremembers',
    label: 'Archive Machine',
    category: 'Machine Ritual',
    target: 'both',
    suggestedPresetId: 'broadcast-hypnosis-mask',
    prompt: 'A black archive machine opens one drawer in a silent room and releases a small glowing fog creature that briefly turns another drawer into a tiny city.',
  },
  {
    id: 'deep-server-reef-industrial-ocean',
    label: 'Deep Server Reef',
    category: 'Industrial Ocean',
    target: 'both',
    suggestedPresetId: 'deep-underground-hacker',
    prompt: 'A dark underwater data center appears through drifting sediment while cables sway like sea grass and metallic fish move between the server towers.',
  },
  {
    id: 'magnetic-desert',
    label: 'Magnetic Desert',
    category: 'Material',
    target: 'both',
    suggestedPresetId: 'signal-ring-eclipse',
    prompt: 'Invisible magnetic fields raise black iron dust into dunes and ridges while a small machine crosses the desert and the landscape erases its trail.',
  },
  {
    id: 'weather-machine',
    label: 'Weather Machine',
    category: 'Weather',
    target: 'both',
    suggestedPresetId: 'coded-mandala-cathedral',
    prompt: 'A small glass weather machine creates a private thundercloud inside a dark cube, tiny blue lightning crawling slowly through mist.',
  },
  {
    id: 'paper-prism',
    label: 'Paper Prism',
    category: 'Symbolic',
    target: 'both',
    suggestedPresetId: 'broadcast-hypnosis-mask',
    prompt: 'A hand-cut paper prism folds and shifts slowly inside black-and-white concentric rings, paper-fiber textures drifting with soft analog shadow.',
  },
  {
    id: 'signal-eclipse',
    label: 'Signal Eclipse',
    category: 'Symbolic',
    target: 'both',
    suggestedPresetId: 'signal-ring-eclipse',
    prompt: 'A cyan-violet signal ring floats in matte black space while twin waveform lines enter from left and right around a tiny white core.',
  },
  {
    id: 'cyber-oracle',
    label: 'Cyber Oracle',
    category: 'Symbolic',
    target: 'both',
    suggestedPresetId: 'ancestral-halo-witness',
    prompt: 'A silver-black oracle plate emerges from projector smoke, halo reduced to tiny cyan registry marks and dotted rings while the witness face holds in damaged stillness.',
  },
  {
    id: 'cobalt-lotus',
    label: 'Cobalt Signal Bloom',
    category: 'Symbolic',
    target: 'both',
    suggestedPresetId: 'uv-rave-neon',
    prompt: 'A cobalt signal bloom unfolds from a black aperture, petal-like plates misregistering with rust-amber edges around a faceless mechanical core.',
  },
  {
    id: 'machine-soul-gate',
    label: 'Machine Soul Gate',
    category: 'Symbolic',
    target: 'both',
    suggestedPresetId: 'coded-mandala-cathedral',
    prompt: 'A black machine portal opens in the center of a velvet void, copper rings and cyan sparks moving around the rim like controlled electricity.',
  },
  {
    id: 'community-orbs',
    label: 'Community Orbs',
    category: 'Community',
    target: 'both',
    suggestedPresetId: 'glitch-matrix-vortex',
    prompt: 'A sparse ring of anonymous shadow silhouettes forms around a central portal, each body reduced to one cyan edge residue while the room behaves like a disciplined relay ritual.',
  },
  // ── Enochian Sun Dance Codex — Story Arc: The Star Scribe Learns to Dance ──
  {
    id: 'esdc-scene-01-first-drum',
    label: 'ESDC · Scene 1 — Drum Map Emergence',
    category: 'Enochian Sun Dance Codex',
    target: 'both',
    suggestedPresetId: 'enochian-sun-dance-codex',
    prompt: 'A black codex panel emerges from projector haze, one witness silhouette standing before a star map of abstract orbit cuts and woven relief geometry. Faded cream paper, cobalt shadow, jade and oxidized-gold accents. Locked wide frame, lower third clean. Dominant event: the map pulses once and duplicates into a xerox ring.',
  },
  {
    id: 'esdc-scene-02-watchers-rhythm',
    label: 'ESDC · Scene 2 — Watchers Lock In',
    category: 'Enochian Sun Dance Codex',
    target: 'both',
    suggestedPresetId: 'enochian-sun-dance-codex',
    prompt: 'Two tall stone-relief watcher silhouettes stabilize in mirrored stance above a dark floor grid while thin jade-cyan filaments align like measured notation. Camera applies slow forward pressure, 16:9. Dominant event: both figures raise one arm and a single wave of glyphic light locks the frame.',
  },
  {
    id: 'esdc-scene-03-glyphs-footwork',
    label: 'ESDC · Scene 3 — Glyphs Learn Footwork',
    category: 'Enochian Sun Dance Codex',
    target: 'both',
    suggestedPresetId: 'enochian-sun-dance-codex',
    prompt: 'Abstract glyph blocks and shadow bodies perform slow mirrored footwork across a black stone panel, each step leaving faded cream and cyan afterimages like photocopied choreography. Locked camera, symmetrical composition, lower third clean. Dominant event: the floor pattern snaps into one hard dance constellation.',
  },
  {
    id: 'esdc-scene-04-sun-disk-smiles',
    label: 'ESDC · Scene 4 — Signal Disk Without a Face',
    category: 'Enochian Sun Dance Codex',
    target: 'both',
    suggestedPresetId: 'enochian-sun-dance-codex',
    prompt: 'A faceless signal disk rises behind stepped relief architecture, built from sun-ring geometry, jade inlays, terracotta dust, and black paper darkness. Camera locked wide, 16:9. Dominant event: one completed circular step releases a rust-amber burn-through across the frame.',
  },
  {
    id: 'esdc-scene-05-inca-stairway',
    label: 'ESDC · Scene 5 — Terrace Relay',
    category: 'Enochian Sun Dance Codex',
    target: 'both',
    suggestedPresetId: 'enochian-sun-dance-codex',
    prompt: 'A stepped terrace of stone blocks and woven pattern logic hangs inside black space while one anonymous silhouette climbs in measured footwork. Oxidized-gold knots ignite one by one. Slow upward drift, lower third clean. Dominant event: the highest terrace bridges into one suspended archive line.',
  },
  {
    id: 'esdc-scene-06-maize-constellation',
    label: 'ESDC · Scene 6 — Seed Constellation',
    category: 'Enochian Sun Dance Codex',
    target: 'both',
    suggestedPresetId: 'enochian-sun-dance-codex',
    prompt: 'Seed-like points and geometric crop marks rise from a black field of relief texture while shadow bodies move with slow wrist snaps and shoulder pulses. Jade, cobalt, terracotta, and faded cream. Locked camera, lower third clean. Dominant event: both hands open and the seed marks spiral into one coded constellation.',
  },
  {
    id: 'esdc-scene-07-feathered-light-river',
    label: 'ESDC · Scene 7 — Ribbon of Light',
    category: 'Enochian Sun Dance Codex',
    target: 'both',
    suggestedPresetId: 'enochian-sun-dance-codex',
    prompt: 'A ribbon of jade-cyan light moves through black space like a torn textile diagram while silhouettes on codex stones guide it with minimal arm motions. Slow side drift, 16:9. Dominant event: the ribbon curls once into a hard spiral and leaves a scratched afterimage.',
  },
  {
    id: 'esdc-scene-08-joy-archive',
    label: 'ESDC · Scene 8 — Archive Aperture',
    category: 'Enochian Sun Dance Codex',
    target: 'both',
    suggestedPresetId: 'enochian-sun-dance-codex',
    prompt: 'A celestial archive aperture opens above suspended panels of abstract glyph rhythm, sun-ring geometry, and woven grid logic. One witness silhouette raises a hand; everything else stays austere. Camera locked central, 16:9, lower third clean. Dominant event: the aperture releases one oxidized-gold wave through the panels.',
  },
  {
    id: 'esdc-scene-09-cosmic-circle',
    label: 'ESDC · Scene 9 — Relay Circle',
    category: 'Enochian Sun Dance Codex',
    target: 'both',
    suggestedPresetId: 'enochian-sun-dance-codex',
    prompt: 'Anonymous shadow silhouettes form a sparse circle on an obsidian plaza of stepped geometry while a larger orbit pattern mirrors them overhead. Wide locked shot, 16:9, lower third clean. Dominant event: the ring turns once and the overhead system copies the rotation as a cosmic filing diagram.',
  },
  {
    id: 'esdc-scene-10-dancing-codex-remains',
    label: 'ESDC · Scene 10 — Archive Afterimage',
    category: 'Enochian Sun Dance Codex',
    target: 'both',
    suggestedPresetId: 'enochian-sun-dance-codex',
    prompt: 'The figures burn away, leaving one floating codex page of abstract dance marks, orbit paths, seed constellations, and relief scars. Calm final frame, analog dust, projector haze, seamless end state. Dominant event: the last silhouette dissolves into a faded cream afterimage.',
  },
  {
    id: 'esdc-story-arc',
    label: 'Story · ESDC — Glyphic Archive Procession',
    category: 'Enochian Sun Dance Codex',
    target: 'story',
    suggestedPresetId: 'enochian-sun-dance-codex',
    prompt: 'Create an exact 4-scene video arc in the Glyphic Archive Procession universe: scene 1 emergence, scene 2 lock-in, scene 3 peak, scene 4 afterimage. Treat cultural reference only as abstract structural inspiration: glyphic rhythm, stone-relief geometry, codex-panel composition, woven pattern logic, sun-disk geometry, celestial archive systems. Scene 1 emergence: a witness silhouette and black codex panel emerge from projector haze. Scene 2 lock-in: the geometry stabilizes into a poster-like signal frame. Scene 3 peak: one transformation hits, such as a signal disk, seed constellation, light ribbon, or archive aperture. Scene 4 afterimage: the figures burn down to xerox residue, a codex page, or a loop-ready ghost trace. Style: dark analog archive, black paper, faded cream, cobalt shadow, jade accents, oxidized gold, rust amber projector glow, cyan-magenta misregistration, sparse composition, 16:9, lower third clean. No readable text, no pseudo-sacred illustration, no violence, no clutter.',
  },
];

// ── Stillframe Rituals – Charakter-Archetypen ─────────────────────────────

const STILLFRAME_CHARACTER_TEMPLATES: PromptTemplate[] = [
  {
    id: 'sr-archiv-zeuge',
    label: 'Der Archiv-Zeuge',
    category: 'Stillframe Rituals · Charakter',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A silent paper-cut silhouette standing under an old projector beam, no visible face, only a faint cyan edge light. The body is almost frozen. One shoulder rises slightly as if breathing, then stops. Handmade cardboard texture, old film grain, black velvet background, faded cream outline, rust amber dust.',
  },
  {
    id: 'sr-maschinen-moench',
    label: 'Der Maschinen-Mönch',
    category: 'Stillframe Rituals · Charakter',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A hooded ancient-futurist figure made from paper, brass, graphite, and shadow. The face is hidden except for one small mechanical eye. The figure remains still while the eye blinks once with a soft cyan glow, then the frame holds. Occult diagram behind the head, dusty projector atmosphere, minimal motion.',
  },
  {
    id: 'sr-mond-botin',
    label: 'Die Mond-Botin',
    category: 'Stillframe Rituals · Charakter',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A still female silhouette cut from faded paper, standing in front of a pale moon diagram. Her hand lifts only a few millimeters, then freezes. A tiny orbit line rotates slightly behind her, then returns to stillness. Dark cobalt shadows, cream paper, cyan halo, rust amber edges, tactile stop-motion jitter.',
  },
  {
    id: 'sr-fehler-heilige',
    label: 'Der Fehler-Heilige',
    category: 'Stillframe Rituals · Charakter',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A strange saint-like figure built from old circuit diagrams, torn paper, and shadow. A thin glowing line across the chest pulses once like a flatline signal, then fades back. The figure does not move. Static composition, analog broadcast grain, sacred geometry in the background, no text.',
  },
];

// ── Stillframe Rituals – Fertige Prompt-Vorlagen ──────────────────────────

const STILLFRAME_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'sr-projector-breath',
    label: 'Projector Breath',
    category: 'Stillframe Rituals · Prompt',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A paper-cut silhouette stands motionless inside an old attic projector beam. The entire scene is still like a living poster. Only the chest rises slightly as if breathing, then stops and holds. Dust particles drift almost imperceptibly through the light. Black velvet background, faded cream paper, cobalt blue shadow, rust amber projector glow, cyan edge halo. Handmade stop-motion timing, subtle frame jitter, scratched film grain, locked camera, sparse composition, lower third clean for OBS. Seamless 5-second loop. No text, no logos, no fast movement.',
  },
  {
    id: 'sr-mechanical-blink',
    label: 'The Mechanical Blink',
    category: 'Stillframe Rituals · Prompt',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A hooded machine-monk made from torn paper and graphite sits before a circular occult diagram. The body remains completely still. One small mechanical eye opens slowly, glows cyan for a moment, then closes again. The scene pauses in silence. Ancient-futurist ritual mood, dark archive room, old paper texture, rust amber dust, cobalt shadows, soft scanlines, handmade cutout edges. Locked wide shot, one micro-motion only, seamless looping GIF-style video, 4, 8, or 12 seconds. No text, no watermark, no strobe.',
  },
  {
    id: 'sr-moon-hand-signal',
    label: 'Moon Hand Signal',
    category: 'Stillframe Rituals · Prompt',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A silent figure stands in front of a pale moon map pinned to a black wall. One hand lifts a few millimeters, pauses, then returns to its original position. A thin orbit line behind the figure shifts slightly and settles. The rest of the frame remains frozen. Stop-motion paper theatre, dusty projector beam, faded cream, black velvet, cobalt blue, rust amber, cyan halo. Meditative, sparse, hypnotic, locked camera, seamless 5-second loop, lower third clean. No subtitles, no logos, no fast camera movement.',
  },
  {
    id: 'sr-flatline-saint',
    label: 'Flatline Saint',
    category: 'Stillframe Rituals · Prompt',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A strange saint-like silhouette made from torn circuit paper stands in a dark analog chapel. A thin glowing line across the chest pulses once like a quiet flatline signal, then fades back into stillness. The figure never moves. Sacred geometry faintly visible behind the head, film grain, dust, paper fibers, cyan glow, rust amber shadows, black velvet negative space. Micro-motion stop-frame rhythm: move, pause, hold, return. Seamless loop, 4, 8, or 12 seconds, no text, no watermark.',
  },
  {
    id: 'sr-dust-oracle',
    label: 'Dust Oracle',
    category: 'Stillframe Rituals · Prompt',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A small oracle figure sits at a wooden desk inside a dark archive room. A single paper symbol on the table rotates only a few degrees, stops, and returns. Dust floats in the projector light. Everything else is frozen. Handmade cardboard theatre, faded ink, graphite shadows, cobalt blue darkness, rust amber lamp glow, cyan rim light. Locked camera, sparse composition, strong first frame, hypnotic micro-motion, seamless 5-second loop. No text overlays, no modern UI, no glossy realism.',
  },
  {
    id: 'sr-shadow-moves-first',
    label: 'The Shadow Moves First',
    category: 'Stillframe Rituals · Prompt',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A still paper-cut human silhouette stands against a cracked wall. The person does not move, but their shadow slides slightly to the side as if time has shifted, then returns to its original place. Dark analog broadcast mood, old projector flicker, dusty black background, cream paper outline, cobalt shadows, rust amber highlights, faint cyan halo. Stop-motion frame jitter, minimal movement, long pause, seamless loop. No text, no fast motion, no clutter.',
  },
  {
    id: 'sr-orbit-error',
    label: 'Orbit Error',
    category: 'Stillframe Rituals · Prompt',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A pale cardboard moon hangs above a motionless silhouette. A tiny orbit diagram around the moon rotates slightly, glitches once, then settles back into place. The scene holds like a forgotten scientific poster. Black velvet, faded cream, cobalt blue, rust amber, cyan glow, soft film grain, paper fibers, scanlines, dusty projector light. Locked wide shot, one micro-event only, seamless 4, 8, or 12 second GIF-style loop, lower third clean for OBS. No subtitles, no logo, no aggressive flashing.',
  },
  {
    id: 'sr-candle-signal',
    label: 'Candle Signal',
    category: 'Stillframe Rituals · Prompt',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A paper figure sits still beside a single candle in a dark room. The candle flame bends once as if touched by invisible sound, then becomes still again. A small cyan line on the wall pulses faintly and disappears. Old film grain, handmade cutout texture, rust amber light, black velvet shadows, cobalt background, faded cream figure. Stop-motion micro-movement, meditative pacing, seamless loop, locked camera, sparse composition. No text, no watermark, no fast movement.',
  },
  {
    id: 'sr-archive-animal',
    label: 'Archive Animal',
    category: 'Stillframe Rituals · Prompt',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A strange paper-cut owl-like creature sits on an old archive box. It remains still except for one slow blink and a tiny head twitch. Dust floats in the projector beam. The background is a dark wall with faint geometric markings. Black velvet, faded cream, cobalt blue, rust amber, cyan eye glow, scratched film texture, tactile handmade stop-frame look. One dominant subject, one micro-motion event, 5-second seamless loop. No text, no logos, no chaotic animation.',
  },
  {
    id: 'sr-signal-behind-mask',
    label: 'Signal Behind The Mask',
    category: 'Stillframe Rituals · Prompt',
    target: 'both',
    suggestedPresetId: 'stillframe-rituals',
    prompt: 'A mask made from torn paper, old circuit traces, and moon-map fragments hangs in the center of a dark frame. The mask is still. A thin cyan signal line appears behind it, moves a few millimeters, then fades and returns to the starting frame. Analog archive mood, dusty projector light, paper fibers, soft grain, rust amber edges, cobalt blue shadow, black velvet background. Living poster composition, locked camera, micro-motion stop-frame rhythm, seamless looping video. No text, no watermark, no strobe, no busy motion.',
  },
];

const PRESET_PROMPT_TEMPLATES: PromptTemplate[] = PRESETS.filter((preset) => preset.examplePrompt).map((preset) => ({
  id: `preset-${preset.id}`,
  label: `Preset · ${preset.name}`,
  category: 'Preset-Beispiel',
  target: 'single',
  suggestedPresetId: preset.id,
  prompt: preset.examplePrompt!,
}));

const STORY_PRESET_PROMPT_TEMPLATES: PromptTemplate[] = PRESETS.filter((preset) => preset.examplePrompt).map((preset) => ({
  id: `story-preset-${preset.id}`,
  label: `Story · ${preset.name}`,
  category: 'Preset-Story',
  target: 'story',
  suggestedPresetId: preset.id,
  requestPrompt: preset.examplePrompt,
  prompt: buildStoryTemplatePrompt(
    preset.examplePrompt!,
    `Let ${preset.name} evolve across the sequence with stronger scene contrast, a memorable transformation beat, and one unexpected visual idea that still fits the preset. Keep the exact emergence, lock-in, peak, afterimage order, and push the result closer to a recognizable ARV series ident than a soft cohesive art montage.`,
    { suggestedPresetId: preset.id },
  ),
}));

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  ...BASE_PROMPT_TEMPLATES,
  ...STILLFRAME_CHARACTER_TEMPLATES,
  ...STILLFRAME_PROMPT_TEMPLATES,
  ...PRESET_PROMPT_TEMPLATES,
  ...STORY_PRESET_PROMPT_TEMPLATES,
]
  .filter((template) => !RETIRED_PROMPT_TEMPLATE_IDS.has(template.id))
  .map((template) => ({
    ...template,
    suggestedPresetId: template.suggestedPresetId && RETIRED_PRESET_TEMPLATE_IDS.has(template.suggestedPresetId)
      ? null
      : template.suggestedPresetId,
    prompt: template.target === 'story' || template.category.startsWith('Stillframe Rituals')
      ? template.prompt
      : hardenSingleTemplatePrompt(template.prompt, template.suggestedPresetId),
  }));

export function getPromptTemplates(target: PromptTemplate['target'] = 'both'): PromptTemplate[] {
  if (target === 'both') {
    return PROMPT_TEMPLATES;
  }

  return PROMPT_TEMPLATES.filter((template) => template.target === target || template.target === 'both');
}

export function filterPromptTemplates(templates: PromptTemplate[], query: string): PromptTemplate[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return templates;
  }

  return templates.filter((template) => [
    template.label,
    template.category,
    template.prompt,
    template.suggestedPresetId ?? '',
  ].join(' ').toLowerCase().includes(normalizedQuery));
}

export function getPromptTemplateById(id: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES.find((template) => template.id === id);
}

export function buildStoryboardRequestPrompt(
  rawPrompt: string,
  options: { promptTemplateId?: string | null } = {},
): StoryboardRequestPromptDebug {
  const trimmedRawPrompt = rawPrompt.trim();
  const normalizedRawPrompt = normalizePromptWhitespace(trimmedRawPrompt);
  const promptTemplateId = typeof options.promptTemplateId === 'string' && options.promptTemplateId.trim()
    ? options.promptTemplateId.trim()
    : null;
  const template = promptTemplateId ? getPromptTemplateById(promptTemplateId) : undefined;

  let normalizedPrompt = normalizedRawPrompt;
  let matchedTemplateId: string | undefined;
  const normalizationNotes: string[] = [];

  if (template?.target === 'story' && normalizePromptWhitespace(template.prompt) === normalizedRawPrompt) {
    matchedTemplateId = template.id;

    if (template.requestPrompt) {
      normalizedPrompt = normalizePromptWhitespace(template.requestPrompt);

      if (normalizedPrompt && normalizedPrompt !== normalizedRawPrompt) {
        normalizationNotes.push('Used the compact request prompt stored for the selected story template.');
      }
    } else {
      const compactTemplatePrompt = condenseStoryTemplatePrompt(template.prompt);
      normalizedPrompt = compactTemplatePrompt.normalizedPrompt || normalizedRawPrompt;
      normalizationNotes.push(...compactTemplatePrompt.normalizationNotes);
    }
  } else {
    const compactPrompt = condenseStoryTemplatePrompt(normalizedRawPrompt);
    normalizedPrompt = compactPrompt.normalizedPrompt || normalizedRawPrompt;
    normalizationNotes.push(...compactPrompt.normalizationNotes);
  }

  return {
    rawPrompt: trimmedRawPrompt,
    normalizedPrompt: normalizedPrompt || normalizedRawPrompt,
    promptTemplateId,
    ...(matchedTemplateId ? { matchedTemplateId } : {}),
    normalizationNotes: Array.from(new Set(normalizationNotes)),
  };
}