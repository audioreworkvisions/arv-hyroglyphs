import React, { useEffect } from 'react';
import ARVLiveCanvas from './ARVLiveCanvas';
import { resolveARVLivePresetId, resolveARVQualityTier, type ARVHudMode } from '../../lib/arv-live/presets';

const resolvePresetId = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;

  const value = new URLSearchParams(window.location.search).get('preset')?.trim();
  return value ? resolveARVLivePresetId(value, value) : undefined;
};

const resolveHudMode = (): Exclude<ARVHudMode, 'preview'> => {
  if (typeof window === 'undefined') return 'minimal';

  const value = new URLSearchParams(window.location.search).get('hud')?.trim().toLowerCase();
  if (value === 'none') {
    return 'none';
  }
  if (value === 'full') {
    return 'full';
  }

  return 'minimal';
};

const resolveQuality = () => {
  if (typeof window === 'undefined') return 'ultra' as const;
  return resolveARVQualityTier(new URLSearchParams(window.location.search).get('quality'), 'ultra');
};

const resolveTransparent = (): boolean => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('transparent')?.trim().toLowerCase() === 'true';
};

export default function ARVLiveViewerPage() {
  const presetId = resolvePresetId();
  const transparent = resolveTransparent();

  useEffect(() => {
    document.title = 'ARV MR Concert Canvas · Viewer';
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className={`arv-live-route ${transparent ? 'arv-live-route-transparent' : ''}`}>
      <ARVLiveCanvas
        mode="viewer"
        hudMode={resolveHudMode()}
        initialPresetId={presetId}
        presetIdOverride={presetId}
        qualityTierOverride={resolveQuality()}
        transparentBackground={transparent}
      />
    </div>
  );
}
