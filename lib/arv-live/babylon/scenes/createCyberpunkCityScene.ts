import {
  ArcRotateCamera,
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
import type { AudioReactiveSnapshot } from '../../AudioReactiveUniforms';
import type { RitualPhaseState } from '../../RitualPhaseController';
import type { ARVLiveMode, ARVLiveVisualPreset, ARVQualitySettings } from '../../presets';
import type { ARVLayerSchema, ARVLiveMixState, ARVReactionKind, ARVVisualImpulse } from '../../types';
import {
  CAMERA_MODE_OPTIONS,
  applyMaterialBlendMode,
  createLayerState,
  getLayerControlNumber,
  getLayerState,
  setNodeEnabled,
} from '../controllers/mixHelpers';

interface CreateCyberpunkCitySceneOptions {
  scene: Scene;
  canvas: HTMLCanvasElement;
  mode: ARVLiveMode;
  quality: ARVQualitySettings;
  preset: ARVLiveVisualPreset;
}

interface BuildingCluster {
  core: Mesh;
  shell: Mesh;
  beacon: Mesh;
  coreMaterial: StandardMaterial;
  shellMaterial: StandardMaterial;
  beaconMaterial: StandardMaterial;
  tint: Color3;
  baseHeight: number;
  floorY: number;
  offset: number;
}

export const CYBERPUNK_CITY_LAYER_SCHEMA: ARVLayerSchema[] = [
  {
    id: 'platform',
    label: 'Platform',
    controls: [
      { key: 'rimIntensity', label: 'Rim Intensity', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'surfaceIntensity', label: 'Surface Intensity', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'textureDrift', label: 'Texture Drift', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'city',
    label: 'City',
    controls: [
      { key: 'heightScale', label: 'Height Scale', type: 'slider', target: 'controls', min: 0.4, max: 1.8, step: 0.01, defaultValue: 1 },
      { key: 'rotationSpeed', label: 'Rotation Speed', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'shellIntensity', label: 'Shell Intensity', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'beacons',
    label: 'Beacons',
    controls: [
      { key: 'hoverAmount', label: 'Hover Amount', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'size', label: 'Size', type: 'slider', target: 'controls', min: 0.4, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'intensityBoost', label: 'Intensity Boost', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'traces',
    label: 'Traces',
    controls: [
      { key: 'signalIntensity', label: 'Signal Intensity', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'pulseScale', label: 'Pulse Scale', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'postFx',
    label: 'Post FX',
    kind: 'postFx',
    controls: [
      { key: 'bloom', label: 'Bloom', type: 'slider', target: 'postFx', min: 0, max: 2, step: 0.01, defaultValue: 0.78 },
      { key: 'scanlines', label: 'Scanlines', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.28 },
      { key: 'rgbSplit', label: 'RGB Split', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.34 },
      { key: 'noise', label: 'Noise', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.18 },
      { key: 'vignette', label: 'Vignette', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.46 },
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
        defaultValue: 'slowOrbit',
        options: CAMERA_MODE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
      },
      { key: 'zoom', label: 'Zoom', type: 'slider', target: 'camera', min: 0.4, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'orbitSpeed', label: 'Orbit Speed', type: 'slider', target: 'camera', min: 0, max: 1.5, step: 0.01, defaultValue: 0.26 },
      { key: 'shake', label: 'Shake', type: 'slider', target: 'camera', min: 0, max: 1, step: 0.01, defaultValue: 0.04 },
    ],
  },
];

export const createCyberpunkCityDefaultMixState = (presetId: string): ARVLiveMixState => {
  return {
    presetId,
    layers: {
      platform: createLayerState({ rimIntensity: 1, surfaceIntensity: 1, textureDrift: 1 }, { audioReactive: true, blendMode: 'screen' }),
      city: createLayerState({ heightScale: 1, rotationSpeed: 1, shellIntensity: 1 }, { audioReactive: true, blendMode: 'screen' }),
      beacons: createLayerState({ hoverAmount: 1, size: 1, intensityBoost: 1 }, { audioReactive: true, blendMode: 'add' }),
      traces: createLayerState({ signalIntensity: 1, pulseScale: 1 }, { audioReactive: true, blendMode: 'add' }),
    },
    postFx: {
      bloom: 0.78,
      scanlines: 0.28,
      rgbSplit: 0.34,
      vignette: 0.46,
      noise: 0.18,
    },
    camera: {
      mode: 'slowOrbit',
      zoom: 1,
      orbitSpeed: 0.26,
      shake: 0.04,
    },
  };
};

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

const createPlatformTexture = (scene: Scene, preset: ARVLiveVisualPreset): DynamicTexture => {
  const size = 1024;
  const texture = new DynamicTexture('arv-cyberpunk-city-platform', { width: size, height: size }, scene, false);
  const ctx = texture.getContext();
  const center = size / 2;

  texture.hasAlpha = true;
  ctx.clearRect(0, 0, size, size);

  const baseGradient = ctx.createRadialGradient(center, center, 24, center, center, center);
  baseGradient.addColorStop(0, 'rgba(14, 20, 44, 0.95)');
  baseGradient.addColorStop(0.45, 'rgba(10, 14, 32, 0.92)');
  baseGradient.addColorStop(1, 'rgba(4, 7, 16, 1)');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, size, size);

  for (let index = 0; index < 6; index += 1) {
    const radius = 180 + index * 54;
    ctx.beginPath();
    ctx.strokeStyle = index % 2 === 0 ? 'rgba(86, 236, 255, 0.18)' : 'rgba(255, 102, 232, 0.14)';
    ctx.lineWidth = index === 5 ? 6 : 2;
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(145, 243, 255, 0.22)';
  ctx.lineWidth = 2;
  for (let index = 0; index < 24; index += 1) {
    const angle = (Math.PI * 2 * index) / 24;
    const outerX = center + Math.cos(angle) * 390;
    const outerY = center + Math.sin(angle) * 390;
    const innerX = center + Math.cos(angle) * 120;
    const innerY = center + Math.sin(angle) * 120;

    ctx.beginPath();
    ctx.moveTo(innerX, innerY);
    ctx.lineTo(outerX, outerY);
    ctx.stroke();
  }

  ctx.fillStyle = `${preset.portalHex}33`;
  for (let index = 0; index < 12; index += 1) {
    const angle = (Math.PI * 2 * index) / 12;
    const radius = 230 + (index % 3) * 64;
    ctx.beginPath();
    ctx.arc(
      center + Math.cos(angle) * radius,
      center + Math.sin(angle) * radius,
      8 + (index % 2) * 4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  texture.update(false);
  return texture;
};

export function createCyberpunkCityScene({
  scene,
  canvas,
  mode,
  quality,
  preset,
}: CreateCyberpunkCitySceneOptions) {
  void canvas;

  const backgroundColor = Color3.FromHexString(preset.backgroundHex);
  const baseFogDensity = quality.tier === 'eco' ? 0.026 : 0.017;
  scene.clearColor = new Color4(backgroundColor.r, backgroundColor.g, backgroundColor.b, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = baseFogDensity;
  scene.fogColor = Color3.FromHexString(preset.fogHex);

  const camera = new ArcRotateCamera(
    'arv-cyberpunk-city-camera',
    -Math.PI / 2.24,
    Math.PI / 2.65,
    mode === 'obs' ? 11.4 : 12.1,
    new Vector3(0, 1.05, 0),
    scene,
  );
  const baseCameraAlpha = camera.alpha;
  const baseCameraBeta = camera.beta;
  const baseCameraRadius = camera.radius;
  const baseCameraTarget = camera.getTarget().clone();
  camera.inputs.clear();
  camera.panningSensibility = 0;
  camera.wheelPrecision = 100000;
  camera.minZ = 0.1;
  camera.maxZ = 70;

  const ambientLight = new HemisphericLight('arv-cyberpunk-city-hemi', new Vector3(0, 1, 0), scene);
  ambientLight.intensity = 0.34;
  ambientLight.groundColor = Color3.FromHexString('#03050f');

  const cyanLight = new PointLight('arv-cyberpunk-city-cyan', new Vector3(-3.8, 5.8, -3.2), scene);
  cyanLight.diffuse = Color3.FromHexString(preset.portalHex);
  cyanLight.intensity = 1.4;

  const magentaLight = new PointLight('arv-cyberpunk-city-magenta', new Vector3(4.4, 4.6, 2.4), scene);
  magentaLight.diffuse = Color3.FromHexString(preset.crowdHex);
  magentaLight.intensity = 1.1;

  const rimLight = new PointLight('arv-cyberpunk-city-rim', new Vector3(0, 7.2, 0), scene);
  rimLight.diffuse = Color3.FromHexString(preset.accentHex);
  rimLight.intensity = 0.8;

  const glow = new GlowLayer('arv-cyberpunk-city-glow', scene, {
    mainTextureRatio: quality.tier === 'eco' ? 0.42 : 0.62,
    blurKernelSize: quality.tier === 'obs' ? 48 : 32,
    mainTextureSamples: quality.tier === 'obs' ? 4 : 1,
  });
  glow.intensity = 0.78;

  const platformTexture = createPlatformTexture(scene, preset);
  const platformBaseMaterial = createMaterial(scene, 'arv-cyberpunk-city-base-mat', '#080b18', '#050812', 1);
  const platformSurfaceMaterial = new StandardMaterial('arv-cyberpunk-city-surface-mat', scene);
  platformSurfaceMaterial.diffuseTexture = platformTexture;
  platformSurfaceMaterial.emissiveTexture = platformTexture;
  platformSurfaceMaterial.diffuseColor = Color3.FromHexString('#101a33');
  platformSurfaceMaterial.emissiveColor = Color3.FromHexString(preset.portalHex).scale(0.4);
  platformSurfaceMaterial.backFaceCulling = false;

  const platformRimMaterial = createMaterial(scene, 'arv-cyberpunk-city-rim-mat', '#07101c', preset.portalHex, 0.98);

  const platformBase = MeshBuilder.CreateCylinder(
    'arv-cyberpunk-city-base',
    { height: 0.62, diameter: 10.8, tessellation: 96 },
    scene,
  );
  platformBase.position.y = -1.44;
  platformBase.material = platformBaseMaterial;

  const platformSurface = MeshBuilder.CreateCylinder(
    'arv-cyberpunk-city-surface',
    { height: 0.08, diameter: 9.6, tessellation: 96 },
    scene,
  );
  platformSurface.position.y = -1.09;
  platformSurface.material = platformSurfaceMaterial;

  const platformRim = MeshBuilder.CreateTorus(
    'arv-cyberpunk-city-rim',
    { diameter: 9.82, thickness: 0.18, tessellation: 96 },
    scene,
  );
  platformRim.position.y = -1.03;
  platformRim.rotation.x = Math.PI / 2;
  platformRim.material = platformRimMaterial;

  const cityRoot = new TransformNode('arv-cyberpunk-city-root', scene);
  const traceLines: Vector3[][] = [];
  const clusters: BuildingCluster[] = [];
  const palette = [preset.portalHex, preset.crowdHex, preset.accentHex, '#b8f7ff'];
  const floorY = -1.05;

  for (let gridX = -2; gridX <= 2; gridX += 1) {
    for (let gridZ = -2; gridZ <= 2; gridZ += 1) {
      const position = new Vector3(gridX * 1.14, 0, gridZ * 1.04);
      const manhattan = Math.abs(gridX) + Math.abs(gridZ);
      const seed = gridX * 17 + gridZ * 13 + 31;
      const width = 0.5 + (Math.abs(seed) % 3) * 0.12;
      const depth = 0.5 + (Math.abs(seed + 5) % 3) * 0.12;
      const baseHeight = 1.2 + Math.max(0, 3.8 - manhattan * 0.64) + (Math.abs(seed + 9) % 4) * 0.34;
      const tintHex = palette[Math.abs(seed) % palette.length];
      const tint = Color3.FromHexString(tintHex);

      const coreMaterial = createMaterial(
        scene,
        `arv-cyberpunk-city-core-mat-${gridX}-${gridZ}`,
        '#101528',
        '#13203f',
        0.98,
      );
      const shellMaterial = createMaterial(
        scene,
        `arv-cyberpunk-city-shell-mat-${gridX}-${gridZ}`,
        '#081221',
        tintHex,
        0.24,
      );
      const beaconMaterial = createMaterial(
        scene,
        `arv-cyberpunk-city-beacon-mat-${gridX}-${gridZ}`,
        '#0b1220',
        tintHex,
        0.96,
      );

      const core = MeshBuilder.CreateBox(
        `arv-cyberpunk-city-core-${gridX}-${gridZ}`,
        { width, depth, height: baseHeight },
        scene,
      );
      core.parent = cityRoot;
      core.position.set(position.x, floorY + baseHeight / 2, position.z);
      core.material = coreMaterial;

      const shell = MeshBuilder.CreateBox(
        `arv-cyberpunk-city-shell-${gridX}-${gridZ}`,
        { width: width + 0.1, depth: depth + 0.1, height: baseHeight + 0.12 },
        scene,
      );
      shell.parent = cityRoot;
      shell.position.copyFrom(core.position);
      shell.material = shellMaterial;

      const beacon = MeshBuilder.CreateSphere(
        `arv-cyberpunk-city-beacon-${gridX}-${gridZ}`,
        { diameter: 0.16 + (manhattan === 0 ? 0.1 : 0), segments: 12 },
        scene,
      );
      beacon.parent = cityRoot;
      beacon.position.set(position.x, floorY + baseHeight + 0.18, position.z);
      beacon.material = beaconMaterial;

      traceLines.push([
        new Vector3(0, floorY + 0.02, 0),
        new Vector3(position.x, floorY + 0.02, position.z),
      ]);

      clusters.push({
        core,
        shell,
        beacon,
        coreMaterial,
        shellMaterial,
        beaconMaterial,
        tint,
        baseHeight,
        floorY,
        offset: Math.abs(seed) * 0.17,
      });
    }
  }

  const traces = MeshBuilder.CreateLineSystem('arv-cyberpunk-city-traces', { lines: traceLines }, scene);
  traces.color = Color3.FromHexString(preset.accentHex);
  traces.alpha = 0.28;

  glow.addIncludedOnlyMesh(platformSurface);
  glow.addIncludedOnlyMesh(platformRim);
  glow.addIncludedOnlyMesh(traces);
  clusters.forEach((cluster) => {
    glow.addIncludedOnlyMesh(cluster.shell);
    glow.addIncludedOnlyMesh(cluster.beacon);
  });

  let eventPulse = 0;
  let fireEnergy = 0;
  let acidEnergy = 0;
  let technoEnergy = 0;
  let eventColor = Color3.FromHexString(preset.portalHex);
  let time = 0;
  let activeMix = createCyberpunkCityDefaultMixState(preset.id);

  const applyReactionEnergy = (reaction?: ARVReactionKind | null, intensity = 0.6) => {
    switch (reaction) {
      case 'fire':
        fireEnergy = clamp(fireEnergy + intensity, 0, 1.4);
        break;
      case 'acid':
        acidEnergy = clamp(acidEnergy + intensity, 0, 1.4);
        break;
      case 'peace-love-techno':
        technoEnergy = clamp(technoEnergy + intensity, 0, 1.4);
        break;
      default:
        eventPulse = clamp(eventPulse + intensity, 0, 1.5);
        break;
    }
  };

  const applyVisualImpulse = (impulse: ARVVisualImpulse, reaction?: ARVReactionKind | null) => {
    eventPulse = clamp(eventPulse + impulse.intensity * 0.52, 0, 1.6);
    technoEnergy = clamp(technoEnergy + impulse.sparkle * 0.24, 0, 1.6);
    eventColor = Color3.FromHexString(impulse.colorHex);
    applyReactionEnergy(reaction, impulse.intensity);
  };

  const applyMixState = (mix: ARVLiveMixState) => {
    activeMix = mix;

    const platformLayer = getLayerState(activeMix, 'platform');
    setNodeEnabled([platformBase, platformSurface, platformRim], platformLayer.enabled);
    platformBaseMaterial.alpha = Math.max(0.06, platformLayer.opacity);
    platformSurfaceMaterial.alpha = Math.max(0.06, platformLayer.opacity);
    platformRimMaterial.alpha = Math.max(0.06, platformLayer.opacity * 0.98);
    applyMaterialBlendMode(platformLayer.blendMode, [platformBaseMaterial, platformSurfaceMaterial, platformRimMaterial]);

    const cityLayer = getLayerState(activeMix, 'city');
    const cityMaterials: StandardMaterial[] = [];
    clusters.forEach((cluster) => {
      cluster.core.setEnabled(cityLayer.enabled);
      cluster.shell.setEnabled(cityLayer.enabled);
      cluster.coreMaterial.alpha = Math.max(0.06, cityLayer.opacity);
      cluster.shellMaterial.alpha = Math.max(0.04, cityLayer.opacity * 0.24);
      cityMaterials.push(cluster.coreMaterial, cluster.shellMaterial);
    });
    applyMaterialBlendMode(cityLayer.blendMode, cityMaterials);

    const beaconLayer = getLayerState(activeMix, 'beacons');
    clusters.forEach((cluster) => {
      cluster.beacon.setEnabled(beaconLayer.enabled);
      cluster.beaconMaterial.alpha = Math.max(0.04, beaconLayer.opacity * 0.96);
    });
    applyMaterialBlendMode(beaconLayer.blendMode, clusters.map((cluster) => cluster.beaconMaterial));

    const tracesLayer = getLayerState(activeMix, 'traces');
    traces.setEnabled(tracesLayer.enabled);
    traces.alpha = tracesLayer.enabled ? Math.max(0.02, tracesLayer.opacity * 0.28) : 0;

    scene.fogDensity = baseFogDensity * (1 + activeMix.postFx.vignette * 0.42);
  };

  const setStandby = (phase: RitualPhaseState) => {
    const standbyColor = Color3.FromHexString(phase.accentHex);
    ambientLight.intensity = 0.12;
    cyanLight.intensity = 0.18;
    magentaLight.intensity = 0.12;
    rimLight.intensity = 0.1;
    glow.intensity = 0.08;
    platformRimMaterial.emissiveColor = standbyColor.scale(0.2);
    platformSurfaceMaterial.emissiveColor = standbyColor.scale(0.06);
    traces.alpha = 0.08;

    clusters.forEach((cluster) => {
      cluster.core.scaling.y = 1;
      cluster.core.position.y = cluster.floorY + cluster.baseHeight / 2;
      cluster.shell.scaling.y = 1;
      cluster.shell.position.y = cluster.core.position.y;
      cluster.shellMaterial.emissiveColor = standbyColor.scale(0.08);
      cluster.shellMaterial.alpha = 0.1;
      cluster.beaconMaterial.emissiveColor = standbyColor.scale(0.12);
      cluster.beacon.position.y = cluster.floorY + cluster.baseHeight + 0.18;
    });
  };

  const update = (
    deltaSeconds: number,
    timeSeconds: number,
    audio: AudioReactiveSnapshot,
    phase: RitualPhaseState,
  ) => {
    void timeSeconds;

    time += deltaSeconds;
    eventPulse *= Math.pow(0.1, deltaSeconds);
    fireEnergy *= Math.pow(0.16, deltaSeconds);
    acidEnergy *= Math.pow(0.18, deltaSeconds);
    technoEnergy *= Math.pow(0.14, deltaSeconds);

    const platformLayer = getLayerState(activeMix, 'platform');
    const cityLayer = getLayerState(activeMix, 'city');
    const beaconLayer = getLayerState(activeMix, 'beacons');
    const tracesLayer = getLayerState(activeMix, 'traces');
    const platformReactive = platformLayer.audioReactive ? 1 : 0;
    const cityReactive = cityLayer.audioReactive ? 1 : 0;
    const beaconReactive = beaconLayer.audioReactive ? 1 : 0;
    const tracesReactive = tracesLayer.audioReactive ? 1 : 0;
    const platformRimIntensity = getLayerControlNumber(activeMix, 'platform', 'rimIntensity', 1);
    const platformSurfaceIntensity = getLayerControlNumber(activeMix, 'platform', 'surfaceIntensity', 1);
    const platformTextureDrift = getLayerControlNumber(activeMix, 'platform', 'textureDrift', 1);
    const cityHeightScale = getLayerControlNumber(activeMix, 'city', 'heightScale', 1);
    const cityRotationSpeed = getLayerControlNumber(activeMix, 'city', 'rotationSpeed', 1);
    const cityShellIntensity = getLayerControlNumber(activeMix, 'city', 'shellIntensity', 1);
    const beaconHoverAmount = getLayerControlNumber(activeMix, 'beacons', 'hoverAmount', 1);
    const beaconSize = getLayerControlNumber(activeMix, 'beacons', 'size', 1);
    const beaconIntensityBoost = getLayerControlNumber(activeMix, 'beacons', 'intensityBoost', 1);
    const traceSignalIntensity = getLayerControlNumber(activeMix, 'traces', 'signalIntensity', 1);
    const tracePulseScale = getLayerControlNumber(activeMix, 'traces', 'pulseScale', 1);
    const postFxBloom = 0.62 + activeMix.postFx.bloom * 0.82;
    const postFxRgbSplit = activeMix.postFx.rgbSplit;
    const postFxNoise = activeMix.postFx.noise;
    const postFxScanlines = activeMix.postFx.scanlines;

    const beat = Math.max(audio.kick, audio.bass * 0.82, eventPulse * 0.7);
    const targetColor = Color3.Lerp(
      Color3.FromHexString(phase.accentHex),
      eventColor,
      Math.min(1, 0.32 + eventPulse * 0.48 + technoEnergy * 0.12),
    );

    ambientLight.intensity = 0.16
      + phase.energy * 0.12
      + audio.rms * 0.08 * platformReactive
      + platformLayer.intensity * 0.08
      - activeMix.postFx.vignette * 0.06;
    cyanLight.intensity = (0.54 + beat * 1.2 * platformReactive + technoEnergy * 0.48) * (0.7 + platformLayer.intensity * 0.4);
    cyanLight.position.x = -3.8 - postFxRgbSplit * 0.8;
    magentaLight.intensity = (0.48 + audio.high * 0.84 * cityReactive + fireEnergy * 0.42) * (0.65 + cityLayer.intensity * 0.4);
    magentaLight.position.x = 4.4 + postFxRgbSplit * 0.84;
    rimLight.diffuse = targetColor;
    rimLight.intensity = (0.34 + audio.mid * 0.92 * cityReactive + phase.bloomBoost * 1.4) * (0.68 + cityLayer.intensity * 0.42);

    platformRim.scaling.setAll(1 + beat * 0.04 * platformReactive * platformRimIntensity + phase.energy * 0.02);
    platformRimMaterial.emissiveColor = Color3.Lerp(
      platformRimMaterial.emissiveColor,
      targetColor.scale((0.36 + beat * 0.5 * platformReactive + technoEnergy * 0.2) * platformLayer.intensity * platformRimIntensity),
      0.12,
    );
    platformSurfaceMaterial.emissiveColor = Color3.Lerp(
      platformSurfaceMaterial.emissiveColor,
      targetColor.scale((0.08 + audio.high * 0.16 * platformReactive + phase.bloomBoost * 0.18) * platformLayer.intensity * platformSurfaceIntensity),
      0.08,
    );
    platformTexture.uOffset = Math.sin(time * 0.12) * 0.012 * platformTextureDrift + postFxNoise * 0.002;
    platformTexture.vOffset = Math.cos(time * 0.09) * 0.012 * platformTextureDrift;

    cityRoot.rotation.y += deltaSeconds * (0.04 + phase.energy * 0.06 * cityReactive + technoEnergy * 0.03) * cityRotationSpeed;

    const cameraOrbitSpeed = 0.04 + activeMix.camera.orbitSpeed * 0.18;
    const cameraShake = activeMix.camera.shake * (0.02 + beat * 0.02);
    const cameraZoom = activeMix.camera.zoom;
    if (activeMix.camera.mode === 'slowPush') {
      camera.alpha = baseCameraAlpha + Math.sin(time * 0.12) * (0.02 + activeMix.camera.shake * 0.02);
      camera.beta = baseCameraBeta + Math.cos(time * 0.11) * 0.02;
      camera.radius = baseCameraRadius / cameraZoom - Math.sin(time * 0.18) * 0.28;
    } else if (activeMix.camera.mode === 'handheldFake') {
      camera.alpha = baseCameraAlpha + Math.sin(time * 1.8) * cameraShake + Math.cos(time * 0.2) * 0.03;
      camera.beta = baseCameraBeta + Math.cos(time * 1.3) * cameraShake + Math.sin(time * 0.18) * 0.02;
      camera.radius = baseCameraRadius / cameraZoom + Math.sin(time * 0.7) * 0.08;
    } else if (activeMix.camera.mode === 'locked') {
      camera.alpha = baseCameraAlpha + Math.sin(time * 0.1) * cameraShake;
      camera.beta = baseCameraBeta + Math.cos(time * 0.08) * cameraShake * 0.7;
      camera.radius = baseCameraRadius / cameraZoom;
    } else {
      camera.alpha = baseCameraAlpha + time * cameraOrbitSpeed + Math.sin(time * 0.18) * (0.02 + activeMix.camera.shake * 0.02);
      camera.beta = baseCameraBeta + Math.cos(time * 0.13) * 0.03;
      camera.radius = baseCameraRadius / cameraZoom;
    }
    camera.setTarget(baseCameraTarget);

    traces.alpha = tracesLayer.enabled
      ? (0.08 + audio.high * 0.24 * tracesReactive + phase.bloomBoost * 0.18) * tracesLayer.opacity * traceSignalIntensity * (0.72 + tracesLayer.intensity * 0.34) + postFxScanlines * 0.04
      : 0;
    traces.scaling.setAll(1 + beat * 0.04 * tracesReactive * tracePulseScale);

    clusters.forEach((cluster, index) => {
      const localPulse = 1
        + audio.mid * 0.12 * cityReactive
        + beat * 0.08 * cityReactive
        + (index % 5 === 0 ? technoEnergy * 0.05 : 0);
      const scaledPulse = 1 + (localPulse - 1) * cityHeightScale;
      cluster.core.scaling.y = scaledPulse;
      cluster.shell.scaling.y = scaledPulse * 1.02;
      cluster.core.position.y = cluster.floorY + (cluster.baseHeight * scaledPulse) / 2;
      cluster.shell.position.y = cluster.core.position.y;

      const beaconBob = Math.sin(time * (0.9 + (index % 4) * 0.08) + cluster.offset) * 0.08 * beaconHoverAmount;
      cluster.beacon.position.y = cluster.floorY + cluster.baseHeight * scaledPulse + 0.22 + beaconBob;

      const clusterColor = Color3.Lerp(cluster.tint, targetColor, 0.22 + phase.energy * 0.18);
      cluster.shellMaterial.emissiveColor = Color3.Lerp(
        cluster.shellMaterial.emissiveColor,
        clusterColor.scale((0.24 + audio.high * 0.42 * cityReactive + eventPulse * 0.12) * cityLayer.intensity * cityShellIntensity),
        0.12,
      );
      cluster.shellMaterial.alpha = cityLayer.enabled
        ? Math.max(0.04, cityLayer.opacity * (0.1 + audio.high * 0.08 * cityReactive + eventPulse * 0.06))
        : 0;
      cluster.beaconMaterial.emissiveColor = Color3.Lerp(
        cluster.beaconMaterial.emissiveColor,
        clusterColor.scale((0.32 + beat * 0.44 * beaconReactive) * beaconLayer.intensity * beaconIntensityBoost),
        0.16,
      );
      cluster.beacon.scaling.setAll(beaconSize * (1 + beat * 0.24 * beaconReactive + phase.energy * 0.06));
    });

    glow.intensity = (0.2 + audio.high * 0.3 + phase.bloomBoost * 0.3 + technoEnergy * 0.12) * postFxBloom;
    scene.fogDensity = baseFogDensity * (1 + activeMix.postFx.vignette * 0.42 + activeMix.postFx.noise * 0.08);
  };

  const dispose = () => {
    glow.dispose();
    rimLight.dispose();
    magentaLight.dispose();
    cyanLight.dispose();
    ambientLight.dispose();
    platformTexture.dispose();
    camera.dispose();
    traces.dispose();
    cityRoot.dispose(false, true);
    platformRim.dispose(false, true);
    platformSurface.dispose(false, true);
    platformBase.dispose(false, true);
  };

  applyMixState(activeMix);

  return {
    camera,
    applyVisualImpulse,
    applyMixState,
    setStandby,
    update,
    dispose,
  };
}