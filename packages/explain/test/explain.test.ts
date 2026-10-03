import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Projection } from '@drishya/contracts';
import { Ingestor } from '@drishya/ingest';
import { Store } from '@drishya/store';
import { briefing, evidenceForBriefing, evidenceForOperation, explainOperation, prepareBriefing, prepareExplain, prepareLabels, preview, sendPrepared, validate, type Complete, type ModelConfig } from '../src/index.ts';

const fixtures = fileURLToPath(new URL('../../../fixtures/synthetic', import.meta.url));
const cfg: ModelConfig = { baseUrl: 'http://model.invalid/v1', apiKey: 'test', nanoModel: 'nano', superModel: 'super', ultraModel: 'ultra' };
let dir: string;
let store: Store;
let p: Projection;
const art = (id: string) => {
  const a = p.artifacts.find((x) => x.id === id);
  return a?.blob ? store.blobs.get(a.blob) : undefined;
};

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-explain-'));
  store = new Store(dir);
  const ingest = new Ingestor(store);
  const r = await ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'));
  p = ingest.projection(r.recordingId);
});
afterAll(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const editOp = () => p.operations.find((o) => o.kind === 'edit')!;

describe('evidence for an explanation', () => {
  it('does not send a neighbouring result that arrived after the focus result', () => {
    const late = p.operations.find((o) => o.detail.kind === 'read' && o.detail.excerptArtifactId)!;
    const focus = p.operations.find((o) => o.startSequence > late.startSequence && o.endSequence !== undefined)!;
    const shifted = structuredClone(p);
    const endIndex = shifted.timeline.findIndex((it) => it.type === 'op-end' && it.operationId === late.id);
    const [end] = shifted.timeline.splice(endIndex, 1);
    const focusEnd = shifted.timeline.findIndex((it) => it.type === 'op-end' && it.operationId === focus.id);
    shifted.timeline.splice(focusEnd + 1, 0, end!);
    const pack = evidenceForOperation(shifted, focus.id, art);
    const previous = pack.items.find((item) => item.ref.type === 'operation' && item.ref.id === late.id)!;
    expect(previous.text).toContain('[status: running]');
    expect(previous.text).not.toContain('export type CheckoutBlock');
    const briefing = evidenceForBriefing(shifted, art, 0, focusEnd + 1);
    expect(JSON.stringify(briefing)).not.toContain('export type CheckoutBlock');
  });
  it('contains the focus and what came before it, never what came after', () => {
    const pack = evidenceForOperation(p, editOp().id, art);
    const focusStep = pack.items.at(-1)!.step;
    expect(pack.items.at(-1)!.label).toMatch(/^FOCUS edit/);
    expect(pack.items.slice(0, -1).every((i) => i.step < focusStep)).toBe(true);
    expect(pack.items.some((i) => i.text.includes('allows a free order'))).toBe(true); // the failing test
  });
});

describe('validation of model output', () => {
  it('keeps only claims that cite evidence we sent, and records provenance', () => {
    const pack = evidenceForOperation(p, editOp().id, art);
    const raw = `<think>private</think>\`\`\`json
{"summary":"Narrows the guard [${pack.focusKey}].","claims":[
 {"text":"The failing test expected true for a zero total.","evidence":["E2", "E999"]},
 {"text":"This will definitely fix production.","evidence":[]},
 {"text":"The edit replaces a falsy check [${pack.focusKey}]."}
],"unknowns":["Whether charge() handles 0"]}\`\`\``;
    const r = validate(pack, raw, 'ultra');
    expect(r.claims.map((c) => c.text)).toEqual(['The failing test expected true for a zero total.', `The edit replaces a falsy check [${pack.focusKey}].`]);
    expect(r.claims[0]!.evidence.map((e) => e.key)).toEqual(['E2']);
    expect(r.droppedClaims).toBe(1);
    expect(r.provenance).toMatchObject({ kind: 'generated', generator: 'ultra' });
    expect(r.provenance.observationIds.length).toBeGreaterThan(0);
    expect(r.unknowns).toEqual(['Whether charge() handles 0']);
  });

  it('uses the configured tiers: ultra explains, super briefs', async () => {
    const seen: string[] = [];
    const fake: Complete = async (model) => {
      seen.push(model);
      return '{"summary":"s","claims":[{"text":"t","evidence":["E1"]}],"unknowns":[]}';
    };
    await explainOperation(p, editOp().id, art, cfg, fake);
    await briefing(p, art, cfg, {}, fake);
    expect(seen).toEqual(['ultra', 'super']);
  });

  it('never sends a secret even if one slipped into evidence', async () => {
    const token = 'gh' + 'p_' + 'Zz9Yy8Xx7Ww6Vv5Uu4Tt3Ss2Rr1Qq0Pp9Oo8';
    const tampered = structuredClone(p);
    tampered.prose[0]!.text += ` ${token}`;
    let sent = '';
    await briefing(tampered, art, cfg, {}, async (_m, messages) => {
      sent = JSON.stringify(messages);
      return '{"summary":"","claims":[]}';
    });
    expect(sent).not.toContain(token);
  });

  // Roadmap B0: generated output is sanitized too, before it is cached or shown.
  it('redacts secrets the model writes back', () => {
    const token = 'gh' + 'p_' + 'Zz9Yy8Xx7Ww6Vv5Uu4Tt3Ss2Rr1Qq0Pp9Oo8';
    const pack = evidenceForOperation(p, editOp().id, art);
    const raw = JSON.stringify({ summary: `uses ${token} [E1]`, claims: [{ text: `token ${token}`, evidence: ['E1'] }], unknowns: [`is ${token} live?`] });
    const r = validate(pack, raw, 'ultra');
    expect(JSON.stringify(r)).not.toContain(token);
    expect(r.claims).toHaveLength(1);
  });
});

// Audit A04: consent binds to the exact payload, model and destination that will be sent.
describe('consent binding', () => {
  it('fingerprints exactly what will be sent', () => {
    const a = prepareExplain(p, editOp().id, art, cfg);
    expect(prepareExplain(p, editOp().id, art, cfg).digest).toBe(a.digest);
    expect(prepareExplain(p, editOp().id, art, { ...cfg, ultraModel: 'other' }).digest).not.toBe(a.digest);
    expect(prepareExplain(p, editOp().id, art, { ...cfg, baseUrl: 'http://elsewhere.invalid/v1' }).digest).not.toBe(a.digest);
    const changed = structuredClone(p);
    changed.operations.find((o) => o.id === editOp().id)!.title += ' (changed)';
    expect(prepareExplain(changed, editOp().id, art, cfg).digest).not.toBe(a.digest);
  });

  it('sends the previewed request byte for byte', async () => {
    for (const prep of [prepareExplain(p, editOp().id, art, cfg), prepareBriefing(p, art, cfg, {}), prepareLabels(p, cfg)]) {
      const shown = preview(prep);
      let sent: { model: string; messages: unknown } | undefined;
      await sendPrepared(prep, async (model, messages) => {
        sent = { model, messages };
        return '{"summary":"","claims":[],"unknowns":[]}';
      });
      expect(sent).toEqual({ model: shown.model, messages: shown.messages });
      expect(shown.digest).toBe(prep.digest);
    }
  });
});
