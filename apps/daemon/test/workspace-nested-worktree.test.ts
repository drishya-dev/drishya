import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {App} from '../src/app.ts';
import {WorkspaceAccess} from '../src/workspace.ts';

// FILES-11: a session rooted in a repository whose agent keeps a linked worktree under an ignored folder (`.local/wt`).
let dir:string,root:string,id:string,app:App,access:WorkspaceAccess;
const git=(cwd:string,...args:string[])=>execFileSync('git',args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});
beforeAll(async()=>{
 dir=mkdtempSync(join(tmpdir(),'drishya-nested-worktree-'));root=join(dir,'repo');mkdirSync(root);
 git(root,'init','-q','-b','main');git(root,'config','user.email','synthetic@example.invalid');git(root,'config','user.name','Synthetic');git(root,'config','core.autocrlf','false');
 writeFileSync(join(root,'.gitignore'),'.local/\nsecret-notes.txt\n');writeFileSync(join(root,'main.ts'),'export const main = 1;\n');
 git(root,'add','.');git(root,'commit','-q','-m','base');
 mkdirSync(join(root,'.local'));git(root,'worktree','add','-q','-b','agent',join(root,'.local','wt'));
 writeFileSync(join(root,'.local','wt','edited.ts'),'export const edited = 2;\nexport const more = 3;\n');
 writeFileSync(join(root,'.local','wt','secret-notes.txt'),'ignored inside the worktree too');
 writeFileSync(join(root,'.local','scratch.txt'),'a plain scratch file');
 // A checkout of another repository under the root is not this repository's worktree.
 const other=join(dir,'other');mkdirSync(other);git(other,'init','-q','-b','main');git(other,'config','user.email','synthetic@example.invalid');git(other,'config','user.name','Synthetic');writeFileSync(join(other,'x.ts'),'x');git(other,'add','.');git(other,'commit','-q','-m','x');
 git(other,'worktree','add','-q','-b','foreign',join(root,'.local','foreign'));
 const journal=join(dir,'session.jsonl');writeFileSync(journal,JSON.stringify({type:'user',uuid:'u',sessionId:'nested-worktree',cwd:root,message:{role:'user',content:'Edit in the worktree'}})+'\n');
 app=new App(join(dir,'data'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;access=new WorkspaceAccess(app);
});
afterAll(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});

it('reads the whole current file inside a linked worktree of this repository after the one workspace approval',async()=>{
 await expect(access.read(id,'.local/wt/edited.ts')).rejects.toMatchObject({status:403});
 await access.approve(id);
 expect(await access.read(id,'.local/wt/edited.ts')).toMatchObject({scope:'current-workspace',text:'export const edited = 2;\nexport const more = 3;\n',totalLines:3,hasMore:false});
 expect((await access.read(id,'main.ts')).text).toBe('export const main = 1;\n');
});
it('keeps refusing plain ignored files, another repository\'s worktree and what the worktree itself ignores',async()=>{
 await access.approve(id);
 await expect(access.read(id,'.local/scratch.txt')).rejects.toMatchObject({status:403,message:'not a readable workspace path'});
 await expect(access.read(id,'.local/foreign/x.ts')).rejects.toMatchObject({status:403});
 await expect(access.read(id,'.local/wt/secret-notes.txt')).rejects.toMatchObject({status:403});
 await expect(access.read(id,'.local/wt/../scratch.txt')).rejects.toMatchObject({status:403});
});
