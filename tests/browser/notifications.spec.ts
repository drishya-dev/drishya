import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-notify-'));app=new App(dir);
 const timestamp='2026-10-20T10:00:00Z',path=join(dir,'s.jsonl');
 writeFileSync(path,[{type:'session_meta',timestamp,payload:{id:'notify',cwd:dir}},{type:'response_item',timestamp,payload:{type:'message',role:'assistant',content:[{type:'output_text',text:'a reply'}]}}].map(row=>JSON.stringify(row)).join('\n')+'\n');
 id=(await app.ingest.importSource('codex',path)).recordingId;server=await startServer({app,port:0});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

const stub=(permission:'default'|'denied')=>`(()=>{window.__asked=0;class N{static permission='${permission}';static async requestPermission(){window.__asked++;N.permission='granted';return 'granted';}constructor(){}close(){}}window.Notification=N;})();`;
const open=async(page:import('@playwright/test').Page)=>{await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern#/r/${id}`);await expect(page.locator('.history article, .history .prose').first()).toBeVisible();await page.getByRole('button',{name:'Workspace settings',exact:true}).click();await page.getByRole('tab',{name:'Reading'}).or(page.getByRole('button',{name:'Reading',exact:true})).first().click();};

test('notifications ask for permission only when the reader opts in, and remember the choice',async({page})=>{
 await page.addInitScript(stub('default'));
 await open(page);
 expect(await page.evaluate(()=>(window as any).__asked)).toBe(0);
 const toggle=page.getByRole('checkbox',{name:/Notify when the agent needs me or finishes/});
 await expect(toggle).not.toBeChecked();
 await toggle.check();await expect(toggle).toBeChecked();
 expect(await page.evaluate(()=>(window as any).__asked)).toBe(1);
 expect(await page.evaluate(()=>localStorage.getItem('drishya.notify'))).toBe('1');
 await toggle.uncheck();expect(await page.evaluate(()=>localStorage.getItem('drishya.notify'))).toBe('0');
});
test('a browser that blocked notifications shows why and cannot be toggled on',async({page})=>{
 await page.addInitScript(stub('denied').replace("N.permission='denied'","N.permission='denied'"));
 await page.addInitScript(()=>{(window as any).Notification.permission='denied';});
 await open(page);
 const toggle=page.getByRole('checkbox',{name:/Notify when the agent needs me or finishes/});
 await expect(toggle).toBeDisabled();await expect(page.getByText(/Blocked in your browser/)).toBeVisible();
});
