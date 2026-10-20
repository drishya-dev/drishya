import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, it } from 'vitest';
import { Store } from '@drishya/store';
import { defaultAdapters, Ingestor } from '@drishya/ingest';
import { App } from '../src/app.ts';
import { startServer } from '../src/server.ts';

it('authenticated rescan enriches the same recording without changing existing evidence or chronology', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-rescan-api-')), data = join(dir, 'store'), journal = join(dir, 'journal.jsonl');
  writeFileSync(journal, readFileSync(resolve('fixtures/synthetic/usage/codex-rollout-usage.jsonl')));
  const store = new Store(data);
  const legacy = defaultAdapters().map(adapter => ({ ...adapter, createParser(context: Parameters<typeof adapter.createParser>[0]) {
    const parser = adapter.createParser(context);
    return { prime: parser.prime, parse: (record: unknown) => parser.parse(record).filter(o => o.kind !== 'usage') };
  } }));
  const old = new Ingestor(store, legacy), imported = await old.importSource('codex', journal);
  const before = store.observations(imported.recordingId), timeline = old.projection(imported.recordingId).timeline;
  await old.close(); store.close();
  const app = new App(data), server = await startServer({ app, port: 0 });
  const path = `${server.url}/v1/recordings/${imported.recordingId}/rescan`, headers = { authorization: `Bearer ${server.token}`, 'content-type': 'application/json' };
  const post = { headers, method: 'POST', body: '{}' };
  try {
    expect((await fetch(path, { method: 'POST' })).status).toBe(401);
    expect(await (await fetch(path, { headers })).json()).toEqual({ available: true });
    expect((await app.ingest.importSource('codex', journal)).added).toBe(0);
    expect(await (await fetch(path, post)).json()).toMatchObject({ added: 7, more: false });
    expect(app.store.observations(imported.recordingId).filter(o => o.kind !== 'usage')).toEqual(before);
    expect(app.projection(imported.recordingId).timeline).toEqual(timeline);
    expect(await (await fetch(path, post)).json()).toMatchObject({ added: 0 });
    rmSync(journal);
    expect(await (await fetch(path, { headers })).json()).toEqual({ available: false });
    expect((await fetch(path, post)).status).toBe(404);
    expect(app.projection(imported.recordingId).timeline).toEqual(timeline);
  } finally {
    await server.close(); await app.close();
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('unsafe temporary path');
    rmSync(dir, { recursive: true, force: true });
  }
});
