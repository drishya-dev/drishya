import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { isPersonPrompt } from '@drishya/contracts';
import { App } from '../../../apps/daemon/src/app.ts';

// CONTENT-20: a journal imported before the adapter kept `queued_command` rows never stored the person's mid-turn messages.
let dir: string, app: App | undefined;
const marker = (id: string) => 'claude-queued-command-rescan-v1:' + id;
const marked = (id: string) => !!app!.store.db.prepare('SELECT 1 FROM meta WHERE key=?').get(marker(id));
const at = (n: number) => `2026-11-01T00:00:${String(n).padStart(2, '0')}.000Z`;
const user = (text: string, n: number, uuid: string) => ({ type: 'user', uuid, timestamp: at(n), message: { role: 'user', content: text } });
const queued = (prompt: string, n: number, origin: unknown, commandMode = 'prompt') => ({ type: 'attachment', uuid: `q${n}`, timestamp: at(n), attachment: { type: 'queued_command', prompt, commandMode, origin, timestamp: at(n) } });
const journal = (rows: unknown[]) => rows.map(r => JSON.stringify(r)).join('\n') + '\n';
const rows = [
  user('first prompt', 1, 'u1'),
  queued('typed while working', 2, { kind: 'human' }),
  queued('<task-notification>\n<status>completed</status>\n<summary>Background command done</summary>\n</task-notification>', 3, { kind: 'task-notification' }, 'task-notification'),
  queued('<cross-session-message from="a" from-name="planner">please rebase</cross-session-message>', 4, { kind: 'peer', from: 'a' }),
  user('second prompt', 5, 'u2'),
];
const turns = (id: string) => (app!.projection(id).timeline.filter(item => item.type === 'turn') as { prompt?: string }[]);
const people = (id: string) => turns(id).filter(turn => isPersonPrompt(turn.prompt)).map(turn => turn.prompt);
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'drishya-claude-rescan-')); app = new App(join(dir, 'data')); });
afterEach(async () => {
  await app?.close(); app = undefined; vi.restoreAllMocks();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});
/** Reproduce a store written before #310: the queued attachments were skipped, so those observations were never stored. */
async function legacy(name: string, content: unknown[]) {
  const path = join(dir, name + '.jsonl'); writeFileSync(path, journal(content));
  const { recordingId: id } = await app!.ingest.importSource('claude-code', path);
  app!.store.db.prepare("DELETE FROM observations WHERE recording_id=? AND json_extract(body,'$.source.recordId') IN ('q2','q3','q4')").run(id);
  app!.store.db.prepare('UPDATE recordings SET observation_count=(SELECT COUNT(*) FROM observations WHERE recording_id=?), stats=NULL WHERE id=?').run(id, id);
  app!.store.db.prepare('DELETE FROM meta WHERE key=?').run(marker(id));
  return { id, path };
}

it('restores the person\'s mid-turn message once, keeps the task notice and the other session\'s message out of the prompts, and does not reread again', async () => {
  const { id } = await legacy('legacy', rows);
  expect(turns(id).map(turn => turn.prompt)).toEqual(['first prompt', 'second prompt']);
  expect(await app!.ingest.rescanLegacyClaude()).toEqual({ attempted: 1, completed: 1, unavailable: 0, failed: 0 });
  expect(turns(id)).toHaveLength(5);
  expect(people(id)).toEqual(['first prompt', 'typed while working', 'second prompt']);
  expect(marked(id)).toBe(true);
  const count = app!.store.countObservations(id);
  await app!.close(); app = new App(join(dir, 'data')); const spy = vi.spyOn(app.ingest, 'rescan');
  expect(await app.ingest.rescanLegacyClaude()).toEqual({ attempted: 0, completed: 0, unavailable: 0, failed: 0 });
  expect(spy).not.toHaveBeenCalled(); expect(app.store.countObservations(id)).toBe(count);
});

it('marks a journal with no queued messages without rereading it', async () => {
  const plain = join(dir, 'plain.jsonl'); writeFileSync(plain, journal([rows[0], rows[4]]));
  const { recordingId: id } = await app!.ingest.importSource('claude-code', plain);
  app!.store.db.prepare('DELETE FROM meta WHERE key=?').run(marker(id));
  const spy = vi.spyOn(app!.ingest, 'rescan');
  expect(await app!.ingest.rescanLegacyClaude()).toEqual({ attempted: 0, completed: 0, unavailable: 0, failed: 0 });
  expect(spy).not.toHaveBeenCalled(); expect(marked(id)).toBe(true);
});
