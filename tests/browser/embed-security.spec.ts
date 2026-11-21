import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer,type Server} from 'node:http';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {EmbedCodes} from '../../apps/daemon/src/embed-auth.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let home:string,server:RunningServer,parent:Server,parentUrl:string,id:string;
const codes=new EmbedCodes();
test.beforeAll(async()=>{
 home=await mkdtemp(join(tmpdir(),'drishya-embed-browser-'));const ui=join(home,'ui');await mkdir(ui);
 await writeFile(join(ui,'index.html'),'<!doctype html><title>Embed security</title><p>Top-level document</p>');
 await writeFile(join(ui,'frame.html'),'<!doctype html><title>Same origin frame</title><iframe src="/?embed=1"></iframe>');
 const app=new App(join(home,'data'));id=(await app.ingest.importSource('claude-code',resolve('fixtures/synthetic/claude/checkout-fix.jsonl'))).recordingId;
 server=await startServer({app,port:0,uiDir:ui,embedCodes:codes});
 parent=createServer((_req,res)=>{res.setHeader('content-type','text/html');res.end('<!doctype html><title>Cross origin frame</title><iframe src="'+server.url+'/?embed=1"></iframe>');});
 await new Promise<void>(resolve=>parent.listen(0,'127.0.0.1',resolve));parentUrl='http://127.0.0.1:'+(parent.address() as {port:number}).port;
});
test.afterAll(async()=>{await new Promise<void>(resolve=>parent.close(()=>resolve()));await server.close();await server.app.close();await rm(home,{recursive:true,force:true});});
for(const width of [360,600,1440]) {
 test('top-level strict-cookie handoff and authenticated SSE at '+width,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto(server.url+'/?embed=1');
  const code=codes.mint(id);
  const answer=await page.evaluate(async({code,id})=>{const r=await fetch('/v1/embed/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,recordingId:id})});return{status:r.status,body:await r.json()};},{code,id});
  expect(answer.status).toBe(200);expect(answer.body.recordingId).toBe(id);
  expect(await page.evaluate(()=>document.cookie.includes('drishya_session'))).toBe(false);
  const statuses=await page.evaluate(async()=>{return await Promise.all(['/v1/config','/v1/recordings'].map(async p=>(await fetch(p)).status));});expect(statuses).toEqual([200,200]);
  const sync=await page.evaluate(()=>new Promise<boolean>(resolve=>{const stream=new EventSource('/v1/changes');const timer=setTimeout(()=>{stream.close();resolve(false);},5000);stream.addEventListener('sync',()=>{clearTimeout(timer);stream.close();resolve(true);});}));expect(sync).toBe(true);
 });
 for(const cross of [false,true]) test('framing remains refused '+(cross?'cross':'same')+' origin at '+width,async({page})=>{
  const blocked:string[]=[];
  page.on('console',message=>{if(/frame-ancestors|X-Frame-Options/i.test(message.text())) blocked.push('blocked');});
  await page.setViewportSize({width,height:900});await page.goto(cross?parentUrl:server.url+'/frame.html');
  await expect.poll(()=>blocked.length>0).toBe(true);
  const text=await page.locator('iframe').evaluate((frame:HTMLIFrameElement)=>{try{return frame.contentDocument?.body?.textContent??null;}catch{return null;}});
  expect(text?.includes('Top-level document')??false).toBe(false);
 });
}
