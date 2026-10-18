import { Children, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { selectedUIVersion, switchUIVersion, type UIVersion } from '../lib/ui-version';
import './ui-versions.css';

const versions: { id: UIVersion; name: string; note: string; available: boolean }[] = [
  { id: 'canvas', name: 'Canvas', note: 'Read-only observation, connected actions and an independent evidence reader.', available: true },
  { id: 'classic', name: 'Legacy', note: 'The established continuous canvas, spatial map and full reading tools.', available: true },
  { id: 'modern', name: 'Modern', note: 'Legacy’s full agent visualization, with a modern explorer, tools and prompt workspace.', available: true },
];
const narrowSettings = '(max-width: 600px)';
const subscribeLayout = (notify: () => void) => { const media = matchMedia(narrowSettings); media.addEventListener('change', notify); return () => media.removeEventListener('change', notify); };

function SectionGlyph({ index }: { index: number }) {
  const paths = [<><circle cx="12" cy="12" r="8"/><path d="M12 4v16M12 4a8 8 0 0 0 0 16"/></>,<><path d="M4 5h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v14h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4ZM12 6v14"/></>,<path d="m8 5 11 7-11 7Z"/>,<><path d="m12 3 8 3v6c0 4-5 8-8 9-3-1-8-5-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,<><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 10h1m4 0h1m4 0h1M6 14h1m4 0h6"/></>,<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></>];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[index]}</svg>;
}

export function SettingsSections({ children, categories }: { children: ReactNode; categories?: string[] }) {
  const [tab, setTab] = useState<'general' | 'versions'>('general');
  const selected = selectedUIVersion();
  const current = selected === 'classic' && document.documentElement.dataset.experience === 'canvas' ? 'canvas' : selected;
  const [category, setCategory] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const narrow = useSyncExternalStore(subscribeLayout, () => matchMedia(narrowSettings).matches, () => false);
  useLayoutEffect(() => { if (panel.current) panel.current.scrollTop = 0; }, [category]);
  const id = useId();
  const modern = selected === 'modern' && categories;
  const sections = Children.toArray(children);
  const versionPanel = <VersionPanel current={current} />;
  if (modern) return <div className="modern-settings-layout">
    <div className="modern-settings-nav" role="tablist" aria-label="Settings sections" aria-orientation={narrow ? 'horizontal' : 'vertical'} onKeyDown={event => {
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')];
      const index = buttons.indexOf(event.target as HTMLButtonElement);
      const next = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? (index + 1) % buttons.length : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? (index + buttons.length - 1) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : undefined;
      if (next !== undefined) { event.preventDefault(); buttons[next]?.click(); buttons[next]?.focus(); }
    }}><span>Workspace</span>{[...categories, 'UI versions'].map((label, index) => <button key={label} id={`${id}-tab-${index}`} role="tab" tabIndex={category === index ? 0 : -1} aria-selected={category === index} aria-controls={`${id}-panel`} onClick={() => setCategory(index)}><SectionGlyph index={index}/>{label}</button>)}<small>Local preferences<br />Saved on this browser</small></div>
    <div ref={panel} id={`${id}-panel`} role="tabpanel" tabIndex={0} aria-labelledby={`${id}-tab-${category}`} className="modern-settings-content">{category === categories.length ? versionPanel : sections[category]}</div>
  </div>;
  return <div className="dv-settings">
    <div role="tablist" aria-label="Settings sections" className="dv-tabs">
      <button role="tab" aria-selected={tab === 'general'} onClick={() => setTab('general')}>General</button>
      <button role="tab" aria-selected={tab === 'versions'} onClick={() => setTab('versions')}>UI versions</button>
    </div>
    {tab === 'general' ? <div role="tabpanel" aria-label="General">{children}</div> : versionPanel}
  </div>;
}

function VersionPanel({ current }: { current: string }) {
  return <section role="tabpanel" aria-label="UI versions" className="dv-versions">
      <h3>Choose your workspace</h3><p>Same recordings and native connections. A different way to see the work.</p>
      <div>{versions.map(v => <button key={v.id} className={`dv-version dv-${v.id}`} disabled={!v.available} aria-pressed={current === v.id} onClick={() => switchUIVersion(v.id)}>
        <span className="dv-version-preview" aria-hidden="true"><i /><i /><i /><b /></span>
        <span><strong>{v.name}</strong><small>{v.note}</small></span><em>{current === v.id ? 'Active' : v.available ? 'Switch →' : 'Coming next'}</em>
      </button>)}</div>
      <p className="dv-note">Switching reloads the interface, keeps the selected session and saves your choice on this browser. Submit or save unsent drafts first.</p>
    </section>;
}
