import { BrandMark } from './BrandMark.tsx';
import { useEffect, useState } from 'react';
import type { DiscoveredSource, RecordingSummary } from '@drishya/contracts';
import type { DiscoveryError } from '../api.ts';
import { useApp } from '../state.ts';
import { relTime } from './common.tsx';
import { localPreviewId } from '../lib/local-preview.ts';
import { SessionGroups } from './SessionGroups.tsx';
import { timestamp } from '../lib/home-groups.ts';

const HARNESS_LABEL: Record<string, string> = { 'claude-code': 'Claude Code', codex: 'Codex' };

export function Home({ openDemo }: { openDemo: (growing?: boolean) => void }) {
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
    const [recordings, found, storage] = await Promise.all([source.recordings(), source.sources(), source.storage?.()]);
    if (useApp.getState().source !== source) return;
    setNow(new Date());
    setErr(undefined);
    set({ recordings }); setUsage(storage); setSources(found.sources); setSourceErrors(found.errors);
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

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="home">
      <header className="home-head">
        <div className="brand static">
          <BrandMark />
          Drishya
        </div>
        <span className="muted">See your coding agents work on your own code. Connect a native session when you want to continue.</span>
        <button className="btn ghost" onClick={() => set({ settingsOpen: true })}>Settings</button>
      </header>
      {usage && <p className={usage.overBudget ? 'bad small' : 'muted small'}>Local store · {(usage.bytes / 1024 ** 3).toFixed(2)} GiB of {(usage.budgetBytes / 1024 ** 3).toFixed(0)} GiB advisory budget{usage.overBudget ? ' · budget exceeded' : ''}. Nothing is deleted automatically. Remove selected recordings with <code>drishya forget &lt;recording&gt;</code>.</p>}

      <div className="home-intro"><span className="home-kicker">YOUR LOCAL AGENT WORKSPACE</span><h1>See the work.<br />Know what changed.</h1><p>Choose a Claude Code or Codex session. Follow its captured source, changes and results, or return to earlier work at your own pace.</p><div className="home-intro-actions"><button className="btn primary" onClick={() => openDemo(true)}>Watch the live demo</button><button className="btn" onClick={() => openDemo()}>Explore the synthetic demo</button><button className="btn" disabled={!!busy} onClick={() => refresh().catch((e) => setErr(e.message))}>Refresh local sessions</button></div><div className="home-principles"><span>Local storage</span><span>Read-only observation</span><span>No telemetry</span></div></div>
      {!preview && new URLSearchParams(location.search).get('demo') === 'local' && <p className="notice">Choose a local recording, then use More → Use this session as local preview. A missing or deleted recording is never replaced with a synthetic conversation.</p>}
      {preview && <div className="local-preview-card"><strong>Your local preview</strong><span>{preview.title ?? 'Selected recording'}</span><button className="btn" onClick={() => { location.hash = `#/r/${preview.id}`; void openRecording(preview.id); }}>Open real recording</button><small>Already-redacted local evidence. Nothing is published or copied into the synthetic sample.</small></div>}
      <div className="home-filters">
        <input className="filter" aria-label="Find a session" placeholder="Find by title or project" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Harness" value={harness} onChange={(e) => setHarness(e.target.value)}><option value="all">All harnesses</option><option value="claude-code">Claude Code</option><option value="codex">Codex</option></select>
        <select aria-label="Session age" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={0}>Any date</option><option value={1}>Past day</option><option value={7}>Past week</option><option value={30}>Past month</option></select>
      </div>

      <div className="home-grid">
        <section>
          <div className="sec-head">
            <h2>Recordings</h2>
            <span className="muted small">{filteredRecordings.length} matching · {picked.length} selected</span>
            {picked.length > 1 && (
              <button className="btn primary" onClick={() => ((location.hash = `#/r/${picked.join('+')}`), openRecording(picked.join('+')))}>
                Open {picked.length} together
              </button>
            )}
          </div>
          {recordings.length === 0 && <p className="muted">Nothing imported yet. Open a session from this machine, or try the demo.</p>}
          {recordings.length > 0 && filteredRecordings.length === 0 && <p className="muted">No imported recordings match these filters.</p>}
          <SessionGroups key={`recordings:${q}:${harness}:${days}`} items={filteredRecordings} rootOf={r => r.workspaceRoot} timeOf={r => r.lastSourceTime} now={now} render={r => <RecordingRow key={r.id} r={r} picked={picked.includes(r.id)} onPick={() => toggle(r.id)} />} />
          <div className="demo-card">
            <div>
              <strong>Synthetic demo</strong>
              <div className="muted small">Claude Code fixes free orders at checkout, a subagent searches the tests, Codex reviews the change. Every byte is invented.</div>
            </div>
            <button className="btn" onClick={() => openDemo()}>Open demo</button>
          </div>
        </section>

        <section>
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
        </section>
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
