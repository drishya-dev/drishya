import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve, sep} from 'node:path';
import {spawn} from 'node:child_process';
import {test, expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer, type RunningServer} from '../../apps/daemon/src/server.ts';
import {HarnessController} from '../../apps/daemon/src/controller.ts';

let dir: string, app: App, server: RunningServer, id: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-approval-clearance-'));
  const root = join(dir, 'repo'); mkdirSync(root);
  writeFileSync(join(root, 'sample.txt'), 'Synthetic approval regression.\n');
  const journal = join(dir, 'session.jsonl');
  writeFileSync(journal, JSON.stringify({type:'user', uuid:'prompt', sessionId:'55555555-5555-4555-8555-555555555555', cwd:root, timestamp:'2026-11-05T10:00:00Z', message:{role:'user',content:'Synthetic approval clearance'}})+'\n');
  const transport = join(dir, 'harness.mjs');
  writeFileSync(transport, `import {createInterface} from 'node:readline';
const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');
createInterface({input:process.stdin}).on('line',line=>{const x=JSON.parse(line);
if(x.type==='control_request')send({type:'control_response',response:{subtype:'success',request_id:x.request_id,response:{models:[],commands:[]}}});
if(x.type==='user')send({type:'control_request',request_id:'one',request:{subtype:'can_use_tool',tool_name:'Bash',input:{command:'node -e "console.log(123)"'}}});
if(x.type==='control_response')send({type:'result',is_error:false,result:'Synthetic decision received'});
});`);
  app = new App(join(dir,'store')); id = (await app.ingest.importSource('claude-code',journal)).recordingId;
  server = await startServer({app,port:0,controllerFactory:(a,w)=>new HarnessController(a,w,{resolveExecutable:()=>process.execPath,launch:((_bin:string,_args:string[],options:any)=>spawn(process.execPath,[transport],options)) as typeof spawn})});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe cleanup');rmSync(dir,{recursive:true,force:true});}});

for(const width of [600,1440]) test(`approval clearance grows and releases without covering the waiting line at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto(server.launchUrl);await page.locator('.mh-home').waitFor();
  await page.goto(`${server.url}/#/r/${id}`);await page.locator('.history').waitFor();
  const composer=page.getByRole('region',{name:'Harness prompt'});
  const expand=composer.getByRole('button',{name:'Expand prompt',exact:true});if(await expand.count())await expand.click();
  await composer.locator('.native-options > summary').click();
  const status=await (await page.request.get(`${server.url}/v1/recordings/${id}/workspace`)).json();
  if(!status.approved)await composer.getByRole('button',{name:'Enable this workspace',exact:true}).click();
  await composer.locator('.native-options > summary').click();
  for(const decision of ['Decline','Allow once']){
    await composer.locator('textarea').fill('Synthetic approval regression');
    await composer.getByRole('button',{name:'Send prompt',exact:true}).click();
    const idle=composer.getByRole('checkbox',{name:'This session is idle in other clients'});if(await idle.count()){await idle.check();await composer.getByRole('button',{name:'Confirm and send',exact:true}).click();}
    await expect(composer.locator('.tool-approval')).toBeVisible();
    const gap=()=>page.locator('.viewer').evaluate(el=>parseFloat(getComputedStyle(el).getPropertyValue('--composer-raised-gap'))||0);
    await expect.poll(gap).toBeGreaterThan(100);
    await expect.poll(()=>page.evaluate(()=>{const line=document.querySelector('.native-phase')!.getBoundingClientRect(),panel=document.querySelector('.native-turn-details')!.getBoundingClientRect();return line.bottom<=panel.top;})).toBe(true);
    await composer.getByRole('button',{name:decision,exact:true}).click();
    await expect(composer.locator('.tool-approval')).toHaveCount(0);
    await expect.poll(gap).toBe(0);
    await expect(composer.getByRole('button',{name:'Send prompt',exact:true})).toBeVisible();
  }
});

// Harsh's review of CONNECT-2: the measurement must not store geometry sampled while the composer is scaled
// (useSurfaceReflow animates it for 200 ms), and must follow a receipt's visibility, which changes with Follow.
const raisedGap = (page: import('@playwright/test').Page) => page.locator('.viewer').evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--composer-raised-gap')) || 0);
async function openComposer(page: import('@playwright/test').Page, recording: string, width: number) {
  await page.setViewportSize({width, height: 900}); await page.goto(server.launchUrl); await page.locator('.mh-home').waitFor();
  await page.goto(`${server.url}/#/r/${recording}`); await page.locator('.history').waitFor();
  const composer = page.getByRole('region', {name: 'Harness prompt'});
  const expand = composer.getByRole('button', {name: 'Expand prompt', exact: true}); if (await expand.count()) await expand.click();
  await composer.locator('.native-options > summary').click();
  const status = await (await page.request.get(`${server.url}/v1/recordings/${recording}/workspace`)).json();
  if (!status.approved) await composer.getByRole('button', {name: 'Enable this workspace', exact: true}).click();
  await composer.locator('.native-options > summary').click();
  return composer;
}

for (const width of [600, 1440]) test(`approval clearance ignores geometry sampled while the composer is scaled at ${width}`, async ({page}) => {
  const composer = await openComposer(page, id, width);
  await composer.locator('textarea').fill('Synthetic approval regression');
  await composer.getByRole('button', {name: 'Send prompt', exact: true}).click();
  const idle = composer.getByRole('checkbox', {name: 'This session is idle in other clients'}); if (await idle.count()) { await idle.check(); await composer.getByRole('button', {name: 'Confirm and send', exact: true}).click(); }
  await expect(composer.locator('.tool-approval')).toBeVisible();
  await expect.poll(() => raisedGap(page)).toBeGreaterThan(100);
  const settled = await raisedGap(page);
  // Stand in for the middle of the 200 ms expand animation, then force a measurement while scaled.
  await composer.evaluate(node => { node.style.transformOrigin = 'bottom left'; node.style.transform = 'scale(.4)'; const probe = document.createElement('span'); node.append(probe); probe.remove(); });
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  expect(Math.abs(await raisedGap(page) - settled)).toBeLessThanOrEqual(1);
  await composer.evaluate(node => { node.style.transform = ''; node.style.transformOrigin = ''; });
  await composer.getByRole('button', {name: 'Decline', exact: true}).click();
  await expect(composer.locator('.tool-approval')).toHaveCount(0);
});

for (const width of [600, 1440]) test(`a queue receipt's clearance follows the Follow switch at ${width}`, async ({page}) => {
  const root = join(dir, 'repo'), journal = join(dir, 'queue-session.jsonl'), sessionId = '66666666-6666-4666-8666-666666666666';
  const row = (n: number, type: string, extra: Record<string, unknown>) => JSON.stringify({type, uuid: `66666666-6666-4666-8666-${String(n).padStart(12, '0')}`, sessionId, cwd: root, timestamp: `2026-11-05T10:00:0${n}Z`, ...extra});
  writeFileSync(journal, [row(1, 'user', {message: {role: 'user', content: 'Synthetic receipt prompt'}}), row(2, 'queue-operation', {operation: 'enqueue', content: 'Synthetic queued input'}), row(3, 'queue-operation', {operation: 'dequeue'})].join('\n') + '\n');
  const queued = (await app.ingest.importSource('claude-code', journal)).recordingId;
  const composer = await openComposer(page, queued, width);
  const follow = page.getByRole('switch', {name: 'Automatically follow new work'});
  await expect(composer.getByRole('button', {name: 'Read queued inputs', exact: true})).toHaveCount(1);
  if (await follow.getAttribute('aria-checked') === 'true') await follow.click();
  await expect(follow).toHaveAttribute('aria-checked', 'false');
  // Follow off: the receipt's button is visibility:hidden, so it reserves nothing.
  await expect.poll(() => raisedGap(page)).toBe(0);
  // Follow on removes that inline style without changing a size or a child.
  await follow.click();
  await expect(follow).toHaveAttribute('aria-checked', 'true');
  await expect(composer.getByRole('button', {name: 'Read queued inputs', exact: true})).toBeVisible();
  await expect.poll(() => raisedGap(page)).toBeGreaterThan(0);
});
