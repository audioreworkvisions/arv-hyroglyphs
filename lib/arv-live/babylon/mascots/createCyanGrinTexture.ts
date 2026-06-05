import { DynamicTexture, Scene } from '@babylonjs/core';

export function createCyanGrinTexture(scene: Scene): DynamicTexture {
  const width = 1280;
  const height = 560;
  const texture = new DynamicTexture('arv-cyan-grin-texture', { width, height }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;

  texture.hasAlpha = true;
  ctx.clearRect(0, 0, width, height);

  const lineY = height * 0.5;
  const slitLeft = 112;
  const slitRight = width - 112;
  const slitHeight = 132;
  const cornerRadius = 54;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = 'rgba(255, 82, 166, 0.16)';
  ctx.lineWidth = slitHeight + 18;
  ctx.beginPath();
  ctx.moveTo(slitLeft - 14, lineY - 6);
  ctx.lineTo(slitRight - 24, lineY - 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(84, 118, 255, 0.22)';
  ctx.lineWidth = slitHeight + 10;
  ctx.beginPath();
  ctx.moveTo(slitLeft + 18, lineY + 5);
  ctx.lineTo(slitRight + 18, lineY + 1);
  ctx.stroke();

  ctx.fillStyle = '#d8fbff';
  ctx.shadowColor = '#8cf7ff';
  ctx.shadowBlur = 42;
  ctx.beginPath();
  ctx.moveTo(slitLeft + cornerRadius, lineY - slitHeight * 0.5);
  ctx.lineTo(slitRight - cornerRadius, lineY - slitHeight * 0.5);
  ctx.quadraticCurveTo(slitRight, lineY - slitHeight * 0.5, slitRight, lineY - slitHeight * 0.5 + cornerRadius);
  ctx.lineTo(slitRight, lineY + slitHeight * 0.5 - cornerRadius);
  ctx.quadraticCurveTo(slitRight, lineY + slitHeight * 0.5, slitRight - cornerRadius, lineY + slitHeight * 0.5);
  ctx.lineTo(slitLeft + cornerRadius, lineY + slitHeight * 0.5);
  ctx.quadraticCurveTo(slitLeft, lineY + slitHeight * 0.5, slitLeft, lineY + slitHeight * 0.5 - cornerRadius);
  ctx.lineTo(slitLeft, lineY - slitHeight * 0.5 + cornerRadius);
  ctx.quadraticCurveTo(slitLeft, lineY - slitHeight * 0.5, slitLeft + cornerRadius, lineY - slitHeight * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(0, 7, 14, 0.96)';
  ctx.beginPath();
  ctx.moveTo(slitLeft + 56, lineY - 20);
  ctx.lineTo(slitRight - 56, lineY - 12);
  ctx.lineTo(slitRight - 64, lineY + 16);
  ctx.lineTo(slitLeft + 44, lineY + 24);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
  [0.26, 0.51, 0.74].forEach((offset, index) => {
    const x = slitLeft + (slitRight - slitLeft) * offset;
    const notchHeight = index === 1 ? 76 : 62;
    ctx.fillRect(x - 12, lineY - notchHeight * 0.5, 24, notchHeight);
  });

  ctx.strokeStyle = 'rgba(218, 248, 255, 0.4)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(slitLeft + 28, lineY - 40);
  ctx.lineTo(slitRight - 36, lineY - 28);
  ctx.stroke();

  texture.update(false);
  return texture;
}