import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Operation, Projection } from '@drishya/contracts';
import { Ingestor } from '@drishya/ingest';
import { Store } from '@drishya/store';
import { verificationFor } from '../src/index.ts';

// P2-C verification freshness: for one change, which recorded test runs came after it, and did
// the file change again after the last of them? Order only — never a coverage claim.
const fixtures = fileURLToPath(new URL('../../../fixtures/synthetic', import.meta.url));
let dir: string;
let store: Store;
let p: Projection;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-verify-'));
  store = new Store(dir);
  const ingest = new Ingestor(store);
  p = ingest.projection((await ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'))).recordingId);
});
afterAll(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const edit = () => p.operations.find((o) => o.kind === 'edit')!;
const tests = () => p.operations.filter((o) => o.kind === 'test');
const end = (o: Operation) => o.endSequence ?? o.startSequence;

describe('verificationFor', () => {
  it('lists only test runs recorded after the change, and says one ran after', () => {
    const v = verificationFor(p, edit().id)!;
    expect(v.paths).toContain('src/checkout/guard.ts');
    expect(v.checks.map((c) => c.operationId)).toEqual(tests().filter((t) => end(t) > end(edit())).map((t) => t.id));
    expect(v.checks.map((c) => c.operationId)).not.toContain(tests()[0]!.id); // the failing run came before the edit
    expect(v.verdict).toBe('checked-after');
    expect(v.lastCheck?.status).toBe('ok');
    expect(v.lastCheck?.detail).toMatch(/passed/);
  });

  it('says the file changed again after the last recorded run', () => {
    const q = structuredClone(p);
    const later: Operation = { ...structuredClone(edit()), id: 'later-edit', title: 'Edit guard.ts again', startSequence: q.lastSequence + 1, endSequence: q.lastSequence + 2 };
    q.operations.push(later);
    q.lastSequence += 2;
    const v = verificationFor(q, edit().id)!;
    expect(v.verdict).toBe('changed-after-last-check');
    expect(v.laterChanges.map((c) => c.operationId)).toContain('later-edit');
    // And for the later change itself, no run was recorded after it.
    expect(verificationFor(q, 'later-edit')!.verdict).toBe('no-check-recorded');
  });

  it('says plainly when no test run was recorded after the change', () => {
    const q = structuredClone(p);
    q.operations = q.operations.filter((o) => !(o.kind === 'test' && end(o) > end(edit())));
    const v = verificationFor(q, edit().id)!;
    expect(v.verdict).toBe('no-check-recorded');
    expect(v.checks).toHaveLength(0);
    expect(v.lastCheck).toBeUndefined();
  });

  it('marks a later run whose captured failure names the changed file', () => {
    const q = structuredClone(p);
    const run = q.operations.find((o) => o.kind === 'test' && end(o) > end(edit()))!;
    if (run.detail.kind === 'test') run.detail.summary = { framework: 'vitest', passed: 1, failed: 1, skipped: 0, passing: [], basis: 'derived', failures: [{ name: 'guard', file: 'src/checkout/guard.ts' }] };
    expect(verificationFor(q, edit().id)!.checks.find((c) => c.operationId === run.id)?.namesChangedFile).toBe(true);
  });

  it('returns undefined for an operation that is not a change', () => {
    expect(verificationFor(p, tests()[0]!.id)).toBeUndefined();
    expect(verificationFor(p, 'no-such-op')).toBeUndefined();
  });
});
