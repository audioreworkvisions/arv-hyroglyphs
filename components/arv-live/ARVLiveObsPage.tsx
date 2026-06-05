import React, { useEffect } from 'react';
import ARVLiveCanvas from './ARVLiveCanvas';
import { resolveARVLivePresetId, resolveARVQualityTier, type ARVHudMode } from '../../lib/arv-live/presets';

const resolveHudMode = (): Exclude<ARVHudMode, 'preview'> => {
  if (typeof window === 'undefined') return 'full';

  const value = new URLSearchParams(window.location.search).get('hud')?.trim().toLowerCase();
  if (value === 'none') {
    return 'none';
  }

  return value === 'minimal' ? 'minimal' : 'full';
};

const resolvePresetId = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;

  const value = new URLSearchParams(window.location.search).get('preset')?.trim();
  return value ? resolveARVLivePresetId(value, value) : undefined;
};

const resolveQuality = () => {
  if (typeof window === 'undefined') return 'obs' as const;
  return resolveARVQualityTier(new URLSearchParams(window.location.search).get('quality'), 'obs');
};

const resolveTransparent = (): boolean => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('transparent')?.trim().toLowerCase() === 'true';
};

export default function ARVLiveObsPage() {
  const hudMode = resolveHudMode();
  const transparent = resolveTransparent();

  useEffect(() => {
    document.title = 'ARV MR Concert Canvas · OBS';
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className={`arv-live-route ${transparent ? 'arv-live-route-transparent' : ''}`}>
      <ARVLiveCanvas
        mode="obs"
        hudMode={hudMode}
        initialPresetId={resolvePresetId()}
        qualityTierOverride={resolveQuality()}
        transparentBackground={transparent}
      />
    </div>
  );
}
