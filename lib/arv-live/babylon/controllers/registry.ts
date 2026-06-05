import type { ARVLiveVisualPreset } from '../../presets';
import type { ARVSceneController } from './ARVSceneController';
import type { ARVSceneControllerId } from './controllerIds';

const assertNever = (value: never): never => {
  throw new Error(`Unknown ARV scene controller: ${value}`);
};

export const createARVSceneController = (
  id: ARVSceneControllerId,
  preset: ARVLiveVisualPreset,
): Promise<ARVSceneController> => {
  switch (id) {
    case 'arv-laughing-signal-mascot':
      return import('./LaughingSignalMascotController').then(({ LaughingSignalMascotController }) => {
        return new LaughingSignalMascotController(preset);
      });
    case 'arv-archive-iris-kaleidoscope':
      return import('./ArchiveIrisKaleidoscopeController').then(({ ArchiveIrisKaleidoscopeController }) => {
        return new ArchiveIrisKaleidoscopeController(preset);
      });
    case 'arv-neon-micro-city':
      return import('./NeonMicroCityController').then(({ NeonMicroCityController }) => {
        return new NeonMicroCityController(preset);
      });
    case 'arv-triangular-torus-bloom':
      return import('./TriangularTorusBloomController').then(({ TriangularTorusBloomController }) => {
        return new TriangularTorusBloomController(preset);
      });
    case 'arv-orbital-data-sphere':
      return import('./OrbitalDataSphereController').then(({ OrbitalDataSphereController }) => {
        return new OrbitalDataSphereController(preset);
      });
    case 'arv-last-connector':
      return import('./LastConnectorController').then(({ LastConnectorController }) => {
        return new LastConnectorController(preset);
      });
    case 'arv-please-wait-terminal':
      return import('./PleaseWaitTerminalController').then(({ PleaseWaitTerminalController }) => {
        return new PleaseWaitTerminalController(preset);
      });
    case 'arv-glitch-portrait-transmission':
      return import('./GlitchPortraitTransmissionController').then(({ GlitchPortraitTransmissionController }) => {
        return new GlitchPortraitTransmissionController(preset);
      });
    case 'arv-operator-attic':
      return import('./OperatorAtticController').then(({ OperatorAtticController }) => {
        return new OperatorAtticController(preset);
      });
    default:
      return Promise.reject(assertNever(id));
  }
};