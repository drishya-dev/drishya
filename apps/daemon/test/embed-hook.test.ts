import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {expect,it} from 'vitest';
const hook=fileURLToPath(new URL('../../../docs/guides/drishya-hook.mjs',import.meta.url));
it('blocks /drishya with an explicit error when exact Claude session identity is unavailable',()=>{
 for(const session_id of [undefined,'','../../other','-option','short']) {
  const result=spawnSync(process.execPath,[hook],{input:JSON.stringify({prompt:'/drishya',session_id,cwd:'Z:/missing-drishya-test-checkout'}),encoding:'utf8'});
  expect(JSON.parse(result.stdout)).toMatchObject({decision:'block',reason:expect.stringMatching(/session ID/)});
 }
});
it('requires the hook checkout rather than silently using its own process directory',()=>{
 const result=spawnSync(process.execPath,[hook],{input:JSON.stringify({prompt:'/drishya',session_id:'valid-session-123'}),encoding:'utf8'});
 expect(JSON.parse(result.stdout)).toMatchObject({decision:'block',reason:expect.stringMatching(/checkout/)});
});
it('passes ordinary prompts and malformed input through without starting the launcher',()=>{
 for(const input of ['{',JSON.stringify({prompt:'explain /drishya'})]) {
  const result=spawnSync(process.execPath,[hook],{input,encoding:'utf8'});
  expect(result.status).toBe(0);expect(result.stdout).toBe('');
 }
});

it.runIf(process.platform==='win32')('runs the installed npm CLI directly, ignoring a checkout drishya.cmd',()=>{
 const root=mkdtempSync(join(tmpdir(),'drishya-hook-'));
 try {
  const cwd=join(root,'checkout'),bin=join(root,'global bin'),capture=join(root,'args.json'),attack=join(root,'shadowed');
  mkdirSync(cwd);mkdirSync(join(bin,'node_modules/drishya/apps/daemon/src'),{recursive:true});
  writeFileSync(join(cwd,'drishya.cmd'),`@echo shadowed > "${attack}"`);
  writeFileSync(join(bin,'node_modules/drishya/apps/daemon/src/cli.mjs'),"import {writeFileSync} from 'node:fs';writeFileSync(process.env.DRISHYA_TEST_ARGS,JSON.stringify(process.argv.slice(2)));");
  const result=spawnSync(process.execPath,[hook],{input:JSON.stringify({prompt:'/drishya',session_id:'session-12345678',cwd}),encoding:'utf8',env:{...process.env,PATH:bin,DRISHYA_TEST_ARGS:capture}});
  expect(JSON.parse(result.stdout).reason).toMatch(/Opened/);
  expect(existsSync(attack)).toBe(false);
  expect(JSON.parse(readFileSync(capture,'utf8'))).toEqual(['open','--session','session-12345678','--harness','claude-code']);
 } finally {rmSync(root,{recursive:true,force:true});}
});
