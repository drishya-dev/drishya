import {useSyncExternalStore} from 'react';

/** One desktop reference; short or narrow windows keep their existing geometry. */
export const INTERFACE_REFERENCE = { width: 1440, height: 900 } as const;
export const INTERFACE_SCALE_LIMIT = 2.25;

export function interfaceScale(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return 1;
  return Math.max(1, Math.min(INTERFACE_SCALE_LIMIT, width / INTERFACE_REFERENCE.width, height / INTERFACE_REFERENCE.height));
}

/** Logical design lengths become rem; DOM measurements and pointer coordinates remain CSS pixels. */
export const interfaceRem = (pixels: number) => `${pixels / 16}rem`;

const changed = 'drishya-interface-scale';
const subscribe = (listener:()=>void) => { window.addEventListener(changed,listener);return()=>window.removeEventListener(changed,listener); };
export const currentInterfaceScale = () => typeof document==='undefined'?1:Number(document.documentElement.style.getPropertyValue('--ui-scale'))||interfaceScale(innerWidth,innerHeight);
export const useInterfaceScale = () => useSyncExternalStore(subscribe,currentInterfaceScale,()=>1);

export function installInterfaceScale(): () => void {
  const root = document.documentElement;
  const previous = root.style.getPropertyValue('--ui-scale');
  const wasScaled = root.hasAttribute('data-ui-scaled');
  let frame: number | undefined;
  const apply = () => {
    frame = undefined;
    const scale = interfaceScale(innerWidth, innerHeight);
    const previousScale = currentInterfaceScale();
    root.style.setProperty('--ui-scale', String(scale));
    root.toggleAttribute('data-ui-scaled', scale > 1);
    if (scale !== previousScale) window.dispatchEvent(new Event(changed));
  };
  const resized = () => { if (frame === undefined) frame = requestAnimationFrame(apply); };
  apply();
  window.addEventListener('resize', resized);
  return () => {
    window.removeEventListener('resize', resized);
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (previous) root.style.setProperty('--ui-scale', previous); else root.style.removeProperty('--ui-scale');
    root.toggleAttribute('data-ui-scaled', wasScaled);
  };
}
