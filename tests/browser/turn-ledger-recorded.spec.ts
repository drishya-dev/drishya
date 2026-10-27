import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-turn-recorded-')); app = new App(dir); server = await startServer({ app, port: 0 }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// DATA-3 in the turn chapter: the duration is the one Codex recorded, and the settings a turn ran under appear on the first
// prompt and again only when they change. Two single-prompt turns whose recorded durations differ from what the captured
// times alone would give (the derived duration would be 4 s and 5 s).
test('a Codex turn shows its recorded duration, and its settings only when they change', async ({ page }) => {
  const stamp = (s: number) => new Date(Date.UTC(2026, 9, 22, 9, 0, s)).toISOString();
  const started = (id: string, s: number) => ({ timestamp: stamp(s), type: 'event_msg', payload: { type: 'task_started', turn_id: id, root_turn_id: id, started_at: 1792659600 + s, collaboration_mode_kind: 'default', turn_attribution: { turn_id: id, root_turn_id: id, parent_turn_id: null, initiating_agent_path: null, turn_trigger: 'composer' } } });
  const context = (id: string, s: number, effort: string) => ({ timestamp: stamp(s), type: 'turn_context', payload: { turn_id: id, root_turn_id: id, cwd: dir, model: 'synthetic-model', effort, approval_policy: 'never', sandbox_policy: { type: 'danger-full-access' }, permission_profile: { type: 'disabled' }, collaboration_mode: { mode: 'default', settings: { model: 'synthetic-model' } }, approvals_reviewer: 'user' } });
  const prompt = (s: number, text: string) => ({ timestamp: stamp(s), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
  const command = (s: number, n: number) => [
    { timestamp: stamp(s), type: 'response_item', payload: { type: 'function_call', name: 'functions.exec_command', call_id: `call-${n}`, arguments: JSON.stringify({ cmd: `echo step-${n}` }) } },
    { timestamp: stamp(s + 1), type: 'response_item', payload: { type: 'function_call_output', call_id: `call-${n}`, output: `step-${n}` } },
  ];
  const complete = (id: string, s: number, duration: number) => ({ timestamp: stamp(s), type: 'event_msg', payload: { type: 'task_complete', turn_id: id, root_turn_id: id, started_at: 1792659600, completed_at: 1792659600 + s, duration_ms: duration } });
  const rows = [
    { timestamp: stamp(0), type: 'session_meta', payload: { id: 'thread-recorded', cwd: dir, cli_version: '0.0.0-synthetic', originator: 'Codex Desktop', source: 'exec', thread_source: 'user' } },
    started('turn-1', 1), context('turn-1', 1, 'medium'), prompt(2, 'First request'), ...command(3, 1), complete('turn-1', 8, 83_000),
    started('turn-2', 20), context('turn-2', 20, 'high'), prompt(21, 'Second request'), ...command(22, 2), complete('turn-2', 27, 45_000),
  ];
  const source = join(dir, 'recorded.jsonl');
  writeFileSync(source, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  const id = (await app.ingest.importSource('codex', source)).recordingId;

  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const ledgers = page.locator('.turn-ledger');
  await expect(ledgers).toHaveCount(2);
  // 1 m 23 s and 45 s are the recorded durations; the captured times would give 6 s and 7 s.
  await expect(ledgers.nth(0)).toContainText('1 m 23 s');
  await expect(ledgers.nth(1)).toContainText('45 s');
  await expect(ledgers.nth(0)).toHaveAttribute('title', /recorded for this turn/);
  // Settings: everything on the first prompt (defaults stay out of the line), then only what changed.
  const settings = page.locator('.turn-mode');
  await expect(settings).toHaveCount(2);
  await expect(settings.nth(0)).toHaveText('synthetic-model · medium effort · never asks · full access');
  await expect(settings.nth(1)).toHaveText('high effort');
});
