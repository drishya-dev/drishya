import {palettePaint,usePaletteKey} from '../lib/palette-paint.ts';
import { useEffect, useState } from 'react';
import type { NowFacts } from '../../../../packages/scene/src/now.ts';
import { useApp } from '../state.ts';
import { nowView } from '../lib/now-state.ts';
import { publishNow, useNow } from '../lib/now-store.ts';

const HARNESS: Record<string, string> = { codex: 'Codex', 'claude-code': 'Claude' };
const MARK_COLOR = { running: '--pass', asking: '--edited', working: '--focus' } as const;
const BASE_TITLE = 'Drishya';

/**
 * Keeps the "what is it doing now" line current without rendering anything itself: it asks the daemon for the
 * newest captured state whenever the recording changes (so scrolling back in history never makes it stale),
 * ticks once a second for elapsed time, and mirrors the state in the tab title and favicon.
 */
export function NowWatcher() {
  const theme=usePaletteKey();
  const source = useApp((s) => s.source);
  const id = useApp((s) => s.recordingId);
  const recording = useApp((s) => s.recording);
  const live = !!recording?.live;
  const [facts, setFacts] = useState<NowFacts>();
  const [, tick] = useState(0);

  useEffect(() => {
    if (!source?.now || !id || !live) { setFacts(undefined); return; }
    let cancelled = false;
    const load = () => { void source.now!(id).then((next) => { if (!cancelled) setFacts(next); }, () => {}); };
    const timer = setTimeout(load, 250);
    const visible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, [source, id, live, recording?.revision, recording?.observationCount]);

  // Elapsed time moves once a second, and only while someone can see it.
  const view = nowView(facts, live, {
    nowMs: Date.now(),
    harness: HARNESS[recording?.harness ?? ''] ?? 'Agent',
    workspace: recording?.workspaceRoot?.replace(/\\/g, '/').split('/').filter(Boolean).at(-1),
  });
  const active = !!view;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => { if (!document.hidden) tick((n) => n + 1); }, 1000);
    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => { publishNow(view); });
  useEffect(() => () => publishNow(undefined), [id]);

  // Tab title and favicon: only while the agent is active, restored the moment it is not.
  const tab = view?.tab, mark = view?.mark;
  useEffect(() => {
    document.title = tab ?? BASE_TITLE;
    return () => { document.title = BASE_TITLE; };
  }, [tab]);
  useEffect(() => {
    if (!mark) return;
    // Every typed tab icon is swapped (the SVG one is what browsers prefer), and each gets its own href and type back.
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"][type="image/svg+xml"],link[rel~="icon"][type="image/png"]')];
    const originals = links.map((link) => link.href), types = links.map((link) => link.type);
    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(image, 0, 0, 64, 64);
      context.fillStyle = palettePaint('--bg'); context.beginPath(); context.arc(48, 48, 15, 0, Math.PI * 2); context.fill();
      context.fillStyle = palettePaint(MARK_COLOR[mark]); context.beginPath(); context.arc(48, 48, 11, 0, Math.PI * 2); context.fill();
      const url = canvas.toDataURL('image/png');
      for (const link of links) { link.type = 'image/png'; link.href = url; }
    };
    image.src = originals[0] ?? '/brand/drishya-32.png';
    return () => { disposed = true; links.forEach((link, index) => { link.type = types[index]!; link.href = originals[index]!; }); };
  }, [mark,theme]);

  return null;
}

/** The sentence for the composer pill, or undefined when nothing is happening or Drishya is not watching. */
export function useNowText(): { text: string; tone: string; basis: string } | undefined {
  const view = useNow((s) => s.view);
  return view ? { text: view.text, tone: view.tone, basis: view.basis } : undefined;
}
