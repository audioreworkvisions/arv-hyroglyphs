export const arvMinimalSignalGeometryPreset = {
  id: 'arv-minimal-signal-geometry',
  name: 'ARV Minimal Signal Geometry',
  version: '2026-06-05',
  category: 'abstract-loop',
  family: 'arv-signal-systems',
  description:
    'Raw black-background CRT signal geometry for hypnotic techno GIF loops: primitive shapes, scanner bars, crooked grids, color slips, absurd signal behavior, analog dirt, and a clean snapback to frame one.',
  tags: [
    'minimal',
    'crt',
    'signal',
    'geometry',
    'op-art',
    'broadcast-ident',
    'techno-visual',
    'hypnotic-loop',
    'black-void',
    'scanline',
    'arv',
  ],
  visualIdentity: {
    background: 'deep black void',
    composition: 'centered, symmetrical, sparse, graphic',
    density: 'very low',
    subjectType: 'abstract signal geometry',
    camera: 'locked camera',
    realism: 'non-literal, primitive motion-graphic, analog broadcast texture, absurd underground reality',
  },
  palette: {
    base: ['#000000', '#050506', '#111111'],
    signal: ['#00F5D4', '#FF2E88', '#FFE8A3', '#FF7A45', '#E9F8FF'],
    optionalAccent: ['#B9FF66', '#7A6CFF', '#FF3131'],
  },
  texture: [
    'subtle CRT scanlines',
    'low VHS grain',
    'analog signal noise',
    'slight chromatic aberration',
    'soft halation on thin lines',
    'barely visible dust',
    'pixel smear only at motion edges',
    'matte black background',
  ],
  motifs: [
    'thin rectangular frame',
    'concentric orbital curves',
    'small central dot',
    'vertical barcode bars',
    'symmetrical line diagrams',
    'tiny signal pulses',
    'cyan and magenta edge offsets',
    'primitive vector glyphs',
    'crooked spirals',
    'cheap flyer color blocks',
    'rubbery aperture shapes',
    'broken broadcast alignment marks',
  ],
  motionRules: {
    durationSeconds: '4/8/12',
    loopType: 'seamless',
    camera: 'locked',
    motionDensity: 'very low',
    dominantEventCount: 1,
    rhythm: 'raw reveal -> crooked signal shift -> color-slip hold -> collapse, recoil, or lock -> clean return to frame one',
    allowedMotion: [
      'thin line draws inward',
      'rectangle pulses once then snaps back',
      'orbital curve slowly aligns',
      'signal bars shift by a few pixels',
      'cyan-magenta edge split appears and resolves',
      'small dot expands into rings and returns',
      'geometric frame compresses into center',
      'crooked spiral inhales once and unwinds back to zero',
      'cheap color block slides across the diagram and disappears',
      'scanner band reveals a hidden shape for one beat',
      'barcode lines brighten and realign',
    ],
    forbiddenMotion: [
      'fast rotation',
      'frantic glitch spam',
      'rapid blinking',
      'strobe',
      'camera shake',
      'busy particles',
      'multiple competing animations',
      'full-screen flashing',
    ],
  },
  promptCore: `
Raw abstract CRT signal geometry on a deep black background.
A sparse signal diagram appears in the center: thin ivory lines, cyan and magenta edge offsets, a small central dot, a crooked spiral, a rectangular frame, scanner bars, orbital curves, or cheap flyer color blocks.
The animation performs one controlled loop event only: the geometry wobbles, shifts by a few pixels, splits into chromatic ghost edges, reveals one absurd hidden shape, then snaps back into a clean first-frame pose.
The scene should feel like a vintage broadcast ident, op-art signal test, techno frequency diagram, photocopied rave flyer, and underground machine ritual.
Use strong negative space, CRT scanlines, VHS grain, toner dirt, soft halation, tiny pixel smear, and precise GIF-loop clarity.
`.trim(),
  generationPromptTemplate: `
A raw abstract motion-graphics loop on a deep black CRT background.
One central geometric signal object: {{motif}}.
The object performs one controlled motion event: {{motionEvent}}.
Use thin luminous linework, cyan-magenta chromatic edge split, warm ivory signal lines, abrupt acid or amber accents, analog scanlines, toner dust, VHS grain, soft halation, and black negative space.
The motion is raw, technical, hypnotic, and loop-ready: reveal -> wobble -> color slip -> hard snapback -> return.
seamless looping GIF-style video, 4, 8, or 12 seconds, one dominant event only, locked camera, strong first-frame readability, clean loop-ready end pose, no text, no logos, no polished corporate logo animation.
`.trim(),
  defaultMotifs: [
    'a thin red-magenta rectangular frame surrounded by pale orbital curves',
    'seven vertical barcode signal bars glowing in ivory, cyan, and magenta',
    'a small central dot expanding into three concentric rings',
    'four corner rectangles connected by thin ivory alignment lines',
    'a symmetrical radar-like eye made of thin oval rings and short orange ticks',
    'a black-on-black rectangle with cyan and magenta signal trails entering from both sides',
    'two mirrored cyan angle brackets closing toward a central ivory frame',
    'a crooked cyan spiral trapped inside a dirty magenta rectangular frame',
    'three cheap flyer color blocks sliding over a black scanner grid',
    'a rubbery ivory aperture squeezed by red and cyan barcode rails',
  ],
  defaultMotionEvents: [
    'the lines drift inward by a few pixels, split into cyan-magenta ghost edges, then lock back into perfect symmetry',
    'the central dot expands into three rings, holds for one beat, then collapses back into a single point',
    'the rectangular frame pulses once, bends inward subtly, then returns to a perfectly sharp outline',
    'the vertical bars brighten, misalign slightly, then realign into a clean barcode formation',
    'a tiny signal pulse travels from left to right and causes the orbital curves to align around the frame',
    'the geometry blooms outward like a technical flower, pauses, then folds back into the original diagram',
    'a scanner band crosses the object, reveals one absurd hidden contour, then erases it back to black',
    'the spiral inhales into a tight dot, slips into magenta for one beat, then unwinds to the opening shape',
    'three color blocks knock the grid out of register, hold for a single frame, then snap back into alignment',
  ],
  negativePrompt:
    'No characters, no faces, no landscapes, no realistic 3D scene, no corporate motion graphics, no readable text, no logos, no watermark, no strobe lights, no rapid blinking, no hectic glitch spam, no busy particles, no fast camera movement, no full-screen flashing, no chaotic rotation, no over-detailed cyberpunk HUD, no colorful clutter.',
} as const;

export type MinimalSignalGeometryPreset = typeof arvMinimalSignalGeometryPreset;
