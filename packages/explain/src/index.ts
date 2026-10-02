// Generated explanations, anchored to captured evidence. Model output is DERIVED content
// (AGENTS.md constraint 4): every claim must cite evidence items we sent, uncited claims are
// dropped, and the result is labelled with the model that wrote it.
//
// Nothing here runs automatically. A call is an explicit user action that transfers redacted
// content to a remote model; `preview()` shows exactly what would be sent first.

import { createHash } from 'node:crypto';
import type { Operation, Projection, Prose } from '@drishya/contracts';
import { PRIVACY_POLICY_VERSION, redactText, sanitize } from '@drishya/privacy';

// x2: consent binds to a digest of the exact request; generated output is sanitized.
export const EXPLAIN_VERSION = 'x2';

export interface ModelConfig {
  baseUrl: string;
  apiKey?: string;
  /** Fast tier: short labels. */
  nanoModel: string;
  /** Long context: return briefings. */
  superModel: string;
  /** Deepest reasoning: explaining a change. Falls back to superModel. */
  ultraModel: string;
}

export function modelConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ModelConfig {
  return {
    baseUrl: (env.DRISHYA_LLM_BASE_URL ?? 'https://api.tokenfactory.nebius.com/v1').replace(/\/+$/, ''),
    apiKey: env.NEBIUS_API_KEY ?? env.DRISHYA_LLM_API_KEY,
    nanoModel: env.DRISHYA_MODEL_NANO ?? 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B',
    superModel: env.DRISHYA_MODEL_SUPER ?? 'nvidia/nemotron-3-super-120b-a12b',
    ultraModel: env.DRISHYA_MODEL_ULTRA ?? env.DRISHYA_MODEL_SUPER ?? 'nvidia/nemotron-3-super-120b-a12b',
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type Complete = (model: string, messages: ChatMessage[], opts: { maxTokens: number }) => Promise<string>;

/** OpenAI-compatible chat completion (Nebius Token Factory speaks this protocol). */
export function httpComplete(cfg: ModelConfig): Complete {
  return async (model, messages, opts) => {
    if (!cfg.apiKey) throw new Error('No model API key configured (set NEBIUS_API_KEY).');
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model, messages, max_tokens: opts.maxTokens, temperature: 0.2 }),
      signal: AbortSignal.timeout(120_000),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Model request failed (${res.status}): ${body.slice(0, 300)}`);
    const json = JSON.parse(body);
    const msg = json.choices?.[0]?.message;
    return String(msg?.content ?? '');
  };
}

export async function listModels(cfg: ModelConfig): Promise<string[]> {
  if (!cfg.apiKey) return [];
  const res = await fetch(`${cfg.baseUrl}/models`, { headers: { authorization: `Bearer ${cfg.apiKey}` }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Model list failed (${res.status})`);
  const json = (await res.json()) as { data?: { id: string }[] };
  return (json.data ?? []).map((m) => m.id).sort();
}

// ─── evidence ────────────────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  /** Short handle the model cites, e.g. "E3". */
  key: string;
  /** What in the recording it is. */
  ref: { type: 'operation'; id: string } | { type: 'prose'; id: string } | { type: 'turn'; step: number };
  observationIds: string[];
  step: number;
  label: string;
  text: string;
}

export interface EvidencePack {
  task: 'explain-operation' | 'briefing';
  items: EvidenceItem[];
  focusKey?: string;
  /** Total characters, for the "what will be sent" preview. */
  chars: number;
}

type ArtifactText = (artifactId: string) => string | undefined;

const MAX_ITEM = 6000;

function describeOp(op: Operation, art: ArtifactText): string {
  const d = op.detail;
  const lines: string[] = [`${op.title} [status: ${op.status}]`];
  switch (d.kind) {
    case 'edit':
      for (const h of d.hunks.slice(0, 8)) lines.push(`@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`, ...h.lines.slice(0, 80));
      break;
    case 'read': {
      const t = d.excerptArtifactId ? art(d.excerptArtifactId) : undefined;
      if (t) lines.push(`lines ${d.startLine}–${d.startLine + d.lineCount - 1}:`, t);
      break;
    }
    case 'search':
      lines.push(`query: ${d.query}`, ...d.hits.slice(0, 20).map((h) => `${h.path}${h.line ? ':' + h.line : ''}${h.text ? ' ' + h.text : ''}`));
      break;
    case 'test':
      lines.push(`command: ${d.command}`, `exit: ${d.exitCode ?? 'unknown'}`);
      if (d.summary) lines.push(`${d.summary.passed} passed, ${d.summary.failed} failed`, ...d.summary.failures.map((f) => `FAIL ${f.name}${f.file ? ` (${f.file}${f.line ? ':' + f.line : ''})` : ''}${f.message ? ': ' + f.message : ''}`));
      if (d.outputPreview) lines.push(d.outputPreview.slice(-2500));
      break;
    case 'shell':
      lines.push(`command: ${d.command}`, `exit: ${d.exitCode ?? 'unknown'}`);
      if (d.outputPreview) lines.push(d.outputPreview.slice(-2000));
      break;
    case 'mcp':
      lines.push(`${d.server}.${d.tool} input: ${JSON.stringify(d.input).slice(0, 800)}`);
      if (d.resultPreview) lines.push(d.resultPreview.slice(0, 2000));
      break;
    case 'web':
      lines.push(d.url ?? d.query ?? '');
      if (d.resultPreview) lines.push(d.resultPreview.slice(0, 1500));
      break;
    case 'spawn':
      lines.push(d.description ?? '');
      if (d.resultPreview) lines.push(d.resultPreview.slice(0, 1500));
      break;
    default:
      break;
  }
  return lines.join('\n');
}

function clipItem(s: string) {
  // Defense in depth: content is already redacted at ingest; redact again before it leaves.
  const r = redactText(s).text;
  return r.length > MAX_ITEM ? r.slice(0, MAX_ITEM) + '\n…[clipped]' : r;
}

function stepOf(p: Projection, opId: string) {
  const i = p.timeline.findIndex((t) => t.type === 'op-start' && t.operationId === opId);
  return i < 0 ? 0 : i + 1;
}

/**
 * Evidence for explaining one operation: the operation itself, then the same agent's recent
 * operations, prose and the prompt before it — the captured context available at that moment.
 * Nothing from after the operation is included except its own result.
 */
export function evidenceForOperation(p: Projection, operationId: string, art: ArtifactText, window = 14): EvidencePack {
  const op = p.operations.find((o) => o.id === operationId);
  if (!op) throw new Error('unknown operation');
  const at = stepOf(p, operationId);
  const items: EvidenceItem[] = [];
  let n = 1;
  const add = (it: Omit<EvidenceItem, 'key'>) => items.push({ ...it, key: `E${n++}` });

  const prompt = p.timeline.slice(0, at).filter((t) => t.type === 'turn').at(-1);
  if (prompt && prompt.type === 'turn') add({ ref: { type: 'turn', step: p.timeline.indexOf(prompt) + 1 }, observationIds: [], step: p.timeline.indexOf(prompt) + 1, label: 'User prompt', text: clipItem(prompt.prompt ?? '') });

  const before = p.timeline.slice(0, at - 1).filter((t) => (t.type === 'op-start' || t.type === 'prose') && t.agentId === op.agentId).slice(-window);
  for (const t of before) {
    if (t.type === 'op-start') {
      const o = p.operations.find((x) => x.id === t.operationId)!;
      add({ ref: { type: 'operation', id: o.id }, observationIds: o.observationIds, step: stepOf(p, o.id), label: `${o.kind}: ${o.title}`, text: clipItem(describeOp(o, art)) });
    } else if (t.type === 'prose') {
      const pr = p.prose.find((x) => x.id === t.proseId)!;
      add({ ref: { type: 'prose', id: pr.id }, observationIds: pr.observationIds, step: pr.sequence + 1, label: proseLabel(pr), text: clipItem(pr.text) });
    }
  }
  add({ ref: { type: 'operation', id: op.id }, observationIds: op.observationIds, step: at, label: `FOCUS ${op.kind}: ${op.title}`, text: clipItem(describeOp(op, art)) });
  const focusKey = items.at(-1)!.key;
  return { task: 'explain-operation', items, focusKey, chars: items.reduce((s, i) => s + i.text.length, 0) };
}

/** Evidence for a return briefing over [fromStep, toStep): every operation and prose in it. */
export function evidenceForBriefing(p: Projection, art: ArtifactText, fromStep = 0, toStep = p.timeline.length, budgetChars = 400_000): EvidencePack {
  const items: EvidenceItem[] = [];
  let n = 1;
  let chars = 0;
  const slice = p.timeline.slice(fromStep, toStep);
  for (const t of slice) {
    let it: Omit<EvidenceItem, 'key'> | undefined;
    if (t.type === 'turn') it = { ref: { type: 'turn', step: p.timeline.indexOf(t) + 1 }, observationIds: [], step: p.timeline.indexOf(t) + 1, label: 'User prompt', text: clipItem(t.prompt ?? '') };
    else if (t.type === 'op-start') {
      const o = p.operations.find((x) => x.id === t.operationId)!;
      // Briefings favour outcomes: keep reads short, keep edits and tests whole.
      const full = o.kind === 'edit' || o.kind === 'write' || o.kind === 'test' || o.status === 'error';
      const text = clipItem(full ? describeOp(o, art) : o.title);
      it = { ref: { type: 'operation', id: o.id }, observationIds: o.observationIds, step: stepOf(p, o.id), label: `${o.kind}: ${o.title}`, text };
    } else if (t.type === 'prose') {
      const pr = p.prose.find((x) => x.id === t.proseId)!;
      if (pr.role === 'reasoning' && pr.text.length > 1500) continue; // long private reasoning adds bulk, not outcomes
      it = { ref: { type: 'prose', id: pr.id }, observationIds: pr.observationIds, step: pr.sequence + 1, label: proseLabel(pr), text: clipItem(pr.text) };
    }
    if (!it) continue;
    if (chars + it.text.length > budgetChars) break;
    chars += it.text.length;
    items.push({ ...it, key: `E${n++}` });
  }
  return { task: 'briefing', items, chars };
}

function proseLabel(pr: Prose) {
  const who = pr.role === 'reasoning' ? (pr.exposure === 'summary' ? 'Agent reasoning summary' : 'Agent reasoning') : 'Agent said';
  return who;
}

// ─── prompts ─────────────────────────────────────────────────────────────────────────────

const RULES = `You explain what a coding agent did, strictly from the evidence items provided.
Rules:
- Every claim must cite one or more evidence keys like [E3]. A claim you cannot cite, do not make.
- Distinguish what the evidence shows from what it does not. Put open questions in "unknowns".
- A later event happening after an earlier one is NOT proof the earlier one caused it. Say "followed", not "because", unless an item states the reason.
- The agent's own words are its stated intent, not verified fact.
- Never invent file contents, line numbers, test names or results.
- Reply with ONE JSON object and nothing else.`;

function renderItems(pack: EvidencePack) {
  return pack.items.map((i) => `### ${i.key} — ${i.label} (step ${i.step})\n${i.text}`).join('\n\n');
}

export function explainMessages(pack: EvidencePack): ChatMessage[] {
  return [
    { role: 'system', content: RULES },
    {
      role: 'user',
      content: `Evidence from a recorded agent session:\n\n${renderItems(pack)}\n\nExplain the FOCUS item ${pack.focusKey}: what changed or happened, what earlier evidence it responds to, and whether later-known outcomes in its own result confirm it.\nJSON shape: {"summary": string (≤ 2 sentences, with citations), "claims": [{"text": string, "evidence": ["E1"]}], "unknowns": [string]}`,
    },
  ];
}

export function briefingMessages(pack: EvidencePack): ChatMessage[] {
  return [
    { role: 'system', content: RULES },
    {
      role: 'user',
      content: `Evidence from a recorded agent session, in order:\n\n${renderItems(pack)}\n\nWrite a return briefing for a developer who was away: what the agent was asked, what it changed, what it verified and how, what failed or remains unverified.\nJSON shape: {"summary": string, "claims": [{"text": string, "evidence": ["E1"]}], "unknowns": [string]}`,
    },
  ];
}

// ─── result validation ───────────────────────────────────────────────────────────────────

export interface GeneratedClaim {
  text: string;
  evidence: { key: string; ref: EvidenceItem['ref']; step: number; observationIds: string[] }[];
}

export interface GeneratedExplanation {
  provenance: { kind: 'generated'; generator: string; version: string; observationIds: string[] };
  task: EvidencePack['task'];
  summary: string;
  claims: GeneratedClaim[];
  unknowns: string[];
  /** Claims the model made without a valid citation. Kept out of `claims`, counted for honesty. */
  droppedClaims: number;
  evidenceCount: number;
}

export function parseModelJson(raw: string): { summary?: string; claims?: { text?: string; evidence?: unknown }[]; unknowns?: unknown } {
  const s = raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/g, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('model reply contained no JSON object');
  return JSON.parse(s.slice(start, end + 1));
}

export function validate(pack: EvidencePack, raw: string, generator: string): GeneratedExplanation {
  const j = parseModelJson(raw);
  const byKey = new Map(pack.items.map((i) => [i.key, i]));
  const cite = (keys: unknown) =>
    (Array.isArray(keys) ? keys : [])
      .map((k) => String(k).replace(/[[\]\s]/g, ''))
      .filter((k) => byKey.has(k))
      .map((k) => {
        const i = byKey.get(k)!;
        return { key: k, ref: i.ref, step: i.step, observationIds: i.observationIds };
      });
  let dropped = 0;
  const claims: GeneratedClaim[] = [];
  for (const c of j.claims ?? []) {
    const text = String(c?.text ?? '').trim();
    // Citations may also be inline in the text: "[E3]".
    const inline = [...text.matchAll(/\[(E\d+)\]/g)].map((m) => m[1]);
    const evidence = cite([...(Array.isArray(c?.evidence) ? c.evidence : []), ...inline]);
    const unique = [...new Map(evidence.map((e) => [e.key, e])).values()];
    if (!text || !unique.length) {
      dropped++;
      continue;
    }
    claims.push({ text, evidence: unique });
  }
  const observationIds = [...new Set(claims.flatMap((c) => c.evidence.flatMap((e) => e.observationIds)))];
  const out: GeneratedExplanation = {
    provenance: { kind: 'generated', generator, version: EXPLAIN_VERSION, observationIds },
    task: pack.task,
    summary: String(j.summary ?? '').trim(),
    claims,
    unknowns: (Array.isArray(j.unknowns) ? j.unknowns : []).map(String).filter(Boolean).slice(0, 10),
    droppedClaims: dropped,
    evidenceCount: pack.items.length,
  };
  // A model can write a secret back (echoed, or shaped like one); it is captured text like any other.
  return sanitize(out).value;
}

// ─── consent: prepare, preview, send exactly that ────────────────────────────────────────

/** One model request, fixed before the person sees it. */
export interface ModelRequest {
  endpoint: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
}

export type Prepared =
  | { task: 'explain' | 'briefing'; request: ModelRequest; digest: string; pack: EvidencePack }
  | { task: 'labels'; request: ModelRequest; digest: string; passageIds: string[] };

/**
 * Fingerprint of everything that decides what leaves the machine: destination, model, token
 * budget, exact messages, and the privacy and explain policies that shaped them. Consent is given
 * to this digest; a send whose digest no longer matches is refused (audit A04).
 */
export function requestDigest(r: ModelRequest): string {
  const canonical = JSON.stringify([PRIVACY_POLICY_VERSION, EXPLAIN_VERSION, r.endpoint, r.model, r.maxTokens, r.messages.map((m) => [m.role, m.content])]);
  return createHash('sha256').update(canonical).digest('hex');
}

function request(cfg: ModelConfig, model: string, messages: ChatMessage[], maxTokens: number): ModelRequest {
  return { endpoint: cfg.baseUrl, model, messages, maxTokens };
}

export function prepareExplain(p: Projection, operationId: string, art: ArtifactText, cfg: ModelConfig): Prepared {
  const pack = evidenceForOperation(p, operationId, art);
  const req = request(cfg, cfg.ultraModel, explainMessages(pack), 1800);
  return { task: 'explain', request: req, digest: requestDigest(req), pack };
}

export function prepareBriefing(p: Projection, art: ArtifactText, cfg: ModelConfig, range: { from?: number; to?: number } = {}): Prepared {
  const pack = evidenceForBriefing(p, art, range.from, range.to);
  const req = request(cfg, cfg.superModel, briefingMessages(pack), 2400);
  return { task: 'briefing', request: req, digest: requestDigest(req), pack };
}

/** Short passage labels from the fast tier. Labels are generated and shown as such. */
export function prepareLabels(p: Projection, cfg: ModelConfig): Prepared {
  const passages = p.passages.filter((ps) => ps.operationIds.length).slice(0, 60);
  const listing = passages
    .map((ps) => `${ps.id}: ${ps.operationIds.map((id) => p.operations.find((o) => o.id === id)?.title ?? '').slice(0, 8).join(' | ')}`)
    .map((l) => redactText(l).text.slice(0, 600))
    .join('\n');
  const messages: ChatMessage[] = [
    { role: 'system', content: 'Label each group of agent actions with 2–5 plain words describing the activity (e.g. "Reading checkout guard"). Only describe the listed actions. Reply with one JSON object mapping id to label.' },
    { role: 'user', content: listing },
  ];
  const req = request(cfg, cfg.nanoModel, messages, 1200);
  return { task: 'labels', request: req, digest: requestDigest(req), passageIds: passages.map((ps) => ps.id) };
}

/** Exactly what a send would transfer, and the digest the person consents to. */
export function preview(prep: Prepared) {
  const { endpoint, model, messages } = prep.request;
  const items = prep.task === 'labels' ? prep.passageIds.length : prep.pack.items.length;
  return { endpoint, model, messages, chars: messages.reduce((n, m) => n + m.content.length, 0), items, digest: prep.digest };
}

export type LabelResult = Record<string, { label: string; generator: string }>;

/** Sends the prepared request unchanged. Callers check consent against `prep.digest` first. */
export async function sendPrepared(prep: Prepared, complete: Complete): Promise<GeneratedExplanation | LabelResult> {
  const { model, messages, maxTokens } = prep.request;
  const raw = await complete(model, messages, { maxTokens });
  if (prep.task !== 'labels') return validate(prep.pack, raw, model);
  const j = parseModelJson(raw) as Record<string, unknown>;
  const out: LabelResult = {};
  for (const id of prep.passageIds) {
    const l = j[id];
    if (typeof l === 'string' && l.trim()) out[id] = { label: redactText(l.trim()).text.slice(0, 60), generator: model };
  }
  return out;
}

export async function explainOperation(p: Projection, operationId: string, art: ArtifactText, cfg: ModelConfig, complete: Complete = httpComplete(cfg)) {
  return (await sendPrepared(prepareExplain(p, operationId, art, cfg), complete)) as GeneratedExplanation;
}

export async function briefing(p: Projection, art: ArtifactText, cfg: ModelConfig, range: { from?: number; to?: number } = {}, complete: Complete = httpComplete(cfg)) {
  return (await sendPrepared(prepareBriefing(p, art, cfg, range), complete)) as GeneratedExplanation;
}

export async function labelPassages(p: Projection, cfg: ModelConfig, complete: Complete = httpComplete(cfg)): Promise<LabelResult> {
  return (await sendPrepared(prepareLabels(p, cfg), complete)) as LabelResult;
}
