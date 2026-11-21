import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { test, expect } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, root: string, app: App, server: RunningServer;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-question-'));
  root = join(dir, 'repo');
  mkdirSync(root, { recursive: true });
  mkdirSync(resolve('.local'), { recursive: true });
  app = new App(dir);
  server = await startServer({ app, port: 0 });
});

test.afterAll(async () => {
  await server?.close();
  await app?.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a AskUserQuestion reads as a question with its answer, not raw JSON', async ({ page }) => {
  const timestamp = '2026-10-18T00:00:00Z', session = 'ask-q', source = join(dir, session + '.jsonl');
  const question = 'Which area should the fix start in?';
  const rows = [
    { timestamp, type: 'user', uuid: 'p', cwd: root, sessionId: session, message: { role: 'user', content: 'Fix the cart' } },
    { timestamp, type: 'assistant', cwd: root, sessionId: session, uuid: 'a1', message: { id: 'm1', role: 'assistant', content: [{ type: 'tool_use', id: 'ask1', name: 'AskUserQuestion', input: { questions: [{ question, header: 'Area', multiSelect: false, options: [{ label: 'Cart totals', description: 'src/cart' }, { label: 'Checkout', description: 'src/checkout' }] }] } }] } },
    { timestamp, type: 'user', cwd: root, sessionId: session, uuid: 'r1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'ask1', content: `The user answered: "${question}"="Cart totals"` }] } },
  ];
  writeFileSync(source, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const id = (await app.ingest.importSource('claude-code', source)).recordingId;
  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const card = page.locator('article.op').filter({ hasText: 'AskUserQuestion' }).first();
  await expect(card).toBeVisible();
  const question_card = card.getByRole('group', { name: 'Question to you' });
  await expect(question_card).toContainText(question);
  await expect(question_card).toContainText('Cart totals');
  await expect(question_card.locator('.question-header')).toContainText('Area');
  await expect(question_card.locator('.question-options li')).toHaveCount(2);
  await expect(question_card.locator('.question-options li[data-chosen]')).toHaveText(/Cart totals/);
  await expect(question_card).not.toContainText('not the offered options');
});

for (const width of [1440, 600]) {
  test(`CLI-started running question shows read-only options and Answer in Claude Code at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const timestamp = '2026-10-18T00:00:00Z', session = `cli-q-${width}`, source = join(dir, session + '.jsonl');
    const question = 'Which database migration strategy?';
    const rows = [
      { timestamp, type: 'user', uuid: 'p', cwd: root, sessionId: session, message: { role: 'user', content: 'Migrate DB' } },
      { timestamp, type: 'assistant', cwd: root, sessionId: session, uuid: 'a1', message: { id: 'm1', role: 'assistant', content: [{ type: 'tool_use', id: 'ask2', name: 'AskUserQuestion', input: { questions: [{ question, header: 'Strategy', multiSelect: false, options: [{ label: 'Zero-downtime', description: 'Dual write' }, { label: 'Lock and copy', description: 'Scheduled maintenance' }] }] } }] } },
    ];
    writeFileSync(source, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    const id = (await app.ingest.importSource('claude-code', source)).recordingId;
    await page.goto(server.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);

    const card = page.locator('.question-card-readonly').first();
    await expect(card).toBeVisible();
    await expect(card).toContainText(question);
    await expect(card).toContainText('Zero-downtime');
    await expect(card).toContainText('Lock and copy');
    // Notice badge and clear banner telling user to answer in Claude Code terminal
    await expect(card.locator('.question-terminal-banner')).toBeVisible();
    await expect(card.locator('.question-terminal-banner')).toContainText('This question is waiting in your Claude Code terminal. Answer it there.');
    await expect(card.locator('.question-answer-elsewhere-badge')).toBeVisible();
    await expect(card.locator('.question-answer-elsewhere-badge')).toHaveText('Answer in Claude Code');
    await expect(card.locator('.question-state')).toBeVisible();
    await expect(card.locator('.question-state')).toContainText('Waiting for your answer in Claude Code');
    // Options MUST NOT look clickable (no radio/checkbox marks)
    await expect(card.locator('.question-mark')).toHaveCount(0);
    await expect(card.locator('input')).toHaveCount(0);

    // Composer tells user how to answer questions from Drishya
    await expect(page.locator('.composer-terminal-notice')).toContainText('This question is waiting in your Claude Code terminal. To answer agent questions directly here in Drishya, send your prompts from this composer.');

    await page.screenshot({ path: resolve(`.local/question-card-readonly-${width}.png`) });
  });

  test(`Drishya-driven session has clickable options, sending/sent states, and reaches harness at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const timestamp = '2026-10-18T00:00:00Z', session = `driven-q-${width}`, source = join(dir, session + '.jsonl');
    const question = 'Select the target environment';
    const rows = [
      { timestamp, type: 'user', uuid: 'p', cwd: root, sessionId: session, message: { role: 'user', content: 'Deploy app' } },
      { timestamp, type: 'assistant', cwd: root, sessionId: session, uuid: 'a1', message: { id: 'm1', role: 'assistant', content: [{ type: 'tool_use', id: 'ask3', name: 'AskUserQuestion', input: { questions: [{ question, header: 'Env', multiSelect: false, options: [{ label: 'Staging', description: 'pre-prod' }, { label: 'Production', description: 'live users' }] }] } }] } },
    ];
    writeFileSync(source, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    const id = (await app.ingest.importSource('claude-code', source)).recordingId;

    const inputQuestion = {
      id: 'q0',
      header: 'Env',
      question,
      multiple: true,
      allowText: true,
      options: [
        { id: 'o0', label: 'Staging', description: 'pre-prod' },
        { id: 'o1', label: 'Production', description: 'live users' },
      ],
    };

    let controllerState: any = {
      available: true,
      harness: 'claude-code',
      state: 'approval',
      runId: 'run-driven-1',
      output: '',
      tools: [],
      inventory: 'runtime',
      approvals: [],
      inputRequests: [{ id: 'req-driven-1', questions: [inputQuestion] }],
    };

    const answersReceived: any[] = [];
    let releaseAnswer: (() => void) | undefined;

    await page.route('**/workspace', route => route.fulfill({ json: { approved: true, root, scope: 'current-workspace' } }));
    await page.route('**/controller', route => route.fulfill({ json: controllerState }));
    await page.route('**/controller/answer', async route => {
      answersReceived.push(route.request().postDataJSON());
      await new Promise<void>(done => { releaseAnswer = done; });
      controllerState = { ...controllerState, state: 'running', inputRequests: [] };
      await route.fulfill({ json: controllerState });
    });

    await page.goto(server.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);

    // Interactive form in QuestionCard
    const form = page.locator('form.question-interactive').first();
    await expect(form).toBeVisible();
    await expect(form.locator('fieldset')).toHaveAccessibleName(question);
    await expect(form.locator('.question-status-beacon')).toHaveCSS('animation-name', 'none');
    const sendBtn = form.getByRole('button', { name: 'Send answer' });
    const stopBtn = form.getByRole('button', { name: 'Stop turn' });

    await expect(sendBtn).toBeVisible();
    await expect(stopBtn).toBeVisible();
    await expect(sendBtn).toBeDisabled();
    await expect(stopBtn).toBeEnabled();

    // Click an option
    const stagingRadio = form.locator('input[value="o0"]');
    await stagingRadio.click();
    await expect(stagingRadio).toBeChecked();
    await expect(sendBtn).toBeEnabled();

    // Type optional free text
    const customText = form.locator('textarea.question-textarea');
    await customText.fill('Deploy immediately');

    // Click Send answer -> transitions to Sending...
    const submitBtn = form.locator('button[type="submit"]');
    await submitBtn.click();
    await expect(submitBtn).toHaveText('Sending…');
    await expect(submitBtn).toBeDisabled();
    await expect(stagingRadio).toBeDisabled();

    // Verify answers reached harness
    await expect.poll(() => answersReceived.length).toBe(1);
    expect(answersReceived[0]).toEqual({
      runId: 'run-driven-1',
      requestId: 'req-driven-1',
      answers: {
        q0: { options: ['o0'], text: 'Deploy immediately' },
      },
    });

    // Complete answer
    releaseAnswer!();

    // Verify receipt appears: "Sent by Drishya"
    await expect(page.locator('.question-receipt-badge').first()).toHaveText('Sent by Drishya');

    await page.screenshot({ path: resolve(`.local/question-card-driven-${width}.png`) });
  });

  test(`Deliberate stop shows Stopped by you at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const timestamp = '2026-10-18T00:00:00Z', session = `stop-q-${width}`, source = join(dir, session + '.jsonl');
    const question = 'Proceed with migration?';
    const rows = [
      { timestamp, type: 'user', uuid: 'p', cwd: root, sessionId: session, message: { role: 'user', content: 'Begin migration' } },
      { timestamp, type: 'assistant', cwd: root, sessionId: session, uuid: 'a1', message: { id: 'm1', role: 'assistant', content: [{ type: 'tool_use', id: 'ask4', name: 'AskUserQuestion', input: { questions: [{ question, header: 'Confirm', multiSelect: false, options: [{ label: 'Yes' }, { label: 'No' }] }] } }] } },
    ];
    writeFileSync(source, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    const id = (await app.ingest.importSource('claude-code', source)).recordingId;

    let stopCalled = false;
    let controllerState: any = {
      available: true,
      harness: 'claude-code',
      state: 'approval',
      runId: 'run-stop-1',
      output: '',
      tools: [],
      inventory: 'runtime',
      approvals: [],
      inputRequests: [{
        id: 'req-stop-1',
        questions: [{
          id: 'q0',
          header: 'Confirm',
          question,
          multiple: false,
          allowText: false,
          options: [{ id: 'o0', label: 'Yes', description: '' }, { id: 'o1', label: 'No', description: '' }],
        }],
      }],
    };

    await page.route('**/workspace', route => route.fulfill({ json: { approved: true, root, scope: 'current-workspace' } }));
    await page.route('**/controller', route => route.fulfill({ json: controllerState }));
    await page.route('**/controller/stop', async route => {
      stopCalled = true;
      controllerState = { ...controllerState, state: 'stopped', inputRequests: [] };
      await route.fulfill({ json: controllerState });
    });

    await page.goto(server.launchUrl);
    await expect(page.locator('.home')).toBeVisible();
    await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);

    const form = page.locator('form.question-interactive').first();
    await expect(form).toBeVisible();
    const stopBtn = form.getByRole('button', { name: 'Stop turn' });
    await stopBtn.click();

    await expect.poll(() => stopCalled).toBe(true);
    await expect(page.locator('.question-state').filter({ hasText: 'Stopped by you' })).toBeVisible();

    await page.screenshot({ path: resolve(`.local/question-card-stopped-${width}.png`) });
  });
}
