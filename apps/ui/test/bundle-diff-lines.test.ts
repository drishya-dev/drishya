import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import type { ReplayBundle } from '@drishya/contracts';
import { bundleSource } from '../src/api.ts';

it('keeps a legacy replay diff readable when the export did not carry its whole line', async () => {
  const bundle = JSON.parse(readFileSync(new URL('../public/demo/bundle.json', import.meta.url), 'utf8')) as ReplayBundle;
  const edit = bundle.projection.operations.find(operation => operation.detail.kind === 'edit');
  if (!edit || edit.detail.kind !== 'edit') throw new Error('Demo edit missing');
  const hunk = edit.detail.hunks[0];
  if (!hunk) throw new Error('Demo hunk missing');
  const legacy = { $blob: 'fixture-blob', bytes: 24000, preview: '+recorded prefix' };
  (hunk.lines as unknown[])[0] = legacy;

  const replay = await bundleSource(bundle).projection(bundle.recording.id);
  const restored = replay.operations.find(operation => operation.id === edit.id);
  if (restored?.detail.kind !== 'edit') throw new Error('Replay edit missing');
  expect(restored.detail.hunks[0]?.lines).toEqual([
    '+recorded prefix [Remaining captured text unavailable]',
    ...hunk.lines.slice(1),
  ]);
  expect(hunk.lines[0]).toBe(legacy);
});
