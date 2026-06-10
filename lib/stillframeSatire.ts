export type StillframeSatireElementCategory = 'subject' | 'surface' | 'motion' | 'transformation';

export interface StillframeSatireElementOption {
  id: string;
  category: StillframeSatireElementCategory;
  label: string;
  promptText: string;
}

export interface StillframeSatirePresetProfile {
  id: string;
  name: string;
  description: string;
  presetIds: string[];
  characterIds: [string, string];
  defaultElementIds: string[];
}

export const STILLFRAME_SATIRE_ELEMENT_OPTIONS: StillframeSatireElementOption[] = [
  { id: 'subject-graphic-form', category: 'subject', label: 'Graphic form', promptText: 'single graphic form or silhouette' },
  { id: 'subject-raw-loop-shape', category: 'subject', label: 'Raw loop shape', promptText: 'single raw geometric loop shape, signal object, or absurd color-form' },
  { id: 'subject-mechanical-object', category: 'subject', label: 'Mechanical object', promptText: 'single mechanical object or apparatus' },
  { id: 'subject-signal-field', category: 'subject', label: 'Signal field', promptText: 'single signal field or pattern system' },
  { id: 'subject-pressure-core', category: 'subject', label: 'Pressure core', promptText: 'single pressure core or aperture' },
  { id: 'subject-synthetic-organism', category: 'subject', label: 'Synthetic organism', promptText: 'single synthetic organism or data lifeform' },
  { id: 'subject-kinetic-architecture', category: 'subject', label: 'Kinetic architecture', promptText: 'single kinetic structure or architectural system' },

  { id: 'surface-matte-dust', category: 'surface', label: 'Matte dust', promptText: 'matte dusted surface with tactile grain' },
  { id: 'surface-fogged-glass', category: 'surface', label: 'Fogged glass', promptText: 'fogged glass or translucent surface' },
  { id: 'surface-lacquer-metal', category: 'surface', label: 'Lacquered metal', promptText: 'lacquered metal or reflective industrial skin' },
  { id: 'surface-scanline-haze', category: 'surface', label: 'Scanline haze', promptText: 'scanline haze or soft signal residue' },
  { id: 'surface-flyer-toner', category: 'surface', label: 'Flyer toner', promptText: 'damaged rave flyer paper, toner dust, CRT bleed, or spray haze' },

  { id: 'motion-pressure-pulse', category: 'motion', label: 'Pressure pulse', promptText: 'one pressure pulse' },
  { id: 'motion-panel-shift', category: 'motion', label: 'Panel shift', promptText: 'one panel shift or structural slide' },
  { id: 'motion-slit-open', category: 'motion', label: 'Slit opening', promptText: 'one slit opening or brief reveal' },
  { id: 'motion-drift', category: 'motion', label: 'Drift', promptText: 'one slow drift or hover change' },
  { id: 'motion-wave-sweep', category: 'motion', label: 'Wave sweep', promptText: 'one wave sweep across the image' },
  { id: 'motion-ripple-split', category: 'motion', label: 'Ripple split', promptText: 'one ripple or contour split' },
  { id: 'motion-scanner-snapback', category: 'motion', label: 'Scanner snapback', promptText: 'one scanner sweep, color slip, wobble, or hard snapback to frame one' },

  { id: 'transformation-afterimage', category: 'transformation', label: 'Afterimage', promptText: 'a clean afterimage or ghost contour' },
  { id: 'transformation-phase-shift', category: 'transformation', label: 'Phase shift', promptText: 'a material phase shift' },
  { id: 'transformation-duplicate-echo', category: 'transformation', label: 'Duplicate echo', promptText: 'a duplicate echo or contour echo' },
  { id: 'transformation-pressure-flare', category: 'transformation', label: 'Pressure flare', promptText: 'a brief pressure flare or light rupture' },
  { id: 'transformation-color-slip', category: 'transformation', label: 'Color slip', promptText: 'a controlled color slip or split contour' },
  { id: 'transformation-loop-mistake', category: 'transformation', label: 'Loop mistake', promptText: 'one ugly-bright loop mistake that leaves photocopy residue before resetting' },
];

export const STILLFRAME_SATIRE_PRESET_PROFILES: StillframeSatirePresetProfile[] = [
  {
    id: 'pressure-signal-core',
    name: 'Raw Signal Loop Core',
    description: 'Offene Stillframe-Basis mit roher Geometrie, Farbschlupf, analogem Dreck und sauberem GIF-Reset.',
    presetIds: ['arv-minimal-signal-geometry', 'chromatic-shard-torus-glitch-breach', 'abstract-techno-visuals'],
    characterIds: ['archiv-echo', 'algo-7'],
    defaultElementIds: [
      'subject-raw-loop-shape',
      'surface-flyer-toner',
      'motion-scanner-snapback',
      'transformation-loop-mistake',
    ],
  },
  {
    id: 'kinetic-world-builder',
    name: 'Kinetic World Builder',
    description: 'Architektur, Mikro-Welten und Systemsatire als absurde Loop-Realitaet mit klaren Bewegungsregeln statt festem Mythos.',
    presetIds: ['micro-city-on-vinyl', 'cable-monastery', 'arv-minimal-signal-geometry'],
    characterIds: ['archiv-echo', 'sternwarte-9'],
    defaultElementIds: [
      'subject-kinetic-architecture',
      'surface-flyer-toner',
      'motion-panel-shift',
      'transformation-duplicate-echo',
    ],
  },
  {
    id: 'system-malfunction-comedy',
    name: 'System Malfunction Comedy',
    description: 'Trockene Bildsatire aus Prozedur, Kontrollverlust, roher Geometrie und kleinen visuellen Fehlfunktionen.',
    presetIds: ['dead-channel-ministry', 'arv-minimal-signal-geometry', 'bass-weather-laboratory'],
    characterIds: ['glitchling', 'algo-7'],
    defaultElementIds: [
      'subject-mechanical-object',
      'surface-scanline-haze',
      'motion-scanner-snapback',
      'transformation-color-slip',
    ],
  },
  {
    id: 'abstract-pressure-play',
    name: 'Abstract Pressure Play',
    description: 'Freie grafische Satire aus Signalformen, Farbfeld-Unfaellen, Drucklogik und abstrahierten Bildkoerpern.',
    presetIds: ['arv-minimal-signal-geometry', 'chromatic-shard-torus-glitch-breach', 'signal-ring-eclipse'],
    characterIds: ['sternwarte-9', 'hitze-prozessor'],
    defaultElementIds: [
      'subject-signal-field',
      'surface-lacquer-metal',
      'motion-scanner-snapback',
      'transformation-loop-mistake',
    ],
  },
];

export const DEFAULT_STILLFRAME_SATIRE_PRESET_PROFILE_ID = STILLFRAME_SATIRE_PRESET_PROFILES[0]?.id || 'pressure-signal-core';

export const getStillframeSatirePresetProfile = (profileId?: string | null): StillframeSatirePresetProfile | undefined =>
  STILLFRAME_SATIRE_PRESET_PROFILES.find((profile) => profile.id === profileId);

export const getStillframeSatireElement = (elementId?: string | null): StillframeSatireElementOption | undefined =>
  STILLFRAME_SATIRE_ELEMENT_OPTIONS.find((element) => element.id === elementId);