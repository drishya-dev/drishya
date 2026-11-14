import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createParser } from '../src/index.ts';
import { liveParser } from '../src/live.ts';
import { artifactName, readablePath } from '../src/paths.ts';
import { readArtifactVersions } from '../src/artifacts.ts';

const roots: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const root of roots.splice(0)) { if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe scratch cleanup'); await rm(root, { recursive: true, force: true }); } });
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'ag-review-artifact-')); roots.push(root);
  const dir = join(root, 'brain', 'one'), logs = join(dir, '.system_generated', 'logs');
  await mkdir(logs, { recursive: true });
  const ctx = { recordingId: 'r', sourceId: 's', sourcePath: join(logs, 'transcript.jsonl') };
  return { root, dir, ctx };
}
const call = (path: string, metadata = true) => ({ step_index: 1, type: 'PLANNER_RESPONSE', tool_calls: [{ name: 'write_file', args: { Path: JSON.stringify(path), Content: JSON.stringify('- [ ] Synthetic'), ...(metadata ? { ArtifactMetadata: JSON.stringify({ RequestFeedback: true, UserFacing: true }) } : {}) } }] });

it('reads only explicitly named root-level Markdown and its own versions', async () => {
  const { root, dir } = await setup(), name = 'review-request.md', path = join(dir, name);
  await writeFile(path, 'current'); await writeFile(`${path}.resolved.2`, 'old'); await writeFile(join(dir, 'unrelated.md'), 'private');
  await expect(readablePath(root, path, 'artifact', 'one')).rejects.toThrow();
  expect(await readablePath(root, path, 'artifact', 'one', name)).toBeTruthy();
  await expect(readablePath(root, join(dir, 'unrelated.md'), 'artifact', 'one', name)).rejects.toThrow();
  const versions = await readArtifactVersions(root, 'one', [name]);
  expect(versions.map(v => [v.version, v.text])).toEqual([['2', 'old'], [undefined, 'current']]);
  expect((await readArtifactVersions(root, 'one')).some(v => v.name === name)).toBe(false);
});

it('captures an explicitly recorded same-conversation artifact and its snapshots only after result', async () => {
  const { root, dir, ctx } = await setup(), path = join(dir, 'review-request.md');
  await writeFile(path, 'Captured document'); await writeFile(`${path}.resolved.2`, 'Earlier version');
  vi.spyOn(Date, 'now').mockReturnValue(10000);
  const parser = liveParser(createParser(ctx), ctx, root, 'one', () => undefined, () => 2);
  const initial = parser.parse(call(path));
  expect(initial.find(r => r.kind === 'tool.call')?.payload).toMatchObject({ intent: { kind: 'plan' }, nativeArtifact: { path, name: 'review-request.md', text: '- [ ] Synthetic' } });
  expect((await parser.refresh?.())?.filter(r => r.kind === 'artifact.plan')).toEqual([]);
  parser.parse({ step_index: 2, type: 'GENERIC', status: 'DONE', content: 'Synthetic' });
  const versions = (await parser.refresh?.())?.filter(r => r.kind === 'artifact.plan') ?? [];
  expect(versions.map(v => v.payload.text)).toEqual(['Earlier version', 'Captured document']);
});

it('does not reinterpret ordinary or outside-conversation writes as artifacts', () => {
  return setup().then(({ root, dir, ctx }) => {
    for (const row of [call(join(dir, 'ordinary.md'), false), call(join(root, 'brain', 'two', 'outside.md')), call(join(dir, '.hidden', 'nested.md'))]) {
      const parser = createParser(ctx); const action = parser.parse(row).find(r => r.kind === 'tool.call')!;
      expect(action.payload.intent).toMatchObject({ kind: 'write' });
      expect(action.payload.nativeArtifact).toBeUndefined();
    }
  });
});

it('rejects unsafe filenames including traversal, streams, private files and Windows devices', () => {
  for (const name of ['../x.md', 'x/evil.md', 'x\\evil.md', 'x.md:secret', '.env.md', 'CON.md', 'aux.foo.md', 'a..b.md', 'x.md.']) expect(artifactName(name), name).toBe(false);
  expect(artifactName('review-request.md')).toBe(true);
});
