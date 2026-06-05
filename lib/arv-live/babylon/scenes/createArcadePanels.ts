import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from '@babylonjs/core';

export interface ArcadePanels {
  leftPanel: Mesh;
  rightPanel: Mesh;
  leftMaterial: StandardMaterial;
  rightMaterial: StandardMaterial;
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

export const createArcadePanels = (scene: Scene): ArcadePanels => {
  const leftMaterial = createMaterial(
    scene,
    'arv-laughing-signal-side-orange-material',
    '#261108',
    '#ff7a00',
    0.94,
  );
  const rightMaterial = createMaterial(
    scene,
    'arv-laughing-signal-side-orange-right-material',
    '#2c1408',
    '#ff9a2a',
    0.94,
  );

  const leftPanel = MeshBuilder.CreateBox(
    'arv-laughing-signal-left-panel',
    { width: 0.24, height: 2.2, depth: 2.8 },
    scene,
  );
  leftPanel.position.set(-3.8, -0.12, 0.8);
  leftPanel.rotation.y = 0.08;
  leftPanel.material = leftMaterial;

  const rightPanel = MeshBuilder.CreateBox(
    'arv-laughing-signal-right-panel',
    { width: 0.24, height: 2.2, depth: 2.8 },
    scene,
  );
  rightPanel.position.set(3.8, -0.12, 0.8);
  rightPanel.rotation.y = -0.08;
  rightPanel.material = rightMaterial;

  return {
    leftPanel,
    rightPanel,
    leftMaterial,
    rightMaterial,
    dispose: () => {
      leftPanel.dispose(false, true);
      rightPanel.dispose(false, true);
    },
  };
};
