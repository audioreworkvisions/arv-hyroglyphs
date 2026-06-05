import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import type { ARVQualityTier } from '../../presets';

type ArcadeLineMesh = ReturnType<typeof MeshBuilder.CreateLineSystem>;

export interface ArcadeGridFloor {
  floor: Mesh;
  gridX: ArcadeLineMesh;
  gridZ: ArcadeLineMesh;
  floorMaterial: StandardMaterial;
  dispose: () => void;
}

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

export const createArcadeGridFloor = (scene: Scene, tier: ARVQualityTier): ArcadeGridFloor => {
  const floorMaterial = createMaterial(
    scene,
    'arv-laughing-signal-floor-material',
    '#04070d',
    '#0a2d54',
    0.96,
  );

  const floor = MeshBuilder.CreateGround(
    'arv-laughing-signal-floor',
    { width: 11, height: 9.5, subdivisions: 1 },
    scene,
  );
  floor.position.set(0, -1.72, 2.1);
  floor.material = floorMaterial;

  const lineCount = tier === 'eco' ? 11 : 15;
  const xLines: Vector3[][] = [];
  const zLines: Vector3[][] = [];
  for (let index = -lineCount; index <= lineCount; index += 1) {
    const offset = index * 0.42;
    xLines.push([
      new Vector3(offset, -1.68, -1.2),
      new Vector3(offset, -1.68, 6.4),
    ]);
    zLines.push([
      new Vector3(-4.8, -1.68, offset + 2.6),
      new Vector3(4.8, -1.68, offset + 2.6),
    ]);
  }

  const gridX = MeshBuilder.CreateLineSystem('arv-laughing-signal-grid-x', { lines: xLines }, scene);
  gridX.color = Color3.FromHexString('#1cbdfb');
  const gridZ = MeshBuilder.CreateLineSystem('arv-laughing-signal-grid-z', { lines: zLines }, scene);
  gridZ.color = Color3.FromHexString('#70d9ff');

  return {
    floor,
    gridX,
    gridZ,
    floorMaterial,
    dispose: () => {
      gridX.dispose();
      gridZ.dispose();
      floor.dispose(false, true);
    },
  };
};
