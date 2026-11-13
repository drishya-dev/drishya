import { mkdtemp, mkdir, writeFile, rm, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OUTPUT_LIMIT, outputReferences, readOutput, taskId, taskInResult, taskState, taskOutputPath } from '../src/tasks.ts';
import { childReference, readChildren } from '../src/subagents.ts';

describe('Antigravity background evidence', () => {
  it('requires an exact task id and explicit lifecycle status', () => {
    expect(taskInResult('Task ID: 17\nStatus: RUNNING')).toBe('task-17');
    expect(taskId('task-17')).toBe('task-17');
    expect(taskId('../17')).toBeUndefined();
    expect(taskInResult('Perhaps task 17 finished')).toBeUndefined();
    const owner = '00000000-0000-0000-0000-000000000000';
    expect(taskInResult(`Running in background with Task ID: ${owner}/task-2`)).toBe(`${owner}/task-2`);
    expect(taskOutputPath('/root', 'other', `${owner}/task-2`)).toBeUndefined();
    expect(taskOutputPath('/root', owner, `${owner}/task-2`)).toContain('task-2.log');
    expect(taskInResult('Task ID: 1\nTask ID: 2')).toBeUndefined();
    expect(taskState('Status: COMPLETED')).toBe('complete');
    expect(taskState('Status: RUNNING')).toBe('running');
    expect(taskState('Status: KILLED')).toBe('error');
    expect(taskState('all done')).toBeUndefined();
    expect(taskOutputPath('/root', 'c', '../17')).toBeUndefined();
    expect(outputReferences('See file:///C:/with%20spaces/brain/c/.system_generated/steps/3/output.txt for details')).toHaveLength(1);
    expect(outputReferences('an output.txt might exist')).toEqual([]);
  });

  it('reads a bounded same-conversation log without writing it, rejecting sibling and linked files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'drishya-ag-task-'));
    try {
      const tasks = join(root, 'brain', 'c', '.system_generated', 'tasks');
      await mkdir(tasks, { recursive: true });
      const path = join(tasks, 'task-1.log');
      await writeFile(path, 'α'.repeat(OUTPUT_LIMIT));
      const before = await stat(path);
      const result = await readOutput(root, 'c', pathToFileURL(path).href, 5);
      expect(result).toMatchObject({ available: true, text: 'αα', truncated: true, bytes: OUTPUT_LIMIT * 2 });
      expect((await stat(path)).mtimeMs).toBe(before.mtimeMs);
      expect(await readOutput(root, 'other', path)).toEqual({ available: false, reason: 'outside-harness-folder' });
      expect(await readOutput(root, 'c', join(tasks, 'task-99.log'))).toEqual({ available: false, reason: 'removed' });
      expect(await readOutput(root, 'c', 'https://example.test/output.txt')).toEqual({ available: false, reason: 'outside-harness-folder' });
      const outside = join(root, 'private'); await mkdir(outside); await writeFile(join(outside, 'output.txt'), 'not read');
      const steps = join(root, 'brain', 'c', '.system_generated', 'steps'); await mkdir(steps);
      const link = join(steps, '2'); await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
      expect(await readOutput(root, 'c', join(link, 'output.txt'))).toEqual({ available: false, reason: 'outside-harness-folder' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('matches child metadata only to its recorded spawn step', () => {
    expect(childReference({ conversationId: 'child', spawnStepIndex: 12, subagentDescriptor: { typeName: 'reviewer', role: 'test' } })).toEqual({ conversationId: 'child', spawnStepIndex: 12, agentType: 'reviewer', role: 'test' });
    expect(childReference({ conversationId: 'child', role: 'same name', timestamp: '2026-11-13' })).toBeUndefined();
    expect(childReference({ conversationId: '../child', spawnStepIndex: 12 })).toBeUndefined();
    expect(childReference({ conversationId: 'child', spawnStepIndex: -1 })).toBeUndefined();
  });

  it('reads only bounded exact metadata, rejecting linked child metadata directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'drishya-ag-child-'));
    try {
      const generated = join(root, 'brain', 'parent', '.system_generated');
      const directory = join(generated, 'subagents'); await mkdir(directory, { recursive: true });
      const valid = { conversationId: 'child', spawnStepIndex: 9 };
      await writeFile(join(directory, 'child.json'), JSON.stringify(valid));
      await writeFile(join(directory, 'bad.json'), '{');
      await writeFile(join(directory, 'oversized.json'), ' '.repeat(65 * 1024));
      await writeFile(join(directory, 'notes.txt'), JSON.stringify(valid));
      expect(await readChildren(root, 'parent')).toEqual([valid]);
      expect(await readChildren(root, '../parent')).toEqual([]);
      await rm(directory, { recursive: true });
      const outside = join(root, 'private'); await mkdir(outside); await writeFile(join(outside, 'child.json'), JSON.stringify(valid));
      await symlink(outside, directory, process.platform === 'win32' ? 'junction' : 'dir');
      expect(await readChildren(root, 'parent')).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
