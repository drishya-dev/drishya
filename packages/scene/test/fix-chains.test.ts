import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Operation, Projection } from '@drishya/contracts';
import { Ingestor } from '@drishya/ingest';
import { Store } from '@drishya/store';
import { fixChainFor } from '../src/index.ts';

// READ-7: a failed command, the next run of the same command, and the edits recorded between.
// A recorded-order relationship, never a cause.
const fixtures = fileURLToPath(new URL('../../../fixtures/synthetic', import.meta.url));
let dir: string;
let store: Store;
let p: Projection;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-fixchain-'));
  store = new Store(dir);
  const ingest = new Ingestor(store);
  p = ingest.projection((await ingest.importSource('claude-code', join(fixtures, 'claude/checkout-fix.jsonl'))).recordingId);
});
afterAll(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const tests = () => p.operations.filter((o) => o.kind === 'test');

describe('fixChainFor', () => {
  it('links the failing run to the later run of the same command with the edits between', () => {
    const [failed, passed] = tests() as [Operation, Operation];
    expect(failed.status).toBe('error');
    const chain = fixChainFor(p, failed.id)!;
    expect(chain.links).toHaveLength(1);
    expect(chain.links[0]!.from.operationId).toBe(failed.id);
    expect(chain.links[0]!.to.operationId).toBe(passed.id);
    expect(chain.links[0]!.totalEdits).toBeGreaterThan(0);
    expect(chain.links[0]!.edits.every((e) => e.sequence > chain.links[0]!.from.sequence && e.sequence < passed.startSequence)).toBe(true);
  });

  it('shows the same link from the later run', () => {
    const [failed, passed] = tests() as [Operation, Operation];
    expect(fixChainFor(p, passed.id)!.links[0]!.from.operationId).toBe(failed.id);
  });

  it('has nothing for a change, an unknown id, or a command that never failed', () => {
    expect(fixChainFor(p, p.operations.find((o) => o.kind === 'edit')!.id)).toBeUndefined();
    expect(fixChainFor(p, 'missing')).toBeUndefined();
    const lone = structuredClone(p);
    lone.operations = lone.operations.filter((o) => o.id !== tests()[0]!.id);
    expect(fixChainFor(lone, tests()[1]!.id)).toBeUndefined();
  });
});
