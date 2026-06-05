import {
  ArcRotateCamera,
  Camera,
  Color3,
  Color4,
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

interface OrbitingBody {
  mesh: Mesh;
  material: StandardMaterial;
  tint: Color3;
  orbitRadius: number;
  orbitHeight: number;
  speed: number;
  angleOffset: number;
}

interface StarDust {
  mesh: Mesh;
  material: StandardMaterial;
  basePosition: Vector3;
  twinkleOffset: number;
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

const ORBITAL_DATA_SPHERE_POST_FX = {
  bloom: 0.72,
  scanlines: 0.22,
  rgbSplit: 0.26,
  vignette: 0.46,
  noise: 0.18,
} as const;

const ORBITAL_DATA_SPHERE_CAMERA = {
  mode: 'slowOrbit',
  zoom: 1,
  orbitSpeed: 0.18,
  shake: 0.04,
} as const;

const ORBITAL_DATA_SPHERE_LAYER_SCHEMA: ARVLayerSchema[] = [
  {
    id: 'core',
    label: 'Core',
    controls: [
      { key: 'pulseScale', label: 'Pulse Scale', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'shell',
    label: 'Shell',
    controls: [
      { key: 'shellScale', label: 'Shell Scale', type: 'slider', target: 'controls', min: 0.5, max: 1.8, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'halos',
    label: 'Halos',
    controls: [
      { key: 'rotationSpeed', label: 'Rotation Speed', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'satellites',
    label: 'Satellites',
    controls: [
      { key: 'orbitSpeed', label: 'Orbit Speed', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'size', label: 'Size', type: 'slider', target: 'controls', min: 0.4, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'starDust',
    label: 'Star Dust',
    controls: [
      { key: 'twinkle', label: 'Twinkle', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  createPostFxSchema(ORBITAL_DATA_SPHERE_POST_FX),
  createCameraSchema(ORBITAL_DATA_SPHERE_CAMERA),
];

export const createOrbitalDataSphereDefaultMixState = (presetId: string): ARVLiveMixState => {
  return {
    presetId,
    layers: {
      core: createLayerState({ pulseScale: 1 }, { audioReactive: true, blendMode: 'add' }),
      shell: createLayerState({ shellScale: 1 }, { audioReactive: true, blendMode: 'screen' }),
      halos: createLayerState({ rotationSpeed: 1 }, { audioReactive: true, blendMode: 'add' }),
      satellites: createLayerState({ orbitSpeed: 1, size: 1 }, { audioReactive: true, blendMode: 'add' }),
      starDust: createLayerState({ twinkle: 1 }, { audioReactive: true, blendMode: 'screen' }),
    },
    postFx: { ...ORBITAL_DATA_SPHERE_POST_FX },
    camera: { ...ORBITAL_DATA_SPHERE_CAMERA },
  };
};

export class OrbitalDataSphereController implements ARVSceneController {
  readonly id = 'arv-orbital-data-sphere' as const;
  camera: Camera | null = null;

  private scene: Scene | null = null;
  private arcCamera: ArcRotateCamera | null = null;
  private root: TransformNode | null = null;
  private ambientLight: HemisphericLight | null = null;
  private coreLight: PointLight | null = null;
  private haloLight: PointLight | null = null;
  private glow: GlowLayer | null = null;
  private core: Mesh | null = null;
  private shell: Mesh | null = null;
  private innerHalo: Mesh | null = null;
  private outerHalo: Mesh | null = null;
  private polarHalo: Mesh | null = null;
  private materials: StandardMaterial[] = [];
  private satellites: OrbitingBody[] = [];
  private starDust: StarDust[] = [];
  private phase = createDefaultControllerPhase('#6cecff');
  private fallbackColor = '#6cecff';
  private eventColor = Color3.FromHexString('#6cecff');
  private portalColor = Color3.FromHexString('#6cecff');
  private crowdColor = Color3.FromHexString('#9b8cff');
  private accentColor = Color3.FromHexString('#dffaff');
  private baseFogDensity = 0.014;
  private baseCameraAlpha = -Math.PI / 2.2;
  private baseCameraBeta = Math.PI / 2.34;
  private baseCameraRadius = 8.8;
  private baseCameraTarget = new Vector3(0, 0.18, 0);
  private activeMix = createOrbitalDataSphereDefaultMixState('arv-orbital-data-sphere');
  private time = 0;
  private eventPulse = 0;
  private orbitEnergy = 0;
  private fireEnergy = 0;
  private acidEnergy = 0;
  private darkEnergy = 0;
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
      'arv-orbital-data-sphere-camera',
      -Math.PI / 2.2,
      Math.PI / 2.34,
      mode === 'obs' ? 8.2 : 8.8,
      new Vector3(0, 0.18, 0),
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

    this.ambientLight = new HemisphericLight('arv-orbital-data-sphere-hemi', new Vector3(0, 1, 0), scene);
    this.ambientLight.intensity = 0.22;
    this.ambientLight.groundColor = Color3.FromHexString('#02040b');

    this.coreLight = new PointLight('arv-orbital-data-sphere-core-light', new Vector3(0, 0.2, 0), scene);
    this.coreLight.diffuse = this.portalColor;
    this.coreLight.intensity = 2.4;

    this.haloLight = new PointLight('arv-orbital-data-sphere-halo-light', new Vector3(0, 0, -2.2), scene);
    this.haloLight.diffuse = this.crowdColor;
    this.haloLight.intensity = 1.2;

    this.glow = new GlowLayer('arv-orbital-data-sphere-glow', scene, {
      mainTextureRatio: quality.tier === 'eco' ? 0.42 : 0.62,
      blurKernelSize: quality.tier === 'obs' ? 42 : 28,
      mainTextureSamples: quality.tier === 'obs' ? 4 : 1,
    });
    this.glow.intensity = 0.72;

    this.root = new TransformNode('arv-orbital-data-sphere-root', scene);

    const coreMaterial = createMaterial(scene, 'arv-orbital-data-sphere-core-mat', '#08121d', preset.portalHex, 1);
    coreMaterial.specularColor = Color3.FromHexString('#dffbff');
    coreMaterial.disableLighting = true;
    this.materials.push(coreMaterial);

    const shellMaterial = createMaterial(scene, 'arv-orbital-data-sphere-shell-mat', '#09101f', preset.accentHex, 0.14);
    shellMaterial.disableLighting = true;
    this.materials.push(shellMaterial);

    const innerHaloMaterial = createMaterial(scene, 'arv-orbital-data-sphere-inner-halo-mat', '#060d16', preset.crowdHex, 0.94);
    innerHaloMaterial.disableLighting = true;
    this.materials.push(innerHaloMaterial);

    const outerHaloMaterial = createMaterial(scene, 'arv-orbital-data-sphere-outer-halo-mat', '#050811', preset.accentHex, 0.88);
    outerHaloMaterial.disableLighting = true;
    this.materials.push(outerHaloMaterial);

    const polarHaloMaterial = createMaterial(scene, 'arv-orbital-data-sphere-polar-halo-mat', '#04070f', '#ffffff', 0.46);
    polarHaloMaterial.disableLighting = true;
    this.materials.push(polarHaloMaterial);

    this.core = MeshBuilder.CreateSphere('arv-orbital-data-sphere-core', { diameter: 2.3, segments: 32 }, scene);
    this.core.parent = this.root;
    this.core.material = coreMaterial;

    this.shell = MeshBuilder.CreateSphere('arv-orbital-data-sphere-shell', { diameter: 2.96, segments: 28 }, scene);
    this.shell.parent = this.root;
    this.shell.material = shellMaterial;

    this.innerHalo = MeshBuilder.CreateTorus(
      'arv-orbital-data-sphere-inner-halo',
      { diameter: 4.18, thickness: 0.11, tessellation: 96 },
      scene,
    );
    this.innerHalo.parent = this.root;
    this.innerHalo.rotation.x = Math.PI / 2;
    this.innerHalo.material = innerHaloMaterial;

    this.outerHalo = MeshBuilder.CreateTorus(
      'arv-orbital-data-sphere-outer-halo',
      { diameter: 5.2, thickness: 0.05, tessellation: 96 },
      scene,
    );
    this.outerHalo.parent = this.root;
    this.outerHalo.rotation.z = Math.PI / 2;
    this.outerHalo.material = outerHaloMaterial;

    this.polarHalo = MeshBuilder.CreateTorus(
      'arv-orbital-data-sphere-polar-halo',
      { diameter: 3.62, thickness: 0.04, tessellation: 96 },
      scene,
    );
    this.polarHalo.parent = this.root;
    this.polarHalo.rotation.y = Math.PI / 2;
    this.polarHalo.material = polarHaloMaterial;

    const satellitePalette = [preset.portalHex, preset.crowdHex, preset.accentHex, '#ffffff'];
    const satelliteCount = quality.tier === 'eco' ? 4 : 6;
    for (let index = 0; index < satelliteCount; index += 1) {
      const tintHex = satellitePalette[index % satellitePalette.length];
      const material = createMaterial(
        scene,
        `arv-orbital-data-sphere-satellite-mat-${index}`,
        '#07101b',
        tintHex,
        0.98,
      );
      material.disableLighting = true;
      this.materials.push(material);

      const mesh = MeshBuilder.CreateSphere(
        `arv-orbital-data-sphere-satellite-${index}`,
        { diameter: 0.18 + (index % 3) * 0.06, segments: 12 },
        scene,
      );
      mesh.parent = this.root;
      mesh.material = material;

      this.satellites.push({
        mesh,
        material,
        tint: Color3.FromHexString(tintHex),
        orbitRadius: 2.5 + index * 0.42,
        orbitHeight: 0.24 + (index % 3) * 0.18,
        speed: 0.48 + index * 0.09,
        angleOffset: index * 0.92,
      });
    }

    const starCount = quality.tier === 'eco' ? 10 : 18;
    for (let index = 0; index < starCount; index += 1) {
      const material = createMaterial(
        scene,
        `arv-orbital-data-sphere-star-mat-${index}`,
        '#040812',
        index % 2 === 0 ? preset.portalHex : preset.crowdHex,
        0.82,
      );
      material.disableLighting = true;
      this.materials.push(material);

      const mesh = MeshBuilder.CreateSphere(
        `arv-orbital-data-sphere-star-${index}`,
        { diameter: 0.05 + (index % 3) * 0.02, segments: 8 },
        scene,
      );
      mesh.parent = this.root;
      const orbit = 4.8 + (index % 5) * 0.46;
      const angle = index * 0.64;
      const basePosition = new Vector3(
        Math.cos(angle) * orbit,
        -1.6 + (index % 6) * 0.68,
        Math.sin(angle) * orbit * 0.74,
      );
      mesh.position.copyFrom(basePosition);
      mesh.material = material;

      this.starDust.push({
        mesh,
        material,
        basePosition,
        twinkleOffset: index * 0.44,
      });
    }

    this.glow.addIncludedOnlyMesh(this.core);
    this.glow.addIncludedOnlyMesh(this.innerHalo);
    this.glow.addIncludedOnlyMesh(this.outerHalo);
    this.glow.addIncludedOnlyMesh(this.polarHalo);
    this.satellites.forEach(({ mesh }) => this.glow?.addIncludedOnlyMesh(mesh));

    this.applyMixState(this.getDefaultMixState());
  }

  getLayerSchema(): ARVLayerSchema[] {
    return ORBITAL_DATA_SPHERE_LAYER_SCHEMA;
  }

  getDefaultMixState(): ARVLiveMixState {
    return createOrbitalDataSphereDefaultMixState(this.preset?.id || 'arv-orbital-data-sphere');
  }

  applyMixState(mix: ARVLiveMixState): void {
    this.activeMix = mix;

    const coreLayer = getLayerState(mix, 'core');
    const shellLayer = getLayerState(mix, 'shell');
    const halosLayer = getLayerState(mix, 'halos');
    const satellitesLayer = getLayerState(mix, 'satellites');
    const starDustLayer = getLayerState(mix, 'starDust');

    setNodeEnabled([this.core], coreLayer.enabled);
    if (this.core?.material instanceof StandardMaterial) {
      this.core.material.alpha = Math.max(0.08, coreLayer.opacity);
      applyMaterialBlendMode(coreLayer.blendMode, [this.core.material]);
    }

    setNodeEnabled([this.shell], shellLayer.enabled);
    if (this.shell?.material instanceof StandardMaterial) {
      this.shell.material.alpha = Math.max(0.04, shellLayer.opacity * 0.18);
      applyMaterialBlendMode(shellLayer.blendMode, [this.shell.material]);
    }

    setNodeEnabled([this.innerHalo, this.outerHalo, this.polarHalo], halosLayer.enabled);
    applyMaterialBlendMode(halosLayer.blendMode, [
      this.innerHalo?.material instanceof StandardMaterial ? this.innerHalo.material : null,
      this.outerHalo?.material instanceof StandardMaterial ? this.outerHalo.material : null,
      this.polarHalo?.material instanceof StandardMaterial ? this.polarHalo.material : null,
    ]);
    if (this.innerHalo?.material instanceof StandardMaterial) {
      this.innerHalo.material.alpha = Math.max(0.04, halosLayer.opacity * 0.94);
    }
    if (this.outerHalo?.material instanceof StandardMaterial) {
      this.outerHalo.material.alpha = Math.max(0.04, halosLayer.opacity * 0.88);
    }
    if (this.polarHalo?.material instanceof StandardMaterial) {
      this.polarHalo.material.alpha = Math.max(0.04, halosLayer.opacity * 0.46);
    }

    this.satellites.forEach((satellite) => {
      satellite.mesh.setEnabled(satellitesLayer.enabled);
      satellite.material.alpha = Math.max(0.04, satellitesLayer.opacity * 0.98);
    });
    applyMaterialBlendMode(satellitesLayer.blendMode, this.satellites.map((satellite) => satellite.material));

    this.starDust.forEach((star) => {
      star.mesh.setEnabled(starDustLayer.enabled);
      star.material.alpha = Math.max(0.04, starDustLayer.opacity * 0.82);
    });
    applyMaterialBlendMode(starDustLayer.blendMode, this.starDust.map((star) => star.material));

    if (this.scene) {
      this.scene.fogDensity = this.baseFogDensity * (1 + mix.postFx.vignette * 0.36);
    }
  }

  update(audio: ARVAudioFrame): void {
    if (!this.core || !this.shell || !this.innerHalo || !this.outerHalo || !this.polarHalo || !this.arcCamera) {
      return;
    }

    this.time += audio.dt;
    this.eventPulse *= Math.pow(0.12, audio.dt);
    this.orbitEnergy *= Math.pow(0.18, audio.dt);
    this.fireEnergy *= Math.pow(0.22, audio.dt);
    this.acidEnergy *= Math.pow(0.22, audio.dt);
    this.darkEnergy *= Math.pow(0.24, audio.dt);
    this.technoEnergy *= Math.pow(0.18, audio.dt);

    const coreLayer = getLayerState(this.activeMix, 'core');
    const shellLayer = getLayerState(this.activeMix, 'shell');
    const halosLayer = getLayerState(this.activeMix, 'halos');
    const satellitesLayer = getLayerState(this.activeMix, 'satellites');
    const starDustLayer = getLayerState(this.activeMix, 'starDust');
    const coreReactive = coreLayer.audioReactive ? 1 : 0;
    const shellReactive = shellLayer.audioReactive ? 1 : 0;
    const halosReactive = halosLayer.audioReactive ? 1 : 0;
    const satellitesReactive = satellitesLayer.audioReactive ? 1 : 0;
    const starReactive = starDustLayer.audioReactive ? 1 : 0;
    const corePulseScale = getLayerControlNumber(this.activeMix, 'core', 'pulseScale', 1);
    const shellScale = getLayerControlNumber(this.activeMix, 'shell', 'shellScale', 1);
    const haloRotationSpeed = getLayerControlNumber(this.activeMix, 'halos', 'rotationSpeed', 1);
    const satelliteOrbitSpeed = getLayerControlNumber(this.activeMix, 'satellites', 'orbitSpeed', 1);
    const satelliteSize = getLayerControlNumber(this.activeMix, 'satellites', 'size', 1);
    const starTwinkle = getLayerControlNumber(this.activeMix, 'starDust', 'twinkle', 1);
    const postFxBloom = 0.58 + this.activeMix.postFx.bloom * 0.76;
    const postFxRgbSplit = this.activeMix.postFx.rgbSplit;
    const postFxNoise = this.activeMix.postFx.noise;
    const postFxScanlines = this.activeMix.postFx.scanlines;

    const beat = Math.max(audio.kick, audio.bass * 0.88, this.eventPulse * 0.76);
    const phaseColor = Color3.FromHexString(this.phase.accentHex);
    const targetColor = Color3.Lerp(
      phaseColor,
      this.eventColor,
      Math.min(1, 0.26 + this.eventPulse * 0.46 + this.acidEnergy * 0.12),
    );
    const breath = 1 + (audio.bass * 0.12 + audio.kick * 0.08) * coreReactive * corePulseScale + this.technoEnergy * 0.04;

    this.core.scaling.setAll(breath);
    this.shell.scaling.setAll(shellScale * (1.02 + audio.rms * 0.04 * shellReactive + this.eventPulse * 0.06));
    this.innerHalo.scaling.setAll(1 + beat * 0.08 * halosReactive + this.phase.portalMultiplier * 0.04);
    this.outerHalo.scaling.setAll(1 + beat * 0.12 * halosReactive + this.orbitEnergy * 0.05);
    this.polarHalo.scaling.setAll(1 + audio.mid * 0.05 * halosReactive + this.technoEnergy * 0.03);

    this.innerHalo.rotation.y += audio.dt * (0.36 + audio.mid * 1.18 * halosReactive + this.orbitEnergy * 0.28) * haloRotationSpeed;
    this.outerHalo.rotation.x += audio.dt * (0.18 + this.phase.portalMultiplier * 0.16) * haloRotationSpeed;
    this.outerHalo.rotation.y += audio.dt * (0.12 + this.acidEnergy * 0.08) * haloRotationSpeed;
    this.polarHalo.rotation.z += audio.dt * (0.32 + audio.high * 0.84 * halosReactive) * haloRotationSpeed;

    this.satellites.forEach((satellite, index) => {
      const angle = this.time * (satellite.speed + audio.mid * 0.8 * satellitesReactive + this.orbitEnergy * 0.24)
        * satelliteOrbitSpeed
        + satellite.angleOffset;
      const orbitRadius = satellite.orbitRadius * (0.82 + satellitesLayer.intensity * 0.18);
      satellite.mesh.position.set(
        Math.cos(angle) * orbitRadius,
        Math.sin(angle * 1.8) * satellite.orbitHeight,
        Math.sin(angle) * orbitRadius * 0.82,
      );
      satellite.mesh.scaling.setAll(satelliteSize * (1 + beat * 0.16 * satellitesReactive + (index % 2 === 0 ? this.technoEnergy * 0.08 : 0)));
      const satelliteColor = Color3.Lerp(satellite.tint, targetColor, 0.24 + this.phase.energy * 0.18);
      satellite.material.emissiveColor = Color3.Lerp(
        satellite.material.emissiveColor,
        satelliteColor.scale((0.28 + audio.high * 0.34 * satellitesReactive + beat * 0.22) * satellitesLayer.intensity),
        0.14,
      );
    });

    this.starDust.forEach((star, index) => {
      const shimmer = 0.5 + Math.sin(this.time * (0.7 + index * 0.04) + star.twinkleOffset) * 0.5 * starTwinkle;
      star.mesh.position.y = star.basePosition.y + Math.cos(this.time * 0.44 + star.twinkleOffset) * 0.08 * (0.6 + postFxScanlines * 0.5);
      star.mesh.scaling.setAll(0.84 + shimmer * 0.46 + audio.high * 0.12 * starReactive);
      star.material.emissiveColor = Color3.Lerp(
        star.material.emissiveColor,
        targetColor.scale((0.08 + shimmer * 0.22 + postFxNoise * 0.12) * starDustLayer.intensity),
        0.08,
      );
    });

    const coreMaterial = this.core.material as StandardMaterial;
    const shellMaterial = this.shell.material as StandardMaterial;
    const innerHaloMaterial = this.innerHalo.material as StandardMaterial;
    const outerHaloMaterial = this.outerHalo.material as StandardMaterial;
    const polarHaloMaterial = this.polarHalo.material as StandardMaterial;

    coreMaterial.emissiveColor = Color3.Lerp(
      coreMaterial.emissiveColor,
      targetColor.scale((0.34 + beat * 0.48 * coreReactive + this.technoEnergy * 0.12) * coreLayer.intensity),
      0.12,
    );
    shellMaterial.emissiveColor = Color3.Lerp(
      shellMaterial.emissiveColor,
      targetColor.scale((0.14 + audio.rms * 0.16 * shellReactive + this.phase.bloomBoost * 0.18 + postFxScanlines * 0.08) * shellLayer.intensity),
      0.08,
    );
    innerHaloMaterial.emissiveColor = Color3.Lerp(
      innerHaloMaterial.emissiveColor,
      Color3.Lerp(this.crowdColor, targetColor, 0.4).scale((0.28 + audio.mid * 0.34 * halosReactive) * halosLayer.intensity),
      0.14,
    );
    outerHaloMaterial.emissiveColor = Color3.Lerp(
      outerHaloMaterial.emissiveColor,
      Color3.Lerp(this.accentColor, targetColor, 0.34).scale((0.18 + beat * 0.24 * halosReactive) * halosLayer.intensity),
      0.12,
    );
    polarHaloMaterial.emissiveColor = Color3.Lerp(
      polarHaloMaterial.emissiveColor,
      Color3.Lerp(this.portalColor, targetColor, 0.22).scale((0.08 + audio.high * 0.28 * halosReactive) * halosLayer.intensity),
      0.1,
    );

    if (this.coreLight) {
      this.coreLight.diffuse = targetColor;
      this.coreLight.position.x = postFxRgbSplit * 0.8;
      this.coreLight.intensity = (1 + beat * 3.2 * coreReactive + this.phase.bloomBoost * 1.6 - this.darkEnergy * 0.6) * (0.64 + coreLayer.intensity * 0.36);
    }
    if (this.haloLight) {
      this.haloLight.diffuse = Color3.Lerp(this.crowdColor, targetColor, 0.4);
      this.haloLight.position.x = -postFxRgbSplit * 0.7;
      this.haloLight.intensity = (0.34 + audio.mid * 1.4 * halosReactive + this.phase.energy * 0.42) * (0.62 + halosLayer.intensity * 0.36);
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = 0.08 + audio.rms * 0.12 + this.phase.energy * 0.08 - this.darkEnergy * 0.06 - this.activeMix.postFx.vignette * 0.04;
    }
    if (this.glow) {
      this.glow.intensity = (0.18 + audio.high * 0.28 + this.phase.bloomBoost * 0.3 + this.technoEnergy * 0.14) * postFxBloom;
    }

    const cameraOrbitSpeed = 0.04 + this.activeMix.camera.orbitSpeed * 0.16;
    const cameraShake = this.activeMix.camera.shake * (0.02 + beat * 0.02 + postFxNoise * 0.02);
    const cameraZoom = this.activeMix.camera.zoom;
    if (this.activeMix.camera.mode === 'slowPush') {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 0.18) * 0.03;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.12) * 0.03;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom - Math.sin(this.time * 0.2) * 0.24;
    } else if (this.activeMix.camera.mode === 'handheldFake') {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 1.7) * cameraShake + Math.cos(this.time * 0.26) * 0.03;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 1.3) * cameraShake;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom + Math.sin(this.time * 0.74) * 0.08;
    } else if (this.activeMix.camera.mode === 'locked') {
      this.arcCamera.alpha = this.baseCameraAlpha + Math.sin(this.time * 0.14) * cameraShake;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.12) * cameraShake * 0.7;
      this.arcCamera.radius = this.baseCameraRadius / cameraZoom;
    } else {
      this.arcCamera.alpha = this.baseCameraAlpha + this.time * cameraOrbitSpeed + Math.sin(this.time * 0.14) * 0.04;
      this.arcCamera.beta = this.baseCameraBeta + Math.cos(this.time * 0.12) * 0.04;
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
    this.eventPulse = clamp(this.eventPulse + impulse.intensity * 0.58, 0, 1.5);
    this.orbitEnergy = clamp(this.orbitEnergy + impulse.sparkle * 0.28, 0, 1.4);

    switch (reactionKindFromVisualEvent(event.type)) {
      case 'fire':
        this.fireEnergy = clamp(this.fireEnergy + impulse.intensity, 0, 1.4);
        break;
      case 'acid':
        this.acidEnergy = clamp(this.acidEnergy + impulse.intensity, 0, 1.4);
        break;
      case 'dark':
        this.darkEnergy = clamp(this.darkEnergy + impulse.intensity, 0, 1.2);
        break;
      case 'peace-love-techno':
        this.technoEnergy = clamp(this.technoEnergy + impulse.intensity, 0, 1.4);
        break;
      default:
        break;
    }
  }

  resize(_width: number, _height: number): void {}

  dispose(): void {
    this.glow?.dispose();
    this.glow = null;
    this.coreLight?.dispose();
    this.coreLight = null;
    this.haloLight?.dispose();
    this.haloLight = null;
    this.ambientLight?.dispose();
    this.ambientLight = null;
    this.root?.dispose(false, true);
    this.root = null;
    this.materials.forEach((material) => material.dispose());
    this.materials = [];
    this.satellites = [];
    this.starDust = [];
    this.scene = null;
    this.arcCamera?.dispose();
    this.arcCamera = null;
    this.camera = null;
    this.core = null;
    this.shell = null;
    this.innerHalo = null;
    this.outerHalo = null;
    this.polarHalo = null;
    this.time = 0;
    this.eventPulse = 0;
    this.orbitEnergy = 0;
    this.fireEnergy = 0;
    this.acidEnergy = 0;
    this.darkEnergy = 0;
    this.technoEnergy = 0;
  }

  private setStandby(phase: ReturnType<typeof createDefaultControllerPhase>): void {
    this.phase = phase;
    const standbyColor = Color3.FromHexString(phase.accentHex);

    if (this.ambientLight) {
      this.ambientLight.intensity = 0.08;
    }
    if (this.coreLight) {
      this.coreLight.diffuse = standbyColor;
      this.coreLight.intensity = 0.22;
    }
    if (this.haloLight) {
      this.haloLight.diffuse = standbyColor;
      this.haloLight.intensity = 0.14;
    }
    if (this.glow) {
      this.glow.intensity = 0.08;
    }

    if (this.core && this.shell && this.innerHalo && this.outerHalo && this.polarHalo) {
      this.core.scaling.setAll(1);
      this.shell.scaling.setAll(1.02);
      this.innerHalo.scaling.setAll(1);
      this.outerHalo.scaling.setAll(1);
      this.polarHalo.scaling.setAll(1);

      (this.core.material as StandardMaterial).emissiveColor = standbyColor.scale(0.24);
      (this.shell.material as StandardMaterial).emissiveColor = standbyColor.scale(0.08);
      (this.innerHalo.material as StandardMaterial).emissiveColor = standbyColor.scale(0.14);
      (this.outerHalo.material as StandardMaterial).emissiveColor = standbyColor.scale(0.1);
      (this.polarHalo.material as StandardMaterial).emissiveColor = standbyColor.scale(0.06);
    }

    this.satellites.forEach((satellite, index) => {
      satellite.mesh.position.set(
        Math.cos(index) * satellite.orbitRadius,
        0,
        Math.sin(index) * satellite.orbitRadius * 0.82,
      );
      satellite.mesh.scaling.setAll(0.9);
      satellite.material.emissiveColor = standbyColor.scale(0.16);
    });

    this.starDust.forEach((star) => {
      star.mesh.position.copyFrom(star.basePosition);
      star.mesh.scaling.setAll(0.9);
      star.material.emissiveColor = standbyColor.scale(0.08);
    });
  }
}