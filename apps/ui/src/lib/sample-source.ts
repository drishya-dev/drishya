import { asOfProjection, type Projection, type ReplayBundle } from '@drishya/contracts';
import { bundleSource, type DataSource } from '../api.ts';

/** Published synthetic evidence only. Future results are excluded from every reader route. */
export function sampleProjection(full: Projection, step: number): Projection {
  if (step >= full.timeline.length) return full;
  const view = asOfProjection(full, step);
  const timeline = full.timeline.slice(0, Math.max(0, Math.floor(step)));
  const lastSequence = timeline.reduce((last, item) => Math.max(last, item.sequence), -1);
  const visibleAgents = new Set(timeline.map((item) => item.agentId));
  const stoppedAgents = new Set(timeline.filter((item) => item.type === 'agent-stop').map((item) => item.agentId));
  for (const op of view.operations) if (op.detail.kind === 'spawn' && op.detail.childAgentId) visibleAgents.add(op.detail.childAgentId);
  const operations = new Set(view.operations.map((op) => op.id));
  const prose = new Set(view.prose.map((item) => item.id));
  return {
    ...view, timeline, lastSequence,
    observationCount: new Set(timeline.map((item) => `${item.agentId}/${item.sequence}`)).size,
    agents: full.agents.filter((agent) => visibleAgents.has(agent.id)).map((agent) => ({ ...agent, lastSequence: timeline.filter((item) => item.agentId === agent.id).reduce((last, item) => Math.max(last, item.sequence), agent.firstSequence), stoppedSequence: stoppedAgents.has(agent.id) ? agent.stoppedSequence : undefined })),
    passages: full.passages.filter((passage) => passage.firstStep < timeline.length).map((passage) => ({ ...passage, lastStep: Math.min(passage.lastStep, timeline.length - 1), operationIds: passage.operationIds.filter((id) => operations.has(id)), proseIds: passage.proseIds.filter((id) => prose.has(id)) })),
    gaps: full.gaps.filter((gap) => timeline.some((item) => item.type === 'gap' && item.sequence === gap.sequence && item.reason === gap.reason)),
  };
}

/** A growing, explicitly synthetic fixture through the same subscription/reload path as live data.
 * Reader navigation never pauses publication. No source file, store or harness is involved. */
export function growingSample(bundle: ReplayBundle, interval = 1800): DataSource {
  let step = 1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<Parameters<DataSource['subscribe']>[0]>();
  const current = () => {
    const projection = sampleProjection(bundle.projection, step);
    return { ...bundle, projection, recording: { ...bundle.recording, live: step < bundle.projection.timeline.length, revision: step, observationCount: projection.observationCount } };
  };
  const notify = (added: number) => listeners.forEach((listener) => listener({ recordingId: bundle.recording.id, added, live: step < bundle.projection.timeline.length }));
  const schedule = () => {
    if (timer !== undefined || !listeners.size || step >= bundle.projection.timeline.length) return;
    timer = setTimeout(() => {
      timer = undefined;
      step++;
      notify(1);
      schedule();
    }, interval);
  };
  const base = bundleSource(bundle);
  return {
    ...base, sample: 'growing',
    recordings: async () => [current().recording],
    projection: async () => current().projection,
    artifact: async (id, artifactId, range) => {
      const view = current();
      if (!view.projection.artifacts.some((artifact) => artifact.id === artifactId)) throw new Error('This synthetic result has not arrived yet.');
      return bundleSource(view).artifact(id, artifactId, range);
    },
    search: async (id, query) => bundleSource(current()).search(id, query),
    verification: async (id, operationId) => bundleSource(current()).verification!(id, operationId),
    completeSample: () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      const remaining = bundle.projection.timeline.length - step;
      step = bundle.projection.timeline.length;
      if (remaining) notify(remaining);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      schedule();
      return () => {
        listeners.delete(listener);
        if (!listeners.size && timer !== undefined) { clearTimeout(timer); timer = undefined; }
      };
    },
  };
}
