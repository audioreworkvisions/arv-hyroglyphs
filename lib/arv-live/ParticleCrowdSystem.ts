import {
  Color3,
  Color4,
  DynamicTexture,
  GPUParticleSystem,
  ParticleSystem,
  PointLight,
  Scene,
  SphereParticleEmitter,
  Vector3,
} from '@babylonjs/core';
import type { AudioReactiveSnapshot } from './AudioReactiveUniforms';
import type { ARVLiveVisualPreset, ARVQualitySettings } from './presets';
import type { RitualPhaseState } from './RitualPhaseController';
import type { ARVVisualImpulse } from './types';

const createParticleTexture = (scene: Scene): DynamicTexture => {
  const texture = new DynamicTexture('arv-live-crowd-particle', { width: 96, height: 96 }, scene, false);
  const context = texture.getContext();
  const gradient = context.createRadialGradient(48, 48, 8, 48, 48, 48);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.clearRect(0, 0, 96, 96);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 96, 96);
  texture.update(false);
  return texture;
};

export class ParticleCrowdSystem {
  private readonly system: GPUParticleSystem | ParticleSystem;
  private readonly emitter: SphereParticleEmitter;
  private readonly light: PointLight;
  private readonly particleTexture: DynamicTexture;
  private accentColor: Color3;
  private burst = 0;
  private sparkle = 0;
  private time = 0;
  private paused = false;

  constructor(
    scene: Scene,
    preset: ARVLiveVisualPreset,
    quality: ARVQualitySettings,
  ) {
    this.accentColor = Color3.FromHexString(preset.crowdHex);
    this.particleTexture = createParticleTexture(scene);
    this.system = GPUParticleSystem.IsSupported && quality.tier !== 'eco'
      ? new GPUParticleSystem('arv-live-crowd', { capacity: quality.particleCapacity }, scene)
      : new ParticleSystem('arv-live-crowd-fallback', Math.min(quality.particleCapacity, 12000), scene);

    this.system.particleTexture = this.particleTexture;
    this.system.minSize = quality.tier === 'eco' ? 0.05 : 0.08;
    this.system.maxSize = quality.tier === 'eco' ? 0.2 : 0.36;
    this.system.minLifeTime = 1.4;
    this.system.maxLifeTime = 4.8;
    this.system.emitRate = quality.baseEmitRate;
    this.system.minEmitPower = 0.14;
    this.system.maxEmitPower = 0.9;
    this.system.blendMode = ParticleSystem.BLENDMODE_ADD;
    this.system.gravity = new Vector3(0, 0.24, 0);
    this.system.direction1 = new Vector3(-0.5, 0.4, 0.5);
    this.system.direction2 = new Vector3(0.5, 1.4, -0.5);
    this.system.color1 = new Color4(0.13, 0.83, 0.93, 0.86);
    this.system.color2 = new Color4(0.55, 0.36, 0.96, 0.74);
    this.system.colorDead = new Color4(0.01, 0.01, 0.03, 0);

    this.emitter = new SphereParticleEmitter();
    this.emitter.radius = quality.crowdRadius;
    this.emitter.radiusRange = 0.85;
    this.system.particleEmitterType = this.emitter;
    this.system.start();

    this.light = new PointLight('arv-live-crowd-light', new Vector3(0, 1.5, 0), scene);
    this.light.intensity = 1.2;
    this.light.diffuse = this.accentColor;
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) {
      return;
    }

    this.paused = paused;
    if (paused) {
      this.system.stop();
      this.system.emitRate = 0;
      this.light.intensity = 0.12;
      return;
    }

    this.system.start();
  }

  applyImpulse(impulse: ARVVisualImpulse): void {
    this.burst = Math.min(1.4, this.burst + impulse.burst);
    this.sparkle = Math.min(1.25, this.sparkle + impulse.sparkle);
    this.accentColor = Color3.FromHexString(impulse.colorHex);
  }

  update(deltaSeconds: number, audio: AudioReactiveSnapshot, phase: RitualPhaseState, quality: ARVQualitySettings): void {
    if (this.paused) {
      this.light.intensity = 0.12;
      return;
    }

    this.time += deltaSeconds;
    this.burst = Math.max(0, this.burst - deltaSeconds * 0.82);
    this.sparkle = Math.max(0, this.sparkle - deltaSeconds * 0.66);

    const drive = audio.rms * 0.42 + audio.high * 0.38 + audio.kick * 0.64 + this.burst * 0.55;
    const colorMix = Math.min(1, 0.22 + this.burst * 0.38 + phase.energy * 0.34);
    const phaseColor = Color3.FromHexString(phase.accentHex);
    const liveColor = Color3.Lerp(phaseColor, this.accentColor, colorMix);

    this.emitter.radius = Math.max(4.6, quality.crowdRadius - audio.bass * 1.8 + phase.energy * 0.4);
    this.system.emitRate = quality.baseEmitRate + drive * quality.emitBoost * phase.crowdMultiplier;
    this.system.minEmitPower = 0.12 + audio.mid * 0.35;
    this.system.maxEmitPower = 0.8 + drive * 1.6;
    this.system.gravity = new Vector3(
      Math.sin(this.time * 0.8) * (0.3 + this.burst * 1.6),
      0.18 + phase.energy * 0.5,
      Math.cos(this.time * 0.6) * (0.2 + this.sparkle * 1.4),
    );
    this.system.color1 = new Color4(liveColor.r, liveColor.g, liveColor.b, 0.9);
    this.system.color2 = new Color4(
      Math.min(1, liveColor.r * 1.18),
      Math.min(1, liveColor.g * 1.08),
      Math.min(1, liveColor.b * 1.28),
      0.68,
    );

    this.light.diffuse = liveColor;
    this.light.intensity = 0.5 + drive * 5 + phase.bloomBoost * 2;
  }

  dispose(): void {
    this.light.dispose();
    this.system.dispose();
    this.particleTexture.dispose();
  }
}
