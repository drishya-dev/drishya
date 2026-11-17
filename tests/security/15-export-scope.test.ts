// SEC-4b: a journal-supplied blob reference is never a store key. Synthetic recordings only.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startScratch, type Scratch } from './lib/scratch.ts';

const SESSION = 'c0ffee00-5ec3-4000-8000-0000000000a1';
const T0 = Date.parse('2026-09-21T10:00:00.000Z');
const at = (n: number) => new Date(T0 + n * 1000).toISOString();
const uuid = (n: number, tag: number) => `00000000-0000-4000-8000-${String(tag * 1000 + n).padStart(12, '0')}`;
const MARKER = 'OWNER-ONLY-TEXT-7f3a';
/** Longer than the inline limit, so the store keeps it as a blob. */
const victimText = `${MARKER} ` + 'quiet synthetic words '.repeat(1200);

function claudeJournal(file: string, tag: number, cwd: string, prompt: string, tools: { name: string; input: unknown; structured?: unknown }[] = []) {
  const base = (n: number, type: 'user' | 'assistant', message: unknown) => ({
    cwd, sessionId: `${SESSION.slice(0, -1)}${tag}`, version: '2.1.0', gitBranch: 'main', userType: 'external', entrypoint: 'cli', isSidechain: false,
    parentUuid: n === 1 ? null : uuid(n - 1, tag), type, message, uuid: uuid(n, tag), timestamp: at(n),
  });
  const records: unknown[] = [base(1, 'user', { role: 'user', content: prompt })];
  tools.forEach((t, i) => {
    records.push(base(10 + 2 * i, 'assistant', { id: `msg_${10 + 2 * i}`, type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'tool_use', id: `toolu_${i}`, name: t.name, input: t.input }], stop_reason: 'tool_use' }));
    records.push({ ...base(11 + 2 * i, 'user', { role: 'user', content: [{ type: 'tool_result', tool_use_id: `toolu_${i}`, content: 'ok' }] }), ...(t.structured !== undefined ? { toolUseResult: t.structured } : {}) });
  });
  records.push(base(4, 'assistant', { id: 'msg_4', type: 'message', role: 'assistant', model: 'claude-opus-5', content: [{ type: 'text', text: 'Done.' }], stop_reason: 'end_turn' }));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

let s: Scratch;
const journals = () => join(s.dir, 'journals');
beforeAll(async () => { s = await startScratch(); });
afterAll(async () => { await s.close(); });

async function importClaude(tag: number, prompt: string, tools?: { name: string; input: unknown; structured?: unknown }[]): Promise<string> {
  const file = join(journals(), `claude-${tag}.jsonl`);
  claudeJournal(file, tag, join(s.dir, `repo${tag}`), prompt, tools);
  return (await s.run.app.ingest.importSource('claude-code', file)).recordingId;
}
const shaOf = (text: string) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
const forged = (text: string) => ({ $blob: shaOf(text), bytes: Buffer.byteLength(text), preview: '' });

const forgedEdit = (text: string) => [{ name: 'Edit', input: { file_path: 'a.ts', old_string: 'x', new_string: 'y' }, structured: { filePath: 'a.ts', originalFile: forged(text), structuredPatch: [] } }];
const exported = async (id: string) => s.run.app.exportBundle(id);

describe('a recording exports only its own stored text (SEC-4b)', () => {
  it('a blob reference carried by a journal does not reach the text of another recording', async () => {
    const owner = await importClaude(1, victimText);
    expect(JSON.stringify(await exported(owner))).toContain(MARKER);
    const other = await importClaude(2, 'a short question', forgedEdit(victimText));
    const bundle = await exported(other);
    expect(JSON.stringify(bundle)).not.toContain(MARKER);
    expect(Object.values(bundle.artifactText).join('')).not.toContain(MARKER);
    expect(bundle.projection.artifacts.some((a) => a.blob === shaOf(victimText))).toBe(false);
  });

  it('the reference is stored as captured data that no reader resolves', async () => {
    const other = await importClaude(3, 'a short question', forgedEdit(victimText));
    const stored = [...s.run.app.store.orderedObservations(other)].map((o) => JSON.stringify(o.payload)).join(' ');
    expect(stored).not.toContain('"$blob"');
    expect(stored).toContain('capturedBlobKey');
  });

  it('a reference the store made itself still resolves, alone and in a combined selection', async () => {
    const owner = await importClaude(4, victimText);
    const other = await importClaude(5, 'a short question', forgedEdit(victimText));
    expect(JSON.stringify(await exported(owner))).toContain(MARKER);
    expect(JSON.stringify(await exported(`${owner}+${other}`))).toContain(MARKER);
    expect(JSON.stringify(await exported(other))).not.toContain(MARKER);
  });

  it('the readers return no text for it either', async () => {
    const owner = await importClaude(6, victimText);
    const other = await importClaude(7, 'a short question', forgedEdit(victimText));
    for (const path of [`/v1/recordings/${other}/projection`, `/v1/recordings/${other}/export`, `/v1/recordings/${other}/observations`]) {
      const reply = await s.call(path, { headers: s.bearer });
      expect(reply.status, path).toBe(200);
      expect(reply.text, path).not.toContain(MARKER);
    }
    expect(owner).not.toBe(other);
  });

  it('resolution is scoped to the recordings it is asked for', async () => {
    const owner = await importClaude(8, victimText);
    const other = await importClaude(9, 'a short question');
    const sha = shaOf(victimText);
    const { store } = s.run.app;
    expect(store.blobsFor([owner]).captured(sha)).toContain(MARKER);
    expect(store.blobsFor([other]).captured(sha)).toBeUndefined();
    expect(store.blobsFor([other]).capturedChunk(sha)).toBeUndefined();
    expect(store.blobsFor([other, owner]).captured(sha)).toContain(MARKER);
    expect(store.blobsFor([owner]).captured('../../../etc/passwd')).toBeUndefined();
  });

  it('forgetting a recording leaves nothing of its text behind a reference held by another', async () => {
    // Text no earlier test imported, so the only other holder of its hash would be the forged reference.
    const text = `${MARKER}-forget ` + 'other quiet words '.repeat(1200);
    const owner = await importClaude(10, text);
    const other = await importClaude(11, 'a short question', forgedEdit(text));
    const sha = shaOf(text);
    expect(s.run.app.store.blobs.has(sha)).toBe(true);
    await s.run.app.forget(owner);
    expect(s.run.app.store.blobs.has(sha)).toBe(false);
    expect(JSON.stringify(await exported(other))).not.toContain(MARKER);
    expect(s.run.app.store.blobsFor([other]).captured(sha)).toBeUndefined();
  });

  it('forgetting one recording keeps text another recording genuinely holds', async () => {
    const first = await importClaude(12, victimText);
    const second = await importClaude(13, victimText);
    await s.run.app.forget(first);
    expect(JSON.stringify(await exported(second))).toContain(MARKER);
  });
});
