import { useEffect, useMemo, useRef, useState } from 'react';
import type { Projection } from '@drishya/contracts';
import { compose, markers, stepOfObservation, stepOfOperation, type Scene } from '@drishya/scene';
import { changedPreview, type Explanation, type ModelPreview } from '../api.ts';
import { agentColor, agentName, KIND_LABEL } from '../lib/identity.ts';
import { setMotion, useApp } from '../state.ts';
import { Kbd, timeOf } from './common.tsx';
import { History } from './History.tsx';
import { ExplanationView, Inspector } from './Inspector.tsx';
import { HealthTag } from './Home.tsx';
import { MapCanvas } from './MapCanvas.tsx';

export function Viewer() {
  const projection = useApp((s) => s.projection);
  const graph = useApp((s) => s.graph);
  const step = useApp((s) => s.step);
  const filter = useApp((s) => s.filter);
  const selectedOp = useApp((s) => s.selectedOp);
  const explore = useApp((s) => s.explore);
  const motion = useApp((s) => s.motion);
  const main = useRef<HTMLDivElement>(null);
  const [reading, setReading] = useState<{ left: number; width: number }>();

  const scene = useMemo(() => (projection ? compose(projection, { step, filter, selectedOperationId: selectedOp }) : undefined), [projection, step, filter, selectedOp]);

  useEffect(() => {
    const el = main.current;
    if (!el) return;
    const measure = () => {
      const col = el.querySelector('.history-inner') as HTMLElement | null;
      if (!col) return;
      const a = el.getBoundingClientRect();
      const b = col.getBoundingClientRect();
      setReading({ left: b.left - a.left, width: b.width });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [projection]);

  if (!projection || !scene) return <div className="center muted">Loading recording…</div>;

  const arriving = scene.passages.flatMap((p) => p.ops).find((o) => o.phase === 'arriving' && o.origin.type === 'map');
  return (
    <div className={`viewer${motion ? '' : ' still'}${explore ? ' exploring' : ''}${selectedOp ? ' inspecting' : ''}`}>
      <Crown scene={scene} projection={projection} />
      <div className="main" ref={main}>
        <MapCanvas graph={graph} heat={scene.heat} arrivingPath={arriving?.origin.type === 'map' ? arriving.origin.path : undefined} readingRect={reading} />
        <Spine scene={scene} projection={projection} />
        <History scene={scene} projection={projection} />
        <FilePanel projection={projection} />
      </div>
      <Dock scene={scene} />
      <Transport scene={scene} projection={projection} />
      <Inspector projection={projection} />
      <Briefing projection={projection} />
      <Search projection={projection} />
    </div>
  );
}

// ─── crown: agents across the top ────────────────────────────────────────────────────────

function Crown({ scene, projection }: { scene: Scene; projection: Projection }) {
  const recording = useApp((s) => s.recording);
  const recordingId = useApp((s) => s.recordingId);
  const connection = useApp((s) => s.connection);
  const source = useApp((s) => s.source);
  const filter = useApp((s) => s.filter);
  const set = useApp((s) => s.set);
  const setFilter = useApp((s) => s.setFilter);
  const [live, setLive] = useState(recording?.live ?? false);
  useEffect(() => setLive(recording?.live ?? false), [recording?.live]);
  const exportUrl = recordingId ? source?.exportUrl(recordingId) : undefined;
  const single = recordingId && !recordingId.includes('+');

  return (
    <header className="crown">
      <button className="brand" onClick={() => source?.kind === 'daemon' && (set({ screen: 'home', playing: false }), (location.hash = ''))} title="All recordings">
        <span className="brand-mark" />
        Drishya
      </button>
      <div className="crown-title" title={projection.title}>
        {projection.title ?? recording?.title ?? 'Recording'}
        {source?.kind === 'bundle' && <span className="tag">replay</span>}
        {connection === 'reconnecting' && <span className="tag warn" role="status">reconnecting…</span>}
        {recording && recording.health?.state !== 'following' && recording.health?.state !== 'idle' && <HealthTag r={recording} />}
        {recording?.privacyOutdated && <span className="tag warn" title="Imported under an older privacy policy. Forget it and import it again to apply the current redaction.">older privacy policy</span>}
      </div>
      <div className="agents" role="list">
        {scene.agents.map((a) => {
          const agent = projection.agents.find((x) => x.id === a.id);
          const on = filter?.agentId === a.id;
          return (
            <button
              key={a.id}
              role="listitem"
              className={`agent st-${a.state}${on ? ' on' : ''}${a.parentId ? ' child' : ''}`}
              style={{ '--agent': agentColor(agent, projection.agents) } as React.CSSProperties}
              onClick={() => setFilter(on ? undefined : { agentId: a.id })}
              title={`${agentName(agent)} — ${a.state}${a.activeOperationIds.length ? `, ${a.activeOperationIds.length} call in flight` : ''}. Click to follow only this agent.`}
            >
              <span className="agent-dot" />
              {agentName(agent)}
              {a.state === 'active' && a.activeOperationIds.length > 0 && <span className="orbit" />}
            </button>
          );
        })}
      </div>
      <div className="crown-actions">
        <button className="btn ghost" onClick={() => set({ searchOpen: true })} title="Search (/)">Search</button>
        <button className="btn ghost" onClick={() => set({ briefingOpen: true })}>Briefing</button>
        {source?.kind === 'daemon' && single && (
          <button
            className={`btn ghost live${live ? ' on' : ''}`}
            onClick={async () => setLive(await source.setLive(recordingId!, !live))}
            title="Watch the session file for new activity. Observe only."
          >
            <span className="live-dot" />
            {live ? 'Live' : 'Watch live'}
          </button>
        )}
        {exportUrl && (
          <a className="btn ghost" href={exportUrl} download title="Download a sanitized replay bundle">
            Export
          </a>
        )}
      </div>
    </header>
  );
}

// ─── spine: this run's files, in the left gutter ─────────────────────────────────────────

function Spine({ scene, projection }: { scene: Scene; projection: Projection }) {
  const hovered = useApp((s) => s.hoveredPath);
  const set = useApp((s) => s.set);
  const heat = useMemo(() => new Map(scene.heat.map((h) => [h.path, h])), [scene.heat]);
  const files = projection.files.filter((f) => f.firstStep < scene.step);
  return (
    <nav className="spine" aria-label="Files in this run">
      <div className="spine-head">Files in this run</div>
      {files.length === 0 && <div className="muted small">None yet</div>}
      {files.map((f) => {
        const h = heat.get(f.path);
        const name = f.path.split('/').pop();
        const dir = f.path.slice(0, f.path.length - (name?.length ?? 0));
        return (
          <button
            key={f.path}
            className={`spine-file tone-${h?.tone ?? 'none'}${h?.edited ? ' edited' : ''}${hovered === f.path ? ' hover' : ''}`}
            style={{ '--heat': String(h?.heat ?? 0) } as React.CSSProperties}
            onMouseEnter={() => set({ hoveredPath: f.path })}
            onMouseLeave={() => set({ hoveredPath: undefined })}
            onClick={() => set({ filePanel: f.path })}
            title={f.path}
          >
            <span className="spine-dot" />
            <span className="spine-dir">{dir}</span>
            <span className="spine-name">{name}</span>
          </button>
        );
      })}
    </nav>
  );
}

function FilePanel({ projection }: { projection: Projection }) {
  const path = useApp((s) => s.filePanel);
  const set = useApp((s) => s.set);
  const seek = useApp((s) => s.seek);
  const select = useApp((s) => s.select);
  if (!path) return null;
  const ops = projection.operations.filter((o) => o.paths.some((p) => p.path === path));
  return (
    <div className="file-panel" role="dialog" aria-label={`Work on ${path}`}>
      <header>
        <code>{path}</code>
        <button className="icon-btn" onClick={() => set({ filePanel: undefined })} aria-label="Close">✕</button>
      </header>
      {ops.length === 0 && <p className="muted">This recording never touched this file.</p>}
      {ops.map((o) => (
        <button
          key={o.id}
          className="file-op"
          onClick={() => {
            const s = stepOfOperation(projection, o.id);
            if (useApp.getState().mode === 'replay' && s !== undefined) seek(s, { hold: true });
            select(o.id);
            set({ filePanel: undefined, explore: false });
          }}
        >
          <span className={`op-kind k-${o.origin.type === 'mcp' ? 'mcp' : o.kind}`}>{KIND_LABEL[o.kind]}</span>
          <span>{o.title}</span>
          <span className="muted">{o.paths.find((p) => p.path === path)?.role.replace('-', ' ')}</span>
        </button>
      ))}
    </div>
  );
}

// ─── dock: native instruments, then MCP servers by name ──────────────────────────────────

function Dock({ scene }: { scene: Scene }) {
  const filter = useApp((s) => s.filter);
  const setFilter = useApp((s) => s.setFilter);
  return (
    <aside className="dock" aria-label="Tools">
      <div className="dock-head">Tools</div>
      {scene.dock.native.map((d) => (
        <div key={d.key} className={`instrument k-${d.kind}${d.active ? ' active' : ''}${d.uses ? '' : ' unused'}`} title={`Harness tools: ${d.tools.join(', ')}`}>
          <span className={`op-kind k-${d.kind}`}>{KIND_LABEL[d.kind]}</span>
          <span className="inst-tools">{d.tools.join(' · ')}</span>
          <span className="inst-uses">{d.uses || ''}</span>
        </div>
      ))}
      {scene.dock.mcp.length > 0 && <div className="dock-head">MCP servers</div>}
      {scene.dock.mcp.map((s) => {
        const on = filter?.server === s.server;
        return (
          <div key={s.server} className={`server${s.open ? ' open' : ''}${on ? ' on' : ''}`}>
            <button className="server-name" onClick={() => setFilter(on ? undefined : { server: s.server })} title="Follow only this server's calls">
              <span className="server-dot" />
              {s.server}
            </button>
            <div className="drawer">
              {s.tools.map((t) => (
                <div key={t.tool} className={`server-tool${t.active ? ' active' : ''}${t.uses ? '' : ' unused'}`}>
                  <span>{t.tool}</span>
                  <span className="inst-uses">{t.uses || ''}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {filter && (
        <button className="btn ghost clear-filter" onClick={() => setFilter(undefined)}>
          Show everything <Kbd>Esc</Kbd>
        </button>
      )}
    </aside>
  );
}

// ─── transport: play, step, scrub ────────────────────────────────────────────────────────

function Transport({ scene, projection }: { scene: Scene; projection: Projection }) {
  const mode = useApp((s) => s.mode);
  const playing = useApp((s) => s.playing);
  const held = useApp((s) => s.held);
  const speed = useApp((s) => s.speed);
  const motion = useApp((s) => s.motion);
  const explore = useApp((s) => s.explore);
  const set = useApp((s) => s.set);
  const seek = useApp((s) => s.seek);
  const togglePlay = useApp((s) => s.togglePlay);
  const stepBy = useApp((s) => s.stepBy);
  const jump = useApp((s) => s.jump);
  const resume = useApp((s) => s.resume);
  const showHistory = useApp((s) => s.showHistory);
  const ms = useMemo(() => markers(projection).filter((m) => m.type !== 'prose'), [projection]);
  const strip = useRef<HTMLDivElement>(null);
  const total = Math.max(1, scene.total);
  const at = (clientX: number) => {
    const r = strip.current!.getBoundingClientRect();
    return Math.round(((clientX - r.left) / r.width) * total);
  };
  const cur = scene.current;
  if (mode === 'history') return (
    <footer className="transport history-transport">
      <span className="reading-status"><span className="reading-dot" /> History · {scene.total} recorded steps</span>
      <span className="muted small">Scroll to review. New work joins below.</span>
      <div className="transport-spacer" />
      <button className={`icon-btn txt${explore ? ' on' : ''}`} onClick={() => set({ explore: !explore })} title="Explore the map (X)">Map</button>
      <button className={`icon-btn txt${motion ? '' : ' on'}`} onClick={() => setMotion(!motion)} title="Motion (M)">{motion ? 'Motion' : 'Still'}</button>
      <button className="btn ghost" onClick={togglePlay}>Replay sequence</button>
    </footer>
  );
  return (
    <footer className="transport">
      <button className="btn ghost" onClick={showHistory} title="Show all recorded work">← History</button>
      <div className="t-controls">
        <button className="icon-btn" onClick={() => stepBy(-1)} aria-label="Step back" title="Step back (←)">‹</button>
        <button className="play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} title="Play / pause (Space)">
          {playing ? '❚❚' : '▶'}
        </button>
        <button className="icon-btn" onClick={() => stepBy(1)} aria-label="Step forward" title="Step forward (→)">›</button>
        <select className="speed" value={speed} onChange={(e) => set({ speed: Number(e.target.value) })} aria-label="Speed">
          {[0.5, 1, 1.5, 2, 4].map((s) => (
            <option key={s} value={s}>{s}×</option>
          ))}
        </select>
      </div>
      <div
        className="filmstrip"
        ref={strip}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          seek(at(e.clientX), { hold: true });
        }}
        onPointerMove={(e) => e.buttons === 1 && seek(at(e.clientX), { hold: true })}
        role="slider"
        aria-label="Timeline"
        aria-valuemin={0}
        aria-valuemax={scene.total}
        aria-valuenow={scene.step}
        tabIndex={0}
      >
        <div className="fs-track" />
        <div className="fs-done" style={{ width: `${(scene.step / total) * 100}%` }} />
        {ms.map((m, i) => (
          <span key={i} className={`mk k-${m.type}`} style={{ left: `${(m.step / total) * 100}%` }} title={`${m.type}: ${m.label}`} />
        ))}
        <div className="fs-head" style={{ left: `${(scene.step / total) * 100}%` }} />
      </div>
      <div className="t-info">
        {held && !playing ? (
          <button className="held" onClick={resume}>Held · resume</button>
        ) : (
          <span className="muted">
            {scene.step} / {scene.total}
            {cur?.time ? ` · ${timeOf(cur.time)}` : ''}
          </span>
        )}
        <button className="icon-btn txt" onClick={() => jump(['edit'])} title="Next edit (E)">E</button>
        <button className="icon-btn txt" onClick={() => jump(['fail'])} title="Next failure (F)">F</button>
        <button className={`icon-btn txt${explore ? ' on' : ''}`} onClick={() => set({ explore: !explore })} title="Explore the map (X)">Map</button>
        <button className={`icon-btn txt${motion ? '' : ' on'}`} onClick={() => setMotion(!motion)} title="Motion (M)">{motion ? 'Motion' : 'Still'}</button>
      </div>
    </footer>
  );
}

// ─── briefing: "while you were away" ─────────────────────────────────────────────────────

function Briefing({ projection }: { projection: Projection }) {
  const open = useApp((s) => s.briefingOpen);
  const source = useApp((s) => s.source);
  const config = useApp((s) => s.config);
  const recordingId = useApp((s) => s.recordingId);
  const step = useApp((s) => s.step);
  const set = useApp((s) => s.set);
  const [range, setRange] = useState<'all' | 'since'>('all');
  const [preview, setPreview] = useState<ModelPreview>();
  // The range the preview was built for; a send uses it, not wherever playback has moved since.
  const [previewFrom, setPreviewFrom] = useState<number>();
  const [result, setResult] = useState<Explanation>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const from = range === 'since' ? step : undefined;

  useEffect(() => {
    if (!open || source?.kind !== 'daemon' || !recordingId) return;
    setErr(undefined);
    source.briefing(recordingId, { from }).then((r) => {
      setPreview(r.preview);
      setPreviewFrom(from);
      setResult(r.cached);
    }).catch((e) => setErr(e.message));
  }, [open, range, recordingId, source]);

  if (!open) return null;
  const counts = summarize(projection, from ?? 0);
  return (
    <div className="sheet" role="dialog" aria-label="Briefing">
      <header>
        <h3>Briefing</h3>
        <button className="icon-btn" onClick={() => set({ briefingOpen: false })} aria-label="Close">✕</button>
      </header>
      <div className="seg">
        <button className={range === 'all' ? 'on' : ''} onClick={() => setRange('all')}>Whole recording</button>
        <button className={range === 'since' ? 'on' : ''} onClick={() => setRange('since')}>Since step {step}</button>
      </div>
      <div className="facts">
        <p className="muted small">Captured facts — counted directly from the recording.</p>
        <ul>
          <li>{counts.edits} file{counts.edits === 1 ? '' : 's'} changed: {counts.editedFiles.slice(0, 6).join(', ')}{counts.editedFiles.length > 6 ? '…' : ''}</li>
          <li>{counts.tests} test run{counts.tests === 1 ? '' : 's'} — last: {counts.lastTest ?? 'none'}</li>
          <li>{counts.errors} failed operation{counts.errors === 1 ? '' : 's'}</li>
          <li>{counts.agents} agent{counts.agents === 1 ? '' : 's'} active</li>
        </ul>
      </div>
      {source?.kind === 'daemon' ? (
        <>
          {result && <ExplanationView r={result} />}
          {preview && (
            <div className="consent">
              <div>
                A generated briefing sends <strong>{preview.items}</strong> redacted items ({Math.round(preview.chars / 1000)}k characters) to <code>{preview.model}</code>.
              </div>
              {config?.llm.configured ? (
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setErr(undefined);
                    try {
                      setResult((await source.briefing(recordingId!, { from: previewFrom }, preview.digest)).result);
                    } catch (e) {
                      const fresh = changedPreview(e);
                      if (fresh) setPreview(fresh);
                      setErr((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Waiting for Nemotron…' : result ? 'Regenerate' : 'Write briefing with Nemotron'}
                </button>
              ) : (
                <span className="muted">Set <code>NEBIUS_API_KEY</code> to enable generated briefings.</span>
              )}
            </div>
          )}
          {err && <p className="bad">{err}</p>}
        </>
      ) : (
        <p className="muted small">Generated briefings run only in the local app.</p>
      )}
    </div>
  );
}

function summarize(p: Projection, from: number) {
  const inRange = (s: number) => s >= from;
  const edits = p.operations.filter((o) => (o.kind === 'edit' || o.kind === 'write') && o.status === 'ok' && inRange(o.startSequence));
  const tests = p.operations.filter((o) => o.kind === 'test' && inRange(o.startSequence));
  const last = tests.at(-1);
  const lastTest = last?.detail.kind === 'test' ? (last.detail.summary ? `${last.detail.summary.passed} passed, ${last.detail.summary.failed} failed` : last.status) : undefined;
  return {
    edits: new Set(edits.flatMap((e) => e.paths.map((x) => x.path))).size,
    editedFiles: [...new Set(edits.flatMap((e) => e.paths.map((x) => x.path)))],
    tests: tests.length,
    lastTest,
    errors: p.operations.filter((o) => o.status === 'error' && inRange(o.startSequence)).length,
    agents: new Set(p.operations.filter((o) => inRange(o.startSequence)).map((o) => o.agentId)).size,
  };
}

// ─── search ──────────────────────────────────────────────────────────────────────────────

function Search({ projection }: { projection: Projection }) {
  const open = useApp((s) => s.searchOpen);
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const set = useApp((s) => s.set);
  const seek = useApp((s) => s.seek);
  const select = useApp((s) => s.select);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ observationId: string; snippet: string }[]>([]);
  useEffect(() => {
    if (!open || !source || !recordingId || q.trim().length < 2) return setHits([]);
    const t = setTimeout(() => source.search(recordingId, q).then(setHits).catch(() => setHits([])), 160);
    return () => clearTimeout(t);
  }, [q, open, source, recordingId]);
  if (!open) return null;
  const go = (obs: string) => {
    const s = stepOfObservation(projection, obs);
    if (useApp.getState().mode === 'replay' && s !== undefined) seek(s, { hold: true });
    else set({ focusObservationId: obs, follow: false });
    const op = projection.operations.find((o) => o.observationIds.includes(obs));
    if (op) select(op.id);
    else select(undefined);
    set({ searchOpen: false });
  };
  return (
    <div className="search" role="dialog" aria-label="Search this recording">
      <input autoFocus placeholder="Search prose, commands, paths…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && set({ searchOpen: false })} />
      <div className="search-results">
        {hits.map((h, i) => (
          <button key={i} onClick={() => go(h.observationId)}>
            {h.snippet.split(/[«»]/).map((part, j) => (j % 2 ? <mark key={j}>{part}</mark> : part))}
          </button>
        ))}
        {q.trim().length >= 2 && hits.length === 0 && <div className="muted">No matches</div>}
      </div>
    </div>
  );
}
