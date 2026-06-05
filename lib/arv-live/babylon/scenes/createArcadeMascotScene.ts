import {
  ArcRotateCamera,
  Color3,
  Color4,
  Constants,
  DynamicTexture,
  GlowLayer,
  HemisphericLight,
  Material,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  PointLight,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import type { AudioReactiveSnapshot } from '../../AudioReactiveUniforms';
import type { RitualPhaseState } from '../../RitualPhaseController';
import type { ARVLiveMode, ARVLiveVisualPreset, ARVQualitySettings } from '../../presets';
import {
  createDefaultARVLiveLayerState,
  createEmptyARVLiveMixState,
  type ARVLayerBlendMode,
  type ARVLiveMixState,
  type ARVReactionKind,
  type ARVVisualImpulse,
} from '../../types';
import { createLaughingSignalMascot } from '../mascots/createLaughingSignalMascot';
import { createArcadeGridFloor } from './createArcadeGridFloor';
import { createArcadePanels } from './createArcadePanels';
import { createArcadePopArtPlaques } from './createArcadePopArtPlaques';

export interface ArcadeMascotSceneController {
  camera: ArcRotateCamera;
  triggerPulse: () => void;
  triggerFire: () => void;
  triggerAcid: () => void;
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

interface CreateArcadeMascotSceneOptions {
  scene: Scene;
  canvas: HTMLCanvasElement;
  mode: ARVLiveMode;
  quality: ARVQualitySettings;
  preset: ARVLiveVisualPreset;
}

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

const createBackdropTexture = (scene: Scene): DynamicTexture => {
  const width = 1024;
  const height = 640;
  const texture = new DynamicTexture('arv-laughing-signal-backdrop', { width, height }, scene, false);
  const ctx = texture.getContext();

  texture.hasAlpha = true;
  ctx.fillStyle = '#070b16';
  ctx.fillRect(0, 0, width, height);

  for (let index = 0; index < 90; index += 1) {
    const y = (index / 90) * height;
    ctx.fillStyle = index % 2 === 0 ? 'rgba(110, 190, 255, 0.04)' : 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, y, width, 3);
  }

  const drawWave = (offset: number, color: string, alpha: number) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 5;
    ctx.beginPath();

    for (let x = 0; x <= width; x += 14) {
      const normalized = x / width;
      const y = height * 0.4
        + Math.sin(normalized * Math.PI * 5.4 + offset) * 120
        + Math.cos(normalized * Math.PI * 2.4 + offset * 0.6) * 54;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.restore();
  };

  drawWave(0, '#2fd6ff', 0.48);
  drawWave(0.42, '#ff4fd8', 0.18);
  drawWave(-0.35, '#75ff52', 0.12);

  texture.update(false);
  return texture;
};

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized;

  const red = Number.parseInt(full.slice(0, 2), 16);
  const green = Number.parseInt(full.slice(2, 4), 16);
  const blue = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const createCrtTexture = (
  scene: Scene,
  name: string,
  tintHex: string,
  scanlineAlpha: number,
  bandAlpha: number,
): DynamicTexture => {
  const width = 1024;
  const height = 1024;
  const texture = new DynamicTexture(name, { width, height }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;

  texture.hasAlpha = true;
  ctx.clearRect(0, 0, width, height);

  for (let index = 0; index < 256; index += 1) {
    const y = (index / 256) * height;
    const alpha = index % 2 === 0 ? scanlineAlpha : scanlineAlpha * 0.18;
    ctx.fillStyle = hexToRgba(tintHex, alpha);
    ctx.fillRect(0, y, width, 2);
  }

  for (let index = 0; index < 18; index += 1) {
    const x = (index / 18) * width;
    const alpha = index % 3 === 0 ? bandAlpha : bandAlpha * 0.45;
    ctx.fillStyle = hexToRgba(tintHex, alpha);
    ctx.fillRect(x, 0, width * 0.02, height);
  }

  for (let index = 0; index < 5; index += 1) {
    const y = height * (0.12 + index * 0.18);
    const bandHeight = height * 0.05;
    const sweep = ctx.createLinearGradient(0, y, 0, y + bandHeight);
    sweep.addColorStop(0, 'rgba(255,255,255,0)');
    sweep.addColorStop(0.5, hexToRgba(tintHex, bandAlpha * 1.6));
    sweep.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sweep;
    ctx.fillRect(0, y, width, bandHeight);
  }

  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.18,
    width / 2,
    height / 2,
    height * 0.7,
  );
  vignette.addColorStop(0, 'rgba(255,255,255,0)');
  vignette.addColorStop(0.78, 'rgba(0,0,0,0.08)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  texture.update(false);
  return texture;
};

const createCrtNoiseTexture = (scene: Scene, name: string): DynamicTexture => {
  const width = 384;
  const height = 384;
  const texture = new DynamicTexture(name, { width, height }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  const imageData = ctx.createImageData(width, height);
  const { data } = imageData;

  texture.hasAlpha = true;
  ctx.clearRect(0, 0, width, height);

  for (let index = 0; index < data.length; index += 4) {
    const hot = Math.random() > 0.82;
    const base = hot ? 118 + Math.random() * 137 : Math.random() * 64;
    data[index] = base;
    data[index + 1] = Math.min(255, base + Math.random() * 28);
    data[index + 2] = Math.min(255, base + Math.random() * 52);
    data[index + 3] = hot ? 32 + Math.random() * 118 : Math.random() * 34;
  }

  ctx.putImageData(imageData, 0, 0);

  for (let index = 0; index < 6; index += 1) {
    const y = (index / 6) * height + (index % 2) * 10;
    const barHeight = height * 0.08;
    const rollBar = ctx.createLinearGradient(0, y, 0, y + barHeight);
    rollBar.addColorStop(0, 'rgba(255,255,255,0)');
    rollBar.addColorStop(0.5, index % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(92,172,255,0.12)');
    rollBar.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rollBar;
    ctx.fillRect(0, y, width, barHeight);
  }

  texture.update(false);
  return texture;
};

const createRoomMaterial = (scene: Scene, name: string, diffuseHex: string, emissiveHex: string, alpha = 1) => {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = Color3.FromHexString(diffuseHex);
  material.emissiveColor = Color3.FromHexString(emissiveHex);
  material.alpha = alpha;
  material.backFaceCulling = false;
  return material;
};

export function createArcadeMascotScene({
  scene,
  canvas,
  mode,
  quality,
  preset,
}: CreateArcadeMascotSceneOptions): ArcadeMascotSceneController {
  const backgroundColor = Color3.FromHexString(preset.backgroundHex);
  scene.clearColor = new Color4(backgroundColor.r, backgroundColor.g, backgroundColor.b, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = quality.tier === 'eco' ? 0.018 : 0.012;
  scene.fogColor = Color3.FromHexString(preset.fogHex);

  const camera = new ArcRotateCamera(
    'arv-laughing-signal-camera',
    -Math.PI / 2,
    Math.PI / 2.18,
    mode === 'obs' ? 5.8 : 6.1,
    new Vector3(0, -0.06, 0.1),
    scene,
  );
  const baseCameraAlpha = camera.alpha;
  const baseCameraBeta = camera.beta;
  const baseCameraRadius = camera.radius;
  const baseCameraTarget = camera.getTarget().clone();
  camera.lowerRadiusLimit = baseCameraRadius * 0.72;
  camera.upperRadiusLimit = baseCameraRadius * 1.28;
  camera.lowerAlphaLimit = baseCameraAlpha - 0.42;
  camera.upperAlphaLimit = baseCameraAlpha + 0.42;
  camera.lowerBetaLimit = baseCameraBeta - 0.24;
  camera.upperBetaLimit = baseCameraBeta + 0.24;
  camera.panningSensibility = 0;
  camera.wheelPrecision = 100000;
  camera.inputs.clear();
  camera.minZ = 0.1;
  camera.maxZ = 40;

  const ambientLight = new HemisphericLight('arv-laughing-signal-hemi', new Vector3(0, 1, 0), scene);
  ambientLight.intensity = 0.3;
  ambientLight.groundColor = Color3.FromHexString('#06080f');

  const cyanLight = new PointLight('arv-laughing-signal-cyan-light', new Vector3(0, -0.1, -2.2), scene);
  cyanLight.diffuse = Color3.FromHexString('#d8fbff');
  cyanLight.intensity = 0.98;

  const magentaLight = new PointLight('arv-laughing-signal-magenta-light', new Vector3(-1.8, 0.7, -1.4), scene);
  magentaLight.diffuse = Color3.FromHexString('#5f73aa');
  magentaLight.intensity = 0.42;

  const greenLight = new PointLight('arv-laughing-signal-green-light', new Vector3(1.8, 0.7, -1.2), scene);
  greenLight.diffuse = Color3.FromHexString('#899dc7');
  greenLight.intensity = 0.36;

  const orangeLeft = new PointLight('arv-laughing-signal-orange-left', new Vector3(-3.9, 0.2, 0.8), scene);
  orangeLeft.diffuse = Color3.FromHexString('#c07d4d');
  orangeLeft.intensity = 0.58;

  const orangeRight = new PointLight('arv-laughing-signal-orange-right', new Vector3(3.9, 0.2, 0.8), scene);
  orangeRight.diffuse = Color3.FromHexString('#d39b6a');
  orangeRight.intensity = 0.5;

  const glow = new GlowLayer('arv-laughing-signal-glow', scene, {
    mainTextureRatio: quality.tier === 'eco' ? 0.45 : 0.65,
    blurKernelSize: quality.tier === 'obs' ? 48 : 32,
    mainTextureSamples: quality.tier === 'obs' ? 4 : 1,
  });
  glow.intensity = 0.72;

  const mascot = createLaughingSignalMascot(scene);
  const headMaterial = mascot.head.material as PBRMaterial;
  const leftEyeMaterial = mascot.leftEye.material as StandardMaterial;
  const rightEyeMaterial = mascot.rightEye.material as StandardMaterial;
  const grinMaterial = mascot.grin.material as StandardMaterial;
  const aura = mascot.root.getChildMeshes().find((mesh) => mesh.name === 'arv-laughing-signal-aura') as Mesh | undefined;
  const auraMaterial = aura?.material as StandardMaterial | undefined;
  const headBaseAlbedo = headMaterial.albedoColor.clone();
  const headBaseAlpha = headMaterial.alpha;
  const auraBaseAlpha = auraMaterial?.alpha ?? 0.08;

  const roomMaterial = createRoomMaterial(scene, 'arv-laughing-signal-room-material', '#0b0f18', '#08111f');
  const {
    floor,
    gridX,
    gridZ,
    floorMaterial,
    dispose: disposeGridFloor,
  } = createArcadeGridFloor(scene, quality.tier);
  const {
    leftPanel,
    rightPanel,
    leftMaterial: sidePanelOrangeMaterial,
    rightMaterial: sidePanelRightMaterial,
    dispose: disposePanels,
  } = createArcadePanels(scene);
  const { plaques, dispose: disposePlaques } = createArcadePopArtPlaques(scene);

  const backWallTexture = createBackdropTexture(scene);
  const backWall = MeshBuilder.CreatePlane(
    'arv-laughing-signal-back-wall',
    { width: 10.5, height: 6.1, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  backWall.position.set(0, 0.7, 4.7);
  const backWallMaterial = new StandardMaterial('arv-laughing-signal-back-wall-material', scene);
  backWallMaterial.backFaceCulling = false;
  backWallMaterial.diffuseTexture = backWallTexture;
  backWallMaterial.emissiveTexture = backWallTexture;
  backWallMaterial.diffuseColor = Color3.FromHexString('#10131f');
  backWallMaterial.emissiveColor = Color3.FromHexString('#4ccfff');
  backWall.material = backWallMaterial;

  const ceiling = MeshBuilder.CreatePlane(
    'arv-laughing-signal-ceiling',
    { width: 10.5, height: 9.5, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 2.6, 2.1);
  ceiling.material = roomMaterial;

  const blockPalette = ['#ff7a00', '#3275ff', '#39ff14', '#00f4ff'];
  const blockCount = quality.tier === 'eco' ? 4 : 7;
  const blocks = Array.from({ length: blockCount }, (_, index) => {
    const block = MeshBuilder.CreateBox(
      `arv-laughing-signal-block-${index}`,
      {
        width: 0.22 + (index % 3) * 0.08,
        height: 0.22 + ((index + 1) % 3) * 0.08,
        depth: 0.24 + ((index + 2) % 3) * 0.06,
      },
      scene,
    );
    block.position.set(-2.6 + index * 0.9, 1.38 + Math.sin(index) * 0.22, 1.05 + Math.cos(index) * 0.42);
    block.rotation.set(index * 0.18, index * 0.24, index * 0.14);

    const material = createRoomMaterial(
      scene,
      `arv-laughing-signal-block-material-${index}`,
      '#09101b',
      blockPalette[index % blockPalette.length],
      1,
    );
    block.material = material;
    return block;
  });
  const blockBasePositions = blocks.map((block) => block.position.clone());

  const canvasAspect = (canvas.clientWidth || canvas.width || 16) / Math.max(1, canvas.clientHeight || canvas.height || 9);
  const crtDistance = 1.14;
  const crtHeight = 2 * crtDistance * Math.tan(camera.fov / 2) * 1.04;
  const crtWidth = crtHeight * canvasAspect;

  const crtBaseTexture = createCrtTexture(scene, 'arv-laughing-signal-crt-base', '#d8fbff', 0.075, 0.028);
  const crtRedTexture = createCrtTexture(scene, 'arv-laughing-signal-crt-red', '#ff4d73', 0.038, 0.024);
  const crtGreenTexture = createCrtTexture(scene, 'arv-laughing-signal-crt-green', '#6affb2', 0.026, 0.02);
  const crtBlueTexture = createCrtTexture(scene, 'arv-laughing-signal-crt-blue', '#4c7dff', 0.038, 0.024);
  const crtNoiseTexture = createCrtNoiseTexture(scene, 'arv-laughing-signal-crt-noise');

  const createCrtMaterial = (name: string, texture: DynamicTexture, emissiveHex: string, alpha: number) => {
    const material = new StandardMaterial(name, scene);
    material.backFaceCulling = false;
    material.disableLighting = true;
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.opacityTexture = texture;
    material.useAlphaFromDiffuseTexture = true;
    material.diffuseColor = Color3.Black();
    material.emissiveColor = Color3.FromHexString(emissiveHex);
    material.alpha = alpha;
    return material;
  };

  const crtBaseMaterial = createCrtMaterial(
    'arv-laughing-signal-crt-base-material',
    crtBaseTexture,
    '#d8fbff',
    0.08,
  );
  const crtRedMaterial = createCrtMaterial(
    'arv-laughing-signal-crt-red-material',
    crtRedTexture,
    '#ff4d73',
    0.026,
  );
  const crtGreenMaterial = createCrtMaterial(
    'arv-laughing-signal-crt-green-material',
    crtGreenTexture,
    '#72ffbe',
    0.018,
  );
  const crtBlueMaterial = createCrtMaterial(
    'arv-laughing-signal-crt-blue-material',
    crtBlueTexture,
    '#4c7dff',
    0.026,
  );
  const crtNoiseMaterial = createCrtMaterial(
    'arv-laughing-signal-crt-noise-material',
    crtNoiseTexture,
    '#f1fbff',
    0.03,
  );

  const createCrtOverlayPlane = (name: string, material: StandardMaterial) => {
    const overlay = MeshBuilder.CreatePlane(
      name,
      { width: crtWidth, height: crtHeight, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    overlay.isPickable = false;
    overlay.renderingGroupId = 3;
    overlay.alwaysSelectAsActiveMesh = true;
    overlay.material = material;
    return overlay;
  };

  const crtBaseOverlay = createCrtOverlayPlane('arv-laughing-signal-crt-base-overlay', crtBaseMaterial);
  const crtRedOverlay = createCrtOverlayPlane('arv-laughing-signal-crt-red-overlay', crtRedMaterial);
  const crtGreenOverlay = createCrtOverlayPlane('arv-laughing-signal-crt-green-overlay', crtGreenMaterial);
  const crtBlueOverlay = createCrtOverlayPlane('arv-laughing-signal-crt-blue-overlay', crtBlueMaterial);
  const crtNoiseOverlay = createCrtOverlayPlane('arv-laughing-signal-crt-noise-overlay', crtNoiseMaterial);
  const crtOverlays = [crtBaseOverlay, crtRedOverlay, crtGreenOverlay, crtBlueOverlay, crtNoiseOverlay];
  const plaqueGlowColors = [
    Color3.FromHexString('#00f4ff'),
    Color3.FromHexString('#39ff14'),
    Color3.FromHexString('#ff7a00'),
  ];
  const baseRoomAlpha = roomMaterial.alpha;
  const baseFloorAlpha = floorMaterial.alpha;
  const basePanelAlpha = sidePanelOrangeMaterial.alpha;
  const baseRightPanelAlpha = sidePanelRightMaterial.alpha;
  const baseBackWallPosition = backWall.position.clone();
  const baseBackWallAlpha = backWallMaterial.alpha ?? 1;
  const baseCrtBaseAlpha = crtBaseMaterial.alpha;
  const baseCrtRedAlpha = crtRedMaterial.alpha;
  const baseCrtGreenAlpha = crtGreenMaterial.alpha;
  const baseCrtBlueAlpha = crtBlueMaterial.alpha;
  const baseCrtNoiseAlpha = crtNoiseMaterial.alpha;

  mascot.root.getChildMeshes().forEach((mesh) => {
    if (mesh instanceof Mesh) {
      glow.addIncludedOnlyMesh(mesh);
    }
  });
  glow.addIncludedOnlyMesh(backWall);
  glow.addIncludedOnlyMesh(leftPanel);
  glow.addIncludedOnlyMesh(rightPanel);
  plaques.forEach((plaque) => glow.addIncludedOnlyMesh(plaque.mesh));
  blocks.forEach((block) => glow.addIncludedOnlyMesh(block));

  const blockOffsets = blocks.map((_, index) => index * 0.65 + 0.4);
  let activeMix = createEmptyARVLiveMixState(preset.id);

  let pulseEnergy = 0;
  let fireEnergy = 0;
  let acidEnergy = 0;
  let darkEnergy = 0;
  let technoEnergy = 0;
  let glitchEnergy = 0;
  let bpmPhase = 0; // beat-synced phase accumulator [0, 2π)

  const applyMixState = (mix: ARVLiveMixState) => {
    activeMix = mix;

    const backgroundLayer = getLayerState(activeMix, 'background');
    const gridFloorLayer = getLayerState(activeMix, 'gridFloor');
    const mascotHeadLayer = getLayerState(activeMix, 'mascotHead');
    const spiralEyesLayer = getLayerState(activeMix, 'spiralEyes');
    const grinLayer = getLayerState(activeMix, 'grin');
    const sidePanelsLayer = getLayerState(activeMix, 'sidePanels');
    const toyBlocksLayer = getLayerState(activeMix, 'toyBlocks');

    const backgroundVisible = backgroundLayer.enabled && backgroundLayer.opacity > 0.001;
    backWall.setEnabled(backgroundVisible);
    ceiling.setEnabled(backgroundVisible);
    backWallMaterial.alpha = backgroundVisible ? baseBackWallAlpha * backgroundLayer.opacity : 0;
    roomMaterial.alpha = backgroundVisible ? baseRoomAlpha * backgroundLayer.opacity : 0;
    applyMaterialBlendMode(backgroundLayer.blendMode, [backWallMaterial, roomMaterial]);

    const gridVisible = gridFloorLayer.enabled && gridFloorLayer.opacity > 0.001;
    floor.setEnabled(gridVisible);
    gridX.setEnabled(gridVisible);
    gridZ.setEnabled(gridVisible);
    floorMaterial.alpha = gridVisible ? baseFloorAlpha * gridFloorLayer.opacity : 0;
    applyMaterialBlendMode(gridFloorLayer.blendMode, [floorMaterial]);

    headMaterial.alpha = mascotHeadLayer.enabled ? headBaseAlpha * mascotHeadLayer.opacity : 0;
    if (auraMaterial) {
      auraMaterial.alpha = mascotHeadLayer.enabled ? auraBaseAlpha * mascotHeadLayer.opacity : 0;
    }
    applyMaterialBlendMode(mascotHeadLayer.blendMode, [headMaterial, auraMaterial]);

    const eyesVisible = spiralEyesLayer.enabled && spiralEyesLayer.opacity > 0.001;
    mascot.leftEye.setEnabled(eyesVisible);
    mascot.rightEye.setEnabled(eyesVisible);
    leftEyeMaterial.alpha = eyesVisible ? spiralEyesLayer.opacity : 0;
    rightEyeMaterial.alpha = eyesVisible ? spiralEyesLayer.opacity : 0;
    applyMaterialBlendMode(spiralEyesLayer.blendMode, [leftEyeMaterial, rightEyeMaterial]);

    const grinVisible = grinLayer.enabled && grinLayer.opacity > 0.001;
    mascot.grin.setEnabled(grinVisible);
    grinMaterial.alpha = grinVisible ? grinLayer.opacity : 0;
    applyMaterialBlendMode(grinLayer.blendMode, [grinMaterial]);

    const panelsVisible = sidePanelsLayer.enabled && sidePanelsLayer.opacity > 0.001;
    leftPanel.setEnabled(panelsVisible);
    rightPanel.setEnabled(panelsVisible);
    sidePanelOrangeMaterial.alpha = panelsVisible ? basePanelAlpha * sidePanelsLayer.opacity : 0;
    sidePanelRightMaterial.alpha = panelsVisible ? baseRightPanelAlpha * sidePanelsLayer.opacity : 0;
    applyMaterialBlendMode(sidePanelsLayer.blendMode, [sidePanelOrangeMaterial, sidePanelRightMaterial]);

    const activeBlockCount = Math.max(0, Math.min(blocks.length, Math.round(getLayerControlNumber(activeMix, 'toyBlocks', 'count', blocks.length))));
    blocks.forEach((block, index) => {
      const visible = toyBlocksLayer.enabled && toyBlocksLayer.opacity > 0.001 && index < activeBlockCount;
      block.setEnabled(visible);
      const material = block.material as StandardMaterial;
      material.alpha = visible ? toyBlocksLayer.opacity : 0;
      applyMaterialBlendMode(toyBlocksLayer.blendMode, [material]);
    });

    crtBaseOverlay.setEnabled(activeMix.postFx.scanlines > 0.001 || activeMix.postFx.vignette > 0.001);
    crtRedOverlay.setEnabled(activeMix.postFx.rgbSplit > 0.001);
    crtGreenOverlay.setEnabled(activeMix.postFx.rgbSplit > 0.001);
    crtBlueOverlay.setEnabled(activeMix.postFx.rgbSplit > 0.001);
    crtNoiseOverlay.setEnabled(activeMix.postFx.noise > 0.001);

    camera.radius = Math.min(
      camera.upperRadiusLimit ?? Number.POSITIVE_INFINITY,
      Math.max(camera.lowerRadiusLimit ?? 0.1, baseCameraRadius / Math.max(0.4, activeMix.camera.zoom)),
    );
  };

  const boostReaction = (reaction: ARVReactionKind | 'dark' | 'peace-love-techno' | null | undefined, intensity: number) => {
    switch (reaction) {
      case 'fire':
        fireEnergy = clamp(fireEnergy + intensity);
        mascot.applyImpulse({ intensity, reaction: 'fire' });
        break;
      case 'acid':
        acidEnergy = clamp(acidEnergy + intensity);
        mascot.applyImpulse({ intensity, reaction: 'acid' });
        break;
      case 'dark':
        darkEnergy = clamp(darkEnergy + intensity, 0, 1.3);
        mascot.applyImpulse({ intensity, reaction: 'dark' });
        break;
      case 'peace-love-techno':
        technoEnergy = clamp(technoEnergy + intensity);
        mascot.applyImpulse({ intensity, reaction: 'peace-love-techno' });
        break;
      default:
        pulseEnergy = clamp(pulseEnergy + intensity);
        mascot.applyImpulse({ intensity, reaction: 'pulse' });
        break;
    }

    glitchEnergy = clamp(glitchEnergy + intensity * 0.72);
  };

  const triggerPulse = () => boostReaction('pulse', 0.72);
  const triggerFire = () => boostReaction('fire', 0.94);
  const triggerAcid = () => boostReaction('acid', 0.88);

  const applyVisualImpulse = (impulse: ARVVisualImpulse, reaction?: ARVReactionKind | null) => {
    pulseEnergy = clamp(pulseEnergy + impulse.intensity * 0.45);
    technoEnergy = clamp(technoEnergy + impulse.sparkle * 0.12);
    boostReaction(reaction ?? null, impulse.intensity);
  };

  const setStandby = (phase: RitualPhaseState) => {
    const standbyColor = Color3.FromHexString(phase.accentHex);
    ambientLight.intensity = 0.12;
    cyanLight.intensity = 0.18;
    magentaLight.intensity = 0.08;
    greenLight.intensity = 0.08;
    orangeLeft.intensity = 0.08;
    orangeRight.intensity = 0.08;
    glow.intensity = 0.08;

    floorMaterial.emissiveColor = standbyColor.scale(0.16);
    sidePanelOrangeMaterial.emissiveColor = standbyColor.scale(0.08);
    sidePanelRightMaterial.emissiveColor = standbyColor.scale(0.08);
    backWallMaterial.emissiveColor = standbyColor.scale(0.12);
    plaques.forEach((plaque) => {
      plaque.material.emissiveColor = standbyColor.scale(0.16);
    });
    crtBaseMaterial.alpha = 0.04;
    crtRedMaterial.alpha = 0.012;
    crtGreenMaterial.alpha = 0.01;
    crtBlueMaterial.alpha = 0.012;
    crtNoiseMaterial.alpha = 0.01;
  };

  const update = (
    deltaSeconds: number,
    timeSeconds: number,
    audio: AudioReactiveSnapshot,
    phase: RitualPhaseState,
  ) => {
    pulseEnergy *= Math.pow(0.08, deltaSeconds);
    fireEnergy *= Math.pow(0.12, deltaSeconds);
    acidEnergy *= Math.pow(0.14, deltaSeconds);
    darkEnergy *= Math.pow(0.18, deltaSeconds);
    technoEnergy *= Math.pow(0.16, deltaSeconds);
    glitchEnergy *= Math.pow(0.1, deltaSeconds);

    // BPM beat-sync: advance phase accumulator at detected tempo
    const bpm = audio.bpm ?? 0;
    if (bpm > 0) {
      bpmPhase = (bpmPhase + deltaSeconds * (bpm / 60) * Math.PI * 2) % (Math.PI * 2);
    }
    // sharp narrow pulse once per beat (sin²ⁿ), 0 when no BPM
    const beatPulse = bpm > 0 ? Math.pow(Math.max(0, Math.sin(bpmPhase)), 10) : 0;
    // smooth sine locked to BPM (0–1), 0.5 when no BPM
    const beatSine = bpm > 0 ? Math.sin(bpmPhase) * 0.5 + 0.5 : 0.5;

    const backgroundLayer = getLayerState(activeMix, 'background');
    const gridFloorLayer = getLayerState(activeMix, 'gridFloor');
    const mascotHeadLayer = getLayerState(activeMix, 'mascotHead');
    const spiralEyesLayer = getLayerState(activeMix, 'spiralEyes');
    const grinLayer = getLayerState(activeMix, 'grin');
    const sidePanelsLayer = getLayerState(activeMix, 'sidePanels');
    const toyBlocksLayer = getLayerState(activeMix, 'toyBlocks');

    const backgroundIntensity = backgroundLayer.enabled ? backgroundLayer.intensity : 0;
    const backgroundOpacity = backgroundLayer.enabled ? backgroundLayer.opacity : 0;
    const backgroundAmbient = getLayerControlNumber(activeMix, 'background', 'ambientIntensity', 1);

    const gridIntensity = gridFloorLayer.enabled ? gridFloorLayer.intensity : 0;
    const gridOpacity = gridFloorLayer.enabled ? gridFloorLayer.opacity : 0;
    const gridMovementSpeed = getLayerControlNumber(activeMix, 'gridFloor', 'movementSpeed', 1);
    const gridReactiveBoost = gridFloorLayer.audioReactive ? 0.58 + beatSine * 0.32 + audio.high * 0.28 : 1;

    const mascotHeadIntensity = mascotHeadLayer.enabled ? mascotHeadLayer.intensity : 0;
    const mascotHeadScale = getLayerControlNumber(activeMix, 'mascotHead', 'scale', 1);
    const mascotHeadGloss = getLayerControlNumber(activeMix, 'mascotHead', 'gloss', 1);
    const mascotHeadHoverAmount = getLayerControlNumber(activeMix, 'mascotHead', 'hoverAmount', 1);

    const spiralEyesIntensity = spiralEyesLayer.enabled ? spiralEyesLayer.intensity : 0;
    const spiralRotationSpeed = getLayerControlNumber(activeMix, 'spiralEyes', 'rotationSpeed', 1);
    const spiralMagentaIntensity = getLayerControlNumber(activeMix, 'spiralEyes', 'magentaIntensity', 1);
    const spiralGreenIntensity = getLayerControlNumber(activeMix, 'spiralEyes', 'greenIntensity', 1);

    const grinIntensity = grinLayer.enabled ? grinLayer.intensity : 0;
    const grinBrightness = getLayerControlNumber(activeMix, 'grin', 'brightness', 1);
    const grinBassPulse = getLayerControlNumber(activeMix, 'grin', 'bassPulse', 1);
    const grinReactiveBoost = grinLayer.audioReactive ? 1 + audio.bass * grinBassPulse * 0.64 + beatPulse * grinBassPulse * 0.48 : 1 + grinBassPulse * 0.12;

    const sidePanelIntensity = sidePanelsLayer.enabled ? sidePanelsLayer.intensity : 0;
    const sidePanelOrangeIntensity = getLayerControlNumber(activeMix, 'sidePanels', 'orangeIntensity', 1);
    const sidePanelBlueIntensity = getLayerControlNumber(activeMix, 'sidePanels', 'blueIntensity', 0.84);

    const toyBlocksIntensity = toyBlocksLayer.enabled ? toyBlocksLayer.intensity : 0;
    const toyBlockCount = Math.max(0, Math.min(blocks.length, Math.round(getLayerControlNumber(activeMix, 'toyBlocks', 'count', blocks.length))));
    const toyBlockDrift = getLayerControlNumber(activeMix, 'toyBlocks', 'drift', 1);

    const beat = Math.max(audio.kick, audio.bass * 0.85, pulseEnergy * 0.8, beatPulse * 0.6);
    const spiralReactiveBoost = spiralEyesLayer.audioReactive ? 0.52 + audio.high * 0.74 + beat * 0.42 : 1;
    const toyBlockReactiveBoost = toyBlocksLayer.audioReactive ? 0.62 + beat * 0.54 + audio.high * 0.3 : 1;
    mascot.update(deltaSeconds, timeSeconds);

    ambientLight.intensity = (0.2 + phase.energy * 0.16 + audio.rms * 0.14 - darkEnergy * 0.08)
      * Math.max(0.08, backgroundIntensity * backgroundAmbient);
    cyanLight.intensity = 1 + beat * 1.2 + technoEnergy * 0.42;
    magentaLight.intensity = 0.56 + pulseEnergy * 0.48 + fireEnergy * 0.2;
    greenLight.intensity = 0.52 + acidEnergy * 0.64 + audio.high * 0.3;
    orangeLeft.intensity = 0.42 + fireEnergy * 0.9 + phase.bloomBoost * 0.4;
    orangeRight.intensity = 0.38 + fireEnergy * 0.72 + pulseEnergy * 0.22 + phase.bloomBoost * 0.22;

    floorMaterial.emissiveColor = Color3.Lerp(
      floorMaterial.emissiveColor,
      new Color3(
        0.02 + fireEnergy * 0.05,
        0.16 + acidEnergy * 0.08,
        0.42 + technoEnergy * 0.14 + beat * 0.16,
      ).scale(Math.max(0, gridIntensity * gridReactiveBoost)),
      0.12,
    );
    sidePanelOrangeMaterial.emissiveColor = Color3.Lerp(
      sidePanelOrangeMaterial.emissiveColor,
      new Color3(0.58 + fireEnergy * 0.45, 0.18 + pulseEnergy * 0.14, 0.04)
        .scale(Math.max(0, sidePanelIntensity * sidePanelOrangeIntensity)),
      0.12,
    );
    sidePanelRightMaterial.emissiveColor = Color3.Lerp(
      sidePanelRightMaterial.emissiveColor,
      new Color3(0.08 + pulseEnergy * 0.16, 0.24 + technoEnergy * 0.18, 0.68 + beat * 0.26)
        .scale(Math.max(0, sidePanelIntensity * sidePanelBlueIntensity)),
      0.12,
    );
    backWallMaterial.emissiveColor = Color3.Lerp(
      backWallMaterial.emissiveColor,
      new Color3(0.18 + fireEnergy * 0.06, 0.48 + acidEnergy * 0.08, 0.82 + technoEnergy * 0.1)
        .scale(Math.max(0, backgroundIntensity)),
      0.08,
    );

    const gridShift = ((timeSeconds * 0.82 * Math.max(0, gridMovementSpeed)) % 0.84) - 0.42;
    gridX.position.z = gridShift;
    gridZ.position.x = Math.sin(timeSeconds * 0.46 * Math.max(0, gridMovementSpeed)) * 0.14;

    backWall.position.x = baseBackWallPosition.x + Math.sin(timeSeconds * 0.45) * 0.08 + glitchEnergy * 0.12;
    backWall.position.y = baseBackWallPosition.y + Math.cos(timeSeconds * 0.38) * 0.04;
    backWallTexture.uOffset = Math.sin(timeSeconds * 0.25) * 0.01 + glitchEnergy * 0.016;
    backWallTexture.vOffset = Math.cos(timeSeconds * 0.2) * 0.01;
    backWallMaterial.alpha = backgroundOpacity > 0.001
      ? baseBackWallAlpha * backgroundOpacity * (0.74 + activeMix.postFx.vignette * 0.26)
      : 0;
    roomMaterial.alpha = backgroundOpacity > 0.001
      ? baseRoomAlpha * backgroundOpacity
      : 0;

    plaques.forEach((plaque, index) => {
      plaque.mesh.position.x = plaque.basePosition.x + Math.cos(timeSeconds * 0.58 + plaque.drift) * (index === 2 ? 0.024 : 0.05);
      plaque.mesh.position.y = plaque.basePosition.y + Math.sin(timeSeconds * 0.72 + plaque.drift) * 0.05 + beatPulse * 0.02;
      plaque.material.emissiveColor = Color3.Lerp(
        plaque.material.emissiveColor,
        plaqueGlowColors[index % plaqueGlowColors.length].scale(0.5 + beat * 0.24 + glitchEnergy * 0.08),
        0.12,
      );
    });

    const cameraZoom = Math.max(0.4, activeMix.camera.zoom);
    const cameraOrbitSpeed = Math.max(0, activeMix.camera.orbitSpeed);
    const cameraShake = Math.max(0, activeMix.camera.shake);
    let cameraAlpha = baseCameraAlpha;
    let cameraBeta = baseCameraBeta;
    let cameraRadius = baseCameraRadius / cameraZoom;
    const cameraTarget = baseCameraTarget.clone();

    switch (activeMix.camera.mode) {
      case 'slowPush': {
        const pushTime = timeSeconds * (0.14 + cameraOrbitSpeed * 0.08);
        cameraRadius -= Math.sin(pushTime) * 0.28;
        cameraTarget.z += Math.cos(pushTime * 0.82) * 0.08;
        cameraTarget.y += Math.sin(pushTime * 0.54) * 0.05;
        break;
      }
      case 'slowOrbit': {
        const orbitTime = timeSeconds * (0.08 + cameraOrbitSpeed * 0.18);
        cameraAlpha += orbitTime;
        cameraBeta += Math.sin(orbitTime * 1.4) * 0.06;
        cameraTarget.y += Math.sin(orbitTime * 0.72) * 0.08;
        break;
      }
      case 'handheldFake': {
        const handheldTime = timeSeconds * (0.42 + cameraOrbitSpeed * 0.4);
        cameraAlpha += Math.sin(handheldTime * 1.32) * 0.08 + Math.sin(handheldTime * 0.42) * 0.04;
        cameraBeta += Math.cos(handheldTime * 1.08) * 0.06 + Math.sin(handheldTime * 1.9) * 0.02;
        cameraRadius += Math.sin(handheldTime * 0.76) * 0.18;
        cameraTarget.x += Math.sin(handheldTime * 1.16) * 0.08;
        cameraTarget.y += Math.cos(handheldTime * 0.94) * 0.06;
        break;
      }
      case 'locked':
      default:
        break;
    }

    const shakeEnvelope = cameraShake * (0.006 + beat * 0.018 + glitchEnergy * 0.01);
    const shakeX = Math.sin(timeSeconds * (14 + cameraOrbitSpeed * 3.2)) * shakeEnvelope;
    const shakeY = Math.cos(timeSeconds * (11 + cameraOrbitSpeed * 2.4)) * shakeEnvelope * 0.65;
    camera.alpha = cameraAlpha + shakeX;
    camera.beta = Math.min(
      camera.upperBetaLimit ?? Number.POSITIVE_INFINITY,
      Math.max(camera.lowerBetaLimit ?? 0.1, cameraBeta + shakeY),
    );
    camera.radius = Math.min(
      camera.upperRadiusLimit ?? Number.POSITIVE_INFINITY,
      Math.max(camera.lowerRadiusLimit ?? 0.1, cameraRadius),
    );
    camera.setTarget(cameraTarget.add(new Vector3(shakeX * 0.25, shakeY, 0)));

    const forward = camera.getTarget().subtract(camera.position).normalize();
    const right = Vector3.Cross(forward, Vector3.Up()).normalize();
    const anchor = camera.position.add(forward.scale(crtDistance));
    const baseOverlayPosition = anchor.add(new Vector3(0, Math.sin(timeSeconds * 0.65) * 0.004, 0));
    const chromaShift = (0.004 + glitchEnergy * 0.05 + audio.high * 0.01 + beatPulse * 0.004)
      * Math.max(0, activeMix.postFx.rgbSplit);
    const jitter = 0.0008 + glitchEnergy * 0.018 + beatPulse * 0.003;
    const tear = Math.sin(timeSeconds * (28 + glitchEnergy * 20)) * glitchEnergy * 0.028;
    const roll = Math.max(0, Math.sin(timeSeconds * 7.4 + glitchEnergy * 5.2)) * (0.004 + glitchEnergy * 0.01);

    crtBaseOverlay.position.copyFrom(baseOverlayPosition);
    crtRedOverlay.position.copyFrom(baseOverlayPosition.add(right.scale(chromaShift)));
    crtGreenOverlay.position.copyFrom(baseOverlayPosition.add(right.scale(chromaShift * 0.2)));
    crtBlueOverlay.position.copyFrom(baseOverlayPosition.subtract(right.scale(chromaShift)));
    crtNoiseOverlay.position.copyFrom(baseOverlayPosition);
    crtOverlays.forEach((overlay, index) => {
      const overlayTear = tear * (index % 2 === 0 ? 1 : -0.75);
      overlay.position.x += Math.sin(timeSeconds * (18 + index * 3.1)) * jitter + overlayTear;
      overlay.position.y += Math.cos(timeSeconds * (11 + index * 2.2)) * jitter * 0.6 + roll * (index === 4 ? 1.8 : 0.6);
      overlay.scaling.set(
        1 + Math.abs(overlayTear) * 0.18 + (index === 4 ? glitchEnergy * 0.024 : 0),
        1 + Math.abs(roll) * 0.3,
        1,
      );
      overlay.lookAt(camera.position);
    });

    const scanlineScroll = (timeSeconds * (0.12 + audio.high * 0.18 + glitchEnergy * 0.08)) % 1;
    crtBaseTexture.vOffset = scanlineScroll;
    crtRedTexture.vOffset = (scanlineScroll + 0.01 + glitchEnergy * 0.024) % 1;
    crtGreenTexture.vOffset = (scanlineScroll + 0.005 + beatPulse * 0.012) % 1;
    crtBlueTexture.vOffset = (scanlineScroll + 0.016 + glitchEnergy * 0.016) % 1;
    crtNoiseTexture.vOffset = (scanlineScroll * 2.8 + glitchEnergy * 0.09) % 1;

    const uvShift = chromaShift * 0.28;
    crtRedTexture.uOffset = uvShift;
    crtGreenTexture.uOffset = uvShift * 0.16;
    crtBlueTexture.uOffset = -uvShift;
    crtNoiseTexture.uOffset = Math.sin(timeSeconds * 3.4) * 0.06 + tear * 0.8;

    const scanlineMix = activeMix.postFx.scanlines;
    const rgbSplitMix = activeMix.postFx.rgbSplit;
    const noiseMix = activeMix.postFx.noise;
    const vignetteMix = activeMix.postFx.vignette;

    crtBaseMaterial.alpha = baseCrtBaseAlpha * (0.22 + scanlineMix * 0.82 + vignetteMix * 0.36 + beat * 0.12 + glitchEnergy * 0.2);
    crtRedMaterial.alpha = baseCrtRedAlpha * (0.08 + rgbSplitMix * 1.24 + glitchEnergy * 0.42 + audio.high * 0.22);
    crtGreenMaterial.alpha = baseCrtGreenAlpha * (0.08 + rgbSplitMix * 0.94 + glitchEnergy * 0.32 + audio.high * 0.16);
    crtBlueMaterial.alpha = baseCrtBlueAlpha * (0.08 + rgbSplitMix * 1.24 + glitchEnergy * 0.42 + audio.high * 0.22);
    crtNoiseMaterial.alpha = baseCrtNoiseAlpha * (0.06 + noiseMix * 2.2 + glitchEnergy * 1.2 + audio.high * 0.42 + beatPulse * 0.32);

    gridX.alpha = gridOpacity * (0.38 + (0.34 + beat * 0.2 + beatPulse * 0.22) * gridReactiveBoost);
    gridZ.alpha = gridOpacity * (0.28 + (0.28 + acidEnergy * 0.18 + beatPulse * 0.18) * gridReactiveBoost);

    mascot.root.position.y += Math.sin(timeSeconds * 1.34) * 0.05 * mascotHeadHoverAmount * mascotHeadIntensity;
    mascot.root.scaling.scaleInPlace(mascotHeadScale);
    headMaterial.metallic = Math.min(1, 0.05 + mascotHeadGloss * 0.38);
    headMaterial.roughness = Math.min(1, Math.max(0.02, 0.92 - mascotHeadGloss * 0.58));
    headMaterial.albedoColor = Color3.Lerp(
      headMaterial.albedoColor,
      headBaseAlbedo.scale(0.84 + mascotHeadIntensity * 0.22),
      0.08,
    );
    if (auraMaterial) {
      auraMaterial.alpha = mascotHeadLayer.enabled
        ? Math.min(0.4, auraBaseAlpha * mascotHeadLayer.opacity + mascotHeadIntensity * 0.1)
        : 0;
    }

    mascot.leftEye.rotation.z += deltaSeconds * 0.08 * spiralRotationSpeed * spiralReactiveBoost * spiralEyesIntensity;
    mascot.rightEye.rotation.z -= deltaSeconds * 0.14 * spiralRotationSpeed * spiralReactiveBoost * spiralEyesIntensity;
    leftEyeMaterial.emissiveColor = Color3.Lerp(
      leftEyeMaterial.emissiveColor,
      new Color3(0.9 + technoEnergy * 0.05, 0.84 + acidEnergy * 0.06, 0.72 + fireEnergy * 0.04)
        .scale(Math.max(0, spiralEyesIntensity * spiralMagentaIntensity)),
      0.14,
    );
    rightEyeMaterial.emissiveColor = Color3.Lerp(
      rightEyeMaterial.emissiveColor,
      new Color3(0.28 + technoEnergy * 0.08, 0.44 + acidEnergy * 0.04, 0.92 + fireEnergy * 0.05)
        .scale(Math.max(0, spiralEyesIntensity * spiralGreenIntensity)),
      0.14,
    );

    if (grinLayer.enabled) {
      mascot.grin.scaling.x *= 1 + audio.bass * grinBassPulse * 0.05;
      mascot.grin.scaling.y *= 1 + beatPulse * grinBassPulse * 0.03;
    }
    grinMaterial.emissiveColor = Color3.Lerp(
      grinMaterial.emissiveColor,
      new Color3(0.54 + fireEnergy * 0.08, 0.84 + technoEnergy * 0.06, 0.94 - darkEnergy * 0.12)
        .scale(Math.max(0, grinIntensity * grinBrightness * grinReactiveBoost)),
      0.12,
    );

    blocks.forEach((block, index) => {
      const visible = toyBlocksLayer.enabled && index < toyBlockCount;
      if (!visible) {
        return;
      }

      const material = block.material as StandardMaterial;
      material.emissiveColor = Color3.Lerp(
        material.emissiveColor,
        Color3.FromHexString(blockPalette[index % blockPalette.length])
          .scale(0.18 + toyBlocksIntensity * 0.3 * toyBlockReactiveBoost + technoEnergy * 0.12),
        0.12,
      );

      const basePosition = blockBasePositions[index];
      const bpmBounce = beatSine * 0.06 * (1 - (index % 2) * 0.4);
      block.position.x = basePosition.x + Math.cos(timeSeconds * 0.52 * toyBlockDrift + blockOffsets[index]) * 0.08 * toyBlockDrift;
      block.position.y = basePosition.y + Math.sin(timeSeconds * (1.1 + toyBlockDrift * 0.35) + blockOffsets[index]) * 0.18 + technoEnergy * 0.05 + bpmBounce;
      block.position.z = basePosition.z + Math.sin(timeSeconds * 0.66 * toyBlockDrift + blockOffsets[index]) * 0.06 * toyBlockDrift;
      block.rotation.x += deltaSeconds * (0.14 + (index % 3) * 0.04 + toyBlockDrift * 0.08);
      block.rotation.y += deltaSeconds * (0.2 + (index % 2) * 0.05 + acidEnergy * 0.12 + toyBlockDrift * 0.1 + (bpm > 0 ? 0.08 : 0));
    });

    glow.intensity = (0.22 + beat * 0.32 + phase.bloomBoost * 0.2 + technoEnergy * 0.12 + beatPulse * 0.28)
      * (0.32 + activeMix.postFx.bloom);
  };

  applyMixState(activeMix);

  const dispose = () => {
    mascot.dispose();
    glow.dispose();
    cyanLight.dispose();
    magentaLight.dispose();
    greenLight.dispose();
    orangeLeft.dispose();
    orangeRight.dispose();
    ambientLight.dispose();
    camera.dispose();
    backWallTexture.dispose();
    crtOverlays.forEach((overlay) => overlay.dispose(false, true));
    disposePlaques();
    blocks.forEach((block) => block.dispose(false, true));
    disposeGridFloor();
    disposePanels();
    ceiling.dispose(false, true);
    backWall.dispose(false, true);
  };

  return {
    camera,
    triggerPulse,
    triggerFire,
    triggerAcid,
    applyVisualImpulse,
    applyMixState,
    setStandby,
    update,
    dispose,
  };
}