import { afterEach, describe, expect, it } from 'vitest';
import { appendFile, mkdtemp, mkdir, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { allowedRelative, localPath, readablePath, readableRoot } from '../src/paths.ts';
import { summaries } from '../src/summaries.ts';
import { createAntigravityAdapter } from '../src/index.ts';

const roots: string[] = [];
async function temp() { const root = await mkdtemp(join(tmpdir(), 'ag-discover-')); roots.push(root); return root; }
afterEach(async () => { await Promise.all(roots.splice(0).map(root => { if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch cleanup'); return rm(root, { recursive: true, force: true }); })); });

describe('observation allow-list', () => {
  it('rejects a private root override before attempting to read files', async () => {
    await expect(readableRoot(join(homedir(), '.gemini', 'antigravity-browser-profile'))).rejects.toThrow(/never-read/);
    if (process.env.APPDATA) await expect(readableRoot(join(process.env.APPDATA, 'Antigravity'))).rejects.toThrow(/never-read/);
  });
  it('rejects every private category and chunks for every purpose', () => {
    const privatePaths = [
      'daemon/hub_42.json', 'antigravity-browser-profile/Default/Cookies',
      'AppData/Roaming/Antigravity/state.vscdb', 'AppData/Roaming/Antigravity/credential-user-scope',
      'config/mcp_config.json', 'antigravity-ide/mcp_config.json', 'installation_id', 'machineid',
      'brain/one/.system_generated/logs/chunks/transcript_full/00000001.jsonl',
      'brain/one/.user_uploaded/secret.png', 'brain/one/.tempmediaStorage/secret.png',
    ];
    for (const path of privatePaths) for (const purpose of ['index', 'transcript', 'output', 'media', 'artifact'] as const) {
      expect(allowedRelative(path, purpose), `${purpose}: ${path}`).toBe(false);
    }
    expect(allowedRelative('brain/one/.system_generated/logs/transcript_full.jsonl', 'transcript')).toBe(true);
    expect(allowedRelative('conversation_summaries.db', 'index')).toBe(true);
  });
  it('rejects an allowed-looking reference to another conversation', async () => {
    const root = await temp();
    const other = join(root, 'brain', 'two', '.system_generated', 'logs', 'media', 'step_1_media_1.png');
    await mkdir(join(other, '..'), { recursive: true }); await writeFile(other, 'synthetic');
    await expect(readablePath(root, other, 'media', 'one')).rejects.toThrow(/conversation/);
    expect(localPath(new URL('https://example.test/image.png').href)).toBeUndefined();
  });
  it('rejects a junction or symlink that resolves outside the root', async () => {
    const root = await temp(), outside = await temp();
    const target = join(outside, 'logs'); await mkdir(target); await writeFile(join(target, 'transcript_full.jsonl'), 'synthetic');
    const parent = join(root, 'brain', 'one', '.system_generated'); await mkdir(parent, { recursive: true });
    await symlink(target, join(parent, 'logs'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(readablePath(root, join(parent, 'logs', 'transcript_full.jsonl'), 'transcript', 'one')).rejects.toThrow(/allow-list|conversation/);
  });
  it('rejects an allowed-looking symlink into another conversation', async () => {
    const root = await temp();
    const target = join(root, 'brain', 'two', '.system_generated', 'logs'); await mkdir(target, { recursive: true });
    await writeFile(join(target, 'transcript.jsonl'), 'synthetic');
    const parent = join(root, 'brain', 'one', '.system_generated'); await mkdir(parent, { recursive: true });
    await symlink(target, join(parent, 'logs'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(readablePath(root, join(parent, 'logs', 'transcript.jsonl'), 'transcript', 'one')).rejects.toThrow(/allow-list|conversation/);
  });
});

describe('summary index', () => {
  it('incrementally inspects appends, waits for a complete last line and resets a rewritten variant', async () => {
    const root = await temp(), logs = join(root, 'brain', 'live', '.system_generated', 'logs');
    await mkdir(logs, { recursive: true });
    const full = join(logs, 'transcript_full.jsonl'), old = join(logs, 'transcript.jsonl');
    const row = (step_index: number) => JSON.stringify({ step_index, type: 'USER_INPUT', source: 'USER_EXPLICIT', content: 'Synthetic', created_at: '2026-11-13T10:00:00Z' });
    await writeFile(full, row(1) + '\n'); await writeFile(old, row(5) + '\n');
    const adapter = createAntigravityAdapter([root]);
    expect(await adapter.readPath(full)).toBe(old);
    await appendFile(full, row(7));
    expect(await adapter.readPath(full)).toBe(old);
    await appendFile(full, '\n');
    expect(await adapter.readPath(full)).toBe(full);
    expect(await adapter.readPath(full)).toBe(full);
    await writeFile(full, row(0) + '\n');
    expect(await adapter.readPath(full)).toBe(old);
  });
  it('reports an encrypted-only conversation even when no brain directory exists', async () => {
    const root = await temp(); await mkdir(join(root, 'conversations'));
    await writeFile(join(root, 'conversations', 'encrypted.pb'), 'Synthetic opaque bytes; never opened by discovery');
    const adapter = createAntigravityAdapter([root]);
    expect(await adapter.discover()).toEqual([]);
    expect(adapter.diagnostics()).toMatchObject([{ code: 'encrypted', message: '1 unreadable: encrypted Antigravity conversations without transcripts.' }]);
    await mkdir(join(root, 'brain', 'plan'), { recursive: true });
    await writeFile(join(root, 'brain', 'plan', 'task.md'), '# Synthetic artifact');
    await writeFile(join(root, 'conversations', 'plan.db'), 'Synthetic metadata filename only');
    expect(await adapter.discover()).toEqual([]);
    expect(adapter.diagnostics().some(diagnostic => diagnostic.code === 'artifact-only')).toBe(true);
  });
  it('chooses the root supported by captured paths and keeps a child recording locally owned', async () => {
    const root = await temp(), first = join(root, 'repo-a'), second = join(root, 'repo-b');
    const path = join(root, 'brain', 'child', '.system_generated', 'logs', 'transcript_full.jsonl');
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, JSON.stringify({ step_index: 0, type: 'PLANNER_RESPONSE', source: 'MODEL', tool_calls: [{ name: 'read_file', args: { Path: JSON.stringify(join(second, 'code.ts')) } }] }) + '\n');
    const db = new DatabaseSync(join(root, 'conversation_summaries.db'));
    db.exec('CREATE TABLE conversation_summaries (conversation_id TEXT, title TEXT, workspace_uris TEXT, parent_conversation_id TEXT, agent_name TEXT)');
    db.prepare('INSERT INTO conversation_summaries VALUES (?, ?, ?, ?, ?)').run('child', 'Synthetic child', JSON.stringify([pathToFileURL(first).href, pathToFileURL(second).href]), 'parent', 'Explorer'); db.close();
    const adapter = createAntigravityAdapter([root]);
    const [source] = await adapter.discover();
    expect(source).toMatchObject({ cwd: second, parentSessionId: 'parent' });
    const direct = createAntigravityAdapter([root]); await direct.sourceSet(path);
    const meta = direct.createParser({ sourcePath: path, sourceId: 's', recordingId: 'r' }).parse({ step_index: 0, type: 'USER_INPUT', source: 'USER_EXPLICIT', content: 'synthetic' }).find(o => o.kind === 'session.meta')!;
    expect(meta.agentId).toBe('agent:main');
    expect(meta.payload).toMatchObject({ cwd: second, additionalRoots: [first], parentThreadId: 'parent', workspaceSelection: 'derived-captured-path-count' });
  });
  it('chooses the furthest complete transcript, not the file with full in its name', async () => {
    const root = await temp(), logs = join(root, 'brain', 'one', '.system_generated', 'logs');
    await mkdir(join(root, 'conversations')); await writeFile(join(root, 'conversations', 'one.db'), 'Synthetic metadata filename only');
    await mkdir(logs, { recursive: true });
    const row = (step_index: number) => JSON.stringify({ step_index, type: 'USER_INPUT', source: 'USER_EXPLICIT', content: 'synthetic', tool_calls: [] }) + '\n';
    await writeFile(join(logs, 'transcript_full.jsonl'), row(0));
    await writeFile(join(logs, 'transcript.jsonl'), row(0) + row(1));
    const adapter = createAntigravityAdapter([root]);
    expect((await adapter.discover())[0]!.path).toBe(join(logs, 'transcript.jsonl'));
    await writeFile(join(logs, 'transcript_full.jsonl'), row(0) + row(1) + row(2));
    expect((await adapter.discover())[0]!.path).toBe(join(logs, 'transcript.jsonl'));
    expect(await adapter.readPath(join(logs, 'transcript.jsonl'))).toBe(join(logs, 'transcript_full.jsonl'));
  });
  it('returns an empty map for a missing index and reports an invalid database', async () => {
    const root = await temp(); expect((await summaries(root)).size).toBe(0);
    await writeFile(join(root, 'conversation_summaries.db'), 'not a database');
    await expect(summaries(root)).rejects.toThrow();
  });
  it('rejects a non-file index instead of treating it as absent', async () => {
    const root = await temp(); await mkdir(join(root, 'conversation_summaries.db'));
    await expect(summaries(root)).rejects.toThrow(/regular file/);
  });
  it('reads an immutable synthetic index without creating WAL or shared memory files', async () => {
    const root = await temp(), path = join(root, 'conversation_summaries.db');
    const db = new DatabaseSync(path);
    db.exec('CREATE TABLE conversation_summaries (conversation_id TEXT, title TEXT, workspace_uris TEXT, parent_conversation_id TEXT, agent_name TEXT)');
    db.prepare('INSERT INTO conversation_summaries VALUES (?, ?, ?, ?, ?)').run('abc', 'Synthetic', '[]', null, null); db.close();
    const before = await readdir(root);
    expect((await summaries(root)).get('abc')).toMatchObject({ id: 'abc', title: 'Synthetic', workspaces: [] });
    expect(await readdir(root)).toEqual(before);
    expect((await readdir(root)).some(name => name.endsWith('-wal') || name.endsWith('-shm'))).toBe(false);
  });
});
