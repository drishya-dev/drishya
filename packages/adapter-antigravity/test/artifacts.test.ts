import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { markdownTasks, readArtifactVersions } from '../src/artifacts.ts';

const roots: string[] = [];
async function temp() { const root = await mkdtemp(join(tmpdir(), 'ag-artifacts-')); roots.push(root); return root; }
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch cleanup');
    return rm(root, { recursive: true, force: true });
  }));
});

async function conversation() {
  const root = await temp(), dir = join(root, 'brain', 'one');
  await mkdir(dir, { recursive: true });
  return { root, dir };
}

describe('artifact versions', () => {
  it('orders numeric versions without precision loss and uses metadata only for the current version', async () => {
    const { root, dir } = await conversation();
    for (const name of ['task.md', 'task.md.resolved', 'task.md.resolved.10', 'task.md.resolved.2', 'task.md.resolved.9007199254740993', 'task.md.resolved.9007199254740992']) await writeFile(join(dir, name), name);
    await writeFile(join(dir, 'task.md.metadata.json'), JSON.stringify({ version: 11, updatedAt: '2026-11-14T10:00:00Z' }));
    await writeFile(join(dir, 'other.md'), 'not an artifact');
    const versions = await readArtifactVersions(root, 'one', ['task.md']);
    expect(versions.map(v => v.version)).toEqual([undefined, '2', '10', '9007199254740992', '9007199254740993', '11']);
    expect(versions.map(v => v.current)).toEqual([false, false, false, false, false, true]);
    expect(versions.slice(0, -1).every(v => v.updatedAt === undefined)).toBe(true);
    expect(versions.at(-1)).toMatchObject({ updatedAt: '2026-11-14T10:00:00Z', text: 'task.md', bytes: 7, truncated: false });
  });
  it('pages a stable numeric order across names with a deleted cursor and missing current files', async () => {
    const { root, dir } = await conversation();
    for (let n = 15; n >= 1; n--) await writeFile(join(dir, `task.md.resolved.${n}`), `v${n}`);
    await writeFile(join(dir, 'task.md.resolved'), 'unnumbered');
    await writeFile(join(dir, 'implementation_plan.md.resolved.2'), 'plan');
    const seen: string[] = [];
    let after: string | undefined;
    for (;;) {
      const page = await readArtifactVersions(root, 'one', ['walkthrough.md', 'task.md', 'implementation_plan.md'], { after, limit: 50 });
      expect(page.length).toBeLessThanOrEqual(8);
      seen.push(...page.map(v => basename(v.path)));
      if (page.length < 8) break;
      after = basename(page.at(-1)!.path);
      await rm(page.at(-1)!.path, { force: true });
    }
    expect(seen).toEqual(['implementation_plan.md.resolved.2', 'implementation_plan.md', 'task.md.resolved',
      ...Array.from({ length: 15 }, (_, i) => `task.md.resolved.${i + 1}`), 'task.md', 'walkthrough.md']);
    const missing = await readArtifactVersions(root, 'one', ['walkthrough.md']);
    expect(missing).toMatchObject([{ name: 'walkthrough.md', current: true, unavailable: 'removed' }]);
  });
  it('honours a smaller limit and rejects an invalid cursor', async () => {
    const { root, dir } = await conversation();
    await writeFile(join(dir, 'task.md.resolved.1'), 'first');
    await writeFile(join(dir, 'task.md.resolved.2'), 'second');
    const page = await readArtifactVersions(root, 'one', ['task.md'], { limit: 1 });
    expect(page.map(v => v.version)).toEqual(['1']);
    expect((await readArtifactVersions(root, 'one', ['task.md'], { after: 'task.md.resolved.1', limit: 1 })).map(v => v.version)).toEqual(['2']);
    expect(await readArtifactVersions(root, 'one', ['task.md'], { after: '../task.md' })).toEqual([]);
  });
  it('bounds UTF-8 and ignores malformed or oversized metadata', async () => {
    const { root, dir } = await conversation();
    const data = 'a'.repeat(1024 * 1024 - 1) + '€' + 'tail';
    await writeFile(join(dir, 'task.md'), data);
    await writeFile(join(dir, 'task.md.metadata.json'), '{broken');
    let [value] = await readArtifactVersions(root, 'one', ['task.md']);
    expect(value).toMatchObject({ bytes: Buffer.byteLength(data), truncated: true });
    expect(value!.text).toBe('a'.repeat(1024 * 1024 - 1));
    expect(value!.version).toBeUndefined();
    await writeFile(join(dir, 'task.md.metadata.json'), JSON.stringify({ version: 'v'.repeat(65536), updatedAt: '2026-11-14T10:00:00Z' }));
    [value] = await readArtifactVersions(root, 'one', ['task.md']);
    expect(value!.updatedAt).toBeUndefined();
  });
  it('does not traverse a junction outside the conversation', async () => {
    const root = await temp(), outside = await temp();
    await mkdir(join(root, 'brain'), { recursive: true });
    await writeFile(join(outside, 'task.md'), 'must not be read');
    await symlink(outside, join(root, 'brain', 'one'), process.platform === 'win32' ? 'junction' : 'dir');
    const versions = await readArtifactVersions(root, 'one', ['task.md']);
    expect(versions).toMatchObject([{ current: true, unavailable: 'protected', bytes: 0 }]);
    expect(versions[0]!.text).toBeUndefined();
  });
  it('ignores invalid conversation identifiers and names', async () => {
    const { root } = await conversation();
    expect(await readArtifactVersions(root, '../one')).toEqual([]);
    expect(await readArtifactVersions(root, 'one', ['../other.md'])).toEqual([]);
  });
});

describe('literal Markdown tasks', () => {
  it('includes literal checklist items and ignores backtick and tilde fenced examples', () => {
    expect(markdownTasks([
      '- [ ] Pending', '  * [x] Done', '1. [X] Numbered', '- [~] Unknown',
      '```md', '- [x] Example', '````', '~~~', '- [ ] Also example', '~~~',
      '- [ ] Last',
    ].join('\n'))).toEqual([
      { text: 'Pending', status: 'pending' }, { text: 'Done', status: 'completed' },
      { text: 'Numbered', status: 'completed' }, { text: 'Last', status: 'pending' },
    ]);
  });
});
