import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { allowedRelative, localPath, readablePath } from '../src/paths.ts';
import { summaries } from '../src/summaries.ts';

const roots: string[] = [];
async function temp() { const root = await mkdtemp(join(tmpdir(), 'ag-discover-')); roots.push(root); return root; }
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

describe('observation allow-list', () => {
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
