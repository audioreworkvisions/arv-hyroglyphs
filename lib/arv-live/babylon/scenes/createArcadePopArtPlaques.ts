import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';

export interface ArcadePopArtPlaque {
  mesh: Mesh;
  material: StandardMaterial;
  texture: DynamicTexture;
  basePosition: Vector3;
  drift: number;
}

export interface ArcadePopArtPlaques {
  plaques: ArcadePopArtPlaque[];
  dispose: () => void;
}

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const drawHalftoneField = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  cols: number,
  rows: number,
  gapX: number,
  gapY: number,
  primaryHex: string,
  accentHex: string,
  alpha: number,
) => {
  ctx.save();
  ctx.globalAlpha = alpha;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = startX + col * gapX + (row % 2) * (gapX * 0.32);
      const y = startY + row * gapY;
      const radius = 5 + ((row + col) % 3) * 2;
      ctx.fillStyle = (row + col) % 2 === 0 ? primaryHex : accentHex;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
};

const drawSpark = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerRadius: number,
  innerRadius: number,
  points: number,
  fillStyle: string,
  rotation = 0,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = fillStyle;
  ctx.beginPath();

  for (let index = 0; index < points * 2; index += 1) {
    const angle = (index / (points * 2)) * Math.PI * 2;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;

    if (index === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const createPlaqueTexture = (
  scene: Scene,
  name: string,
  primaryHex: string,
  accentHex: string,
  glowHex: string,
  paperHex: string,
  style: 'burst' | 'dots' | 'zigzag',
): DynamicTexture => {
  const width = 768;
  const height = 512;
  const texture = new DynamicTexture(name, { width, height }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;

  texture.hasAlpha = true;
  ctx.clearRect(0, 0, width, height);

  roundedRect(ctx, 10, 10, width - 20, height - 20, 56);
  ctx.fillStyle = 'rgba(248, 238, 218, 0.98)';
  ctx.fill();

  roundedRect(ctx, 28, 28, width - 56, height - 56, 50);
  ctx.fillStyle = 'rgba(6, 8, 14, 0.94)';
  ctx.fill();

  const fillGradient = ctx.createLinearGradient(0, 0, width, height);
  fillGradient.addColorStop(0, paperHex);
  fillGradient.addColorStop(0.62, 'rgba(11, 15, 23, 0.94)');
  fillGradient.addColorStop(1, 'rgba(7, 9, 14, 0.98)');
  roundedRect(ctx, 44, 44, width - 88, height - 88, 42);
  ctx.fillStyle = fillGradient;
  ctx.fill();

  ctx.save();
  roundedRect(ctx, 44, 44, width - 88, height - 88, 42);
  ctx.clip();
  for (let index = -2; index < 12; index += 1) {
    const stripeX = index * 92;
    ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(stripeX, 0, 40, height);
  }
  drawHalftoneField(ctx, 106, 304, 9, 5, 56, 34, primaryHex, accentHex, 0.3);
  ctx.restore();

  ctx.lineWidth = 18;
  ctx.strokeStyle = 'rgba(4, 7, 12, 0.94)';
  roundedRect(ctx, 28, 28, width - 56, height - 56, 50);
  ctx.stroke();

  ctx.lineWidth = 16;
  ctx.strokeStyle = primaryHex;
  ctx.shadowColor = glowHex;
  ctx.shadowBlur = 26;
  roundedRect(ctx, 44, 44, width - 88, height - 88, 42);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255, 245, 226, 0.2)';
  roundedRect(ctx, 62, 62, width - 124, height - 124, 34);
  ctx.stroke();

  if (style === 'burst') {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    for (let index = 0; index < 20; index += 1) {
      ctx.rotate(Math.PI / 10);
      ctx.fillStyle = index % 2 === 0 ? primaryHex : accentHex;
      ctx.fillRect(18, -16, width * 0.24, 32);
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 245, 228, 0.96)';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 92, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(7, 12, 18, 0.92)';
    ctx.stroke();

    drawSpark(ctx, width / 2, height / 2, 68, 26, 9, glowHex, Math.PI / 10);

    ctx.fillStyle = '#091018';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  if (style === 'dots') {
    drawHalftoneField(ctx, 118, 126, 10, 7, 54, 40, primaryHex, accentHex, 0.92);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 24;
    ctx.strokeStyle = glowHex;
    ctx.shadowColor = glowHex;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(122, 390);
    ctx.lineTo(266, 198);
    ctx.lineTo(364, 288);
    ctx.lineTo(498, 120);
    ctx.lineTo(614, 222);
    ctx.stroke();
    ctx.shadowBlur = 0;

    drawSpark(ctx, 586, 140, 34, 14, 8, 'rgba(255, 245, 230, 0.9)', 0.18);
    drawSpark(ctx, 170, 114, 24, 10, 8, accentHex, 0.1);
  }

  if (style === 'zigzag') {
    for (let index = 0; index < 8; index += 1) {
      ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(102 + index * 68, 82, 34, height - 164);
    }

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 24;
    ctx.strokeStyle = primaryHex;
    ctx.shadowColor = primaryHex;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(86, 386);
    ctx.lineTo(214, 168);
    ctx.lineTo(328, 328);
    ctx.lineTo(444, 122);
    ctx.lineTo(576, 274);
    ctx.lineTo(674, 124);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.lineWidth = 12;
    ctx.strokeStyle = accentHex;
    ctx.beginPath();
    ctx.moveTo(88, 244);
    ctx.lineTo(674, 244);
    ctx.stroke();

    drawSpark(ctx, 132, 132, 28, 12, 8, '#ffd8ff', 0.1);
    drawSpark(ctx, 636, 364, 28, 12, 8, '#fff2d8', -0.14);
  }

  texture.update(false);
  return texture;
};

const createPlaqueMaterial = (
  scene: Scene,
  name: string,
  texture: DynamicTexture,
  emissiveHex: string,
): StandardMaterial => {
  const material = new StandardMaterial(name, scene);
  material.backFaceCulling = false;
  material.disableLighting = true;
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.opacityTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.diffuseColor = Color3.FromHexString('#0c1018');
  material.emissiveColor = Color3.FromHexString(emissiveHex).scale(0.9);
  return material;
};

export const createArcadePopArtPlaques = (scene: Scene): ArcadePopArtPlaques => {
  const specs = [
    {
      name: 'burst',
      position: new Vector3(-2.62, 1.46, 4.44),
      size: [1.42, 0.96] as const,
      rotation: [0.02, 0.24, -0.06] as const,
      primaryHex: '#ff7a00',
      accentHex: '#ffd15a',
      glowHex: '#00f4ff',
      paperHex: '#2b1308',
      style: 'burst' as const,
    },
    {
      name: 'dots',
      position: new Vector3(2.56, 1.18, 4.42),
      size: [1.34, 0.92] as const,
      rotation: [-0.02, -0.26, 0.05] as const,
      primaryHex: '#00f4ff',
      accentHex: '#3275ff',
      glowHex: '#39ff14',
      paperHex: '#081c24',
      style: 'dots' as const,
    },
    {
      name: 'zigzag',
      position: new Vector3(0, 2.02, 4.2),
      size: [1.16, 0.72] as const,
      rotation: [0, 0, 0] as const,
      primaryHex: '#ff19f6',
      accentHex: '#00f4ff',
      glowHex: '#ff7a00',
      paperHex: '#180819',
      style: 'zigzag' as const,
    },
  ];

  const plaques = specs.map((spec, index) => {
    const texture = createPlaqueTexture(
      scene,
      `arv-laughing-signal-plaque-${spec.name}`,
      spec.primaryHex,
      spec.accentHex,
      spec.glowHex,
      spec.paperHex,
      spec.style,
    );
    const material = createPlaqueMaterial(
      scene,
      `arv-laughing-signal-plaque-material-${spec.name}`,
      texture,
      spec.glowHex,
    );

    const mesh = MeshBuilder.CreatePlane(
      `arv-laughing-signal-plaque-${spec.name}`,
      { width: spec.size[0], height: spec.size[1], sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    mesh.position.copyFrom(spec.position);
    mesh.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2]);
    mesh.material = material;

    return {
      mesh,
      material,
      texture,
      basePosition: spec.position.clone(),
      drift: 0.35 + index * 0.62,
    };
  });

  return {
    plaques,
    dispose: () => {
      plaques.forEach((plaque) => {
        plaque.mesh.dispose(false, true);
      });
    },
  };
};
