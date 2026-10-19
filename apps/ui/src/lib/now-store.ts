import { create } from 'zustand';
import type { NowView } from './now-state.ts';

/** The current "now" line, shared by the composer pill, the tab title and the favicon. */
export const useNow = create<{ view?: NowView }>(() => ({}));

export function publishNow(view: NowView | undefined) {
  const current = useNow.getState().view;
  if (current?.text === view?.text && current?.tone === view?.tone && current?.basis === view?.basis && current?.tab === view?.tab) return;
  useNow.setState({ view });
}
