import {
  ArcRotateCamera,
  Camera,
  Color3,
  Color4,
  DynamicTexture,
  GlowLayer,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { ARVLayerSchema, ARVLiveMixState } from '../../types';
import {
  type ARVAudioFrame,
  type ARVSceneContext,
  type ARVSceneController,
  type ARVVisualEvent,
} from './ARVSceneController';
import {
  applyMaterialBlendMode,
  createCameraSchema,
  createLayerState,
  createPostFxSchema,
  getLayerControlNumber,
  getLayerState,
  setNodeEnabled,
} from './mixHelpers';
import {
  createDefaultControllerPhase,
  createImpulseFromVisualEvent,
  extractPhaseState,
  isStandbyPhaseEvent,
  reactionKindFromVisualEvent,
} from './controllerUtils';

interface MonitorUnit {
  body: Mesh;
  bodyMaterial: StandardMaterial;
  screen: Mesh;
  screenMaterial: StandardMaterial;
  texture: DynamicTexture;
  basePosition: Vector3;
  flickerOffset: number;
  signalSeed: number;
}

interface DustOrb {
  mesh: Mesh;
  material: StandardMaterial;
  basePosition: Vector3;
  drift: number;
}

const clamp = (value: number, min = 0, max = 1.6): number => {
  return Math.min(max, Math.max(min, value));
};

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((entry) => `${entry}${entry}`).join('')
    : normalized;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const createMaterial = (
  scene: Scene,
  name: string,
  diffuseHex: string,
  emissiveHex: string,
  alpha = 1,
): StandardMaterial => {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = Color3.FromHexString(diffuseHex);
  material.emissiveColor = Color3.FromHexString(emissiveHex);
  material.alpha = alpha;
  material.backFaceCulling = false;
  return material;
};

const drawMonitorTexture = (
  texture: DynamicTexture,
  primaryHex: string,
  accentHex: string,
  seed: number,
): void => {
  const ctx = texture.getContext();
  const width = 512;
  const height = 320;
  const baseNoise = (index: number): number => {
    return Math.abs(Math.sin(seed * 0.97 + index * 1.37));
  };

  ctx.fillStyle = '#03110c';
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createLinearGradient(0, 0, width, height);
  glow.addColorStop(0, hexToRgba(primaryHex, 0.18));
  glow.addColorStop(0.6, hexToRgba(accentHex, 0.05));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = hexToRgba(primaryHex, 0.3);
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  for (let index = 0; index < 34; index += 1) {
    const y = 26 + index * 8;
    ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0)';
    ctx.fillRect(18, y, width - 36, 3);
  }

  for (let index = 0; index < 12; index += 1) {
    const noise = baseNoise(index);
    const x = 42 + noise * 280;
    const y = 56 + index * 18;
    const w = 46 + noise * 124;
    ctx.fillStyle = index % 3 === 0 ? hexToRgba(primaryHex, 0.52) : hexToRgba(accentHex, 0.36);
    ctx.fillRect(x, y, w, 7);
  }

  ctx.beginPath();
  ctx.strokeStyle = hexToRgba(accentHex, 0.42);
  ctx.lineWidth = 2;
  for (let index = 0; index <= 24; index += 1) {
    const progress = index / 24;
    const x = 36 + progress * (width - 72);
    const y = height * 0.7 + Math.sin(progress * Math.PI * 4 + seed) * 26;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  ctx.fillStyle = hexToRgba(primaryHex, 0.16);
  ctx.beginPath();
  ctx.arc(width * 0.82, height * 0.26, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(accentHex, 0.3);
  ctx.beginPath();
  ctx.arc(width * 0.82, height * 0.26, 58, 0, Math.PI * 2);
  ctx.stroke();

  texture.update(false);
};

const OPERATOR_ATTIC_POST_FX = {
  bloom: 0.56,
  scanlines: 0.26,
  rgbSplit: 0.18,
  vignette: 0.5,
  noise: 0.12,
} as const;

const OPERATOR_ATTIC_CAMERA = {
  mode: 'slowOrbit',
  zoom: 1,
  orbitSpeed: 0.12,
  shake: 0.04,
} as const;

const OPERATOR_ATTIC_LAYER_SCHEMA: ARVLayerSchema[] = [
  {
    id: 'room',
    label: 'Room',
    controls: [
      { key: 'deskPulse', label: 'Desk Pulse', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'monitors',
    label: 'Monitors',
    controls: [
      { key: 'signalIntensity', label: 'Signal Intensity', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'flicker', label: 'Flicker', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'scale', label: 'Scale', type: 'slider', target: 'controls', min: 0.5, max: 1.8, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'operator',
    label: 'Operator',
    controls: [
      { key: 'headBob', label: 'Head Bob', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'silhouetteGlow', label: 'Silhouette Glow', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'dustOrbs',
    label: 'Dust Orbs',
    controls: [
      { key: 'drift', label: 'Drift', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'size', label: 'Size', type: 'slider', target: 'controls', min: 0.4, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  createPostFxSchema(OPERATOR_ATTIC_POST_FX),
  createCameraSchema(OPERATOR_ATTIC_CAMERA),
];

export const createOperatorAtticDefaultMixState = (presetId: string): ARVLiveMixState => {
  return {
    presetId,
    layers: {
      room: createLayerState({ deskPulse: 1 }, { audioReactive: true, blendMode: 'screen' }),
      monitors: createLayerState({ signalIntensity: 1, flicker: 1, scale: 1 }, { audioReactive: true, blendMode: 'add' }),
      operator: createLayerState({ headBob: 1, silhouetteGlow: 1 }, { audioReactive: true, blendMode: 'screen' }),
      dustOrbs: createLayerState({ drift: 1, size: 1 }, { audioReactive: true, blendMode: 'add' }),
    },
    postFx: { ...OPERATOR_ATTIC_POST_FX },
    camera: { ...OPERATOR_ATTIC_CAMERA },
  };
};

export class OperatorAtticController implements ARVSceneController {
  readonly id = 'arv-operator-attic' as const;
  camera: Camera | null = null;

  private scene: Scene | null = null;
  private arcCamera: ArcRotateCamera | null = null;
  private root: TransformNode | null = null;
  private ambientLight: HemisphericLight | null = null;
  private monitorLight: PointLight | null = null;
  private rimLight: PointLight | null = null;
  private floorLight: PointLight | null = null;
  private glow: GlowLayer | null = null;
  private materials: StandardMaterial[] = [];
  private monitorUnits: MonitorUnit[] = [];
  private dustOrbs: DustOrb[] = [];
  private operatorHead: Mesh | null = null;
  private operatorTorso: Mesh | null = null;
  private operatorShoulders: Mesh | null = null;
  private desk: Mesh | null = null;
  private floor: Mesh | null = null;
  private backWall: Mesh | null = null;
  private phase = createDefaultControllerPhase('#67ffb0');
  private fallbackColor = '#67ffb0';
  private eventColor = Color3.FromHexString('#67ffb0');
  private portalColor = Color3.FromHexString('#67ffb0');
  private crowdColor = Color3.FromHexString('#84f6ff');
  private accentColor = Color3.FromHexString('#d6ffe7');
  private baseFogDensity = 0.016;
  private baseCameraAlpha = -Math.PI / 3.1;
  private baseCameraBeta = Math.PI / 2.3;
  private baseCameraRadius = 11.3;
  private baseCameraTarget = new Vector3(0.1, -0.46, 0.3);
  private activeMix = createOperatorAtticDefaultMixState('arv-operator-attic');
  private time = 0;
  private pulseEnergy = 0;
  private chatEnergy = 0;
  private glitchEnergy = 0;
  private darkEnergy = 0;
  private fireEnergy = 0;

  constructor(private readonly preset = null as ARVSceneContext['preset'] | null) {}

  init(ctx: ARVSceneContext): void {
    this.dispose();

    const preset = this.preset || ctx.preset;
    const { scene, quality, mode } = ctx;
    this.scene = scene;
    this.phase = createDefaultControllerPhase(preset.accentHex);
    this.fallbackColor = preset.portalHex;
    this.eventColor = Color3.FromHexString(preset.portalHex);
    this.portalColor = Color3.FromHexString(preset.portalHex);
    this.crowdColor = Color3.FromHexString(preset.crowdHex);
    this.accentColor = Color3.FromHexString(preset.accentHex);

    const backgroundColor = Color3.FromHexString(preset.backgroundHex);
    scene.clearColor = new Color4(backgroundColor.r, backgroundColor.g, backgroundColor.b, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    this.baseFogDensity = quality.tier === 'eco' ? 0.022 : 0.016;
    scene.fogDensity = this.baseFogDensity;
    scene.fogColor = Color3.FromHexString(preset.fogHex);

    this.arcCamera = new ArcRotateCamera(
      'arv-operator-attic-camera',
      -Math.PI / 3.1,
      Math.PI / 2.3,
      mode === 'obs' ? 10.6 : 11.3,
      new Vector3(0.1, -0.46, 0.3),
      scene,
    );
    this.arcCamera.inputs.clear();
    this.arcCamera.panningSensibility = 0;
    this.arcCamera.wheelPrecision = 100000;
    this.arcCamera.minZ = 0.1;
    this.arcCamera.maxZ = 60;
    this.baseCameraAlpha = this.arcCamera.alpha;
    this.baseCameraBeta = this.arcCamera.beta;
    this.baseCameraRadius = this.arcCamera.radius;
    this.baseCameraTarget = this.arcCamera.getTarget().clone();
    this.camera = this.arcCamera;

    this.ambientLight = new HemisphericLight('arv-operator-attic-hemi', new Vector3(0, 1, 0), scene);
    this.ambientLight.intensity = 0.14;
    this.ambientLight.groundColor = Color3.FromHexString('#020508');

    this.monitorLight = new PointLight('arv-operator-attic-monitor-light', new Vector3(0, 0.6, -0.4), scene);
    this.monitorLight.diffuse = this.portalColor;
    this.monitorLight.intensity = 1.4;

    this.rimLight = new PointLight('arv-operator-attic-rim-light', new Vector3(-2.4, 2.8, 1.6), scene);
    this.rimLight.diffuse = this.accentColor;
    this.rimLight.intensity = 0.76;

    this.floorLight = new PointLight('arv-operator-attic-floor-light', new Vector3(2, -1.8, 0.8), scene);
    this.floorLight.diffuse = this.crowdColor;
    this.floorLight.intensity = 0.34;

    this.glow = new GlowLayer('arv-operator-attic-glow', scene, {
      mainTextureRatio: quality.tier === 'eco' ? 0.42 : 0.6,
      blurKernelSize: quality.tier === 'obs' ? 42 : 28,
      mainTextureSamples: quality.tier === 'obs' ? 4 : 1,
    });
    this.glow.intensity = 0.56;

    this.root = new TransformNode('arv-operator-attic-root', scene);

    const wallMaterial = createMaterial(scene, 'arv-operator-attic-wall-mat', '#060a10', '#0c141b', 1);
    wallMaterial.specularColor = Color3.FromHexString('#101820').scale(0.1);
    this.materials.push(wallMaterial);

    const floorMaterial = createMaterial(scene, 'arv-operator-attic-floor-mat', '#05080d', '#08111a', 1);
    floorMaterial.specularColor = Color3.FromHexString('#10151a').scale(0.08);
    this.materials.push(floorMaterial);

    const deskMaterial = createMaterial(scene, 'arv-operator-attic-desk-mat', '#0a1017', '#0f1820', 1);
    deskMaterial.specularColor = Color3.FromHexString('#202e36').scale(0.14);
    this.materials.push(deskMaterial);

    const silhouetteMaterial = createMaterial(scene, 'arv-operator-attic-silhouette-mat', '#040607', '#10191d', 1);
    silhouetteMaterial.specularColor = Color3.FromHexString('#3a4950').scale(0.06);
    this.materials.push(silhouetteMaterial);

    const cableMaterial = createMaterial(scene, 'arv-operator-attic-cable-mat', '#080b0d', '#141c20', 1);
    cableMaterial.disableLighting = false;
    this.materials.push(cableMaterial);

    this.backWall = MeshBuilder.CreatePlane('arv-operator-attic-back-wall', { width: 12.8, height: 7.4 }, scene);
    this.backWall.parent = this.root;
    this.backWall.position.set(0, 0.6, 2.8);
    this.backWall.material = wallMaterial;

    this.floor = MeshBuilder.CreateBox('arv-operator-attic-floor', { width: 12.8, height: 0.24, depth: 10.8 }, scene);
    this.floor.parent = this.root;
    this.floor.position.set(0, -2.6, 0.4);
    this.floor.material = floorMaterial;

    this.desk = MeshBuilder.CreateBox('arv-operator-attic-desk', { width: 5.8, height: 0.34, depth: 1.92 }, scene);
    this.desk.parent = this.root;
    this.desk.position.set(0, -1.18, 0.08);
    this.desk.material = deskMaterial;

    const monitorConfigs = [
      { width: 1.76, height: 1.08, position: new Vector3(-2.02, -0.16, 0.92) },
      { width: 2.18, height: 1.28, position: new Vector3(0, 0.08, 1.08) },
      { width: 1.72, height: 1.02, position: new Vector3(2.06, -0.18, 0.96) },
    ];
    monitorConfigs.forEach((config, index) => {
      const bodyMaterial = createMaterial(
        scene,
        `arv-operator-attic-monitor-body-mat-${index}`,
        '#090d10',
        '#121b1f',
        1,
      );
      bodyMaterial.specularColor = Color3.FromHexString('#d4ffe2').scale(0.04);
      this.materials.push(bodyMaterial);

      const texture = new DynamicTexture(
        `arv-operator-attic-screen-${index}`,
        { width: 512, height: 320 },
        scene,
        false,
      );
      drawMonitorTexture(texture, preset.portalHex, preset.accentHex, index + 1);

      const screenMaterial = new StandardMaterial(`arv-operator-attic-screen-mat-${index}`, scene);
      screenMaterial.diffuseTexture = texture;
      screenMaterial.emissiveTexture = texture;
      screenMaterial.diffuseColor = Color3.FromHexString('#07110d');
      screenMaterial.emissiveColor = this.portalColor.scale(0.48);
      screenMaterial.backFaceCulling = false;
      this.materials.push(screenMaterial);

      const body = MeshBuilder.CreateBox(
        `arv-operator-attic-monitor-body-${index}`,
        { width: config.width + 0.18, height: config.height + 0.18, depth: 0.24 },
        scene,
      );
      body.parent = this.root;
      body.position.copyFrom(config.position);
      body.material = bodyMaterial;

      const screen = MeshBuilder.CreatePlane(
        `arv-operator-attic-monitor-screen-${index}`,
        { width: config.width, height: config.height },
        scene,
      );
      screen.parent = body;
      screen.position.set(0, 0, -0.122);
      screen.material = screenMaterial;

      this.glow?.addIncludedOnlyMesh(screen);
      this.monitorUnits.push({
        body,
        bodyMaterial,
        screen,
        screenMaterial,
        texture,
        basePosition: config.position.clone(),
        flickerOffset: index * 0.82,
        signalSeed: index + 1,
      });
    });

    this.operatorTorso = MeshBuilder.CreateCylinder(
      'arv-operator-attic-torso',
      { height: 1.78, diameterTop: 0.74, diameterBottom: 1.02, tessellation: 18 },
      scene,
    );
    this.operatorTorso.parent = this.root;
    this.operatorTorso.position.set(0, -0.66, -0.84);
    this.operatorTorso.rotation.x = -0.16;
    this.operatorTorso.material = silhouetteMaterial;

    this.operatorHead = MeshBuilder.CreateSphere(
      'arv-operator-attic-head',
      { diameter: 0.64, segments: 18 },
      scene,
    );
    this.operatorHead.parent = this.root;
    this.operatorHead.position.set(0, 0.48, -1.1);
    this.operatorHead.material = silhouetteMaterial;

    this.operatorShoulders = MeshBuilder.CreateBox(
      'arv-operator-attic-shoulders',
      { width: 1.24, height: 0.22, depth: 0.42 },
      scene,
    );
    this.operatorShoulders.parent = this.root;
    this.operatorShoulders.position.set(0, -0.02, -0.96);
    this.operatorShoulders.rotation.x = -0.16;
    this.operatorShoulders.material = silhouetteMaterial;

    const cablePaths = [
      [new Vector3(-2.1, -1.02, 0.88), new Vector3(-2.8, -1.66, 0.5), new Vector3(-3.1, -2.44, 0.12)],
      [new Vector3(0.2, -0.86, 1.02), new Vector3(0.4, -1.52, 0.2), new Vector3(0.84, -2.42, -0.2)],
      [new Vector3(2.08, -1.02, 0.92), new Vector3(2.56, -1.74, 0.18), new Vector3(2.92, -2.44, -0.42)],
    ];
    cablePaths.forEach((path, index) => {
      const cable = MeshBuilder.CreateTube(
        `arv-operator-attic-cable-${index}`,
        { path, radius: 0.04, tessellation: 12 },
        scene,
      );
      cable.parent = this.root;
      cable.material = cableMaterial;
    });

    const dustCount = quality.tier === 'eco' ? 8 : 14;
    for (let index = 0; index < dustCount; index += 1) {
      const material = createMaterial(
        scene,
        `arv-operator-attic-dust-mat-${index}`,
        '#08100d',
        index % 2 === 0 ? preset.portalHex : preset.accentHex,
        0.74,
      );
      material.disableLighting = true;
      this.materials.push(material);

      const mesh = MeshBuilder.CreateSphere(
        `arv-operator-attic-dust-${index}`,
        { diameter: 0.05 + (index % 3) * 0.02, segments: 8 },
        scene,
      );
      mesh.parent = this.root;
      const basePosition = new Vector3(
        -3.6 + (index % 7) * 1.08,
        -1.8 + (index % 5) * 0.7,
        -1.4 + (index % 4) * 0.56,
      );
      mesh.position.copyFrom(basePosition);
      mesh.material = material;
      this.glow?.addIncludedOnlyMesh(mesh);

      this.dustOrbs.push({
        mesh,
        material,
        basePosition,
        drift: index * 0.42,
      });
    }

    this.applyMixState(this.getDefaultMixState());
  }

  getLayerSchema(): ARVLayerSchema[] {
    return OPERATOR_ATTIC_LAYER_SCHEMA;
  }

  getDefaultMixState(): ARVLiveMixState {
    return createOperatorAtticDefaultMixState(this.preset?.id || 'arv-operator-attic');
  }

  applyMixState(mix: ARVLiveMixState): void {
    this.activeMix = mix;

    const roomLayer = getLayerState(mix, 'room');
    setNodeEnabled([this.backWall, this.floor, this.desk], roomLayer.enabled);
    applyMaterialBlendMode(roomLayer.blendMode, [
      this.backWall?.material instanceof StandardMaterial ? this.backWall.material : null,
      this.floor?.material instanceof StandardMaterial ? this.floor.material : null,
      this.desk?.material instanceof StandardMaterial ? this.desk.material : null,
    ]);
    if (this.backWall?.material instanceof StandardMaterial) {
      this.backWall.material.alpha = Math.max(0.08, roomLayer.opacity);
    }
    if (this.floor?.material instanceof StandardMaterial) {
      this.floor.material.alpha = Math.max(0.08, roomLayer.opacity);
    }
    if (this.desk?.material instanceof StandardMaterial) {
      this.desk.material.alpha = Math.max(0.08, roomLayer.opacity);
    }

    const monitorLayer = getLayerState(mix, 'monitors');
    this.monitorUnits.forEach((unit) => {
      unit.body.setEnabled(monitorLayer.enabled);
      unit.screen.setEnabled(monitorLayer.enabled);
      unit.bodyMaterial.alpha = Math.max(0.06, monitorLayer.opacity);
      unit.screenMaterial.alpha = Math.max(0.04, monitorLayer.opacity);
    });
    applyMaterialBlendMode(
      monitorLayer.blendMode,
      this.monitorUnits.flatMap((unit) => [unit.bodyMaterial, unit.screenMaterial]),
    );

    const operatorLayer = getLayerState(mix, 'operator');
    setNodeEnabled([this.operatorHead, this.operatorTorso, this.operatorShoulders], operatorLayer.enabled);
    applyMaterialBlendMode(operatorLayer.blendMode, [
      this.operatorHead?.material instanceof StandardMaterial ? this.operatorHead.material : null,
      this.operatorTorso?.material instanceof StandardMaterial ? this.operatorTorso.material : null,
      this.operatorShoulders?.material instanceof StandardMaterial ? this.operatorShoulders.material : null,
    ]);
    if (this.operatorHead?.material instanceof StandardMaterial) {
      this.operatorHead.material.alpha = Math.max(0.08, operatorLayer.opacity);
    }
    if (this.operatorTorso?.material instanceof StandardMaterial) {
      this.operatorTorso.material.alpha = Math.max(0.08, operatorLayer.opacity);
    }
    if (this.operatorShoulders?.material instanceof StandardMaterial) {
      this.operatorShoulders.material.alpha = Math.max(0.08, operatorLayer.opacity);
    }

    const dustLayer = getLayerState(mix, 'dustOrbs');
    this.dustOrbs.forEach((orb) => {
      orb.mesh.setEnabled(dustLayer.enabled);
      orb.material.alpha = Math.max(0.04, dustLayer.opacity * 0.74);
    });
    applyMaterialBlendMode(dustLayer.blendMode, this.dustOrbs.map((orb) => orb.material));

    if (this.scene) {
      this.scene.fogDensity = this.baseFogDensity * (1 + mix.postFx.vignette * 0.42);
    }
  }

  update(audio: ARVAudioFrame): void {
    if (!this.arcCamera || !this.root || !this.operatorHead || !this.operatorTorso || !this.desk) {
      return;
    }

    this.time += audio.dt;
    this.pulseEnergy *= Math.pow(0.14, audio.dt);
    this.chatEnergy *= Math.pow(0.18, audio.dt);
    this.glitchEnergy *= Math.pow(0.12, audio.dt);
    this.darkEnergy *= Math.pow(0.24, audio.dt);
    this.fireEnergy *= Math.pow(0.18, audio.dt);

    const roomLayer = getLayerState(this.activeMix, 'room');
    const monitorLayer = getLayerState(this.activeMix, 'monitors');
    const operatorLayer = getLayerState(this.activeMix, 'operator');
    const dustLayer = getLayerState(this.activeMix, 'dustOrbs');
    const roomReactive = roomLayer.audioReactive ? 1 : 0;
    const monitorReactive = monitorLayer.audioReactive ? 1 : 0;
    const operatorReactive = operatorLayer.audioReactive ? 1 : 0;
    const dustReactive = dustLayer.audioReactive ? 1 : 0;
    const deskPulse = getLayerControlNumber(this.activeMix, 'room', 'deskPulse', 1);
    const monitorSignalIntensity = getLayerControlNumber(this.activeMix, 'monitors', 'signalIntensity', 1);
    const monitorFlicker = getLayerControlNumber(this.activeMix, 'monitors', 'flicker', 1);
    const monitorScale = getLayerControlNumber(this.activeMix, 'monitors', 'scale', 1);
    const operatorHeadBob = getLayerControlNumber(this.activeMix, 'operator', 'headBob', 1);
    const operatorGlow = getLayerControlNumber(this.activeMix, 'operator', 'silhouetteGlow', 1);
    const dustDrift = getLayerControlNumber(this.activeMix, 'dustOrbs', 'drift', 1);
    const dustSize = getLayerControlNumber(this.activeMix, 'dustOrbs', 'size', 1);
    const postFxBloom = 0.54 + this.activeMix.postFx.bloom * 0.72;
    const postFxRgbSplit = this.activeMix.postFx.rgbSplit;
    const postFxNoise = this.activeMix.postFx.noise;
    const postFxScanlines = this.activeMix.postFx.scanlines;

    const beat = Math.max(audio.kick, audio.mid * 0.54, this.pulseEnergy * 0.82);
    const phaseColor = Color3.FromHexString(this.phase.accentHex);
    const targetColor = Color3.Lerp(
      phaseColor,
      this.eventColor,
      Math.min(1, 0.22 + this.chatEnergy * 0.18 + this.glitchEnergy * 0.26),
    );

    this.root.position.x = Math.sin(this.time * 3.2) * 0.02 * (this.glitchEnergy + postFxNoise * 0.4);
    this.desk.scaling.y = 1 + beat * 0.03 * roomReactive * deskPulse;

    this.operatorTorso.rotation.x = -0.16 + Math.sin(this.time * 1.2) * 0.02 * operatorHeadBob + beat * 0.04 * operatorReactive * operatorHeadBob;
    this.operatorHead.position.y = 0.48 + Math.cos(this.time * 1.5) * 0.02 * operatorHeadBob + beat * 0.04 * operatorReactive * operatorHeadBob;
    this.operatorHead.position.x = Math.sin(this.time * 1.3) * 0.04 * operatorHeadBob;
    this.operatorHead.scaling.setAll(1 + beat * 0.03 * operatorReactive);
    this.operatorShoulders!.rotation.x = this.operatorTorso.rotation.x;

    this.monitorUnits.forEach((unit, index) => {
      const flicker = 0.82
        + Math.sin(this.time * (7.6 + index) + unit.flickerOffset) * 0.12 * monitorFlicker
        + audio.high * 0.12 * monitorReactive
        + this.glitchEnergy * 0.18
        + postFxScanlines * 0.08;
      unit.body.position.y = unit.basePosition.y + Math.sin(this.time * (1.8 + index * 0.2)) * 0.02 * (beat + this.chatEnergy * 0.4) * monitorScale;
      unit.body.rotation.x = Math.sin(this.time * 0.6 + index) * 0.01 * beat * monitorReactive;
      unit.screen.scaling.setAll(monitorScale * (1 + beat * 0.02 * monitorReactive + this.chatEnergy * 0.01));
      unit.texture.vOffset = (unit.texture.vOffset + audio.dt * (0.08 + audio.high * 0.08 * monitorReactive)) % 1;
      unit.screenMaterial.emissiveColor = Color3.Lerp(
        unit.screenMaterial.emissiveColor,
        Color3.Lerp(this.portalColor, targetColor, 0.28 + index * 0.08).scale(flicker * (0.14 + this.chatEnergy * 0.08) * monitorLayer.intensity * monitorSignalIntensity),
        0.14,
      );
      unit.bodyMaterial.emissiveColor = Color3.Lerp(
        unit.bodyMaterial.emissiveColor,
        Color3.Lerp(this.accentColor, targetColor, 0.18).scale((0.04 + audio.mid * 0.06 * monitorReactive + this.fireEnergy * 0.04) * monitorLayer.intensity),
        0.1,
      );
    });

    this.dustOrbs.forEach((orb, index) => {
      const drift = this.time * (0.18 + index * 0.01) + orb.drift;
      orb.mesh.position.set(
        orb.basePosition.x + Math.sin(drift) * 0.12 * dustDrift,
        orb.basePosition.y + Math.cos(drift * 1.2) * 0.08 * dustDrift,
        orb.basePosition.z + Math.sin(drift * 0.84) * 0.08 * dustDrift,
      );
      orb.mesh.scaling.setAll(dustSize * (0.84 + audio.high * 0.16 * dustReactive + this.chatEnergy * 0.08));
      orb.material.emissiveColor = Color3.Lerp(
        orb.material.emissiveColor,
        Color3.Lerp(this.crowdColor, targetColor, 0.28).scale((0.06 + audio.high * 0.14 * dustReactive) * dustLayer.intensity),
        0.08,
      );
    });

    const silhouetteMaterials = [
      this.operatorHead?.material instanceof StandardMaterial ? this.operatorHead.material : null,
      this.operatorTorso?.material instanceof StandardMaterial ? this.operatorTorso.material : null,
      this.operatorShoulders?.material instanceof StandardMaterial ? this.operatorShoulders.material : null,
    ].filter((material): material is StandardMaterial => Boolean(material));
    silhouetteMaterials.forEach((material) => {
      material.emissiveColor = Color3.Lerp(
        material.emissiveColor,
        Color3.Lerp(this.accentColor, targetColor, 0.18).scale((0.04 + beat * 0.12 * operatorReactive) * operatorLayer.intensity * operatorGlow),
        0.1,
      );
    });

    if (this.monitorLight) {
      this.monitorLight.diffuse = targetColor;
      this.monitorLight.position.x = -postFxRgbSplit * 0.5;
      this.monitorLight.intensity = (0.42 + beat * 1.8 * monitorReactive + this.chatEnergy * 0.22 - this.darkEnergy * 0.24) * (0.72 + monitorLayer.intensity * 0.3);
    }
    if (this.rimLight) {
      this.rimLight.diffuse = Color3.Lerp(this.accentColor, targetColor, 0.2);
      this.rimLight.position.x = -2.4 - postFxRgbSplit * 0.5;
      this.rimLight.intensity = (0.18 + audio.mid * 0.54 * operatorReactive + this.fireEnergy * 0.18) * (0.7 + operatorLayer.intensity * 0.28);
    }
    if (this.floorLight) {
      this.floorLight.diffuse = Color3.Lerp(this.crowdColor, targetColor, 0.18);
      this.floorLight.position.x = 2 + postFxRgbSplit * 0.4;
      this.floorLight.intensity = (0.08 + audio.bass * 0.6 * roomReactive + this.pulseEnergy * 0.18) * (0.68 + roomLayer.intensity * 0.28);
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = 0.04 + audio.rms * 0.08 - this.darkEnergy * 0.04 - this.activeMix.postFx.vignette * 0.04;
    }
    if (this.glow) {
      this.glow.intensity = (0.14 + audio.high * 0.18 + this.chatEnergy * 0.08 + this.phase.bloomBoost * 0.18) * postFxBloom;
    }

    const cameraOrbitSpeed = 0.04 + this.activeMix.camera.orbitSpeed * 0.12;
    const cameraShake = this.activeMix.camera.shake * (0.02 + beat * 0.02 + postFxNoise * 0.02);
    const cameraZoom = this.activeMix.camera.zoom;
    if (this.activeMix.camera.mode === 'slowPush') {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 0.08) * 0.03;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.1) * 0.02;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom - Math.sin(this.time * 0.16) * 0.18;
    } else if (this.activeMix.camera.mode === 'handheldFake') {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 1.4) * cameraShake;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 1.1) * cameraShake;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom + Math.sin(this.time * 0.74) * 0.06;
    } else if (this.activeMix.camera.mode === 'locked') {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 0.08) * cameraShake;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.1) * cameraShake * 0.8;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom;
    } else {
      this.arcCamera.alpha = this.baseCameraAlpha + this.time * cameraOrbitSpeed + Math.sin(this.time * 0.08) * 0.03;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.1) * 0.02;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom;
    }
    this.arcCamera.setTarget(this.baseCameraTarget);
    if (this.scene) {
      this.scene.fogDensity = this.baseFogDensity * (1 + this.activeMix.postFx.vignette * 0.42 + this.activeMix.postFx.noise * 0.05);
    }
  }

  onEvent(event: ARVVisualEvent): void {
    const phase = extractPhaseState(event);
    if (phase) {
      this.phase = phase;
      if (isStandbyPhaseEvent(event)) {
        this.setStandby(phase);
      }
      return;
    }

    const impulse = createImpulseFromVisualEvent(event, this.fallbackColor);
    if (!impulse) {
      return;
    }

    this.eventColor = Color3.FromHexString(impulse.colorHex);
    this.pulseEnergy = clamp(this.pulseEnergy + impulse.intensity * 0.54, 0, 1.4);
    this.glitchEnergy = clamp(this.glitchEnergy + impulse.sparkle * 0.38, 0, 1.4);

    if (event.type === 'chat.message' || event.type === 'chat.emoji') {
      this.chatEnergy = clamp(this.chatEnergy + impulse.intensity * 0.72, 0, 1.5);
      this.monitorUnits.forEach((unit, index) => {
        unit.signalSeed += 0.7 + index * 0.13;
        drawMonitorTexture(unit.texture, impulse.colorHex, this.phase.accentHex, unit.signalSeed);
      });
    }

    switch (reactionKindFromVisualEvent(event.type)) {
      case 'fire':
        this.fireEnergy = clamp(this.fireEnergy + impulse.intensity, 0, 1.4);
        break;
      case 'dark':
        this.darkEnergy = clamp(this.darkEnergy + impulse.intensity, 0, 1.2);
        break;
      case 'acid':
        this.glitchEnergy = clamp(this.glitchEnergy + impulse.intensity * 0.28, 0, 1.5);
        this.monitorUnits.forEach((unit, index) => {
          unit.signalSeed += 1.1 + index * 0.17;
          drawMonitorTexture(unit.texture, this.fallbackColor, impulse.colorHex, unit.signalSeed);
        });
        break;
      default:
        break;
    }
  }

  resize(_width: number, _height: number): void {}

  dispose(): void {
    this.glow?.dispose();
    this.glow = null;
    this.monitorLight?.dispose();
    this.monitorLight = null;
    this.rimLight?.dispose();
    this.rimLight = null;
    this.floorLight?.dispose();
    this.floorLight = null;
    this.ambientLight?.dispose();
    this.ambientLight = null;
    this.root?.dispose(false, true);
    this.root = null;
    this.monitorUnits.forEach((unit) => unit.texture.dispose());
    this.monitorUnits = [];
    this.dustOrbs = [];
    this.materials.forEach((material) => material.dispose());
    this.materials = [];
    this.scene = null;
    this.arcCamera?.dispose();
    this.arcCamera = null;
    this.camera = null;
    this.operatorHead = null;
    this.operatorTorso = null;
    this.operatorShoulders = null;
    this.desk = null;
    this.floor = null;
    this.backWall = null;
    this.time = 0;
    this.pulseEnergy = 0;
    this.chatEnergy = 0;
    this.glitchEnergy = 0;
    this.darkEnergy = 0;
    this.fireEnergy = 0;
  }

  private setStandby(phase: ReturnType<typeof createDefaultControllerPhase>): void {
    this.phase = phase;
    const standbyColor = Color3.FromHexString(phase.accentHex);

    if (this.ambientLight) {
      this.ambientLight.intensity = 0.06;
    }
    if (this.monitorLight) {
      this.monitorLight.diffuse = standbyColor;
      this.monitorLight.intensity = 0.28;
    }
    if (this.rimLight) {
      this.rimLight.diffuse = standbyColor;
      this.rimLight.intensity = 0.16;
    }
    if (this.floorLight) {
      this.floorLight.diffuse = standbyColor;
      this.floorLight.intensity = 0.08;
    }
    if (this.glow) {
      this.glow.intensity = 0.1;
    }
  }
}