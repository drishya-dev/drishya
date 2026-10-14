import { useState, type ReactNode } from 'react';
import { selectedUIVersion, switchUIVersion, type UIVersion } from '../lib/ui-version';
import './ui-versions.css';

const versions: { id: UIVersion; name: string; note: string; available: boolean }[] = [
  { id: 'classic', name: 'Legacy', note: 'The established continuous canvas, spatial map and full reading tools.', available: true },
  { id: 'fresh', name: 'Workbench', note: 'The independent connected draft, preserved for comparison.', available: true },
  { id: 'modern', name: 'Modern', note: 'A spatial black canvas with connected floating materials. In preparation.', available: false },
];

export function SettingsSections({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<'general' | 'versions'>('general');
  const current = selectedUIVersion();
  return <div className="dv-settings">
    <div role="tablist" aria-label="Settings sections" className="dv-tabs">
      <button role="tab" aria-selected={tab === 'general'} onClick={() => setTab('general')}>General</button>
      <button role="tab" aria-selected={tab === 'versions'} onClick={() => setTab('versions')}>UI versions</button>
    </div>
    {tab === 'general' ? <div role="tabpanel" aria-label="General">{children}</div> : <section role="tabpanel" aria-label="UI versions" className="dv-versions">
      <h3>Choose your workspace</h3><p>Same recordings and native connections. A different way to see the work.</p>
      <div>{versions.map(v => <button key={v.id} className={`dv-version dv-${v.id}`} disabled={!v.available} aria-pressed={current === v.id} onClick={() => switchUIVersion(v.id)}>
        <span className="dv-version-preview" aria-hidden="true"><i /><i /><i /><b /></span>
        <span><strong>{v.name}</strong><small>{v.note}</small></span><em>{current === v.id ? 'Active' : v.available ? 'Switch →' : 'Coming next'}</em>
      </button>)}</div>
      <p className="dv-note">Switching reloads the interface, keeps the selected session and saves your choice on this browser. Submit or save unsent drafts first.</p>
    </section>}
  </div>;
}
