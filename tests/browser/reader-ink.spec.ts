import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test,expect,type Locator} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';

let dir:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-reader-ink-'));app=new App(join(dir,'data'));
 writeFileSync(join(dir,'reading.ts'),'type RecordValue = { count: number };\nconst value: RecordValue = { count: 42 };\n// readable metadata\nconsole.log("result", value.count);\n');
 const journal=join(dir,'sample.jsonl');writeFileSync(journal,[{type:'session_meta',payload:{id:'reader-ink',cwd:dir}},{type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text:'Inspect reading.ts'}]}}].map(row=>JSON.stringify(row)).join('\n')+'\n');
 id=(await app.ingest.importSource('codex',journal)).recordingId;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe scratch cleanup');rmSync(dir,{recursive:true,force:true});});
async function ink(node:Locator,role:string){
 await expect(node.first()).toBeVisible();
 expect(await node.first().evaluate((el,role)=>{const probe=document.createElement('span');probe.style.color=`var(${role})`;el.append(probe);const expected=getComputedStyle(probe).color;probe.remove();return getComputedStyle(el).color===expected;},role),role).toBe(true);
}
for(const theme of ['dark','light','midnight'])for(const width of [600,1440])test(`reader semantic ink ${theme} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.addInitScript(theme=>localStorage.setItem('drishya.theme',theme),theme);
 await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
 await page.goto(server.launchUrl);await page.locator('.home').waitFor();await page.goto(`${server.url}/?motion=0#/r/${id}`);
 await page.getByRole('button',{name:'Open developer workspace',exact:true}).click();const desk=page.locator('.developer-workspace');
 const approve=desk.getByRole('button',{name:'Approve workspace reading',exact:true});await expect(approve.or(desk.locator('.desk-tabs'))).toBeVisible();if(await approve.isVisible())await approve.click();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('drishya-open-workspace-file',{detail:'reading.ts'})));
 const source=desk.locator('.desk-code');await expect(source).toContainText('RecordValue');
 await ink(source.locator('.ln-no'),'--text-muted');await ink(source.locator('.tk-kw'),'--syntax-keyword');await ink(source.locator('.tk-str'),'--syntax-string');await ink(source.locator('.tk-num'),'--syntax-number');await ink(source.locator('.tk-com'),'--text-muted');
 await ink(desk.locator('.desk-document>header strong'),'--source');await ink(desk.locator('.desk-document>footer'),'--text-muted');
 await desk.getByRole('button',{name:'Edit file',exact:true}).click();await expect(desk.locator('.cm-content')).toBeVisible();
 await expect(desk.locator('.cm-content')).toContainText('RecordValue');await ink(desk.locator('.cm-gutters'),'--text-muted');
 await ink(desk.locator('.cm-content').getByText('RecordValue',{exact:true}),'--syntax-type');
 await ink(desk.locator('.cm-content').getByText('count',{exact:true}),'--syntax-property');
 // Editing remains the same retained local draft; changing a palette must not replace its material.
 await desk.locator('.cm-content').press('Control+End');await desk.locator('.cm-content').press('Enter');await desk.locator('.cm-content').pressSequentially('// retained draft');
 await expect(desk.locator('.cm-content')).toContainText('retained draft');await expect(desk.getByRole('button',{name:'Compare draft',exact:true})).toBeVisible();
});
