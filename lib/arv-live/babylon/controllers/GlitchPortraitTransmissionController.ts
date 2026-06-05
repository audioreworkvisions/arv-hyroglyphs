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

interface HaloRing {
  mesh: Mesh;
  material: StandardMaterial;
  speed: number;
  axis: 'x' | 'y' | 'z';
  baseScale: number;
}

interface CityBlock {
  mesh: Mesh;
  material: StandardMaterial;
  baseHeight: number;
  baseX: number;
  baseZ: number;
  phaseOffset: number;
}

interface HudNode {
  mesh: Mesh;
  material: StandardMaterial;
  orbitRadius: number;
  orbitHeight: number;
  speed: number;
  angleOffset: number;
}

interface GlitchShard {
  mesh: Mesh;
  material: StandardMaterial;
  radius: number;
  lift: number;
  speed: number;
  angleOffset: number;
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

const createPortraitTexture = (scene: Scene, primaryHex: string, accentHex: string): DynamicTexture => {
  const size = 1024;
  const texture = new DynamicTexture('arv-glitch-portrait-transmission-portrait', { width: size, height: size }, scene, false);
  const ctx = texture.getContext();
  const center = size / 2;
  const radius = 326;

  ctx.clearRect(0, 0, size, size);

  const glow = ctx.createRadialGradient(center, center - 56, 48, center, center, radius);
  glow.addColorStop(0, hexToRgba(primaryHex, 0.28));
  glow.addColorStop(0.58, hexToRgba(accentHex, 0.08));
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  for (let y = center - radius; y <= center + radius; y += 28) {
    for (let x = center - radius; x <= center + radius; x += 28) {
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius) {
        continue;
      }

      const dotAlpha = 0.06 + (1 - distance / radius) * 0.22;
      ctx.fillStyle = (Math.round((x + y) / 28) % 2 === 0)
        ? hexToRgba(primaryHex, dotAlpha)
        : hexToRgba(accentHex, dotAlpha * 0.72);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = 'rgba(228, 244, 255, 0.76)';
  ctx.save();
  ctx.translate(center, center - 120);
  ctx.scale(124 / 166, 1);
  ctx.beginPath();
  ctx.arc(0, 0, 166, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(center - 196, center + 182);
  ctx.quadraticCurveTo(center, center + 20, center + 196, center + 182);
  ctx.lineTo(center + 220, center + 352);
  ctx.lineTo(center - 220, center + 352);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = hexToRgba(primaryHex, 0.72);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(center - 142, center - 36);
  ctx.lineTo(center + 142, center - 16);
  ctx.stroke();

  ctx.strokeStyle = hexToRgba(accentHex, 0.68);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(center, center, 284, Math.PI * 0.18, Math.PI * 1.82);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(center, center, 236, Math.PI * 1.18, Math.PI * 0.78, true);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  for (let index = 0; index < 88; index += 1) {
    const y = 92 + index * 9;
    ctx.beginPath();
    ctx.moveTo(180, y);
    ctx.lineTo(size - 180, y);
    ctx.stroke();
  }

  texture.hasAlpha = true;
  texture.update(false);
  return texture;
};

const createScanlineTexture = (scene: Scene): DynamicTexture => {
  const width = 1024;
  const height = 1024;
  const texture = new DynamicTexture('arv-glitch-portrait-transmission-scanlines', { width, height }, scene, false);
  const ctx = texture.getContext();

  ctx.clearRect(0, 0, width, height);
  for (let index = 0; index < 180; index += 1) {
    const y = (index / 180) * height;
    ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0)';
    ctx.fillRect(0, y, width, 3);
  }

  texture.hasAlpha = true;
  texture.update(false);
  return texture;
};

const GLITCH_PORTRAIT_POST_FX = {
  bloom: 0.58,
  scanlines: 0.74,
  rgbSplit: 0.36,
  vignette: 0.4,
  noise: 0.24,
} as const;

const GLITCH_PORTRAIT_CAMERA = {
  mode: 'slowOrbit',
  zoom: 1,
  orbitSpeed: 0.14,
  shake: 0.05,
} as const;

const GLITCH_PORTRAIT_LAYER_SCHEMA: ARVLayerSchema[] = [
  {
    id: 'portrait',
    label: 'Portrait',
    controls: [
      { key: 'scale', label: 'Scale', type: 'slider', target: 'controls', min: 0.5, max: 1.8, step: 0.01, defaultValue: 1 },
      { key: 'glitchAmount', label: 'Glitch Amount', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'haloRings',
    label: 'Halo Rings',
    controls: [
      { key: 'rotationSpeed', label: 'Rotation Speed', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'cityBlocks',
    label: 'City Blocks',
    controls: [
      { key: 'heightScale', label: 'Height Scale', type: 'slider', target: 'controls', min: 0.5, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'hudNodes',
    label: 'HUD Nodes',
    controls: [
      { key: 'orbitSpeed', label: 'Orbit Speed', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'size', label: 'Size', type: 'slider', target: 'controls', min: 0.4, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'glitchShards',
    label: 'Glitch Shards',
    controls: [
      { key: 'orbitSpeed', label: 'Orbit Speed', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'size', label: 'Size', type: 'slider', target: 'controls', min: 0.4, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  createPostFxSchema(GLITCH_PORTRAIT_POST_FX),
  createCameraSchema(GLITCH_PORTRAIT_CAMERA),
];

export const createGlitchPortraitTransmissionDefaultMixState = (presetId: string): ARVLiveMixState => {
  return {
    presetId,
    layers: {
      portrait: createLayerState({ scale: 1, glitchAmount: 1 }, { audioReactive: true, blendMode: 'screen' }),
      haloRings: createLayerState({ rotationSpeed: 1 }, { audioReactive: true, blendMode: 'add' }),
      cityBlocks: createLayerState({ heightScale: 1 }, { audioReactive: true, blendMode: 'screen' }),
      hudNodes: createLayerState({ orbitSpeed: 1, size: 1 }, { audioReactive: true, blendMode: 'add' }),
      glitchShards: createLayerState({ orbitSpeed: 1, size: 1 }, { audioReactive: true, blendMode: 'add' }),
    },
    postFx: { ...GLITCH_PORTRAIT_POST_FX },
    camera: { ...GLITCH_PORTRAIT_CAMERA },
  };
};

export class GlitchPortraitTransmissionController implements ARVSceneController {
  readonly id = 'arv-glitch-portrait-transmission' as const;
  camera: Camera | null = null;

  private scene: Scene | null = null;
  private arcCamera: ArcRotateCamera | null = null;
  private root: TransformNode | null = null;
  private ambientLight: HemisphericLight | null = null;
  private portraitLight: PointLight | null = null;
  private cityLight: PointLight | null = null;
  private accentLight: PointLight | null = null;
  private glow: GlowLayer | null = null;
  private portraitTexture: DynamicTexture | null = null;
  private scanlineTexture: DynamicTexture | null = null;
  private portraitPlane: Mesh | null = null;
  private scanlineOverlay: Mesh | null = null;
  private materials: StandardMaterial[] = [];
  private haloRings: HaloRing[] = [];
  private cityBlocks: CityBlock[] = [];
  private hudNodes: HudNode[] = [];
  private glitchShards: GlitchShard[] = [];
  private phase = createDefaultControllerPhase('#68ecff');
  private fallbackColor = '#68ecff';
  private eventColor = Color3.FromHexString('#68ecff');
  private portalColor = Color3.FromHexString('#68ecff');
  private crowdColor = Color3.FromHexString('#ff59cf');
  private accentColor = Color3.FromHexString('#f2fbff');
  private baseFogDensity = 0.014;
  private baseCameraAlpha = -Math.PI / 2.08;
  private baseCameraBeta = Math.PI / 2.28;
  private baseCameraRadius = 9.9;
  private baseCameraTarget = new Vector3(0, -0.1, 0);
  private activeMix = createGlitchPortraitTransmissionDefaultMixState('arv-glitch-portrait-transmission');
  private time = 0;
  private pulseEnergy = 0;
  private chatEnergy = 0;
  private glitchEnergy = 0;
  private darkEnergy = 0;
  private fireEnergy = 0;
  private technoEnergy = 0;

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
    this.baseFogDensity = quality.tier === 'eco' ? 0.02 : 0.014;
    scene.fogDensity = this.baseFogDensity;
    scene.fogColor = Color3.FromHexString(preset.fogHex);

    this.arcCamera = new ArcRotateCamera(
      'arv-glitch-portrait-transmission-camera',
      -Math.PI / 2.08,
      Math.PI / 2.28,
      mode === 'obs' ? 9.4 : 9.9,
      new Vector3(0, -0.1, 0),
      scene,
    );
    this.arcCamera.inputs.clear();
    this.arcCamera.panningSensibility = 0;
    this.arcCamera.wheelPrecision = 100000;
    this.arcCamera.minZ = 0.1;
    this.arcCamera.maxZ = 42;
    this.baseCameraAlpha = this.arcCamera.alpha;
    this.baseCameraBeta = this.arcCamera.beta;
    this.baseCameraRadius = this.arcCamera.radius;
    this.baseCameraTarget = this.arcCamera.getTarget().clone();
    this.camera = this.arcCamera;

    this.ambientLight = new HemisphericLight('arv-glitch-portrait-transmission-hemi', new Vector3(0, 1, 0), scene);
    this.ambientLight.intensity = 0.14;
    this.ambientLight.groundColor = Color3.FromHexString('#02040a');

    this.portraitLight = new PointLight('arv-glitch-portrait-transmission-portrait-light', new Vector3(0, 1.4, -2), scene);
    this.portraitLight.diffuse = this.portalColor;
    this.portraitLight.intensity = 1.9;

    this.cityLight = new PointLight('arv-glitch-portrait-transmission-city-light', new Vector3(0, -1.5, -1.4), scene);
    this.cityLight.diffuse = this.crowdColor;
    this.cityLight.intensity = 0.88;

    this.accentLight = new PointLight('arv-glitch-portrait-transmission-accent-light', new Vector3(-2.2, 3.1, 0.6), scene);
    this.accentLight.diffuse = this.accentColor;
    this.accentLight.intensity = 0.62;

    this.glow = new GlowLayer('arv-glitch-portrait-transmission-glow', scene, {
      mainTextureRatio: quality.tier === 'eco' ? 0.4 : 0.58,
      blurKernelSize: quality.tier === 'obs' ? 42 : 28,
      mainTextureSamples: quality.tier === 'obs' ? 4 : 1,
    });
    this.glow.intensity = 0.58;

    this.portraitTexture = createPortraitTexture(scene, preset.portalHex, preset.crowdHex);
    this.scanlineTexture = createScanlineTexture(scene);

    const portraitMaterial = new StandardMaterial('arv-glitch-portrait-transmission-portrait-mat', scene);
    portraitMaterial.diffuseTexture = this.portraitTexture;
    portraitMaterial.emissiveTexture = this.portraitTexture;
    portraitMaterial.diffuseColor = Color3.FromHexString('#09111b');
    portraitMaterial.emissiveColor = this.portalColor.scale(0.42);
    portraitMaterial.opacityTexture = this.portraitTexture;
    portraitMaterial.backFaceCulling = false;
    this.materials.push(portraitMaterial);

    const scanlineMaterial = new StandardMaterial('arv-glitch-portrait-transmission-scanline-mat', scene);
    scanlineMaterial.diffuseTexture = this.scanlineTexture;
    scanlineMaterial.emissiveTexture = this.scanlineTexture;
    scanlineMaterial.opacityTexture = this.scanlineTexture;
    scanlineMaterial.diffuseColor = Color3.FromHexString('#09111b');
    scanlineMaterial.emissiveColor = Color3.FromHexString('#f8fbff').scale(0.08);
    scanlineMaterial.alpha = 0.22;
    scanlineMaterial.backFaceCulling = false;
    this.materials.push(scanlineMaterial);

    this.root = new TransformNode('arv-glitch-portrait-transmission-root', scene);

    this.portraitPlane = MeshBuilder.CreatePlane(
      'arv-glitch-portrait-transmission-portrait-plane',
      { width: 7.4, height: 7.4 },
      scene,
    );
    this.portraitPlane.parent = this.root;
    this.portraitPlane.position.set(0, 0.86, 1.36);
    this.portraitPlane.material = portraitMaterial;

    this.scanlineOverlay = MeshBuilder.CreatePlane(
      'arv-glitch-portrait-transmission-scanline-overlay',
      { width: 7.7, height: 7.8 },
      scene,
    );
    this.scanlineOverlay.parent = this.root;
    this.scanlineOverlay.position.set(0, 0.86, 1.32);
    this.scanlineOverlay.material = scanlineMaterial;

    const ringConfigs = [
      { diameter: 4.9, thickness: 0.08, colorHex: preset.portalHex, axis: 'x' as const, speed: 0.34, scale: 1 },
      { diameter: 6.4, thickness: 0.05, colorHex: preset.crowdHex, axis: 'y' as const, speed: -0.26, scale: 1.06 },
      { diameter: 7.2, thickness: 0.04, colorHex: preset.accentHex, axis: 'z' as const, speed: 0.18, scale: 1.12 },
    ];
    ringConfigs.forEach((config, index) => {
      const material = createMaterial(
        scene,
        `arv-glitch-portrait-transmission-ring-mat-${index}`,
        '#07101a',
        config.colorHex,
        0.92,
      );
      material.disableLighting = true;
      this.materials.push(material);

      const ring = MeshBuilder.CreateTorus(
        `arv-glitch-portrait-transmission-ring-${index}`,
        { diameter: config.diameter, thickness: config.thickness, tessellation: 96 },
        scene,
      );
      ring.parent = this.root;
      ring.position.set(0, 0.88, 0.8 - index * 0.08);
      ring.rotation.x = Math.PI / 2;
      ring.material = material;
      ring.scaling.setAll(config.scale);
      this.glow?.addIncludedOnlyMesh(ring);

      this.haloRings.push({
        mesh: ring,
        material,
        speed: config.speed,
        axis: config.axis,
        baseScale: config.scale,
      });
    });

    const cityPalette = [preset.portalHex, preset.crowdHex, preset.accentHex];
    const cityBlocks = [
      { width: 0.48, height: 1.3, x: -3.2, z: 0.2 },
      { width: 0.54, height: 1.72, x: -2.48, z: -0.1 },
      { width: 0.6, height: 1.18, x: -1.78, z: 0.14 },
      { width: 0.72, height: 2.04, x: -1.04, z: -0.22 },
      { width: 0.86, height: 2.52, x: -0.18, z: 0.2 },
      { width: 0.82, height: 2.2, x: 0.72, z: -0.12 },
      { width: 0.64, height: 1.58, x: 1.58, z: 0.12 },
      { width: 0.58, height: 1.92, x: 2.34, z: -0.2 },
      { width: 0.46, height: 1.34, x: 3.02, z: 0.08 },
    ];
    cityBlocks.forEach((config, index) => {
      const material = createMaterial(
        scene,
        `arv-glitch-portrait-transmission-city-mat-${index}`,
        '#070d16',
        cityPalette[index % cityPalette.length],
        0.94,
      );
      material.specularColor = Color3.FromHexString('#dcecff').scale(0.12);
      this.materials.push(material);

      const mesh = MeshBuilder.CreateBox(
        `arv-glitch-portrait-transmission-city-${index}`,
        { width: config.width, height: config.height, depth: 0.36 + (index % 3) * 0.06 },
        scene,
      );
      mesh.parent = this.root;
      mesh.position.set(config.x, -2.56 + config.height * 0.5, config.z);
      mesh.material = material;
      this.glow?.addIncludedOnlyMesh(mesh);

      this.cityBlocks.push({
        mesh,
        material,
        baseHeight: config.height,
        baseX: config.x,
        baseZ: config.z,
        phaseOffset: index * 0.38,
      });
    });

    const nodePalette = [preset.portalHex, preset.crowdHex, preset.accentHex, '#ffffff'];
    const hudNodeCount = quality.tier === 'eco' ? 8 : 12;
    for (let index = 0; index < hudNodeCount; index += 1) {
      const colorHex = nodePalette[index % nodePalette.length];
      const material = createMaterial(
        scene,
        `arv-glitch-portrait-transmission-node-mat-${index}`,
        '#07111a',
        colorHex,
        0.96,
      );
      material.disableLighting = true;
      this.materials.push(material);

      const node = MeshBuilder.CreateSphere(
        `arv-glitch-portrait-transmission-node-${index}`,
        { diameter: 0.11 + (index % 3) * 0.03, segments: 10 },
        scene,
      );
      node.parent = this.root;
      node.material = material;
      this.glow?.addIncludedOnlyMesh(node);

      this.hudNodes.push({
        mesh: node,
        material,
        orbitRadius: 2.9 + (index % 4) * 0.26,
        orbitHeight: -0.24 + (index % 5) * 0.2,
        speed: 0.42 + index * 0.04,
        angleOffset: index * 0.54,
      });
    }

    const shardPalette = [preset.crowdHex, preset.portalHex, preset.accentHex];
    const shardCount = quality.tier === 'eco' ? 6 : 10;
    for (let index = 0; index < shardCount; index += 1) {
      const material = createMaterial(
        scene,
        `arv-glitch-portrait-transmission-shard-mat-${index}`,
        '#07111b',
        shardPalette[index % shardPalette.length],
        0.92,
      );
      material.disableLighting = true;
      this.materials.push(material);

      const shard = MeshBuilder.CreateDisc(
        `arv-glitch-portrait-transmission-shard-${index}`,
        { radius: 0.18 + (index % 2) * 0.08, tessellation: 3 },
        scene,
      );
      shard.parent = this.root;
      shard.material = material;
      this.glow?.addIncludedOnlyMesh(shard);

      this.glitchShards.push({
        mesh: shard,
        material,
        radius: 2.2 + (index % 4) * 0.42,
        lift: -0.9 + (index % 5) * 0.62,
        speed: 0.3 + index * 0.05,
        angleOffset: index * 0.7,
      });
    }

    this.glow?.addIncludedOnlyMesh(this.portraitPlane);

    this.applyMixState(this.getDefaultMixState());
  }

  getLayerSchema(): ARVLayerSchema[] {
    return GLITCH_PORTRAIT_LAYER_SCHEMA;
  }

  getDefaultMixState(): ARVLiveMixState {
    return createGlitchPortraitTransmissionDefaultMixState(this.preset?.id || 'arv-glitch-portrait-transmission');
  }

  applyMixState(mix: ARVLiveMixState): void {
    this.activeMix = mix;

    const portraitLayer = getLayerState(mix, 'portrait');
    setNodeEnabled([this.portraitPlane, this.scanlineOverlay], portraitLayer.enabled);
    if (this.portraitPlane?.material instanceof StandardMaterial) {
      this.portraitPlane.material.alpha = Math.max(0.08, portraitLayer.opacity);
      applyMaterialBlendMode(portraitLayer.blendMode, [this.portraitPlane.material]);
    }
    if (this.scanlineOverlay?.material instanceof StandardMaterial) {
      this.scanlineOverlay.material.alpha = Math.max(0.04, portraitLayer.opacity * 0.22);
      applyMaterialBlendMode(portraitLayer.blendMode, [this.scanlineOverlay.material]);
    }

    const ringsLayer = getLayerState(mix, 'haloRings');
    this.haloRings.forEach((ring) => {
      ring.mesh.setEnabled(ringsLayer.enabled);
      ring.material.alpha = Math.max(0.04, ringsLayer.opacity * 0.92);
    });
    applyMaterialBlendMode(ringsLayer.blendMode, this.haloRings.map((ring) => ring.material));

    const cityLayer = getLayerState(mix, 'cityBlocks');
    this.cityBlocks.forEach((block) => {
      block.mesh.setEnabled(cityLayer.enabled);
      block.material.alpha = Math.max(0.04, cityLayer.opacity * 0.94);
    });
    applyMaterialBlendMode(cityLayer.blendMode, this.cityBlocks.map((block) => block.material));

    const nodeLayer = getLayerState(mix, 'hudNodes');
    this.hudNodes.forEach((node) => {
      node.mesh.setEnabled(nodeLayer.enabled);
      node.material.alpha = Math.max(0.04, nodeLayer.opacity * 0.96);
    });
    applyMaterialBlendMode(nodeLayer.blendMode, this.hudNodes.map((node) => node.material));

    const shardLayer = getLayerState(mix, 'glitchShards');
    this.glitchShards.forEach((shard) => {
      shard.mesh.setEnabled(shardLayer.enabled);
      shard.material.alpha = Math.max(0.04, shardLayer.opacity * 0.92);
    });
    applyMaterialBlendMode(shardLayer.blendMode, this.glitchShards.map((shard) => shard.material));

    if (this.scene) {
      this.scene.fogDensity = this.baseFogDensity * (1 + mix.postFx.vignette * 0.36);
    }
  }

  update(audio: ARVAudioFrame): void {
    if (!this.arcCamera || !this.root || !this.portraitPlane || !this.scanlineOverlay) {
      return;
    }

    this.time += audio.dt;
    this.pulseEnergy *= Math.pow(0.14, audio.dt);
    this.chatEnergy *= Math.pow(0.16, audio.dt);
    this.glitchEnergy *= Math.pow(0.1, audio.dt);
    this.darkEnergy *= Math.pow(0.22, audio.dt);
    this.fireEnergy *= Math.pow(0.18, audio.dt);
    this.technoEnergy *= Math.pow(0.18, audio.dt);

    const portraitLayer = getLayerState(this.activeMix, 'portrait');
    const ringsLayer = getLayerState(this.activeMix, 'haloRings');
    const cityLayer = getLayerState(this.activeMix, 'cityBlocks');
    const nodeLayer = getLayerState(this.activeMix, 'hudNodes');
    const shardLayer = getLayerState(this.activeMix, 'glitchShards');
    const portraitReactive = portraitLayer.audioReactive ? 1 : 0;
    const ringsReactive = ringsLayer.audioReactive ? 1 : 0;
    const cityReactive = cityLayer.audioReactive ? 1 : 0;
    const nodeReactive = nodeLayer.audioReactive ? 1 : 0;
    const shardReactive = shardLayer.audioReactive ? 1 : 0;
    const portraitScale = getLayerControlNumber(this.activeMix, 'portrait', 'scale', 1);
    const glitchAmount = getLayerControlNumber(this.activeMix, 'portrait', 'glitchAmount', 1);
    const ringRotationSpeed = getLayerControlNumber(this.activeMix, 'haloRings', 'rotationSpeed', 1);
    const cityHeightScale = getLayerControlNumber(this.activeMix, 'cityBlocks', 'heightScale', 1);
    const nodeOrbitSpeed = getLayerControlNumber(this.activeMix, 'hudNodes', 'orbitSpeed', 1);
    const nodeSize = getLayerControlNumber(this.activeMix, 'hudNodes', 'size', 1);
    const shardOrbitSpeed = getLayerControlNumber(this.activeMix, 'glitchShards', 'orbitSpeed', 1);
    const shardSize = getLayerControlNumber(this.activeMix, 'glitchShards', 'size', 1);
    const postFxBloom = 0.56 + this.activeMix.postFx.bloom * 0.74;
    const postFxRgbSplit = this.activeMix.postFx.rgbSplit;
    const postFxNoise = this.activeMix.postFx.noise;
    const postFxScanlines = this.activeMix.postFx.scanlines;

    const beat = Math.max(audio.kick, audio.high * 0.54, this.pulseEnergy * 0.86);
    const phaseColor = Color3.FromHexString(this.phase.accentHex);
    const targetColor = Color3.Lerp(
      phaseColor,
      this.eventColor,
      Math.min(1, 0.26 + this.glitchEnergy * 0.46 + this.chatEnergy * 0.16),
    );

    this.root.position.x = Math.sin(this.time * 16) * 0.014 * (beat + this.glitchEnergy * 0.72 + postFxNoise * 0.4);
    this.root.position.y = Math.cos(this.time * 8.4) * 0.01 * (beat + this.fireEnergy * 0.24);

    this.portraitPlane.scaling.setAll(portraitScale * (1 + beat * 0.05 * portraitReactive + this.fireEnergy * 0.03 + this.technoEnergy * 0.02));
    this.portraitPlane.rotation.z = Math.sin(this.time * 0.9) * 0.01 * glitchAmount * (this.glitchEnergy + this.chatEnergy + postFxNoise * 0.4);
    this.scanlineOverlay.rotation.z = -this.portraitPlane.rotation.z * 0.74;

    const portraitMaterial = this.portraitPlane.material as StandardMaterial;
    portraitMaterial.emissiveColor = Color3.Lerp(
      portraitMaterial.emissiveColor,
      targetColor.scale((0.18 + beat * 0.26 * portraitReactive + this.fireEnergy * 0.12) * portraitLayer.intensity),
      0.12,
    );
    if (this.portraitTexture) {
      this.portraitTexture.uOffset = Math.sin(this.time * 0.06) * 0.006 + this.glitchEnergy * 0.01 * glitchAmount + postFxNoise * 0.004;
      this.portraitTexture.vOffset = Math.cos(this.time * 0.08) * 0.004;
    }
    if (this.scanlineTexture) {
      this.scanlineTexture.vOffset = (this.scanlineTexture.vOffset + audio.dt * (0.08 + audio.high * 0.12 * portraitReactive) * (0.8 + postFxScanlines * 0.8)) % 1;
    }
    const scanlineMaterial = this.scanlineOverlay.material as StandardMaterial;
    scanlineMaterial.alpha = portraitLayer.enabled
      ? Math.max(0.04, portraitLayer.opacity * (0.08 + beat * 0.08 * portraitReactive + this.glitchEnergy * 0.1 + postFxScanlines * 0.18) * glitchAmount)
      : 0;

    this.haloRings.forEach((ring, index) => {
      if (ring.axis === 'x') {
        ring.mesh.rotation.x += audio.dt * (ring.speed + audio.mid * 0.86 * ringsReactive + this.technoEnergy * 0.24) * ringRotationSpeed;
      } else if (ring.axis === 'y') {
        ring.mesh.rotation.y += audio.dt * (ring.speed + audio.high * 0.52 * ringsReactive + this.chatEnergy * 0.18) * ringRotationSpeed;
      } else {
        ring.mesh.rotation.z += audio.dt * (ring.speed + audio.bass * 0.34 * ringsReactive + this.fireEnergy * 0.16) * ringRotationSpeed;
      }
      ring.mesh.scaling.setAll(ring.baseScale + beat * 0.08 + (index === 0 ? this.fireEnergy * 0.04 : 0));
      ring.material.emissiveColor = Color3.Lerp(
        ring.material.emissiveColor,
        Color3.Lerp(this.portalColor, targetColor, 0.34 + index * 0.12).scale((0.12 + audio.high * 0.18 * ringsReactive + this.technoEnergy * 0.08) * ringsLayer.intensity),
        0.12,
      );
    });

    this.cityBlocks.forEach((block, index) => {
      const scaleY = 1 + (audio.bass * 0.16 * cityReactive + Math.max(0, Math.sin(this.time * 1.8 + block.phaseOffset)) * 0.12 + this.technoEnergy * 0.04) * cityHeightScale;
      block.mesh.scaling.y = scaleY;
      block.mesh.position.set(
        block.baseX,
        -2.56 + block.baseHeight * scaleY * 0.5,
        block.baseZ,
      );
      block.material.emissiveColor = Color3.Lerp(
        block.material.emissiveColor,
        Color3.Lerp(this.crowdColor, targetColor, 0.26 + ((index % 3) * 0.08)).scale((0.08 + audio.mid * 0.16 * cityReactive + this.chatEnergy * 0.08) * cityLayer.intensity),
        0.1,
      );
    });

    this.hudNodes.forEach((node, index) => {
      const angle = this.time * (node.speed + audio.mid * 0.9 * nodeReactive + this.chatEnergy * 0.26) * nodeOrbitSpeed + node.angleOffset;
      node.mesh.position.set(
        Math.cos(angle) * node.orbitRadius,
        0.92 + node.orbitHeight + Math.sin(angle * 1.8) * 0.18,
        Math.sin(angle) * node.orbitRadius * 0.52,
      );
      node.mesh.scaling.setAll(nodeSize * (0.9 + beat * 0.2 * nodeReactive + (index % 2 === 0 ? this.chatEnergy * 0.12 : this.technoEnergy * 0.1)));
      node.material.emissiveColor = Color3.Lerp(
        node.material.emissiveColor,
        Color3.Lerp(this.accentColor, targetColor, 0.42).scale((0.14 + audio.high * 0.2 * nodeReactive + this.chatEnergy * 0.12) * nodeLayer.intensity),
        0.14,
      );
    });

    this.glitchShards.forEach((shard, index) => {
      const angle = this.time * (shard.speed + audio.high * 0.8 * shardReactive + this.glitchEnergy * 0.28) * shardOrbitSpeed + shard.angleOffset;
      shard.mesh.position.set(
        Math.cos(angle) * shard.radius,
        0.84 + shard.lift + Math.sin(angle * 2) * 0.14,
        Math.sin(angle) * shard.radius * 0.38,
      );
      shard.mesh.rotation.z += audio.dt * (0.72 + index * 0.08 + this.glitchEnergy * 0.42) * shardOrbitSpeed;
      shard.mesh.rotation.y += audio.dt * (0.34 + this.fireEnergy * 0.12) * shardOrbitSpeed;
      shard.mesh.scaling.setAll(shardSize * (1 + audio.high * 0.18 * shardReactive + this.glitchEnergy * 0.12));
      shard.material.emissiveColor = Color3.Lerp(
        shard.material.emissiveColor,
        Color3.Lerp(this.crowdColor, targetColor, 0.46).scale((0.12 + audio.high * 0.22 * shardReactive + this.fireEnergy * 0.08) * shardLayer.intensity),
        0.14,
      );
    });

    if (this.portraitLight) {
      this.portraitLight.diffuse = targetColor;
      this.portraitLight.position.x = -postFxRgbSplit * 0.6;
      this.portraitLight.intensity = (0.64 + beat * 2.4 * portraitReactive + this.fireEnergy * 0.62 - this.darkEnergy * 0.5) * (0.7 + portraitLayer.intensity * 0.32);
    }
    if (this.cityLight) {
      this.cityLight.diffuse = Color3.Lerp(this.crowdColor, targetColor, 0.4);
      this.cityLight.position.x = postFxRgbSplit * 0.5;
      this.cityLight.intensity = (0.18 + audio.mid * 0.92 * cityReactive + this.chatEnergy * 0.28) * (0.68 + cityLayer.intensity * 0.32);
    }
    if (this.accentLight) {
      this.accentLight.diffuse = Color3.Lerp(this.accentColor, targetColor, 0.2);
      this.accentLight.intensity = (0.12 + audio.high * 0.52 * ringsReactive + this.technoEnergy * 0.18) * (0.66 + ringsLayer.intensity * 0.3);
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = 0.04 + audio.rms * 0.08 - this.darkEnergy * 0.04 - this.activeMix.postFx.vignette * 0.04;
    }
    if (this.glow) {
      this.glow.intensity = (0.16 + audio.high * 0.24 + this.glitchEnergy * 0.22 + this.phase.bloomBoost * 0.2) * postFxBloom;
    }

    const cameraOrbitSpeed = 0.04 + this.activeMix.camera.orbitSpeed * 0.14;
    const cameraShake = this.activeMix.camera.shake * (0.02 + beat * 0.02 + postFxNoise * 0.02);
    const cameraZoom = this.activeMix.camera.zoom;
    if (this.activeMix.camera.mode === 'slowPush') {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 0.1) * 0.03;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.08) * 0.03;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom - Math.sin(this.time * 0.16) * 0.18;
    } else if (this.activeMix.camera.mode === 'handheldFake') {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 1.6) * cameraShake;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 1.2) * cameraShake;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom + Math.sin(this.time * 0.7) * 0.06;
    } else if (this.activeMix.camera.mode === 'locked') {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 0.1) * cameraShake;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.08) * cameraShake * 0.8;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom;
    } else {
      this.arcCamera.alpha = this.baseCameraAlpha + this.time * cameraOrbitSpeed + Math.sin(this.time * 0.1) * 0.04;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.08) * 0.03;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom;
    }
    this.arcCamera.setTarget(this.baseCameraTarget);
    if (this.scene) {
      this.scene.fogDensity = this.baseFogDensity * (1 + this.activeMix.postFx.vignette * 0.36 + this.activeMix.postFx.noise * 0.06);
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
    this.pulseEnergy = clamp(this.pulseEnergy + impulse.intensity * 0.58, 0, 1.5);
    this.glitchEnergy = clamp(this.glitchEnergy + impulse.sparkle * 0.52, 0, 1.5);
    if (event.type === 'chat.message' || event.type === 'chat.emoji') {
      this.chatEnergy = clamp(this.chatEnergy + impulse.intensity * 0.74, 0, 1.4);
    }

    switch (reactionKindFromVisualEvent(event.type)) {
      case 'fire':
        this.fireEnergy = clamp(this.fireEnergy + impulse.intensity, 0, 1.4);
        break;
      case 'dark':
        this.darkEnergy = clamp(this.darkEnergy + impulse.intensity, 0, 1.2);
        break;
      case 'peace-love-techno':
        this.technoEnergy = clamp(this.technoEnergy + impulse.intensity, 0, 1.4);
        break;
      case 'acid':
        this.glitchEnergy = clamp(this.glitchEnergy + impulse.intensity * 0.36, 0, 1.5);
        break;
      default:
        break;
    }
  }

  resize(_width: number, _height: number): void {}

  dispose(): void {
    this.glow?.dispose();
    this.glow = null;
    this.portraitLight?.dispose();
    this.portraitLight = null;
    this.cityLight?.dispose();
    this.cityLight = null;
    this.accentLight?.dispose();
    this.accentLight = null;
    this.ambientLight?.dispose();
    this.ambientLight = null;
    this.root?.dispose(false, true);
    this.root = null;
    this.portraitPlane = null;
    this.scanlineOverlay = null;
    this.portraitTexture?.dispose();
    this.portraitTexture = null;
    this.scanlineTexture?.dispose();
    this.scanlineTexture = null;
    this.materials.forEach((material) => material.dispose());
    this.materials = [];
    this.haloRings = [];
    this.cityBlocks = [];
    this.hudNodes = [];
    this.glitchShards = [];
    this.scene = null;
    this.arcCamera?.dispose();
    this.arcCamera = null;
    this.camera = null;
    this.time = 0;
    this.pulseEnergy = 0;
    this.chatEnergy = 0;
    this.glitchEnergy = 0;
    this.darkEnergy = 0;
    this.fireEnergy = 0;
    this.technoEnergy = 0;
  }

  private setStandby(phase: ReturnType<typeof createDefaultControllerPhase>): void {
    this.phase = phase;
    const standbyColor = Color3.FromHexString(phase.accentHex);

    if (this.ambientLight) {
      this.ambientLight.intensity = 0.06;
    }
    if (this.portraitLight) {
      this.portraitLight.diffuse = standbyColor;
      this.portraitLight.intensity = 0.34;
    }
    if (this.cityLight) {
      this.cityLight.diffuse = standbyColor;
      this.cityLight.intensity = 0.16;
    }
    if (this.accentLight) {
      this.accentLight.diffuse = standbyColor;
      this.accentLight.intensity = 0.12;
    }
    if (this.glow) {
      this.glow.intensity = 0.12;
    }
  }
}