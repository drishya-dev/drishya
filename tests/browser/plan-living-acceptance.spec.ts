import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';
import { PLAN_ITEMS, PLAN_REVISIONS, planItems, planPrompt, planRows } from '../fixtures/plan-living.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-living-plan-browser-'));
  app = new App(join(dir, 'store'));
  server = await startServer({ app, port: 0 });
});
test.afterAll(async () => {
  await server?.close(); await app?.close();
  if (dir) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path');
    rmSync(dir, { recursive: true, force: true });
  }
});
const serialize = (rows: readonly object[]) => rows.map(row => JSON.stringify(row)).join('\n') + '\n';
async function open(page: Page, id: string, at?: number) {
  await page.goto(`${server.url}/?experience=modern&motion=0${at === undefined ? '' : `&at=${at}`}#/r/${id}`);
  await expect(page.getByRole('region', { name: 'Session work' })).toBeVisible();
}

for (const width of [600, 1440]) test(`reading choices survive new plan data, replay and reload at ${width}px`, async ({page}) => {
  await page.setViewportSize({width, height: 960});
  const session = `disclosures-${width}`, source = join(dir, session + '.jsonl');
  writeFileSync(source, serialize([planPrompt(dir, session), ...planRows(dir, session, 0),
    {type:'assistant',uuid:'mcp-disclosure-call',sessionId:session,message:{role:'assistant',content:[{type:'tool_use',id:'probe-call',name:'mcp__fixture__probe',input:{value:'Synthetic visible tool'}}]}},
    {type:'user',uuid:'mcp-disclosure-result',sessionId:session,message:{role:'user',content:[{type:'tool_result',tool_use_id:'probe-call',content:'Synthetic visible result'}]}}
  ]));
  const id = (await app.ingest.importSource('claude-code', source)).recordingId;
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible(); await open(page, id);
  const checklist = page.locator('.plan-card[role=group]');
  await expect(checklist.locator('li')).toHaveCount(10);
  await expect(checklist.getByRole('button', {name:'Show all 12 items · 2 more',exact:true})).toBeVisible();
  const serverTools = page.locator('.md-server').filter({has:page.locator('summary span', {hasText:'fixture'})});
  const tools = page.getByRole('button',{name:'Tools',exact:true});
  if (await tools.isVisible()) await tools.click();
  await expect(serverTools).toHaveAttribute('open','');
  await expect(serverTools.getByRole('button', {name:/probe/})).toBeVisible();
  const inventory = page.locator('.tool-list');
  await expect(inventory).toHaveAttribute('open','');
  await inventory.locator('summary').click();
  await serverTools.locator('summary').click();
  await checklist.getByRole('button',{name:'Collapse plan',exact:true}).press('Enter');
  await expect(checklist.locator('li')).toHaveCount(0);
  appendFileSync(source, serialize(planRows(dir, session, 1))); await app.ingest.sync(id);
  await expect(checklist).toContainText('Revision 2');
  await expect(checklist.locator('li')).toHaveCount(0);
  await page.reload(); await page.locator('.history').waitFor();
  await expect(checklist.getByRole('button',{name:'Show plan',exact:true})).toBeVisible();
  await expect(checklist.locator('li')).toHaveCount(0);
  await expect(inventory).not.toHaveAttribute('open');
  await expect(serverTools).not.toHaveAttribute('open');
  const projection = app.projection(id), first = projection.operations.find(op=>op.kind==='plan')!;
  await open(page,id,first.startSequence+1);
  await expect(checklist.getByRole('button',{name:'Show plan',exact:true})).toBeVisible();
  await expect(checklist).toContainText('Revision 1');
  await checklist.getByRole('button',{name:'Show plan',exact:true}).press('Enter');
  await expect(checklist.locator('li')).toHaveCount(10);
  await expect(checklist.locator('li.plan-completed')).toHaveCount(0);
  await checklist.getByRole('button',{name:'Show all 12 items · 2 more',exact:true}).press('Enter');
  await expect(checklist.locator('li')).toHaveCount(12);
  await open(page,id); await expect(checklist.locator('li')).toHaveCount(12);
  await page.reload(); await expect(checklist.locator('li')).toHaveCount(12);
  await page.locator('.workspace-menu > summary[aria-label="More workspace options"]').click();
  await expect(page.locator('.usage-peek')).toHaveAttribute('open','');
  await expect(page.locator('.session-identity')).toHaveAttribute('open','');
  await page.locator('.usage-peek summary').click();
  await page.locator('.session-identity summary').click();
  await page.reload();
  await page.locator('.workspace-menu > summary[aria-label="More workspace options"]').click();
  await expect(page.locator('.usage-peek')).not.toHaveAttribute('open');
  await expect(page.locator('.session-identity')).not.toHaveAttribute('open');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Go to checklist',exact:true}).press('Enter');
  await expect(page.locator('article.op-plan').last()).toBeInViewport();
});

for (const width of [600, 1440]) test(`thirteen revisions keep one live checklist and every earlier list readable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 960 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const session = `living-${width}`, source = join(dir, session + '.jsonl');
  writeFileSync(source, serialize([planPrompt(dir, session), ...planRows(dir, session, 0)]));
  const id = (await app.ingest.importSource('claude-code', source)).recordingId;
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible(); await open(page, id);
  const pinned = page.locator('.turn .plan-pinned');
  await expect(pinned).toHaveCount(1); await expect(pinned).toContainText('Plan · 0 of 12 done');
  await pinned.evaluate(el => el.setAttribute('data-acceptance-stable', 'yes'));
  for (let revision = 1; revision < PLAN_REVISIONS; revision++) {
    // Only this synthetic scratch journal is appended. Native journals are never written.
    appendFileSync(source, serialize(planRows(dir, session, revision)));
    await app.ingest.sync(id);
    await expect(pinned).toContainText(`Plan · ${revision} of 12 done · revision ${revision + 1}`);
    await expect(pinned).toHaveAttribute('data-acceptance-stable', 'yes');
    await expect(page.locator('.plan-card[role=group] li')).toHaveCount(10);
    if (revision < PLAN_ITEMS) await expect(page.locator('.plan-card[role=group] li.plan-in_progress')).toContainText(planItems(revision)[revision]!.content);
    await expect(page.locator('article.op-plan .plan-list')).toHaveCount(1);
    await expect(page.getByRole('group', { name: 'Plan checklist' })).toHaveCount(1);
  }
  const checklist = page.locator('.plan-card[role=group]');
  const showAll = checklist.getByRole('button', { name: 'Show all 12 items · 2 more', exact: true });
  await showAll.focus(); await showAll.press('Enter');
  await expect(checklist.locator('li')).toHaveCount(12);
  await expect(checklist.locator('li.plan-completed')).toHaveCount(12);
  await expect(checklist.locator('.plan-text').first()).toHaveCSS('text-decoration-line', 'line-through');
  await expect(checklist.getByRole('button', { name: 'Show fewer', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await checklist.getByRole('button', { name: 'Show fewer', exact: true }).press('Enter');
  await expect(page.locator('.plan-card[role=group] li')).toHaveCount(10);

  const cards = page.locator('article.op-plan');
  await expect(cards).toHaveCount(PLAN_REVISIONS);
  const expand = cards.last().locator('button.op-expand');
  await expand.focus(); await expand.press('Enter');
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  const full = cards.last().locator('.plan-material');
  await expect(full).toBeVisible();
  for (let revision = PLAN_REVISIONS; revision >= 1; revision--) {
    await expect(full).toContainText(`Revision ${revision} · ${revision - 1} of 12 done`);
    await expect(full.locator('li')).toHaveCount(12);
    await expect(full.locator('li.plan-completed')).toHaveCount(revision - 1);
    if (revision > 1) await full.getByRole('button', { name: 'Earlier revision', exact: true }).press('Enter');
  }
  await expect(full.getByRole('button', { name: 'Earlier revision', exact: true })).toBeDisabled();
  for (let revision = 2; revision <= PLAN_REVISIONS; revision++) {
    await full.getByRole('button', { name: 'Later revision', exact: true }).press('Enter');
    await expect(full).toContainText(`Revision ${revision} · ${revision - 1} of 12 done`);
  }
  await expect(full.getByRole('button', { name: 'Later revision', exact: true })).toBeDisabled();
  await expand.press('Enter');
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  const follow = page.getByRole('switch', { name: 'Automatically follow new work', exact: true });
  if (await follow.getAttribute('aria-checked') === 'true') await follow.click();
  await pinned.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await expect(pinned).toBeInViewport();
  await page.screenshot({ path: resolve(`.local/content4/fixture-live-${width}.png`), animations: 'disabled' });
  expect(await pinned.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);

  // Seek backward after all future snapshots are already stored. No final list may leak back.
  const projection = app.projection(id);
  for (const revision of [0, 6, 12, 1]) {
    const op = projection.operations[revision]!;
    const step = projection.timeline.findIndex(item => item.type === 'op-start' && item.operationId === op.id) + 1;
    await open(page, id, step);
    await expect(pinned).toHaveCount(1);
    await expect(pinned).toContainText(`Plan · ${revision} of 12 done`);
    await expect(pinned).toHaveAttribute('title', `The agent's newest todo list, revision ${revision + 1} of ${revision + 1}`);
    await expect(page.locator('article.op-plan .plan-list')).toHaveCount(1);
  }
  await open(page, id, 0); await expect(pinned).toHaveCount(0);
  await open(page, id); await expect(pinned).toContainText('Plan · 12 of 12 done · revision 13');
});

test('unknown and empty states use a neutral mark, retain literal accessible status and claim no transition', async ({ page }) => {
  const session = 'living-unknown', source = join(dir, session + '.jsonl');
  const rows: object[] = [planPrompt(dir, session)];
  for (let revision = 0; revision < 2; revision++) {
    const pair = planRows(dir, session, revision);
    const input = pair[0]!.message.content[0]!.input;
    if (!input) throw new Error('Missing synthetic TodoWrite input');
    input.todos = [
      { content: 'Unfamiliar state', status: revision ? 'pending' : 'waiting-for-review', activeForm: 'Checking' },
      { content: 'Still unfamiliar', status: 'waiting-for-review', activeForm: 'Checking' },
      { content: 'Missing state', status: '', activeForm: 'Checking' },
    ];
    rows.push(...pair);
  }
  writeFileSync(source, serialize(rows));
  const id = (await app.ingest.importSource('claude-code', source)).recordingId;
  await page.setViewportSize({ width: 1024, height: 960 });
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible(); await open(page, id);
  const pinned = page.locator('.plan-card[role=group]');
  await expect(pinned).toContainText('0 of 3 done');
  const unfamiliar = pinned.locator('li').filter({ hasText: 'Still unfamiliar' });
  const missing = pinned.locator('li').filter({ hasText: 'Missing state' });
  await expect(unfamiliar.locator('.plan-mark')).toHaveText('·');
  await expect(unfamiliar.locator('.sr-only')).toHaveText('(waiting-for-review)');
  await expect(missing.locator('.plan-mark')).toHaveText('·');
  await expect(missing).not.toHaveClass(/plan-pending/);
  const last = page.locator('article.op-plan').last();
  await expect(last.locator('.plan-delta')).toHaveCount(0);
  const expand = last.locator('button.op-expand'); await expand.focus(); await expand.press('Enter');
  await expect(last.locator('.plan-material .plan-change')).toHaveCount(0);
});

for (const width of [600, 1440]) test(`native task results update one checklist and preserve duplicate labels at ${width}px`, async ({ page }) => {
 await page.setViewportSize({ width, height: 960 });
 const session = `native-tasks-${width}`, source = join(dir, session + '.jsonl');
 const base = {cwd:dir,sessionId:session,timestamp:'2026-10-27T00:00:00Z'};
 let ordinal=0;
 const pair=(tool:string,input:unknown,result:unknown)=>{
  const id=`native-task-${ordinal++}`;
  return [{...base,type:'assistant',uuid:`a-${id}`,message:{id:`m-${id}`,role:'assistant',content:[{type:'tool_use',id,name:tool,input}]}},
   {...base,type:'user',uuid:`r-${id}`,toolUseResult:result,message:{role:'user',content:[{type:'tool_result',tool_use_id:id,content:'Synthetic confirmed task result'}]}}];
 };
 const first=pair('TaskCreate',{subject:'Same label'},{task:{id:'1',subject:'Same label'}});
 const second=pair('TaskCreate',{subject:'Same label'},{task:{id:'2',subject:'Same label'}});
 writeFileSync(source,serialize([planPrompt(dir,session),...first,...second]));
 const id=(await app.ingest.importSource('claude-code',source)).recordingId;
 await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible(); await open(page,id);
 const pinned=page.locator('.plan-card[role=group]'); await expect(pinned).toHaveCount(1);
 await expect(pinned.locator('li')).toHaveCount(2); await expect(pinned.locator('.plan-mark')).toHaveText(['·','·']);
 const progress=page.locator('.turn .plan-pinned'); await progress.evaluate(el=>el.setAttribute('data-stable-native','yes'));
 for(let revision=0;revision<12;revision++){
  const taskId=String(revision%2+1),status=revision<10?'in_progress':'completed';
  appendFileSync(source,serialize(pair('TaskUpdate',{taskId,status,...(revision===10?{subject:'Renamed checkpoint'}:{})},
   {success:true,taskId,updatedFields:revision===10?['status','subject']:['status'],statusChange:{from:'in_progress',to:status}})));
  await app.ingest.sync(id);
  await expect(pinned).toContainText(`Revision ${revision+3}`);
  await expect(progress).toHaveAttribute('data-stable-native','yes');
 }
 await expect(pinned).toContainText('2 of 2 done'); await expect(pinned).toContainText('Renamed checkpoint');
 await expect(pinned.locator('li')).toHaveCount(2);
 await expect(page.locator('article.op-plan .plan-list')).toHaveCount(1);
 const receipt=page.locator('article.op-plan').first();
 await expect(receipt).toHaveCSS('border-top-width','0px');
 await expect(receipt.locator('button.op-expand')).toBeVisible();
 const path='C:/Synthetic/.claude/plans/captured.md',body='# Native plan file\n\n- Verify content';
 appendFileSync(source,serialize(pair('Write',{file_path:path,content:body},{type:'create',filePath:path,content:body})));
 await app.ingest.sync(id);
 const planFile=page.getByRole('region',{name:'Plan file'});
 await expect(planFile.getByRole('heading',{name:'Native plan file'})).toBeVisible();
 if(width===1440) expect((await planFile.locator('xpath=ancestor::article[1]').boundingBox())!.width).toBeGreaterThan(320);
 expect(await planFile.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await expect(pinned).toHaveCount(1);
 await page.screenshot({path:`.local/content4-native/synthetic-native-${width}.png`});
});
for (const width of [600,1440]) test(`Codex explicit proposal renders Markdown without checklist completion at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:960});
 const source=join(dir,`proposal-${width}.jsonl`);
 writeFileSync(source,serialize([
  {type:'session_meta',payload:{id:`proposal-${width}`,cwd:dir}},
  {type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Prepare a synthetic proposal'}]}},
  {type:'response_item',payload:{type:'message',role:'assistant',content:[{type:'output_text',text:'<proposed_plan>\n# Captured proposal\n\n1. Read the source\n2. Verify the result\n</proposed_plan>'}]}},
 ]));
 const id=(await app.ingest.importSource('codex',source)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await open(page,id);
 const proposal=page.getByRole('region',{name:'Proposed plan'});
 await expect(proposal.getByRole('heading',{name:'Proposal'})).toBeVisible();
 await expect(proposal.locator('ol li')).toHaveCount(2);
 await expect(proposal).toContainText('Proposal · not an approval');
 await expect(page.locator('.plan-pinned')).toHaveCount(0);
 await expect(page.locator('.prose')).toHaveCount(0);
});


test('reasoning defaults follow Settings until a reader makes a persistent local choice', async ({page}) => {
  await page.setViewportSize({width:1440,height:960});
  const session='reasoning-defaults',source=join(dir,session+'.jsonl');
  writeFileSync(source,serialize([planPrompt(dir,session),{type:'assistant',uuid:'reasoning-defaults-answer',sessionId:session,message:{role:'assistant',content:[{type:'thinking',thinking:'Synthetic available reasoning.'},{type:'text',text:'Synthetic ordinary answer.'}]}}]));
  const id=(await app.ingest.importSource('claude-code',source)).recordingId;
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await open(page,id);
  const reasoning=page.locator('.prose-reasoning'),toggle=reasoning.locator('.prose-label');
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  const detail=async(value:string)=>{
    await page.getByRole('button',{name:'Workspace settings',exact:true}).click();
    await page.getByRole('dialog',{name:'Workspace settings',exact:true}).getByRole('tab',{name:'Reading',exact:true}).click();
    await page.getByLabel('Exposed reasoning detail',{exact:true}).selectOption(value);
    await page.getByRole('button',{name:'Close Workspace settings',exact:true}).click();
  };
  await detail('collapsed');await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('.prose-assistant')).toContainText('Synthetic ordinary answer.');
  await detail('expanded');await expect(toggle).toHaveAttribute('aria-expanded','true');
  await toggle.press('Enter');await expect(toggle).toHaveAttribute('aria-expanded','false');
  await detail('collapsed');await detail('expanded');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await page.reload();await expect(toggle).toHaveAttribute('aria-expanded','false');
  await toggle.press('Enter');await expect(toggle).toHaveAttribute('aria-expanded','true');
});
