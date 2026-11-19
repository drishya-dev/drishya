import { useEffect, useRef, useState } from 'react';
import { HttpError, type StorageUsage } from '../api.ts';
import { useApp } from '../state.ts';
import { workspaceMemory } from '../lib/workspace-memory.ts';
import { materialCache } from '../lib/artifact-cache.ts';
import { ReadingDialog } from './ProductShell.tsx';
import './storage-settings.css';

const bytes = (n: number) => n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KiB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MiB` : `${(n / 1024 ** 3).toFixed(2)} GiB`;
type Session = NonNullable<StorageUsage['sessions']>[number];

export function StorageSettings() {
  const source = useApp(s => s.source);
  const [usage, setUsage] = useState<StorageUsage>();
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [clearError, setClearError] = useState('');
  const [selected, setSelected] = useState<Session>();
  const [notice, setNotice] = useState('');
  const generation = useRef(0), refresh = useRef<HTMLButtonElement>(null);
  const load = async () => {
    if (source?.kind !== 'daemon' || !source.storage) return;
    const request = ++generation.current;
    setLoading(true); setError('');
    try { const result = await source.storage(true); if (request === generation.current) setUsage(result); }
    catch (e) { if (request === generation.current) setError((e as Error).message); }
    finally { if (request === generation.current) setLoading(false); }
  };
  useEffect(() => { void load(); return () => { generation.current++; }; }, [source]);
  const clear = async () => {
    if (!selected || !source || busy) return;
    const target = selected;
    setBusy(true); setClearError('');
    try {
      try { await source.forget(target.id); }
      catch (e) { if (!(e instanceof HttpError && e.status === 404)) throw e; }
      materialCache.forgetRecording(target.id);
      const state = useApp.getState();
      if (state.source === source) {
        const memory = workspaceMemory(source);
        for (const r of memory.snapshot().sessions) if (r.id.split('+').includes(target.id)) memory.clear(r.id);
        const current = state.recordingId?.split('+').includes(target.id);
        useApp.setState({ recordings: state.recordings.filter(r => r.id !== target.id),
          ...(state.resumeRecordingId?.split('+').includes(target.id) ? { resumeRecordingId: undefined } : {}),
          ...(current ? { screen: 'home', recordingId: undefined, recording: undefined, projection: undefined,
            historyPage: undefined, graph: undefined, playing: false, selectedOp: undefined, expandedOp: undefined,
            developerWorkspace: false, currentFile: undefined, filePanel: undefined } : {}) });
        if (current) location.hash = '#/';
      }
      setUsage(old => old && { ...old, sessions: old.sessions?.filter(s => s.id !== target.id) });
      setSelected(undefined); setNotice(`Cleared imported data for ${target.id.slice(0, 12)}.`);
      requestAnimationFrame(() => refresh.current?.focus());
      await load();
    } catch (e) { setClearError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="storage-settings" aria-busy={loading || busy}>
    <div className="storage-heading"><h3>Local storage</h3>{source?.kind === 'daemon' && <button ref={refresh} className="btn" disabled={loading || busy} onClick={() => void load()} aria-label="Refresh storage">{loading ? 'Measuring…' : 'Refresh'}</button>}</div>
    {source?.kind !== 'daemon' || !source.storage ? <p className="muted">Storage management is available in the local app. This replay bundle is read-only.</p> : <>
      {loading && !usage && <p role="status" className="muted">Measuring local storage…</p>}
      {error && <p role="alert">Storage could not be refreshed: {error}</p>}
      {notice && <p role="status" className="muted small">{notice}</p>}
      {usage && <>
        <p className="storage-total"><strong>{bytes(usage.bytes)}</strong><span>measured in Drishya’s local files</span></p>
        {usage.categories && <dl className="storage-categories">{Object.entries(usage.categories).map(([key, value]) => <div key={key}><dt>{({ captured: 'Captured files', derived: 'History cache', database: 'Database, WAL and SHM', other: 'Other files' } as Record<string, string>)[key]}</dt><dd>{bytes(value)}</dd></div>)}</dl>}
        <p className="muted small">{bytes(usage.budgetBytes)} advisory budget{usage.overBudget ? ' exceeded' : ''}. Nothing is deleted automatically. Clearing removes eligible files; SQLite retains reusable capacity, so disk use may not fall immediately.</p>
        <h4>Imported sessions</h4>
        <p className="muted small">Evidence size counts stored observation and projection JSON plus referenced captured files. Shared captured files count in each owner. Search indexes, database pages and history caches are shared overhead; these sizes do not add up to the disk total.</p>
        {usage.complete === false && <p role="status" className="muted small">Partial measurement: the scan reached its limit or sessions changed. Evidence sizes may be incomplete or out of date; refresh after capture settles.</p>}
        {!usage.sessions?.length ? <p className="muted">No imported sessions.</p> : <ul className="storage-sessions">{usage.sessions.map(session => <li className="storage-session" key={session.id}>
          <div><strong>{session.title || 'Untitled session'}</strong><small>{session.harness} · {session.id.slice(0, 12)}</small><span>{bytes(session.rowBytes + session.capturedBytes)} evidence{session.sharedCapturedBytes > 0 && ` · ${bytes(session.sharedCapturedBytes)} captured files shared`}</span></div>
          <button className="btn" disabled={busy || loading} onClick={() => { setSelected(session); setClearError(''); }}>Clear local data</button>
        </li>)}</ul>}
      </>}
    </>}
    {selected && <ReadingDialog title="Clear imported session?" className="storage-confirm" close={() => { if (!busy) setSelected(undefined); }}>
      <p><strong>{selected.title || 'Untitled session'}</strong><br /><span className="muted small">{selected.harness} · {selected.id.slice(0, 12)}</span></p>
      <p>Remove this session’s local imported observations, search entries and eligible cached files. Shared files still used by other sessions are kept.</p>
      <p className="muted">Native recordings remain available for reimport. Live following and this session’s native controller will stop.</p>
      {clearError && <p role="alert">{clearError}</p>}
      <div className="storage-confirm-actions"><button className="btn" data-dialog-focus disabled={busy} onClick={() => setSelected(undefined)}>Cancel</button><button className="btn" disabled={busy} onClick={() => void clear()}>{busy ? 'Clearing…' : 'Clear imported data'}</button></div>
    </ReadingDialog>}
  </section>;
}
