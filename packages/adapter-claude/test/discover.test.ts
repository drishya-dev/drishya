import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { claudeAdapter } from '../src/index.ts';

let dir: string;
let previousHome: string | undefined;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-claude-title-'));
  previousHome = process.env.DRISHYA_CLAUDE_HOME;
  process.env.DRISHYA_CLAUDE_HOME = dir;
  mkdirSync(join(dir, 'projects', 'synthetic'), { recursive: true });
});
afterEach(() => {
  if (previousHome === undefined) delete process.env.DRISHYA_CLAUDE_HOME;
  else process.env.DRISHYA_CLAUDE_HOME = previousHome;
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
  rmSync(dir, { recursive: true, force: true });
});

async function titleFrom(head: unknown[], tail: unknown[] = []) {
  const prompt = { type: 'user', cwd: '/synthetic/workspace', message: { content: 'Clean first prompt' } };
  const records = [prompt, ...head, { type: 'queue-operation', padding: 'x'.repeat(300 * 1024) }, ...tail];
  writeFileSync(join(dir, 'projects', 'synthetic', 'fixture.jsonl'), records.map(record => JSON.stringify(record)).join('\n') + '\n');
  return (await claudeAdapter.discover())[0];
}

it('keeps the latest custom title even when lower ranks arrive later', async () => {
  const source = await titleFrom([{ type: 'custom-title', customTitle: 'Old custom' }], [
    { type: 'custom-title', customTitle: 'Latest custom' },
    { type: 'summary', summary: 'Later summary' },
    { type: 'ai-title', aiTitle: 'Later AI' },
  ]);
  expect(source?.title).toBe('Latest custom');
});

it('keeps the latest summary ahead of AI titles', async () => {
  const source = await titleFrom([{ type: 'summary', summary: 'Old summary' }], [
    { type: 'summary', summary: 'Latest summary' }, { type: 'ai-title', aiTitle: 'Later AI' },
  ]);
  expect(source?.title).toBe('Latest summary');
});

it('uses the latest AI title when no higher rank was recorded', async () => {
  const source = await titleFrom([{ type: 'ai-title', aiTitle: 'Old AI' }], [{ type: 'ai-title', aiTitle: 'Latest AI' }]);
  expect(source?.title).toBe('Latest AI');
});

it('does not let a lower-rank tail replace a custom title from the head', async () => {
  const source = await titleFrom([{ type: 'custom-title', customTitle: 'Head custom' }], [{ type: 'ai-title', aiTitle: 'Tail AI' }]);
  expect(source?.title).toBe('Head custom');
});

it('ignores empty and unknown title records and retains the first prompt and workspace', async () => {
  const source = await titleFrom([], [
    { type: 'custom-title', customTitle: '' }, { type: 'unknown', title: 'Not a title' },
    { type: 'user', cwd: '/synthetic/tail', message: { content: 'Do not use tail prompts' } },
  ]);
  expect(source?.title).toBe('Clean first prompt');
  expect(source?.cwd).toBe('/synthetic/workspace');
});

it('sanitizes the chosen title before discovery publishes it', async () => {
  const source = await titleFrom([], [{ type: 'custom-title', customTitle: 'fixture AKIA0000000000000000' }]);
  expect(source?.title).not.toContain('AKIA0000000000000000');
});

it('parses short journals once and preserves highest-rank latest-wins titles', async () => {
  const records = [
    { type: 'user', cwd: '/synthetic/workspace', message: { content: 'Clean first prompt' } },
    { type: 'custom-title', customTitle: 'Earlier custom' },
    { type: 'custom-title', customTitle: 'Latest custom' },
    { type: 'summary', summary: 'Later summary' },
    { type: 'ai-title', aiTitle: 'Later AI' },
  ];
  const lines = records.map(record => JSON.stringify(record));
  writeFileSync(join(dir, 'projects', 'synthetic', 'fixture.jsonl'), lines.join('\n') + '\n');
  const parse = vi.spyOn(JSON, 'parse');
  try {
    const source = (await claudeAdapter.discover())[0];
    expect(source?.title).toBe('Latest custom');
    for (const line of lines) expect(parse.mock.calls.filter(([text]) => text === line)).toHaveLength(1);
  } finally { parse.mockRestore(); }
});
