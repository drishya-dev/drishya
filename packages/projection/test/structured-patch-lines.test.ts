import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, it } from 'vitest';
import { asOfProjection, isBlobText } from '@drishya/contracts';
import { Ingestor } from '../../ingest/src/index.ts';
import { Store } from '../../store/src/index.ts';
import { parseApplyPatch } from '../src/patch.ts';

it('keeps named patch entries and omits blank file and move labels', () => {
  const patch = [
    '*** Begin Patch',
    '*** Add File:   ',
    '*** Update File: src/example file.ts ',
    '*** Move to:    ',
    '@@',
    '-before',
    '+after',
    '*** End Patch',
  ].join('\r\n');

  expect(parseApplyPatch(patch)).toEqual([
    { path: 'src/example file.ts', op: 'update', hunks: [{ oldStart: 0, oldLines: 1, newStart: 0, newLines: 1, lines: ['-before', '+after'] }] },
  ]);
});

it('reads complete sealed structured diff lines in History and replay', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drishya-structured-patch-'));
  const store = new Store(join(dir, 'store'));
  const ingest = new Ingestor(store);
  try {
    const file = join(dir, 'generated.ts');
    const before = 'old ' + '\u03bb'.repeat(24000);
    const after = 'new ' + '\u03bb'.repeat(24000) + ' tail';
    const lines = ['-' + before, '+' + after];
    const base = { sessionId: 'structured-patch', timestamp: '2026-11-09T00:00:00Z', cwd: dir };
    const rows = [
      { ...base, type: 'assistant', uuid: 'call', message: { role: 'assistant', content: [
        { type: 'tool_use', id: 'edit', name: 'Edit', input: { file_path: file, old_string: before, new_string: after } },
      ] } },
      { ...base, type: 'user', uuid: 'result', message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'edit', content: 'ok' },
      ] }, toolUseResult: { filePath: file, originalFile: before, structuredPatch: [
        { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines },
      ] } },
    ];
    const journal = join(dir, 'fixture.jsonl');
    writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    const { recordingId } = await ingest.importSource('claude-code', journal);
    const result = store.observations(recordingId).find(observation => observation.kind === 'tool.result');
    const payload = result?.payload as { outcome?: { hunks?: { lines: unknown[] }[] } } | undefined;
    const storedLines = payload?.outcome?.hunks?.[0]?.lines;
    expect(storedLines).toHaveLength(2);
    for (const [index, line] of storedLines!.entries()) {
      if (!isBlobText(line)) throw new Error('Fixture line was not stored as a blob');
      expect(store.blobs.get(line.$blob)).toBe(lines[index]);
    }

    const projection = ingest.projection(recordingId);
    const edit = projection.operations.find(operation => operation.detail.kind === 'edit');
    if (!edit || edit.detail.kind !== 'edit' || edit.endSequence === undefined) throw new Error('Fixture edit was not projected');
    expect(edit.detail.hunks[0]?.lines).toEqual(lines);
    expect(asOfProjection(projection, edit.endSequence).operations.find(operation => operation.id === edit.id)?.detail)
      .toMatchObject({ kind: 'edit', hunks: [] });
    expect(asOfProjection(projection, edit.endSequence + 1).operations.find(operation => operation.id === edit.id)?.detail)
      .toMatchObject({ kind: 'edit', hunks: [{ lines }] });
  } finally {
    await ingest.close();
    store.close();
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe fixture cleanup');
    rmSync(dir, { recursive: true, force: true });
  }
});
