import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  StandardMaterial,
  TransformNode,
  type BaseTexture,
} from '@babylonjs/core';
import { createCyanGrinTexture } from './createCyanGrinTexture';
import { createSpiralEyeTexture } from './createSpiralEyeTexture';
import type { LaughingSignalMascot, MascotImpulse, MascotImpulseReaction } from './mascotTypes';

const clamp = (value: number, min = 0, max = 1.5): number => {
  return Math.min(max, Math.max(min, value));
};

const createNeonMaterial = (
  scene: Scene,
  name: string,
  color: Color3,
  texture?: BaseTexture,
): StandardMaterial => {
  const material = new StandardMaterial(name, scene);
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.diffuseColor = color.scale(0.14);
  material.emissiveColor = color;
  material.specularColor = Color3.Black();
  material.specularPower = 16;

  if (texture) {
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.opacityTexture = texture;
    material.useAlphaFromDiffuseTexture = true;
  }

  return material;
};

export function createLaughingSignalMascot(scene: Scene): LaughingSignalMascot {
  const root = new TransformNode('arv-laughing-signal-mascot-root', scene);

  let impulse = 0;
  let pulseLevel = 0;
  let fireLevel = 0;
  let acidLevel = 0;
  let darkLevel = 0;
  let technoLevel = 0;

  const head = MeshBuilder.CreateSphere(
    'arv-laughing-signal-head',
    { diameter: 2.95, segments: 64 },
    scene,
  );
  head.parent = root;

  const headMaterial = new PBRMaterial('arv-laughing-signal-head-material', scene);
  headMaterial.metallic = 0.1;
  headMaterial.roughness = 0.18;
  headMaterial.albedoColor = new Color3(0.008, 0.01, 0.015);
  head.material = headMaterial;

  const leftEyeTexture = createSpiralEyeTexture(
    scene,
    'arv-cream-aperture-eye',
    '#efe4cf',
    '#0d0209',
    7,
    { variant: 'rings', ringCount: 7 },
  );
  const rightEyeTexture = createSpiralEyeTexture(
    scene,
    'arv-cobalt-aperture-eye',
    '#86a3ff',
    '#060813',
    7,
    { variant: 'rings', ringCount: 7 },
  );

  const leftEye = MeshBuilder.CreateDisc(
    'arv-laughing-signal-eye-left',
    { radius: 0.50, tessellation: 96, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  leftEye.parent = head;
  leftEye.position.set(-0.57, 0.34, -1.54);
  leftEye.rotation.y = Math.PI;
  const leftEyeMaterial = createNeonMaterial(
    scene,
    'arv-laughing-signal-eye-left-material',
    new Color3(0.94, 0.9, 0.82),
    leftEyeTexture,
  );
  leftEye.material = leftEyeMaterial;

  const rightEye = MeshBuilder.CreateDisc(
    'arv-laughing-signal-eye-right',
    { radius: 0.50, tessellation: 96, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  rightEye.parent = head;
  rightEye.position.set(0.56, 0.34, -1.54);
  rightEye.rotation.y = Math.PI;
  const rightEyeMaterial = createNeonMaterial(
    scene,
    'arv-laughing-signal-eye-right-material',
    new Color3(0.48, 0.58, 0.92),
    rightEyeTexture,
  );
  rightEye.material = rightEyeMaterial;

  const grinTexture = createCyanGrinTexture(scene);
  const grin = MeshBuilder.CreatePlane(
    'arv-laughing-signal-grin',
    { width: 2.46, height: 1.08, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  grin.parent = head;
  grin.position.set(0, -0.52, -1.6);
  grin.rotation.x = -0.02;
  grin.rotation.y = Math.PI;
  const grinMaterial = createNeonMaterial(
    scene,
    'arv-laughing-signal-grin-material',
    new Color3(0.82, 0.96, 1),
    grinTexture,
  );
  grin.material = grinMaterial;

  const aura = MeshBuilder.CreateSphere(
    'arv-laughing-signal-aura',
    { diameter: 3.12, segments: 48 },
    scene,
  );
  aura.parent = head;
  const auraMaterial = new StandardMaterial('arv-laughing-signal-aura-material', scene);
  auraMaterial.backFaceCulling = false;
  auraMaterial.diffuseColor = new Color3(0.01, 0.08, 0.12);
  auraMaterial.emissiveColor = new Color3(0.03, 0.12, 0.18);
  auraMaterial.alpha = 0.08;
  aura.material = auraMaterial;

  const bumpReaction = (reaction: MascotImpulseReaction | undefined, intensity: number) => {
    switch (reaction) {
      case 'fire':
        fireLevel = clamp(fireLevel + intensity, 0, 1.6);
        break;
      case 'acid':
        acidLevel = clamp(acidLevel + intensity, 0, 1.6);
        break;
      case 'dark':
        darkLevel = clamp(darkLevel + intensity, 0, 1.4);
        break;
      case 'peace-love-techno':
        technoLevel = clamp(technoLevel + intensity, 0, 1.6);
        break;
      default:
        pulseLevel = clamp(pulseLevel + intensity, 0, 1.6);
        break;
    }
  };

  const applyImpulse = (next: MascotImpulse) => {
    const amount = clamp(next.intensity, 0, 1.2);
    impulse = clamp(impulse + amount, 0, 1.5);
    pulseLevel = clamp(pulseLevel + amount * 0.8, 0, 1.6);
    bumpReaction(next.reaction, amount);
  };

  const update = (dt: number, time: number) => {
    impulse *= Math.pow(0.05, dt);
    pulseLevel *= Math.pow(0.08, dt);
    fireLevel *= Math.pow(0.12, dt);
    acidLevel *= Math.pow(0.16, dt);
    darkLevel *= Math.pow(0.18, dt);
    technoLevel *= Math.pow(0.14, dt);

    const hover = Math.sin(time * 0.82) * 0.03;
    const breathe = 1 + Math.sin(time * 1.2) * 0.01 + impulse * 0.06 + technoLevel * 0.015;

    root.position.y = hover + fireLevel * 0.02;
    root.position.z = -fireLevel * 0.04 + darkLevel * 0.02;
    root.scaling.setAll(breathe - darkLevel * 0.02);

    head.rotation.x = Math.sin(time * 0.9) * 0.012 + fireLevel * 0.02 - darkLevel * 0.015;
    head.rotation.z = Math.sin(time * 0.56) * 0.014 + pulseLevel * 0.018;

    leftEye.rotation.z += dt * (0.08 + pulseLevel * 0.16 + technoLevel * 0.08);
    rightEye.rotation.z -= dt * (0.14 + acidLevel * 0.32 + pulseLevel * 0.1 + technoLevel * 0.12);

    grin.scaling.x = 1 + Math.sin(time * 1.6) * 0.012 + impulse * 0.05 + technoLevel * 0.02;
    grin.scaling.y = 1 + pulseLevel * 0.02 + fireLevel * 0.012 - darkLevel * 0.018;
    aura.scaling.setAll(1.01 + Math.sin(time * 0.9) * 0.016 + impulse * 0.08 + technoLevel * 0.04);

    headMaterial.emissiveColor = Color3.Lerp(
      headMaterial.emissiveColor,
      new Color3(
        0.01 + fireLevel * 0.08 + technoLevel * 0.02,
        0.015 + acidLevel * 0.03,
        0.026 + technoLevel * 0.06,
      ),
      0.08,
    );
    leftEyeMaterial.emissiveColor = Color3.Lerp(
      leftEyeMaterial.emissiveColor,
      new Color3(1, 0.08 + acidLevel * 0.18 + technoLevel * 0.08, 0.9 + fireLevel * 0.06),
      0.14,
    );
    rightEyeMaterial.emissiveColor = Color3.Lerp(
      rightEyeMaterial.emissiveColor,
      new Color3(0.18 + technoLevel * 0.08, 1, 0.12 + fireLevel * 0.08),
      0.14,
    );
    grinMaterial.emissiveColor = Color3.Lerp(
      grinMaterial.emissiveColor,
      new Color3(0.08 + fireLevel * 0.12, 0.9 + technoLevel * 0.08, 1 - darkLevel * 0.22),
      0.12,
    );
    auraMaterial.emissiveColor = Color3.Lerp(
      auraMaterial.emissiveColor,
      new Color3(
        0.04 + fireLevel * 0.36,
        0.16 + acidLevel * 0.16,
        0.2 + technoLevel * 0.42,
      ),
      0.12,
    );
    auraMaterial.alpha = clamp(0.1 + impulse * 0.05 + technoLevel * 0.04 - darkLevel * 0.05, 0.04, 0.22);
  };

  const dispose = () => {
    root.getChildMeshes().forEach((mesh) => mesh.dispose(false, true));
    root.dispose();
  };

  return {
    root,
    head,
    leftEye,
    rightEye,
    grin,
    applyImpulse,
    update,
    dispose,
  };
}