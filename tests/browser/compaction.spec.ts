import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { App } from '../../apps/daemon/src/app.ts';
import { startServer, type RunningServer } from '../../apps/daemon/src/server.ts';

let dir:string, app:App, server:RunningServer, claude:string, codex:string, missing:string, clean:string, livePath:string;
const at=(i:number)=>new Date(Date.UTC(2026,9,30,10,0,i)).toISOString();
const user=(i:number)=>({type:'response_item',timestamp:at(i),payload:{type:'message',role:'user',content:[{type:'input_text',text:`Synthetic prompt ${i}`}]}});
const usage=(i:number,n:number)=>({type:'event_msg',timestamp:at(i),payload:{type:'token_count',info:{model_context_window:100000,last_token_usage:{input_tokens:n}}}});
const compact=(i:number)=>({type:'compacted',timestamp:at(i),payload:{message:'',replacement_history:[{type:'compaction',encrypted_content:'synthetic-not-retained'}]}});
async function imported(name:string,harness:string,rows:unknown[]){const path=join(dir,`${name}.jsonl`);writeFileSync(path,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');return (await app.ingest.importSource(harness,path)).recordingId;}
// Working recovery persists reader pages in the daemon, beyond a browser context.
// Each case owns its scratch store so its first-page assertions start from a fresh recording.
test.beforeEach(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-compaction-browser-'));app=new App(join(dir,'data'));
  claude=await imported('claude','claude-code',[
    {type:'user',uuid:'prompt',timestamp:at(0),message:{content:'Synthetic compaction check'}},
    {type:'assistant',uuid:'u',timestamp:at(1),message:{id:'m',content:[],usage:{input_tokens:20000,cache_read_input_tokens:50000,cache_creation_input_tokens:10000,output_tokens:1234}}},
    {type:'system',uuid:'b',timestamp:at(2),subtype:'compact_boundary',compactMetadata:{preTokens:80000,postTokens:6000,durationMs:3400,trigger:'manual'}},
    {type:'user',uuid:'s',parentUuid:'b',isCompactSummary:true,timestamp:at(3),message:{content:Array.from({length:350},(_,i)=>`Synthetic retained line ${i+1}`).join('\n')}},
    {type:'user',uuid:'unlinked',parentUuid:'unknown',isCompactSummary:true,timestamp:at(4),message:{content:'Synthetic unlinked retained summary'}},
    {type:'user',uuid:'report',timestamp:at(5),message:{content:'<local-command-stdout># Context Usage\n| Category | Tokens | Usage |\n| --- | --- | --- |\n| Messages | 6k | 6% |\n| Memory files | 2k | 2% |\n| Unknown recorded row | unavailable | — |</local-command-stdout>'}},
  ]);
  codex=await imported('codex','codex',[user(0),usage(1,80000),compact(2),usage(3,9000),user(4)]);
  missing=await imported('missing','codex',[compact(1),usage(2,7000),user(3)]);
  clean=await imported('clean','codex',[user(0)]);
  livePath=join(dir,'codex.jsonl');server=await startServer({app,port:0,token:'synthetic-compaction-browser'});
});
test.afterEach(async()=>{await server?.close();await app?.close();if(dir&&resolve(dir).startsWith(resolve(tmpdir())+sep))rmSync(dir,{recursive:true,force:true});});
async function open(page:import('@playwright/test').Page,id:string,step?:number){await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?experience=modern&motion=0${step===undefined?'':`&at=${step}`}#/r/${id}`);await page.locator('.viewer').waitFor();}
for(const width of [600,1440]) test(`captured metrics, summaries and categories at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await open(page,claude);
  const boundary=page.getByRole('region',{name:'Compaction',exact:true});await boundary.scrollIntoViewIfNeeded();
  await expect(boundary).toContainText('80,000 tokens');await expect(boundary).toContainText('6,000 tokens');await expect(boundary).toContainText('manual');await expect(boundary).toContainText('3,400 ms');await expect(boundary.locator('.context-track')).toHaveCount(2);
  expect(await boundary.locator('.context-track').first().evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  expect(await boundary.locator('.context-track > span').first().evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  expect(await boundary.locator('.context-foot').evaluate(el=>getComputedStyle(el).display)).toBe('flex');
  await page.screenshot({path:resolve(`.local/content12-synthetic-receipt-${width}.png`)});
  const summary=boundary.getByRole('button',{name:'Read summary'});await summary.focus();await page.keyboard.press('Enter');
  await expect(boundary).toContainText('Synthetic retained line 1');await expect(boundary).toContainText('200 of 350');
  await boundary.getByRole('button',{name:'Next lines',exact:true}).click();await expect(boundary).toContainText('Synthetic retained line 350');
  await page.keyboard.press('Escape');await expect(summary).toBeFocused();await expect(boundary.locator('.context-summary-reader')).toHaveCount(0);
  const nearby=page.getByText('Summary recorded nearby · link not recorded',{exact:false});await nearby.scrollIntoViewIfNeeded();await expect(nearby).toBeVisible();
  const report=page.getByRole('region',{name:'Context report'});await report.scrollIntoViewIfNeeded();await expect(report).toContainText('Memory files');await expect(report).toContainText('Unknown recorded row');await expect(report).toContainText('Report from');
  await page.screenshot({path:resolve(`.local/content12-synthetic-report-${width}.png`)});
  await page.getByLabel('More workspace options',{exact:true}).click();if (!await page.locator('.usage-peek').evaluate(el => (el as HTMLDetailsElement).open)) await page.locator('.usage-peek>summary').click();await expect(page.locator('.usage-peek').getByRole('region',{name:'Context',exact:true})).toContainText('80,000');await expect(page.locator('.usage-peek').getByRole('region',{name:'Context',exact:true}).locator('[title^="Computed"]')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:resolve(`.local/content12-synthetic-${width}.png`)});
});
test('Codex request readings, encrypted/missing states and replay cutoffs',async({page})=>{
  await open(page,codex);const receipt=page.getByRole('region',{name:'Compaction',exact:true});await receipt.scrollIntoViewIfNeeded();await expect(receipt).toContainText('Request input readings around compaction');await expect(receipt).toContainText('80,000 tokens');await expect(receipt).toContainText('9,000 tokens');await expect(receipt).toContainText('Summary encrypted by harness');await expect(receipt).toContainText('Duration · Not recorded');
  const c=app.projection(codex).compactions![0]!;
  await open(page,codex,c.step);await expect(page.getByRole('region',{name:'Compaction',exact:true})).toHaveCount(0);
  await open(page,codex,c.step+1);const past=page.getByRole('region',{name:'Compaction',exact:true});await expect(past).toContainText('80,000 tokens');await expect(past).not.toContainText('9,000 tokens');
  await open(page,missing);await expect(page.getByRole('region',{name:'Compaction',exact:true})).toContainText('Last request beforeNot recorded');
  await open(page,clean);await expect(page.locator('.context-evidence,.context-report')).toHaveCount(0);
});
test('a later summary stays hidden and live append does not change past evidence',async({page})=>{
  const p=app.projection(claude), c=p.compactions![0]!;await open(page,claude,c.step+1);const receipt=page.getByRole('region',{name:'Compaction',exact:true});await expect(receipt.getByRole('button',{name:'Read summary'})).toHaveCount(0);await expect(page.locator('.context-summary-reader')).toHaveCount(0);
  await open(page,codex,app.projection(codex).compactions![0]!.step+1);
  appendFileSync(livePath,JSON.stringify(usage(6,12345))+'\n');await app.ingest.sync(codex);
  await expect(page.getByRole('region',{name:'Compaction',exact:true})).not.toContainText('12,345');
});

test('summary paging never takes focus from a deliberate outside control',async({page})=>{
  await open(page,claude);
  const boundary=page.getByRole('region',{name:'Compaction',exact:true});await boundary.getByRole('button',{name:'Read summary'}).click();
  await expect(boundary.getByRole('button',{name:'Next lines',exact:true})).toBeEnabled();
  let release!:()=>void;const waiting=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/artifacts/**?start=200&count=200',async route=>{await waiting;await route.continue();});
  try {
    await boundary.getByRole('button',{name:'Next lines',exact:true}).click();
    const outside=page.getByRole('button',{name:'Search',exact:true});await outside.focus();release();
    await expect(boundary).toContainText('Synthetic retained line 350');await expect(outside).toBeFocused();
    await page.keyboard.press('Escape');await expect(boundary.locator('.context-summary-reader')).toHaveCount(1);
  } finally { release(); }
});
