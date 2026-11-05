import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer;
test.beforeAll(async () => { dir = mkdtempSync(join(tmpdir(), 'drishya-codex-questions-')); app = new App(dir); server = await startServer({ app, port: 0 }); });
test.afterAll(async () => { await server?.close(); await app?.close(); if (dir) { if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe temporary path'); rmSync(dir, { recursive: true, force: true }); } });

// CONTENT-3: a Codex question is the same card Claude gets. The call and result shapes below are the ones real Codex journals
// record: `request_user_input_async` with `title` and string options (or none), answered by `{"accepted":true}`.
test('Codex questions show as question cards with their offered options and no invented answer', async ({ page }) => {
  const stamp = (s: number) => new Date(Date.UTC(2026, 9, 22, 9, 0, s)).toISOString();
  const call = (s: number, id: string, questions: object[]) => [
    { timestamp: stamp(s), type: 'response_item', payload: { type: 'function_call', name: 'request_user_input_async', call_id: id, arguments: JSON.stringify({ questions }) } },
    { timestamp: stamp(s + 1), type: 'response_item', payload: { type: 'function_call_output', call_id: id, output: '{"accepted":true}' } },
  ];
  const rows = [
    { timestamp: stamp(0), type: 'session_meta', payload: { id: 'thread-questions', cwd: dir, cli_version: '0.0.0-synthetic', originator: 'Codex Desktop', source: 'exec' } },
    { timestamp: stamp(1), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Plan the change' }] } },
    ...call(2, 'q1', [{ title: 'Which approach should I take?', options: ['Small patch', 'Rewrite the module'] }]),
    ...call(5, 'q2', [{ title: 'Anything I should avoid touching?' }]),
  ];
  const source = join(dir, 'questions.jsonl');
  writeFileSync(source, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  const id = (await app.ingest.importSource('codex', source)).recordingId;

  await page.goto(server.launchUrl);
  await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  const cards = page.locator('.question-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).locator('.question-text')).toHaveText('Which approach should I take?');
  await expect(cards.nth(0).locator('.question-options li')).toHaveText(['Small patch', 'Rewrite the module']);
  await expect(cards.nth(0).locator('[data-chosen]')).toHaveCount(0);
  await expect(cards.nth(0)).toContainText('Codex recorded the question as accepted; the answer is not part of this record');
  await expect(cards.nth(1).locator('.question-text')).toHaveText('Anything I should avoid touching?');
  await expect(cards.nth(1).locator('.question-options li')).toHaveCount(0);
  await expect(cards.nth(1)).toContainText('No offered options were recorded.');
  await expect(cards.nth(1)).not.toContainText('keeps the question and the answer');
});

for(const width of [600,1440])test(`native Codex request_user_input keeps structured options and its exact keyed answer at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:950});
  const timestamp='2026-10-29T00:00:00Z',source=join(dir,`native-question-${width}.jsonl`);
  writeFileSync(source,[
    {timestamp,type:'session_meta',payload:{id:`native-question-${width}`,cwd:dir,cli_version:'synthetic'}},
    {timestamp,type:'event_msg',payload:{type:'user_message',message:'Synthetic native question'}},
    {timestamp,type:'response_item',payload:{type:'function_call',name:'request_user_input',call_id:'native-question',arguments:JSON.stringify({questions:[{id:'check',header:'Check',question:'Which check?',options:[{label:'Alpha',description:'First'},{label:'Beta',description:'Second'}]}]})}},
    {timestamp,type:'response_item',payload:{type:'function_call_output',call_id:'native-question',output:JSON.stringify({answers:{check:{answers:['Alpha']}}})}},
  ].map(row=>JSON.stringify(row)).join('\n')+'\n');
  const id=(await app.ingest.importSource('codex',source)).recordingId;
  await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?motion=0#/r/${id}`);
  const card=page.locator('.question-card');await expect(card).toHaveCount(1);
  await expect(card.locator('.question-options li')).toHaveCount(2);
  await expect(card.locator('.question-description')).toHaveText(['First','Second']);
  await expect(card.locator('[data-chosen] .question-label')).toHaveText('Alpha (chosen)');
  await expect(card).toContainText('Question and answer');
});

for(const width of [600,1440])test(`approval presents the literal command or replacement before an exact one-time decision at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:950});
 const source=join(dir,`approval-${width}.jsonl`),timestamp='2026-10-29T00:00:00Z';
 writeFileSync(source,JSON.stringify({timestamp,type:'session_meta',payload:{id:`approval-${width}`,cwd:dir,cli_version:'synthetic'}})+'\n');
 const id=(await app.ingest.importSource('codex',source)).recordingId;
 const command='printf "literal @ value\nnext line"',replacement={file_path:'fixture.txt',old_string:'alpha\n  kept',new_string:'beta\n  kept',replace_all:false};
 let state:any={available:true,harness:'codex',state:'approval',runId:'exact-run',output:'',tools:[],inventory:'runtime',approvals:[{id:'exact-command',name:'Command execution',detail:JSON.stringify({command,cwd:dir})},{id:'exact-edit',name:'Edit',detail:JSON.stringify(replacement)},{id:'missing-patch',name:'File change',detail:JSON.stringify({itemId:'file-item',grantRoot:dir})}]};
 const decisions:unknown[]=[];
 await page.route('**/workspace',route=>route.fulfill({json:{approved:true,root:dir,scope:'current-workspace'}}));
 await page.route('**/controller',route=>route.fulfill({json:state}));
 await page.route('**/controller/approval',route=>{decisions.push(route.request().postDataJSON());state={...state,state:'completed',approvals:[]};return route.fulfill({json:state});});
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?motion=0#/r/${id}`);
 const approvals=page.locator('.tool-approval');await expect(approvals).toHaveCount(3);
 await expect(approvals.nth(2)).toContainText('did not supply a proposed diff');await expect(approvals.nth(2).getByRole('button',{name:'Allow once',exact:true})).toBeDisabled();
 await expect(approvals.nth(0).getByLabel('Command awaiting approval')).toHaveText(command);
 await expect(approvals.nth(1).getByLabel('Proposed replacement')).toContainText('- alpha');await expect(approvals.nth(1).getByLabel('Proposed replacement')).toContainText('+ beta');
 await approvals.nth(1).getByRole('button',{name:'Original',exact:true}).click();await expect(approvals.nth(1).getByLabel('Native approval request')).toHaveText(JSON.stringify(replacement));
 await approvals.nth(0).getByRole('button',{name:'Decline',exact:true}).click();await expect(approvals).toHaveCount(0);
 expect(decisions).toEqual([{runId:'exact-run',approvalId:'exact-command',allow:false}]);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
