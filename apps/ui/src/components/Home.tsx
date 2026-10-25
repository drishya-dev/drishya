import { BrandMark } from './BrandMark.tsx';
import { useEffect, useState } from 'react';
import type { DiscoveredSource, RecordingSummary } from '@drishya/contracts';
import type { DiscoveryError } from '../api.ts';
import { useApp } from '../state.ts';
import { relTime } from './common.tsx';
import { localPreviewId } from '../lib/local-preview.ts';
import { SessionGroups } from './SessionGroups.tsx';
import { timestamp } from '../lib/home-groups.ts';
import { InterfaceGlyph } from './InterfaceGlyph.tsx';
import { ModernSessions } from '../modern/ModernSessions.tsx';
import { SettingsGlyph } from './SettingsGlyph.tsx';
import { SessionHome } from '../modern/SessionHome.tsx';

const HARNESS_LABEL: Record<string, string> = { 'claude-code': 'Claude Code', codex: 'Codex' };

export function Home({ openDemo }: { openDemo: (growing?: boolean) => void }) {
  const modern = document.documentElement.dataset.uiVersion === 'modern';
  const source = useApp((s) => s.source);
  const recordings = useApp((s) => s.recordings);
  const set = useApp((s) => s.set);
  const openRecording = useApp((s) => s.openRecording);
  const [sources, setSources] = useState<DiscoveredSource[]>();
  const [sourceErrors, setSourceErrors] = useState<DiscoveryError[]>([]);
  const [busy, setBusy] = useState<string>();
  const [err, setErr] = useState<string>();
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [harness, setHarness] = useState('all');
  const [days, setDays] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [usage, setUsage] = useState<{ bytes: number; budgetBytes: number; overBudget: boolean }>();
  const preview = recordings.find(r => r.id === localPreviewId());

  useEffect(() => {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(() => setNow(new Date()), Math.max(1, midnight.getTime() - Date.now()));
    const visible = () => { if (document.visibilityState === 'visible') setNow(new Date()); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, [now]);

  const refresh = async () => {
    if (!source) return;
    const [recordings, found, storage] = await Promise.allSettled([source.recordings(), source.sources(), source.storage?.()]);
    if (useApp.getState().source !== source) return;
    setNow(new Date());
    const errors:string[]=[];
    if(recordings.status==='fulfilled')set({recordings:recordings.value});else errors.push(`Captured sessions: ${recordings.reason.message}`);
    if(found.status==='fulfilled'){setSources(found.value.sources);setSourceErrors(found.value.errors);}else errors.push(`Local discovery: ${found.reason.message}`);
    if(storage.status==='fulfilled')setUsage(storage.value);else errors.push(`Storage information: ${storage.reason.message}`);
    setErr(errors.join(' · ')||undefined);
  };
  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
    let active = true;
    const stop = source?.subscribe(() => { void source.recordings().then((r) => { if (active && useApp.getState().source === source) set({ recordings: r }); }).catch((e) => { if (active && useApp.getState().source === source) setErr(e.message); }); });
    return () => { active = false; stop?.(); };
  }, [source]);

  const open = async (s: DiscoveredSource, live: boolean) => {
    if (!source) return;
    setBusy(s.path);
    setErr(undefined);
    try {
      const r = await source.importSource(s.path, s.adapterId, live);
      location.hash = `#/r/${r.recordingId}`;
      await openRecording(r.recordingId);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  const matches = (title: string | undefined, root: string | undefined, adapter: string, time: string | undefined) => {
    const t = q.toLowerCase();
    return (harness === 'all' || adapter === harness) &&
      (!t || `${title ?? ''} ${root ?? ''}`.toLowerCase().includes(t)) &&
      (!days || (timestamp(time) !== undefined && timestamp(time)! >= now.getTime() - days * 86_400_000));
  };
  const filteredRecordings = recordings.filter((r) => matches(r.title, r.workspaceRoot, r.harness, r.lastSourceTime));
  const filteredSources = (sources ?? []).filter((s) => matches(s.title, s.cwd, s.harness, s.modifiedAt));

  const importedIds = new Set(recordings.map(r => r.id));
  const newSources = (sources ?? []).filter(s => !s.importedRecordingId || !importedIds.has(s.importedRecordingId));
  const sessionCount = modern ? recordings.length + newSources.length : recordings.length;
  const matchingCount = modern ? filteredRecordings.length + filteredSources.filter(s => !s.importedRecordingId || !importedIds.has(s.importedRecordingId)).length : filteredRecordings.length;

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  if(modern)return <SessionHome recordings={recordings} sources={sources} now={now} busy={busy} error={[err,...sourceErrors.map(e=>`${HARNESS_LABEL[e.adapterId]??e.adapterId}: ${e.message}`)].filter(Boolean).join(' · ')} refresh={()=>refresh().catch(e=>setErr(e.message))} openDemo={()=>openDemo(true)} onOpen={(session,live)=>void open(session,live)}/>;

  return (
    <div className="home">
      <header className="home-head">
        <div className="brand static">
          <BrandMark />
          Drishya
        </div>
        <span className="home-local"><InterfaceGlyph name="local" />Local workspace</span>
        <button className="btn ghost home-settings" onClick={() => set({ settingsOpen: true })}><SettingsGlyph />Settings</button>
      </header>
      <div className="home-intro">
        <div className="home-intro-copy"><h1>{modern ? 'Sessions' : 'Your agent workspace.'}</h1><p>Return to a session. Follow the source, changes and results.</p></div>
        <div className="home-intro-actions"><button className="btn" onClick={() => openDemo(true)}><InterfaceGlyph name="play" />Watch the live demo</button><button className="btn primary" disabled={!!busy} onClick={() => refresh().catch((e) => setErr(e.message))}><InterfaceGlyph name="refresh" />Refresh local sessions</button></div>
      </div>
      <div className="home-overview" aria-label="Local session inventory">
        <span><strong>{sessionCount}</strong> {modern ? 'session' : 'recording'}{sessionCount === 1 ? '' : 's'}</span>
        <span><i className="inventory-live" aria-hidden="true" /><strong>{recordings.filter(r => r.live).length}</strong> following</span>
        <span className="home-private">Stored on this machine · no telemetry</span>
      </div>
      {usage && <details className={`home-storage${usage.overBudget ? ' bad' : ''}`}><summary>Local store · {(usage.bytes / 1024 ** 3).toFixed(2)} GiB{usage.overBudget ? ' · advisory budget exceeded' : ''}</summary><p>{(usage.budgetBytes / 1024 ** 3).toFixed(0)} GiB advisory budget. Nothing is deleted automatically. Remove selected recordings with <code>drishya forget &lt;recording&gt;</code>.</p></details>}
      {!preview && new URLSearchParams(location.search).get('demo') === 'local' && <p className="notice">Choose a local recording, then use More → Use this session as local preview. A missing or deleted recording is never replaced with a synthetic conversation.</p>}
      {preview && <div className="local-preview-card"><strong>Your local preview</strong><span>{preview.title ?? 'Selected recording'}</span><button className="btn" onClick={() => { location.hash = `#/r/${preview.id}`; void openRecording(preview.id); }}>Open real recording</button><small>Already-redacted local evidence. Nothing is published or copied into the synthetic sample.</small></div>}
      <div className="home-filters">
        <label className="home-search"><InterfaceGlyph name="search" /><input className="filter" aria-label="Find a session" placeholder="Find by title or project" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select aria-label="Harness" value={harness} onChange={(e) => setHarness(e.target.value)}><option value="all">All harnesses</option><option value="claude-code">Claude Code</option><option value="codex">Codex</option></select>
        <select aria-label="Session age" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={0}>Any date</option><option value={1}>Past day</option><option value={7}>Past week</option><option value={30}>Past month</option></select>
      </div>

      <div className="home-grid">
        <section>
          <div className="sec-head">
            <h2>{modern ? 'All sessions' : 'Recordings'}</h2>
            <span className="muted small">{matchingCount} matching · {picked.length} selected</span>
            {picked.length > 1 && (
              <button className="btn primary" onClick={() => ((location.hash = `#/r/${picked.join('+')}`), openRecording(picked.join('+')))}>
                Open {picked.length} together
              </button>
            )}
          </div>
          {recordings.length === 0 && (!modern || sources?.length === 0) && <div className="home-empty"><InterfaceGlyph name="local" /><h3>Your work starts here.</h3><p>Nothing imported yet. Open a session from this machine, or try the demo.</p><button className="btn" onClick={() => openDemo()}>Explore the synthetic demo<InterfaceGlyph name="arrow" /></button></div>}
          {(!modern && recordings.length > 0 && filteredRecordings.length === 0 || modern && sessionCount > 0 && matchingCount === 0) && <p className="muted">{modern ? 'No sessions match these filters.' : 'No imported recordings match these filters.'}</p>}
          {modern ? <><p className="modern-sessions-note">Open captured work or continue a local harness session. Your workspace and date keep everything together.</p>{err && <p role="alert" className="bad">{err}</p>}{sourceErrors.map(e => <p key={e.adapterId} className="bad small">{e.adapterId}: {e.message}</p>)}<ModernSessions recordings={filteredRecordings} sources={filteredSources} now={now} busy={busy} renderRecording={r => <RecordingRow key={r.id} r={r} picked={picked.includes(r.id)} onPick={() => toggle(r.id)} />} onOpen={s => void open(s, true)} />{!sources && !err && <p role="status" className="muted small">Finding local sessions…</p>}</> : <>
          <SessionGroups key={`recordings:${q}:${harness}:${days}`} items={filteredRecordings} rootOf={r => r.workspaceRoot} timeOf={r => r.lastSourceTime} now={now} render={r => <RecordingRow key={r.id} r={r} picked={picked.includes(r.id)} onPick={() => toggle(r.id)} />} /></>}

          <div className="demo-card">
            <div>
              <strong>Synthetic demo</strong>
              <div className="muted small">Claude Code fixes free orders at checkout, a subagent searches the tests, Codex reviews the change. Every byte is invented.</div>
            </div>
            <button className="btn ghost" onClick={() => openDemo()}>Open demo<InterfaceGlyph name="arrow" /></button>
          </div>
        </section>

        {!modern && <section id="local-session-import">
          <div className="sec-head">
            <h2>Sessions on this machine</h2>
            <span className="muted small" role="status">{sources ? `${filteredSources.length} matching` : err ? 'Discovery unavailable' : 'Finding local sessions…'}</span>
          </div>
          <p className="muted small">Read-only: Drishya copies what it needs into its own store and never changes these files. Secrets are redacted before anything is saved.</p>
          {err && <p className="bad">{err}</p>}
          {sourceErrors.map((e) => (
            <p key={e.adapterId} className="bad small">
              Could not read {HARNESS_LABEL[e.adapterId] ?? e.adapterId} sessions ({e.code === 'permission-denied' ? 'permission denied' : e.code}): {e.message}
            </p>
          ))}
          {!sources && !err && <div className="skeleton tall" role="status" aria-label="Finding local sessions" />}
          {sources && filteredSources.length === 0 && <p className="muted">{sources.length ? 'No sessions match these filters.' : 'No Claude Code or Codex journals were found in their standard local directories. Start a session in your harness, then refresh. For a journal stored elsewhere, use drishya import --help.'}</p>}
          <SessionGroups key={`sources:${q}:${harness}:${days}`} items={filteredSources} rootOf={s => s.cwd} timeOf={s => s.modifiedAt} now={now} render={s => (
              <div key={s.path} className="row source">
                <div className="row-main">
                  <div className="row-title">{s.title?.replace(/\s+/g, ' ') || 'Untitled session'}</div>
                  <div className="row-sub">
                    <span className={`harness h-${s.harness}`}>{HARNESS_LABEL[s.harness] ?? s.harness}</span>
                    <span>{s.cwd ?? ''}</span>
                    <span title="Journal modified time">{timestamp(s.modifiedAt) === undefined ? 'Time unavailable' : relTime(s.modifiedAt)}</span>
                    <span>{(s.bytes / 1024 / 1024).toFixed(1)} MB</span>
                    {s.companions.length > 0 && <span>{s.companions.length} subagent{s.companions.length === 1 ? '' : 's'}</span>}
                    {s.importedRecordingId && <span className="tag">Imported</span>}
                  </div>
                </div>
                <div className="row-actions">
                  <button className="btn" disabled={!!busy} onClick={() => open(s, false)}>{busy === s.path ? 'Importing…' : s.importedRecordingId ? 'Open' : 'Import'}</button>
                  <button className="btn ghost" disabled={!!busy} onClick={() => open(s, true)} title="Follow new activity as the agent works">Watch live</button>
                </div>
              </div>
              )} />
        </section>}
      </div>
    </div>
  );
}

/** Capture state when it needs attention or is live; nothing for an ordinary stopped recording. */
export function HealthTag({ r }: { r: RecordingSummary }) {
  const h = r.health;
  if (!h) return r.live ? <span className="tag live">live</span> : null;
  const label: Partial<Record<typeof h.state, string>> = { following: 'live', idle: 'live · idle', importing: 'importing', 'missing-source': 'journal missing', unsupported: 'unsupported', failed: 'read failed' };
  const text = label[h.state];
  if (!text) return null;
  const cls = h.state === 'following' || h.state === 'idle' ? 'live' : h.state === 'importing' ? '' : 'warn';
  return <span className={`tag ${cls}`} title={h.error?.message ?? (h.backlog ? 'Catching up on a backlog' : undefined)}>{text}{h.backlog ? ' · catching up' : ''}</span>;
}

function RecordingRow({ r, picked, onPick }: { r: RecordingSummary; picked: boolean; onPick: () => void }) {
  const openRecording = useApp((s) => s.openRecording);
  return (
    <div className="row">
      <input type="checkbox" checked={picked} onChange={onPick} aria-label={`Select ${r.title || 'Untitled'} to open together`} />
      <button className="row-main link" onClick={() => ((location.hash = `#/r/${r.id}`), openRecording(r.id))}>
        <div className="row-title">
          {r.title || 'Untitled'}
          <HealthTag r={r} />
          {r.privacyOutdated && <span className="tag warn" title="Imported under an older privacy policy. Forget it and import it again to apply the current redaction.">older privacy policy</span>}
        </div>
        <div className="row-sub">
          <span className={`harness h-${r.harness}`}>{HARNESS_LABEL[r.harness] ?? r.harness}</span>
          <span>{r.workspaceRoot ?? ''}</span>
          <span title="Last captured source time">{timestamp(r.lastSourceTime) === undefined ? 'Time unavailable' : relTime(r.lastSourceTime)}</span>
          <span>{r.observationCount} observations</span>
        </div>
      </button>
    </div>
  );
}
