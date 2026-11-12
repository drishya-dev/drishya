import { afterAll, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isPersonPrompt, type Projection } from '@drishya/contracts';
import { Ingestor } from '@drishya/ingest';
import { Store } from '@drishya/store';
import { reviewInsights } from '../src/review-insights.ts';
import { nowFacts } from '../src/now.ts';
import { compose, markers } from '../src/index.ts';
import { readingTarget } from '../src/reading-target.ts';
const dir = mkdtempSync(join(tmpdir(), 'drishya-person-prompts-'));
const store = new Store(join(dir, 'home'));
afterAll(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
const notice = '<task-notification><status>completed</status><summary>synthetic worker finished</summary></task-notification>';
it('excludes only known leading harness shapes, keeping image-only, plain and unknown prompts', () => {
  for (const text of [notice, '<command-name>/compact</command-name>', '<local-command-stdout>synthetic done</local-command-stdout>', '[Request interrupted by user]', '<system-reminder>synthetic reminder</system-reminder>', '<environment_context>synthetic</environment_context>', '<subagent_notification>synthetic</subagent_notification>', '# AGENTS.md instructions for C:/synthetic']) expect(isPersonPrompt(text)).toBe(false);
  for (const text of [undefined, '', 'Read this file', 'Explain <task-notification>', '<unknown>literal</unknown>', '<task-notification></task-notification>', 'Message Type: MESSAGE\nTask name: /root\nSender: /root/worker\nPayload: quoted by the person']) expect(isPersonPrompt(text)).toBe(true);
});
it('keeps notices in their original passages while all prompt numbers skip them', async () => {
  const prompts = ['synthetic first needle', notice, '<command-name>/compact</command-name>', '<local-command-stdout>synthetic needle</local-command-stdout>', 'synthetic second needle'];
  const rows = prompts.flatMap((text, i) => [
    { type: 'user', sessionId: 'person-prompt-synthetic', uuid: `u${i}`, cwd: dir, message: { role: 'user', content: text } },
    { type: 'assistant', sessionId: 'person-prompt-synthetic', uuid: `a${i}`, message: { id: `a${i}`, role: 'assistant', content: [{ type: 'text', text: `synthetic reply needle ${i}` }] } },
  ]);
  const file = join(dir, 'synthetic.jsonl'); writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const ingest = new Ingestor(store), id = (await ingest.importSource('claude-code', file)).recordingId, p = ingest.projection(id);
  const turns = p.timeline.filter(item => item.type === 'turn');
  expect(turns).toHaveLength(5);
  expect(compose(p, { step: p.timeline.length }).passages.filter(item => item.personPrompt === false)).toHaveLength(3);
  expect(compose(p, { step: p.timeline.length }).passages.filter(item => item.turnPrompt).map(item => item.turnPrompt)).toEqual(prompts);
  const overview = reviewInsights(p);
  expect(overview.promptCount).toBe(2); expect(overview.prompts.map(item => item.ordinal)).toEqual([2, 1]);
  expect(markers(p).filter(item => item.type === 'turn')).toHaveLength(2);
  expect(readingTarget(p, { kind: 'turn', direction: 1, from: undefined, turnFrom: turns[0]!.id })?.turnKey).toBe(turns[4]!.id);
  const hits = store.search(id, 'needle');
  expect(hits.length).toBeGreaterThan(3);
  expect(hits.map(hit => hit.turn)).toEqual([1, 1, 1, 1, 1, 1, 2, 2]);
  const beforeSecond = { ...p, timeline: p.timeline.slice(0, p.timeline.findIndex(item => item === turns[4])) } as Projection;
  expect(nowFacts(beforeSecond).last?.what).toBe('reply');
  expect(reviewInsights(beforeSecond).promptCount).toBe(1);
});

it('counts multipart image-only prompts once in search and keeps worker-clipped notices classified', async () => {
  const notice = '<task-notification><task-id>' + 'x'.repeat(400) + '</task-id><status>completed</status><summary>synthetic done</summary></task-notification>';
  const image = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=' } };
  const rows = [
    { type: 'user', sessionId: 'image-prompt-synthetic', uuid: 'image1', cwd: dir, message: { role: 'user', content: [image, image] } },
    { type: 'user', sessionId: 'image-prompt-synthetic', uuid: 'notice1', cwd: dir, message: { role: 'user', content: notice } },
    { type: 'assistant', sessionId: 'image-prompt-synthetic', uuid: 'reply1', message: { id: 'reply1', role: 'assistant', content: [{ type: 'text', text: 'synthetic image needle' }] } },
  ];
  const file = join(dir, 'images.jsonl'); writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const ingest = new Ingestor(store), id = (await ingest.importSource('claude-code', file)).recordingId, p = ingest.projection(id);
  expect(reviewInsights(p).promptCount).toBe(1);
  expect(store.search(id, 'needle').map(hit => hit.turn)).toEqual([1]);
  const clipped = compose(p, { step: p.timeline.length }).passages.map(ps => ({ ...ps, turnPrompt: ps.turnPrompt?.slice(0, 240), unloaded: true }));
  expect(clipped.filter(ps => (ps.turnPrompt || ps.turnImages?.length) && ps.personPrompt !== false && isPersonPrompt(ps.turnPrompt))).toHaveLength(1);
  expect(clipped.some(ps => ps.personPrompt === false && isPersonPrompt(ps.turnPrompt))).toBe(true);
});
