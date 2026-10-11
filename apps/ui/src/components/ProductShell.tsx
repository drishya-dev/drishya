import { useEffect, useId, useRef, type ReactNode, type CSSProperties } from 'react';
import { setLowResource, setMapVisible, setMotion, setHoverReading, setTheme, setPresentationPreferences, useApp } from '../state.ts';
import { useExperience, setExperience } from '../lib/experience.ts';

export function ReadingDialog({ title, close, children, className = '', modeless = false, style }: { title: string; close: () => void; children: ReactNode; className?: string; modeless?: boolean; style?: CSSProperties }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    if (modeless) dialog.show(); else dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [modeless]);
  return <dialog ref={ref} style={style} className={`product-dialog ${className}${modeless ? " map-reader" : ""}`} aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); close(); }} onKeyDown={e => { if (modeless && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } }}>
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
  ['dark', 'Jet', 'Black, fine charcoal weave'],
  ['midnight', 'Midnight', 'Near-black, cool contrast'],
  ['light', 'Light', 'Paper and stone'],
  ['system', 'System', 'Jet or Light'],
] as const;

function Settings() {
  const experience = useExperience();
  const theme = useApp((s) => s.theme);
  const motion = useApp((s) => s.motion);
  const map = useApp((s) => s.mapVisible);
  const low = useApp((s) => s.lowResource);
  const hoverReading = useApp(s => s.hoverReading);
  const depth = useApp(s => s.mapDepth);
  const orbit = useApp(s => s.mapOrbit);
  const reasoningDetail = useApp(s => s.reasoningDetail);
  const source = useApp((s) => s.source);
  const config = useApp((s) => s.config);
  return <ReadingDialog title="Workspace settings" close={() => useApp.setState({ settingsOpen: false })} className="settings-dialog">
    <section><h3>Workspace design</h3><div className="experience-options" aria-label="Workspace design"><button className="btn" aria-pressed={experience === 'studio'} onClick={() => setExperience('studio')}>Studio <small>Work canvas · evidence desk</small></button><button className="btn" aria-pressed={experience === 'classic'} onClick={() => setExperience('classic')}>Classic <small>Refined original · centered materials</small></button></div><details className="legacy-design"><summary>Earlier design backup</summary><button className="btn" aria-pressed={experience === 'legacy'} onClick={() => setExperience('legacy')}>Legacy workspace</button></details></section>
    <section><h3>Appearance</h3><p className="muted">One theme across your sessions, repository and reading spaces.</p>
      <div className="theme-options" aria-label="Colour theme">{THEMES.map(([value, label, note]) => <button key={value} className={`theme-option theme-${value}`} aria-pressed={theme === value} aria-label={label} onClick={() => setTheme(value)}><i aria-hidden="true"><b /><b /><b /></i>{label}<small>{note}</small></button>)}</div>
    </section>
    <section><h3>Reading and resources</h3>
      <label className="setting-row"><span>Low resource mode<small>Smaller material cache and history overscan. Turns map and motion off.</small></span><input type="checkbox" checked={low} onChange={(e) => setLowResource(e.target.checked)} /></label>
      <label className="setting-row"><span>Repository map<small>Static imports and recorded locations. No inferred execution flow.</small></span><input type="checkbox" checked={map} onChange={(e) => setMapVisible(e.target.checked)} /></label>
      <label className="setting-row"><span>3D repository map<small>Spatial points and connections. Drag to orbit; Shift drag to pan; wheel to zoom. Depth is layout only.</small></span><input type="checkbox" checked={depth} onChange={e => setPresentationPreferences({ mapDepth: e.target.checked })} /></label>
      <label className="setting-row"><span>Slow background orbit<small>15 fps maximum. Resumes 12 seconds after manual camera movement; off in hidden tabs, low resource mode or reduced motion.</small></span><input type="checkbox" checked={orbit} disabled={!depth} onChange={e => setPresentationPreferences({ mapOrbit: e.target.checked })} /></label>
      <label className="setting-row"><span>Exposed reasoning<small>Display preference only. Includes captured thinking or summaries when supplied by the harness; never unlocks hidden reasoning or changes effort.</small></span><select aria-label="Exposed reasoning detail" value={reasoningDetail} onChange={e => setPresentationPreferences({ reasoningDetail: e.target.value as 'expanded' | 'collapsed' | 'hidden' })}><option value="expanded">Full available detail</option><option value="collapsed">Collapsed</option><option value="hidden">Hide</option></select></label>
      <label className="setting-row"><span>Relationship motion<small>Finite origin and outcome cues; captured text is always immediately readable.</small></span><input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} /></label>
      <label className="setting-row"><span>Hover reading focus<small>After a short dwell, centre the real preview without moving history. Escape restores it. Desktop pointer only.</small></span><input type="checkbox" checked={hoverReading} onChange={e => setHoverReading(e.target.checked)} /></label>
      <p className="muted small">Low resource mode sets economical defaults; you can explicitly re-enable map or motion. Your browser's reduced-motion preference always suppresses animated cues.</p>
    </section>
    <section><h3>Sequence diagnostics</h3><p className="muted small">Optional playback for inspecting captured event order. Ordinary reading uses scroll and prompt navigation.</p><button className="btn" onClick={() => { const app = useApp.getState(); app.set({ replayDiagnostics: true, settingsOpen: false }); app.togglePlay(); }}>Replay sequence</button></section>
    <section><h3>Your data stays here</h3><p className="muted">Passive capture observes journals independently. Explicitly submitted prompts can resume the selected native session after workspace consent and an idle-client acknowledgement; the native harness owns its normal writes. Imported evidence is copied and redacted before storage. There is no telemetry.</p><p className="muted small">Pattern redaction is best effort. Review sanitized exports before sharing them. Optional model explanations require a separate exact-payload consent; core reading works offline.</p><p className="small">{source?.kind === 'bundle' ? 'Offline replay bundle' : 'Local authenticated daemon'} · {config?.version ?? 'Drishya'}</p></section>
    <section><h3>Keyboard</h3><dl className="shortcut-list"><div><dt>/</dt><dd>Search captured work</dd></div><div><dt>Esc</dt><dd>Close the current reading space</dd></div><div><dt>X</dt><dd>Explore / leave repository</dd></div><div><dt>M</dt><dd>Toggle relationship motion</dd></div><div><dt>Space · ← · →</dt><dd>Play / step in explicit replay diagnostics</dd></div><div><dt>E · F</dt><dd>Next edit / failure in sequence replay</dd></div></dl></section>
  </ReadingDialog>;
}
