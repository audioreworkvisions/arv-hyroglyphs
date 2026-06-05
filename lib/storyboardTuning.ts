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
    'seamless looping GIF-style video, 4 to 6 seconds, one dominant subject or event, cinematic but restrained motion, locked or very slow deliberate camera, sparse lower third kept clean for OBS overlays, tactile material response, a scene-led palette, strong first-frame readability, a clear loop-ready return or afterimage, no strobe lights, no rapid blinking, no hectic pacing',
  iconic:
    'seamless looping GIF-style video, 4 to 6 seconds, one large dominant icon, structure, or event, frontal or strongly organized composition, controlled hypnotic motion with one clear payoff, locked or very slow deliberate camera, sparse lower third kept clean for OBS overlays, coherent material logic, strong contrast, strong first-frame readability, and a loop-ready end pose or afterimage, no strobe lights, no rapid blinking, no hectic pacing',
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
  'avoid cute or playful mascots, smiling faces, big expressive eyes, pastel or candy colors, glossy toy-like 3D, anime or fantasy-cartoon styling, decorative pseudo-sacred costume aesthetics, readable text, fake inscriptions, logos, watermarks, gore, conquest imagery, aggressive flashing, and hectic motion';

export const STORY_ENGINE_SYMBOLIC_NEGATIVE_PROMPT =
  'avoid cute or playful mascots, smiling faces, big expressive eyes, pastel or candy colors, glossy toy-like 3D, anime or fantasy-cartoon styling, literal mythology illustration, decorative pseudo-sacred imagery, readable text, fake inscriptions, logos, watermarks, gore, stereotypes, aggressive flashing, and hectic motion';

export const STORY_ENGINE_GRAFFITI_NEGATIVE_PROMPT =
  'avoid photoreal humans, dense graffiti lettering, gang-sign cliches, corporate mascot polish, glossy 3D toy rendering, realistic streetwear fashion shoots, logos, watermarks, gore, aggressive flashing, and frantic motion';

export type StoryPromptMode = 'material' | 'symbolic' | 'graffiti';

const SYMBOLIC_PROMPT_PATTERN = /\b(op-art|op art|oracle|halo|signal ring|signal rings|mask|mandala|totem|diagram|emblem|portal|aperture|sigil|symbolic|iconic|afterimage|silhouette)\b/i;

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

const STORY_ENGINE_AVOID_OLD_DEFAULTS_EN =
  'Avoid childlike mascot design, human portrait cliches, literal mystical illustration, tourist-costume aesthetics, colorful fantasy-cartoon logic, and treating paper-cut figures, archive witnesses, monolith idols, or stone relics as mandatory ARV defaults. Use those only when the user explicitly asks for them.';

const STORY_ENGINE_AVOID_OLD_DEFAULTS_DE =
  'Vermeide kindliches Maskottchen-Design, menschliche Portraet-Klischees, woertliche Mystik-Illustration, touristische Kostuemaesthetik, farbige Fantasy-Cartoon-Logik und vor allem die automatische Rueckkehr zu Paper-Cut-Figuren, Archiv-Zeugen, Monolith-Idolen oder Steinreliquien als ARV-Standard. Solche Motive nur nutzen, wenn der Prompt sie wirklich verlangt.';

const STORY_ENGINE_REFERENCE_STYLE_EN = [
  'REFERENCE STYLE BIAS (HIGH PRIORITY):',
  '- Favor one dominant subject or event over wide environments or many actors.',
  '- Build scenes as bold readable compositions with negative space, a clear anchor, and enough restraint to loop cleanly.',
  '- Let the concept decide the world type: architectural, atmospheric, industrial, ecological, microscopic, abstract, or signal-driven are all valid.',
  '- Surfaces should feel tactile and specific: dust, glass, fog, metal, sediment, scanline residue, lacquer cracks, fabric, fluid, or grain rather than generic glossy CGI.',
  '- Keep the palette coherent and selective, but let it shift with the concept instead of forcing the same old archive colors every time.',
  '- Use only the motifs that sharpen the scene; do not inject archive drawers, witness figures, codex panels, or stone relics by reflex.',
  '- Motion should stay controlled and legible: one decisive shift, reaction, pulse, fold, drift, or transformation plus a clean return.',
  '- Keep the lower third clean for overlays. Avoid clutter, crowds, naturalistic acting, photoreal humans, and decorative narrative padding.',
].join('\n');

const STORY_ENGINE_REFERENCE_STYLE_DE = [
  'REFERENZ-STILBIAS (HOHE PRIORITAET):',
  '- Bevorzuge ein dominantes Motiv oder Ereignis statt weiter Welten oder vieler Akteure.',
  '- Baue Szenen als starke lesbare Kompositionen mit negativem Raum, klarem Anker und genug Ruhe fuer einen sauberen Loop.',
  '- Lass das Konzept entscheiden, ob die Welt architektonisch, atmosphaerisch, industriell, oekologisch, mikroskopisch, abstrakt oder signalhaft wird.',
  '- Oberflaechen sollen taktil und konkret wirken: Staub, Glas, Nebel, Metall, Sediment, Scanline-Reste, Lackrisse, Stoff, Fluessigkeit oder Koernung statt generischem glossy CGI.',
  '- Halte die Palette kohaerent und selektiv, aber zwinge ihr nicht jedes Mal dieselben alten Archivfarben auf.',
  '- Nutze nur die Motive, die das Bild schaerfen; injiziere nicht reflexhaft Archivschubladen, Witness-Figuren, Codex-Panels oder Steinreliquien.',
  '- Bewegung bleibt kontrolliert und lesbar: eine praegnante Verschiebung, Reaktion, Welle, Faltung, Drift oder Transformation plus saubere Rueckkehr.',
  '- Halte das untere Drittel frei fuer Overlays. Vermeide Unruhe, Menschenmengen, naturalistisches Schauspiel, photoreale Menschen und dekorativen Erzaehlkitsch.',
].join('\n');

const STORY_ENGINE_REFERENCE_STYLE_SYMBOLIC_EN = [
  'REFERENCE STYLE BIAS (HIGH PRIORITY):',
  '- Treat the world as calm signal architecture, nocturnal control space, or a void-held diagram rather than as literal myth theatre.',
  '- Favor one dominant icon, ring, halo, portrait anchor, eclipse, hex chamber, control corner, or portal event per scene.',
  '- Backgrounds should stay dark, nocturnal, or void-biased with generous negative space, phosphor haze, line ghosts, grain, or thin atmospheric residue.',
  '- Allow oracle, mask, monolith, or witness forms only when they behave like graphic anchors or transmission icons instead of lore-heavy fantasy characters.',
  '- Motion should read as ring breathing, overlap slips, code rain, cursor drift, corner-rail expansion, core pulsing, aperture opening, or one measured geometric mutation.',
  '- Borrow supporting structure from the broader ARV GIF family: corner bars, stacked light blocks, target rings, wave bridges, hex shells, and CRT-room geometry.',
  '- Keep the lower third clean and the composition immediately readable from frame one.',
].join('\n');

const STORY_ENGINE_REFERENCE_STYLE_SYMBOLIC_DE = [
  'REFERENZ-STILBIAS (HOHE PRIORITAET):',
  '- Behandle die Welt als ruhige Signalarchitektur, nachtaktive Kontrollzone oder void-gehaltenes Diagramm statt als woertliches Mythentheater.',
  '- Bevorzuge pro Szene genau ein dominantes Icon, einen Ring, Halo, Portrait-Anker, Eclipse, Hex-Chamber, Control-Corner oder ein Portal-Ereignis.',
  '- Hintergruende sollen dunkel, nocturnal oder void-betont bleiben, mit grosszuegigem Negativraum, Phosphor-Haze, Line-Ghosts, Koernung oder duennem Atmosphaerenrest.',
  '- Oracle-, Mask-, Monolith- oder Witness-Formen sind erlaubt, wenn sie sich wie grafische Signalanker verhalten statt wie lore-schwere Fantasy-Figuren.',
  '- Bewegung soll als Ring-Breathing, Overlap-Slip, Code-Rain, Cursor-Drift, Corner-Rail-Expansion, Core-Pulse, Aperture-Opening oder als eine dosierte Geometrie-Mutation lesbar sein.',
  '- Nutze aus der breiteren ARV-GIF-Familie nur unterstuetzende Struktur: Corner-Bars, gestapelte Light-Blocks, Target-Rings, Wave-Bridges, Hex-Shells und CRT-Room-Geometrie.',
  '- Halte das untere Drittel sauber und die Komposition vom ersten Frame an klar lesbar.',
].join('\n');

const STORY_ENGINE_REFERENCE_STYLE_GRAFFITI_EN = [
  'REFERENCE STYLE BIAS (HIGH PRIORITY):',
  '- Treat the world like a hand-painted seaside mural on textured wall, with visible spray fade, stucco grain, and broad sunset gradients.',
  '- Favor one dominant cartoon creature, float, bottle, board, bird, or odd vehicle per scene, outlined in thick black contour and readable from far away.',
  '- Backgrounds stay simple and graphic: sea band, road stripe, desert edge, clouds, hearts, bubbles, or one flat horizon instead of detailed realism.',
  '- Allow bug-eyed, sleepy, smug, or rubber-hose creature logic when it feels mural-born rather than polished toy-brand mascots.',
  '- Borrow one ARV loop insert per scene from the abstract ARV reference family: spiral bloom, signal bars, portal iris, schematic gate, or disciplined geometry echo.',
  '- Motion should read as bobbing, surfing, drifting, blinking, wobbling, sipping, gliding, or one elastic transformation with a clean reset.',
  '- Keep the lower third readable and uncluttered enough for overlays.',
].join('\n');

const STORY_ENGINE_REFERENCE_STYLE_GRAFFITI_DE = [
  'REFERENZ-STILBIAS (HOHE PRIORITAET):',
  '- Behandle die Welt wie ein handgemaltes Kuesten-Mural auf strukturierter Wand mit sichtbarer Spray-Fade, Putzkoernung und breiten Sunset-Verlaeufen.',
  '- Bevorzuge pro Szene genau ein dominantes Cartoon-Wesen, Float, Bottle, Board, Vogel oder seltsames Fahrzeug mit dicker schwarzer Kontur und klarer Fernlesbarkeit.',
  '- Hintergruende bleiben simpel und grafisch: Meeresband, Strassenstreifen, Wuestenkante, Wolken, Herzen, Blasen oder eine flache Horizontlinie statt detailliertem Realismus.',
  '- Bug-Eyes, sleepy oder smug Gesichter und Rubber-Hose-Logik sind erlaubt, solange sie mural-geboren wirken und nicht wie polierte Spielzeug-Maskottchen.',
  '- Pro Szene darf genau ein ARV-Loop-Eingriff aus der abstrakten ARV-Referenzfamilie auftauchen: Spiral-Bloom, Signal-Bars, Portal-Iris, Schematic-Gate oder disziplinierter Geometrie-Echo.',
  '- Bewegung soll als Bobbing, Surfen, Driften, Blinzeln, Wobbeln, Schluerfen, Gleiten oder als eine elastische Transformation mit sauberem Reset lesbar sein.',
  '- Halte das untere Drittel lesbar und nicht ueberladen fuer Overlays.',
].join('\n');

const STORY_ENGINE_DUAL_TRACK_EN = [
  'ARV has two valid visual tracks.',
  '- Default track: material-process worlds, object rituals, machine ecologies, weather systems, kinetic architectures, micro-worlds, and non-human data life.',
  '- Alternate track: abstract or signal-driven worlds when the user prompt or preset clearly asks for them, including icons, diagrams, portals, pressure geometry, disciplined pattern systems, and graphic forms.',
  `- ${STORY_ENGINE_AVOID_OLD_DEFAULTS_EN}`,
  '- If the current request clearly leans symbolic, allow abstract iconography intentionally without dragging the result back into the old archive canon.',
  '- Prompt grammar should internally favor: motif + movement + camera + light + style + loop rule.',
].join('\n');

const STORY_ENGINE_DUAL_TRACK_DE = [
  'ARV hat zwei gueltige visuelle Spuren.',
  '- Standardspur: Material- und Prozesswelten, Objekt-Rituale, Maschinenoekologien, Wettersysteme, kinetische Architekturen, Mikro-Welten und nicht-menschliches Datenleben.',
  '- Alternative Spur: abstrakte oder signalhafte Welten, wenn Prompt oder Preset sie klar verlangen, inklusive Icons, Diagrammen, Portalen, Druckgeometrien, disziplinierten Mustersystemen und grafischen Formen.',
  `- ${STORY_ENGINE_AVOID_OLD_DEFAULTS_DE}`,
  '- Wenn die aktuelle Anfrage klar symbolisch ist, erlaube abstrakte Ikonografie bewusst, ohne die Szene wieder in den alten Archiv-Kanon zu ziehen.',
  '- Die gifSpecification soll intern moeglichst diesem Aufbau folgen: Motiv + Bewegung + Kamera + Licht + Stil + Loop-Regel.',
].join('\n');

const STORY_ENGINE_DUAL_TRACK_SYMBOLIC_EN = [
  'ARV symbolic signal work should operate through two coupled layers.',
  '- Primary layer: one crisp signal icon or portrait-scale anchor such as a ring, halo, mask, portal, monolith, hex chamber, or core.',
  '- Secondary layer: one surrounding system that explains the world, such as orbit diagrams, code veils, corner rails, phosphor terminals, wave bridges, or quiet room geometry.',
  '- Let the layers support each other, but do not flood the frame with runes, lore props, dense HUD clutter, or pseudo-sacred decoration.',
  '- Keep the frame sparse, nocturnal, centered or clearly intentional, and loop-legible.',
  '- Prompt grammar should internally favor: central icon + surrounding field + one measured pulse + loop rule.',
].join('\n');

const STORY_ENGINE_DUAL_TRACK_SYMBOLIC_DE = [
  'ARV-symbolische Signalwelten arbeiten ueber zwei gekoppelte Ebenen.',
  '- Primaere Ebene: ein praeziser Signalanker im Portrait- oder Icon-Massstab, etwa Ring, Halo, Maske, Portal, Monolith, Hex-Chamber oder Core.',
  '- Sekundaere Ebene: genau ein umgebendes System, das die Welt erklaert, etwa Orbit-Diagramme, Code-Veils, Corner-Rails, Phosphor-Terminals, Wave-Bridges oder ruhige Raumgeometrie.',
  '- Lass beide Ebenen zusammenarbeiten, aber ueberschuette das Bild nicht mit Runen, Lore-Requisiten, dichtem HUD-Kleinkram oder pseudo-sakraler Dekoration.',
  '- Halte das Bild sparsam, nocturnal, zentriert oder klar gesetzt und loop-lesbar.',
  '- Die gifSpecification soll intern moeglichst diesem Aufbau folgen: zentrales Icon + umgebendes Feld + dosierter Puls + Loop-Regel.',
].join('\n');

const STORY_ENGINE_DUAL_TRACK_GRAFFITI_EN = [
  'ARV graffiti works through two coupled layers.',
  '- Primary layer: lowbrow mural tableau with sunset gradients, sea-blue bands, thick outlines, spray drips, and laid-back character silhouettes.',
  '- Secondary layer: abstract ARV loop intervention such as a spiral iris, diagram gate, signal rails, or glowing geometry that briefly reorganizes the mural space.',
  '- Let the two layers fuse. Do not drag the result back into dark archive-witness canon unless the prompt explicitly asks for it.',
  '- Do not fill the wall with dense tags, lettering, or urban clutter. One hero motif must stay dominant.',
  '- Prompt grammar should internally favor: hero mural subject + elastic motion + flat graphic space + ARV insert + loop rule.',
].join('\n');

const STORY_ENGINE_DUAL_TRACK_GRAFFITI_DE = [
  'ARV-Graffiti arbeitet ueber zwei gekoppelte Ebenen.',
  '- Primaere Ebene: Lowbrow-Mural-Tableau mit Sunset-Verlaeufen, meerblauen Baendern, dicken Outlines, Spray-Drips und laessigen Charakter-Silhouetten.',
  '- Sekundaere Ebene: abstrakter ARV-Loop-Eingriff wie Spiral-Iris, Diagramm-Gate, Signal-Schienen oder leuchtende Geometrie, die den Mural-Raum kurz neu ordnet.',
  '- Lass beide Ebenen verschmelzen. Ziehe das Ergebnis nicht reflexhaft in den dunklen Archiv-Witness-Kanon zurueck, ausser der Prompt verlangt es explizit.',
  '- Fuelle die Wand nicht mit dichten Tags, Lettering oder urbanem Kleinkram. Ein Hero-Motiv muss dominant bleiben.',
  '- Die gifSpecification soll intern moeglichst diesem Aufbau folgen: Hero-Mural-Subjekt + elastische Bewegung + flacher grafischer Raum + ARV-Eingriff + Loop-Regel.',
].join('\n');

const STORY_ENGINE_DIRECTION_EN = [
  'STORY ENGINE DIRECTION:',
  '- Treat every result as a recognizable ARV universe with repeatable rules, not a generic one-off aesthetic loop.',
  '- Default to bold readable anchors before expanding into wider environments or extra lore.',
  '- The result should feel adult, tactile, visually precise, and slightly uncanny, not cute, glossy, or randomly decorative.',
  `- ${STORY_ENGINE_AVOID_OLD_DEFAULTS_EN}`,
  '- Prioritize motif families such as:',
  '  - material reactions, pressure systems, weather engines, fluid behavior, particles, and kinetic surfaces',
  '  - machine ecologies, laboratories, cable growth, industrial oceans, micro-cities, and controlled transport systems',
  '  - abstract signal systems, diagrams, apertures, cores, light events, and disciplined geometric fields',
  '  - non-human entities, silhouettes, objects, or structures treated as graphic anchors rather than default witness icons',
  '- Strong narrative archetypes to emulate when relevant:',
  '  - a system wakes, reveals its rule set, peaks in one memorable event, and resolves to a loop-facing residue',
  '  - a small anomaly spreads through a contained world, reorders it, and then snaps back just enough to repeat',
  '  - a structure opens, pressure moves through it, one transformation lands, and the world returns altered but loopable',
  '  - a material surface changes state, exposes a hidden layer, and settles into a new equilibrium',
  '- Each final scene prompt will automatically receive an arc-mode-specific production suffix that keeps the result loop-ready and production-safe.',
  `- Material-process requests automatically receive this negative prompt: ${STORY_ENGINE_MATERIAL_NEGATIVE_PROMPT}`,
  `- Symbolic ARV signal requests automatically receive this negative prompt instead: ${STORY_ENGINE_SYMBOLIC_NEGATIVE_PROMPT}`,
  '- Do not repeat those exact suffixes inside gifSpecification; keep gifSpecification concise and image-forward.',
].join('\n');

const STORY_ENGINE_DIRECTION_DE = [
  'RICHTUNG DER STORY-ENGINE:',
  '- Behandle jedes Ergebnis als wiedererkennbare ARV-Serienwelt mit eigener Logik statt als generischen One-Off-Loop.',
  '- Default ist ein stark lesbarer Bildanker, bevor du in breitere Umgebungen oder Zusatzlore gehst.',
  '- Das Ergebnis soll erwachsen, taktil, visuell praezise und leicht unheimlich wirken, nicht cute, glossy oder beliebig dekorativ.',
  `- ${STORY_ENGINE_AVOID_OLD_DEFAULTS_DE}`,
  '- Bevorzugte Motivfamilien sind zum Beispiel:',
  '  - Materialreaktionen, Drucksysteme, Wettermaschinen, Fluide, Partikel und kinetische Oberflaechen',
  '  - Maschinenoekologien, Labore, Kabelwachstum, industrielle Ozeane, Mikro-Welten und kontrollierte Passage-Systeme',
  '  - abstrakte Signalsysteme, Diagramme, Aperturen, Kerne, Lichtereignisse und disziplinierte Geometriefelder',
  '  - nicht-menschliche Entitaeten, Silhouetten, Objekte oder Strukturen als grafische Bildanker statt defaultiger Witness-Ikonen',
  '- Starke Story-Archetypen, wenn passend:',
  '  - ein System erwacht, zeigt seine Regel, erreicht ein praegendes Ereignis und endet in einem loopfaehigen Restbild',
  '  - eine kleine Anomalie greift in eine geschlossene Welt ein, ordnet sie neu und schnellt gerade genug zur Wiederholung zurueck',
  '  - eine Struktur oeffnet sich, Druck wandert hindurch, eine Transformation landet und die Welt kehrt veraendert aber loopbar zurueck',
  '  - eine Materialoberflaeche wechselt den Zustand, legt eine verborgene Schicht frei und stabilisiert sich in neuem Gleichgewicht',
  '- Jeder finale Szenenprompt bekommt automatisch einen arc-mode-spezifischen Produktionszusatz, der die Szene loopfaehig und produktionstauglich haelt.',
  `- Material- und Prozessanfragen bekommen automatisch diesen Negative Prompt: ${STORY_ENGINE_MATERIAL_NEGATIVE_PROMPT}`,
  `- Symbolische ARV-Signalanfragen bekommen stattdessen automatisch diesen Negative Prompt: ${STORY_ENGINE_SYMBOLIC_NEGATIVE_PROMPT}`,
  '- Wiederhole diese Zusatze nicht in gifSpecification; gifSpecification soll knapp, bildstark und direkt bleiben.',
].join('\n');

const STORY_ENGINE_DIRECTION_SYMBOLIC_EN = [
  'STORY ENGINE DIRECTION:',
  '- Treat every result as a repeatable ARV calm-signal universe: hypnotic, spacious, quietly uncanny, and never hurried.',
  '- The mood may be ceremonial, nocturnal, contemplative, transmission-like, or machine-devotional, but not baroque fantasy illustration or aggressive cyberpunk clutter.',
  '- Prioritize motif families such as signal rings, white cores, halo portraits, cut-paper diagrams, control corners, phosphor terminals, code veils, hex chambers, and quiet mandalas.',
  '- Strong narrative archetypes: a signal icon wakes; a room aligns itself around one core; a portal compresses into one unforgettable emblem; a portrait becomes a diagram and returns to stillness.',
  '- Keep scenes dark or void-biased unless the prompt clearly asks otherwise, and let negative space do part of the storytelling.',
  '- Each final scene prompt will automatically receive an arc-mode-specific production suffix that keeps the result loop-ready and production-safe.',
  `- Symbolic ARV signal requests automatically receive this negative prompt: ${STORY_ENGINE_SYMBOLIC_NEGATIVE_PROMPT}`,
  '- Do not repeat that exact suffix inside gifSpecification; keep gifSpecification concise and image-forward.',
].join('\n');

const STORY_ENGINE_DIRECTION_SYMBOLIC_DE = [
  'RICHTUNG DER STORY-ENGINE:',
  '- Behandle jedes Ergebnis als wiedererkennbare ARV-Calm-Signal-Welt: hypnotisch, raeumlich, leise unheimlich und nie gehetzt.',
  '- Die Stimmung darf zeremoniell, nocturnal, kontemplativ, transmissionsartig oder maschinen-devotional sein, aber nicht wie barocke Fantasy-Illustration oder aggressiver Cyberpunk-Kleinkram wirken.',
  '- Bevorzugte Motivfamilien: Signal-Rings, White-Cores, Halo-Portraits, Cut-Paper-Diagramme, Control-Corners, Phosphor-Terminals, Code-Veils, Hex-Chambers und ruhige Mandalas.',
  '- Starke Story-Archetypen: Ein Signal-Icon erwacht; ein Raum richtet sich um einen Core aus; ein Portal komprimiert sich zu einem unvergesslichen Emblem; ein Portrait wird zum Diagramm und kehrt in die Ruhe zurueck.',
  '- Halte Szenen dunkel oder void-betont, sofern der Prompt nicht klar etwas anderes verlangt, und lass Negativraum einen Teil der Erzaehlung tragen.',
  '- Jeder finale Szenenprompt bekommt automatisch einen arc-mode-spezifischen Produktionszusatz, der die Szene loopfaehig und produktionstauglich haelt.',
  `- Symbolische ARV-Signalanfragen bekommen automatisch diesen Negative Prompt: ${STORY_ENGINE_SYMBOLIC_NEGATIVE_PROMPT}`,
  '- Wiederhole diese Zusatze nicht in gifSpecification; gifSpecification soll knapp, bildstark und direkt bleiben.',
].join('\n');

const STORY_ENGINE_DIRECTION_GRAFFITI_EN = [
  'STORY ENGINE DIRECTION:',
  '- Treat every result as a repeatable ARV graffiti universe: beachside mural calm, sly creature humor, and one abstract loop event that makes the painted wall feel alive.',
  '- The mood may be mischievous, deadpan, dreamy, flirtatious, or absurd, but it should stay graphic and controlled rather than childish or corporate-cute.',
  '- Anthropomorphic creatures and object-characters are allowed when they feel hand-painted, street-born, and slightly weird.',
  '- Prioritize motif families such as drifting bottles, floating rafts, surf animals, flamingos, odd beach vehicles, heart puffs, bubble traces, mural suns, and portal diagrams.',
  '- Strong narrative archetypes: a mural creature notices a signal anomaly; a float or vehicle drifts into an abstract ARV gate; a painted animal reveals inner loop geometry and settles back into a poster-ready pose.',
  '- Each final scene prompt will automatically receive an arc-mode-specific production suffix that keeps the result loop-ready and production-safe.',
  `- Graffiti-mode requests automatically receive this negative prompt: ${STORY_ENGINE_GRAFFITI_NEGATIVE_PROMPT}`,
  '- Do not repeat that exact suffix inside gifSpecification; keep gifSpecification concise and image-forward.',
].join('\n');

const STORY_ENGINE_DIRECTION_GRAFFITI_DE = [
  'RICHTUNG DER STORY-ENGINE:',
  '- Behandle jedes Ergebnis als wiedererkennbare ARV-Graffiti-Serienwelt: beachside Mural-Calm, sly Creature-Humor und genau ein abstraktes Loop-Ereignis, das die bemalte Wand lebendig macht.',
  '- Die Stimmung darf mischievous, deadpan, dreamy, flirtatious oder absurd sein, soll aber grafisch und kontrolliert bleiben statt kindlich oder corporate-cute zu wirken.',
  '- Anthropomorphe Wesen und Objekt-Charaktere sind erlaubt, wenn sie handgemalt, street-born und leicht seltsam wirken.',
  '- Bevorzugte Motivfamilien: treibende Bottles, schwimmende Rafts, Surf-Tiere, Flamingos, seltsame Beach-Fahrzeuge, Herz-Puffs, Bubble-Traces, Mural-Sonnen und Portal-Diagramme.',
  '- Starke Story-Archetypen: Ein Mural-Wesen bemerkt eine Signal-Anomalie; ein Float oder Fahrzeug driftet in ein abstraktes ARV-Gate; ein gemaltes Tier zeigt innere Loop-Geometrie und landet wieder in einer posterreifen Pose.',
  '- Jeder finale Szenenprompt bekommt automatisch einen arc-mode-spezifischen Produktionszusatz, der die Szene loopfaehig und produktionstauglich haelt.',
  `- Graffiti-Mode-Anfragen bekommen automatisch diesen Negative Prompt: ${STORY_ENGINE_GRAFFITI_NEGATIVE_PROMPT}`,
  '- Wiederhole diese Zusatze nicht in gifSpecification; gifSpecification soll knapp, bildstark und direkt bleiben.',
].join('\n');

function getStoryPromptModeLabel(mode: StoryPromptMode, language: 'en' | 'de'): string {
  if (language === 'de') {
    if (mode === 'graffiti') {
      return 'ARV-GRAFFITI-MURALWELT';
    }

    return mode === 'symbolic' ? 'SYMBOLISCHE ARV-SIGNALWELT' : 'MATERIAL- UND PROZESSWELT';
  }

  if (mode === 'graffiti') {
    return 'ARV GRAFFITI MURAL WORLD';
  }

  return mode === 'symbolic' ? 'SYMBOLIC ARV SIGNAL WORLD' : 'MATERIAL-PROCESS WORLD';
}

function getStoryReferenceStyleBlock(mode: StoryPromptMode, language: 'en' | 'de'): string {
  if (language === 'de') {
    if (mode === 'graffiti') {
      return STORY_ENGINE_REFERENCE_STYLE_GRAFFITI_DE;
    }

    return mode === 'symbolic' ? STORY_ENGINE_REFERENCE_STYLE_SYMBOLIC_DE : STORY_ENGINE_REFERENCE_STYLE_DE;
  }

  if (mode === 'graffiti') {
    return STORY_ENGINE_REFERENCE_STYLE_GRAFFITI_EN;
  }

  return mode === 'symbolic' ? STORY_ENGINE_REFERENCE_STYLE_SYMBOLIC_EN : STORY_ENGINE_REFERENCE_STYLE_EN;
}

function getStoryDualTrackBlock(mode: StoryPromptMode, language: 'en' | 'de'): string {
  if (language === 'de') {
    if (mode === 'graffiti') {
      return STORY_ENGINE_DUAL_TRACK_GRAFFITI_DE;
    }

    return mode === 'symbolic' ? STORY_ENGINE_DUAL_TRACK_SYMBOLIC_DE : STORY_ENGINE_DUAL_TRACK_DE;
  }

  if (mode === 'graffiti') {
    return STORY_ENGINE_DUAL_TRACK_GRAFFITI_EN;
  }

  return mode === 'symbolic' ? STORY_ENGINE_DUAL_TRACK_SYMBOLIC_EN : STORY_ENGINE_DUAL_TRACK_EN;
}

function getStoryDirectionBlock(mode: StoryPromptMode, language: 'en' | 'de'): string {
  if (language === 'de') {
    if (mode === 'graffiti') {
      return STORY_ENGINE_DIRECTION_GRAFFITI_DE;
    }

    return mode === 'symbolic' ? STORY_ENGINE_DIRECTION_SYMBOLIC_DE : STORY_ENGINE_DIRECTION_DE;
  }

  if (mode === 'graffiti') {
    return STORY_ENGINE_DIRECTION_GRAFFITI_EN;
  }

  return mode === 'symbolic' ? STORY_ENGINE_DIRECTION_SYMBOLIC_EN : STORY_ENGINE_DIRECTION_EN;
}

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

Use this preset as the primary mood anchor, not a rigid cage. Let scenes escalate, mutate materials, reveal fresh details, and take an elegant left turn or two as long as the sequence stays cohesive, readable, cinematic, and rewatchable. ${arcMode === 'iconic' ? 'Bias toward poster-like ident moments with one dominant subject, one memorable motion payoff, and an end pose that feels instantly replayable.' : 'Bias toward connected cinematic progression with clearer environmental continuity, atmosphere-led transitions, and loop-capable scene endings.'}
Mandatory safety guardrails: no strobe lights, no rapidly blinking lights, no very fast rotating objects, no nervous motifs, patterns, colors, shapes, or lights, and no hectic pacing.`;
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

  return SYMBOLIC_PROMPT_PATTERN.test(haystack) ? 'symbolic' : 'material';
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
  const mode = detectStoryPromptMode(userPrompt, { sourcePrompt: userPrompt, preset });
  const modeLabel = getStoryPromptModeLabel(mode, language);
  const referenceStyleBlock = getStoryReferenceStyleBlock(mode, language);
  const dualTrackBlock = getStoryDualTrackBlock(mode, language);
  const directionBlock = getStoryDirectionBlock(mode, language);
  const presetBlock = preset && preset.id !== 'neutral'
    ? buildPresetStoryboardInstruction(preset, arcMode)
    : language === 'de'
      ? 'Wenn kein Preset gewaehlt ist, halte den Look kohaerent, aber offen fuer mutigere Wendungen, taktile Reaktionen, seltsame Details und szenenspezifische Eskalation. Bevorzuge pro Szene ein dominantes Motiv, einen klaren Bewegungs-Payoff und ein loopfaehiges Endbild.'
      : 'If no preset is selected, keep the look cohesive but open to bolder turns, tactile reactions, odd details, and scene-specific escalation. Favor one dominant motif per scene, one clear motion payoff, and a loop-ready end image.';
  const arcInstruction = buildStoryArcInstruction(arcMode, language);
  const beatInstruction = buildStoryBeatInstruction(language);
  const masterAddition = getStoryEngineMasterAddition(arcMode);
  const targetFeelDescription = language === 'de'
    ? (mode === 'graffiti'
      ? 'Die Sequenz darf muralhaft, sonnenverbrannt, deadpan, surreal, leicht verspielt, taktil, grafisch praezise und stark wiederanschaubar wirken, nicht wie ein realistisches Street-Foto, ein glossy Marken-Maskottchen oder chaotischer Tagging-Layer.'
      : mode === 'symbolic'
        ? 'Die Sequenz soll hypnotisch, ruhig, raeumlich, signalhaft, grafisch praezise und sofort lesbar wirken, nicht wie fantasyhafte Lore-Illustration, ueberladenes HUD-Design oder beliebiger Techno-Kitsch.'
      : 'Die Sequenz soll hypnotisch, erwachsen, experimentell, taktil, streng, filmisch, ikonisch und wiederanschaubar wirken, nicht kindlich, verspielt oder dekorativ.')
    : (mode === 'graffiti'
      ? 'The sequence may feel mural-driven, sun-baked, deadpan, surreal, slightly playful, tactile, graphically precise, and highly rewatchable rather than like a realistic street photo, glossy brand mascot world, or chaotic tagging cloud.'
      : mode === 'symbolic'
        ? 'The sequence should feel hypnotic, calm, spacious, signal-led, graphically precise, and immediately legible rather than like fantasy lore illustration, overloaded HUD clutter, or generic techno kitsch.'
      : 'The sequence should feel hypnotic, adult, experimental, tactile, controlled, cinematic, iconic, and easy to rewatch rather than cute, playful, or merely decorative.');

  if (language === 'de') {
    return `Du bist ein KI-Videoregisseur und Storyboard-Kuenstler.
Erstelle aus einer kurzen Idee eine Sequenz aus genau 4 Szenen fuer ein Text-zu-Video-Modell.

PFLICHTREGELN:
1. Erzeuge einen klaren Bogen ueber 4 Szenen: Auftauchen, Zuspitzung, Verwandlung, Nachbild.
2. Entwerfe jede Szene als sofort lesbaren Hero-Moment: ein dominantes Motiv oder Ereignis, ein klarer Bewegungs-Payoff und eine Komposition, die im ersten Frame haften bleibt.
3. Nutze erkennbare Bewegung und Uebergaenge. Erlaube Kontraste zwischen Ruhe und Entladung, taktile Kettenreaktionen, strange Reveals und markante Kameraakzente, solange alles gut lesbar bleibt und in ein loopfaehiges Endbild oder Nachbild fuehrt.
4. Nutze das gewaehlte Preset als primaeren Stimmungsanker, nicht als starre Schablone.
5. Kein Strobo, kein schnelles Blinken, keine sehr schnellen Rotationen, keine nervoesen Motive, Muster, Farben, Formen oder Lichter, keine Hektik.
6. ${targetFeelDescription}
7. Suche nach ausgefallenen, aber klar lesbaren Bildern: seltsame Maschinenverhalten, atmosphaerische Ritualmomente, elegante Fehlfunktionen, unerwartete Materialwechsel, harte Nachbilder und absurde aber stimmige Mini-Ereignisse.
8. Jede gifSpecification soll kurz, produktionsnah und direkt verwendbar sein, idealerweise ein Satz oder zwei kurze Halbsatze, etwa 18 bis 48 Woerter. Nenne zuerst das dominante Motiv und dann den charakteristischen Bewegungs- oder Transformationsmoment.
9. Keine Feldnamen, Presetnamen oder Labels wie ACTION, MOTION oder CONTINUITY in gifSpecification.

AKTUELLE MODUS-ENTSCHEIDUNG:
- Dieser Prompt soll aktuell als ${modeLabel} behandelt werden.

${arcInstruction}

${beatInstruction}

${referenceStyleBlock}

${dualTrackBlock}

${directionBlock}

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
3. MEASURED MOTION WITH PAYOFF: Include clear scene-to-scene transitions and subject movement. Allow contrast between stillness and release, tactile chain reactions, strange reveals, and bolder camera punctuation as long as pacing stays readable and each scene resolves into a loop-ready end pose or afterimage.
4. VISUAL STYLE: Treat the selected preset as the primary mood anchor, but allow scene-specific interpretation as long as the sequence stays cohesive.
5. VISUAL SAFETY: No strobe lights, no rapidly blinking lights, no very fast rotating objects, no nervous motifs, movements, patterns, colors, shapes, or lights, and no hectic pacing.
6. TARGET FEEL: ${targetFeelDescription}
7. ORIGINALITY: Favor standout images, elegant malfunctions, ritual beats, weird material behavior, and memorable visual hooks over safe repetition.
8. PROMPT DISCIPLINE: Each gifSpecification must be a short, punchy, production-ready prompt, ideally one sentence or two short clauses, roughly 18 to 48 words. Name the dominant subject first, then the signature action or transformation.
9. Do not put labels such as SCENE ACTION, MOTION, CONTINUITY, or preset names inside gifSpecification.

CURRENT MODE DECISION:
- Treat this request primarily as a ${modeLabel}.

${arcInstruction}

${beatInstruction}

${referenceStyleBlock}

${dualTrackBlock}

${directionBlock}

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