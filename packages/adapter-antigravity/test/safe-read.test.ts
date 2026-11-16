import {readOutput} from '../src/tasks.ts';
import {readChildren} from '../src/subagents.ts';
import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rename, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { captureMedia } from '../src/media.ts';
import { readArtifactVersions } from '../src/artifacts.ts';
const interception = vi.hoisted(() => ({ beforeOpen: undefined as undefined | (() => Promise<void>), reads: 0 }));
vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, open: async (...args: Parameters<typeof actual.open>) => {
    const hook = interception.beforeOpen; interception.beforeOpen = undefined; await hook?.();
    const handle = await actual.open(...args), read = handle.read.bind(handle);
    handle.read = ((...args: unknown[]) => { interception.reads++; return (read as (...args: unknown[]) => unknown)(...args); }) as typeof handle.read;
    return handle;
  } };
});
const roots: string[] = [];
afterEach(async () => { interception.beforeOpen = undefined; interception.reads = 0;
  for (const root of roots.splice(0)) { if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw Error('Unsafe scratch cleanup'); await rm(root, { recursive: true, force: true }); }
});
it('reads allow-listed artifact and image bytes through a configured root alias', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'ag-root-alias-')); roots.push(scratch);
  const native = join(scratch, 'native'), alias = join(scratch, 'alias');
  const conversation = join(native, 'brain', 'one'), uploads = join(conversation, '.user_uploaded');
  await mkdir(uploads, { recursive: true });
  await symlink(native, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GAAAAABJRU5ErkJggg==';
  await writeFile(join(conversation, 'task.md'), 'Synthetic task');
  await writeFile(join(uploads, 'shot.png'), Buffer.from(png, 'base64'));
  expect(await readArtifactVersions(alias, 'one', ['task.md'])).toMatchObject([{ text: 'Synthetic task' }]);
  expect((await captureMedia(alias, 'one', ['.user_uploaded/shot.png'])).images).toMatchObject([{ data: png }]);
});

for (const kind of ['media', 'artifact']) it(`refuses a directory swap between validation and ${kind} open before reading bytes`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'ag-swap-')); roots.push(root);
  const conversation = join(root, 'brain', 'one'), outside = join(root, 'outside');
  await mkdir(conversation, { recursive: true }); await mkdir(outside);
  const folder = kind === 'media' ? join(conversation, '.user_uploaded') : conversation;
  if (kind === 'media') await mkdir(folder);
  const name = kind === 'media' ? 'shot.png' : 'task.md';
  await writeFile(join(folder, name), 'inside'); await writeFile(join(outside, name), 'outside-never-read');
  interception.beforeOpen = async () => {
    await rename(folder, folder + '-original');
    await symlink(outside, folder, process.platform === 'win32' ? 'junction' : 'dir');
  };
  if (kind === 'media') {
    const value = await captureMedia(root, 'one', [join(folder, name)]);
    expect(value.images[0]?.data).toBeUndefined();
    expect(value.images[0]?.omitted).toBe('referenced-file');
  } else {
    const value = await readArtifactVersions(root, 'one', ['task.md']);
    expect(value[0]?.text).toBeUndefined(); expect(value[0]?.unavailable).toBeDefined();
  }
  expect(interception.reads).toBe(0);
});

for (const kind of ['output','subagent']) it(`refuses a directory swap before ${kind} bytes are read`, async () => {
 const root=await mkdtemp(join(tmpdir(),'ag-side-swap-'));roots.push(root);const folder=join(root,'brain','one','.system_generated',kind==='output'?'tasks':'subagents'),outside=join(root,'outside');await mkdir(folder,{recursive:true});await mkdir(outside);
 const name=kind==='output'?'task-1.log':'child.json';await writeFile(join(folder,name),kind==='output'?'inside':JSON.stringify({conversationId:'child',spawnStepIndex:1}));await writeFile(join(outside,name),'outside-never-read');
 interception.beforeOpen=async()=>{await rename(folder,folder+'-original');await symlink(outside,folder,process.platform==='win32'?'junction':'dir');};
 if(kind==='output'){const value=await readOutput(root,'one',join(folder,name));expect(value.available).toBe(false);}else expect(await readChildren(root,'one')).toEqual([]);
 expect(interception.reads).toBe(0);
});
