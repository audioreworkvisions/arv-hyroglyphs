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

interface DustOrb {
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

const createGroundTexture = (scene: Scene): DynamicTexture => {
  const size = 1024;
  const texture = new DynamicTexture('arv-last-connector-ground', { width: size, height: size }, scene, false);
  const ctx = texture.getContext();
  const center = size / 2;

  const gradient = ctx.createRadialGradient(center, center, 12, center, center, center);
  gradient.addColorStop(0, 'rgba(18,24,36,0.98)');
  gradient.addColorStop(0.48, 'rgba(10,14,22,0.95)');
  gradient.addColorStop(1, 'rgba(5,8,14,1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  for (let index = 0; index < 7; index += 1) {
    ctx.beginPath();
    ctx.strokeStyle = index % 2 === 0 ? 'rgba(126, 203, 255, 0.09)' : 'rgba(255,255,255,0.03)';
    ctx.lineWidth = index === 0 ? 5 : 2;
    ctx.arc(center, center, 120 + index * 78, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let index = 0; index < 160; index += 1) {
    const x = (Math.sin(index * 37.17) * 0.5 + 0.5) * size;
    const y = (Math.cos(index * 19.91) * 0.5 + 0.5) * size;
    const alpha = 0.04 + (index % 4) * 0.02;
    ctx.fillStyle = `rgba(180, 212, 255, ${alpha})`;
    ctx.fillRect(x, y, 2 + (index % 2), 2 + ((index + 1) % 2));
  }

  texture.update(false);
  return texture;
};

const LAST_CONNECTOR_POST_FX = {
  bloom: 0.56,
  scanlines: 0.16,
  rgbSplit: 0.18,
  vignette: 0.44,
  noise: 0.12,
} as const;

const LAST_CONNECTOR_CAMERA = {
  mode: 'slowPush',
  zoom: 1,
  orbitSpeed: 0.14,
  shake: 0.04,
} as const;

const LAST_CONNECTOR_LAYER_SCHEMA: ARVLayerSchema[] = [
  {
    id: 'ground',
    label: 'Ground',
    controls: [
      { key: 'textureDrift', label: 'Texture Drift', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'signalIntensity', label: 'Signal Intensity', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'shockwave',
    label: 'Shockwave',
    controls: [
      { key: 'size', label: 'Size', type: 'slider', target: 'controls', min: 0.4, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'burst', label: 'Burst', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'connector',
    label: 'Connector',
    controls: [
      { key: 'lift', label: 'Lift', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'tipIntensity', label: 'Tip Intensity', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
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
  createPostFxSchema(LAST_CONNECTOR_POST_FX),
  createCameraSchema(LAST_CONNECTOR_CAMERA),
];

export const createLastConnectorDefaultMixState = (presetId: string): ARVLiveMixState => {
  return {
    presetId,
    layers: {
      ground: createLayerState({ textureDrift: 1, signalIntensity: 1 }, { audioReactive: true, blendMode: 'screen' }),
      shockwave: createLayerState({ size: 1, burst: 1 }, { audioReactive: true, blendMode: 'add' }),
      connector: createLayerState({ lift: 1, tipIntensity: 1 }, { audioReactive: true, blendMode: 'screen' }),
      dustOrbs: createLayerState({ drift: 1, size: 1 }, { audioReactive: true, blendMode: 'add' }),
    },
    postFx: { ...LAST_CONNECTOR_POST_FX },
    camera: { ...LAST_CONNECTOR_CAMERA },
  };
};

export class LastConnectorController implements ARVSceneController {
  readonly id = 'arv-last-connector' as const;
  camera: Camera | null = null;

  private scene: Scene | null = null;
  private arcCamera: ArcRotateCamera | null = null;
  private root: TransformNode | null = null;
  private ambientLight: HemisphericLight | null = null;
  private rimLight: PointLight | null = null;
  private keyLight: PointLight | null = null;
  private glow: GlowLayer | null = null;
  private groundTexture: DynamicTexture | null = null;
  private materials: StandardMaterial[] = [];
  private ground: Mesh | null = null;
  private shockwave: Mesh | null = null;
  private connectorParts: Mesh[] = [];
  private connectorPartBaseY: number[] = [];
  private dustOrbs: DustOrb[] = [];
  private phase = createDefaultControllerPhase('#7ecbff');
  private fallbackColor = '#7ecbff';
  private eventColor = Color3.FromHexString('#7ecbff');
  private portalColor = Color3.FromHexString('#7ecbff');
  private accentColor = Color3.FromHexString('#d8ecff');
  private baseFogDensity = 0.016;
  private baseCameraAlpha = -Math.PI / 2.58;
  private baseCameraBeta = Math.PI / 2.34;
  private baseCameraRadius = 9.1;
  private baseCameraTarget = new Vector3(0, 1.6, 0);
  private activeMix = createLastConnectorDefaultMixState('arv-last-connector');
  private time = 0;
  private shockwaveEnergy = 0;
  private fireEnergy = 0;
  private acidEnergy = 0;
  private darkEnergy = 0;
  private pulseEnergy = 0;

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
    this.baseFogDensity = quality.tier === 'eco' ? 0.022 : 0.016;
    scene.fogDensity = this.baseFogDensity;
    scene.fogColor = Color3.FromHexString(preset.fogHex);

    this.arcCamera = new ArcRotateCamera(
      'arv-last-connector-camera',
      -Math.PI / 2.58,
      Math.PI / 2.34,
      mode === 'obs' ? 8.4 : 9.1,
      new Vector3(0, 1.6, 0),
      scene,
    );
    this.arcCamera.inputs.clear();
    this.arcCamera.panningSensibility = 0;
    this.arcCamera.wheelPrecision = 100000;
    this.arcCamera.minZ = 0.1;
    this.arcCamera.maxZ = 50;
    this.baseCameraAlpha = this.arcCamera.alpha;
    this.baseCameraBeta = this.arcCamera.beta;
    this.baseCameraRadius = this.arcCamera.radius;
    this.baseCameraTarget = this.arcCamera.getTarget().clone();
    this.camera = this.arcCamera;

    this.ambientLight = new HemisphericLight('arv-last-connector-hemi', new Vector3(0, 1, 0), scene);
    this.ambientLight.intensity = 0.18;
    this.ambientLight.groundColor = Color3.FromHexString('#04070e');

    this.rimLight = new PointLight('arv-last-connector-rim', new Vector3(-3.2, 4.2, -3.6), scene);
    this.rimLight.diffuse = this.portalColor;
    this.rimLight.intensity = 1.14;

    this.keyLight = new PointLight('arv-last-connector-key', new Vector3(2.4, 2.8, 2.8), scene);
    this.keyLight.diffuse = this.accentColor;
    this.keyLight.intensity = 0.72;

    this.glow = new GlowLayer('arv-last-connector-glow', scene, {
      mainTextureRatio: quality.tier === 'eco' ? 0.4 : 0.58,
      blurKernelSize: quality.tier === 'obs' ? 42 : 28,
      mainTextureSamples: quality.tier === 'obs' ? 4 : 1,
    });
    this.glow.intensity = 0.56;

    this.groundTexture = createGroundTexture(scene);
    const groundMaterial = new StandardMaterial('arv-last-connector-ground-mat', scene);
    groundMaterial.diffuseTexture = this.groundTexture;
    groundMaterial.emissiveTexture = this.groundTexture;
    groundMaterial.diffuseColor = Color3.FromHexString('#0b0f17');
    groundMaterial.emissiveColor = this.portalColor.scale(0.08);
    this.materials.push(groundMaterial);

    this.ground = MeshBuilder.CreateCylinder(
      'arv-last-connector-ground',
      { height: 0.28, diameter: 10.8, tessellation: 96 },
      scene,
    );
    this.ground.position.y = -0.14;
    this.ground.material = groundMaterial;

    const shockwaveMaterial = createMaterial(scene, 'arv-last-connector-shockwave-mat', '#05101d', preset.portalHex, 0.28);
    shockwaveMaterial.disableLighting = true;
    this.materials.push(shockwaveMaterial);

    this.shockwave = MeshBuilder.CreateTorus(
      'arv-last-connector-shockwave',
      { diameter: 2.4, thickness: 0.06, tessellation: 96 },
      scene,
    );
    this.shockwave.rotation.x = Math.PI / 2;
    this.shockwave.position.y = 0.02;
    this.shockwave.material = shockwaveMaterial;

    this.root = new TransformNode('arv-last-connector-root', scene);
    this.root.position.y = 0.14;

    const sleeveMaterial = createMaterial(scene, 'arv-last-connector-sleeve-mat', '#0b1018', '#11223b', 1);
    sleeveMaterial.specularColor = Color3.FromHexString('#7ecbff');
    this.materials.push(sleeveMaterial);

    const metalMaterial = createMaterial(scene, 'arv-last-connector-metal-mat', '#9ba9b8', '#3f5f86', 1);
    metalMaterial.specularColor = Color3.FromHexString('#ffffff');
    this.materials.push(metalMaterial);

    const insulatorMaterial = createMaterial(scene, 'arv-last-connector-insulator-mat', '#0c1018', '#1a2741', 1);
    this.materials.push(insulatorMaterial);

    const tipMaterial = createMaterial(scene, 'arv-last-connector-tip-mat', '#d7e3ef', preset.portalHex, 1);
    tipMaterial.specularColor = Color3.FromHexString('#ffffff');
    this.materials.push(tipMaterial);

    const pedestal = MeshBuilder.CreateCylinder(
      'arv-last-connector-pedestal',
      { height: 0.62, diameter: 1.32, tessellation: 48 },
      scene,
    );
    pedestal.parent = this.root;
    pedestal.position.y = 0.31;
    pedestal.material = sleeveMaterial;

    const sleeve = MeshBuilder.CreateCylinder(
      'arv-last-connector-sleeve',
      { height: 2.14, diameter: 0.92, tessellation: 48 },
      scene,
    );
    sleeve.parent = this.root;
    sleeve.position.y = 1.66;
    sleeve.material = sleeveMaterial;

    const ringA = MeshBuilder.CreateCylinder(
      'arv-last-connector-ring-a',
      { height: 0.18, diameter: 0.56, tessellation: 32 },
      scene,
    );
    ringA.parent = this.root;
    ringA.position.y = 2.76;
    ringA.material = insulatorMaterial;

    const shaft = MeshBuilder.CreateCylinder(
      'arv-last-connector-shaft',
      { height: 2.26, diameter: 0.42, tessellation: 32 },
      scene,
    );
    shaft.parent = this.root;
    shaft.position.y = 3.8;
    shaft.material = metalMaterial;

    const ringB = MeshBuilder.CreateCylinder(
      'arv-last-connector-ring-b',
      { height: 0.16, diameter: 0.48, tessellation: 32 },
      scene,
    );
    ringB.parent = this.root;
    ringB.position.y = 4.82;
    ringB.material = insulatorMaterial;

    const tip = MeshBuilder.CreateCylinder(
      'arv-last-connector-tip',
      { height: 0.86, diameterTop: 0.08, diameterBottom: 0.28, tessellation: 32 },
      scene,
    );
    tip.parent = this.root;
    tip.position.y = 5.34;
    tip.material = tipMaterial;

    const collar = MeshBuilder.CreateTorus(
      'arv-last-connector-collar',
      { diameter: 0.88, thickness: 0.05, tessellation: 64 },
      scene,
    );
    collar.parent = this.root;
    collar.position.y = 2.4;
    collar.rotation.x = Math.PI / 2;
    collar.material = tipMaterial;

    this.connectorParts = [pedestal, sleeve, ringA, shaft, ringB, tip, collar];
    this.connectorPartBaseY = this.connectorParts.map((mesh) => mesh.position.y);
    this.connectorParts.forEach((mesh) => this.glow?.addIncludedOnlyMesh(mesh));
    this.glow.addIncludedOnlyMesh(this.shockwave);

    const orbCount = quality.tier === 'eco' ? 8 : 12;
    for (let index = 0; index < orbCount; index += 1) {
      const orbMaterial = createMaterial(
        scene,
        `arv-last-connector-orb-mat-${index}`,
        '#08101b',
        index % 2 === 0 ? preset.portalHex : preset.accentHex,
        0.84,
      );
      orbMaterial.disableLighting = true;
      this.materials.push(orbMaterial);

      const mesh = MeshBuilder.CreateSphere(
        `arv-last-connector-orb-${index}`,
        { diameter: 0.08 + (index % 3) * 0.03, segments: 8 },
        scene,
      );
      const basePosition = new Vector3(
        Math.cos(index * 0.74) * (3.1 + (index % 4) * 0.6),
        0.2 + (index % 5) * 0.44,
        Math.sin(index * 0.62) * (2.1 + (index % 3) * 0.4),
      );
      mesh.position.copyFrom(basePosition);
      mesh.material = orbMaterial;
      this.glow.addIncludedOnlyMesh(mesh);

      this.dustOrbs.push({
        mesh,
        material: orbMaterial,
        basePosition,
        drift: index * 0.36,
      });
    }

    this.applyMixState(this.getDefaultMixState());
  }

  getLayerSchema(): ARVLayerSchema[] {
    return LAST_CONNECTOR_LAYER_SCHEMA;
  }

  getDefaultMixState(): ARVLiveMixState {
    return createLastConnectorDefaultMixState(this.preset?.id || 'arv-last-connector');
  }

  applyMixState(mix: ARVLiveMixState): void {
    this.activeMix = mix;

    const groundLayer = getLayerState(mix, 'ground');
    setNodeEnabled([this.ground], groundLayer.enabled);
    if (this.ground?.material instanceof StandardMaterial) {
      this.ground.material.alpha = Math.max(0.08, groundLayer.opacity);
      applyMaterialBlendMode(groundLayer.blendMode, [this.ground.material]);
    }

    const shockwaveLayer = getLayerState(mix, 'shockwave');
    setNodeEnabled([this.shockwave], shockwaveLayer.enabled);
    if (this.shockwave?.material instanceof StandardMaterial) {
      this.shockwave.material.alpha = Math.max(0.04, shockwaveLayer.opacity * 0.28);
      applyMaterialBlendMode(shockwaveLayer.blendMode, [this.shockwave.material]);
    }

    const connectorLayer = getLayerState(mix, 'connector');
    this.connectorParts.forEach((mesh) => {
      mesh.setEnabled(connectorLayer.enabled);
      if (mesh.material instanceof StandardMaterial) {
        mesh.material.alpha = Math.max(0.08, connectorLayer.opacity);
      }
    });
    applyMaterialBlendMode(
      connectorLayer.blendMode,
      this.connectorParts.map((mesh) => (mesh.material instanceof StandardMaterial ? mesh.material : null)),
    );

    const dustLayer = getLayerState(mix, 'dustOrbs');
    this.dustOrbs.forEach((orb) => {
      orb.mesh.setEnabled(dustLayer.enabled);
      orb.material.alpha = Math.max(0.04, dustLayer.opacity * 0.84);
    });
    applyMaterialBlendMode(dustLayer.blendMode, this.dustOrbs.map((orb) => orb.material));

    if (this.scene) {
      this.scene.fogDensity = this.baseFogDensity * (1 + mix.postFx.vignette * 0.38);
    }
  }

  update(audio: ARVAudioFrame): void {
    if (!this.arcCamera || !this.root || !this.shockwave || !this.ground) {
      return;
    }

    this.time += audio.dt;
    this.pulseEnergy *= Math.pow(0.14, audio.dt);
    this.shockwaveEnergy *= Math.pow(0.08, audio.dt);
    this.fireEnergy *= Math.pow(0.18, audio.dt);
    this.acidEnergy *= Math.pow(0.18, audio.dt);
    this.darkEnergy *= Math.pow(0.24, audio.dt);

    const groundLayer = getLayerState(this.activeMix, 'ground');
    const shockwaveLayer = getLayerState(this.activeMix, 'shockwave');
    const connectorLayer = getLayerState(this.activeMix, 'connector');
    const dustLayer = getLayerState(this.activeMix, 'dustOrbs');
    const groundReactive = groundLayer.audioReactive ? 1 : 0;
    const shockwaveReactive = shockwaveLayer.audioReactive ? 1 : 0;
    const connectorReactive = connectorLayer.audioReactive ? 1 : 0;
    const dustReactive = dustLayer.audioReactive ? 1 : 0;
    const groundTextureDrift = getLayerControlNumber(this.activeMix, 'ground', 'textureDrift', 1);
    const groundSignalIntensity = getLayerControlNumber(this.activeMix, 'ground', 'signalIntensity', 1);
    const shockwaveSize = getLayerControlNumber(this.activeMix, 'shockwave', 'size', 1);
    const shockwaveBurst = getLayerControlNumber(this.activeMix, 'shockwave', 'burst', 1);
    const connectorLift = getLayerControlNumber(this.activeMix, 'connector', 'lift', 1);
    const connectorTipIntensity = getLayerControlNumber(this.activeMix, 'connector', 'tipIntensity', 1);
    const dustDrift = getLayerControlNumber(this.activeMix, 'dustOrbs', 'drift', 1);
    const dustSize = getLayerControlNumber(this.activeMix, 'dustOrbs', 'size', 1);
    const postFxBloom = 0.54 + this.activeMix.postFx.bloom * 0.72;
    const postFxRgbSplit = this.activeMix.postFx.rgbSplit;
    const postFxNoise = this.activeMix.postFx.noise;
    const postFxScanlines = this.activeMix.postFx.scanlines;

    const beat = Math.max(audio.kick, audio.bass * 0.8, this.pulseEnergy * 0.74);
    this.shockwaveEnergy = clamp(Math.max(this.shockwaveEnergy, beat * 0.9), 0, 1.6);

    const phaseColor = Color3.FromHexString(this.phase.accentHex);
    const targetColor = Color3.Lerp(
      phaseColor,
      this.eventColor,
      Math.min(1, 0.24 + this.pulseEnergy * 0.52 + this.acidEnergy * 0.12),
    );

    this.root.rotation.y += audio.dt * (0.06 + this.phase.energy * 0.04);
    this.root.position.y = 0.14 + audio.bass * 0.06;

    const shockwaveScale = shockwaveSize * (1 + this.shockwaveEnergy * 1.6 * shockwaveBurst + audio.kick * 0.24 * shockwaveReactive);
    this.shockwave.scaling.setAll(shockwaveScale);
    const shockwaveMaterial = this.shockwave.material as StandardMaterial;
    shockwaveMaterial.emissiveColor = Color3.Lerp(
      shockwaveMaterial.emissiveColor,
      targetColor.scale((0.22 + this.shockwaveEnergy * 0.4 * shockwaveReactive) * shockwaveLayer.intensity * shockwaveBurst),
      0.14,
    );
    shockwaveMaterial.alpha = shockwaveLayer.enabled
      ? Math.max(0.04, shockwaveLayer.opacity * (0.12 + this.shockwaveEnergy * 0.22 * shockwaveReactive))
      : 0;

    const groundMaterial = this.ground.material as StandardMaterial;
    groundMaterial.emissiveColor = Color3.Lerp(
      groundMaterial.emissiveColor,
      targetColor.scale((0.04 + beat * 0.16 * groundReactive + this.phase.bloomBoost * 0.12 + postFxScanlines * 0.08) * groundLayer.intensity * groundSignalIntensity),
      0.08,
    );
    if (this.groundTexture) {
      this.groundTexture.uOffset = Math.sin(this.time * 0.05) * 0.006 * groundTextureDrift + postFxNoise * 0.002;
      this.groundTexture.vOffset = Math.cos(this.time * 0.04) * 0.006 * groundTextureDrift;
    }

    this.connectorParts.forEach((mesh, index) => {
      if (!(mesh.material instanceof StandardMaterial)) {
        return;
      }

      const lift = index >= 3 ? beat * 0.05 * connectorReactive : audio.rms * 0.02 * connectorReactive;
      const baseY = this.connectorPartBaseY[index] ?? mesh.position.y;
      mesh.position.y = baseY + Math.sin(this.time * (0.2 + index * 0.03)) * 0.02 * connectorLift + lift * 0.08 * connectorLift;
      mesh.material.emissiveColor = Color3.Lerp(
        mesh.material.emissiveColor,
        Color3.Lerp(this.portalColor, targetColor, index >= 5 ? 0.7 : 0.24).scale(
          (index >= 5
            ? 0.18 + beat * 0.4 * connectorReactive + this.fireEnergy * 0.18
            : 0.08 + audio.mid * 0.08 * connectorReactive)
            * connectorLayer.intensity
            * (index >= 5 ? connectorTipIntensity : 1),
        ),
        0.1,
      );
    });

    this.dustOrbs.forEach((orb, index) => {
      orb.mesh.position.set(
        orb.basePosition.x + Math.sin(this.time * 0.44 + orb.drift) * 0.14 * dustDrift,
        orb.basePosition.y + Math.cos(this.time * 0.7 + orb.drift) * 0.16 * dustDrift,
        orb.basePosition.z + Math.sin(this.time * 0.34 + orb.drift) * 0.08 * dustDrift,
      );
      orb.mesh.scaling.setAll(dustSize * (0.9 + audio.high * 0.18 * dustReactive + ((index % 3) === 0 ? beat * 0.18 * dustReactive : 0)));
      orb.material.emissiveColor = Color3.Lerp(
        orb.material.emissiveColor,
        targetColor.scale((0.08 + audio.high * 0.22 * dustReactive) * dustLayer.intensity),
        0.1,
      );
    });

    if (this.rimLight) {
      this.rimLight.diffuse = targetColor;
      this.rimLight.position.x = -3.2 - postFxRgbSplit * 0.6;
      this.rimLight.intensity = (0.32 + beat * 2.1 * shockwaveReactive - this.darkEnergy * 0.28) * (0.7 + shockwaveLayer.intensity * 0.32);
    }
    if (this.keyLight) {
      this.keyLight.diffuse = Color3.Lerp(this.accentColor, targetColor, 0.22);
      this.keyLight.position.x = 2.4 + postFxRgbSplit * 0.56;
      this.keyLight.intensity = (0.18 + audio.mid * 0.86 * connectorReactive + this.phase.energy * 0.28) * (0.66 + connectorLayer.intensity * 0.34);
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = 0.06 + audio.rms * 0.08 - this.darkEnergy * 0.04 - this.activeMix.postFx.vignette * 0.04;
    }
    if (this.glow) {
      this.glow.intensity = (0.16 + beat * 0.28 + this.phase.bloomBoost * 0.22) * postFxBloom;
    }

    const cameraOrbitSpeed = 0.04 + this.activeMix.camera.orbitSpeed * 0.14;
    const cameraShake = this.activeMix.camera.shake * (0.02 + beat * 0.02 + postFxNoise * 0.02);
    const cameraZoom = this.activeMix.camera.zoom;
    if (this.activeMix.camera.mode === 'slowOrbit') {
      this.arcCamera.alpha = this.baseCameraAlpha + this.time * cameraOrbitSpeed + Math.sin(this.time * 0.1) * 0.04;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.12) * 0.03;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom;
    } else if (this.activeMix.camera.mode === 'handheldFake') {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 1.4) * cameraShake + Math.cos(this.time * 0.18) * 0.03;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 1.1) * cameraShake;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom + Math.sin(this.time * 0.72) * 0.08;
    } else if (this.activeMix.camera.mode === 'locked') {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 0.1) * cameraShake;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.12) * cameraShake * 0.7;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom;
    } else {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 0.1) * 0.06;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.12) * 0.03;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom - Math.sin(this.time * 0.18) * 0.18;
    }
    this.arcCamera.setTarget(this.baseCameraTarget);
    if (this.scene) {
      this.scene.fogDensity = this.baseFogDensity * (1 + this.activeMix.postFx.vignette * 0.38 + this.activeMix.postFx.noise * 0.06);
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
    this.shockwaveEnergy = clamp(this.shockwaveEnergy + impulse.burst * 0.72, 0, 1.6);

    switch (reactionKindFromVisualEvent(event.type)) {
      case 'fire':
        this.fireEnergy = clamp(this.fireEnergy + impulse.intensity, 0, 1.4);
        break;
      case 'acid':
        this.acidEnergy = clamp(this.acidEnergy + impulse.intensity, 0, 1.4);
        break;
      case 'dark':
        this.darkEnergy = clamp(this.darkEnergy + impulse.intensity, 0, 1.1);
        break;
      default:
        break;
    }
  }

  resize(_width: number, _height: number): void {}

  dispose(): void {
    this.glow?.dispose();
    this.glow = null;
    this.rimLight?.dispose();
    this.rimLight = null;
    this.keyLight?.dispose();
    this.keyLight = null;
    this.ambientLight?.dispose();
    this.ambientLight = null;
    this.root?.dispose(false, true);
    this.root = null;
    this.ground?.dispose(false, true);
    this.ground = null;
    this.shockwave?.dispose(false, true);
    this.shockwave = null;
    this.connectorParts = [];
    this.connectorPartBaseY = [];
    this.dustOrbs = [];
    this.groundTexture?.dispose();
    this.groundTexture = null;
    this.materials.forEach((material) => material.dispose());
    this.materials = [];
    this.scene = null;
    this.arcCamera?.dispose();
    this.arcCamera = null;
    this.camera = null;
    this.time = 0;
    this.shockwaveEnergy = 0;
    this.fireEnergy = 0;
    this.acidEnergy = 0;
    this.darkEnergy = 0;
    this.pulseEnergy = 0;
  }

  private setStandby(phase: ReturnType<typeof createDefaultControllerPhase>): void {
    this.phase = phase;
    const standbyColor = Color3.FromHexString(phase.accentHex);

    if (this.ambientLight) {
      this.ambientLight.intensity = 0.08;
    }
    if (this.rimLight) {
      this.rimLight.diffuse = standbyColor;
      this.rimLight.intensity = 0.14;
    }
    if (this.keyLight) {
      this.keyLight.diffuse = standbyColor;
      this.keyLight.intensity = 0.1;
    }
    if (this.glow) {
      this.glow.intensity = 0.08;
    }
    if (this.shockwave && this.shockwave.material instanceof StandardMaterial) {
      this.shockwave.scaling.setAll(1);
      this.shockwave.material.emissiveColor = standbyColor.scale(0.12);
      this.shockwave.material.alpha = 0.08;
    }
    if (this.ground && this.ground.material instanceof StandardMaterial) {
      this.ground.material.emissiveColor = standbyColor.scale(0.06);
    }

    this.connectorParts.forEach((mesh) => {
      if (mesh.material instanceof StandardMaterial) {
        mesh.material.emissiveColor = standbyColor.scale(0.08);
      }
    });
    this.dustOrbs.forEach((orb) => {
      orb.mesh.position.copyFrom(orb.basePosition);
      orb.mesh.scaling.setAll(0.9);
      orb.material.emissiveColor = standbyColor.scale(0.08);
    });
  }
}