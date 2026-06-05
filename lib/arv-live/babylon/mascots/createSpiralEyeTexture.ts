import { DynamicTexture, Scene } from '@babylonjs/core';

type EyeTextureVariant = 'spiral' | 'rings' | 'doll';

interface EyeTextureOptions {
  variant?: EyeTextureVariant;
  fillColor?: string;
  lineWidth?: number;
  ringCount?: number;
  pupilOffsetX?: number;
  pupilOffsetY?: number;
}

export function createSpiralEyeTexture(
  scene: Scene,
  name: string,
  color: string,
  bg = '#040507',
  turns = 8,
  options: EyeTextureOptions = {},
): DynamicTexture {
  const size = 512;
  const texture = new DynamicTexture(name, { width: size, height: size }, scene, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  const center = size / 2;
  const variant = options.variant || 'spiral';
  const fillColor = options.fillColor || color;
  const lineWidth = options.lineWidth || (variant === 'rings' ? 7 : 11);
  const ringCount = options.ringCount || 9;
  const pupilOffsetX = options.pupilOffsetX ?? -0.16;
  const pupilOffsetY = options.pupilOffsetY ?? 0.04;

  texture.hasAlpha = true;
  ctx.clearRect(0, 0, size, size);

  const glow = ctx.createRadialGradient(center, center, size * 0.06, center, center, size * 0.48);
  glow.addColorStop(0, 'rgba(255,255,255,0.08)');
  glow.addColorStop(0.3, 'rgba(8,10,12,0.96)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(center, center, size * 0.47, 0, Math.PI * 2);
  ctx.fill();

  if (variant === 'doll') {
    const innerGlow = ctx.createRadialGradient(
      center - size * 0.1,
      center - size * 0.08,
      size * 0.04,
      center,
      center,
      size * 0.34,
    );
    innerGlow.addColorStop(0, '#ffd6ff');
    innerGlow.addColorStop(0.18, fillColor);
    innerGlow.addColorStop(1, '#c600bf');

    ctx.fillStyle = innerGlow;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(center, center, size * 0.31, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#ff9bff';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(center, center, size * 0.31, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#060607';
    ctx.beginPath();
    ctx.arc(
      center + size * 0.11 * pupilOffsetX,
      center + size * 0.11 * pupilOffsetY,
      size * 0.045,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  } else if (variant === 'rings') {
    // Solid dark background circle
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(center, center, size * 0.48, 0, Math.PI * 2);
    ctx.fill();

    // Bullseye: filled alternating color / dark rings, painted outside → in
    const maxR = size * 0.46;
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
    for (let index = ringCount; index >= 0; index -= 1) {
      const r = (maxR * index) / ringCount;
      ctx.beginPath();
      ctx.arc(center, center, r, 0, Math.PI * 2);
      ctx.fillStyle = index % 2 === 0 ? '#000408' : color;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  } else {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    const maxTheta = Math.PI * 2 * turns;
    for (let theta = 0; theta <= maxTheta; theta += 0.035) {
      const radius = 10 + theta * 3.2;
      const x = center + Math.cos(theta) * radius;
      const y = center + Math.sin(theta) * radius;

      if (theta === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(center, center, size * 0.37, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(center, center, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  texture.update(false);
  return texture;
}