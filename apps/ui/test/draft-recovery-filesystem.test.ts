import {mkdtempSync,realpathSync,mkdirSync,writeFileSync,readFileSync,statSync,symlinkSync,unlinkSync,rmSync,writeSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {WorkspaceDrafts} from '../src/lib/workspace-drafts.ts';
import {recoverySnapshot,restoreRecovery,sealRecovery,unsealRecovery} from '../src/lib/draft-recovery.ts';
import {App} from '../../daemon/src/app.ts';
import {WorkspaceAccess} from '../../daemon/src/workspace.ts';

let directory:string,root:string;
const base='export const before = 1;\r\n',draft={base,text:'export const recovered = 2;\r\n',modifiedAt:'2026-10-28T00:00:00Z'};
const sameFile=(a:string,b:string)=>{const x=statSync(a,{bigint:true}),y=statSync(b,{bigint:true});return x.dev===y.dev&&x.ino===y.ino;};

type LinkedDraftPhase = 'fixture' | 'junction' | 'store' | 'journal' | 'import' | 'approve-graph' | 'restore' | 'linked-read' | 'app-close' | 'unlink' | 'fixture-cleanup';
const traceLinkedDraft = process.env.DRISHYA_TEST_LINKED_DRAFT_TRACE === '1';
const traceStart = performance.now();

function linkedDraftPhase(phase: LinkedDraftPhase, boundary: 'start' | 'done' | 'skipped') {
  if (!traceLinkedDraft) return;
  // Use the file descriptor directly so the last start marker is visible even if this worker stops making progress.
  // The fixed labels and elapsed milliseconds carry no fixture paths or content.
  try { writeSync(2, `[draft-recovery-link] ${phase} ${boundary} ${Math.round(performance.now() - traceStart)}ms\n`); }
  catch { /* A closed diagnostic stream does not change the test result. */ }
}

beforeAll(()=>{
 linkedDraftPhase('fixture','start');
 directory=realpathSync.native(mkdtempSync(join(tmpdir(),'drishya-files5-filesystem-')));root=join(directory,'repo');mkdirSync(root);
 linkedDraftPhase('fixture','done');
});
afterAll(()=>{
 linkedDraftPhase('fixture-cleanup','start');
 if(!resolve(directory).startsWith(resolve(realpathSync.native(tmpdir()))+sep))throw Error('Unsafe temporary directory');
 rmSync(directory,{recursive:true,force:true});
 linkedDraftPhase('fixture-cleanup','done');
});

it('round trips exact Unicode draft spellings even on normalising volumes and leaves real disk bytes unchanged',async()=>{
 const paths=['résumé.ts','re\u0301sume\u0301.ts','日本語.ts','emoji-🧠.ts'];
 for(const path of paths)writeFileSync(join(root,path),base);
 // APFS can alias NFC/NFD names; recovery preserves inert draft spellings, not an invented count of distinct disk files.
 const source=new WorkspaceDrafts();for(const path of paths)source.set('synthetic',path,draft);
 const sealed=await sealRecovery(recoverySnapshot(source,'synthetic',root),'synthetic filesystem recovery password');
 for(const path of paths)expect(sealed).not.toContain(path);
 const snapshot=await unsealRecovery(sealed,'synthetic filesystem recovery password'),live=new WorkspaceDrafts();
 restoreRecovery(live,snapshot,'synthetic',root);expect(live.entries().map(item=>item.path)).toEqual(paths);
 for(const path of paths){expect(live.get('synthetic',path)).toEqual(draft);expect(readFileSync(join(root,path),'utf8')).toBe(base);}
});

it.skipIf(process.platform!=='win32')('uses actual Windows ASCII and accented aliases to refuse newer drafts atomically',()=>{
 for(const [original,alias] of [['Mixed.ts','MIXED.ts'],['Étage.ts','étage.ts'],['Σource.ts','σource.ts']]){
  writeFileSync(join(root,original!),base);expect(sameFile(join(root,original!),join(root,alias!))).toBe(true);
  const source=new WorkspaceDrafts();source.set('one','addition.ts',draft);source.set('one',original!,draft);
  const live=new WorkspaceDrafts();live.set('one',alias!,{...draft,text:'newer local draft'});
  expect(()=>restoreRecovery(live,recoverySnapshot(source,'one',root),'one',root)).toThrow('No drafts were replaced');
  expect(live.entries()).toEqual([{id:'one',path:alias}]);expect(readFileSync(join(root,original!),'utf8')).toBe(base);
 }
});

it.skipIf(process.platform!=='win32'||process.env.DRISHYA_TEST_CASE_SENSITIVE_WINDOWS!=='1')('records the conservative case-sensitive Windows limitation without merging distinct disk files',context=>{
 const sensitive=join(root,'sensitive');mkdirSync(sensitive);
 const enabled=spawnSync('fsutil.exe',['file','setCaseSensitiveInfo',sensitive,'enable'],{encoding:'utf8',windowsHide:true});
 if(enabled.status!==0){context.skip();return;}
 writeFileSync(join(sensitive,'readme.ts'),'lowercase disk file');writeFileSync(join(sensitive,'README.ts'),'uppercase disk file');
 expect(sameFile(join(sensitive,'readme.ts'),join(sensitive,'README.ts'))).toBe(false);
 const source=new WorkspaceDrafts();source.set('one','sensitive/readme.ts',draft);source.set('one','sensitive/README.ts',{...draft,text:'distinct uppercase draft'});
 // Drive-root snapshots currently fold path case. This is a safe refusal, not support for this volume policy.
 expect(()=>recoverySnapshot(source,'one',root)).toThrow('duplicate path');
 expect(source.entries()).toHaveLength(2);expect(readFileSync(join(sensitive,'readme.ts'),'utf8')).toBe('lowercase disk file');expect(readFileSync(join(sensitive,'README.ts'),'utf8')).toBe('uppercase disk file');
});

it.skipIf(process.platform!=='win32')('discloses conservative Unicode case collisions rather than silently coalescing different files',()=>{
 writeFileSync(join(root,'İ.ts'),'capital dotted I');writeFileSync(join(root,'i\u0307.ts'),'lowercase combining dot');
 expect(sameFile(join(root,'İ.ts'),join(root,'i\u0307.ts'))).toBe(false);
 const source=new WorkspaceDrafts();source.set('one','İ.ts',draft);source.set('one','i\u0307.ts',{...draft,text:'distinct Unicode draft'});
 expect(()=>recoverySnapshot(source,'one',root)).toThrow('duplicate path');expect(source.entries()).toHaveLength(2);
});

it('retains recovered linked paths only as inert drafts and refuses current bytes through a filesystem link',async context=>{
 linkedDraftPhase('junction','start');
 const target=join(root,'target'),linked=join(root,'linked');mkdirSync(target);writeFileSync(join(target,'file.ts'),base);
 try{symlinkSync(target,linked,process.platform==='win32'?'junction':'dir');}catch(error){
  if(['EPERM','EACCES','ENOTSUP'].includes((error as NodeJS.ErrnoException).code??'')){
   linkedDraftPhase('junction','skipped');
   context.skip();return;
  }
  throw error;
 }
 linkedDraftPhase('junction','done');
 linkedDraftPhase('store','start');
 const app=new App(join(directory,'store'));
 linkedDraftPhase('store','done');
 try{
  linkedDraftPhase('journal','start');
  expect(sameFile(join(target,'file.ts'),join(linked,'file.ts'))).toBe(true);
  const journal=join(directory,'synthetic.jsonl');writeFileSync(journal,JSON.stringify({type:'user',uuid:'synthetic',sessionId:'filesystem',cwd:root,message:{role:'user',content:'Synthetic recovery acceptance'}})+'\n');
  linkedDraftPhase('journal','done');
  linkedDraftPhase('import','start');
  const id=(await app.ingest.importSource('claude-code',journal)).recordingId;
  linkedDraftPhase('import','done');
  linkedDraftPhase('approve-graph','start');
  const access=new WorkspaceAccess(app);await access.approve(id);
  linkedDraftPhase('approve-graph','done');
  linkedDraftPhase('restore','start');
  const source=new WorkspaceDrafts();source.set(id,'linked/file.ts',draft);const live=new WorkspaceDrafts();restoreRecovery(live,recoverySnapshot(source,id,root),id,root);
  expect(live.get(id,'linked/file.ts')).toEqual(draft);
  linkedDraftPhase('restore','done');
  linkedDraftPhase('linked-read','start');
  await expect(access.read(id,'linked/file.ts')).rejects.toThrow('linked files are not readable');
  expect(readFileSync(join(target,'file.ts'),'utf8')).toBe(base);
  linkedDraftPhase('linked-read','done');
 }finally{
  linkedDraftPhase('app-close','start');
  await app.close();
  linkedDraftPhase('app-close','done');
  linkedDraftPhase('unlink','start');
  unlinkSync(linked);
  linkedDraftPhase('unlink','done');
 }
});
