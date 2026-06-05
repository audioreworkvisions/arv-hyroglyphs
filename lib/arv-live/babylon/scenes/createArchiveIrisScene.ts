import {
  ArcRotateCamera,
  Color3,
  Color4,
  Constants,
  GlowLayer,
  HemisphericLight,
  Material,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { AudioReactiveSnapshot } from '../../AudioReactiveUniforms';
import type { RitualPhaseState } from '../../RitualPhaseController';
import type { ARVLiveVisualPreset, ARVQualitySettings } from '../../presets';
import {
  createDefaultARVLiveLayerState,
  createEmptyARVLiveMixState,
  type ARVLayerBlendMode,
  type ARVLayerSchema,
  type ARVLiveLayerState,
  type ARVLiveMixState,
  type ARVReactionKind,
  type ARVVisualImpulse,
} from '../../types';

export interface ArchiveIrisSceneController {
  camera: ArcRotateCamera;
  applyVisualImpulse: (impulse: ARVVisualImpulse, reaction?: ARVReactionKind | null) => void;
  applyMixState: (mix: ARVLiveMixState) => void;
  setStandby: (phase: RitualPhaseState) => void;
  update: (
    deltaSeconds: number,
    timeSeconds: number,
    audio: AudioReactiveSnapshot,
    phase: RitualPhaseState,
  ) => void;
  dispose: () => void;
}

interface CreateArchiveIrisSceneOptions {
  scene: Scene;
  quality: ARVQualitySettings;
  preset: ARVLiveVisualPreset;
}

interface WellEntry {
  root: TransformNode;
  halo: Mesh;
  rim: Mesh;
  well: Mesh;
  haloMaterial: StandardMaterial;
  rimMaterial: StandardMaterial;
  wellMaterial: StandardMaterial;
  basePosition: Vector3;
  baseScale: number;
  ellipseX: number;
  ellipseY: number;
  rotationBias: number;
}

interface BladeEntry {
  root: TransformNode;
  main: Mesh;
  warmGhost: Mesh;
  coolGhost: Mesh;
  mainMaterial: StandardMaterial;
  warmGhostMaterial: StandardMaterial;
  coolGhostMaterial: StandardMaterial;
  basePosition: Vector3;
  baseAngle: number;
  foldBias: number;
  skew: number;
  driftPhase: number;
}

interface CoreEntry {
  mesh: Mesh;
  material: StandardMaterial;
  baseRotationZ: number;
  baseScaleX: number;
  baseScaleY: number;
}

const createLayerState = (
  controls: ARVLiveLayerState['controls'],
  overrides: Partial<Omit<ARVLiveLayerState, 'controls'>> = {},
): ARVLiveLayerState => {
  return {
    ...createDefaultARVLiveLayerState(),
    ...overrides,
    controls,
  };
};

const CAMERA_MODE_OPTIONS = [
  { value: 'locked', label: 'Locked' },
  { value: 'slowPush', label: 'Slow Push' },
  { value: 'slowOrbit', label: 'Slow Orbit' },
  { value: 'handheldFake', label: 'Handheld Fake' },
] as const;

export const ARCHIVE_IRIS_LAYER_SCHEMA: ARVLayerSchema[] = [
  {
    id: 'outerWells',
    label: 'Eclipse Wells',
    controls: [
      {
        key: 'size',
        label: 'Well Size',
        type: 'slider',
        target: 'controls',
        min: 0.4,
        max: 1.8,
        step: 0.01,
        defaultValue: 1,
      },
      {
        key: 'drift',
        label: 'Well Drift',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 1.5,
        step: 0.01,
        defaultValue: 0.42,
      },
    ],
  },
  {
    id: 'irisBlades',
    label: 'Iris Plates',
    controls: [
      {
        key: 'fold',
        label: 'Fold',
        type: 'slider',
        target: 'controls',
        min: 0.4,
        max: 1.8,
        step: 0.01,
        defaultValue: 1,
      },
      {
        key: 'rotationSpeed',
        label: 'Rotation',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 0.52,
      },
      {
        key: 'parallax',
        label: 'RGB Split',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 1.5,
        step: 0.01,
        defaultValue: 0.42,
      },
    ],
  },
  {
    id: 'centerStar',
    label: 'Graphite Core',
    controls: [
      {
        key: 'density',
        label: 'Density',
        type: 'slider',
        target: 'controls',
        min: 0.4,
        max: 1.8,
        step: 0.01,
        defaultValue: 1,
      },
      {
        key: 'pulse',
        label: 'Pulse',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 0.72,
      },
    ],
  },
  {
    id: 'xeroxHaze',
    label: 'Xerox Haze',
    controls: [
      {
        key: 'bloom',
        label: 'Bloom',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 0.84,
      },
      {
        key: 'drift',
        label: 'Drift',
        type: 'slider',
        target: 'controls',
        min: 0,
        max: 1.5,
        step: 0.01,
        defaultValue: 0.36,
      },
    ],
  },
  {
    id: 'postFx',
    label: 'Post FX',
    kind: 'postFx',
    controls: [
      { key: 'bloom', label: 'Bloom', type: 'slider', target: 'postFx', min: 0, max: 2, step: 0.01, defaultValue: 0.58 },
      { key: 'scanlines', label: 'Scanlines', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.12 },
      { key: 'rgbSplit', label: 'RGB Split', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.14 },
      { key: 'noise', label: 'Noise', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.18 },
      { key: 'vignette', label: 'Vignette', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.48 },
    ],
  },
  {
    id: 'camera',
    label: 'Camera',
    kind: 'camera',
    controls: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        target: 'camera',
        defaultValue: 'locked',
        options: CAMERA_MODE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
      },
      {
        key: 'zoom',
        label: 'Zoom',
        type: 'slider',
        target: 'camera',
        min: 0.4,
        max: 2,
        step: 0.01,
        defaultValue: 1,
      },
      {
        key: 'orbitSpeed',
        label: 'Orbit Speed',
        type: 'slider',
        target: 'camera',
        min: 0,
        max: 1.5,
        step: 0.01,
        defaultValue: 0.18,
      },
      {
        key: 'shake',
        label: 'Shake',
        type: 'slider',
        target: 'camera',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.02,
      },
    ],
  },
];

export const createArchiveIrisDefaultMixState = (presetId: string): ARVLiveMixState => {
  return {
    presetId,
    layers: {
      outerWells: createLayerState({ size: 1, drift: 0.26 }, { audioReactive: false }),
      irisBlades: createLayerState({ fold: 0.94, rotationSpeed: 0.44, parallax: 0.26 }, { audioReactive: true, blendMode: 'screen' }),
      centerStar: createLayerState({ density: 1, pulse: 0.58 }, { audioReactive: true, blendMode: 'add' }),
      xeroxHaze: createLayerState({ bloom: 0.52, drift: 0.24 }, { audioReactive: false, blendMode: 'screen' }),
    },
    postFx: {
      bloom: 0.34,
      scanlines: 0.05,
      rgbSplit: 0.08,
      vignette: 0.56,
      noise: 0.12,
    },
    camera: {
      mode: 'locked',
      zoom: 1,
      orbitSpeed: 0.18,
      shake: 0.01,
    },
  };
};

const clamp = (value: number, min = 0, max = 1.6): number => {
  return Math.min(max, Math.max(min, value));
};

const getLayerState = (mix: ARVLiveMixState, layerId: string) => {
  return mix.layers[layerId] ?? createDefaultARVLiveLayerState();
};

const getLayerControlNumber = (
  mix: ARVLiveMixState,
  layerId: string,
  controlId: string,
  fallback: number,
): number => {
  const value = mix.layers[layerId]?.controls[controlId];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const resolveBlendModeAlphaMode = (blendMode: ARVLayerBlendMode): number => {
  switch (blendMode) {
    case 'add':
      return Constants.ALPHA_ADD;
    case 'multiply':
      return Constants.ALPHA_MULTIPLY;
    case 'screen':
      return Constants.ALPHA_SCREENMODE;
    default:
      return Constants.ALPHA_COMBINE;
  }
};

const applyMaterialBlendMode = (
  blendMode: ARVLayerBlendMode,
  materials: Array<Material | null | undefined>,
): void => {
  const alphaMode = resolveBlendModeAlphaMode(blendMode);
  materials.forEach((material) => {
    if (!material) {
      return;
    }

    material.alphaMode = alphaMode;
  });
};

const createSurfaceMaterial = (
  scene: Scene,
  name: string,
  diffuse: Color3,
  emissive: Color3,
  alpha: number,
  disableLighting = false,
): StandardMaterial => {
  const material = new StandardMaterial(name, scene);
  material.backFaceCulling = false;
  material.disableLighting = disableLighting;
  material.diffuseColor = diffuse;
  material.emissiveColor = emissive;
  material.specularColor = Color3.Black();
  material.alpha = alpha;
  return material;
};

export function createArchiveIrisScene({
  scene,
  quality,
  preset,
}: CreateArchiveIrisSceneOptions): ArchiveIrisSceneController {
  const backgroundColor = Color3.FromHexString(preset.backgroundHex);
  const fogColor = Color3.FromHexString(preset.fogHex);
  const portalColor = Color3.FromHexString(preset.portalHex);
  const accentColor = Color3.FromHexString(preset.accentHex);
  const titleColor = Color3.FromHexString(preset.titleHex);

  scene.clearColor = new Color4(backgroundColor.r, backgroundColor.g, backgroundColor.b, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.04;
  scene.fogColor = fogColor;

  const root = new TransformNode('arv-archive-iris-root', scene);
  const baseCameraAlpha = Math.PI / 2;
  const baseCameraBeta = Math.PI / 2.18;
  const baseCameraRadius = quality.cameraRadius * 0.82;
  const baseCameraTarget = Vector3.Zero();

  const camera = new ArcRotateCamera(
    'arv-archive-iris-camera',
    baseCameraAlpha,
    baseCameraBeta,
    baseCameraRadius,
    baseCameraTarget.clone(),
    scene,
  );
  camera.inputs.clear();
  camera.fov = 0.88;
  camera.lowerRadiusLimit = baseCameraRadius * 0.72;
  camera.upperRadiusLimit = baseCameraRadius * 1.18;
  camera.lowerBetaLimit = baseCameraBeta - 0.12;
  camera.upperBetaLimit = baseCameraBeta + 0.12;
  camera.minZ = 0.1;
  camera.maxZ = 42;
  scene.activeCamera = camera;

  const ambientLight = new HemisphericLight('arv-archive-iris-hemi', new Vector3(0, 1, 0), scene);
  ambientLight.intensity = 0.72;
  ambientLight.groundColor = backgroundColor.scale(0.18);

  const coolLight = new PointLight('arv-archive-iris-cool', new Vector3(0, 0.15, 3.8), scene);
  coolLight.diffuse = titleColor;
  coolLight.intensity = 1.18;

  const warmLight = new PointLight('arv-archive-iris-warm', new Vector3(-3.4, -0.2, 2.1), scene);
  warmLight.diffuse = accentColor;
  warmLight.intensity = 0.52;

  const sideLight = new PointLight('arv-archive-iris-side', new Vector3(3.2, 0.5, 1.6), scene);
  sideLight.diffuse = portalColor;
  sideLight.intensity = 0.44;

  const glow = new GlowLayer('arv-archive-iris-glow', scene, {
    mainTextureRatio: quality.tier === 'eco' ? 0.5 : 0.7,
    blurKernelSize: quality.tier === 'obs' ? 40 : 28,
    mainTextureSamples: quality.tier === 'obs' ? 4 : 1,
  });
  glow.intensity = quality.enableBloom ? 0.24 : 0;

  const backdrop = MeshBuilder.CreatePlane(
    'arv-archive-iris-backdrop',
    { width: 13.2, height: 7.8, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  backdrop.parent = root;
  backdrop.position.z = -3.2;
  const backdropMaterial = createSurfaceMaterial(
    scene,
    'arv-archive-iris-backdrop-material',
    backgroundColor.scale(0.92),
    fogColor.scale(0.42),
    0.96,
    true,
  );
  backdrop.material = backdropMaterial;

  const wellAnchors = [
    new Vector3(-4.9, -2.36, 0.28),
    new Vector3(-5.05, 0, 0.14),
    new Vector3(-4.88, 2.34, 0.28),
    new Vector3(-2.86, 3.02, 0.08),
    new Vector3(2.86, 3.02, 0.08),
    new Vector3(4.88, 2.34, 0.28),
    new Vector3(5.05, 0, 0.14),
    new Vector3(4.9, -2.36, 0.28),
  ];

  const wellEntries: WellEntry[] = wellAnchors.map((anchor, index) => {
    const node = new TransformNode(`arv-archive-iris-well-root-${index}`, scene);
    node.parent = root;
    node.position.copyFrom(anchor);

    const halo = MeshBuilder.CreateDisc(
      `arv-archive-iris-well-halo-${index}`,
      { radius: 1.02, tessellation: 96, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    halo.parent = node;
    halo.position.z = -0.02;
    const haloMaterial = createSurfaceMaterial(
      scene,
      `arv-archive-iris-well-halo-material-${index}`,
      titleColor.scale(0.34),
      titleColor.scale(0.18),
      0.14,
      true,
    );
    halo.material = haloMaterial;

    const rim = MeshBuilder.CreateDisc(
      `arv-archive-iris-well-rim-${index}`,
      { radius: 0.95, tessellation: 96, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    rim.parent = node;
    const rimMaterial = createSurfaceMaterial(
      scene,
      `arv-archive-iris-well-rim-material-${index}`,
      titleColor.scale(0.82),
      titleColor.scale(0.52),
      0.72,
      true,
    );
    rim.material = rimMaterial;

    const well = MeshBuilder.CreateDisc(
      `arv-archive-iris-well-core-${index}`,
      { radius: 0.78, tessellation: 96, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    well.parent = node;
    well.position.z = 0.04;
    const wellMaterial = createSurfaceMaterial(
      scene,
      `arv-archive-iris-well-core-material-${index}`,
      backgroundColor.scale(0.1),
      backgroundColor.scale(0.04),
      0.98,
      true,
    );
    well.material = wellMaterial;

    return {
      root: node,
      halo,
      rim,
      well,
      haloMaterial,
      rimMaterial,
      wellMaterial,
      basePosition: anchor.clone(),
      baseScale: index % 2 === 0 ? 1 : 0.92,
      ellipseX: 1.18 + (index % 2 === 0 ? 0.04 : 0),
      ellipseY: 0.82 - (index % 3) * 0.04,
      rotationBias: index % 2 === 0 ? 0.12 : -0.08,
    };
  });

  const irisRoot = new TransformNode('arv-archive-iris-blades-root', scene);
  irisRoot.parent = root;

  const bladeEntries: BladeEntry[] = Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2;
    const basePosition = new Vector3(Math.cos(angle) * 1.88, Math.sin(angle) * 0.96, 0.14 + (index % 3) * 0.02);
    const foldBias = [-0.1, -0.04, 0.03, 0.08][index % 4];
    const skew = Math.sin(angle * 2) * 0.18;
    const driftPhase = index * 0.37 + (index % 2 === 0 ? 0.12 : -0.08);
    const node = new TransformNode(`arv-archive-iris-blade-root-${index}`, scene);
    node.parent = irisRoot;
    node.position.copyFrom(basePosition);
    node.rotation.z = angle + Math.PI / 2;

    const main = MeshBuilder.CreatePlane(
      `arv-archive-iris-main-blade-${index}`,
      { width: 1.26, height: 4.92, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    main.parent = node;
    const mainMaterial = createSurfaceMaterial(
      scene,
      `arv-archive-iris-main-blade-material-${index}`,
      titleColor.scale(0.54),
      titleColor.scale(0.34),
      0.54,
    );
    main.material = mainMaterial;

    const warmGhost = MeshBuilder.CreatePlane(
      `arv-archive-iris-warm-blade-${index}`,
      { width: 1.18, height: 4.8, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    warmGhost.parent = node;
    warmGhost.position.set(-0.09, 0.03, -0.04);
    const warmGhostMaterial = createSurfaceMaterial(
      scene,
      `arv-archive-iris-warm-blade-material-${index}`,
      accentColor.scale(0.34),
      accentColor.scale(0.24),
      0.09,
    );
    warmGhost.material = warmGhostMaterial;

    const coolGhost = MeshBuilder.CreatePlane(
      `arv-archive-iris-cool-blade-${index}`,
      { width: 1.18, height: 4.8, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    coolGhost.parent = node;
    coolGhost.position.set(0.09, -0.03, -0.05);
    const coolGhostMaterial = createSurfaceMaterial(
      scene,
      `arv-archive-iris-cool-blade-material-${index}`,
      portalColor.scale(0.3),
      portalColor.scale(0.2),
      0.1,
    );
    coolGhost.material = coolGhostMaterial;

    return {
      root: node,
      main,
      warmGhost,
      coolGhost,
      mainMaterial,
      warmGhostMaterial,
      coolGhostMaterial,
      basePosition,
      baseAngle: angle,
      foldBias,
      skew,
      driftPhase,
    };
  });

  const coreRoot = new TransformNode('arv-archive-iris-core-root', scene);
  coreRoot.parent = root;

  const coreEntries: CoreEntry[] = Array.from({ length: 6 }, (_, index) => {
    const triangle = MeshBuilder.CreateDisc(
      `arv-archive-iris-core-triangle-${index}`,
      { radius: 1.22 - index * 0.08, tessellation: 3, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    triangle.parent = coreRoot;
    triangle.position.z = 0.18 + index * 0.02;
    triangle.scaling.set(1.82 - index * 0.12, 0.62 + index * 0.04, 1);
    triangle.rotation.z = index * (Math.PI / 3);
    const triangleMaterial = createSurfaceMaterial(
      scene,
      `arv-archive-iris-core-triangle-material-${index}`,
      index % 2 === 0 ? titleColor.scale(0.42) : new Color3(0.56, 0.56, 0.58),
      index % 2 === 0 ? titleColor.scale(0.22) : new Color3(0.24, 0.24, 0.26),
      0.42,
    );
    triangle.material = triangleMaterial;

    return {
      mesh: triangle,
      material: triangleMaterial,
      baseRotationZ: triangle.rotation.z,
      baseScaleX: triangle.scaling.x,
      baseScaleY: triangle.scaling.y,
    };
  });

  const coreHalo = MeshBuilder.CreateDisc(
    'arv-archive-iris-core-halo',
    { radius: 1.08, tessellation: 96, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  coreHalo.parent = coreRoot;
  coreHalo.position.z = 0.08;
  const coreHaloMaterial = createSurfaceMaterial(
    scene,
    'arv-archive-iris-core-halo-material',
    titleColor.scale(0.34),
    titleColor.scale(0.22),
    0.2,
    true,
  );
  coreHalo.material = coreHaloMaterial;

  const coreDisc = MeshBuilder.CreateDisc(
    'arv-archive-iris-core-disc',
    { radius: 0.66, tessellation: 96, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  coreDisc.parent = coreRoot;
  coreDisc.position.z = 0.34;
  const coreDiscMaterial = createSurfaceMaterial(
    scene,
    'arv-archive-iris-core-disc-material',
    backgroundColor.scale(0.08),
    backgroundColor.scale(0.04),
    0.98,
    true,
  );
  coreDisc.material = coreDiscMaterial;

  const xeroxHazeOuter = MeshBuilder.CreateDisc(
    'arv-archive-iris-haze-outer',
    { radius: 4.34, tessellation: 96, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  xeroxHazeOuter.parent = root;
  xeroxHazeOuter.position.z = -0.28;
  const xeroxHazeOuterMaterial = createSurfaceMaterial(
    scene,
    'arv-archive-iris-haze-outer-material',
    new Color3(0.62, 0.62, 0.64),
    titleColor.scale(0.14),
    0.04,
    true,
  );
  xeroxHazeOuter.material = xeroxHazeOuterMaterial;

  const xeroxHazeInner = MeshBuilder.CreateDisc(
    'arv-archive-iris-haze-inner',
    { radius: 2.62, tessellation: 96, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  xeroxHazeInner.parent = root;
  xeroxHazeInner.position.z = 0.46;
  const xeroxHazeInnerMaterial = createSurfaceMaterial(
    scene,
    'arv-archive-iris-haze-inner-material',
    titleColor.scale(0.44),
    titleColor.scale(0.18),
    0.07,
    true,
  );
  xeroxHazeInner.material = xeroxHazeInnerMaterial;

  let activeMix = createEmptyARVLiveMixState(preset.id);
  let pulseEnergy = 0;
  let fireEnergy = 0;
  let acidEnergy = 0;
  let darkEnergy = 0;
  let technoEnergy = 0;

  const applyMixState = (mix: ARVLiveMixState) => {
    activeMix = mix;

    const wellsLayer = getLayerState(activeMix, 'outerWells');
    const bladesLayer = getLayerState(activeMix, 'irisBlades');
    const coreLayer = getLayerState(activeMix, 'centerStar');
    const hazeLayer = getLayerState(activeMix, 'xeroxHaze');

    const wellsVisible = wellsLayer.enabled && wellsLayer.opacity > 0.001;
    wellEntries.forEach((entry) => {
      entry.halo.setEnabled(wellsVisible);
      entry.rim.setEnabled(wellsVisible);
      entry.well.setEnabled(wellsVisible);
      entry.haloMaterial.alpha = wellsVisible ? 0.14 * wellsLayer.opacity : 0;
      entry.rimMaterial.alpha = wellsVisible ? 0.72 * wellsLayer.opacity : 0;
      entry.wellMaterial.alpha = wellsVisible ? 0.98 * wellsLayer.opacity : 0;
      applyMaterialBlendMode(wellsLayer.blendMode, [entry.haloMaterial, entry.rimMaterial, entry.wellMaterial]);
    });

    const bladesVisible = bladesLayer.enabled && bladesLayer.opacity > 0.001;
    bladeEntries.forEach((entry) => {
      entry.main.setEnabled(bladesVisible);
      entry.warmGhost.setEnabled(bladesVisible);
      entry.coolGhost.setEnabled(bladesVisible);
      entry.mainMaterial.alpha = bladesVisible ? 0.54 * bladesLayer.opacity : 0;
      entry.warmGhostMaterial.alpha = bladesVisible ? 0.09 * bladesLayer.opacity : 0;
      entry.coolGhostMaterial.alpha = bladesVisible ? 0.1 * bladesLayer.opacity : 0;
      applyMaterialBlendMode(bladesLayer.blendMode, [entry.mainMaterial, entry.warmGhostMaterial, entry.coolGhostMaterial]);
    });

    const coreVisible = coreLayer.enabled && coreLayer.opacity > 0.001;
    coreEntries.forEach((entry) => {
      entry.mesh.setEnabled(coreVisible);
      entry.material.alpha = coreVisible ? 0.42 * coreLayer.opacity : 0;
      applyMaterialBlendMode(coreLayer.blendMode, [entry.material]);
    });
    coreHalo.setEnabled(coreVisible);
    coreDisc.setEnabled(coreVisible);
    coreHaloMaterial.alpha = coreVisible ? 0.2 * coreLayer.opacity : 0;
    coreDiscMaterial.alpha = coreVisible ? 0.98 * coreLayer.opacity : 0;
    applyMaterialBlendMode(coreLayer.blendMode, [coreHaloMaterial, coreDiscMaterial]);

    const hazeVisible = hazeLayer.enabled && hazeLayer.opacity > 0.001;
    xeroxHazeOuter.setEnabled(hazeVisible);
    xeroxHazeInner.setEnabled(hazeVisible);
    xeroxHazeOuterMaterial.alpha = hazeVisible ? 0.04 * hazeLayer.opacity : 0;
    xeroxHazeInnerMaterial.alpha = hazeVisible ? 0.07 * hazeLayer.opacity : 0;
    applyMaterialBlendMode(hazeLayer.blendMode, [xeroxHazeOuterMaterial, xeroxHazeInnerMaterial]);

    backdropMaterial.alpha = 0.88 + activeMix.postFx.vignette * 0.12;
    camera.radius = Math.min(
      camera.upperRadiusLimit ?? Number.POSITIVE_INFINITY,
      Math.max(camera.lowerRadiusLimit ?? 0.1, baseCameraRadius / Math.max(0.4, activeMix.camera.zoom)),
    );
  };

  const boostReaction = (reaction: ARVReactionKind | null | undefined, intensity: number) => {
    switch (reaction) {
      case 'fire':
        fireEnergy = clamp(fireEnergy + intensity, 0, 1.2);
        break;
      case 'acid':
        acidEnergy = clamp(acidEnergy + intensity, 0, 1.2);
        break;
      case 'dark':
        darkEnergy = clamp(darkEnergy + intensity, 0, 1.3);
        break;
      case 'peace-love-techno':
        technoEnergy = clamp(technoEnergy + intensity, 0, 1.24);
        break;
      default:
        pulseEnergy = clamp(pulseEnergy + intensity, 0, 1.28);
        break;
    }
  };

  const applyVisualImpulse = (impulse: ARVVisualImpulse, reaction?: ARVReactionKind | null) => {
    pulseEnergy = clamp(pulseEnergy + impulse.intensity * 0.42, 0, 1.3);
    technoEnergy = clamp(technoEnergy + impulse.sparkle * 0.14, 0, 1.3);
    boostReaction(reaction ?? null, impulse.intensity);
  };

  const setStandby = (phase: RitualPhaseState) => {
    const standbyColor = Color3.FromHexString(phase.accentHex);
    ambientLight.intensity = 0.28;
    coolLight.intensity = 0.34;
    warmLight.intensity = 0.16;
    sideLight.intensity = 0.14;
    glow.intensity = quality.enableBloom ? 0.12 : 0;
    backdropMaterial.emissiveColor = standbyColor.scale(0.06);
    coreHaloMaterial.emissiveColor = standbyColor.scale(0.12);
    xeroxHazeInnerMaterial.emissiveColor = standbyColor.scale(0.08);
  };

  const update = (
    deltaSeconds: number,
    timeSeconds: number,
    audio: AudioReactiveSnapshot,
    phase: RitualPhaseState,
  ) => {
    pulseEnergy *= Math.pow(0.12, deltaSeconds);
    fireEnergy *= Math.pow(0.16, deltaSeconds);
    acidEnergy *= Math.pow(0.18, deltaSeconds);
    darkEnergy *= Math.pow(0.2, deltaSeconds);
    technoEnergy *= Math.pow(0.18, deltaSeconds);

    const wellsLayer = getLayerState(activeMix, 'outerWells');
    const bladesLayer = getLayerState(activeMix, 'irisBlades');
    const coreLayer = getLayerState(activeMix, 'centerStar');
    const hazeLayer = getLayerState(activeMix, 'xeroxHaze');

    const wellSize = getLayerControlNumber(activeMix, 'outerWells', 'size', 1);
    const wellDrift = getLayerControlNumber(activeMix, 'outerWells', 'drift', 0.42);
    const bladeFold = getLayerControlNumber(activeMix, 'irisBlades', 'fold', 1);
    const bladeRotationSpeed = getLayerControlNumber(activeMix, 'irisBlades', 'rotationSpeed', 0.52);
    const bladeParallax = getLayerControlNumber(activeMix, 'irisBlades', 'parallax', 0.42);
    const coreDensity = getLayerControlNumber(activeMix, 'centerStar', 'density', 1);
    const corePulse = getLayerControlNumber(activeMix, 'centerStar', 'pulse', 0.72);
    const hazeBloom = getLayerControlNumber(activeMix, 'xeroxHaze', 'bloom', 0.84);
    const hazeDrift = getLayerControlNumber(activeMix, 'xeroxHaze', 'drift', 0.36);

    const beat = Math.max(audio.kick, audio.bass * 0.78, pulseEnergy * 0.66);
    const shimmer = audio.high * 0.58 + acidEnergy * 0.34 + activeMix.postFx.rgbSplit * 0.18;
    const soot = darkEnergy * 0.4 + activeMix.postFx.vignette * 0.28;
    const warmBurn = fireEnergy * 0.58 + phase.bloomBoost * 0.24;
    const technoLift = technoEnergy * 0.42 + phase.portalMultiplier * 0.08;

    ambientLight.intensity = 0.42 + phase.energy * 0.18 + audio.rms * 0.16 - soot * 0.12;
    coolLight.intensity = 0.86 + beat * 0.38 + technoLift * 0.32;
    warmLight.intensity = 0.22 + warmBurn * 0.44;
    sideLight.intensity = 0.18 + shimmer * 0.3;
    glow.intensity = quality.enableBloom
      ? 0.08 + activeMix.postFx.bloom * 0.16 + hazeBloom * 0.04 + beat * 0.05
      : 0;

    backdropMaterial.emissiveColor = Color3.Lerp(
      backdropMaterial.emissiveColor,
      fogColor.scale(0.42 + activeMix.postFx.scanlines * 0.08 + technoLift * 0.06),
      0.08,
    );
    backdropMaterial.alpha = 0.78 + activeMix.postFx.vignette * 0.18 + darkEnergy * 0.04;

    wellEntries.forEach((entry, index) => {
      const driftPhase = timeSeconds * 0.22 + index * 0.72;
      const driftX = Math.cos(driftPhase) * 0.06 * wellDrift;
      const driftY = Math.sin(driftPhase * 0.92) * 0.06 * wellDrift;
      const scale = entry.baseScale * wellSize * (1 + beat * 0.05 + phase.energy * 0.03 - fireEnergy * 0.02);

      entry.root.position.x = entry.basePosition.x + driftX;
      entry.root.position.y = entry.basePosition.y + driftY;
      entry.root.scaling.set(scale * entry.ellipseX, scale * entry.ellipseY, 1);
      entry.root.rotation.z = entry.rotationBias + Math.sin(driftPhase * 0.48) * 0.024;

      entry.haloMaterial.emissiveColor = Color3.Lerp(
        entry.haloMaterial.emissiveColor,
        titleColor.scale(0.08 + technoLift * 0.05 + activeMix.postFx.bloom * 0.03),
        0.12,
      );
      entry.rimMaterial.emissiveColor = Color3.Lerp(
        entry.rimMaterial.emissiveColor,
        titleColor.scale(0.38 + beat * 0.06 + phase.energy * 0.03),
        0.12,
      );
      entry.wellMaterial.emissiveColor = Color3.Lerp(
        entry.wellMaterial.emissiveColor,
        backgroundColor.scale(0.03 + darkEnergy * 0.04),
        0.12,
      );
      entry.haloMaterial.alpha = wellsLayer.enabled
        ? (0.08 + activeMix.postFx.bloom * 0.06 + audio.high * 0.03) * wellsLayer.opacity
        : 0;
    });

    bladeEntries.forEach((entry, index) => {
      const drift = Math.sin(timeSeconds * 0.28 + entry.driftPhase) * 0.03 * bladeParallax;
      const fold = 0.86 + bladeFold * 0.22 + beat * 0.04 + technoLift * 0.03 - darkEnergy * 0.06;
      const parallax = (activeMix.postFx.rgbSplit * 0.12 + shimmer * 0.08) * (index % 2 === 0 ? 1 : -1);
      const asymmetry = entry.foldBias + Math.sin(timeSeconds * 0.19 + entry.driftPhase) * 0.04 * bladeParallax;
      const foldX = fold * (1 + asymmetry * 0.32);
      const foldY = (0.9 + bladeFold * 0.14) * (1 - asymmetry * 0.18);

      entry.root.position.x = entry.basePosition.x * foldX + drift + entry.skew * 0.12 * (0.4 + acidEnergy * 0.4);
      entry.root.position.y = entry.basePosition.y * foldY - drift * 0.34 + entry.skew * 0.04;
      entry.root.rotation.z = entry.baseAngle + Math.PI / 2
        + entry.foldBias * 0.18
        + timeSeconds * (0.018 + bladeRotationSpeed * 0.038) * (index % 2 === 0 ? 1 : -1)
        + acidEnergy * 0.035 * (index % 2 === 0 ? 1 : -1);
      entry.root.scaling.set(1 + beat * 0.03, foldY, 1);

      entry.warmGhost.position.x = -0.06 - parallax * 0.38 + fireEnergy * 0.016 + entry.foldBias * 0.04;
      entry.coolGhost.position.x = 0.06 + parallax * 0.42 - acidEnergy * 0.016 - entry.foldBias * 0.04;

      entry.mainMaterial.emissiveColor = Color3.Lerp(
        entry.mainMaterial.emissiveColor,
        titleColor.scale(0.18 + phase.energy * 0.06 + beat * 0.06),
        0.12,
      );
      entry.warmGhostMaterial.emissiveColor = Color3.Lerp(
        entry.warmGhostMaterial.emissiveColor,
        accentColor.scale(0.08 + warmBurn * 0.08),
        0.12,
      );
      entry.coolGhostMaterial.emissiveColor = Color3.Lerp(
        entry.coolGhostMaterial.emissiveColor,
        portalColor.scale(0.08 + shimmer * 0.08),
        0.12,
      );

      entry.warmGhostMaterial.alpha = bladesLayer.enabled
        ? (0.04 + activeMix.postFx.rgbSplit * 0.1 + fireEnergy * 0.04) * bladesLayer.opacity
        : 0;
      entry.coolGhostMaterial.alpha = bladesLayer.enabled
        ? (0.05 + activeMix.postFx.rgbSplit * 0.12 + acidEnergy * 0.04) * bladesLayer.opacity
        : 0;
    });

    coreEntries.forEach((entry, index) => {
      const pulseScale = 1 + beat * corePulse * 0.08 + technoLift * 0.04 - darkEnergy * 0.03;
      entry.mesh.rotation.z = entry.baseRotationZ + timeSeconds * (0.04 + index * 0.006) * (index % 2 === 0 ? 1 : -1);
      entry.mesh.scaling.x = entry.baseScaleX * coreDensity * pulseScale;
      entry.mesh.scaling.y = entry.baseScaleY * (0.94 + coreDensity * 0.1 + pulseScale * 0.04);
      entry.material.emissiveColor = Color3.Lerp(
        entry.material.emissiveColor,
        index % 2 === 0
          ? titleColor.scale(0.14 + beat * 0.06 + phase.energy * 0.05)
          : new Color3(0.2, 0.2, 0.22).scale(0.44 + technoLift * 0.08),
        0.14,
      );
    });

    coreHalo.scaling.setAll(1 + beat * 0.1 + activeMix.postFx.bloom * 0.06 + hazeBloom * 0.04);
    coreDisc.scaling.setAll(1 - beat * 0.04 + darkEnergy * 0.03);
    coreHaloMaterial.alpha = coreLayer.enabled
      ? (0.08 + activeMix.postFx.bloom * 0.08 + technoLift * 0.04) * coreLayer.opacity
      : 0;
    coreDiscMaterial.emissiveColor = Color3.Lerp(
      coreDiscMaterial.emissiveColor,
      backgroundColor.scale(0.06 + darkEnergy * 0.03),
      0.1,
    );

    xeroxHazeOuter.rotation.z = timeSeconds * 0.03 + hazeDrift * 0.2;
    xeroxHazeInner.rotation.z = -timeSeconds * 0.05 - hazeDrift * 0.28;
    xeroxHazeOuter.scaling.setAll(1 + activeMix.postFx.scanlines * 0.04 + hazeDrift * 0.03);
    xeroxHazeInner.scaling.setAll(1 + beat * 0.03 + hazeBloom * 0.03);
    xeroxHazeOuterMaterial.emissiveColor = Color3.Lerp(
      xeroxHazeOuterMaterial.emissiveColor,
      titleColor.scale(0.03 + hazeBloom * 0.02 + audio.high * 0.01),
      0.1,
    );
    xeroxHazeInnerMaterial.emissiveColor = Color3.Lerp(
      xeroxHazeInnerMaterial.emissiveColor,
      titleColor.scale(0.05 + hazeBloom * 0.04 + beat * 0.02),
      0.1,
    );
    xeroxHazeOuterMaterial.alpha = hazeLayer.enabled
      ? (0.02 + hazeBloom * 0.03 + activeMix.postFx.noise * 0.03) * hazeLayer.opacity
      : 0;
    xeroxHazeInnerMaterial.alpha = hazeLayer.enabled
      ? (0.04 + hazeBloom * 0.04 + activeMix.postFx.bloom * 0.03) * hazeLayer.opacity
      : 0;

    let cameraAlpha = baseCameraAlpha;
    let cameraBeta = baseCameraBeta;
    let cameraRadius = baseCameraRadius / Math.max(0.4, activeMix.camera.zoom);
    const cameraTarget = baseCameraTarget.clone();

    switch (activeMix.camera.mode) {
      case 'slowPush': {
        const pushTime = timeSeconds * (0.16 + activeMix.camera.orbitSpeed * 0.08);
        cameraRadius -= Math.sin(pushTime) * 0.34;
        cameraTarget.z += Math.cos(pushTime * 0.72) * 0.06;
        break;
      }
      case 'slowOrbit': {
        const orbitTime = timeSeconds * (0.08 + activeMix.camera.orbitSpeed * 0.16);
        cameraAlpha += Math.sin(orbitTime) * 0.12;
        cameraBeta += Math.cos(orbitTime * 0.68) * 0.04;
        cameraTarget.y += Math.sin(orbitTime * 0.44) * 0.08;
        break;
      }
      case 'handheldFake': {
        const handheldTime = timeSeconds * (0.34 + activeMix.camera.orbitSpeed * 0.28);
        cameraAlpha += Math.sin(handheldTime * 1.18) * 0.04;
        cameraBeta += Math.cos(handheldTime * 0.96) * 0.03;
        cameraRadius += Math.sin(handheldTime * 0.72) * 0.12;
        cameraTarget.x += Math.sin(handheldTime * 0.88) * 0.05;
        break;
      }
      case 'locked':
      default:
        break;
    }

    const shakeEnvelope = activeMix.camera.shake * (0.004 + beat * 0.014 + activeMix.postFx.noise * 0.01);
    const shakeX = Math.sin(timeSeconds * 10.2) * shakeEnvelope;
    const shakeY = Math.cos(timeSeconds * 8.4) * shakeEnvelope * 0.7;
    camera.alpha = cameraAlpha + shakeX;
    camera.beta = Math.min(
      camera.upperBetaLimit ?? Number.POSITIVE_INFINITY,
      Math.max(camera.lowerBetaLimit ?? 0.1, cameraBeta + shakeY),
    );
    camera.radius = Math.min(
      camera.upperRadiusLimit ?? Number.POSITIVE_INFINITY,
      Math.max(camera.lowerRadiusLimit ?? 0.1, cameraRadius),
    );
    camera.setTarget(cameraTarget.add(new Vector3(shakeX * 0.3, shakeY, 0)));
  };

  const dispose = () => {
    glow.dispose();
    camera.dispose();
    root.getChildMeshes().forEach((mesh) => mesh.dispose(false, true));
    root.dispose();
  };

  return {
    camera,
    applyVisualImpulse,
    applyMixState,
    setStandby,
    update,
    dispose,
  };
}