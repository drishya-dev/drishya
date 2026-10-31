import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync,unlinkSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {App} from '../src/app.ts';
import {WorkspaceAccess} from '../src/workspace.ts';
import {recordedFileRoots,recordedMainRootPrefixes} from '../src/file-roots.ts';
let dir:string,root:string,id:string,app:App,access:WorkspaceAccess;
beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-main-root-alias-'));root=join(dir,'repo');const other=join(dir,'other');mkdirSync(root);mkdirSync(other);
  for(const name of ['main.ts','outside-only.ts','unrecorded.ts','missing.ts','ignored.ts','.env'])writeFileSync(join(root,name),`// current ${name}`);
  writeFileSync(join(root,'.gitignore'),'ignored.ts\n');mkdirSync(join(root,'nested'));mkdirSync(join(root,'nested','.git'));writeFileSync(join(root,'nested','file.ts'),'// nested checkout');
  symlinkSync(other,join(root,'linked'),process.platform==='win32'?'junction':'dir');writeFileSync(join(other,'secret.ts'),'// outside');
  const journal=join(dir,'session.jsonl');
  const reads=[['main.ts',root],['missing.ts',root],['ignored.ts',root],['.env',root],['nested/file.ts',root],['linked/secret.ts',root],['outside-only.ts',other]];
  writeFileSync(journal,reads.flatMap(([path,cwd],i)=>[
    {type:'assistant',uuid:`a${i}`,sessionId:'main-root-alias',cwd,message:{content:[{type:'tool_use',id:`r${i}`,name:'Read',input:{file_path:join(cwd!,path!)}}]}},
    {type:'user',uuid:`u${i}`,sessionId:'main-root-alias',cwd,message:{content:[{type:'tool_result',tool_use_id:`r${i}`,content:'     1\t// captured historical source'}]}}
  ]).map((row,i)=>JSON.stringify({...row,timestamp:new Date(Date.UTC(2026,9,29,0,0,i)).toISOString()})).join('\n')+'\n');
  app=new App(join(dir,'data'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;access=new WorkspaceAccess(app);
});
afterAll(async()=>{vi.restoreAllMocks();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temp cleanup');rmSync(dir,{recursive:true,force:true});});
it('never substitutes main-root evidence for explicit current-reading consent',async()=>{
  await app.approveGraphRoot(id);await expect(access.read(id,'main.ts')).rejects.toMatchObject({status:403});
});
it('opens an indexable main alias from a captured multi-root graph after consent',async()=>{
  await access.approve(id);const graph=await app.graph(id);expect(graph.temporal).toBe('recording-files-only');expect(graph.nodes.some(n=>n.path==='main.ts')).toBe(false);
  const before=app.projection(id).files.map(f=>f.path);expect(before.some(p=>/^worktree-[a-f0-9]{10}\/main.ts$/.test(p))).toBe(true);
  expect(await access.read(id,'main.ts')).toMatchObject({path:'main.ts',scope:'current-workspace',text:'// current main.ts'});
  expect(app.projection(id).files.map(f=>f.path)).toEqual(before);const projection=app.projection(id);const excerpt=projection.artifacts.find(a=>a.kind==='excerpt'&&a.path?.endsWith('/main.ts'))!;expect(app.artifactText(projection,excerpt.id).text).toContain('captured historical source');
});
it.each(['outside-only.ts','unrecorded.ts','ignored.ts','.env','nested/file.ts','linked/secret.ts','../other/secret.ts'])('refuses non-main, uncaptured or excluded current path %s',async path=>{
  await expect(access.read(id,path)).rejects.toMatchObject({status:403});
});
it('does not turn a captured identity into a filesystem namespace',async()=>{
  const roots=await recordedFileRoots(app.store,[id]);const prefix=recordedMainRootPrefixes(roots.roots,app.recording(id).workspaceRoot)[0]!;
  await expect(access.read(id,`${prefix}/main.ts`)).rejects.toThrow();
});
it('refuses a file that disappeared since capture',async()=>{unlinkSync(join(root,'missing.ts'));await expect(access.read(id,'missing.ts')).rejects.toThrow();});
it('never applies the alias exception to a complete current graph',async()=>{
  const graph=await app.graph(id);const spy=vi.spyOn(app,'graph').mockResolvedValue({...graph,temporal:'current'});
  try{await expect(access.read(id,'main.ts')).rejects.toMatchObject({status:403});}finally{spy.mockRestore();}
});
it('retains root identity and volatile revocation checks',async()=>{
  const recording=app.recording(id);const spy=vi.spyOn(app,'recording').mockReturnValue({...recording,workspaceRoot:join(dir,'other')});
  try{await expect(access.read(id,'main.ts')).rejects.toMatchObject({status:403});}finally{spy.mockRestore();}
  access.revoke(id);await expect(access.read(id,'main.ts')).rejects.toMatchObject({status:403});await access.approve(id);
});
it('redacts eligible current bytes independently of historical content',async()=>{
  writeFileSync(join(root,'main.ts'),'const key = "sk-proj-abcdefghijklmnopqrstuvw0123456789";');const file=await access.read(id,'main.ts');expect(file.redacted).toBe(true);expect(file.text).toContain('[REDACTED:');expect(file.text).not.toContain('abcdefghijklmnopqrstuvw');
});
it('matches only exact main roots, with Windows case and separators normalized',()=>{
  const roots=[{root:'C:\\repo',prefix:'main'},{root:'C:/repo-copy',prefix:'sibling'},{root:'C:/repo/nested',prefix:'nested'},{root:'C:/other/repo',prefix:'similar'},{root:'C:/repo',recordedRoot:'file:///C:/repo',prefix:'url'}];
  expect(recordedMainRootPrefixes(roots,'c:/REPO/')).toEqual(['main','url']);expect(recordedMainRootPrefixes(roots,undefined)).toEqual([]);expect(recordedMainRootPrefixes([{root:'/Repo',prefix:'case'}],'/repo')).toEqual([]);
});
