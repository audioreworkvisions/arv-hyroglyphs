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

interface CreatePrismShardsSceneOptions {
  scene: Scene;
  canvas: HTMLCanvasElement;
  mode: ARVLiveMode;
  quality: ARVQualitySettings;
  preset: ARVLiveVisualPreset;
}

interface PrismShard {
  mesh: Mesh;
  material: StandardMaterial;
  tint: Color3;
  basePosition: Vector3;
  drift: number;
  spin: Vector3;
}

export const PRISM_SHARDS_LAYER_SCHEMA: ARVLayerSchema[] = [
  {
    id: 'backdrop',
    label: 'Backdrop',
    controls: [
      { key: 'drift', label: 'Drift', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'signalIntensity', label: 'Signal Intensity', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'shards',
    label: 'Shards',
    controls: [
      { key: 'floatAmount', label: 'Float Amount', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'spinSpeed', label: 'Spin Speed', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'edgeIntensity', label: 'Edge Intensity', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'dustOrbs',
    label: 'Dust Orbs',
    controls: [
      { key: 'drift', label: 'Drift', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'size', label: 'Size', type: 'slider', target: 'controls', min: 0.4, max: 2, step: 0.01, defaultValue: 1 },
      { key: 'intensityBoost', label: 'Intensity Boost', type: 'slider', target: 'controls', min: 0, max: 2, step: 0.01, defaultValue: 1 },
    ],
  },
  {
    id: 'postFx',
    label: 'Post FX',
    kind: 'postFx',
    controls: [
      { key: 'bloom', label: 'Bloom', type: 'slider', target: 'postFx', min: 0, max: 2, step: 0.01, defaultValue: 0.66 },
      { key: 'scanlines', label: 'Scanlines', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.36 },
      { key: 'rgbSplit', label: 'RGB Split', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.24 },
      { key: 'noise', label: 'Noise', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.18 },
      { key: 'vignette', label: 'Vignette', type: 'slider', target: 'postFx', min: 0, max: 1, step: 0.01, defaultValue: 0.42 },
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
      { key: 'orbitSpeed', label: 'Orbit Speed', type: 'slider', target: 'camera', min: 0, max: 1.5, step: 0.01, defaultValue: 0.18 },
      { key: 'shake', label: 'Shake', type: 'slider', target: 'camera', min: 0, max: 1, step: 0.01, defaultValue: 0.04 },
    ],
  },
];

export const createPrismShardsDefaultMixState = (presetId: string): ARVLiveMixState => {
  return {
    presetId,
    layers: {
      backdrop: createLayerState({ drift: 1, signalIntensity: 1 }, { audioReactive: false, blendMode: 'screen' }),
      shards: createLayerState({ floatAmount: 1, spinSpeed: 1, edgeIntensity: 1 }, { audioReactive: true, blendMode: 'screen' }),
      dustOrbs: createLayerState({ drift: 1, size: 1, intensityBoost: 1 }, { audioReactive: true, blendMode: 'add' }),
    },
    postFx: {
      bloom: 0.66,
      scanlines: 0.36,
      rgbSplit: 0.24,
      vignette: 0.42,
      noise: 0.18,
    },
    camera: {
      mode: 'slowOrbit',
      zoom: 1,
      orbitSpeed: 0.18,
      shake: 0.04,
    },
  };
};

const clamp = (value: number, min = 0, max = 1.6): number => {
  return Math.min(max, Math.max(min, value));
};

const createBackdropTexture = (scene: Scene): DynamicTexture => {
  const width = 1280;
  const height = 720;
  const texture = new DynamicTexture('arv-prism-shards-backdrop', { width, height }, scene, false);
  const ctx = texture.getContext();

  texture.hasAlpha = true;
  ctx.fillStyle = '#030612';
  ctx.fillRect(0, 0, width, height);

  for (let index = 0; index < 90; index += 1) {
    const y = (index / 90) * height;
    ctx.fillStyle = index % 2 === 0 ? 'rgba(113, 229, 255, 0.03)' : 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, y, width, 2);
  }

  for (let index = 0; index < 24; index += 1) {
    const x = (index / 24) * width;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(93, 122, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (index % 2 === 0 ? 24 : -18), height);
    ctx.stroke();
  }

  for (let index = 0; index < 18; index += 1) {
    const x = (index * 73) % width;
    const y = (index * 41) % height;
    const size = 10 + (index % 3) * 6;
    ctx.beginPath();
    ctx.strokeStyle = index % 2 === 0 ? 'rgba(141, 181, 255, 0.16)' : 'rgba(79, 125, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y + size * 0.6);
    ctx.lineTo(x - size, y + size * 0.8);
    ctx.closePath();
    ctx.stroke();
  }

  texture.update(false);
  return texture;
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

export function createPrismShardsScene({
  scene,
  canvas,
  mode,
  quality,
  preset,
}: CreatePrismShardsSceneOptions) {
  void canvas;

  const backgroundColor = Color3.FromHexString(preset.backgroundHex);
  const baseFogDensity = quality.tier === 'eco' ? 0.02 : 0.013;
  scene.clearColor = new Color4(backgroundColor.r, backgroundColor.g, backgroundColor.b, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = baseFogDensity;
  scene.fogColor = Color3.FromHexString(preset.fogHex);

  const camera = new ArcRotateCamera(
    'arv-prism-shards-camera',
    -Math.PI / 2,
    Math.PI / 2.24,
    mode === 'obs' ? 10.1 : 10.8,
    new Vector3(0, 0.15, 0),
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
  camera.maxZ = 60;

  const ambientLight = new HemisphericLight('arv-prism-shards-hemi', new Vector3(0, 1, 0), scene);
  ambientLight.intensity = 0.18;
  ambientLight.groundColor = Color3.FromHexString('#02040a');

  const keyLight = new PointLight('arv-prism-shards-key', new Vector3(-3.2, 2.8, -4.2), scene);
  keyLight.diffuse = Color3.FromHexString(preset.portalHex);
  keyLight.intensity = 0.94;

  const fillLight = new PointLight('arv-prism-shards-fill', new Vector3(3.8, -1.8, 3.4), scene);
  fillLight.diffuse = Color3.FromHexString(preset.crowdHex);
  fillLight.intensity = 0.74;

  const bloomLight = new PointLight('arv-prism-shards-bloom', new Vector3(0, 0.2, 0), scene);
  bloomLight.diffuse = Color3.FromHexString(preset.accentHex);
  bloomLight.intensity = 0.36;

  const glow = new GlowLayer('arv-prism-shards-glow', scene, {
    mainTextureRatio: quality.tier === 'eco' ? 0.4 : 0.58,
    blurKernelSize: quality.tier === 'obs' ? 42 : 28,
    mainTextureSamples: quality.tier === 'obs' ? 4 : 1,
  });
  glow.intensity = 0.66;

  const backdropTexture = createBackdropTexture(scene);
  const backdropMaterial = new StandardMaterial('arv-prism-shards-backdrop-mat', scene);
  backdropMaterial.diffuseTexture = backdropTexture;
  backdropMaterial.emissiveTexture = backdropTexture;
  backdropMaterial.diffuseColor = Color3.FromHexString('#060a18');
  backdropMaterial.emissiveColor = Color3.FromHexString(preset.portalHex).scale(0.22);
  backdropMaterial.backFaceCulling = false;

  const backdrop = MeshBuilder.CreatePlane(
    'arv-prism-shards-backdrop',
    { width: 15.5, height: 8.7, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  backdrop.position.set(0, 0, 5.4);
  backdrop.material = backdropMaterial;

  const shardRoot = new TransformNode('arv-prism-shards-root', scene);
  const shards: PrismShard[] = [];
  const palette = [preset.portalHex, preset.crowdHex, preset.accentHex, '#bfd1ff'];
  const shardCount = quality.tier === 'eco' ? 10 : 16;

  for (let index = 0; index < shardCount; index += 1) {
    const angle = (Math.PI * 2 * index) / shardCount;
    const outerRadius = 4.4 + (index % 4) * 0.6;
    const vertical = -1.6 + (index % 5) * 0.78;
    const basePosition = new Vector3(
      Math.cos(angle) * outerRadius,
      vertical,
      Math.sin(angle) * 1.8 + Math.cos(angle * 1.6) * 1.3,
    );
    const size = 0.9 + (index % 3) * 0.32;
    const tintHex = palette[index % palette.length];
    const tint = Color3.FromHexString(tintHex);
    const material = createMaterial(
      scene,
      `arv-prism-shards-material-${index}`,
      '#081121',
      tintHex,
      0.26 + (index % 3) * 0.06,
    );

    const shard = MeshBuilder.CreateCylinder(
      `arv-prism-shards-${index}`,
      {
        diameterTop: size,
        diameterBottom: size * (0.82 + (index % 2) * 0.08),
        height: 0.06 + (index % 2) * 0.03,
        tessellation: 3,
      },
      scene,
    );
    shard.parent = shardRoot;
    shard.position.copyFrom(basePosition);
    shard.rotation.set(index * 0.33, angle * 1.2, index * 0.21);
    shard.material = material;
    shard.enableEdgesRendering();
    shard.edgesWidth = quality.tier === 'obs' ? 3.4 : 2.2;
    shard.edgesColor = new Color4(tint.r, tint.g, tint.b, 0.84);

    shards.push({
      mesh: shard,
      material,
      tint,
      basePosition,
      drift: index * 0.42 + outerRadius * 0.15,
      spin: new Vector3(0.16 + (index % 3) * 0.05, 0.22 + (index % 4) * 0.03, 0.12 + (index % 5) * 0.03),
    });
  }

  const dustOrbs = Array.from({ length: quality.tier === 'eco' ? 8 : 14 }, (_, index) => {
    const orb = MeshBuilder.CreateSphere(
      `arv-prism-shards-orb-${index}`,
      { diameter: 0.09 + (index % 3) * 0.03, segments: 8 },
      scene,
    );
    orb.parent = shardRoot;
    orb.position.set(
      Math.cos(index * 0.8) * (5.6 + (index % 4) * 0.4),
      -1.8 + (index % 6) * 0.7,
      Math.sin(index * 0.5) * 2.6,
    );
    const orbMaterial = createMaterial(scene, `arv-prism-shards-orb-mat-${index}`, '#0a1327', palette[index % palette.length], 0.94);
    orb.material = orbMaterial;
    glow.addIncludedOnlyMesh(orb);
    return { orb, material: orbMaterial, drift: index * 0.37 };
  });

  glow.addIncludedOnlyMesh(backdrop);
  shards.forEach((shard) => glow.addIncludedOnlyMesh(shard.mesh));

  let eventPulse = 0;
  let shardSurge = 0;
  let acidEnergy = 0;
  let fireEnergy = 0;
  let eventColor = Color3.FromHexString(preset.portalHex);
  let time = 0;
  let activeMix = createPrismShardsDefaultMixState(preset.id);

  const applyReactionEnergy = (reaction?: ARVReactionKind | null, intensity = 0.6) => {
    switch (reaction) {
      case 'fire':
        fireEnergy = clamp(fireEnergy + intensity, 0, 1.4);
        break;
      case 'acid':
        acidEnergy = clamp(acidEnergy + intensity, 0, 1.4);
        break;
      default:
        shardSurge = clamp(shardSurge + intensity, 0, 1.4);
        break;
    }
  };

  const applyVisualImpulse = (impulse: ARVVisualImpulse, reaction?: ARVReactionKind | null) => {
    eventPulse = clamp(eventPulse + impulse.intensity * 0.48, 0, 1.5);
    shardSurge = clamp(shardSurge + impulse.sparkle * 0.22, 0, 1.4);
    eventColor = Color3.FromHexString(impulse.colorHex);
    applyReactionEnergy(reaction, impulse.intensity);
  };

  const applyMixState = (mix: ARVLiveMixState) => {
    activeMix = mix;

    const backdropLayer = getLayerState(activeMix, 'backdrop');
    setNodeEnabled([backdrop], backdropLayer.enabled);
    backdropMaterial.alpha = Math.max(0.06, backdropLayer.opacity);
    applyMaterialBlendMode(backdropLayer.blendMode, [backdropMaterial]);

    const shardsLayer = getLayerState(activeMix, 'shards');
    shards.forEach((shard) => {
      shard.mesh.setEnabled(shardsLayer.enabled);
      shard.material.alpha = Math.max(0.04, shardsLayer.opacity * 0.26);
    });
    applyMaterialBlendMode(shardsLayer.blendMode, shards.map((shard) => shard.material));

    const dustLayer = getLayerState(activeMix, 'dustOrbs');
    dustOrbs.forEach(({ orb, material }) => {
      orb.setEnabled(dustLayer.enabled);
      material.alpha = Math.max(0.04, dustLayer.opacity * 0.94);
    });
    applyMaterialBlendMode(dustLayer.blendMode, dustOrbs.map(({ material }) => material));

    scene.fogDensity = baseFogDensity * (1 + activeMix.postFx.vignette * 0.38);
  };

  const setStandby = (phase: RitualPhaseState) => {
    const standbyColor = Color3.FromHexString(phase.accentHex);
    ambientLight.intensity = 0.08;
    keyLight.intensity = 0.12;
    fillLight.intensity = 0.08;
    bloomLight.intensity = 0.08;
    glow.intensity = 0.08;
    backdropMaterial.emissiveColor = standbyColor.scale(0.08);

    shards.forEach((shard) => {
      shard.material.emissiveColor = standbyColor.scale(0.12);
      shard.material.alpha = 0.14;
      shard.mesh.scaling.setAll(1);
    });

    dustOrbs.forEach(({ material }) => {
      material.emissiveColor = standbyColor.scale(0.12);
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
    eventPulse *= Math.pow(0.12, deltaSeconds);
    shardSurge *= Math.pow(0.16, deltaSeconds);
    acidEnergy *= Math.pow(0.18, deltaSeconds);
    fireEnergy *= Math.pow(0.18, deltaSeconds);

    const backdropLayer = getLayerState(activeMix, 'backdrop');
    const shardsLayer = getLayerState(activeMix, 'shards');
    const dustLayer = getLayerState(activeMix, 'dustOrbs');
    const backdropReactive = backdropLayer.audioReactive ? 1 : 0;
    const shardsReactive = shardsLayer.audioReactive ? 1 : 0;
    const dustReactive = dustLayer.audioReactive ? 1 : 0;
    const backdropDrift = getLayerControlNumber(activeMix, 'backdrop', 'drift', 1);
    const backdropSignal = getLayerControlNumber(activeMix, 'backdrop', 'signalIntensity', 1);
    const shardFloat = getLayerControlNumber(activeMix, 'shards', 'floatAmount', 1);
    const shardSpin = getLayerControlNumber(activeMix, 'shards', 'spinSpeed', 1);
    const shardEdgeIntensity = getLayerControlNumber(activeMix, 'shards', 'edgeIntensity', 1);
    const dustDrift = getLayerControlNumber(activeMix, 'dustOrbs', 'drift', 1);
    const dustSize = getLayerControlNumber(activeMix, 'dustOrbs', 'size', 1);
    const dustIntensityBoost = getLayerControlNumber(activeMix, 'dustOrbs', 'intensityBoost', 1);
    const postFxBloom = 0.58 + activeMix.postFx.bloom * 0.8;
    const postFxRgbSplit = activeMix.postFx.rgbSplit;
    const postFxNoise = activeMix.postFx.noise;
    const postFxScanlines = activeMix.postFx.scanlines;

    const beat = Math.max(audio.high * 0.7, audio.mid * 0.46, eventPulse * 0.82);
    const targetColor = Color3.Lerp(
      Color3.FromHexString(phase.accentHex),
      eventColor,
      Math.min(1, 0.24 + eventPulse * 0.54 + acidEnergy * 0.12),
    );

    ambientLight.intensity = 0.08 + audio.rms * 0.08 + phase.energy * 0.06 - activeMix.postFx.vignette * 0.04;
    keyLight.diffuse = targetColor;
    keyLight.intensity = (0.34 + beat * 1.04 * shardsReactive + phase.bloomBoost * 0.6) * (0.72 + shardsLayer.intensity * 0.36);
    keyLight.position.x = -3.2 - postFxRgbSplit * 0.7;
    fillLight.intensity = (0.22 + acidEnergy * 0.52 + audio.mid * 0.3 * dustReactive) * (0.68 + dustLayer.intensity * 0.32);
    fillLight.position.x = 3.8 + postFxRgbSplit * 0.74;
    bloomLight.diffuse = targetColor;
    bloomLight.intensity = (0.14 + beat * 0.54 * backdropReactive + fireEnergy * 0.28) * (0.68 + backdropLayer.intensity * 0.28);

    backdrop.position.x = Math.sin(time * 0.18) * 0.12 * backdropDrift;
    backdropMaterial.emissiveColor = Color3.Lerp(
      backdropMaterial.emissiveColor,
      targetColor.scale((0.08 + audio.high * 0.16 * backdropReactive + phase.bloomBoost * 0.12) * backdropLayer.intensity * backdropSignal),
      0.08,
    );
    backdropTexture.uOffset = Math.sin(time * 0.07) * 0.016 * backdropDrift + postFxNoise * 0.003;
    backdropTexture.vOffset = Math.cos(time * 0.05) * 0.014 * backdropDrift + postFxScanlines * 0.002;

    shardRoot.rotation.y += deltaSeconds * (0.03 + phase.energy * 0.03) * shardSpin;

    const cameraOrbitSpeed = 0.04 + activeMix.camera.orbitSpeed * 0.16;
    const cameraShake = activeMix.camera.shake * (0.02 + beat * 0.02);
    const cameraZoom = activeMix.camera.zoom;
    if (activeMix.camera.mode === 'slowPush') {
      camera.alpha = baseCameraAlpha + Math.sin(time * 0.12) * 0.02;
      camera.beta = baseCameraBeta + Math.cos(time * 0.17) * (0.02 + cameraShake * 0.6);
      camera.radius = baseCameraRadius / cameraZoom - Math.sin(time * 0.16) * 0.24;
    } else if (activeMix.camera.mode === 'handheldFake') {
      camera.alpha = baseCameraAlpha + Math.sin(time * 1.6) * cameraShake + Math.cos(time * 0.16) * 0.02;
      camera.beta = baseCameraBeta + Math.cos(time * 1.2) * cameraShake;
      camera.radius = baseCameraRadius / cameraZoom + Math.sin(time * 0.64) * 0.06;
    } else if (activeMix.camera.mode === 'locked') {
      camera.alpha = baseCameraAlpha + Math.sin(time * 0.1) * cameraShake;
      camera.beta = baseCameraBeta + Math.cos(time * 0.08) * cameraShake * 0.8;
      camera.radius = baseCameraRadius / cameraZoom;
    } else {
      camera.alpha = baseCameraAlpha + time * cameraOrbitSpeed + Math.sin(time * 0.14) * (0.02 + cameraShake);
      camera.beta = baseCameraBeta + Math.cos(time * 0.17) * 0.035;
      camera.radius = baseCameraRadius / cameraZoom;
    }
    camera.setTarget(baseCameraTarget);

    shards.forEach((shard, index) => {
      const floatX = Math.sin(time * (0.34 + shard.spin.x * 0.2) + shard.drift) * 0.18 * shardFloat;
      const floatY = Math.cos(time * (0.42 + shard.spin.y * 0.18) + shard.drift) * 0.22 * shardFloat;
      const floatZ = Math.sin(time * (0.28 + shard.spin.z * 0.24) + shard.drift) * 0.26 * shardFloat;
      shard.mesh.position.set(
        shard.basePosition.x + floatX,
        shard.basePosition.y + floatY,
        shard.basePosition.z + floatZ,
      );
      shard.mesh.rotation.x += deltaSeconds * shard.spin.x * shardSpin;
      shard.mesh.rotation.y += deltaSeconds * (shard.spin.y + phase.energy * 0.08 * shardsReactive) * shardSpin;
      shard.mesh.rotation.z += deltaSeconds * (shard.spin.z + shardSurge * 0.04 * shardsReactive) * shardSpin;

      const scale = 1 + beat * 0.08 * shardsReactive + (index % 3 === 0 ? shardSurge * 0.04 * shardsReactive : 0);
      shard.mesh.scaling.setAll(scale);

      const shardColor = Color3.Lerp(shard.tint, targetColor, 0.2 + phase.energy * 0.16 + acidEnergy * 0.1);
      shard.material.emissiveColor = Color3.Lerp(
        shard.material.emissiveColor,
        shardColor.scale((0.24 + audio.high * 0.46 * shardsReactive + eventPulse * 0.18) * shardsLayer.intensity),
        0.12,
      );
      shard.material.alpha = shardsLayer.enabled
        ? Math.max(0.04, shardsLayer.opacity * (0.14 + audio.high * 0.08 * shardsReactive + phase.bloomBoost * 0.06 + fireEnergy * 0.04))
        : 0;
      shard.mesh.edgesColor = new Color4(
        shardColor.r,
        shardColor.g,
        shardColor.b,
        Math.min(1, 0.28 + shardEdgeIntensity * 0.38 + activeMix.postFx.rgbSplit * 0.12),
      );
    });

    dustOrbs.forEach(({ orb, material, drift }, index) => {
      orb.position.x += Math.sin(time * 0.24 + drift) * 0.004 * dustDrift;
      orb.position.y = -1.8 + (index % 6) * 0.7 + Math.cos(time * 0.72 + drift) * 0.16 * dustDrift;
      material.emissiveColor = Color3.Lerp(
        material.emissiveColor,
        targetColor.scale((0.18 + audio.high * 0.3 * dustReactive) * dustLayer.intensity * dustIntensityBoost),
        0.12,
      );
      orb.scaling.setAll(dustSize * (1 + beat * 0.18 * dustReactive));
    });

    glow.intensity = (0.18 + audio.high * 0.3 + shardSurge * 0.14 + phase.bloomBoost * 0.26) * postFxBloom;
    scene.fogDensity = baseFogDensity * (1 + activeMix.postFx.vignette * 0.38 + activeMix.postFx.noise * 0.06);
  };

  const dispose = () => {
    glow.dispose();
    bloomLight.dispose();
    fillLight.dispose();
    keyLight.dispose();
    ambientLight.dispose();
    backdropTexture.dispose();
    camera.dispose();
    shardRoot.dispose(false, true);
    backdrop.dispose(false, true);
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