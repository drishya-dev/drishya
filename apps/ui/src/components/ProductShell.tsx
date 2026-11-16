import {surfaceMotion,watchSurfaceMotion} from '../lib/surface-motion.ts';
import { READING_SHORTCUTS } from './ReadingKeys.tsx';
import { DOCUMENT_SIZES, type DocumentSize } from '../lib/document-limit.ts';
import { installScrollbarActivity } from '../lib/scrollbar-activity.ts';
import { useEffect, useLayoutEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import {installInterfaceScale} from '../lib/interface-scale.ts';
import { createPortal } from 'react-dom';
import { setLowResource, setMapVisible, setMotion, setHoverReading, setDocumentSize, setTheme, setPresentationPreferences, useApp } from '../state.ts';
import { useEvidenceScroll } from './EvidenceNavigation.tsx';
import { useDismissMenus } from '../lib/dismiss-menus.ts';
import { SettingsSections } from './UIVersions.tsx';
import { GithubLinksSetting } from './GithubLinksSetting.tsx';
import {useReadingWindow} from './ReadingWindow.tsx';
import { useNotify, setNotifications } from '../lib/notifications.ts';

/** Open modeless readers, oldest first; Escape closes only the newest, wherever focus is. */
const modelessReaders: HTMLDialogElement[] = [];
const typing = (target: EventTarget | null) => target instanceof Element && !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], .cm-editor');

export function ReadingDialog({ title, close, children, className = '', modeless = false, style, headerIcon, resizeControl, windowId, resetWindow, floating=false, headerExtra, headerActions, heading, closing }: { closing?:boolean; title: string; close: () => void; children: ReactNode; className?: string; modeless?: boolean; style?: CSSProperties; headerIcon?: ReactNode; resizeControl?: ReactNode; windowId?:string; resetWindow?:()=>void;floating?:boolean;headerExtra?:ReactNode;headerActions?:ReactNode;heading?:ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const transition=useRef<ReturnType<typeof surfaceMotion>|undefined>(undefined),latestClose=useRef(close);
  latestClose.current=close;
  const requestClose=()=>{if(transition.current)transition.current.close(()=>latestClose.current());else latestClose.current();};
  useLayoutEffect(()=>{if(closing)requestClose();else if(transition.current?.closing)transition.current.open();},[closing,title]);
  useEffect(()=>{const reopen=()=>{if(transition.current?.closing)transition.current.open();};if(windowId==='File reader')globalThis.window.addEventListener('drishya-preview-file',reopen);return()=>{if(windowId==='File reader')globalThis.window.removeEventListener('drishya-preview-file',reopen);};},[windowId]);
  const window=useReadingWindow(ref,windowId);
  useEvidenceScroll(ref, `dialog/${className}`);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    if (modeless) dialog.show(); else dialog.showModal();
    // A dialog takes focus on its first control; one built around an input says so.
    dialog.querySelector<HTMLElement>('[data-dialog-focus]')?.focus({ preventScroll: true });
    // MOTION-4b: the command palette pairs too. Ctrl/Cmd K, Enter and Escape are keyboard input, which the shared gate already settles at once; only a pointer open or close travels.
    transition.current=surfaceMotion(dialog,modeless?'panel':'dialog');transition.current.open(true);
    const unwatch=watchSurfaceMotion(()=>transition.current?.finishImmediately());
    // Menus preventDefault their own Escape first, so the order is menu, then newest reader.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || modelessReaders.at(-1) !== dialog) return;
      if (typing(event.target) || document.querySelector('dialog:modal')) return;
      event.preventDefault(); latestClose.current();
    };
    if (modeless) { modelessReaders.push(dialog); document.addEventListener('keydown', escape); }
    return () => {
      if (modeless) { document.removeEventListener('keydown', escape); const at = modelessReaders.indexOf(dialog); if (at >= 0) modelessReaders.splice(at, 1); }
      unwatch();transition.current?.dispose();dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [modeless]);
  return createPortal(<dialog ref={ref} style={{...style,...window.style}} className={`product-dialog ${className}${modeless&&!floating ? " map-reader" : ""}${window.enabled?' adjustable-reading-window':''}`} aria-label={heading?title:undefined} aria-labelledby={heading?undefined:titleId} onCancel={(e) => { e.preventDefault(); e.stopPropagation(); if(e.target===e.currentTarget)requestClose(); }} onKeyDown={e => { if (e.key === "Escape" && !e.defaultPrevented && (e.target as Element).closest("dialog")===e.currentTarget) { document.documentElement.removeAttribute('data-ui-press'); e.stopPropagation(); if(modeless){e.preventDefault();requestClose();} } }}>
    <header {...window.headerDrag}>{resizeControl}<h2 id={titleId}>{headerIcon}{heading??title}</h2><div className="reading-window-actions">{headerActions}{window.controls}{window.enabled&&<button className="icon-btn" aria-label={`Reset ${windowId} window layout`} title="Reset window layout" onClick={()=>{window.reset();resetWindow?.();}}>↺</button>}<button className="icon-btn" aria-label={`Close ${title}`} onClick={requestClose}>✕</button></div></header>
    {headerExtra&&<div className="reading-window-tabs" {...window.headerDrag}>{headerExtra}</div>}
    {children}
    {window.heightControl}
  </dialog>, document.body);
}

export function ProductShell({ children }: { children: ReactNode }) {
  useLayoutEffect(installInterfaceScale,[]);
  const [readingHelp,setReadingHelp]=useState(false);
  useEffect(()=>{const open=()=>setReadingHelp(true);window.addEventListener('drishya-reading-help',open);return()=>window.removeEventListener('drishya-reading-help',open);},[]);
  useDismissMenus();
  useEffect(()=>document.documentElement.dataset.uiVersion==='modern'?installScrollbarActivity():undefined,[]);
  const motion = useApp(s => s.motion);
  useEffect(() => { document.documentElement.toggleAttribute('data-ui-motion', motion); }, [motion]);
  const theme = useApp((s) => s.theme);
  const open = useApp((s) => s.settingsOpen);
  const lowResource = useApp((s) => s.lowResource);
  // Low resource mode also drops the decorative grain/vignette layers.
  useEffect(() => { document.documentElement.toggleAttribute('data-low-resource', lowResource); }, [lowResource]);
  useEffect(() => {
    const apply = () => {
      // data-theme stays the light/dark scheme; data-palette names the look within it.
      const scheme = theme === 'light' || theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      document.documentElement.dataset.theme = scheme;
      document.documentElement.dataset.palette = scheme === 'light' ? 'paper' : theme === 'midnight' ? 'midnight' : 'jet';
    };
    apply();
    const preference = matchMedia('(prefers-color-scheme: light)');
    preference.addEventListener('change', apply);
    return () => preference.removeEventListener('change', apply);
  }, [theme]);
  return <>{children}{open && <Settings />}{readingHelp && <ReadingDialog title="Reading shortcuts" className="reading-shortcuts" close={()=>setReadingHelp(false)}><p>Move through the session. Reading keys detach Follow; capture continues.</p><dl>{READING_SHORTCUTS.map(([keys,action])=><div key={keys}><dt><kbd>{keys}</kbd></dt><dd>{action}</dd></div>)}</dl><p className="muted small">Disabled in inputs, editors, menus and readers. Replay keeps its transport controls. Copy uses a selection or the material’s existing copy action; otherwise it copies the card preview.</p></ReadingDialog>}</>;
}

const THEMES = [
  ['dark', 'Jet Black', 'Linear Dark · graphite and azure'],
  ['midnight', 'Midnight', 'Deep navy · sky blue'],
  ['light', 'Paper', 'Pristine Light · off-white and blue'],
] as const;

// Modern names describe our materials, without claiming another theme's identity.
const MODERN_THEMES = [
  ['dark', 'Jet Black', 'Neutral graphite · azure'],
  ['midnight', 'Midnight', 'Midnight black · electric blue'],
  ['light', 'Daylight', 'White · sky blue'],
] as const;

function Settings() {
  const theme = useApp((s) => s.theme);
  const motion = useApp((s) => s.motion);
  const map = useApp((s) => s.mapVisible);
  const low = useApp((s) => s.lowResource);
  const hoverReading = useApp(s => s.hoverReading);
  const documentSize = useApp(s => s.documentSize);
  const depth = useApp(s => s.mapDepth);
  const orbit = useApp(s => s.mapOrbit);
  const reasoningDetail = useApp(s => s.reasoningDetail);
  const source = useApp((s) => s.source);
  const config = useApp((s) => s.config);
  const notify = useNotify();
  return <ReadingDialog title="Workspace settings" close={() => useApp.setState({ settingsOpen: false })} className="settings-dialog">
    <SettingsSections categories={['Appearance', 'Reading', 'Links', 'Playback', 'Privacy', 'Keyboard']}>
    <section><h3>Appearance</h3><p className="muted">One theme across your sessions, repository and reading spaces.</p>
      <div className="theme-options" aria-label="Colour theme">{(document.documentElement.dataset.uiVersion==='modern'?MODERN_THEMES:THEMES.slice(0,3)).map(([value, label, note]) => <button key={value} className={`theme-option theme-${value}`} aria-pressed={theme === value} aria-label={label} onClick={() => setTheme(value)}><i aria-hidden="true"><b /><b /><b /></i>{label}<small>{note}</small></button>)}</div>
    </section>
    <section><h3>Reading and resources</h3>
      <label className="setting-row"><span>Low resource mode<small>Smaller material cache and history overscan. Turns map and motion off.</small></span><input type="checkbox" checked={low} onChange={(e) => setLowResource(e.target.checked)} /></label>
      <label className="setting-row"><span>Repository map<small>Static imports and session locations. No inferred execution flow.</small></span><input type="checkbox" checked={map} onChange={(e) => setMapVisible(e.target.checked)} /></label>
      <label className="setting-row"><span>3D repository map<small>Spatial points and connections. Drag to orbit; Shift drag to pan; wheel to zoom. Depth is layout only.</small></span><input type="checkbox" checked={depth} onChange={e => setPresentationPreferences({ mapDepth: e.target.checked })} /></label>
      <label className="setting-row"><span>Slow background orbit<small>15 fps maximum. Resumes 12 seconds after manual camera movement; off in hidden tabs, low resource mode or reduced motion.</small></span><input type="checkbox" checked={orbit} disabled={!depth} onChange={e => setPresentationPreferences({ mapOrbit: e.target.checked })} /></label>
      <label className="setting-row"><span>Exposed reasoning<small>Display only; never unlocks private reasoning or changes model effort.</small></span><span className="settings-select"><select aria-label="Exposed reasoning detail" value={reasoningDetail} onChange={e => setPresentationPreferences({ reasoningDetail: e.target.value as 'expanded' | 'collapsed' | 'hidden' })}><option value="expanded">Full available detail</option><option value="collapsed">Collapsed</option><option value="hidden">Hide</option></select></span></label>
      <label className="setting-row"><span>Relationship motion<small>Finite origin and outcome cues; text is always immediately readable.</small></span><input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} /></label>
      <label className="setting-row"><span>Largest rendered document<small>Markdown files up to this size open as a formatted document; larger ones open as Source, which is always available. Bigger limits render more slowly. Files over 2 MiB are never read.</small></span><span className="settings-select"><select aria-label="Largest rendered document" value={documentSize} onChange={e => setDocumentSize(e.target.value as DocumentSize)}>{(Object.keys(DOCUMENT_SIZES) as DocumentSize[]).map(key => <option key={key} value={key}>{DOCUMENT_SIZES[key].label}</option>)}</select></span></label>
      <label className="setting-row"><span>Hover reading focus<small>After a short dwell, enlarge the real preview within the viewport without moving history. Escape restores it. Desktop pointer only.</small></span><input type="checkbox" checked={hoverReading} onChange={e => setHoverReading(e.target.checked)} /></label>
      <label className="setting-row"><span>Notify when the agent needs me or finishes<small>{notify.permission === 'unsupported' ? 'This browser does not support notifications.' : notify.permission === 'denied' ? 'Blocked in your browser’s site settings; allow notifications there to turn this on.' : 'Only while this tab is hidden. Shows the session title and state, never content. The browser asks for permission when you turn this on.'}</small></span><input type="checkbox" checked={notify.enabled} disabled={notify.permission === 'unsupported' || notify.permission === 'denied'} onChange={e => void setNotifications(e.target.checked)} /></label>
      <p className="muted small">Low resource mode sets economical defaults; you can explicitly re-enable map or motion. Your browser's reduced-motion preference always suppresses animated cues.</p>
    </section>
    <GithubLinksSetting />
    <section><h3>Playback</h3><p className="muted small">Replay the session in recorded order. For everyday reading, scroll through the session or jump between prompts.</p><button className="btn" onClick={() => { const app = useApp.getState(); app.set({ replayDiagnostics: true, settingsOpen: false }); app.togglePlay(); }}>Replay sequence</button></section>
    <section><h3>Your data stays here</h3><p className="muted">Passive capture observes journals independently. Explicitly submitted prompts can resume the selected native session after workspace consent and an idle-client acknowledgement; the native harness owns its normal writes. Imported evidence is copied and redacted before storage. There is no telemetry.</p><p className="muted small">Pattern redaction is best effort. Review sanitized exports before sharing them. Optional model explanations require a separate exact-payload consent; core reading works offline.</p><p className="small">{source?.kind === 'bundle' ? 'Offline replay bundle' : 'Local authenticated daemon'} · {config?.version ?? 'Drishya'}</p></section>
    <section><h3>Keyboard</h3><p className="small">Read the session with j / k, jump to edits with n / p, and press ? for the complete guide.</p><button className="btn" onClick={()=>{useApp.setState({settingsOpen:false});window.dispatchEvent(new Event('drishya-reading-help'));}}>Reading shortcuts</button><dl className="shortcut-list"><div><dt>Ctrl / Cmd K</dt><dd>Navigate workspace</dd></div><div><dt>Ctrl / Cmd Shift Enter</dt><dd>Expand and focus the prompt without sending</dd></div><div><dt>Alt W</dt><dd>Close the active Workspace file</dd></div><div><dt>/</dt><dd>Search this session</dd></div><div><dt>Esc</dt><dd>Close the current reading space</dd></div><div><dt>X</dt><dd>Explore / leave repository</dd></div><div><dt>M</dt><dd>Toggle relationship motion</dd></div><div><dt>Space · ← · →</dt><dd>Play / step in explicit replay diagnostics</dd></div><div><dt>E · F</dt><dd>Next edit / failure in sequence replay</dd></div></dl></section>
    </SettingsSections>
  </ReadingDialog>;
}
