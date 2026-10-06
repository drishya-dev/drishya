import { useEffect, useState } from 'react';
import type { DiscoveredSource, RecordingSummary } from '@drishya/contracts';
import type { DiscoveryError } from '../api.ts';
import { useApp } from '../state.ts';
import { relTime } from './common.tsx';

const HARNESS_LABEL: Record<string, string> = { 'claude-code': 'Claude Code', codex: 'Codex' };

function byProject<T>(items: T[], rootOf: (item: T) => string | undefined): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const root = rootOf(item) || 'Unknown project';
    const group = groups.get(root) ?? [];
    group.push(item);
    groups.set(root, group);
  }
  return [...groups];
}

export function Home({ openDemo }: { openDemo: () => void }) {
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
  const [shownRecordings, setShownRecordings] = useState(60);
  const [shownSources, setShownSources] = useState(60);
  const [usage, setUsage] = useState<{ bytes: number; budgetBytes: number; overBudget: boolean }>();
  const resetShown = () => { setShownRecordings(60); setShownSources(60); };

  const refresh = async () => {
    if (!source) return;
    const [recordings, found, storage] = await Promise.all([source.recordings(), source.sources(), source.storage?.()]);
    if (useApp.getState().source !== source) return;
    set({ recordings }); setUsage(storage); setSources(found.sources); setSourceErrors(found.errors);
  };
  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
    let active = true;
    const stop = source?.subscribe(() => { void source.recordings().then((r) => { if (active) set({ recordings: r }); }).catch((e) => { if (active) setErr(e.message); }); });
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
      (!days || (time && Date.parse(time) >= Date.now() - days * 86_400_000));
  };
  const filteredRecordings = recordings.filter((r) => matches(r.title, r.workspaceRoot, r.harness, r.lastSourceTime ?? r.updatedAt));
  const filteredSources = (sources ?? []).filter((s) => matches(s.title, s.cwd, s.harness, s.modifiedAt));

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="home">
      <header className="home-head">
        <div className="brand static">
          <span className="brand-mark" />
          Drishya
        </div>
        <span className="muted">See what your coding agents did — replayed on your own code. Observe only.</span>
        <button className="btn ghost" onClick={() => set({ settingsOpen: true })}>Settings</button>
      </header>
      {usage && <p className={usage.overBudget ? 'bad small' : 'muted small'}>Local store · {(usage.bytes / 1024 ** 3).toFixed(2)} GiB of {(usage.budgetBytes / 1024 ** 3).toFixed(0)} GiB advisory budget{usage.overBudget ? ' · budget exceeded' : ''}. Nothing is deleted automatically. Remove selected recordings with <code>drishya forget &lt;recording&gt;</code>.</p>}

      <div className="home-intro"><span className="home-kicker">YOUR LOCAL AGENT WORKSPACE</span><h1>See the work.<br />Know what changed.</h1><p>Choose a Claude Code or Codex session. Follow its captured source, changes and results, or return to earlier work at your own pace.</p><div className="home-intro-actions"><button className="btn primary" onClick={openDemo}>Explore the synthetic demo</button><button className="btn" disabled={!!busy} onClick={() => refresh().catch((e) => setErr(e.message))}>Refresh local sessions</button></div><div className="home-principles"><span>Local storage</span><span>Read-only observation</span><span>No telemetry</span></div></div>
      <div className="home-filters">
        <input className="filter" aria-label="Find a session" placeholder="Find by title or project" value={q} onChange={(e) => { setQ(e.target.value); resetShown(); }} />
        <select aria-label="Harness" value={harness} onChange={(e) => { setHarness(e.target.value); resetShown(); }}><option value="all">All harnesses</option><option value="claude-code">Claude Code</option><option value="codex">Codex</option></select>
        <select aria-label="Session age" value={days} onChange={(e) => { setDays(Number(e.target.value)); resetShown(); }}><option value={0}>Any date</option><option value={1}>Past day</option><option value={7}>Past week</option><option value={30}>Past month</option></select>
      </div>

      <div className="home-grid">
        <section>
          <div className="sec-head">
            <h2>Recordings</h2>
            {picked.length > 1 && (
              <button className="btn primary" onClick={() => ((location.hash = `#/r/${picked.join('+')}`), openRecording(picked.join('+')))}>
                Open {picked.length} together
              </button>
            )}
          </div>
          {recordings.length === 0 && <p className="muted">Nothing imported yet. Open a session from this machine, or try the demo.</p>}
          {recordings.length > 0 && filteredRecordings.length === 0 && <p className="muted">No imported recordings match these filters.</p>}
          <div className="rows">
            {byProject(filteredRecordings.slice(0, shownRecordings), (r) => r.workspaceRoot).map(([root, group]) => (
              <div className="project-group" key={root}>
                <div className="project-heading" title={root}>{root}</div>
                {group.map((r) => <RecordingRow key={r.id} r={r} picked={picked.includes(r.id)} onPick={() => toggle(r.id)} />)}
              </div>
            ))}
          </div>
          {filteredRecordings.length > shownRecordings && <button className="btn" onClick={() => setShownRecordings((n) => n + 60)}>Show more recordings · {filteredRecordings.length - shownRecordings} remaining</button>}
          <div className="demo-card">
            <div>
              <strong>Synthetic demo</strong>
              <div className="muted small">Claude Code fixes free orders at checkout, a subagent searches the tests, Codex reviews the change. Every byte is invented.</div>
            </div>
            <button className="btn" onClick={openDemo}>Open demo</button>
          </div>
        </section>

        <section>
          <div className="sec-head">
            <h2>Sessions on this machine</h2>
            <span className="muted small">{filteredSources.length} matching</span>
          </div>
          <p className="muted small">Read-only: Drishya copies what it needs into its own store and never changes these files. Secrets are redacted before anything is saved.</p>
          {err && <p className="bad">{err}</p>}
          {sourceErrors.map((e) => (
            <p key={e.adapterId} className="bad small">
              Could not read {HARNESS_LABEL[e.adapterId] ?? e.adapterId} sessions ({e.code === 'permission-denied' ? 'permission denied' : e.code}): {e.message}
            </p>
          ))}
          {!sources && <div className="skeleton tall" />}
          {sources && filteredSources.length === 0 && <p className="muted">{sources.length ? 'No sessions match these filters.' : 'No Claude Code or Codex journals were found in their standard local directories. Start a session in your harness, then refresh. For a journal stored elsewhere, use drishya import --help.'}</p>}
          <div className="rows">
            {byProject(filteredSources.slice(0, shownSources), (s) => s.cwd).map(([root, group]) => <div className="project-group" key={root}>
              <div className="project-heading" title={root}>{root}</div>
              {group.map((s) => (
              <div key={s.path} className="row source">
                <div className="row-main">
                  <div className="row-title">{s.title?.replace(/\s+/g, ' ') || 'Untitled session'}</div>
                  <div className="row-sub">
                    <span className={`harness h-${s.harness}`}>{HARNESS_LABEL[s.harness] ?? s.harness}</span>
                    <span>{s.cwd ?? ''}</span>
                    <span>{relTime(s.modifiedAt)}</span>
                    <span>{(s.bytes / 1024 / 1024).toFixed(1)} MB</span>
                    {s.companions.length > 0 && <span>{s.companions.length} subagent{s.companions.length === 1 ? '' : 's'}</span>}
                  </div>
                </div>
                <div className="row-actions">
                  <button className="btn" disabled={!!busy} onClick={() => open(s, false)}>{busy === s.path ? 'Importing…' : s.importedRecordingId ? 'Open' : 'Import'}</button>
                  <button className="btn ghost" disabled={!!busy} onClick={() => open(s, true)} title="Follow new activity as the agent works">Watch live</button>
                </div>
              </div>
              ))}
            </div>)}
          </div>
          {filteredSources.length > shownSources && <button className="btn" onClick={() => setShownSources((n) => n + 60)}>Show more sessions · {filteredSources.length - shownSources} remaining</button>}
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
      <input type="checkbox" checked={picked} onChange={onPick} aria-label="Select to open together" />
      <button className="row-main link" onClick={() => ((location.hash = `#/r/${r.id}`), openRecording(r.id))}>
        <div className="row-title">
          {r.title || 'Untitled'}
          <HealthTag r={r} />
          {r.privacyOutdated && <span className="tag warn" title="Imported under an older privacy policy. Forget it and import it again to apply the current redaction.">older privacy policy</span>}
        </div>
        <div className="row-sub">
          <span className={`harness h-${r.harness}`}>{HARNESS_LABEL[r.harness] ?? r.harness}</span>
          <span>{r.workspaceRoot ?? ''}</span>
          <span>{relTime(r.lastSourceTime ?? r.updatedAt)}</span>
          <span>{r.observationCount} observations</span>
        </div>
      </button>
    </div>
  );
}
