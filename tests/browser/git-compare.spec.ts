import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
import {openSessionReview} from './session-review.ts';

// GIT-8: Compare replaces the header's Changes. A real repository with `main` and `topic`: one file both sides changed, one only
// topic changed (and the session edited), one only main changed. Compare is read-only, so every ref is checked before and after.
const git=(root:string,...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const remove=(dir:string)=>{if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe scratch directory');rmSync(dir,{recursive:true,force:true});};
const state=(root:string)=>[git(root,'for-each-ref'),git(root,'rev-parse','HEAD'),git(root,'status','--porcelain'),git(root,'stash','list')].join('\n');

let dir:string,root:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{
  dir=mkdtempSync(join(tmpdir(),'drishya-compare-ui-'));root=join(dir,'repo');mkdirSync(root);
  git(root,'init','-b','main');git(root,'config','user.name','Synthetic');git(root,'config','user.email','synthetic@example.invalid');git(root,'config','core.autocrlf','false');
  writeFileSync(join(root,'shared.ts'),'export const shared = 1;\nexport const other = 1;\n');writeFileSync(join(root,'a.ts'),'export const a = 1;\n');writeFileSync(join(root,'c.ts'),'export const c = 1;\n');
  git(root,'add','.');git(root,'commit','-m','Base');
  git(root,'switch','-c','topic');writeFileSync(join(root,'shared.ts'),'export const shared = "topic side";\nexport const other = 1;\n');writeFileSync(join(root,'a.ts'),'export const a = 2;\n');git(root,'add','.');git(root,'commit','-m','Topic work');
  git(root,'switch','main');writeFileSync(join(root,'shared.ts'),'export const shared = 1;\nexport const other = "main side";\n');writeFileSync(join(root,'c.ts'),'export const c = 2;\n');git(root,'add','.');git(root,'commit','-m','Main work');
  const base={cwd:root,sessionId:'c0ffee00-0000-4000-8000-0000000000c8',version:'2.1.0',userType:'external',entrypoint:'cli',isSidechain:false,gitBranch:'topic'};
  let n=0,parent:string|null=null;const rows:string[]=[];
  const push=(type:'user'|'assistant',message:object)=>{const uuid=`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;rows.push(JSON.stringify({...base,parentUuid:parent,type,message,uuid,timestamp:`2026-11-11T10:00:${String(n).padStart(2,'0')}.000Z`}));parent=uuid;};
  const use=(name:string,input:object)=>{const tool=`toolu_c${n}`;push('assistant',{id:`msg_${n}`,type:'message',role:'assistant',model:'claude-opus-5',content:[{type:'tool_use',id:tool,name,input}],stop_reason:'tool_use'});push('user',{role:'user',content:[{type:'tool_result',tool_use_id:tool,content:'The file has been edited.'}]});};
  push('user',{role:'user',content:'Make topic changes.'});
  use('Edit',{file_path:join(root,'a.ts'),old_string:'export const a = 1;',new_string:'export const a = 2;'});
  use('Edit',{file_path:join(root,'shared.ts'),old_string:'export const shared = 1;',new_string:'export const shared = "topic side";'});
  const journal=join(dir,'session.jsonl');writeFileSync(journal,rows.join('\n')+'\n');
  app=new App(join(dir,'store'));id=(await app.ingest.importSource('claude-code',journal)).recordingId;server=await startServer({app,port:0,token:'synthetic-compare-ui'});
});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir)remove(dir);});

async function openCompare(page:Page,width:number){
  await page.setViewportSize({width,height:900});await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
  await expect(page.locator('.history')).toBeVisible();
  await page.locator('.modern-session-header').getByRole('button',{name:'Compare',exact:true}).click();
  const compare=page.getByRole('region',{name:'Compare',exact:true});await expect(compare).toBeVisible();
  const approve=compare.getByRole('button',{name:'Approve read-only Git',exact:true});
  await expect(approve.or(compare.locator('.compare-body'))).toBeVisible();if(await approve.isVisible())await approve.click();
  await expect(compare.locator('.compare-body')).toBeVisible();
  return compare;
}

for(const width of [1440,600])test(`chooses two sides, shows the three file groups and opens a file at ${width}px`,async({page})=>{
  const before=state(root);
  const compare=await openCompare(page,width);
  // The header carries Compare, not Changes.
  await expect(page.locator('.modern-session-header').getByRole('button',{name:'Changes',exact:true})).toHaveCount(0);
  // This session: the branch the journal recorded against the default branch, with the files the session edited.
  await expect(compare.locator('.compare-counts')).toContainText('1 ahead');await expect(compare.locator('.compare-counts')).toContainText('1 behind');
  await expect(compare.locator('.compare-sides')).toContainText('topic');
  const files=compare.getByRole('complementary',{name:'Changed files'});
  await expect(files.getByRole('group',{name:'Changed on both'}).getByText('shared.ts',{exact:true})).toBeVisible();
  await expect(files.getByRole('group',{name:'Only on topic'}).getByText('a.ts',{exact:true})).toBeVisible();
  await expect(files.getByText('c.ts',{exact:true})).toHaveCount(0);
  await files.getByRole('button',{name:'Show all 3'}).click();
  await expect(files.getByRole('group',{name:'Only on main'}).getByText('c.ts',{exact:true})).toBeVisible();

  // Branch: pick both sides from the lists.
  await compare.getByRole('button',{name:'Branch',exact:true}).click();
  await compare.getByRole('button',{name:/^Base side:/}).click();
  await compare.getByRole('textbox',{name:'Find a base branch or tag'}).fill('mai');
  await compare.getByRole('option',{name:/^main/}).getByRole('button').click();
  await compare.getByRole('button',{name:/^Compare side:/}).click();
  await compare.getByRole('textbox',{name:'Find a compare branch or tag'}).fill('top');
  await compare.getByRole('option',{name:/^topic/}).getByRole('button').click();
  await expect(files.getByRole('group',{name:'Changed on both'})).toContainText('shared.ts');
  await expect(files.getByRole('group',{name:'Only on topic'})).toContainText('a.ts');
  await expect(files.getByRole('group',{name:'Only on main'})).toContainText('c.ts');

  // Open the shared file: each side's change from the merge-base, read in the one patch reader.
  await files.getByRole('button',{name:'shared.ts',exact:false}).first().click();
  const reader=compare.locator('.compare-patch');
  await expect(reader.locator('.git-patch-reader')).toContainText('topic side');
  await expect(reader).not.toContainText('main side');
  await compare.getByRole('group',{name:'Which side’s change to read'}).getByRole('button',{name:'main',exact:true}).click();
  await expect(reader.locator('.git-patch-reader')).toContainText('main side');
  // Agent evidence: the session's edit of a.ts is one quiet line that jumps to it in History.
  await expect(files.getByRole('group',{name:'Only on topic'}).locator('.compare-evidence')).toContainText('1 edit');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await files.getByRole('group',{name:'Only on topic'}).locator('.compare-evidence .compare-link').click();
  await expect(page.getByRole('region',{name:'Compare',exact:true})).toHaveCount(0);

  // Reading place: reopening shows the same sides and file, and nothing in the repository moved.
  await page.locator('.modern-session-header').getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.getByRole('region',{name:'Compare',exact:true}).getByRole('button',{name:'Branch',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('region',{name:'Compare',exact:true}).locator('.compare-file[data-active]')).toContainText('shared.ts');
  await page.getByRole('region',{name:'Compare',exact:true}).getByRole('button',{name:'Back to agent',exact:true}).click();
  await expect(page.getByRole('region',{name:'Compare',exact:true})).toHaveCount(0);
  await expect(page.locator('.history')).toBeVisible();
  expect(state(root)).toBe(before);
});

test('uncommitted changes read the working tree and the old Changes view stays reachable from the palette',async({page})=>{
  writeFileSync(join(root,'c.ts'),'export const c = "uncommitted";\n');
  const compare=await openCompare(page,1440);
  await compare.getByRole('button',{name:'Uncommitted',exact:true}).click();
  const files=compare.getByRole('complementary',{name:'Changed files'});
  await expect(files).toContainText('c.ts');
  await expect(compare.locator('.compare-patch')).toContainText('uncommitted');
  await compare.getByRole('button',{name:'Back to agent',exact:true}).click();
  await openSessionReview(page);
  await expect(page.getByRole('dialog',{name:'Changes',exact:true})).toBeVisible();
  git(root,'checkout','--','c.ts');
});

// Jet Black, Midnight and Daylight at both supported widths: the window fits, reads in ink that contrasts with its surface, and nothing scrolls sideways.
for(const theme of ['dark','midnight','light'])for(const width of [1440,600])test(`reads clearly in ${theme} at ${width}px`,async({page})=>{
  await page.addInitScript(value=>localStorage.setItem('drishya.theme',value),theme);
  const compare=await openCompare(page,width);
  await expect(compare.locator('.compare-file').first()).toBeVisible();
  await expect(compare.locator('.compare-patch .git-patch-reader')).toBeVisible();
  const read=await compare.evaluate(element=>{
    const luminance=(css:string)=>{const m=css.match(/[\d.]+/g)!.map(Number);const [r,g,b]=m.slice(0,3).map(v=>{const c=v/255;return c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4;});return 0.2126*r!+0.7152*g!+0.0722*b!;};
    // The surface is the first opaque background up the tree; the ink is the file name's own colour.
    let surface=element as Element|null,background='rgba(0, 0, 0, 0)';
    while(surface){const value=getComputedStyle(surface).backgroundColor;if(!/rgba\(.*, 0\)$/.test(value)&&value!=='transparent'){background=value;break;}surface=surface.parentElement;}
    const ink=getComputedStyle(element.querySelector('.compare-file-name strong')!).color,muted=getComputedStyle(element.querySelector('.compare-group h3')!).color;
    const ratio=(a:string,b:string)=>{const [x,y]=[luminance(a),luminance(b)].sort((p,q)=>q-p);return (x!+0.05)/(y!+0.05);};
    return {ink:ratio(ink,background),muted:ratio(muted,background),fits:document.documentElement.scrollWidth<=innerWidth,theme:document.documentElement.dataset.theme};
  });
  expect(read.theme).toBe(theme==='light'?'light':'dark');
  expect(read.fits).toBe(true);
  expect(read.ink).toBeGreaterThan(7);
  expect(read.muted).toBeGreaterThan(3);
  await page.screenshot({path:resolve(`.local/git-8-compare-${theme}-${width}.png`)});
});
