// Opt-in invented workload; output belongs outside tracked fixtures. No native inputs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openSync, closeSync, writeSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function generateLargeJournal(path: string, megabytes: number) {
  assert.ok(Number.isFinite(megabytes) && megabytes >= 1 && megabytes <= 2000, 'size must be 1..2000 decimal MB');
  // Calibrate observation amplification, not an undocumented exact private distribution:
  // 4,400 wrappers yield 8,803 legacy and 26,593 DATA-1/2 observations at 560 MB.
  // Token receipts yield two observations; 190 extra cumulative-only receipts fill the ratio.
  const cycles = Math.max(8, Math.round(4400 * megabytes / 560));
  const extraUsage = Math.round(190 * cycles / 4400);
  const fd = openSync(path, 'wx', 0o600);
  const hash = createHash('sha256');
  let bytes = 0, records = 0, maxRecordBytes = 0;
  const counts: Record<string, number> = {};
  const write = (type: string, payload: unknown) => {
    const line = JSON.stringify({ timestamp: new Date(Date.UTC(2026, 0, 1) + records * 1000).toISOString(), type, payload }) + '\n';
    const buffer = Buffer.from(line);
    for (let offset = 0; offset < buffer.length;) offset += writeSync(fd, buffer, offset, buffer.length - offset);
    hash.update(buffer); bytes += buffer.length; records++;
    maxRecordBytes = Math.max(maxRecordBytes, buffer.length);
    const p = payload as { type?: string; item?: { type: string } };
    const key = p.item?.type ?? p.type ?? type; counts[key] = (counts[key] ?? 0) + 1;
  };
  const usage = (n: number, last: boolean) => ({ type: 'token_count', info: {
    total_token_usage: { input_tokens: n * 100, output_tokens: n * 30, total_tokens: n * 130 },
    ...(last ? { last_token_usage: { input_tokens: 100, output_tokens: 30, total_tokens: 130 } } : {}), model_context_window: 200000,
  } });
  const weights = [1, 1, 1, 1, 2, 2, 4, 20];
  try {
    write('session_meta', { id: 'invented-performance-session', cwd: '/synthetic/workspace', cli_version: 'synthetic-perf' });
    write('event_msg', { type: 'task_started', turn_id: 'invented-turn' });
    for (let i = 0; i < cycles; i++) {
      const weight = weights[i % weights.length]!;
      const size = Math.floor(megabytes * 1e6 / cycles * weight / 4);
      const path = `src/module-${i}.ts`;
      // Deliberately varied patch/output sizes; exact private size histograms were not published.
      const patchLines = i % 7 === 0 ? [16, 64, 512, 2048][Math.floor(i / 7) % 4]! : 0;
      const diff = '@@ -1 +1 @@\n' + Array.from({ length: patchLines }, (_, n) => `-export const old${n} = ${i};\n+export const new${n} = ${i + 1};`).join('\n');
      const patch = `*** Begin Patch\n*** Update File: ${path}\n${diff.replace('@@ -1 +1 @@', '@@')}\n*** End Patch`;
      const command = `echo invented-${i}`;
      const code = patchLines ? `text(await tools.apply_patch(${JSON.stringify(patch)})); text(await tools.exec_command({cmd:${JSON.stringify(command)}}));` : `text(await tools.exec_command({cmd:${JSON.stringify(command)}}));`;
      write('response_item', { type: 'function_call', name: 'functions.exec', call_id: `call-${i}`, arguments: JSON.stringify({ code }) });
      // Unique, readable, invented output prevents accidental cross-operation blob dedup.
      const line = `Synthetic operation ${i}: alpha beta gamma delta epsilon zeta eta theta.\n`;
      const outputSize = Math.max(256, Math.floor((size - code.length - diff.length - 2200) / 2));
      const output = line.repeat(Math.ceil(outputSize / line.length)).slice(0, outputSize);
      write('event_msg', { type: 'item_completed', turn_id: 'invented-turn', item: { type: 'CommandExecution', id: `command-${i}`, command: ['pwsh', '-Command', command], status: 'completed', exit_code: 0, duration: { secs: 0, nanos: 1000000 }, aggregated_output: output } });
      const item = patchLines ? { type: 'FileChange', id: `patch-${i}`, status: 'completed', changes: { [path]: { type: 'update', unified_diff: diff } }, stdout: 'Applied synthetic patch' }
        : i % 20 === 0 ? { type: 'McpToolCall', id: `mcp-${i}`, server: 'synthetic', tool: 'lookup', status: 'completed', result: { content: [{ type: 'text', text: `Invented result ${i}` }], isError: false } }
        : { type: 'CommandExecution', id: `second-${i}`, command: ['pwsh', '-Command', `echo second-${i}`], status: 'completed', exit_code: 0, aggregated_output: `Invented second result ${i}` };
      write('event_msg', { type: 'item_completed', turn_id: 'invented-turn', item });
      write('response_item', { type: 'function_call_output', call_id: `call-${i}`, output });
      write('event_msg', usage(i + 1, true));
      if (Math.floor((i + 1) * extraUsage / cycles) > Math.floor(i * extraUsage / cycles)) write('event_msg', usage(i + 1, false));
    }
    write('event_msg', { type: 'task_complete', turn_id: 'invented-turn' });
  } finally { closeSync(fd); }
  return { workload: 'invented-structure-matched-v1', requestedMB: megabytes, bytes, records, maxRecordBytes, cycles,
    expectedLegacyObservations: cycles * 2 + 3, expectedObservations: cycles * 6 + extraUsage + 3, counts, sha256: hash.digest('hex') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [path, size] = process.argv.slice(2);
  assert.ok(path && size, 'usage: node scripts/make-large-journal.ts <new-output.jsonl> <decimal-MB>');
  console.log(JSON.stringify(generateLargeJournal(resolve(path), Number(size))));
}
