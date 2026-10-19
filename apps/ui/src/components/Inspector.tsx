import { ToolInput } from './ToolInput.tsx';
import { ToolOutput } from './ToolOutput.tsx';
import { useEffect, useMemo, useState } from 'react';
import type { EvidenceLink, Operation, Projection } from '@drishya/contracts';
import { stepOfOperation } from '@drishya/scene';
import { changedPreview, type Explanation, type ModelPreview } from '../api.ts';
import { agentColor, agentName, KIND_LABEL } from '../lib/identity.ts';
import { useApp } from '../state.ts';
import { Output, ProvenanceBadge, timeOf } from './common.tsx';
import { ArtifactReader, DiffReader } from './ArtifactReader.tsx';
import { summarizeInput } from './History.tsx';
import { VerificationPanel } from './Verification.tsx';
import { ReadingResize } from './ReadingResize.tsx';
import { EvidenceNavigation } from './EvidenceNavigation.tsx';
import { ReviewQuestionEditor } from './ReviewQuestions.tsx';
import {operationOutcome} from '../lib/operation-outcome.ts';
import {InvestigationActions} from './InvestigationActions.tsx';
import {SaveMoment} from './SavedMoments.tsx';

export function Inspector({ projection }: { projection: Projection }) {
  const width = useApp(s => s.inspectorWidth);
  const setWidth = (inspectorWidth: number) => useApp.setState({ inspectorWidth });
  const selected = useApp((s) => s.selectedOp);
  const developerWorkspace=useApp(s=>s.developerWorkspace);
  const selectedTab = useApp((s) => s.inspectorTab);
  const tab = selectedTab === 'explain' ? 'detail' : selectedTab;
  const set = useApp((s) => s.set);
  const select = useApp((s) => s.select);
  const op = projection.operations.find((o) => o.id === selected);
  if (!op||developerWorkspace) return null;
  const outcome=operationOutcome(op);
  const agent = projection.agents.find((a) => a.id === op.agentId);
  const links = projection.links.filter((l) => (l.from === op.id || l.to === op.id || op.observationIds.includes(l.from) || op.observationIds.includes(l.to)) && l.relation !== 'tool-result');

  return (
    <aside className="inspector" aria-label="Operation detail" style={{ '--agent': agentColor(agent, projection.agents), '--inspector-width': `${width}px` } as React.CSSProperties}>
      <ReadingResize value={width} minimum={360} maximum={1400} change={setWidth} reset={()=>setWidth(760)} label="Resize operation detail" fromRight />
      <header className="insp-head">
        <div className="insp-meta">
          {projection.agents.length > 1 && <><span className="agent-dot" /><span>{agentName(agent)}</span><span className="muted">·</span></>}
          <span className="muted">{op.origin.type === 'mcp' ? `${op.origin.server} (MCP)` : op.tool}</span>
          {op.startTime && <span className="muted">· {timeOf(op.startTime)}</span>}
        </div>
        <button className="icon-btn" onClick={() => select(undefined)} aria-label="Close">✕</button>
      </header>
      <h2 className="insp-title">
        <span className={`op-kind k-${op.origin.type === 'mcp' ? 'mcp' : op.kind}`}>{KIND_LABEL[op.kind]}</span> {op.title}
      </h2>
      <EvidenceNavigation />
      <div className="insp-status">
        <span className={`pill st-${outcome.tone}`} title={outcome.explanation}>{outcome.label}</span>
        <ProvenanceBadge p={op.classification} />
      </div>
      <nav className="tabs" role="tablist">
        {(['detail', 'evidence'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => set({ inspectorTab: t })}>
            {t === 'detail' ? 'Detail' : t === 'evidence' ? `Evidence${links.length ? ` · ${links.length}` : ''}` : 'Explain'}
          </button>
        ))}
      </nav>
      <div className="insp-body">
        {tab === 'detail' && <><Detail op={op} projection={projection} /><VerificationPanel op={op} /><SaveMoment op={op}/><InvestigationActions key={`investigate/${op.id}`} op={op}/><ReviewQuestionEditor key={op.id} op={op} /></>}
        {tab === 'evidence' && <Evidence op={op} links={links} projection={projection} />}

      </div>
    </aside>
  );
}

export function Detail({ op, projection }: { op: Operation; projection: Projection }) {
  const d = op.detail;
  const set = useApp((s) => s.set);
  const artifacts = projection.artifacts.filter((a) => op.artifactIds.includes(a.id));
  switch (d.kind) {
    case 'read': {
      const art = artifacts.find((a) => a.id === d.excerptArtifactId);
      return (
        <>
          <p className="insp-note">
            {art?.range ? `Captured lines ${art.range.start}–${art.range.end}` : `Read range from line ${d.startLine}${d.lineCount > 0 ? ` through ${d.startLine + d.lineCount - 1}` : ''}`} of <code className="md-path" onClick={() => set({ filePanel: d.path })}>{d.path}</code>.
            {art?.kind === 'excerpt' && ' Nothing outside this range is known for this moment.'}
          </p>
          {art && <ProvenanceBadge artifact={art} />}
          <ArtifactCode id={d.excerptArtifactId} start={d.startLine} path={d.path} />
        </>
      );
    }
    case 'edit': {
      const after = artifacts.find((a) => a.id.endsWith('_after'));
      return <EditDetail key={op.id} op={op} after={after?.id} afterProv={after} />;
    }
    case 'search':
      return (
        <>
          <p className="insp-note">
            <code>{d.query}</code> — {d.total ?? d.hits.length} result{(d.total ?? d.hits.length) === 1 ? '' : 's'}
            {d.total !== undefined && d.total > d.hits.length ? `, ${d.hits.length} shown` : ''}.
          </p>
          <div className="hit-list">
            {d.hits.map((h, i) => (
              <button key={i} className="hit-row" onMouseEnter={() => set({ hoveredPath: h.path })} onMouseLeave={() => set({ hoveredPath: undefined })} onClick={() => set({ filePanel: h.path })}>
                <span className="hit-path">{h.path}</span>
                {h.line !== undefined && <span className="hit-line">:{h.line}</span>}
                {h.text && <span className="hit-text">{h.text.trim()}</span>}
              </button>
            ))}
          </div>
        </>
      );
    case 'test': {
      const s = d.summary;
      return (
        <>
          <div className="cmd">$ {d.command}</div>
          <CapturedOutcomes output={d.outputPreview} fallback={s ? (
            <p className="insp-note">
              {s.framework}: <span className="bad">{s.failed} failed</span>, <span className="good">{s.passed} passed</span>
              {s.skipped ? `, ${s.skipped} skipped` : ''}. <span className="muted">Counts read from the runner's output (derived).</span>
            </p>
          ) : (
            <p className="insp-note">Exit code {d.exitCode ?? 'unknown'}. The output did not contain a summary Drishya recognises.</p>
          )} />
          {s?.failures.map((f, i) => (
            <div key={i} className="failure big">
              <div className="failure-name">{f.name}</div>
              {f.file && (
                <div className="muted">
                  {f.file}
                  {f.line ? `:${f.line}` : ''}
                </div>
              )}
              {f.message && <div className="failure-msg">{f.message}</div>}
            </div>
          ))}
          <OutputBlock artifactId={d.outputArtifactId} preview={d.outputPreview} />
        </>
      );
    }
    case 'shell':
      return (
        <>
          <pre className="cmd block">$ {d.command}</pre>
          {op.artifactIds.find((id) => id.endsWith('_input')) && <ArtifactReader id={op.artifactIds.find((id) => id.endsWith('_input'))} kind="code" />}
          <p className="insp-note">Exit code {d.exitCode ?? 'unknown'}</p>
          <CapturedOutcomes output={d.outputPreview} />
          <OutputBlock artifactId={d.outputArtifactId} preview={d.outputPreview} />
        </>
      );
    case 'mcp':
      return (
        <>
          <p className="insp-note">
            Called <code>{d.tool}</code> on the <strong>{d.server}</strong> MCP server.
          </p>
          <h4>Input</h4>
          <ToolInput value={d.input}/>
          <h4>Result</h4>
          <ToolOutput text={d.resultPreview || '—'}/>
        </>
      );
    case 'web':
      return (
        <>
          <p className="insp-note">{d.url ? <>Fetched <code>{d.url}</code></> : <>Searched the web for <code>{d.query}</code></>}</p>
          <ToolOutput text={d.resultPreview || '—'}/>
        </>
      );
    case 'spawn': {
      const child = projection.agents.find((a) => a.id === d.childAgentId);
      return (
        <>
          <p className="insp-note">
            Delegated to <strong>{d.agentType ?? 'a subagent'}</strong>: {d.description}
          </p>
          {child && (
            <button className="btn" onClick={() => useApp.getState().setFilter({ ...useApp.getState().filter, agentId: child.id })}>
              Follow {agentName(child)}'s work
            </button>
          )}
          <h4>Report returned</h4>
          <ToolOutput text={d.resultPreview || '—'}/>
        </>
      );
    }
    case 'plan':
      return (
        <ul className="plan big">
          {d.items.map((it, i) => (
            <li key={i} className={`plan-${it.status}`}>{it.text}</li>
          ))}
        </ul>
      );
    default:
      return (
        <>
          <h4>Input</h4>
          <ToolInput value={d.input}/>
          <h4>Result</h4>
          <ToolOutput text={d.resultPreview || '—'}/>
        </>
      );
  }
}

function EditDetail({ op, after, afterProv }: { op: Operation; after?: string; afterProv?: Projection['artifacts'][number] }) {
  const d = op.detail;
  if (d.kind !== 'edit') return null;
  return <>
    {d.hunks.length ? <DiffReader key={op.id} hunks={d.hunks} path={d.path} navigationKey={op.id} /> : after ? <>
      {afterProv && <ProvenanceBadge artifact={afterProv} />}
      {afterProv?.note && <p className="insp-note">{afterProv.note}</p>}
      <ArtifactCode id={after} path={d.path} />
    </> : <p className="muted">No patch or source bytes captured.</p>}
    {d.reconstruction !== 'complete' && d.reconstructionNote && <p className="insp-note muted">After-state unavailable: {d.reconstructionNote}</p>}
  </>;
}

function ArtifactCode({ id, start = 1, path }: { id?: string; start?: number; path?: string }) {
  return <ArtifactReader key={id} id={id} kind="code" startLine={start} path={path} />;
}

function OutputBlock({ artifactId, preview }: { artifactId?: string; preview?: string }) {
  if (!artifactId && !preview) return <p className="muted">No output captured.</p>;
  return <ArtifactReader key={artifactId} id={artifactId} kind="output" fallback={preview} />;
}

// ─── evidence links ──────────────────────────────────────────────────────────────────────

const RELATION: Record<string, string> = {
  'same-artifact': 'Same file',
  'explicit-reference': 'Named in the result',
  'test-reference': 'Named by the failing test',
  'test-outcome-change': 'Test outcome changed',
  'temporal-neighbor': 'Nearby in time',
  spawned: 'Started a subagent',
  'observed-write-overlap': 'Two agents wrote this file',
  'static-import': 'Imports',
};

function Evidence({ op, links, projection }: { op: Operation; links: EvidenceLink[]; projection: Projection }) {
  const historyPage = useApp((s) => s.historyPage);
  const seek = useApp((s) => s.seek);
  const select = useApp((s) => s.select);
  const go = (id: string) => {
    const reference = historyPage?.references[id];
    if (reference) {
      const state = useApp.getState();
      state.set({ selectedOp: id, held: true });
      void state.loadHistoryWindow({ selectedOperationId: id }).catch((error) => state.set({ error: error.message }));
      return;
    }
    const other = projection.operations.find((o) => o.id === id);
    if (!other) return;
    const s = stepOfOperation(projection, id);
    if (s !== undefined && useApp.getState().mode === 'replay') seek(s, { hold: true });
    select(id);
  };
  if (!links.length) return <p className="muted">No typed relationships recorded for this operation.</p>;
  return (
    <div className="links">
      <p className="insp-note muted">Every relationship states how it is known. "Nearby in time" is never a reason.</p>
      {links.map((l) => {
        const otherId = l.from === op.id || op.observationIds.includes(l.from) ? l.to : l.from;
        const other = projection.operations.find((o) => o.id === otherId);
        const reference = historyPage?.references[otherId];
        const prose = projection.prose.find((p) => p.id === otherId);
        return (
          <button key={l.id} className="link-row" onClick={() => go(otherId)} disabled={!other && !reference}>
            <span className={`rel rel-${l.basis}`}>{RELATION[l.relation] ?? l.relation}</span>
            <span className="link-target">{other ? other.title : reference ? reference.title : prose ? `“${prose.text.slice(0, 80)}…”` : otherId.replace(/^file:/, '')}</span>
            <span className="link-why">{l.explanation}</span>
            <span className="link-basis">{l.basis.replace(/-/g, ' ')}{l.ruleVersion ? ` · ${l.ruleVersion}` : ''}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── explanations (generated, opt-in, cited) ─────────────────────────────────────────────

function Explain({ op }: { op: Operation }) {
  const source = useApp((s) => s.source);
  const config = useApp((s) => s.config);
  const recordingId = useApp((s) => s.recordingId)!;
  const [preview, setPreview] = useState<ModelPreview>();
  const [result, setResult] = useState<Explanation>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [showSent, setShowSent] = useState(false);

  useEffect(() => {
    setPreview(undefined);
    setResult(undefined);
    setErr(undefined);
    if (source?.kind !== 'daemon') return;
    source
      .explain(recordingId, op.id)
      .then((r) => {
        setPreview(r.preview);
        if (r.cached) setResult(r.cached);
      })
      .catch((e) => setErr(e.message));
  }, [op.id, source, recordingId]);

  if (source?.kind !== 'daemon') return <p className="muted">Explanations need the local app (<code>drishya serve</code>) with a Nebius Token Factory key. Replay bundles never call a model.</p>;
  const send = async () => {
    if (!preview) return;
    setBusy(true);
    setErr(undefined);
    try {
      setResult((await source.explain(recordingId, op.id, preview.digest)).result);
    } catch (e) {
      // Refused because the evidence changed after review: show what would be sent now.
      const fresh = changedPreview(e);
      if (fresh) setPreview(fresh);
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="explain">
      {result ? (
        <ExplanationView r={result} />
      ) : (
        <p className="insp-note">
          Ask NVIDIA Nemotron to explain this {op.kind} from the captured evidence around it. Every claim must cite that evidence; uncited claims are removed. The answer is labelled as generated — it is never shown as something the agent said.
        </p>
      )}
      {preview && (
        <div className="consent">
          <div>
            {result ? 'Regenerate: ' : ''}Sends <strong>{preview.items}</strong> redacted evidence items ({Math.round(preview.chars / 1000)}k characters) to <code>{preview.model}</code> at <code>{new URL(preview.endpoint).host}</code>.
          </div>
          <div className="consent-actions">
            <button className="btn ghost" onClick={() => setShowSent((s) => !s)}>{showSent ? 'Hide' : 'Show'} exactly what is sent</button>
            {config?.llm.configured ? (
              <button className="btn primary" onClick={send} disabled={busy}>{busy ? 'Waiting for Nemotron…' : result ? 'Regenerate' : 'Explain with Nemotron'}</button>
            ) : (
              <span className="muted">Set <code>NEBIUS_API_KEY</code> and restart <code>drishya serve</code> to enable.</span>
            )}
          </div>
          {showSent && (
            <pre className="sent">{preview.messages.map((m) => `── ${m.role} ──\n${m.content}`).join('\n\n')}</pre>
          )}
        </div>
      )}
      {err && <p className="bad">{err}</p>}
    </div>
  );
}

export function ExplanationView({ r }: { r: Explanation }) {
  const seek = useApp((s) => s.seek);
  const select = useApp((s) => s.select);
  const jump = (e: Explanation['claims'][number]['evidence'][number]) => {
    seek(e.step, { hold: true });
    if (e.ref.type === 'operation' && e.ref.id) select(e.ref.id);
  };
  const cited = useMemo(() => new Set(r.claims.flatMap((c) => c.evidence.map((e) => e.key))), [r]);
  return (
    <div className="generated">
      <div className="gen-label">
        Generated by {r.provenance.generator} · from {r.evidenceCount} captured items · {cited.size} cited{r.droppedClaims ? ` · ${r.droppedClaims} uncited claim${r.droppedClaims === 1 ? '' : 's'} removed` : ''}
      </div>
      {r.summary && <p className="gen-summary">{r.summary.replace(/\s*\[E\d+\]/g, '')}</p>}
      <ul className="claims">
        {r.claims.map((c, i) => (
          <li key={i}>
            {c.text.replace(/\s*\[E\d+\]/g, '')}{' '}
            {c.evidence.map((e) => (
              <button key={e.key} className="cite" onClick={() => jump(e)} title={`Jump to step ${e.step}`}>
                {e.key}
              </button>
            ))}
          </li>
        ))}
      </ul>
      {r.unknowns.length > 0 && (
        <>
          <h4>Not established by the evidence</h4>
          <ul className="unknowns">
            {r.unknowns.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
import { CapturedOutcomes } from './CapturedOutcomes.tsx';
