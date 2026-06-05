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
  { id: 'subject-mechanical-object', category: 'subject', label: 'Mechanical object', promptText: 'single mechanical object or apparatus' },
  { id: 'subject-signal-field', category: 'subject', label: 'Signal field', promptText: 'single signal field or pattern system' },
  { id: 'subject-pressure-core', category: 'subject', label: 'Pressure core', promptText: 'single pressure core or aperture' },
  { id: 'subject-synthetic-organism', category: 'subject', label: 'Synthetic organism', promptText: 'single synthetic organism or data lifeform' },
  { id: 'subject-kinetic-architecture', category: 'subject', label: 'Kinetic architecture', promptText: 'single kinetic structure or architectural system' },

  { id: 'surface-matte-dust', category: 'surface', label: 'Matte dust', promptText: 'matte dusted surface with tactile grain' },
  { id: 'surface-fogged-glass', category: 'surface', label: 'Fogged glass', promptText: 'fogged glass or translucent surface' },
  { id: 'surface-lacquer-metal', category: 'surface', label: 'Lacquered metal', promptText: 'lacquered metal or reflective industrial skin' },
  { id: 'surface-scanline-haze', category: 'surface', label: 'Scanline haze', promptText: 'scanline haze or soft signal residue' },

  { id: 'motion-pressure-pulse', category: 'motion', label: 'Pressure pulse', promptText: 'one pressure pulse' },
  { id: 'motion-panel-shift', category: 'motion', label: 'Panel shift', promptText: 'one panel shift or structural slide' },
  { id: 'motion-slit-open', category: 'motion', label: 'Slit opening', promptText: 'one slit opening or brief reveal' },
  { id: 'motion-drift', category: 'motion', label: 'Drift', promptText: 'one slow drift or hover change' },
  { id: 'motion-wave-sweep', category: 'motion', label: 'Wave sweep', promptText: 'one wave sweep across the image' },
  { id: 'motion-ripple-split', category: 'motion', label: 'Ripple split', promptText: 'one ripple or contour split' },

  { id: 'transformation-afterimage', category: 'transformation', label: 'Afterimage', promptText: 'a clean afterimage or ghost contour' },
  { id: 'transformation-phase-shift', category: 'transformation', label: 'Phase shift', promptText: 'a material phase shift' },
  { id: 'transformation-duplicate-echo', category: 'transformation', label: 'Duplicate echo', promptText: 'a duplicate echo or contour echo' },
  { id: 'transformation-pressure-flare', category: 'transformation', label: 'Pressure flare', promptText: 'a brief pressure flare or light rupture' },
  { id: 'transformation-color-slip', category: 'transformation', label: 'Color slip', promptText: 'a controlled color slip or split contour' },
];

export const STILLFRAME_SATIRE_PRESET_PROFILES: StillframeSatirePresetProfile[] = [
  {
    id: 'pressure-signal-core',
    name: 'Pressure Signal Core',
    description: 'Offene Stillframe-Basis mit klarer Form, hartem Materialverhalten und kontrollierter Bildspannung.',
    presetIds: ['chromatic-shard-torus-soft-bloom', 'glass-engine-breathing', 'signal-ring-eclipse'],
    characterIds: ['archiv-echo', 'algo-7'],
    defaultElementIds: [
      'subject-graphic-form',
      'surface-fogged-glass',
      'motion-pressure-pulse',
      'transformation-afterimage',
    ],
  },
  {
    id: 'kinetic-world-builder',
    name: 'Kinetic World Builder',
    description: 'Architektur, Mikro-Welten und Systemsatire mit klaren Bewegungsregeln statt festem Mythos.',
    presetIds: ['micro-city-on-vinyl', 'cable-monastery', 'deep-server-reef'],
    characterIds: ['archiv-echo', 'sternwarte-9'],
    defaultElementIds: [
      'subject-kinetic-architecture',
      'surface-matte-dust',
      'motion-panel-shift',
      'transformation-duplicate-echo',
    ],
  },
  {
    id: 'system-malfunction-comedy',
    name: 'System Malfunction Comedy',
    description: 'Trockene Bildsatire aus Prozedur, Kontrollverlust und kleinen visuellen Fehlfunktionen.',
    presetIds: ['dead-channel-ministry', 'operator-after-midnight', 'bass-weather-laboratory'],
    characterIds: ['glitchling', 'algo-7'],
    defaultElementIds: [
      'subject-mechanical-object',
      'surface-scanline-haze',
      'motion-wave-sweep',
      'transformation-color-slip',
    ],
  },
  {
    id: 'abstract-pressure-play',
    name: 'Abstract Pressure Play',
    description: 'Freie grafische Satire aus Signalformen, Drucklogik und abstrahierten Bildkoerpern.',
    presetIds: ['chromatic-shard-torus', 'chromatic-shard-torus-glitch-breach', 'signal-ring-eclipse'],
    characterIds: ['sternwarte-9', 'hitze-prozessor'],
    defaultElementIds: [
      'subject-signal-field',
      'surface-lacquer-metal',
      'motion-ripple-split',
      'transformation-pressure-flare',
    ],
  },
];

export const DEFAULT_STILLFRAME_SATIRE_PRESET_PROFILE_ID = STILLFRAME_SATIRE_PRESET_PROFILES[0]?.id || 'pressure-signal-core';

export const getStillframeSatirePresetProfile = (profileId?: string | null): StillframeSatirePresetProfile | undefined =>
  STILLFRAME_SATIRE_PRESET_PROFILES.find((profile) => profile.id === profileId);

export const getStillframeSatireElement = (elementId?: string | null): StillframeSatireElementOption | undefined =>
  STILLFRAME_SATIRE_ELEMENT_OPTIONS.find((element) => element.id === elementId);