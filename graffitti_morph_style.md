## Style Preset Code: `arv-minimal-signal-geometry`

```ts
export const arvMinimalSignalGeometryPreset = {
  id: "arv-minimal-signal-geometry",
  name: "ARV Minimal Signal Geometry",
  version: "2026-06-05",

  category: "abstract-loop",
  family: "arv-signal-systems",

  description:
    "Minimal black-background CRT signal geometry for hypnotic techno GIF loops: thin linework, orbital rectangles, scan pulses, symmetric signal diagrams, cyan/magenta/amber accents, analog grain, controlled loop payoff.",

  tags: [
    "minimal",
    "crt",
    "signal",
    "geometry",
    "op-art",
    "broadcast-ident",
    "techno-visual",
    "hypnotic-loop",
    "black-void",
    "scanline",
    "arv"
  ],

  visualIdentity: {
    background: "deep black void",
    composition: "centered, symmetrical, sparse, graphic",
    density: "very low",
    subjectType: "abstract signal geometry",
    camera: "locked camera",
    realism: "non-literal, vector-like, analog broadcast texture"
  },

  palette: {
    base: [
      "#000000", // black void
      "#050506", // near black
      "#111111"  // CRT dark grey
    ],
    signal: [
      "#00F5D4", // cyan / mint signal
      "#FF2E88", // magenta / hot pink
      "#FFE8A3", // warm ivory line
      "#FF7A45", // ember orange
      "#E9F8FF"  // dirty white glow
    ],
    optionalAccent: [
      "#B9FF66", // acid lime
      "#7A6CFF", // blue violet
      "#FF3131"  // red signal
    ]
  },

  texture: [
    "subtle CRT scanlines",
    "low VHS grain",
    "analog signal noise",
    "slight chromatic aberration",
    "soft halation on thin lines",
    "barely visible dust",
    "pixel smear only at motion edges",
    "matte black background"
  ],

  motifs: [
    "thin rectangular frame",
    "concentric orbital curves",
    "small central dot",
    "vertical barcode bars",
    "symmetrical line diagrams",
    "tiny signal pulses",
    "cyan and magenta edge offsets",
    "minimal vector glyphs",
    "broken broadcast alignment marks"
  ],

  motionRules: {
    durationSeconds: "4-6",
    loopType: "seamless",
    camera: "locked",
    motionDensity: "very low",
    dominantEventCount: 1,
    rhythm: "slow reveal -> signal shift -> brief hold -> collapse or lock -> clean return",
    allowedMotion: [
      "thin line draws inward",
      "rectangle pulses once",
      "orbital curve slowly aligns",
      "signal bars shift by a few pixels",
      "cyan-magenta edge split appears and resolves",
      "small dot expands into rings and returns",
      "geometric frame compresses into center",
      "barcode lines brighten and realign"
    ],
    forbiddenMotion: [
      "fast rotation",
      "frantic glitch spam",
      "rapid blinking",
      "strobe",
      "camera shake",
      "busy particles",
      "multiple competing animations",
      "full-screen flashing"
    ]
  },

  promptCore: `
Minimal abstract CRT signal geometry on a deep black background. 
A sparse symmetrical signal diagram appears in the center: thin ivory lines, cyan and magenta edge offsets, a small central dot, a rectangular frame, orbital curves, or vertical barcode bars. 
The animation performs one controlled event only: the geometry expands, shifts by a few pixels, briefly splits into chromatic ghost edges, pauses, then resolves into a clean locked shape. 
The scene should feel like a vintage broadcast ident, op-art signal test, techno frequency diagram, and analog machine ritual. 
Use strong negative space, subtle CRT scanlines, VHS grain, soft halation, tiny pixel smear, and precise loop clarity.
`.trim(),

  generationPromptTemplate: `
A minimal abstract motion-graphics loop on a deep black CRT background. 
One central geometric signal object: {{motif}}. 
The object performs one controlled motion event: {{motionEvent}}. 
Use thin luminous linework, cyan-magenta chromatic edge split, warm ivory signal lines, subtle amber accents, analog scanlines, VHS grain, soft halation, and black negative space. 
The motion is calm, technical, hypnotic, and loop-ready: reveal -> shift -> hold -> resolve -> return. 
seamless looping GIF-style video, 4 to 6 seconds, one dominant event only, locked camera, strong first-frame readability, clean loop-ready end pose, no text, no logos.
`.trim(),

  defaultMotifs: [
    "a thin red-magenta rectangular frame surrounded by pale orbital curves",
    "seven vertical barcode signal bars glowing in ivory, cyan, and magenta",
    "a small central dot expanding into three concentric rings",
    "four corner rectangles connected by thin ivory alignment lines",
    "a symmetrical radar-like eye made of thin oval rings and short orange ticks",
    "a black-on-black rectangle with cyan and magenta signal trails entering from both sides",
    "two mirrored cyan angle brackets closing toward a central ivory frame"
  ],

  defaultMotionEvents: [
    "the lines drift inward by a few pixels, split into cyan-magenta ghost edges, then lock back into perfect symmetry",
    "the central dot expands into three rings, holds for one beat, then collapses back into a single point",
    "the rectangular frame pulses once, bends inward subtly, then returns to a perfectly sharp outline",
    "the vertical bars brighten, misalign slightly, then realign into a clean barcode formation",
    "a tiny signal pulse travels from left to right and causes the orbital curves to align around the frame",
    "the geometry blooms outward like a technical flower, pauses, then folds back into the original diagram"
  ],

  negativePrompt: `
No characters, no faces, no landscapes, no realistic 3D scene, no corporate motion graphics, no readable text, no logos, no watermark, no strobe lights, no rapid blinking, no hectic glitch spam, no busy particles, no fast camera movement, no full-screen flashing, no chaotic rotation, no over-detailed cyberpunk HUD, no colorful clutter.
`.trim()
};
```

---

## JSON-Version für deine Foundry-IQ-DB

```json
{
  "id": "arv-minimal-signal-geometry",
  "name": "ARV Minimal Signal Geometry",
  "version": "2026-06-05",
  "category": "abstract-loop",
  "family": "arv-signal-systems",
  "description": "Minimal black-background CRT signal geometry for hypnotic techno GIF loops: thin linework, orbital rectangles, scan pulses, symmetric signal diagrams, cyan/magenta/amber accents, analog grain, controlled loop payoff.",
  "style_rules": [
    "Use a deep black void as the main stage.",
    "Keep the composition centered, symmetrical, sparse, and readable.",
    "Use only one dominant geometric event per loop.",
    "Favor thin luminous linework, simple rectangles, orbit curves, dots, bars, and signal diagrams.",
    "Use cyan-magenta chromatic edge split only as an accent, not as chaotic glitch.",
    "Preserve large negative space.",
    "The loop must resolve into a clean locked final pose."
  ],
  "palette": {
    "base": ["black", "near-black", "CRT dark grey"],
    "signal": ["electric cyan", "hot magenta", "warm ivory", "ember orange", "dirty white"],
    "optional_accent": ["acid lime", "blue violet", "red signal"]
  },
  "textures": [
    "subtle CRT scanlines",
    "low VHS grain",
    "analog signal noise",
    "soft halation",
    "slight chromatic aberration",
    "tiny pixel smear",
    "matte black background"
  ],
  "motifs": [
    "thin rectangular frame",
    "concentric orbital curves",
    "small central dot",
    "vertical barcode bars",
    "symmetrical line diagrams",
    "tiny signal pulses",
    "minimal vector glyphs",
    "broken broadcast alignment marks"
  ],
  "motion_grammar": [
    "reveal",
    "micro-shift",
    "chromatic split",
    "brief hold",
    "collapse or lock",
    "seamless return"
  ],
  "duration_seconds": "4-6",
  "camera": "locked",
  "motion_density": "very low",
  "negative_prompt": "No characters, no faces, no landscapes, no realistic 3D scene, no corporate motion graphics, no readable text, no logos, no watermark, no strobe lights, no rapid blinking, no hectic glitch spam, no busy particles, no fast camera movement, no full-screen flashing, no chaotic rotation."
}
```

---

## Fertiger Prompt aus dem Preset

```text
Minimal abstract CRT signal geometry on a deep black background. A sparse symmetrical signal diagram appears in the center: thin warm-ivory oval rings around a tiny central dot, short ember-orange alignment ticks, and faint cyan-magenta chromatic edge offsets. The object performs one controlled motion event: the central dot expands into three concentric rings, the alignment ticks slide inward by a few pixels, the rings briefly split into cyan and magenta ghost edges, then everything locks back into a clean centered symbol.

The scene should feel like a vintage broadcast ident, op-art signal test, techno frequency diagram, and analog machine ritual. Strong black negative space, subtle CRT scanlines, VHS grain, soft halation, tiny pixel smear, precise loop clarity.

seamless looping GIF-style video, 4 to 6 seconds, one dominant event only, locked camera, strong first-frame readability, clean loop-ready end pose, no text, no logos, no strobe lights, no rapid blinking, no hectic pacing.

Negative prompt: no characters, no faces, no landscapes, no realistic 3D scene, no corporate motion graphics, no readable text, no watermark, no hectic glitch spam, no busy particles, no fast camera movement, no full-screen flashing.
```


## Style Preset: `arv-ceremonial-signal-iris`

```ts
export const arvCeremonialSignalIrisPreset = {
  id: "arv-ceremonial-signal-iris",
  name: "ARV Ceremonial Signal Iris",
  version: "2026-06-05",

  category: "story-loop",
  family: "arv-ritual-signal-systems",

  description:
    "Hypnotic nocturne story preset for symbolic GIF/video loops: luminous iris portals, ceremonial geometry, lotus blooms, hooded silhouettes, concentric signal rings, CRT scanlines, op-art tension, and slow ritual motion with one clear visual payoff.",

  tags: [
    "arv",
    "hyroglyphs",
    "ceremonial-geometry",
    "signal-iris",
    "op-art",
    "lotus",
    "eye-symbol",
    "portal",
    "silhouette",
    "retro-tv-ident",
    "crt",
    "hypnotic-loop",
    "story-prompt"
  ],

  visualIdentity: {
    background: "dark nocturne void, deep indigo stage, or architectural shadow chamber",
    composition: "centered, symmetrical, ritual-like, strong first-frame readability",
    subjectType:
      "symbolic object, eye, lotus, portal, hooded silhouette, dancer silhouette, or sacred signal device",
    density: "balanced: sparse main form with controlled ornamental geometry",
    realism: "stylized, non-literal, analog, posterized, graphic",
    camera: "locked wide shot or very slow deliberate push"
  },

  palette: {
    base: [
      "#030711", // velvet black
      "#081326", // midnight indigo
      "#0B2440", // deep cobalt
      "#0C3B4A"  // dark teal shadow
    ],
    signal: [
      "#48F6E8", // cyan halo
      "#D9FFF7", // luminous pale cyan
      "#F4E7C3", // parchment / ivory
      "#FF5B7A", // soft red / coral
      "#8E5CFF"  // ultraviolet haze
    ],
    warmAccent: [
      "#D98A32", // amber
      "#FF6A3D", // ember orange
      "#B54A2C"  // rust red
    ]
  },

  texture: [
    "soft CRT scanlines",
    "low analog bleed",
    "posterized bloom",
    "matte halation",
    "paper fibers",
    "dusty darkness",
    "subtle VHS grain",
    "cut-paper edges",
    "low-frame rotoscope drift",
    "faint chromatic ghosting"
  ],

  motifs: [
    "cut-paper eye",
    "concentric iris rings",
    "lotus or mandala bloom",
    "symbolic halo",
    "thin orbital curves",
    "ritual rectangular frame",
    "hooded central silhouette",
    "single dancer silhouette",
    "glowing portal threshold",
    "attic-tech relic",
    "floating glyph dots",
    "signal-wave lines",
    "vintage TV rounded frame"
  ],

  storyPrinciples: {
    thematicCore:
      "A symbolic signal opens, measures, warns, or reveals a figure; the scene behaves like a ritual broadcast rather than a literal event.",
    narrativeMode:
      "micro-mythic, symbolic, uncanny, spacious, hypnotic, non-literal",
    sceneBeats: [
      "signal emerges from darkness",
      "central symbol finds lock",
      "iris, lotus, or portal opens slowly",
      "silhouette appears as witness or operator",
      "one subtle gesture triggers geometry",
      "rings or petals breathe outward",
      "image resolves into ceremonial stillness"
    ],
    payoffTypes: [
      "eye opens and holds",
      "lotus bloom unfolds once",
      "halo aligns behind silhouette",
      "portal rings lock into symmetry",
      "symbolic frame compresses into signal",
      "dancer freezes inside luminous geometry",
      "afterimage dissolves into darkness"
    ]
  },

  motionRules: {
    durationSeconds: "4-6",
    loopType: "seamless",
    camera: "locked or very slow deliberate push",
    motionDensity: "low-to-medium",
    dominantEventCount: 1,
    rhythm:
      "fade in from darkness -> slow symbolic opening -> held pose -> soft geometric response -> resolved stillness -> seamless return",
    allowedMotion: [
      "eye slowly opens",
      "iris rings expand and settle",
      "lotus petals unfold by one layer",
      "halo breathes once",
      "thin orbit line drifts gently",
      "silhouette raises one hand slightly",
      "portal pulse compresses inward",
      "dancer performs one slow suspended pose",
      "CRT signal finds lock",
      "soft waveform travels once"
    ],
    forbiddenMotion: [
      "strobe",
      "rapid blinking",
      "very fast rotation",
      "hectic pacing",
      "frantic glitch spam",
      "busy particle storm",
      "full dance choreography",
      "aggressive camera movement",
      "overloaded HUD"
    ]
  },

  promptCore: `
A hypnotic ceremonial signal loop in a dark retro-futurist void stage. 
The scene is centered and symmetrical, like a vintage TV ident recovered from an analog archive. 
Use one symbolic subject: a cut-paper eye, lotus bloom, glowing portal, hooded silhouette, dancer silhouette, or ritual signal device. 
The subject performs one controlled event only: the eye opens, rings align, petals unfold, a halo breathes, or a silhouette makes one minimal gesture. 
Favor concentric signal rings, cyan halos, parchment-white shapes, deep indigo darkness, soft CRT scanlines, analog grain, posterized bloom, paper fibers, cut-out silhouettes, and luminous accents. 
The mood is moderately paced, hypnotic, pleasant, uncanny, trippy, and spacious.
`.trim(),

  generationPromptTemplate: `
{{subject}} appears in a dark ceremonial signal chamber, centered in a symmetrical wide shot like a vintage TV ident. 
The image fades in from darkness as if a lost broadcast signal is finding lock. 
Visual language: concentric signal rings, soft op-art tension, cyan halo, midnight indigo void, parchment-white forms, ember accents, CRT scanlines, analog grain, posterized bloom, cut-paper edges, and luminous ritual geometry. 

Narrative focus: {{sceneBeat}}. 
The subject performs one clear symbolic event: {{motionEvent}}. 
The event creates a controlled geometric response — rings breathe outward, petals unfold, halo aligns, or signal curves lock into place — then the scene resolves into a held ceremonial stillness.

seamless looping GIF-style video, 4 to 6 seconds, one dominant subject or event, controlled hypnotic motion with one clear payoff, locked or very slow deliberate camera, strong first-frame readability, loop-ready end pose or afterimage, dark uncluttered background.
`.trim(),

  defaultSubjects: [
    "A cut-paper eye opening into concentric op-art rings",
    "A hooded silhouette standing before a luminous cyan halo",
    "A white lotus bloom unfolding inside a dotted signal circle",
    "A single dancer silhouette suspended above a glowing cyan floor ring",
    "A ritual amber window framed by teal orbital curves",
    "A symbolic iris portal built from layered paper rings",
    "A masked signal operator holding one hand before a geometric square",
    "A solitary figure standing inside concentric white portal rings",
    "A blue iris eye embedded inside a dark architectural archive",
    "A ceremonial signal device with amber core and teal orbit"
  ],

  defaultSceneBeats: [
    "Der Blick wird zum Portal",
    "Das Signal findet Lock",
    "Ein Symbol ersetzt den Menschen",
    "Die Geometrie atmet einmal",
    "Das Archiv öffnet ein Auge",
    "Der Körper wird zur Messfigur",
    "Eine Warnung wiederholt sich als Ritual",
    "Das Licht prüft die Silhouette",
    "Die Blume sendet eine Frequenz",
    "Der Raum faltet sich in eine Iris"
  ],

  defaultMotionEvents: [
    "the eye opens slowly, holds for one beat, then the iris rings settle back into darkness",
    "the halo behind the silhouette expands once, aligns into a perfect circle, then fades to a faint afterimage",
    "one layer of lotus petals unfolds, pauses, then folds back into the central bloom",
    "a thin cyan orbit line travels around the subject once and locks into place",
    "the figure raises one hand by a few centimeters, triggering a soft geometric pulse",
    "the concentric rings breathe outward, compress inward, and resolve into a clean central symbol",
    "the amber core brightens softly, releases one signal wave, then returns to a quiet glow",
    "the dancer holds a suspended pose while the floor ring pulses once and freezes",
    "the paper iris shifts by one frame, producing a low analog afterimage before becoming still",
    "the portal opens like an eyelid, reveals black interior depth, then closes to the starting frame"
  ],

  negativePrompt: `
No strobe lights, no rapidly blinking lights, no very fast rotating objects, no nervous patterns, no hectic pacing, no harsh flashing, no frantic glitch spam, no random chaos, no glossy ad polish, no sterile stock-video realism, no over-clean 3D, no bland photoreal cinematics, no generic corporate motion graphics, no default fantasy art, no crowded scene, no prominent text overlays, no obvious logos, no watermark artifacts.
`.trim()
};
```

---

## JSON-Version für Foundry IQ / Style DB

```json
{
  "id": "arv-ceremonial-signal-iris",
  "name": "ARV Ceremonial Signal Iris",
  "version": "2026-06-05",
  "category": "story-loop",
  "family": "arv-ritual-signal-systems",
  "description": "Hypnotic nocturne story preset for symbolic GIF/video loops: luminous iris portals, ceremonial geometry, lotus blooms, hooded silhouettes, concentric signal rings, CRT scanlines, op-art tension, and slow ritual motion with one clear visual payoff.",
  "style_rules": [
    "Use a dark nocturne void, indigo stage, or architectural shadow chamber.",
    "Keep composition centered, symmetrical, ritual-like, and readable.",
    "Use one symbolic subject only: eye, lotus, portal, halo, hooded silhouette, dancer silhouette, or signal device.",
    "Motion must be symbolic and minimal: one opening, one pulse, one gesture, one alignment, one bloom.",
    "Use analog broadcast texture: CRT scanlines, posterized bloom, film grain, paper fibers, low chromatic bleed.",
    "Let the scene feel like a vintage TV ident, ritual broadcast, or recovered signal.",
    "The loop must resolve into a clean held pose or afterimage."
  ],
  "palette": {
    "base": [
      "velvet black",
      "midnight indigo",
      "deep cobalt",
      "dark teal shadow"
    ],
    "signal": [
      "cyan halo",
      "pale luminous cyan",
      "parchment ivory",
      "soft coral red",
      "ultraviolet haze"
    ],
    "warm_accent": [
      "amber",
      "ember orange",
      "rust red"
    ]
  },
  "textures": [
    "soft CRT scanlines",
    "low analog bleed",
    "posterized bloom",
    "matte halation",
    "paper fibers",
    "dusty darkness",
    "subtle VHS grain",
    "cut-paper edges",
    "low-frame rotoscope drift",
    "faint chromatic ghosting"
  ],
  "motifs": [
    "cut-paper eye",
    "concentric iris rings",
    "lotus or mandala bloom",
    "symbolic halo",
    "thin orbital curves",
    "ritual rectangular frame",
    "hooded central silhouette",
    "single dancer silhouette",
    "glowing portal threshold",
    "attic-tech relic",
    "floating glyph dots",
    "signal-wave lines",
    "vintage TV rounded frame"
  ],
  "story_beats": [
    "Der Blick wird zum Portal",
    "Das Signal findet Lock",
    "Ein Symbol ersetzt den Menschen",
    "Die Geometrie atmet einmal",
    "Das Archiv öffnet ein Auge",
    "Der Körper wird zur Messfigur",
    "Eine Warnung wiederholt sich als Ritual",
    "Das Licht prüft die Silhouette",
    "Die Blume sendet eine Frequenz",
    "Der Raum faltet sich in eine Iris"
  ],
  "motion_grammar": [
    "fade in from darkness",
    "slow symbolic opening",
    "held pose",
    "soft geometric response",
    "resolved stillness",
    "seamless return"
  ],
  "duration_seconds": "4-6",
  "camera": "locked or very slow deliberate push",
  "motion_density": "low-to-medium",
  "negative_prompt": "No strobe lights, no rapidly blinking lights, no very fast rotating objects, no nervous patterns, no hectic pacing, no harsh flashing, no frantic glitch spam, no random chaos, no glossy ad polish, no sterile stock-video realism, no over-clean 3D, no bland photoreal cinematics, no generic corporate motion graphics, no default fantasy art, no crowded scene, no prominent text overlays, no obvious logos, no watermark artifacts."
}
```

---

## Fertiger Story-Prompt aus dem Preset

```text
A cut-paper eye appears in a dark ceremonial signal chamber, centered in a symmetrical wide shot like a vintage TV ident recovered from an analog archive. The image fades in from velvet black as if a lost broadcast signal is finding lock. The eye is built from parchment-white paper layers, a deep blue iris, and concentric cyan signal rings, surrounded by faint architectural shadows and soft op-art pressure.

Narrative focus: Das Archiv öffnet ein Auge. The eye opens slowly, not as a biological action but as a symbolic machine event. As the eyelid separates, three concentric rings breathe outward, pause for one beat, then align perfectly around the iris. Small ember-orange signal dots appear around the ring, glow softly, and fade back into the dark.

Visual language: midnight indigo void, cyan halo, parchment-white cut-paper forms, blue iris core, subtle coral-red accents, CRT scanlines, analog grain, posterized bloom, matte halation, dusty darkness, low-frame rotoscope drift, faint chromatic afterimage.

Motion behavior: fade in from darkness -> eyelid opens -> rings breathe outward -> signal dots glow once -> geometry locks -> held ceremonial stillness -> seamless return.

seamless looping GIF-style video, 4 to 6 seconds, one dominant subject or event, controlled hypnotic motion with one clear payoff, locked camera, strong first-frame readability, loop-ready end pose or afterimage, dark uncluttered background.

Negative prompt: no strobe lights, no rapid blinking, no very fast rotating objects, no hectic pacing, no harsh flashing, no frantic glitch spam, no glossy ad polish, no sterile realism, no over-clean 3D, no prominent text overlays, no obvious logos, no watermark artifacts.
```

---

## Zweiter fertiger Story-Prompt: **Signal Saint / Portal Lock**

```text
A hooded silhouette stands alone in a dark indigo void, framed by a luminous cyan halo and two offset geometric squares. The figure is almost still, like a ceremonial witness captured inside a vintage CRT transmission. The body is black and unreadable, but the outline glows with soft cyan and magenta chromatic bleed. A thin halo floats above the head, slightly misaligned, as if the signal has not yet locked.

Narrative focus: Das Signal findet Lock. The figure raises one hand by only a few centimeters. This tiny gesture triggers the geometry behind the body: the squares rotate by a few degrees, the halo aligns above the head, and a circular floor ring brightens once beneath the feet. The scene holds for one beat in perfect symmetry, then the glow retreats into a faint afterimage.

Visual language: black silhouette, cyan halo, magenta edge bleed, deep blue CRT field, thin geometric linework, analog scanlines, soft VHS grain, ritual poster composition, op-art tension, luminous floor ring, minimal symbolic architecture.

Motion behavior: still silhouette -> hand lifts slightly -> halo aligns -> squares settle -> floor ring pulses once -> hard ceremonial freeze -> seamless return.

seamless looping GIF-style video, 4 to 6 seconds, one dominant subject or event, controlled hypnotic motion with one clear payoff, locked wide shot, strong first-frame readability, loop-ready end pose or afterimage, dark uncluttered background.

Negative prompt: no strobe lights, no rapid blinking, no fast rotation, no hectic pacing, no chaotic glitch spam, no glossy neon, no busy HUD, no full dance choreography, no prominent text overlays, no logos, no watermark artifacts.
```

---

## Kompakte Prompt-Formel

```text
A [eye / lotus / hooded silhouette / dancer / portal / signal device] appears in a dark ceremonial signal chamber, centered like a vintage TV ident. The scene fades in from darkness as a lost broadcast finds lock. Use concentric signal rings, cyan halo, midnight indigo void, parchment-white cut-paper forms, ember accents, CRT scanlines, analog grain, posterized bloom, and soft op-art tension. Narrative focus: [scene beat]. One symbolic event happens: [eye opens / petals unfold / halo aligns / hand lifts / portal breathes / rings compress]. The geometry responds once, holds, then resolves into ceremonial stillness. seamless looping GIF-style video, 4 to 6 seconds, locked camera, one dominant event, strong first-frame readability, loop-ready end pose. Negative prompt: no strobe, no rapid blinking, no hectic pacing, no glossy ad polish, no over-clean 3D, no prominent text or logos.
```


## Style Preset: `arv-graffiti-hex-mural-loop`

```ts
export const arvGraffitiHexMuralLoopPreset = {
  id: "arv-graffiti-hex-mural-loop",
  name: "ARV Graffiti Hex Mural Loop",
  version: "2026-06-05",

  category: "pattern-loop",
  family: "arv-graffiti-signal-systems",

  description:
    "A hybrid style combining flat geometric hexagon signal patterns with warm cartoon graffiti mural aesthetics: sunset gradients, sprayed wall texture, thick outlines, soft analog blur, playful but controlled rave energy, and calm loopable pattern motion.",

  tags: [
    "arv",
    "hyroglyphs",
    "graffiti",
    "mural",
    "hexagon",
    "pattern-loop",
    "sunset-gradient",
    "cartoon-style",
    "techno-circuit",
    "soft-analog-grain",
    "minimal-motion",
    "obs-visuals"
  ],

  visualIdentity: {
    background: "painted wall mural with warm sunset gradient",
    composition: "clean 16:9, wide mural field, readable from distance",
    density: "medium-low",
    subjectType: "abstract geometric pattern with optional playful mural fragments",
    realism: "flat illustrated mural, not photorealistic",
    lineStyle: "thick soft black outlines, hand-painted edges, sprayed wall grain",
    camera: "locked wide shot"
  },

  palette: {
    base: [
      "#F4C542", // warm yellow
      "#F28A2E", // orange sunset
      "#C13D83", // magenta-pink sky band
      "#1E7FA3", // sea / teal blue
      "#102C3A"  // deep blue shadow
    ],
    pattern: [
      "#48D6C0", // seafoam cyan
      "#B9F26D", // lime
      "#4BA3C7", // cyan-blue
      "#62537D", // muted violet
      "#F7E6A3"  // pale cream
    ],
    accent: [
      "#FF4DA6", // cartoon pink
      "#1B1B1B", // thick outline black
      "#FFFFFF", // small cloud / foam highlight
      "#FF7A45"  // warm orange accent
    ]
  },

  texture: [
    "spray-painted concrete wall texture",
    "slight uneven mural surface",
    "soft analog grain",
    "subtle blur at painted edges",
    "matte color fields",
    "paper-poster softness",
    "faded street-art patina",
    "light dust and wall scratches"
  ],

  motifs: [
    "flat hexagon field",
    "single expanding hexagon ring",
    "painted sea-horizon stripe",
    "tiny cloud glyphs",
    "small cartoon creature silhouettes as secondary mural fragments",
    "surfboard-like color bands",
    "rave flyer geometry",
    "soft signal cells",
    "smiley sun glyph",
    "spray-paint drips used sparingly"
  ],

  motionRules: {
    durationSeconds: "4-6",
    loopType: "seamless",
    camera: "locked",
    motionDensity: "low",
    dominantEventCount: 1,
    rhythm:
      "still mural -> slow diagonal hex drift -> one ring expands by one cell -> soft cell glow -> return to perfect tiling",
    allowedMotion: [
      "slow diagonal pattern drift",
      "one hexagon ring expands by one cell",
      "a few cells glow softly for one beat",
      "painted edge shimmer",
      "tiny cloud drift by a few pixels",
      "small mural creature blink or micro twitch only if secondary",
      "subtle wave-line movement",
      "soft analog grain crawl"
    ],
    forbiddenMotion: [
      "fast tile flipping",
      "chaotic pattern changes",
      "strobe",
      "rapid blinking",
      "full cartoon action scene",
      "too many characters",
      "busy party crowd",
      "glossy 3D",
      "camera shake"
    ]
  },

  promptCore: `
A warm cartoon-graffiti mural style fused with minimal geometric techno pattern language. 
The frame is a painted wall with a sunset gradient: magenta-pink upper band, orange-yellow horizon, teal-blue lower field. 
A flat hexagon pattern drifts calmly across the mural like a hidden techno circuit waking up under street-art paint. 
The hexagons use muted indigo, cyan, seafoam, lime, dark violet, and pale cream. 
The geometry should feel graphic and readable, while the surface keeps sprayed wall texture, soft analog grain, thick black painted outlines, faded mural patina, and playful cartoon energy. 
Optional tiny mural fragments may appear: small clouds, a smiling sun glyph, simple sea marks, or one small cartoon creature silhouette, but the main subject remains the hexagon pattern.
`.trim(),

  generationPromptTemplate: `
A clean 16:9 cartoon-graffiti mural loop with a warm sunset wall background and a flat field of geometric hexagons. 
The mural has sprayed concrete texture, thick soft black painted outlines, faded street-art patina, small cloud glyphs, and a teal-blue lower horizon. 
The hexagons fill the frame in muted indigo, cyan, seafoam, lime, dark violet, and pale cream. 
Motion: {{motionEvent}}. 
Keep the animation calm, hypnotic, graphic, and readable, like a techno circuit waking up inside a beach-wall mural. 
seamless looping GIF-style video, 4 to 6 seconds, one dominant pattern event, locked camera, loop-ready final frame, no text, no logos.
`.trim(),

  defaultMotionEvents: [
    "a slow diagonal drift moves through the hex field, one central ring expands by one cell, a few cells glow softly for one beat, then the pattern settles back into perfect tiling",
    "three hexagon cells brighten like a hidden circuit path, the glow travels once across the mural, then fades back into the painted wall",
    "one large hexagon blooms open into six smaller cells, holds for one beat, then folds back into the original flat pattern",
    "the hex field shifts by a few pixels with soft analog smear, cyan and lime cells misalign slightly, then lock back into clean mural geometry",
    "a subtle wave passes through the hexagons as if the painted wall is breathing, then the tiles return to stillness"
  ],

  negativePrompt: `
No logos, no text overlays, no readable typography, no fast movement, no strobe, no rapid blinking, no chaotic tile flipping, no glossy 3D, no photorealistic characters, no crowded party scene, no complex background action, no harsh flicker, no camera shake, no corporate motion graphics.
`.trim()
};
```

---

## JSON-Version für Foundry IQ / Style DB

```json
{
  "id": "arv-graffiti-hex-mural-loop",
  "name": "ARV Graffiti Hex Mural Loop",
  "version": "2026-06-05",
  "category": "pattern-loop",
  "family": "arv-graffiti-signal-systems",
  "description": "A hybrid style combining flat geometric hexagon signal patterns with warm cartoon graffiti mural aesthetics: sunset gradients, sprayed wall texture, thick outlines, soft analog blur, playful but controlled rave energy, and calm loopable pattern motion.",
  "style_rules": [
    "Use a clean 16:9 painted mural composition.",
    "Blend flat hexagon geometry with warm cartoon graffiti wall texture.",
    "Keep the main event abstract and pattern-based, not character-driven.",
    "Use large readable shapes, thick painted outlines, and soft analog grain.",
    "Motion must remain calm: slow drift, one expanding ring, one soft glow, then return.",
    "Allow tiny mural fragments only as secondary atmosphere.",
    "Preserve loop clarity and avoid chaotic tile flipping."
  ],
  "palette": {
    "base": ["magenta-pink sky", "orange sunset", "warm yellow", "teal-blue lower field", "deep blue shadow"],
    "pattern": ["muted indigo", "cyan", "seafoam", "lime", "dark violet", "pale cream"],
    "accent": ["cartoon pink", "black outline", "white cloud marks", "warm orange"]
  },
  "textures": [
    "spray-painted concrete wall texture",
    "soft analog grain",
    "faded street-art patina",
    "matte color fields",
    "slight painted-edge blur",
    "light dust and wall scratches"
  ],
  "motifs": [
    "flat hexagon field",
    "one expanding hexagon ring",
    "small cloud glyphs",
    "painted sea-horizon stripe",
    "smiley sun glyph",
    "tiny cartoon creature silhouette",
    "rave flyer geometry",
    "soft signal cells"
  ],
  "motion_grammar": [
    "still mural",
    "slow diagonal drift",
    "one ring expands by one cell",
    "few cells glow softly",
    "pattern settles back into perfect tiling"
  ],
  "duration_seconds": "4-6",
  "camera": "locked",
  "motion_density": "low",
  "negative_prompt": "No logos, no text overlays, no readable typography, no fast movement, no strobe, no rapid blinking, no chaotic tile flipping, no glossy 3D, no photorealistic characters, no crowded party scene, no complex background action, no harsh flicker."
}
```

---

## Fertiger Prompt aus dem Preset

```text
A clean 16:9 cartoon-graffiti mural loop with a warm sunset wall background and a flat field of geometric hexagons. The upper wall fades from deep pink to orange and golden yellow, while the lower band shifts into teal-blue like a painted sea horizon. The surface is visibly sprayed onto concrete: soft wall grain, faded street-art patina, matte color fields, thick black painted edges, tiny cloud glyphs, and subtle analog blur.

Across the mural, a flat hexagon pattern fills the frame in muted indigo, cyan, seafoam, lime, dark violet, and pale cream. The hexagons feel like a hidden techno circuit embedded inside a beach-wall graffiti painting. A few tiny playful mural fragments may appear at the edges — small cartoon creature silhouettes, cloud marks, wave doodles, or a faded smiley sun — but they stay secondary and do not dominate the pattern.

Motion: the hexagon field moves only slightly with a slow diagonal drift. One central ring of hexagons expands outward by exactly one cell, pauses for one beat, then settles back into perfect tiling. Three cells glow softly in cyan and lime like a techno circuit waking up, then fade back into the painted wall.

Minimal abstract pattern loop, flat vector geometry, cartoon graffiti mural texture, soft analog grain, no prominent characters, no text, clean 16:9 composition, hypnotic but calm, graphic and readable. seamless looping GIF-style video, 4 to 6 seconds, one dominant pattern event, locked camera, loop-ready final frame.

Negative prompt: no logos, no text overlays, no fast movement, no strobe, no rapid blinking, no chaotic tile flipping, no glossy 3D, no crowded party scene, no photorealistic characters, no harsh flashing.
```

---

## Noch stärker in deinem ARV-Wording

```text
Style: ARV Graffiti Hex Mural Signal

A warm painted-wall graffiti universe where playful cartoon mural color meets minimal techno signal geometry. Use a sunset gradient wall, sprayed concrete texture, thick black cartoon outlines, soft analog grain, faded beach-rave patina, and a flat hexagon field that behaves like a hidden circuit. The geometry is the main subject. Cartoon elements are only small mural ghosts at the edges.

Core loop grammar: still mural -> slow hex drift -> one ring expands -> three cells glow -> soft analog hold -> perfect tiling return.

Mood: playful but controlled, ravey but not chaotic, warm but graphic, street-art but loop-clean, hypnotic but readable.

Avoid: text, logos, crowded characters, fast motion, strobe, chaotic tile flipping, glossy 3D, over-detailed cartoon action.
```

## Style Preset Code: `arv-minimal-signal-geometry`

```ts
export const arvMinimalSignalGeometryPreset = {
  id: "arv-minimal-signal-geometry",
  name: "ARV Minimal Signal Geometry",
  version: "2026-06-05",

  category: "abstract-loop",
  family: "arv-signal-systems",

  description:
    "Minimal black-background CRT signal geometry for hypnotic techno GIF loops: thin linework, orbital rectangles, scan pulses, symmetric signal diagrams, cyan/magenta/amber accents, analog grain, controlled loop payoff.",

  tags: [
    "minimal",
    "crt",
    "signal",
    "geometry",
    "op-art",
    "broadcast-ident",
    "techno-visual",
    "hypnotic-loop",
    "black-void",
    "scanline",
    "arv"
  ],

  visualIdentity: {
    background: "deep black void",
    composition: "centered, symmetrical, sparse, graphic",
    density: "very low",
    subjectType: "abstract signal geometry",
    camera: "locked camera",
    realism: "non-literal, vector-like, analog broadcast texture"
  },

  palette: {
    base: [
      "#000000", // black void
      "#050506", // near black
      "#111111"  // CRT dark grey
    ],
    signal: [
      "#00F5D4", // cyan / mint signal
      "#FF2E88", // magenta / hot pink
      "#FFE8A3", // warm ivory line
      "#FF7A45", // ember orange
      "#E9F8FF"  // dirty white glow
    ],
    optionalAccent: [
      "#B9FF66", // acid lime
      "#7A6CFF", // blue violet
      "#FF3131"  // red signal
    ]
  },

  texture: [
    "subtle CRT scanlines",
    "low VHS grain",
    "analog signal noise",
    "slight chromatic aberration",
    "soft halation on thin lines",
    "barely visible dust",
    "pixel smear only at motion edges",
    "matte black background"
  ],

  motifs: [
    "thin rectangular frame",
    "concentric orbital curves",
    "small central dot",
    "vertical barcode bars",
    "symmetrical line diagrams",
    "tiny signal pulses",
    "cyan and magenta edge offsets",
    "minimal vector glyphs",
    "broken broadcast alignment marks"
  ],

  motionRules: {
    durationSeconds: "4-6",
    loopType: "seamless",
    camera: "locked",
    motionDensity: "very low",
    dominantEventCount: 1,
    rhythm: "slow reveal -> signal shift -> brief hold -> collapse or lock -> clean return",
    allowedMotion: [
      "thin line draws inward",
      "rectangle pulses once",
      "orbital curve slowly aligns",
      "signal bars shift by a few pixels",
      "cyan-magenta edge split appears and resolves",
      "small dot expands into rings and returns",
      "geometric frame compresses into center",
      "barcode lines brighten and realign"
    ],
    forbiddenMotion: [
      "fast rotation",
      "frantic glitch spam",
      "rapid blinking",
      "strobe",
      "camera shake",
      "busy particles",
      "multiple competing animations",
      "full-screen flashing"
    ]
  },

  promptCore: `
Minimal abstract CRT signal geometry on a deep black background. 
A sparse symmetrical signal diagram appears in the center: thin ivory lines, cyan and magenta edge offsets, a small central dot, a rectangular frame, orbital curves, or vertical barcode bars. 
The animation performs one controlled event only: the geometry expands, shifts by a few pixels, briefly splits into chromatic ghost edges, pauses, then resolves into a clean locked shape. 
The scene should feel like a vintage broadcast ident, op-art signal test, techno frequency diagram, and analog machine ritual. 
Use strong negative space, subtle CRT scanlines, VHS grain, soft halation, tiny pixel smear, and precise loop clarity.
`.trim(),

  generationPromptTemplate: `
A minimal abstract motion-graphics loop on a deep black CRT background. 
One central geometric signal object: {{motif}}. 
The object performs one controlled motion event: {{motionEvent}}. 
Use thin luminous linework, cyan-magenta chromatic edge split, warm ivory signal lines, subtle amber accents, analog scanlines, VHS grain, soft halation, and black negative space. 
The motion is calm, technical, hypnotic, and loop-ready: reveal -> shift -> hold -> resolve -> return. 
seamless looping GIF-style video, 4 to 6 seconds, one dominant event only, locked camera, strong first-frame readability, clean loop-ready end pose, no text, no logos.
`.trim(),

  defaultMotifs: [
    "a thin red-magenta rectangular frame surrounded by pale orbital curves",
    "seven vertical barcode signal bars glowing in ivory, cyan, and magenta",
    "a small central dot expanding into three concentric rings",
    "four corner rectangles connected by thin ivory alignment lines",
    "a symmetrical radar-like eye made of thin oval rings and short orange ticks",
    "a black-on-black rectangle with cyan and magenta signal trails entering from both sides",
    "two mirrored cyan angle brackets closing toward a central ivory frame"
  ],

  defaultMotionEvents: [
    "the lines drift inward by a few pixels, split into cyan-magenta ghost edges, then lock back into perfect symmetry",
    "the central dot expands into three rings, holds for one beat, then collapses back into a single point",
    "the rectangular frame pulses once, bends inward subtly, then returns to a perfectly sharp outline",
    "the vertical bars brighten, misalign slightly, then realign into a clean barcode formation",
    "a tiny signal pulse travels from left to right and causes the orbital curves to align around the frame",
    "the geometry blooms outward like a technical flower, pauses, then folds back into the original diagram"
  ],

  negativePrompt: `
No characters, no faces, no landscapes, no realistic 3D scene, no corporate motion graphics, no readable text, no logos, no watermark, no strobe lights, no rapid blinking, no hectic glitch spam, no busy particles, no fast camera movement, no full-screen flashing, no chaotic rotation, no over-detailed cyberpunk HUD, no colorful clutter.
`.trim()
};
```

---

## JSON-Version für deine Foundry-IQ-DB

```json
{
  "id": "arv-minimal-signal-geometry",
  "name": "ARV Minimal Signal Geometry",
  "version": "2026-06-05",
  "category": "abstract-loop",
  "family": "arv-signal-systems",
  "description": "Minimal black-background CRT signal geometry for hypnotic techno GIF loops: thin linework, orbital rectangles, scan pulses, symmetric signal diagrams, cyan/magenta/amber accents, analog grain, controlled loop payoff.",
  "style_rules": [
    "Use a deep black void as the main stage.",
    "Keep the composition centered, symmetrical, sparse, and readable.",
    "Use only one dominant geometric event per loop.",
    "Favor thin luminous linework, simple rectangles, orbit curves, dots, bars, and signal diagrams.",
    "Use cyan-magenta chromatic edge split only as an accent, not as chaotic glitch.",
    "Preserve large negative space.",
    "The loop must resolve into a clean locked final pose."
  ],
  "palette": {
    "base": ["black", "near-black", "CRT dark grey"],
    "signal": ["electric cyan", "hot magenta", "warm ivory", "ember orange", "dirty white"],
    "optional_accent": ["acid lime", "blue violet", "red signal"]
  },
  "textures": [
    "subtle CRT scanlines",
    "low VHS grain",
    "analog signal noise",
    "soft halation",
    "slight chromatic aberration",
    "tiny pixel smear",
    "matte black background"
  ],
  "motifs": [
    "thin rectangular frame",
    "concentric orbital curves",
    "small central dot",
    "vertical barcode bars",
    "symmetrical line diagrams",
    "tiny signal pulses",
    "minimal vector glyphs",
    "broken broadcast alignment marks"
  ],
  "motion_grammar": [
    "reveal",
    "micro-shift",
    "chromatic split",
    "brief hold",
    "collapse or lock",
    "seamless return"
  ],
  "duration_seconds": "4-6",
  "camera": "locked",
  "motion_density": "very low",
  "negative_prompt": "No characters, no faces, no landscapes, no realistic 3D scene, no corporate motion graphics, no readable text, no logos, no watermark, no strobe lights, no rapid blinking, no hectic glitch spam, no busy particles, no fast camera movement, no full-screen flashing, no chaotic rotation."
}
```

---

## Fertiger Prompt aus dem Preset

```text
Minimal abstract CRT signal geometry on a deep black background. A sparse symmetrical signal diagram appears in the center: thin warm-ivory oval rings around a tiny central dot, short ember-orange alignment ticks, and faint cyan-magenta chromatic edge offsets. The object performs one controlled motion event: the central dot expands into three concentric rings, the alignment ticks slide inward by a few pixels, the rings briefly split into cyan and magenta ghost edges, then everything locks back into a clean centered symbol.

The scene should feel like a vintage broadcast ident, op-art signal test, techno frequency diagram, and analog machine ritual. Strong black negative space, subtle CRT scanlines, VHS grain, soft halation, tiny pixel smear, precise loop clarity.

seamless looping GIF-style video, 4 to 6 seconds, one dominant event only, locked camera, strong first-frame readability, clean loop-ready end pose, no text, no logos, no strobe lights, no rapid blinking, no hectic pacing.

Negative prompt: no characters, no faces, no landscapes, no realistic 3D scene, no corporate motion graphics, no readable text, no watermark, no hectic glitch spam, no busy particles, no fast camera movement, no full-screen flashing.
```
