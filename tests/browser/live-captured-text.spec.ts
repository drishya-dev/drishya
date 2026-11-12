import {test, expect, type Page} from '@playwright/test';
import {appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve, sep} from 'node:path';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer, type RunningServer} from '../../apps/daemon/src/server.ts';

// Regression fixtures are deliberately synthetic; genuine acceptance receipts stay in .local/.
let dir: string, journal: string, app: App, server: RunningServer, id: string, serial: number;
const sessionId = '00000000-0000-4000-8000-000000000777';
function row(type: string, payload: Record<string, unknown>) {
  const n = serial++;
  return {type, uuid: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, sessionId,
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString(), cwd: dir, ...payload};
}
function queue(operation: string, content?: unknown, queueId?: string) {
  return row('queue-operation', {operation, ...(content !== undefined ? {content} : {}), ...(queueId ? {queueId} : {})});
}
function prose(text: string) { return row('assistant', {message: {role: 'assistant', content: [{type: 'text', text}]}}); }
async function append(rows: Record<string, unknown>[]) {
  appendFileSync(journal, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  await app.ingest.sync(id);
}
async function open(page: Page, at?: number) {
  await page.goto(server.launchUrl);
  await expect.poll(() => page.evaluate(() => location.hash.includes('token='))).toBe(false);
  await page.goto(`${server.url}/?motion=0${at === undefined ? '' : `&at=${at}`}#/r/${id}`);
  await expect(page.locator('.history')).toBeVisible();
}
const receipts = (page: Page) => page.getByRole('dialog', {name: 'Queued inputs', exact: true});
async function openReceipts(page: Page) {
  await page.getByRole('button', {name: 'Read queued inputs', exact: true}).click();
  await expect(receipts(page)).toBeVisible();
  return receipts(page);
}
async function apiQueue(page: Page, params = '') {
  const response = await page.request.get(`${server.url}/v1/recordings/${id}/queue${params}`);
  expect(response.ok()).toBe(true);
  return response.json();
}
test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-live-queue-browser-')); serial = 1; journal = join(dir, 'session.jsonl');
  writeFileSync(journal, [row('user', {message: {role: 'user', content: 'Synthetic original prompt'}}), prose('Synthetic original response.')].map(r => JSON.stringify(r)).join('\n') + '\n');
  app = new App(join(dir, 'data')); id = (await app.ingest.importSource('claude-code', journal)).recordingId;
  server = await startServer({app, port: 0, token: 'synthetic-queue-browser'});
});
test.afterEach(async () => {
  await server?.close(); await app?.close();
  const target = resolve(dir); if (!target.startsWith(resolve(tmpdir()) + sep)) throw Error('Unsafe scratch directory');
  rmSync(target, {recursive: true, force: true});
});

for (const width of [600, 1440]) {
  test(`queue receipts precede delivery and anonymous changes remain unknown at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    await append([queue('enqueue', 'Synthetic pending input\nsecond line\t@literal')]);
    await open(page);
    const dialog = await openReceipts(page);
    await expect(dialog.locator('[data-queued-input-text]')).toHaveText('Synthetic pending input\nsecond line\t@literal');
    await expect(dialog.getByText('Queue receipt recorded', {exact: true})).toBeVisible();
    await page.screenshot({path: resolve(`.local/live5-queue-${width}.png`)});
    expect(app.projection(id).timeline.filter(t => t.type === 'turn')).toHaveLength(1);
    await append([queue('dequeue')]);
    await expect(dialog.getByText('No inputs waiting.', {exact: true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Read queued inputs',exact:true})).toHaveText('Queued inputs');
    await dialog.getByRole('button',{name:'Earlier receipts · history',exact:true}).click();
    await expect(dialog.getByRole('button',{name:/Synthetic pending input/})).toBeVisible();
    const pageData = await apiQueue(page);
    expect(pageData.items).toHaveLength(1); expect(pageData.items[0].state).toBe('unknown');
    expect(app.projection(id).timeline.filter(t => t.type === 'turn')).toHaveLength(1);
    await append([row('attachment', {attachment: {type: 'queued_command', prompt: 'Synthetic pending input\nsecond line\t@literal', timestamp: new Date().toISOString()}})]);
    await expect.poll(() => app.projection(id).timeline.filter(t => t.type === 'turn').length).toBe(2);
    expect((await apiQueue(page)).items[0].state).toBe('delivered');
    await dialog.getByRole('button', {name: 'Close Queued inputs', exact: true}).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test(`complete Unicode queued input and every older receipt remain reachable at ${width}px`, async ({page, context}) => {
    await page.setViewportSize({width, height: 900});
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      const write = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = async value => {
        (window as Window & {copiedQueueInput?: string}).copiedQueueInput = value;
        await write(value);
      };
    });
    const original = 'Synthetic literal formatting\n\t@start\r\n' + 'दृश्य🙂'.repeat(45000) + '\nEND';
    await append([...Array.from({length: 77}, (_, n) => queue('enqueue', `Synthetic queue item ${n}`)), queue('enqueue', original)]);
    await open(page); const dialog = await openReceipts(page);
    await expect(dialog.getByRole('button', {name: 'Read more input', exact: true})).toBeVisible();
    expect(Buffer.byteLength(await dialog.locator('[data-queued-input-text]').innerText())).toBeLessThanOrEqual(256 * 1024);
    await dialog.getByRole('button', {name: 'Copy complete input', exact: true}).click();
    await expect(dialog.getByRole('button', {name: 'Copied', exact: true})).toBeVisible();
    // The OS clipboard can normalize CRLF; the submitted capture must remain byte-faithful.
    expect(await page.evaluate(() => (window as Window & {copiedQueueInput?: string}).copiedQueueInput)).toBe(original);
    expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(original.replace(/\r\n/g, '\n'));
    await expect(dialog.locator('[data-queued-input-text]')).toHaveText(original);
    await expect(dialog.getByRole('button', {name: 'Read more input', exact: true})).toHaveCount(0);
    await page.screenshot({path: resolve(`.local/live5-queue-long-${width}.png`)});
    const selected = new Set<string>(); let before: number | undefined;
    do {
      const data = await apiQueue(page, '?count=50' + (before === undefined ? '' : `&before=${before}`));
      expect(data.total).toBe(78); expect(data.items.length).toBeLessThanOrEqual(50);
      for (const item of data.items) {expect(selected.has(item.id)).toBe(false); selected.add(item.id);}
      before = data.before;
    } while (before !== undefined);
    expect(selected.size).toBe(78);
    for (let pageIndex = 0; pageIndex < 3; pageIndex++) await dialog.getByRole('button', {name: 'Earlier receipts', exact: true}).click();
    await expect(dialog.getByRole('button', {name: /Synthetic queue item 0 · Queue receipt recorded/})).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Earlier receipts', exact: true})).toHaveCount(0);
    await dialog.getByRole('button', {name: /Synthetic queue item 0 · Queue receipt recorded/}).click();
    await expect(dialog.locator('[data-queued-input-text]')).toHaveText('Synthetic queue item 0');
    const count = app.store.countObservations(id); await app.ingest.sync(id); await app.ingest.importSource('claude-code', journal);
    expect(app.store.countObservations(id)).toBe(count); expect((await apiQueue(page)).total).toBe(78);
    expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  });

  test(`a image-only queue receipt is readable without creating a delivered prompt at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    const bytes = readFileSync(resolve('apps/ui/public/brand/drishya-192.png')).toString('base64');
    await append([queue('enqueue', [{type: 'image', source: {type: 'base64', media_type: 'image/png', data: bytes}}])]);
    await open(page); const dialog = await openReceipts(page);
    const image = dialog.getByRole('img', {name: 'Queued input image 1', exact: true});
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await expect(dialog.locator('[data-queued-input-text]')).toHaveText('No text recorded.');
    expect(app.projection(id).timeline.filter(t => t.type === 'turn')).toHaveLength(1);
    expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await append([row('attachment',{attachment:{type:'queued_command',prompt:[{type:'image',source:{type:'base64',media_type:'image/png',data:bytes}}]}})]);
    await expect(dialog.getByText('No inputs waiting.',{exact:true})).toBeVisible();
    expect(await apiQueue(page)).toMatchObject({pendingTotal:0,items:[{state:'delivered'}]});
    await dialog.getByRole('button',{name:'Earlier receipts · history',exact:true}).click();
    await dialog.getByRole('button',{name:/Image input/}).click();
    await expect(dialog.getByRole('img',{name:'Queued input image 1',exact:true})).toBeVisible();
  });
}

test('native removal and prompt-confirmed delivery preserve replay boundaries', async ({page}) => {
  await append([queue('enqueue', 'Synthetic removed input', 'remove-me'), queue('enqueue', 'Synthetic delivered input', 'deliver-me'), queue('enqueue', 'Synthetic still pending input', 'pending')]);
  const captured = app.projection(id), queues = captured.timeline.filter(t => t.type === 'queue');
  const firstBoundary = queues[0]!;
  await append([queue('remove', undefined, 'remove-me'), row('attachment', {attachment: {type: 'queued_command', queueId: 'deliver-me', prompt: 'Synthetic delivered input'}}), queue('dequeue')]);
  await open(page);
  const data = await apiQueue(page);
  expect(data.items.map((r: {state: string}) => r.state)).toEqual(['unknown', 'delivered', 'removed']);
  const first = await apiQueue(page, `?through=${firstBoundary.sourceObservationId}`);
  expect(first.total).toBe(1); expect(first.items[0].state).toBe('recorded');
  expect((await page.request.get(`${server.url}/v1/recordings/${id}/queue/${data.items[0].id}?through=${firstBoundary.sourceObservationId}`)).status()).toBe(404);
  await open(page, captured.timeline.indexOf(firstBoundary) + 1);
  const dialog = await openReceipts(page);
  await expect(dialog.getByText('1 waiting · 1 recorded enqueue receipts at this replay point', {exact: true})).toBeVisible();
  await expect(dialog.locator('[data-queued-input-text]')).toHaveText('Synthetic removed input');
  await expect(dialog.getByText('Queue receipt recorded', {exact: true})).toBeVisible();
  await expect(dialog.getByRole('button', {name: /Synthetic delivered input/})).toHaveCount(0);
});

test('replay uses timeline order rather than physical append order and preserves agent ownership', async ({page}) => {
  const future = {...queue('enqueue', 'Synthetic future by clock', 'future'), timestamp: '2026-01-01T00:00:20Z'};
  const child = {...queue('enqueue', 'Synthetic child queue', 'shared'), timestamp: '2026-01-01T00:00:12Z', isSidechain: true, agentId: 'queue-child'};
  const childRemoval = {...queue('remove', undefined, 'shared'), timestamp: '2026-01-01T00:00:13Z', isSidechain: true, agentId: 'queue-child'};
  const earlier = {...queue('enqueue', 'Synthetic earlier main queue', 'shared'), timestamp: '2026-01-01T00:00:10Z'};
  await append([future, child, childRemoval, earlier]);
  const projection = app.projection(id), boundary = projection.timeline.find(t => t.type === 'queue' && t.preview === 'Synthetic earlier main queue')!;
  if (boundary?.type !== 'queue') throw Error('Synthetic queue boundary missing');
  await open(page, projection.timeline.indexOf(boundary) + 1);
  const shown = await apiQueue(page, `?through=${boundary.sourceObservationId}`);
  expect(shown.total).toBe(1); expect(shown.items[0].preview).toBe('Synthetic earlier main queue'); expect(shown.items[0].state).toBe('recorded');
  const all = await apiQueue(page);
  expect(all.items.find((r: {preview: string}) => r.preview === 'Synthetic earlier main queue').state).toBe('recorded');
  expect(all.items.find((r: {preview: string}) => r.preview === 'Synthetic child queue').state).toBe('removed');
  const dialog = await openReceipts(page);
  await expect(dialog.getByText('1 waiting · 1 recorded enqueue receipts at this replay point', {exact: true})).toBeVisible();
  await expect(dialog.locator('[data-queued-input-text]')).toHaveText('Synthetic earlier main queue');
  await expect(dialog.getByRole('button', {name: /Synthetic future by clock|Synthetic child queue/})).toHaveCount(0);
});

test('paged replay retains its physical queue boundary when every queue event is outside the 128-item tail', async ({page}) => {
  test.setTimeout(120_000);
  await append([...Array.from({length: 10005}, (_, n) => queue('enqueue', `Synthetic old receipt ${n}`)), ...Array.from({length: 140}, (_, n) => prose(`Synthetic later prose ${n}.`))]);
  const prior = app.projection(id), replayStep = prior.timeline.length;
  await append([queue('enqueue', 'Synthetic future receipt')]);
  const history = await app.history.page(id, {step: replayStep, count: 2});
  expect(history.projection.timeline.some(t => t.type === 'queue')).toBe(false);
  expect(history.queueBoundary).toBeDefined(); expect(history.queueBoundary!.ownerRecordingId).toBe(id);
  await open(page, replayStep); const dialog = await openReceipts(page);
  await expect(dialog.getByText('10005 waiting · 10005 recorded enqueue receipts at this replay point', {exact: true})).toBeVisible();
  await expect(dialog.getByRole('button', {name: /Synthetic future receipt/})).toHaveCount(0);
  await expect(dialog.locator('[data-queued-input-text]')).toHaveText('Synthetic old receipt 10004');
});

test('an exported bundle retains queue text and ambiguous outcomes without controller authority', async ({page}) => {
  await append([queue('enqueue', 'Synthetic exported queue\n@literal'), queue('dequeue'), queue('enqueue', 'Synthetic pending export\n@literal')]);
  const bundle = await app.exportBundle(id), bundlePath = join(dir, 'bundle.json'); writeFileSync(bundlePath, JSON.stringify(bundle));
  await page.route('**/synthetic-queue-bundle.json', route => route.fulfill({status: 200, contentType: 'application/json', body: readFileSync(bundlePath, 'utf8')}));
  await page.goto(`${server.url}/?bundle=/synthetic-queue-bundle.json&motion=0`);
  await expect(page.locator('.history')).toBeVisible(); const dialog = await openReceipts(page);
  await expect(page.getByRole('button',{name:'Read queued inputs',exact:true})).toHaveText('Queued inputs · 1');
  await dialog.getByRole('button',{name:'Earlier receipts · history',exact:true}).click();
  await dialog.getByRole('button',{name:/Synthetic exported queue/}).click();
  await expect(dialog.locator('[data-queued-input-text]')).toHaveText('Synthetic exported queue\n@literal');
  await expect(dialog.getByText('Queue changed · item outcome unknown', {exact: true})).toBeVisible();
  await expect(page.getByRole('textbox', {name: /Prompt/})).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

// LIVE-5 (1): text the harness wrote is on screen as soon as it is observed, with no tool call, result or prompt after it.
test('text appended alone to a live recording shows without any later record', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await open(page);
  for (const text of ['Synthetic text alone one', 'Synthetic text alone two']) {
    const at = Date.now();
    await append([prose(text)]);
    await expect(page.getByText(text, {exact: false}).first()).toBeVisible({timeout: 3000});
    expect(Date.now() - at).toBeLessThan(3000);
  }
  // A tool call that is still running does not hold back the text written before it.
  await append([prose('Synthetic text before a running call'), row('assistant', {message: {role: 'assistant', content: [{type: 'tool_use', id: 'toolu_run', name: 'Bash', input: {command: 'sleep 30', description: 'Synthetic slow command'}}]}})]);
  await expect(page.getByText('Synthetic text before a running call', {exact: false}).first()).toBeVisible({timeout: 3000});
});


for(const width of [600,1440])test(`completed turns clear pending without inventing delivery at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await append([queue('enqueue','Synthetic not observed as a prompt')]);
 await open(page);const dialog=await openReceipts(page);
 await expect(page.getByRole('button',{name:'Read queued inputs',exact:true})).toHaveText('Queued inputs · 1');
 const queuedStep=app.projection(id).timeline.length;
 await append([row('assistant',{message:{id:'synthetic-completion',role:'assistant',content:[{type:'text',text:'Synthetic whole final answer'}],stop_reason:'end_turn'}})]);
 await expect(dialog.getByText('No inputs waiting.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Read queued inputs',exact:true})).toHaveText('Queued inputs');
 expect(await apiQueue(page)).toMatchObject({total:1,pendingTotal:0,items:[{state:'unknown'}]});
 const count=app.store.countObservations(id);await app.ingest.rescan(id);expect(app.store.countObservations(id)).toBe(count);
 await dialog.getByRole('button',{name:'Earlier receipts · history',exact:true}).click();
 await dialog.getByRole('button',{name:/Synthetic not observed as a prompt/}).click();
 await expect(dialog.locator('[data-queued-input-text]')).toHaveText('Synthetic not observed as a prompt');
 await page.reload();
 await expect(page.getByRole('button',{name:'Read queued inputs',exact:true})).toHaveCount(0);
 await expect(page.getByText('Queued inputs')).toHaveCount(0);
 await open(page,queuedStep);await openReceipts(page);
 await expect(receipts(page).getByRole('button',{name:/Synthetic not observed as a prompt/})).toBeVisible();
 expect((await apiQueue(page,`?step=${queuedStep}`)).pendingTotal).toBe(1);
});

for(const width of [600,1440])test(`matching prompt clears only the oldest duplicate without a queue mutation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await append([queue('enqueue','Synthetic identical prompt'),queue('enqueue','Synthetic identical prompt')]);
 await open(page);const dialog=await openReceipts(page);
 await expect(page.getByRole('button',{name:'Read queued inputs',exact:true})).toHaveText('Queued inputs · 2');
 await append([row('attachment',{attachment:{type:'queued_command',prompt:'Synthetic identical prompt'}})]);
 await expect(page.getByRole('button',{name:'Read queued inputs',exact:true})).toHaveText('Queued inputs · 1');
 await expect(dialog.getByRole('button',{name:/Synthetic identical prompt/})).toHaveCount(1);
 expect(await apiQueue(page)).toMatchObject({pendingTotal:1,items:[{state:'recorded'},{state:'delivered'}]});
 await append([row('attachment',{attachment:{type:'queued_command',prompt:'Synthetic identical prompt'}})]);
 await expect(dialog.getByText('No inputs waiting.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Read queued inputs',exact:true})).toHaveText('Queued inputs');
 await dialog.getByRole('button',{name:'Earlier receipts · history',exact:true}).click();
 await expect(dialog.getByRole('button',{name:/Synthetic identical prompt/})).toHaveCount(2);
});
