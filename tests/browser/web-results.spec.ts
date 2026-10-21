import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-web-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

test('a recorded web search reads as a list of results, with click-only links',async({page})=>{
 const timestamp='2026-10-18T00:00:00Z',session='web-search',source=join(dir,session+'.jsonl');
 const links=[{title:'Federated learning poisoning survey',url:'https://arxiv.org/abs/2401.00001'},{title:'Back to the "Drawing" Board',url:'https://paperswithcode.com/paper/back'},{title:'SPoiL: Sybil-based poisoning',url:'https://link.springer.com/chapter/x'}];
 const result=`Web search results for query: "federated poisoning"\n\nLinks: ${JSON.stringify(links)}\n\nA summary the harness wrote.`;
 const rows=[
  {timestamp,type:'user',uuid:'p',cwd:dir,sessionId:session,message:{role:'user',content:'Find papers on federated poisoning'}},
  {timestamp,type:'assistant',cwd:dir,sessionId:session,uuid:'a1',message:{id:'m1',role:'assistant',content:[{type:'tool_use',id:'web1',name:'WebSearch',input:{query:'federated poisoning'}}]}},
  {timestamp,type:'user',cwd:dir,sessionId:session,uuid:'r1',message:{role:'user',content:[{type:'tool_result',tool_use_id:'web1',content:result}]}},
 ];
 writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('claude-code',source)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 const card=page.locator('article.op').filter({hasText:'federated poisoning'}).first();await expect(card).toBeVisible();
 const items=card.locator('.web-results li');await expect(items).toHaveCount(3);
 await expect(items.nth(0)).toContainText('arxiv.org');await expect(items.nth(1)).toContainText('Back to the "Drawing" Board');
 await expect(items.nth(0).locator('a')).toHaveAttribute('rel','noopener noreferrer');
 await expect(items.nth(0).locator('a')).toHaveAttribute('href','https://arxiv.org/abs/2401.00001');
 if(process.env.WEB_SHOT)await card.screenshot({path:resolve('.local/web-card.png')});
});
