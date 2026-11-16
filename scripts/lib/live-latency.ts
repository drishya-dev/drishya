// LIVE-7: pure helpers for the live-latency benchmark and its guard test. No clock reads here: every
// time is an input, so the same numbers always give the same table.

interface LiveLatencyRunName {
  label: string;
  mode: string;
  harness: string;
  scenario: string;
  source?: string;
  mb?: string;
  stale?: boolean;
  resume?: boolean;
}

/** Keep the report's existing naming scheme, with CLI values confined to one file name. */
export function liveLatencyResultPath({ label, mode, harness, scenario, source, mb, stale, resume }: LiveLatencyRunName): string {
  const fields = { label, mode, harness, scenario, ...(source === undefined ? {} : { source }), ...(mb === undefined ? {} : { mb }) };
  for (const [flag, value] of Object.entries(fields)) {
    const invalid = flag === 'source' ? /[^a-z0-9_-]/i : /[^a-z0-9._+-]/i;
    if (!value || value === '.' || value === '..' || value.startsWith('--') || invalid.test(value)) {
      throw new Error(`--${flag} must be a portable filename component`);
    }
  }
  const name = `${label}-${mode}-${source ? 'real-' + source : harness}-${scenario}${stale ? '-stale' : resume ? '-resume' : ''}${mb ? `-${mb}mb` : ''}.json`;
  if (/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])\./i.test(name)) throw new Error('--label produces a reserved filename');
  if (name.length > 255) throw new Error('Benchmark result filename exceeds 255 characters');
  return `.local/live7/${name}`;
}

export type StepKind = 'prompt' | 'reasoning' | 'tool-start' | 'tool-result' | 'prose' | 'plan-or-question' | 'turn-end' | 'subagent-start' | 'other';

export interface StepObservation {
  rank: number;
  kind: string;
  /** The tool's name for a tool.call, when the payload carries one. */
  tool?: string;
}

/** Tool names that mean "a plan or a question for the person", across Claude Code and Codex. */
const PLAN_OR_QUESTION = /^(ExitPlanMode|AskUserQuestion|request_user_input|update_plan|plan|question)$/i;
const SUBAGENT = /^(Task|Agent|spawn_agent|delegate|subagent)$/i;

export function stepKind(o: StepObservation): StepKind {
  switch (o.kind) {
    case 'turn.start': case 'message.user': return 'prompt';
    case 'reasoning': return 'reasoning';
    case 'message.assistant': return 'prose';
    case 'tool.result': return 'tool-result';
    case 'turn.end': return 'turn-end';
    case 'agent.spawn': return 'subagent-start';
    case 'tool.call':
      if (o.tool && SUBAGENT.test(o.tool)) return 'subagent-start';
      if (o.tool && PLAN_OR_QUESTION.test(o.tool)) return 'plan-or-question';
      return 'tool-start';
    default: return 'other';
  }
}

/** Nearest-rank percentile; with few samples p95 is the maximum, which the table states. */
export function percentile(values: number[], p: number): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

/**
 * The first time a stream of counted marks reaches each rank: `marks` are (observationCount, at)
 * pairs in the order they happened; a mark with count N makes ranks 1..N visible.
 */
export function firstReach(marks: { count: number; at: number }[], ranks: number): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(ranks).fill(undefined);
  let reached = 0;
  for (const m of [...marks].sort((a, b) => a.at - b.at)) {
    const upto = Math.min(m.count, ranks);
    for (; reached < upto; reached++) out[reached] = m.at;
  }
  return out;
}

export interface StepLatency {
  rank: number;
  kind: StepKind;
  appendAt: number;
  committedAt?: number;
  noticeAt?: number;
  dataAt?: number;
  paintAt?: number;
}

export interface Summary { n: number; p50?: number; p95?: number; max?: number }

export function summarize(values: number[]): Summary {
  return { n: values.length, p50: percentile(values, 50), p95: percentile(values, 95), max: values.length ? Math.max(...values) : undefined };
}

/** End-to-end and per-stage milliseconds per step kind, only for steps that reached that stage. */
export function summarizeSteps(steps: StepLatency[]) {
  const kinds = [...new Set(steps.map(s => s.kind))].sort();
  const stages = {
    'append→commit': (s: StepLatency) => s.committedAt === undefined ? undefined : s.committedAt - s.appendAt,
    'commit→notice': (s: StepLatency) => s.committedAt === undefined || s.noticeAt === undefined ? undefined : s.noticeAt - s.committedAt,
    'notice→data': (s: StepLatency) => s.noticeAt === undefined || s.dataAt === undefined ? undefined : s.dataAt - s.noticeAt,
    'data→paint': (s: StepLatency) => s.dataAt === undefined || s.paintAt === undefined ? undefined : s.paintAt - s.dataAt,
    'append→paint': (s: StepLatency) => s.paintAt === undefined ? undefined : s.paintAt - s.appendAt,
  };
  const out: Record<string, Record<string, Summary>> = {};
  for (const kind of [...kinds, 'all'] as const) {
    const pool = kind === 'all' ? steps : steps.filter(s => s.kind === kind);
    out[kind] = Object.fromEntries(Object.entries(stages).map(([name, f]) => [name, summarize(pool.map(f).filter((v): v is number => v !== undefined))]));
  }
  return out;
}

/** Steps whose paint landed within `windowMs` of the previous distinct paint: they arrived in one render. */
export function groupByPaint(steps: StepLatency[], windowMs = 4): number[][] {
  const painted = steps.filter(s => s.paintAt !== undefined).sort((a, b) => a.paintAt! - b.paintAt! || a.rank - b.rank);
  const groups: number[][] = [];
  let lastAt = -Infinity;
  for (const s of painted) {
    if (s.paintAt! - lastAt <= windowMs && groups.length) groups[groups.length - 1]!.push(s.rank);
    else groups.push([s.rank]);
    lastAt = s.paintAt!;
  }
  return groups;
}
