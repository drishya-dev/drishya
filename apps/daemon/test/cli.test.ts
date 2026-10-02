import { spawn } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

// B1 (audit A09): `drishya import --live` used to import once and exit, ignoring the flag.
const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'drishya-cli-'));
// Windows keeps a killed child's files locked for a moment, so cleanup retries.
afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }));

const line = (uuid: string, text: string) =>
  JSON.stringify({ type: 'user', uuid, sessionId: 's', cwd: '/w', version: '2.1.0', timestamp: '2026-10-02T10:00:00Z', message: { role: 'user', content: text } }) + '\n';

describe('drishya import --live', () => {
  it('keeps following the journal and reports what arrives', async () => {
    const file = join(dir, 'live.jsonl');
    writeFileSync(file, line('l1', 'start'));
    const child = spawn(process.execPath, [cli, 'import', file, '--live'], { env: { ...process.env, DRISHYA_HOME: join(dir, 'home') }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    const waitFor = async (text: string) => {
      const end = Date.now() + 15_000;
      while (!out.includes(text)) {
        if (Date.now() > end || child.exitCode !== null) throw new Error(`never saw "${text}"; output:\n${out}`);
        await new Promise((ok) => setTimeout(ok, 50));
      }
    };
    try {
      await waitFor('Following.');
      appendFileSync(file, line('l2', 'more'));
      await waitFor('+1 observations');
      expect(child.exitCode).toBeNull(); // still running, not imported-and-gone
    } finally {
      const exited = new Promise((ok) => child.once('exit', ok));
      child.kill();
      await exited;
    }
  }, 30_000);
});
