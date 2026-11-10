import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Observation } from '@drishya/contracts';
import { isPersonPrompt } from '@drishya/contracts';
import { descriptor, createParser } from '../../adapter-claude/src/index.ts';
import { seal } from '@drishya/capture-core';
import { reduce } from '../src/reduce.ts';

// CONTENT-20: what the person typed while the agent was working is a prompt in the projection, once, and only the person's.
function capture(rows: unknown[]) {
  const parser = createParser({ recordingId: 'r', sourceId: 's', sourcePath: 'synthetic.jsonl' });
  let sequence = 0;
  const observations: Observation[] = rows.flatMap((row, index) => parser.parse(row).map(raw => ({ ...seal({ raw, recordingId: 'r', adapter: descriptor, sourceId: 's', generation: 0, byteOffset: index * 100, observedAt: '2026-11-01T00:00:00Z' }), receivedSequence: sequence++ })));
  const blobs = new Map<string, string>();
  return reduce('r', observations, { get: sha => blobs.get(sha), put: text => { const sha = createHash('sha256').update(text).digest('hex'); blobs.set(sha, text); return { sha, bytes: Buffer.byteLength(text) }; } }, { adapters: { [descriptor.id]: descriptor } });
}
const at = (n: number) => `2026-11-01T00:00:${String(n).padStart(2, '0')}.000Z`;
const user = (text: string, n: number, uuid: string) => ({ type: 'user', uuid, timestamp: at(n), message: { role: 'user', content: text } });
const queued = (prompt: unknown, n: number, origin: unknown, commandMode = 'prompt', uuid = `q${n}`) => ({ type: 'attachment', uuid, timestamp: at(n), attachment: { type: 'queued_command', prompt, commandMode, origin, timestamp: at(n) } });
const turns = (p: ReturnType<typeof capture>) => p.timeline.filter(item => item.type === 'turn') as { prompt?: string; images?: unknown[] }[];

describe('mid-turn messages', () => {
  it('counts a human queued command as a prompt, and keeps task notices and another session\'s message out of the count', () => {
    const p = capture([
      user('first', 1, 'u1'),
      queued('typed while working', 2, { kind: 'human' }),
      queued('<task-notification>\n<status>completed</status>\n<summary>done</summary>\n</task-notification>', 3, { kind: 'task-notification' }, 'task-notification'),
      queued('<cross-session-message from="a" from-name="planner">please rebase</cross-session-message>', 4, { kind: 'peer', from: 'a' }),
      queued([{ type: 'text', text: 'with a picture' }, { type: 'image', source: { type: 'base64', data: 'AAAA' } }], 5, { kind: 'human' }),
      user('last', 6, 'u2'),
    ]);
    expect(turns(p)).toHaveLength(6);
    expect(turns(p).filter(turn => isPersonPrompt(turn.prompt)).map(turn => turn.prompt)).toEqual(['first', 'typed while working', 'with a picture', 'last']);
    expect(turns(p).find(turn => turn.prompt === 'with a picture')?.images).toHaveLength(1);
  });

  it('shows a message once when the journal re-emits the same record, including its image', () => {
    const copy = queued([{ type: 'text', text: 'typed once' }, { type: 'image', source: { type: 'base64', data: 'AAAA' } }], 2, { kind: 'human' }, 'prompt', 'same-uuid');
    const p = capture([user('first', 1, 'u1'), copy, user('second', 3, 'u2'), user('first', 1, 'u1'), copy, user('second', 3, 'u2')]);
    expect(turns(p).map(turn => turn.prompt)).toEqual(['first', 'typed once', 'second']);
    expect(turns(p)[1]!.images).toHaveLength(1);
  });

  it('keeps two different messages that happen to read the same', () => {
    const p = capture([user('yes', 1, 'u1'), user('yes', 2, 'u2'), queued('yes', 3, { kind: 'human' })]);
    expect(turns(p).map(turn => turn.prompt)).toEqual(['yes', 'yes', 'yes']);
  });
});
