import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, it } from 'vitest';
import { App } from '../../daemon/src/app.ts';
import { bundleSource } from '../src/api.ts';

it('reopens an export with masked nested keys and every original value', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-bundle-masking-'));
  const app = new App(join(dir, 'data'));
  try {
    const cwd = 'C:\\work\\alpha-repo';
    const forward = cwd.replace(/\\/g, '/');
    const journal = join(dir, 'session.jsonl');
    writeFileSync(journal, JSON.stringify({
      type: 'assistant', uuid: 'synthetic-export', sessionId: 'synthetic-session', cwd, version: '2.1.0',
      message: { content: [{
        type: 'tool_use', id: 'keys', name: 'mcp__audit__inspect',
        input: { nested: {
          [cwd]: 'value-a', [forward]: 'value-b', '<workspace>': 'already masked', '<workspace> (2)': 'existing suffix',
        } },
      }] },
    }) + '\n');
    const { recordingId } = await app.ingest.importSource('claude-code', journal);
    const bundle = await app.exportBundle(recordingId);
    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain(JSON.stringify(cwd).slice(1, -1));
    expect(serialized).not.toContain(forward);

    const replay = bundleSource(JSON.parse(serialized));
    const operation = (await replay.projection(bundle.recording.id)).operations.find((op) => op.tool === 'mcp__audit__inspect');
    expect(operation?.detail).toMatchObject({ input: { nested: {
      '<workspace>': 'already masked', '<workspace> (2)': 'existing suffix',
      '<workspace> (3)': 'value-a', '<workspace> (4)': 'value-b',
    } } });
  } finally {
    await app.close();
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path');
    rmSync(dir, { recursive: true, force: true });
  }
});
