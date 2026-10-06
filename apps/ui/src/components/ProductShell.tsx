import { useEffect, useId, useRef, type ReactNode } from 'react';
import { setLowResource, setMapVisible, setMotion, setTheme, useApp } from '../state.ts';

export function ReadingDialog({ title, close, children, className = '' }: { title: string; close: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className={`product-dialog ${className}`} aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); close(); }}>
    <header><h2 id={titleId}>{title}</h2><button className="icon-btn" aria-label={`Close ${title}`} onClick={close}>✕</button></header>
    {children}
  </dialog>;
}

export function ProductShell({ children }: { children: ReactNode }) {
  const theme = useApp((s) => s.theme);
  const open = useApp((s) => s.settingsOpen);
  const lowResource = useApp((s) => s.lowResource);
  // Low resource mode also drops the decorative grain/vignette layers.
  useEffect(() => { document.documentElement.toggleAttribute('data-low-resource', lowResource); }, [lowResource]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      // data-theme stays the light/dark scheme; data-palette names the look within it.
      const scheme = theme === 'system' ? media.matches ? 'light' : 'dark' : theme === 'light' ? 'light' : 'dark';
      document.documentElement.dataset.theme = scheme;
      document.documentElement.dataset.palette = scheme === 'light' ? 'paper' : theme === 'midnight' ? 'midnight' : 'jet';
    };
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return <>{children}{open && <Settings />}</>;
}

const THEMES = [
  ['dark', 'Jet', 'Matte black, champagne gold'],
  ['midnight', 'Midnight', 'Near-black, cool contrast'],
  ['light', 'Light', 'Paper and stone'],
  ['system', 'System', 'Jet or Light'],
] as const;

function Settings() {
  const theme = useApp((s) => s.theme);
  const motion = useApp((s) => s.motion);
  const map = useApp((s) => s.mapVisible);
  const low = useApp((s) => s.lowResource);
  const source = useApp((s) => s.source);
  const config = useApp((s) => s.config);
  return <ReadingDialog title="Workspace settings" close={() => useApp.setState({ settingsOpen: false })} className="settings-dialog">
    <section><h3>Appearance</h3><p className="muted">One theme across your sessions, repository and reading spaces.</p>
      <div className="theme-options" aria-label="Colour theme">{THEMES.map(([value, label, note]) => <button key={value} className={`theme-option theme-${value}`} aria-pressed={theme === value} aria-label={label} onClick={() => setTheme(value)}><i aria-hidden="true"><b /><b /><b /></i>{label}<small>{note}</small></button>)}</div>
    </section>
    <section><h3>Reading and resources</h3>
      <label className="setting-row"><span>Low resource mode<small>Smaller material cache and history overscan. Turns map and motion off.</small></span><input type="checkbox" checked={low} onChange={(e) => setLowResource(e.target.checked)} /></label>
      <label className="setting-row"><span>Repository map<small>Static imports and recorded locations. No inferred execution flow.</small></span><input type="checkbox" checked={map} onChange={(e) => setMapVisible(e.target.checked)} /></label>
      <label className="setting-row"><span>Relationship motion<small>Finite origin and outcome cues; captured text is always immediately readable.</small></span><input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} /></label>
      <p className="muted small">Low resource mode sets economical defaults; you can explicitly re-enable map or motion. Your browser's reduced-motion preference always suppresses animated cues.</p>
    </section>
    <section><h3>Your data stays here</h3><p className="muted">Drishya observes journals. It never sends prompts, launches an agent or writes to a harness. Imported evidence is copied and redacted before storage. There is no telemetry.</p><p className="muted small">Pattern redaction is best effort. Review sanitized exports before sharing them. Optional model explanations require a separate exact-payload consent; core reading works offline.</p><p className="small">{source?.kind === 'bundle' ? 'Offline replay bundle' : 'Local authenticated daemon'} · {config?.version ?? 'Drishya'}</p></section>
    <section><h3>Keyboard</h3><dl className="shortcut-list"><div><dt>/</dt><dd>Search captured work</dd></div><div><dt>Esc</dt><dd>Close the current reading space</dd></div><div><dt>X</dt><dd>Explore / leave repository</dd></div><div><dt>M</dt><dd>Toggle relationship motion</dd></div><div><dt>Space · ← · →</dt><dd>Play / step in optional sequence replay</dd></div><div><dt>E · F</dt><dd>Next edit / failure in sequence replay</dd></div></dl></section>
  </ReadingDialog>;
}
