import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {buildGraph} from '@drishya/indexer';
import type {RepoGraph} from '@drishya/contracts';
import {App} from '../src/app.ts';
import {WorkspaceAccess} from '../src/workspace.ts';
let dir:string,root:string,id:string,app:App,access:WorkspaceAccess,graph:RepoGraph;
beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-index-eligibility-'));root=join(dir,'repo');mkdirSync(root);writeFileSync(join(root,'.gitignore'),'ignored/\nignored.txt\n');writeFileSync(join(root,'README.md'),'Current file outside the bounded map.');writeFileSync(join(root,'ignored.txt'),'not eligible');writeFileSync(join(root,'.env'),'private');writeFileSync(join(root,'too-large.ts'),'x'.repeat(512*1024+1));writeFileSync(join(root,'image.png'),'not an indexed text file');
 for(const folder of ['node_modules','ignored']){mkdirSync(join(root,folder));writeFileSync(join(root,folder,'readme.md'),'excluded directory');}
 symlinkSync(root,join(root,'linked'),process.platform==='win32'?'junction':'dir');
 const journal=join(dir,'session.jsonl');writeFileSync(journal,JSON.stringify({type:'user',uuid:'u',sessionId:'bounded-read',cwd:root,message:{role:'user',content:'Inspect the README'}})+'\n');app=new App(join(dir,'data'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;
 graph=await buildGraph(root,{maxFiles:1});expect(graph.truncated).toBe(true);expect(graph.nodes.some(n=>n.path==='README.md')).toBe(false);vi.spyOn(app,'graph').mockImplementation(async()=>graph);access=new WorkspaceAccess(app);
});
afterAll(async()=>{vi.restoreAllMocks();await app.close();rmSync(dir,{recursive:true,force:true});});
it('does not replace file consent with a truncated map or map approval',async()=>{await app.approveGraphRoot(id);await expect(access.read(id,'README.md')).rejects.toMatchObject({status:403});});
it('reads an eligible current file omitted by the map cap after explicit workspace approval',async()=>{await access.approve(id);expect(await access.read(id,'README.md')).toMatchObject({scope:'current-workspace',text:'Current file outside the bounded map.',returnedLines:1,hasMore:false});});
it.each(['.env','ignored.txt','ignored/readme.md','node_modules/readme.md','too-large.ts','image.png','linked/README.md','../README.md'])('retains protected, ignored, size, binary and link boundaries for %s',async path=>{await expect(access.read(id,path)).rejects.toMatchObject({status:403});});
it('does not admit a missing node from a complete unchanged map',async()=>{graph={...graph,truncated:false,stale:false};await expect(access.read(id,'README.md')).rejects.toMatchObject({status:403});});
it('checks the same eligibility when an explicitly stale map omits a current file',async()=>{graph={...graph,stale:true};expect((await access.read(id,'README.md')).text).toBe('Current file outside the bounded map.');await expect(access.read(id,'ignored.txt')).rejects.toMatchObject({status:403});});
it('keeps redaction and instance-local revocation on fallback reads',async()=>{graph={...graph,truncated:true};writeFileSync(join(root,'README.md'),'const key = "sk-proj-abcdefghijklmnopqrstuvw0123456789";');const current=await access.read(id,'README.md');expect(current.redacted).toBe(true);expect(current.text).toContain('[REDACTED:');expect(current.text).not.toContain('abcdefghijklmnopqrstuvw');access.revoke(id);await expect(access.read(id,'README.md')).rejects.toMatchObject({status:403});});
