import { useSyncExternalStore } from 'react';

const query = '(max-width: 820px)';
const subscribe = (notify: () => void) => {
  const media = matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const snapshot = () => matchMedia(query).matches;

/** Keep rendered controls and their ARIA state on the same responsive boundary. */
export function useNarrowWorkspace() { return useSyncExternalStore(subscribe, snapshot, () => false); }

const phoneQuery = '(max-width: 600px)';
const subscribePhone = (notify: () => void) => { const media = matchMedia(phoneQuery); media.addEventListener('change', notify); return () => media.removeEventListener('change', notify); };
/** Phone widths: the header cannot hold the whole navigation cluster (UI-1). */
export function usePhoneHeader() { return useSyncExternalStore(subscribePhone, () => matchMedia(phoneQuery).matches, () => false); }
