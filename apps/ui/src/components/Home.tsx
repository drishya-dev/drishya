import { useEffect, useMemo, useState } from 'react';
import type { DiscoveredSource, RecordingSummary } from '@drishya/contracts';
import { useApp } from '../state.ts';
import { relTime } from './common.tsx';

const HARNESS_LABEL: Record<string, string> = { 'claude-code': 'Claude Code', codex: 'Codex' };

export function Home({ openDemo }: { openDemo: () => void }) {
  const source = useApp((s) => s.source);
  const recordings = useApp((s) => s.recordings);
  const set = useApp((s) => s.set);
  const openRecording = useApp((s) => s.openRecording);
  const [sources, setSources] = useState<DiscoveredSource[]>();
  const [busy, setBusy] = useState<string>();
  const [err, setErr] = useState<string>();
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState('');

  const refresh = async () => {
    if (!source) return;
    set({ recordings: await source.recordings() });
    setSources(await source.sources());
  };
  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
    return source?.subscribe(() => source.recordings().then((r) => set({ recordings: r })));
  }, [source]);

  const open = async (s: DiscoveredSource, live: boolean) => {
    if (!source) return;
    setBusy(s.path);
    setErr(undefined);
    try {
      const r = await source.importSource(s.path, s.adapterId, live);
      location.hash = `#/r/${r.recordingId}`;
      await openRecording(r.recordingId, { at: live ? 'end' : 0, play: false });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return (sources ?? []).filter((s) => !t || (s.title ?? '').toLowerCase().includes(t) || (s.cwd ?? '').toLowerCase().includes(t)).slice(0, 60);
  }, [sources, q]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="home">
      <header className="home-head">
        <div className="brand static">
          <span className="brand-mark" />
          Drishya
        </div>
        <span className="muted">See what your coding agents did — replayed on your own code. Observe only.</span>
      </header>

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
          <div className="rows">
            {recordings.map((r) => (
              <RecordingRow key={r.id} r={r} picked={picked.includes(r.id)} onPick={() => toggle(r.id)} />
            ))}
          </div>
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
            <input className="filter" placeholder="Filter by title or folder" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <p className="muted small">Read-only: Drishya copies what it needs into its own store and never changes these files. Secrets are redacted before anything is saved.</p>
          {err && <p className="bad">{err}</p>}
          {!sources && <div className="skeleton tall" />}
          <div className="rows">
            {filtered.map((s) => (
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
          </div>
        </section>
      </div>
    </div>
  );
}

function RecordingRow({ r, picked, onPick }: { r: RecordingSummary; picked: boolean; onPick: () => void }) {
  const openRecording = useApp((s) => s.openRecording);
  return (
    <div className="row">
      <input type="checkbox" checked={picked} onChange={onPick} aria-label="Select to open together" />
      <button className="row-main link" onClick={() => ((location.hash = `#/r/${r.id}`), openRecording(r.id))}>
        <div className="row-title">
          {r.title || 'Untitled'}
          {r.live && <span className="tag live">live</span>}
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
