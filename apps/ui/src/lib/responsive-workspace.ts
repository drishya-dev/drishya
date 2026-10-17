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
