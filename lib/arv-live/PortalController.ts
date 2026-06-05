import {
  Color3,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { AudioReactiveSnapshot } from './AudioReactiveUniforms';
import type { ARVLiveVisualPreset, ARVQualitySettings } from './presets';
import type { RitualPhaseState } from './RitualPhaseController';
import type { ARVVisualImpulse } from './types';

export class PortalController {
  private readonly root: TransformNode;
  private readonly outerRing: Mesh;
  private readonly haloRing: Mesh;
  private readonly iris: Mesh;
  private readonly pupil: Mesh;
  private readonly satellites: Mesh[] = [];
  private readonly outerMaterial: StandardMaterial;
  private readonly haloMaterial: StandardMaterial;
  private readonly irisMaterial: StandardMaterial;
  private readonly pupilMaterial: StandardMaterial;
  private readonly light: PointLight;
  private readonly satelliteOffsets: number[] = [];
  private eventPulse = 0;
  private eventColor: Color3;
  private time = 0;
  private paused = false;

  constructor(
    scene: Scene,
    preset: ARVLiveVisualPreset,
    quality: ARVQualitySettings,
  ) {
    this.root = new TransformNode('arv-live-portal-root', scene);
    this.eventColor = Color3.FromHexString(preset.portalHex);

    this.outerMaterial = new StandardMaterial('arv-live-portal-outer-mat', scene);
    this.outerMaterial.disableLighting = true;
    this.outerMaterial.emissiveColor = Color3.FromHexString(preset.portalHex);

    this.haloMaterial = new StandardMaterial('arv-live-portal-halo-mat', scene);
    this.haloMaterial.disableLighting = true;
    this.haloMaterial.emissiveColor = Color3.FromHexString(preset.accentHex).scale(0.4);
    this.haloMaterial.alpha = 0.68;

    this.irisMaterial = new StandardMaterial('arv-live-portal-iris-mat', scene);
    this.irisMaterial.disableLighting = true;
    this.irisMaterial.emissiveColor = Color3.FromHexString('#05050c');
    this.irisMaterial.diffuseColor = Color3.FromHexString('#090611');

    this.pupilMaterial = new StandardMaterial('arv-live-portal-pupil-mat', scene);
    this.pupilMaterial.disableLighting = true;
    this.pupilMaterial.emissiveColor = Color3.FromHexString('#f8fafc').scale(0.35);
    this.pupilMaterial.alpha = 0.92;

    this.outerRing = MeshBuilder.CreateTorus(
      'arv-live-portal-outer',
      { diameter: 5.6, thickness: quality.tier === 'eco' ? 0.32 : 0.42, tessellation: 96 },
      scene,
    );
    this.outerRing.parent = this.root;
    this.outerRing.material = this.outerMaterial;

    this.haloRing = MeshBuilder.CreateTorus(
      'arv-live-portal-halo',
      { diameter: 6.7, thickness: 0.1, tessellation: 96 },
      scene,
    );
    this.haloRing.parent = this.root;
    this.haloRing.material = this.haloMaterial;
    this.haloRing.rotation.x = Math.PI / 2;

    this.iris = MeshBuilder.CreateDisc(
      'arv-live-portal-iris',
      { radius: 2.1, tessellation: 80 },
      scene,
    );
    this.iris.parent = this.root;
    this.iris.material = this.irisMaterial;

    this.pupil = MeshBuilder.CreateSphere(
      'arv-live-portal-pupil',
      { diameter: 0.92, segments: 24 },
      scene,
    );
    this.pupil.parent = this.root;
    this.pupil.material = this.pupilMaterial;
    this.pupil.position.z = 0.22;

    const satelliteCount = quality.tier === 'eco' ? 3 : 6;
    for (let index = 0; index < satelliteCount; index += 1) {
      const satellite = MeshBuilder.CreateSphere(
        `arv-live-portal-satellite-${index}`,
        { diameter: 0.18, segments: 12 },
        scene,
      );
      satellite.parent = this.root;
      satellite.material = this.haloMaterial;
      this.satellites.push(satellite);
      this.satelliteOffsets.push((Math.PI * 2 * index) / satelliteCount);
    }

    this.light = new PointLight('arv-live-portal-light', new Vector3(0, 0, 0), scene);
    this.light.intensity = 3.2;
    this.light.diffuse = Color3.FromHexString(preset.portalHex);
  }

  setPaused(paused: boolean, standbyPhase: RitualPhaseState): void {
    this.paused = paused;
    if (!paused) {
      return;
    }

    const calmColor = Color3.FromHexString(standbyPhase.accentHex);
    this.root.rotation.z = 0;
    this.outerRing.scaling.setAll(1);
    this.haloRing.scaling.setAll(1);
    this.iris.scaling.setAll(1);
    this.pupil.position.z = 0.16;
    this.outerMaterial.emissiveColor = calmColor.scale(0.14);
    this.haloMaterial.emissiveColor = calmColor.scale(0.08);
    this.pupilMaterial.emissiveColor = calmColor.scale(0.12);

    const orbitRadius = 2.8;
    this.satellites.forEach((satellite, index) => {
      const angle = this.satelliteOffsets[index];
      satellite.position.x = Math.cos(angle) * orbitRadius;
      satellite.position.y = Math.sin(angle) * orbitRadius * 0.4;
      satellite.position.z = 0;
      satellite.scaling.setAll(0.84);
    });

    this.light.diffuse = calmColor;
    this.light.intensity = 0.22;
  }

  applyImpulse(impulse: ARVVisualImpulse): void {
    this.eventPulse = Math.min(1.5, this.eventPulse + impulse.intensity * 0.82);
    this.eventColor = Color3.FromHexString(impulse.colorHex);
  }

  update(deltaSeconds: number, audio: AudioReactiveSnapshot, phase: RitualPhaseState): void {
    if (this.paused) {
      return;
    }

    this.time += deltaSeconds;
    this.eventPulse = Math.max(0, this.eventPulse - deltaSeconds * 0.9);

    const bassPulse = audio.bass * 0.9 + audio.kick * 1.2 + this.eventPulse * 0.64;
    const targetColor = Color3.Lerp(
      Color3.FromHexString(phase.accentHex),
      this.eventColor,
      Math.min(1, 0.28 + this.eventPulse * 0.52),
    );

    this.outerMaterial.emissiveColor = Color3.Lerp(
      this.outerMaterial.emissiveColor,
      targetColor.scale(1.24),
      0.12,
    );
    this.haloMaterial.emissiveColor = Color3.Lerp(
      this.haloMaterial.emissiveColor,
      targetColor.scale(0.85),
      0.12,
    );
    this.pupilMaterial.emissiveColor = Color3.Lerp(
      this.pupilMaterial.emissiveColor,
      targetColor.scale(0.42 + phase.energy * 0.4),
      0.1,
    );

    const ringScale = 1 + bassPulse * 0.08 + phase.portalMultiplier * 0.02;
    this.outerRing.scaling.set(ringScale, ringScale, ringScale);
    this.haloRing.scaling.setAll(1 + bassPulse * 0.14 + phase.portalMultiplier * 0.05);
    this.iris.scaling.setAll(1 - Math.min(0.2, audio.kick * 0.18) + this.eventPulse * 0.04);
    this.root.rotation.z += deltaSeconds * (0.16 + phase.portalMultiplier * 0.08);
    this.haloRing.rotation.y += deltaSeconds * 0.52;
    this.pupil.position.z = 0.18 + bassPulse * 0.42;

    const orbitRadius = 3.3 + audio.mid * 0.4 + phase.energy * 0.24;
    this.satellites.forEach((satellite, index) => {
      const angle = this.time * (0.5 + index * 0.08) + this.satelliteOffsets[index];
      satellite.position.x = Math.cos(angle) * orbitRadius;
      satellite.position.y = Math.sin(angle) * orbitRadius * 0.65;
      satellite.position.z = Math.sin(angle * 1.6) * 0.55;
      satellite.scaling.setAll(1 + this.eventPulse * 0.35 + audio.high * 0.2);
    });

    this.light.diffuse = targetColor;
    this.light.intensity = 2.6 + bassPulse * 7 + phase.bloomBoost * 2.4;
  }

  dispose(): void {
    this.light.dispose();
    this.outerMaterial.dispose();
    this.haloMaterial.dispose();
    this.irisMaterial.dispose();
    this.pupilMaterial.dispose();
    this.root.dispose(false, true);
  }
}
