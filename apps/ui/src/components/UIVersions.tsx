import { Children, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import './ui-versions.css';

const narrowSettings = '(max-width: 600px)';
const subscribeLayout = (notify: () => void) => { const media = matchMedia(narrowSettings); media.addEventListener('change', notify); return () => media.removeEventListener('change', notify); };

function SectionGlyph({ label }: { label: string }) {
  const icons: Record<string, ReactNode> = { Appearance: <><circle cx="12" cy="12" r="8"/><path d="M12 4v16M12 4a8 8 0 0 0 0 16"/></>, Reading: <><path d="M4 5h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v14h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4ZM12 6v14"/></>, Links: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>, Playback: <path d="m8 5 11 7-11 7Z"/>, Privacy: <><path d="m12 3 8 3v6c0 4-5 8-8 9-3-1-8-5-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>, Keyboard: <><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 10h1m4 0h1m4 0h1M6 14h1m4 0h6"/></> };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[label] ?? <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></>}</svg>;
}

export function SettingsSections({ children, categories }: { children: ReactNode; categories?: string[] }) {
  const [category, setCategory] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const narrow = useSyncExternalStore(subscribeLayout, () => matchMedia(narrowSettings).matches, () => false);
  useLayoutEffect(() => { if (panel.current) panel.current.scrollTop = 0; }, [category]);
  const id = useId();
  const modern = categories;
  const sections = Children.toArray(children);
  if (modern) return <div className="modern-settings-layout">
    <div className="modern-settings-nav" role="tablist" aria-label="Settings sections" aria-orientation={narrow ? 'horizontal' : 'vertical'} onKeyDown={event => {
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')];
      const index = buttons.indexOf(event.target as HTMLButtonElement);
      const next = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? (index + 1) % buttons.length : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? (index + buttons.length - 1) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : undefined;
      if (next !== undefined) { event.preventDefault(); buttons[next]?.click(); buttons[next]?.focus(); }
    }}><span>Workspace</span>{categories.map((label, index) => <button key={label} id={`${id}-tab-${index}`} role="tab" tabIndex={category === index ? 0 : -1} aria-selected={category === index} aria-controls={`${id}-panel`} onClick={() => setCategory(index)}><SectionGlyph label={label}/>{label}</button>)}<small>Local preferences<br />Saved on this browser</small></div>
    <div ref={panel} id={`${id}-panel`} role="tabpanel" tabIndex={0} aria-labelledby={`${id}-tab-${category}`} className="modern-settings-content">{sections[category]}</div>
  </div>;
  return <div className="dv-settings">{children}</div>;
}
