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

interface HudBar {
  mesh: Mesh;
  material: StandardMaterial;
  basePosition: Vector3;
  drift: number;
}

const clamp = (value: number, min = 0, max = 1.6): number => {
  return Math.min(max, Math.max(min, value));
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

const createBackdropTexture = (scene: Scene, accentHex: string): DynamicTexture => {
  const width = 1280;
  const height = 720;
  const texture = new DynamicTexture('arv-please-wait-terminal-backdrop', { width, height }, scene, false);
  const ctx = texture.getContext();

  ctx.fillStyle = '#04101b';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(77, 247, 255, 0.42)';
  ctx.lineWidth = 4;
  ctx.strokeRect(54, 52, width - 108, height - 104);
  ctx.strokeRect(110, 102, width - 220, height - 204);

  ctx.strokeStyle = 'rgba(111, 210, 255, 0.18)';
  ctx.lineWidth = 1;
  for (let index = 0; index < 26; index += 1) {
    const y = 90 + index * 22;
    ctx.beginPath();
    ctx.moveTo(110, y);
    ctx.lineTo(width - 110, y);
    ctx.stroke();
  }

  for (let index = 0; index < 14; index += 1) {
    ctx.fillStyle = index % 2 === 0 ? 'rgba(77, 247, 255, 0.18)' : 'rgba(111, 210, 255, 0.1)';
    ctx.fillRect(150 + (index % 7) * 136, 130 + Math.floor(index / 7) * 400, 88, 16);
  }

  ctx.strokeStyle = `${accentHex}55`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 156, 0, Math.PI * 2);
  ctx.stroke();

  for (let index = 0; index < 92; index += 1) {
    const y = (index / 92) * height;
    ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0)';
    ctx.fillRect(0, y, width, 3);
  }

  texture.update(false);
  return texture;
};

const createLoaderTexture = (scene: Scene, primaryHex: string, accentHex: string): DynamicTexture => {
  const size = 640;
  const texture = new DynamicTexture('arv-please-wait-terminal-loader', { width: size, height: size }, scene, false);
  const ctx = texture.getContext();
  const center = size / 2;

  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.strokeStyle = `${primaryHex}cc`;
  ctx.lineWidth = 7;
  for (let angle = 0; angle < Math.PI * 10; angle += 0.12) {
    const radius = 20 + angle * 15;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    if (angle === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = `${accentHex}7a`;
  ctx.lineWidth = 2;
  ctx.arc(center, center, 246, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(center, center, 182, 0, Math.PI * 2);
  ctx.stroke();

  texture.update(false);
  return texture;
};

const createScanlineTexture = (scene: Scene): DynamicTexture => {
  const width = 1024;
  const height = 1024;
  const texture = new DynamicTexture('arv-please-wait-terminal-scanlines', { width, height }, scene, false);
  const ctx = texture.getContext();

  ctx.clearRect(0, 0, width, height);
  for (let index = 0; index < 160; index += 1) {
    const y = (index / 160) * height;
    ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0)';
    ctx.fillRect(0, y, width, 3);
  }

  texture.hasAlpha = true;
  texture.update(false);
  return texture;
};

const PLEASE_WAIT_POST_FX = {
  bloom: 0.62,
  scanlines: 0.82,
  rgbSplit: 0.34,
  vignette: 0.32,
  noise: 0.28,
} as const;

const PLEASE_WAIT_CAMERA = {
  mode: 'locked',
  zoom: 1,
  orbitSpeed: 0.08,
  shake: 0.06,
} as const;

const PLEASE_WAIT_LAYER_SCHEMA: ARVLayerSchema[] = [
  {
    id: 'backdrop',
    label: 'Backdrop',
    controls: [
      { key: 'drift', label: 'Drift', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'signalIntensity', label: 'Signal Intensity', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'scanlines',
    label: 'Scanlines',
    controls: [
      { key: 'speed', label: 'Speed', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'strength', label: 'Strength', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'loader',
    label: 'Loader',
    controls: [
      { key: 'rotationSpeed', label: 'Rotation Speed', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'haloIntensity', label: 'Halo Intensity', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'scale', label: 'Scale', type: 'slider', target: 'controls', min: 0.5, max: 1.8, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'bars',
    label: 'Bars',
    controls: [
      { key: 'drift', label: 'Drift', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'size', label: 'Size', type: 'slider', target: 'controls', min: 0.5, max: 1.8, step: 0.01, defaultValue: 1 },
    ],
  },
  createPostFxSchema(PLEASE_WAIT_POST_FX),
  createCameraSchema(PLEASE_WAIT_CAMERA),
];

export const createPleaseWaitTerminalDefaultMixState = (presetId: string): ARVLiveMixState => {
  return {
    presetId,
    layers: {
      backdrop: createLayerState({ drift: 1, signalIntensity: 1 }, { audioReactive: false, blendMode: 'screen' }),
      scanlines: createLayerState({ speed: 1, strength: 1 }, { audioReactive: true, blendMode: 'screen' }),
      loader: createLayerState({ rotationSpeed: 1, haloIntensity: 1, scale: 1 }, { audioReactive: true, blendMode: 'add' }),
      bars: createLayerState({ drift: 1, size: 1 }, { audioReactive: true, blendMode: 'add' }),
    },
    postFx: { ...PLEASE_WAIT_POST_FX },
    camera: { ...PLEASE_WAIT_CAMERA },
  };
};

export class PleaseWaitTerminalController implements ARVSceneController {
  readonly id = 'arv-please-wait-terminal' as const;
  camera: Camera | null = null;

  private scene: Scene | null = null;
  private arcCamera: ArcRotateCamera | null = null;
  private root: TransformNode | null = null;
  private ambientLight: HemisphericLight | null = null;
  private cyanLight: PointLight | null = null;
  private accentLight: PointLight | null = null;
  private glow: GlowLayer | null = null;
  private backdropTexture: DynamicTexture | null = null;
  private loaderTexture: DynamicTexture | null = null;
  private scanlineTexture: DynamicTexture | null = null;
  private materials: StandardMaterial[] = [];
  private backdrop: Mesh | null = null;
  private scanlineOverlay: Mesh | null = null;
  private loaderPlane: Mesh | null = null;
  private loaderHalo: Mesh | null = null;
  private bars: HudBar[] = [];
  private phase = createDefaultControllerPhase('#4df7ff');
  private fallbackColor = '#4df7ff';
  private eventColor = Color3.FromHexString('#4df7ff');
  private portalColor = Color3.FromHexString('#4df7ff');
  private accentColor = Color3.FromHexString('#6fd2ff');
  private baseFogDensity = 0.012;
  private baseCameraAlpha = -Math.PI / 2;
  private baseCameraBeta = Math.PI / 2.05;
  private baseCameraRadius = 7.2;
  private baseCameraTarget = new Vector3(0, 0, 0);
  private activeMix = createPleaseWaitTerminalDefaultMixState('arv-please-wait-terminal');
  private time = 0;
  private pulseEnergy = 0;
  private glitchEnergy = 0;
  private darkEnergy = 0;
  private chatEnergy = 0;

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
    this.accentColor = Color3.FromHexString(preset.accentHex);

    const backgroundColor = Color3.FromHexString(preset.backgroundHex);
    scene.clearColor = new Color4(backgroundColor.r, backgroundColor.g, backgroundColor.b, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    this.baseFogDensity = quality.tier === 'eco' ? 0.018 : 0.012;
    scene.fogDensity = this.baseFogDensity;
    scene.fogColor = Color3.FromHexString(preset.fogHex);

    this.arcCamera = new ArcRotateCamera(
      'arv-please-wait-terminal-camera',
      -Math.PI / 2,
      Math.PI / 2.05,
      mode === 'obs' ? 6.8 : 7.2,
      new Vector3(0, 0, 0),
      scene,
    );
    this.arcCamera.inputs.clear();
    this.arcCamera.panningSensibility = 0;
    this.arcCamera.wheelPrecision = 100000;
    this.arcCamera.minZ = 0.1;
    this.arcCamera.maxZ = 30;
    this.baseCameraAlpha = this.arcCamera.alpha;
    this.baseCameraBeta = this.arcCamera.beta;
    this.baseCameraRadius = this.arcCamera.radius;
    this.baseCameraTarget = this.arcCamera.getTarget().clone();
    this.camera = this.arcCamera;

    this.ambientLight = new HemisphericLight('arv-please-wait-terminal-hemi', new Vector3(0, 1, 0), scene);
    this.ambientLight.intensity = 0.12;
    this.ambientLight.groundColor = Color3.FromHexString('#02060c');

    this.cyanLight = new PointLight('arv-please-wait-terminal-cyan', new Vector3(0, 0, -2), scene);
    this.cyanLight.diffuse = this.portalColor;
    this.cyanLight.intensity = 1.4;

    this.accentLight = new PointLight('arv-please-wait-terminal-accent', new Vector3(0, 2.2, 0.8), scene);
    this.accentLight.diffuse = this.accentColor;
    this.accentLight.intensity = 0.7;

    this.glow = new GlowLayer('arv-please-wait-terminal-glow', scene, {
      mainTextureRatio: quality.tier === 'eco' ? 0.4 : 0.58,
      blurKernelSize: quality.tier === 'obs' ? 42 : 28,
      mainTextureSamples: quality.tier === 'obs' ? 4 : 1,
    });
    this.glow.intensity = 0.62;

    this.backdropTexture = createBackdropTexture(scene, preset.accentHex);
    this.loaderTexture = createLoaderTexture(scene, preset.portalHex, preset.accentHex);
    this.scanlineTexture = createScanlineTexture(scene);

    const backdropMaterial = new StandardMaterial('arv-please-wait-terminal-backdrop-mat', scene);
    backdropMaterial.diffuseTexture = this.backdropTexture;
    backdropMaterial.emissiveTexture = this.backdropTexture;
    backdropMaterial.diffuseColor = Color3.FromHexString('#07111c');
    backdropMaterial.emissiveColor = this.portalColor.scale(0.24);
    backdropMaterial.backFaceCulling = false;
    this.materials.push(backdropMaterial);

    const scanlineMaterial = new StandardMaterial('arv-please-wait-terminal-scanline-mat', scene);
    scanlineMaterial.diffuseTexture = this.scanlineTexture;
    scanlineMaterial.emissiveTexture = this.scanlineTexture;
    scanlineMaterial.diffuseColor = Color3.FromHexString('#0a1118');
    scanlineMaterial.emissiveColor = Color3.FromHexString('#d8fbff').scale(0.08);
    scanlineMaterial.alpha = 0.22;
    scanlineMaterial.backFaceCulling = false;
    this.materials.push(scanlineMaterial);

    const loaderMaterial = new StandardMaterial('arv-please-wait-terminal-loader-mat', scene);
    loaderMaterial.diffuseTexture = this.loaderTexture;
    loaderMaterial.emissiveTexture = this.loaderTexture;
    loaderMaterial.diffuseColor = Color3.FromHexString('#08141f');
    loaderMaterial.emissiveColor = this.portalColor.scale(0.46);
    loaderMaterial.backFaceCulling = false;
    this.materials.push(loaderMaterial);

    const haloMaterial = createMaterial(scene, 'arv-please-wait-terminal-halo-mat', '#07131e', preset.accentHex, 0.92);
    haloMaterial.disableLighting = true;
    this.materials.push(haloMaterial);

    this.root = new TransformNode('arv-please-wait-terminal-root', scene);

    this.backdrop = MeshBuilder.CreatePlane(
      'arv-please-wait-terminal-backdrop',
      { width: 11.6, height: 6.6 },
      scene,
    );
    this.backdrop.parent = this.root;
    this.backdrop.position.z = 1.8;
    this.backdrop.material = backdropMaterial;

    this.scanlineOverlay = MeshBuilder.CreatePlane(
      'arv-please-wait-terminal-scanline-overlay',
      { width: 11.1, height: 6.1 },
      scene,
    );
    this.scanlineOverlay.parent = this.root;
    this.scanlineOverlay.position.z = 1.68;
    this.scanlineOverlay.material = scanlineMaterial;

    this.loaderPlane = MeshBuilder.CreatePlane(
      'arv-please-wait-terminal-loader',
      { width: 3.6, height: 3.6 },
      scene,
    );
    this.loaderPlane.parent = this.root;
    this.loaderPlane.position.z = 1.4;
    this.loaderPlane.material = loaderMaterial;

    this.loaderHalo = MeshBuilder.CreateTorus(
      'arv-please-wait-terminal-loader-halo',
      { diameter: 4.22, thickness: 0.08, tessellation: 96 },
      scene,
    );
    this.loaderHalo.parent = this.root;
    this.loaderHalo.position.z = 1.34;
    this.loaderHalo.rotation.x = Math.PI / 2;
    this.loaderHalo.material = haloMaterial;

    this.glow.addIncludedOnlyMesh(this.loaderPlane);
    this.glow.addIncludedOnlyMesh(this.loaderHalo);

    const barPalette = [preset.portalHex, preset.accentHex, '#d8fbff'];
    const barPositions = [
      new Vector3(-4.3, 1.8, 1.5),
      new Vector3(-4.3, 1.1, 1.5),
      new Vector3(-4.3, 0.4, 1.5),
      new Vector3(-4.3, -0.3, 1.5),
      new Vector3(4.3, 1.8, 1.5),
      new Vector3(4.3, 1.1, 1.5),
      new Vector3(4.3, 0.4, 1.5),
      new Vector3(4.3, -0.3, 1.5),
      new Vector3(0, -2.2, 1.52),
      new Vector3(0, 2.28, 1.52),
    ];

    barPositions.forEach((position, index) => {
      const material = createMaterial(
        scene,
        `arv-please-wait-terminal-bar-mat-${index}`,
        '#07111a',
        barPalette[index % barPalette.length],
        0.94,
      );
      material.disableLighting = true;
      this.materials.push(material);

      const mesh = MeshBuilder.CreateBox(
        `arv-please-wait-terminal-bar-${index}`,
        {
          width: index >= 8 ? 4.2 : 0.32,
          height: index >= 8 ? 0.12 : 0.46,
          depth: 0.04,
        },
        scene,
      );
      mesh.parent = this.root;
      mesh.position.copyFrom(position);
      mesh.material = material;
      this.glow?.addIncludedOnlyMesh(mesh);

      this.bars.push({
        mesh,
        material,
        basePosition: position,
        drift: index * 0.28,
      });
    });

    this.applyMixState(this.getDefaultMixState());
  }

  getLayerSchema(): ARVLayerSchema[] {
    return PLEASE_WAIT_LAYER_SCHEMA;
  }

  getDefaultMixState(): ARVLiveMixState {
    return createPleaseWaitTerminalDefaultMixState(this.preset?.id || 'arv-please-wait-terminal');
  }

  applyMixState(mix: ARVLiveMixState): void {
    this.activeMix = mix;

    const backdropLayer = getLayerState(mix, 'backdrop');
    setNodeEnabled([this.backdrop], backdropLayer.enabled);
    if (this.backdrop?.material instanceof StandardMaterial) {
      this.backdrop.material.alpha = Math.max(0.08, backdropLayer.opacity);
      applyMaterialBlendMode(backdropLayer.blendMode, [this.backdrop.material]);
    }

    const scanlineLayer = getLayerState(mix, 'scanlines');
    setNodeEnabled([this.scanlineOverlay], scanlineLayer.enabled);
    if (this.scanlineOverlay?.material instanceof StandardMaterial) {
      this.scanlineOverlay.material.alpha = Math.max(0.04, scanlineLayer.opacity * 0.22);
      applyMaterialBlendMode(scanlineLayer.blendMode, [this.scanlineOverlay.material]);
    }

    const loaderLayer = getLayerState(mix, 'loader');
    setNodeEnabled([this.loaderPlane, this.loaderHalo], loaderLayer.enabled);
    applyMaterialBlendMode(loaderLayer.blendMode, [
      this.loaderPlane?.material instanceof StandardMaterial ? this.loaderPlane.material : null,
      this.loaderHalo?.material instanceof StandardMaterial ? this.loaderHalo.material : null,
    ]);
    if (this.loaderPlane?.material instanceof StandardMaterial) {
      this.loaderPlane.material.alpha = Math.max(0.08, loaderLayer.opacity);
    }
    if (this.loaderHalo?.material instanceof StandardMaterial) {
      this.loaderHalo.material.alpha = Math.max(0.04, loaderLayer.opacity * 0.92);
    }

    const barsLayer = getLayerState(mix, 'bars');
    this.bars.forEach((bar) => {
      bar.mesh.setEnabled(barsLayer.enabled);
      bar.material.alpha = Math.max(0.04, barsLayer.opacity * 0.94);
    });
    applyMaterialBlendMode(barsLayer.blendMode, this.bars.map((bar) => bar.material));

    if (this.scene) {
      this.scene.fogDensity = this.baseFogDensity * (1 + mix.postFx.vignette * 0.28);
    }
  }

  update(audio: ARVAudioFrame): void {
    if (!this.arcCamera || !this.root || !this.loaderPlane || !this.loaderHalo || !this.backdrop || !this.scanlineOverlay) {
      return;
    }

    this.time += audio.dt;
    this.pulseEnergy *= Math.pow(0.14, audio.dt);
    this.glitchEnergy *= Math.pow(0.12, audio.dt);
    this.darkEnergy *= Math.pow(0.24, audio.dt);
    this.chatEnergy *= Math.pow(0.18, audio.dt);

    const backdropLayer = getLayerState(this.activeMix, 'backdrop');
    const scanlineLayer = getLayerState(this.activeMix, 'scanlines');
    const loaderLayer = getLayerState(this.activeMix, 'loader');
    const barsLayer = getLayerState(this.activeMix, 'bars');
    const backdropReactive = backdropLayer.audioReactive ? 1 : 0;
    const scanlineReactive = scanlineLayer.audioReactive ? 1 : 0;
    const loaderReactive = loaderLayer.audioReactive ? 1 : 0;
    const barsReactive = barsLayer.audioReactive ? 1 : 0;
    const backdropDrift = getLayerControlNumber(this.activeMix, 'backdrop', 'drift', 1);
    const backdropSignalIntensity = getLayerControlNumber(this.activeMix, 'backdrop', 'signalIntensity', 1);
    const scanlineSpeed = getLayerControlNumber(this.activeMix, 'scanlines', 'speed', 1);
    const scanlineStrength = getLayerControlNumber(this.activeMix, 'scanlines', 'strength', 1);
    const loaderRotationSpeed = getLayerControlNumber(this.activeMix, 'loader', 'rotationSpeed', 1);
    const loaderHaloIntensity = getLayerControlNumber(this.activeMix, 'loader', 'haloIntensity', 1);
    const loaderScale = getLayerControlNumber(this.activeMix, 'loader', 'scale', 1);
    const barDrift = getLayerControlNumber(this.activeMix, 'bars', 'drift', 1);
    const barSize = getLayerControlNumber(this.activeMix, 'bars', 'size', 1);
    const postFxBloom = 0.58 + this.activeMix.postFx.bloom * 0.76;
    const postFxRgbSplit = this.activeMix.postFx.rgbSplit;
    const postFxNoise = this.activeMix.postFx.noise;
    const postFxScanlines = this.activeMix.postFx.scanlines;

    const beat = Math.max(audio.kick, audio.high * 0.72, this.pulseEnergy * 0.84);
    const phaseColor = Color3.FromHexString(this.phase.accentHex);
    const targetColor = Color3.Lerp(
      phaseColor,
      this.eventColor,
      Math.min(1, 0.24 + this.pulseEnergy * 0.52 + this.chatEnergy * 0.12),
    );

    this.root.position.x = Math.sin(this.time * 18) * 0.012 * (beat + this.glitchEnergy * 0.6 + postFxNoise * 0.4);
    this.root.position.y = Math.cos(this.time * 9.2) * 0.008 * beat;

    this.loaderPlane.rotation.z -= audio.dt * (0.88 + audio.high * 3.2 * loaderReactive + this.chatEnergy * 0.42) * loaderRotationSpeed;
    this.loaderPlane.scaling.setAll(loaderScale * (1 + beat * 0.08 * loaderReactive + this.chatEnergy * 0.03));
    this.loaderHalo.rotation.z += audio.dt * (0.42 + audio.mid * 1.2 * loaderReactive) * loaderRotationSpeed;
    this.loaderHalo.scaling.setAll(loaderScale * (1 + beat * 0.12 * loaderReactive + this.pulseEnergy * 0.06));

    const loaderMaterial = this.loaderPlane.material as StandardMaterial;
    loaderMaterial.emissiveColor = Color3.Lerp(
      loaderMaterial.emissiveColor,
      targetColor.scale((0.18 + beat * 0.32 * loaderReactive + this.phase.bloomBoost * 0.2) * loaderLayer.intensity),
      0.12,
    );
    const haloMaterial = this.loaderHalo.material as StandardMaterial;
    haloMaterial.emissiveColor = Color3.Lerp(
      haloMaterial.emissiveColor,
      Color3.Lerp(this.accentColor, targetColor, 0.34).scale((0.14 + audio.mid * 0.34 * loaderReactive + postFxScanlines * 0.12) * loaderLayer.intensity * loaderHaloIntensity),
      0.12,
    );

    const backdropMaterial = this.backdrop.material as StandardMaterial;
    backdropMaterial.emissiveColor = Color3.Lerp(
      backdropMaterial.emissiveColor,
      targetColor.scale((0.06 + audio.high * 0.18 * backdropReactive + this.phase.bloomBoost * 0.08) * backdropLayer.intensity * backdropSignalIntensity),
      0.08,
    );
    if (this.backdropTexture) {
      this.backdropTexture.uOffset = Math.sin(this.time * 0.08) * 0.01 * backdropDrift + this.glitchEnergy * 0.008 + postFxNoise * 0.004;
      this.backdropTexture.vOffset = Math.cos(this.time * 0.05) * 0.008 * backdropDrift;
    }
    if (this.scanlineTexture) {
      this.scanlineTexture.vOffset = (this.scanlineTexture.vOffset + audio.dt * (0.06 + audio.high * 0.08 * scanlineReactive) * scanlineSpeed) % 1;
    }
    const scanlineMaterial = this.scanlineOverlay.material as StandardMaterial;
    scanlineMaterial.alpha = scanlineLayer.enabled
      ? Math.max(0.04, scanlineLayer.opacity * (0.1 + beat * 0.1 * scanlineReactive + this.glitchEnergy * 0.08 + postFxScanlines * 0.18) * scanlineStrength)
      : 0;

    this.bars.forEach((bar, index) => {
      const wobble = Math.sin(this.time * (0.8 + index * 0.06) + bar.drift) * 0.04 * barDrift;
      if (index >= 8) {
        bar.mesh.position.y = bar.basePosition.y + wobble * 0.4;
      } else {
        bar.mesh.position.x = bar.basePosition.x + (bar.basePosition.x < 0 ? -wobble : wobble);
      }
      bar.mesh.scaling.setAll(barSize * (1 + audio.mid * 0.04 * barsReactive + ((index % 3) === 0 ? this.chatEnergy * 0.06 : 0)));
      bar.material.emissiveColor = Color3.Lerp(
        bar.material.emissiveColor,
        Color3.Lerp(this.portalColor, targetColor, 0.28).scale((0.08 + audio.high * 0.2 * barsReactive + this.chatEnergy * 0.12) * barsLayer.intensity),
        0.12,
      );
    });

    if (this.cyanLight) {
      this.cyanLight.diffuse = targetColor;
      this.cyanLight.position.x = -postFxRgbSplit * 0.8;
      this.cyanLight.intensity = (0.34 + beat * 2.2 * loaderReactive - this.darkEnergy * 0.24) * (0.7 + loaderLayer.intensity * 0.32);
    }
    if (this.accentLight) {
      this.accentLight.diffuse = Color3.Lerp(this.accentColor, targetColor, 0.24);
      this.accentLight.position.x = postFxRgbSplit * 0.64;
      this.accentLight.intensity = (0.14 + audio.mid * 0.86 * barsReactive + this.chatEnergy * 0.22) * (0.68 + barsLayer.intensity * 0.32);
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = 0.04 + audio.rms * 0.06 - this.darkEnergy * 0.03 - this.activeMix.postFx.vignette * 0.04;
    }
    if (this.glow) {
      this.glow.intensity = (0.14 + audio.high * 0.3 + this.phase.bloomBoost * 0.22) * postFxBloom;
    }

    const cameraOrbitSpeed = 0.03 + this.activeMix.camera.orbitSpeed * 0.12;
    const cameraShake = this.activeMix.camera.shake * (0.02 + beat * 0.02 + postFxNoise * 0.02);
    const cameraZoom = this.activeMix.camera.zoom;
    if (this.activeMix.camera.mode === 'slowOrbit') {
      this.arcCamera.alpha = this.baseCameraAlpha + this.time * cameraOrbitSpeed + Math.sin(this.time * 0.06) * 0.02;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.08) * 0.02;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom;
    } else if (this.activeMix.camera.mode === 'slowPush') {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 0.08) * 0.02;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.08) * 0.02;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom - Math.sin(this.time * 0.18) * 0.12;
    } else if (this.activeMix.camera.mode === 'handheldFake') {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 1.8) * cameraShake;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 1.4) * cameraShake;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom + Math.sin(this.time * 0.72) * 0.06;
    } else {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 0.06) * cameraShake;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.08) * cameraShake * 0.8;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom;
    }
    this.arcCamera.setTarget(this.baseCameraTarget);
    if (this.scene) {
      this.scene.fogDensity = this.baseFogDensity * (1 + this.activeMix.postFx.vignette * 0.28 + this.activeMix.postFx.noise * 0.06);
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
    this.pulseEnergy = clamp(this.pulseEnergy + impulse.intensity * 0.54, 0, 1.5);
    this.glitchEnergy = clamp(this.glitchEnergy + impulse.sparkle * 0.44, 0, 1.4);
    if (event.type === 'chat.message' || event.type === 'chat.emoji') {
      this.chatEnergy = clamp(this.chatEnergy + impulse.intensity * 0.66, 0, 1.4);
    }
    if (reactionKindFromVisualEvent(event.type) === 'dark') {
      this.darkEnergy = clamp(this.darkEnergy + impulse.intensity, 0, 1.1);
    }
  }

  resize(_width: number, _height: number): void {}

  dispose(): void {
    this.glow?.dispose();
    this.glow = null;
    this.cyanLight?.dispose();
    this.cyanLight = null;
    this.accentLight?.dispose();
    this.accentLight = null;
    this.ambientLight?.dispose();
    this.ambientLight = null;
    this.root?.dispose(false, true);
    this.root = null;
    this.backdrop?.dispose(false, true);
    this.backdrop = null;
    this.scanlineOverlay?.dispose(false, true);
    this.scanlineOverlay = null;
    this.loaderPlane?.dispose(false, true);
    this.loaderPlane = null;
    this.loaderHalo?.dispose(false, true);
    this.loaderHalo = null;
    this.backdropTexture?.dispose();
    this.backdropTexture = null;
    this.loaderTexture?.dispose();
    this.loaderTexture = null;
    this.scanlineTexture?.dispose();
    this.scanlineTexture = null;
    this.materials.forEach((material) => material.dispose());
    this.materials = [];
    this.bars = [];
    this.scene = null;
    this.arcCamera?.dispose();
    this.arcCamera = null;
    this.camera = null;
    this.time = 0;
    this.pulseEnergy = 0;
    this.glitchEnergy = 0;
    this.darkEnergy = 0;
    this.chatEnergy = 0;
  }

  private setStandby(phase: ReturnType<typeof createDefaultControllerPhase>): void {
    this.phase = phase;
    const standbyColor = Color3.FromHexString(phase.accentHex);

    if (this.ambientLight) {
      this.ambientLight.intensity = 0.06;
    }
    if (this.cyanLight) {
      this.cyanLight.diffuse = standbyColor;
      this.cyanLight.intensity = 0.16;
    }
    if (this.accentLight) {
      this.accentLight.diffuse = standbyColor;
      this.accentLight.intensity = 0.08;
    }
    if (this.glow) {
      this.glow.intensity = 0.08;
    }
    if (this.loaderPlane && this.loaderPlane.material instanceof StandardMaterial) {
      this.loaderPlane.scaling.setAll(1);
      this.loaderPlane.material.emissiveColor = standbyColor.scale(0.16);
    }
    if (this.loaderHalo && this.loaderHalo.material instanceof StandardMaterial) {
      this.loaderHalo.scaling.setAll(1);
      this.loaderHalo.material.emissiveColor = standbyColor.scale(0.12);
    }
    if (this.backdrop && this.backdrop.material instanceof StandardMaterial) {
      this.backdrop.material.emissiveColor = standbyColor.scale(0.06);
    }
    if (this.scanlineOverlay && this.scanlineOverlay.material instanceof StandardMaterial) {
      this.scanlineOverlay.material.alpha = 0.08;
    }

    this.bars.forEach((bar) => {
      bar.mesh.position.copyFrom(bar.basePosition);
      bar.mesh.scaling.setAll(1);
      bar.material.emissiveColor = standbyColor.scale(0.08);
    });
  }
}