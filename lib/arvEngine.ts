import {
  ARVGifPrompt,
  ARVNarrativePhase,
  ARVStoryScene,
  ARVStorySequence,
  ARVSatireSketch,
  ARVDialogueLine,
  ARVCharacter,
} from './arvTypes';
import { ARV_CHARACTERS, getCharacter, pickVocab } from './arvCharacters';
import { DEFAULT_STYLE_FLEX_MODE, STYLE_TASTE_SHORT_LABEL, withStyleTaste, type StyleFlexMode } from './styleTaste';

// ─── UTILITY ────────────────────────────────────────────────────────────────────

function uid(): string {
  return `arv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── GIF PROMPT BUILDING BLOCKS ─────────────────────────────────────────────────

const GEOMETRY_SUBJECTS = [
  'A crooked acid-lime spiral trapped inside a red scan gate on black CRT paper',
  'A dirty white circle sliced by magenta bars while cyan scanner light bends the shape sideways',
  'A black rubber torus wobbling once inside an underground concrete room with flyer grain on the walls',
  'A primitive rectangle stack misregistering cyan and hot magenta like a damaged club ident',
  'A single absurd geometric machine made from dots, bars, and bent grids breathing in a black field',
  'A wet concrete floor reflecting one hovering violet triangle that folds into itself',
  'A torn rave flyer fragment where a spiral, a barcode, and a color block fight for alignment',
  'A non-human silhouette reduced to one shoulder-like black shape and a scanner band',
  'A floating pressure diagram of circles, rails, and ugly orange ticks snapping into a loop',
  'A malformed signal object hovering between graffiti wall grain, CRT bleed, and photocopy dust',
] as const;

const MOTION_DESCRIPTORS = [
  'slipping out of register once before a hard freeze snaps it back into frame one',
  'wobbling like a bad photocopy until a cyan scanner band forces a clean reset',
  'folding inward through one ugly-bright color mistake and returning to the opening geometry',
  'breathing through one pressure pulse while duplicate edges collapse into a single shape',
  'locking into a near-still poster pose before one sharp residue event burns out',
  'looping like a damaged underground broadcast ident with one deliberate geometric mutation',
] as const;

const COLOR_PALETTES = [
  'matte black, dirty white, phosphor cyan, hot magenta, and warning red',
  'wet concrete black, acid lime, sodium orange, and bruised violet under CRT bleed',
  'deep charcoal, xerox gray, rotten green, and one ugly amber color block',
  'black paper, cobalt shadow, cyan scanner light, and magenta photocopy edges',
  'charcoal shadow, faded ink, CRT cyan, rust orange, and acid-lime ticks under hard contrast',
] as const;

const ATMOSPHERE_DESCRIPTORS = [
  'raw underground video loop, tactile and adult like a damaged club ident',
  'black-room reality fragment with analog residue and absurd precision',
  'quiet geometric stage where color and shape replace character and lore',
  'matte broadcast plate suspended between xerox damage and rave flyer logic',
  'minimal concrete void with hard contrast, dust, and no decorative softness',
] as const;

const CAMERA_DESCRIPTORS = [
  'dead-center frontal composition with one dominant subject or event',
  'locked frame with deliberate negative space and a clean lower third for overlays',
  'symmetrical wide shot like a damaged institutional ident',
  'slow deliberate push toward a central plate, slit, or archive core',
  'static camera, poster-like readability, no shake, no coverage cuts',
] as const;

const NARRATIVE_THEMES = [
  'raw signal emergence',
  'geometric loop mistake',
  'underground reality breach',
  'color block mutation',
  'scanner-band transformation',
  'xerox afterimage collapse',
  'absurd machine stillness',
  'rave flyer residue loop',
] as const;

const PHASE_MODIFIERS: Record<ARVNarrativePhase, string> = {
  emergence:
    'The subject appears as one raw geometric loop object locking into view from black.',
  tension:
    'Graphic pressure rises. Bars slip, color edges misregister, and the object becomes more insistent without becoming frantic.',
  expansion:
    'The image escalates through one controlled shape mutation, color mistake, or mechanical reveal while staying centered and readable.',
  collapse:
    'The sequence snaps back to one loop object, residue mark, or hard freeze pose ready to repeat.',
};

// ─── GIF PROMPT GENERATOR ────────────────────────────────────────────────────────

export function generateGifPrompt(
  characterId?: string,
  phase?: ARVNarrativePhase,
  styleMode: StyleFlexMode = DEFAULT_STYLE_FLEX_MODE,
): ARVGifPrompt {
  const geometry = pick(GEOMETRY_SUBJECTS);
  const motion = pick(MOTION_DESCRIPTORS);
  const colors = pick(COLOR_PALETTES);
  const atmosphere = pick(ATMOSPHERE_DESCRIPTORS);
  const camera = pick(CAMERA_DESCRIPTORS);
  const theme = pick(NARRATIVE_THEMES);

  let characterLayer = '';
  if (characterId) {
    const char = getCharacter(characterId);
    if (char) {
      characterLayer = ` Conceptual layer: ${char.satireTarget}. Transmission register: ${char.transmissionStyle}.`;
    }
  }

  const phaseNote = phase ? ` ${PHASE_MODIFIERS[phase]}` : '';

  const prompt = withStyleTaste([
    `${geometry}, ${motion}.`,
    `${colors}.`,
    `Atmosphere: ${atmosphere}.`,
    `${camera}.`,
    phaseNote,
    characterLayer,
    `Thematic core: ${theme}.`,
    `Favor sparse iconic composition, damaged analog texture, and loop clarity. Use photocopy grain, CRT bleed, scanner bands, rave flyer damage, crude geometry, ugly-bright color accidents, and hard contrast only where they strengthen the scene. Keep the palette tight, the motion controlled, the lower third clean, and the image immediately readable. Avoid sterile realism, glossy polish, cheerful mascot energy, scattered tiny subjects, stock cinematic realism, and fantasy-cartoon literalism.`,
  ]
    .filter(Boolean)
    .join(' '), { styleMode });

  return {
    id: uid(),
    prompt,
    styleNote:
      `ARV STYLE: ${STYLE_TASTE_SHORT_LABEL}. Motion: hypnotic loop logic with analog texture.`,
    geometry,
    motion,
    colors,
    atmosphere,
    characterId,
    phase,
    tags: [theme, phase ?? 'free', characterId ?? 'no-character'],
    createdAt: Date.now(),
  };
}

// ─── STORY SEQUENCE GENERATOR ────────────────────────────────────────────────────

const PHASE_TITLES: Record<ARVNarrativePhase, string[]> = {
  emergence: [
    'Initiierung',
    'Erste Transmission',
    'Das Erscheinen',
    'Protokoll: Beginn',
    'Signal Null',
    'Formgebung aus dem Nichts',
  ],
  tension: [
    'Interferenz',
    'Systemspannung',
    'Das Protokoll greift',
    'Maschinelle Logik',
    'Verzerrung am Rand',
    'Druckfeld',
  ],
  expansion: [
    'Kosmische Unterbrechung',
    'Skalierung',
    'Institutioneller Eingriff',
    'Das Muster expandiert',
    'Transmission weitet sich aus',
    'Archiv öffnet sich',
  ],
  collapse: [
    'Rückfaltung',
    'Formauflösung',
    'Stille nach dem Protokoll',
    'Minimalform',
    'Signal Ende',
    'Entropie: abgeschlossen',
  ],
};

function buildNarration(character: ARVCharacter | null, phase: ARVNarrativePhase, concept: string, sceneNum: number): string {
  if (!character) {
    return `Szene ${sceneNum} · Phase: ${phase.toUpperCase()} · Konzept: ${concept}.`;
  }
  const vocab = pickVocab(character);
  const templates = [
    `[${character.name}] ${vocab} — Konzept erfasst: ${concept}.`,
    `[${character.name}] ${vocab}. Das Muster wird bestätigt.`,
    `[${character.name}] ${vocab} — ${character.satireTarget}. Protokolliert.`,
    `[${character.name}] Transmission ${sceneNum}: ${vocab}. Konzept: ${concept}.`,
  ];
  return pick(templates);
}

export function generateStorySequence(
  concept: string,
  characterId?: string,
  styleMode: StyleFlexMode = DEFAULT_STYLE_FLEX_MODE,
): ARVStorySequence {
  const phases: ARVNarrativePhase[] = ['emergence', 'tension', 'expansion', 'collapse'];
  const character = characterId ? (getCharacter(characterId) ?? null) : null;

  const scenes: ARVStoryScene[] = phases.map((phase, i) => {
    const gifPrompt = generateGifPrompt(characterId, phase, styleMode);
    const sceneTitle = pick(PHASE_TITLES[phase]);
    return {
      phase,
      sceneNumber: i + 1,
      title: sceneTitle,
      prompt: `${gifPrompt.prompt} Narrative focus: ${concept}. Scene beat: ${sceneTitle}.`,
      narration: buildNarration(character, phase, concept, i + 1),
    };
  });

  const titleTemplates = [
    `${concept} — Raw ARV Loop`,
    `Signalfehler: ${concept}`,
    `${concept}: Geometrische Schleife`,
    `Underground-Loop — ${concept}`,
    `${concept} · Formfehler`,
    `Rueckkopplung: ${concept}`,
  ];

  return {
    id: uid(),
    title: pick(titleTemplates),
    concept,
    characterId,
    scenes,
    createdAt: Date.now(),
  };
}

// ─── SATIRE SKETCH GENERATOR ─────────────────────────────────────────────────────

const SATIRE_TOPICS = [
  {
    topic: 'Ein Formular, das ausgefüllt werden muss, um ein Formular zu beantragen',
    target: 'Bürokratische Selbstreferenz',
  },
  {
    topic: 'Eine Warnung, die gesendet wurde, aber niemand liest Warnungen mehr',
    target: 'Gesellschaftliche Ignoranz',
  },
  {
    topic: 'Eine Optimierung, die nachweislich alles langsamer macht',
    target: 'Technologischer Solutionismus',
  },
  {
    topic: 'Ein historisches Ereignis, das sich wiederholt und alle überrascht',
    target: 'Kollektives Geschichtsvergessen',
  },
  {
    topic: 'Die kosmische Bedeutung einer Routinesitzung ohne Tagesordnung',
    target: 'Institutionelle Wichtigtuerei',
  },
  {
    topic: 'Ein Algorithmus, der berechnet, dass Effizienz ineffizient ist',
    target: 'Digitale Überoptimierung',
  },
  {
    topic: 'Eine Kommission zur Untersuchung der Ergebnisse der vorherigen Kommission',
    target: 'Institutionelle Selbstbeschäftigung',
  },
  {
    topic: 'Ein Kollaps, der seit 40 Jahren imminent und nie eingetreten ist',
    target: 'Permanenter Alarmismus',
  },
  {
    topic: 'Das Universum protokolliert, wie Menschen das Universum ignorieren',
    target: 'Menschliches Ego',
  },
  {
    topic: 'Ein Signal, das gesendet wird, aber nie ankommt — und trotzdem gesendet wird',
    target: 'Kommunikationsverlust',
  },
  {
    topic: 'Optimismus wird als kritischer Systemfehler in die Datenbank eingetragen',
    target: 'Institutioneller Nihilismus',
  },
  {
    topic: 'Eine Zeitkapsel aus dem Jahr 2025, die niemand in der Zukunft öffnen will',
    target: 'Gegenwartspessimismus',
  },
  {
    topic: 'Ein Mensch erklärt dem Universum warum er wichtig ist. Das Universum notiert dies nicht.',
    target: 'Ego und Selbstüberschätzung',
  },
  {
    topic: 'Ein Statusbericht über einen Statusbericht, der bestätigt, dass der ursprüngliche Statusbericht aussteht',
    target: 'Bürokratische Endlosschleifen',
  },
] as const;

const SKETCH_SETTINGS = [
  'Eine leere Behörde um 03:14 Uhr. Alle Systeme laufen. Kein Personal vorhanden.',
  'Ein Beobachtungsposten im tiefen Weltall. Konsole blinkt. Keine Messwerte außer Norm.',
  'Das Archiv der Zukunft. Regalreihen ohne Ende. Eine Lampe. Keine Tür.',
  'Raum B-9. Eine Sitzung läuft seit 340 Jahren. Keine Tagesordnung liegt vor.',
  'Ein Rechenzentrum. Server laufen. Kein Netz. Kein Ausgang. Klimaanlage optimal.',
  'Die letzte Kommissionssitzung. Alle Formulare korrekt ausgefüllt. Niemand unterschreibt.',
  'Konferenzraum Delta-7. Präsentation läuft. Kein Publikum. Licht aus. Projektor an.',
  'Ein Wartezimmer. Keine Türen. Eine Nummer wird aufgerufen. Niemand ruft sie auf.',
  'Ein Serverraum, der für eine Aufgabe gebaut wurde, die niemand mehr kennt.',
  'Dachgeschoss eines Gebäudes, das nicht mehr für Menschen gebaut wurde.',
] as const;

const SKETCH_CONCLUSIONS = [
  'Die Sitzung wird vertagt. Kein Termin wurde festgelegt. Das Protokoll endet hier.',
  'Das System läuft weiter. Niemand hat es gefragt.',
  'Das Protokoll endet hier. Das Problem endet nicht.',
  'Das Archiv verzeichnet: keine Maßnahme ergriffen. Eintrag: vollständig.',
  'Aus kosmischer Perspektive: statistisch irrelevant. Aber wir haben es notiert.',
  'GLITCHLING würde an dieser Stelle etwas sagen, aber— SIGNAL//UNTERBROCHEN',
  'Statusbericht: ausstehend. Wie gehabt.',
  'Das Formular wurde korrekt ausgefüllt. Das war alles, was verlangt wurde.',
  'ARCHIV-ECHO vermerkt: "Muster bekannt. Fußnote 7 gilt weiterhin."',
  'Das Universum notiert nichts. Es hatte es bereits notiert.',
] as const;

function buildSketchDialogue(
  chars: ARVCharacter[],
  topic: { readonly topic: string; readonly target: string }
): ARVDialogueLine[] {
  const [c1, c2] = chars;
  const lines: ARVDialogueLine[] = [
    // Eröffnung: Prämisse etablieren
    { characterId: c1.id, line: `${pickVocab(c1)} — Das vorliegende Thema: ${topic.topic}.` },
    { characterId: c2.id, line: `${pickVocab(c2)} — Das ist bekannt.` },
    // Eskalation: logische Argumentation
    { characterId: c1.id, line: `${pickVocab(c1)} — Eine Lösung ist dringend erforderlich.` },
    {
      characterId: c2.id,
      line: `${pickVocab(c2)} — Lösungen wurden archiviert. Klassifizierung: "Nicht Implementiert". Eintrag aus dem Jahr ${1968 + Math.floor(Math.random() * 35)}.`,
    },
    // Bürokratische Unterbrechung
    { characterId: c1.id, line: `${pickVocab(c1)} — Das Protokoll verlangt eine Maßnahme.` },
    {
      characterId: c2.id,
      line: `${pickVocab(c2)} — Die Maßnahme ist bekannt. Sie ist jedoch nicht Teil dieses Protokolls.`,
    },
    // Steigerung
    { characterId: c1.id, line: `${pickVocab(c1)} — Wer ist zuständig?` },
    {
      characterId: c2.id,
      line: `${pickVocab(c2)} — Zuständigkeit: ungeklärt. Formular B-9 wurde nicht ausgefüllt.`,
    },
    // Nicht-Auflösung
    { characterId: c1.id, line: `${pickVocab(c1)} — Ich erstelle ein Ticket.` },
    {
      characterId: c2.id,
      line: `${pickVocab(c2)} — Das Ticket existiert bereits. Status: offen. Seit ${1972 + Math.floor(Math.random() * 30)} Jahren.`,
    },
    { characterId: c1.id, line: `${pickVocab(c1)} — Dann warten wir.` },
    { characterId: c2.id, line: `${pickVocab(c2)} — Das tun wir.` },
  ];
  return lines;
}

export function generateSatireSketch(inputCharacterIds: string[]): ARVSatireSketch {
  let characterIds = inputCharacterIds;

  // Ensure at least 2 characters
  if (characterIds.length < 2) {
    const shuffled = [...ARV_CHARACTERS].sort(() => Math.random() - 0.5);
    characterIds = shuffled.slice(0, 2).map((c) => c.id);
  }

  const chars = characterIds
    .slice(0, 2)
    .map((id) => getCharacter(id))
    .filter((c): c is ARVCharacter => !!c);

  if (chars.length < 2) return generateSatireSketch([]);

  const topic = pick(SATIRE_TOPICS);
  const setting = pick(SKETCH_SETTINGS);
  const dialogue = buildSketchDialogue(chars, topic);
  const conclusion = pick(SKETCH_CONCLUSIONS);

  return {
    id: uid(),
    title: `${chars.map((c) => c.name).join(' & ')} — ${topic.target}`,
    setting,
    satireTarget: topic.target,
    characterIds: chars.map((c) => c.id),
    dialogue,
    conclusion,
    createdAt: Date.now(),
  };
}

// ─── AI EXPANSION ────────────────────────────────────────────────────────────────

export async function expandPromptWithAI(basePrompt: string, styleMode: StyleFlexMode = DEFAULT_STYLE_FLEX_MODE): Promise<string> {
  const flexibilityNote = styleMode === 'strict'
    ? 'Stay fairly close to the existing ARV vocabulary and keep variation controlled.'
    : styleMode === 'loose'
      ? 'Allow wider motif, palette, and density drift while keeping only a loose ARV family resemblance.'
      : 'Keep a balanced mix of recognisable ARV cues and scene-specific variation.';

  const response = await fetch('/api/openai/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: basePrompt,
      instructions:
        `You are an ARV visual aesthetic guide. Expand this GIF visual prompt toward raw early-ARV loop language: abstract geometry, ugly-bright color slips, underground-reality fragments, analog texture, and uncanny reset logic. Preserve graphic intention and loop mechanics, but use only the motifs, palette cues, and artifacts that help this specific scene. Do not force every signature ARV element into every prompt. ${flexibilityNote} Keep output under 180 words. Output only the expanded prompt text, no explanations.`,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'AI expansion failed');
  return data.text?.trim() ?? basePrompt;
}

// ─── TRANSMISSION GENERATOR (evolving character monologue) ───────────────────────

export function generateTransmission(characterId: string, topic?: string): string {
  const char = getCharacter(characterId);
  if (!char) return '';

  const v1 = pickVocab(char);
  const v2 = pickVocab(char);
  const v3 = pickVocab(char);
  const theme = topic ?? pick(NARRATIVE_THEMES as unknown as string[]);

  const templates = [
    `[TRANSMISSION · ${char.name}]\n\n${v1}.\n\nThema: ${theme}.\n\n${v2}.\n\nBeobachtung: Das Muster ist stabil. Das Problem ist bekannt. Die Maßnahme ist bekannt.\nDie Maßnahme wurde nicht ergriffen.\n\n${v3}.\n\n[ENDE DER TRANSMISSION]`,
    `[${char.name} · ${char.transmissionStyle.split('·')[0].trim().toUpperCase()}]\n\n${v1}.\n\nKontext: ${theme}.\n${v2} — Dies wurde bereits vermerkt.\n\n${char.satireTarget.split('·')[0].trim()}: Bestätigt.\n\n${v3}.\n\n— Ende —`,
    `[EINGEHENDE ÜBERTRAGUNG · ${char.name}]\n\nBetreff: ${theme}\n\n${v1}.\n${v2}.\n\nDas war zu erwarten.\n${char.satireTarget.split('·')[0].trim()} — Protokoll Nummer unbekannt.\n\n${v3}.\n\nWeiterleitung an: niemanden.\n\n[${char.name} · TRANSMISSION ABGESCHLOSSEN]`,
  ];

  return pick(templates);
}

export { ARV_CHARACTERS };
