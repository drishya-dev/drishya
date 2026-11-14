// SEC-3 integration: move these additive cases to tests/security once that owner lands.
import {mkdtemp, mkdir, readFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {request} from 'node:http';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {App} from '../src/app.ts';
import {EmbedCodes} from '../src/embed-auth.ts';
import {startServer, type RunningServer} from '../src/server.ts';

let home: string, normal: RunningServer, embedded: RunningServer, id: string, time = 10;
const codes = new EmbedCodes(() => time);
const fixture = fileURLToPath(new URL('../../../fixtures/synthetic/claude/checkout-fix.jsonl',import.meta.url));
beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(),'drishya-embed-security-'));
  const app = new App(join(home,'embed')); id = (await app.ingest.importSource('claude-code',fixture)).recordingId;
  normal = await startServer({port:0,dataDir:join(home,'normal')});
  embedded = await startServer({port:0,app,embedCodes:codes,now:()=>time,sessionIdleMs:1000,sessionMaxAgeMs:2000,maxSessions:2});
});
afterAll(async () => {for (const s of [normal,embedded]) {await s.close();await s.app.close();} await rm(home,{recursive:true,force:true});});
async function call(server:RunningServer,path:string, options:{method?:string;body?:string;headers?:Record<string,string>}={}) {
  const u = new URL(server.url);
  return new Promise<{status:number;headers:Record<string,unknown>;text:string}>( (resolve,reject) => {
    const req = request({host:'127.0.0.1',port:u.port,path,method:options.method??'GET',headers:{host:u.host,...options.headers}},res=>{
      let text='';res.on('data',c=>{text+=c;});res.on('end',()=>resolve({status:res.statusCode!,headers:res.headers,text}));
    });req.on('error',reject);req.end(options.body);
  });
}
const exchange=(code:string,extra:Record<string,string>={},recordingId=id) => call(embedded,'/v1/embed/session',{method:'POST',headers:{'content-type':'application/json',...extra},body:JSON.stringify({code,recordingId})});
function cookie(result:{headers:Record<string,unknown>}) {return (result.headers['set-cookie'] as string[])[0]!.split(';')[0]!;}
const safeCheck=(condition: boolean)=>expect(condition).toBe(true); // never dump credentials in failed expectations
it('embed-default-headers: every security header equals normal main policy',async()=>{
  for(const path of ['/', '/?embed=1', '/v1/health']) {
    const a=await call(normal,path),b=await call(embedded,path);
    for(const h of ['content-security-policy','x-frame-options','x-content-type-options','referrer-policy','cross-origin-opener-policy','cross-origin-resource-policy'])
      safeCheck(a.headers[h]===b.headers[h]);
    expect(b.headers['x-frame-options']).toBe('DENY');
    expect(b.headers['content-security-policy']).toBe("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  }
});
it('embed refused when disabled, public minting absent, non-loopback refused',async()=>{
  expect((await call(normal,'/v1/embed/session',{method:'POST'})).status).toBe(404);
  expect((await call(embedded,'/v1/embed/mint',{method:'POST'})).status).toBe(401);
  await expect(startServer({host:'0.0.0.0'})).rejects.toThrow('loopback');
});
it('launch exchange keeps Host, Origin and JSON gates, never returns failed input',async()=>{
  const code=codes.mint(id);
  expect((await exchange(code,{host:'evil.invalid'})).status).toBe(421);
  for(const origin of ['https://evil.invalid','null','file://','http://127.0.0.1:1']) expect((await exchange(code,{origin})).status).toBe(403);
  for(const type of ['text/plain','application/x-www-form-urlencoded','application/json-evil']) expect((await exchange(code,{'content-type':type})).status).toBe(415);
  expect((await call(embedded,'/v1/embed/session?code=synthetic',{method:'POST',headers:{'content-type':'application/json'}})).status).toBe(400);
  expect((await exchange(code,{authorization:'Bearer synthetic'})).status).toBe(400);
  expect((await call(embedded,'/v1/embed/session',{method:'POST',headers:{'content-type':'application/json'},body:'{'})).status).toBe(400);
  expect((await call(embedded,'/v1/embed/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({large:'x'.repeat(2048)})})).status).toBe(413);
  expect((await exchange('invalid')).status).toBe(401);
  const invalid=await exchange(code,{},'rec_0000000000000000');expect(invalid.status).toBe(401);safeCheck(!invalid.text.includes(code));
  expect((await exchange(code,{},id)).status).toBe(200);
});
it('single use is atomic, strict cookie reads APIs and expires/revokes normally',async()=>{
  const code=codes.mint(id);
  const results=await Promise.all([exchange(code),exchange(code)]);expect(results.map(r=>r.status).sort()).toEqual([200,401]);
  const good=results.find(r=>r.status===200)!;safeCheck(!good.text.includes(code));
  const raw=(good.headers['set-cookie'] as string[])[0]!;
  safeCheck(raw.includes('HttpOnly')&&raw.includes('SameSite=Strict')&&raw.includes('Path=/'));
  expect(good.headers['cache-control']).toBe('no-store');
  const sid=cookie(good);expect((await call(embedded,'/v1/config',{headers:{cookie:sid}})).status).toBe(200);
  time+=1001;expect((await call(embedded,'/v1/config',{headers:{cookie:sid}})).status).toBe(401);
  const second=await exchange(codes.mint(id));const revoked=cookie(second);
  expect((await call(embedded,'/v1/session',{method:'DELETE',headers:{cookie:revoked}})).status).toBe(200);
  expect((await call(embedded,'/v1/config',{headers:{cookie:revoked}})).status).toBe(401);
});
it('launch codes expire, cap, bind recording and instance, and clear',()=>{
  let clock=0;const c=new EmbedCodes(()=>clock);const first=c.mint('r');
  safeCheck(!c.consume(first,'other'));clock=60_000;safeCheck(!c.consume(first,'r'));
  const old=c.mint('r');for(let i=0;i<32;i++) c.mint('r');safeCheck(!c.consume(old,'r'));
  const fresh=c.mint('r');safeCheck(!new EmbedCodes().consume(fresh,'r'));c.clear();safeCheck(!c.consume(fresh,'r'));
});
