import type { Operation, OperationDetail, Projection } from './index.ts';

/** A read-only historical projection. Result fields and blobs exist only after op-end. */
export function asOfProjection(projection: Projection, requestedStep: number): Projection {
  const step = Math.max(0, Math.min(projection.timeline.length, Math.floor(requestedStep)));
  if (step === projection.timeline.length) return projection;
  const applied = projection.timeline.slice(0, step);
  const started = new Set(applied.filter((item) => item.type === 'op-start').map((item) => item.operationId));
  const ended = new Set(applied.filter((item) => item.type === 'op-end').map((item) => item.operationId));
  const proseIds = new Set(applied.filter((item) => item.type === 'prose').map((item) => item.proseId));
  const noticeIds = new Set(applied.filter((item) => item.type === 'notice').map((item) => item.noticeId));
  const parents = new Set(projection.operations.filter(op => started.has(op.id)).map(op => op.parentOperationId).filter(Boolean));
  const operations = projection.operations.filter((op) => started.has(op.id) || parents.has(op.id)).map((op) => op.resultVersions ? versionAt(op, step) : ended.has(op.id) || parents.has(op.id) && op.endSequence !== undefined && op.endSequence < step ? op : pending(op));
  const visibleArtifacts = new Set(operations.flatMap((op) => op.artifactIds));
  for (const id of proseIds) visibleArtifacts.add(`art_${id}_prose`);
  for (const item of applied) if (item.type === 'queue' && item.inputArtifactId) visibleArtifacts.add(item.inputArtifactId);
  const readings = projection.context?.readings.filter(p => p.availableAfterStep < step);
  const readingIds = new Set(readings?.map(p => p.id));
  const compactionSummaries = projection.compactionSummaries?.filter(s => s.availableAfterStep <= step);
  const summaryIds = new Set(compactionSummaries?.map(s => s.id));
  for (const summary of compactionSummaries ?? []) if (summary.artifactId) visibleArtifacts.add(summary.artifactId);
  const compactions = projection.compactions?.filter(c => c.step < step).map(c => ({ ...c,
    priorReadingId: readingIds.has(c.priorReadingId ?? '') ? c.priorReadingId : undefined,
    nextReadingId: readingIds.has(c.nextReadingId ?? '') ? c.nextReadingId : undefined,
    summaryId: summaryIds.has(c.summaryId ?? '') ? c.summaryId : undefined,
  }));
  const compactionIds = new Set(compactions?.map(c => c.id));
  const visibleEvidence = new Set([...operations.flatMap((op) => op.observationIds), ...projection.prose.filter((p) => proseIds.has(p.id)).flatMap((p) => p.observationIds)]);
  return {
    ...projection,
    // Accounting points do not own timeline steps. Whole-session totals are not historical evidence.
    usage: undefined,
    // Session metadata does not establish a branch history at replay steps.
    recordedBranch: undefined,
    context: readings?.length ? { readings, ...(new Set(readings.map(p => p.agentId)).size === 1 ? { latest: readings.at(-1) } : {}) } : undefined,
    compactions,
    compactionSummaries,
    passages: projection.passages.map(p => ({ ...p,
      ...(p.compactionIds ? { compactionIds: p.compactionIds.filter(id => compactionIds.has(id)) } : {}),
      ...(p.compactionSummaryIds ? { compactionSummaryIds: p.compactionSummaryIds.filter(id => summaryIds.has(id)) } : {}),
    })),
    // Turn timing, outcome and errors describe the finished turn: a past step must not show what came later.
    turns: undefined,
    // Antigravity child metadata can be observed after its parent's completed call.
    agents: projection.agents.filter(agent => agent.harness !== 'antigravity' || agent.firstSequence < step).map(agent => agent.harness === 'antigravity' && agent.stoppedSequence !== undefined && agent.stoppedSequence >= step ? { ...agent, stoppedSequence: undefined } : agent),
    operations,
    prose: projection.prose.filter((p) => proseIds.has(p.id)),
    gaps: projection.gaps.filter(g => g.sequence < step),
    ...(projection.notices ? { notices: projection.notices.filter((n) => noticeIds.has(n.id)) } : {}),
    // A tool listed after this step was not yet known to the agent.
    ...(projection.availableTools ? { availableTools: projection.availableTools.filter((t) => t.since <= step).map((t) => t.until !== undefined && t.until <= step ? t : { ...t, until: undefined }) } : {}),
    artifacts: projection.artifacts.filter((a) => visibleArtifacts.has(a.id)),
    links: projection.links.filter((link) => link.sourceObservationIds.every((id) => visibleEvidence.has(id))),
    files: projection.files.filter((f) => f.firstStep < step).map((f) => ({ ...f, lastStep: Math.min(f.lastStep, step - 1) })),
  };
}

function versionAt(op: Operation, step: number): Operation {
  const version = op.resultVersions?.filter(v => v.availableAfterStep <= step).at(-1);
  // Do not expose future snapshots through the historical response itself.
  const { resultVersions: _versions, ...base } = op;
  if (!version) return { ...pending(base), failure: undefined, run: undefined };
  const { availableAfterStep: _boundary, ...result } = version;
  return { ...base, ...result };
}

function pending(op: Operation): Operation {
  const detail = pendingDetail(op.detail);
    // Patch bodies and full command inputs are captured at invocation. Other artifacts are results, even if their
  // metadata mistakenly uses the call's sequence (for example originalFile on an edit).
  return {
    ...op,
    kind: op.kind === 'write' && detail.kind === 'edit' ? 'edit' : op.kind,
    title: detail.kind === 'read' ? `Read ${detail.path}` : detail.kind === 'edit' ? `Edit ${detail.path}` : op.title,
    status: 'running',
    endSequence: undefined,
    endTime: undefined,
    paths: op.paths.filter((path) => path.role !== 'search-hit' && path.role !== 'test').map((path) => ({ ...path, lines: undefined })),
    detail,
    artifactIds: op.artifactIds.filter((id) => id.endsWith('_patch') || id.endsWith('_input')),
    observationIds: op.observationIds.slice(0, 1),
  };
}

function pendingDetail(detail: OperationDetail): OperationDetail {
  switch (detail.kind) {
    case 'read': return { kind: 'read', path: detail.path, startLine: detail.startLine, lineCount: 0 };
    case 'search': return { kind: 'search', query: detail.query, mode: detail.mode, hits: [] };
    case 'edit': return { kind: 'edit', path: detail.path, hunks: [], created: false, reconstruction: 'unavailable' };
    case 'shell': return { kind: 'shell', command: detail.command };
    case 'test': return { kind: 'test', command: detail.command };
    case 'mcp': return { kind: 'mcp', server: detail.server, tool: detail.tool, input: detail.input };
    case 'web': return { kind: 'web', url: detail.url, query: detail.query };
    case 'spawn': return { kind: 'spawn', agentType: detail.agentType, description: detail.description };
    case 'plan': return { kind: 'plan', items: detail.scope || detail.document ? [] : detail.items, ...(detail.scope || detail.document ? { scope: detail.scope ?? 'pending-document' } : {}) };
    case 'other': return { kind: 'other', input: detail.input };
  }
}
