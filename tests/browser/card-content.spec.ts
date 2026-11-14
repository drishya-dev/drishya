import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect,type Page,type Locator} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
// UI-46: tool cards show their content cleanly. Commands and output keep their real line breaks and wrap at sensible places,
// a collapsed preview ends on a whole line (never half of one), arguments are key/value rows that wrap, nothing overflows its card
// sideways, and copying yields the original text.
let dir:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-card-content-'));app=new App(dir);server=await startServer({app,port:0});
 const file=join(dir,'card-content.jsonl');writeFileSync(file,journal());id=(await app.ingest.importSource('claude-code',file)).recordingId;});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

const WORDS='prepare the shared checkout so every reading window opens the same recorded files and nothing else changes';
/** A path whose break opportunities browsers refuse by default (a separator before a dot). */
const LONG_COMMAND=`cd /home/dev/shop/.local/worktrees/feature-cards-0123456789/docs/review && git fetch -q origin && git checkout --detach origin/main && node scripts/sync-tasks.ts --check && echo ${JSON.stringify(WORDS)}`;
const HEREDOC=['python - <<\'EOF\'','import pathlib','','path = pathlib.Path(\'docs/TASKS.md\')','raw = path.read_bytes()','print("ok", len(raw), "bytes in the working copy of docs/review/antigravity-codex-instructions.md")','EOF'].join('\n');
const OUTPUT=Array.from({length:40},(_,i)=>i===5?`line ${i}: ${WORDS} ${WORDS}`:i===9?`warning: in the working copy of 'docs/review/antigravity-codex-instructions.md', LF will be replaced by CRLF the next time Git touches it`:`line ${i}: ok`).join('\n');
const MARKDOWN=['# Antigravity as a third harness: instructions for Codex','',`**Why it matters.** ${WORDS} ${WORDS} ${WORDS}.`,'',`- ${WORDS} ${WORDS}`,`- Release rule: ${WORDS}`,'','| a | b |','| - | - |',`| ${WORDS} | ${WORDS} |`,'','Last line of the file.'];
const WIDE_OUTPUT=Array.from({length:12},(_,i)=>`${i}: ${WORDS} ${WORDS} ${WORDS}`).join('\n');
const ARGS={session_id:'local_81397698-4025-45be-90cc-ef27d471b354',message:`${WORDS} ${WORDS} ${WORDS} ${WORDS}`,title:'Build MAP-4: map nodes and edges visible under reading area',options:{wait:false,notify:'at-the-end'}};
const RESULT=`Message delivered to session local_81397698-4025-45be-90cc-ef27d471b354 ("Build MAP-4: map nodes and edges visible under reading area"); its turn has started on it. (delivery: delivered; message_id: 0df76c1f-ca1b-41d1-987a-a963964d2e04) ${WORDS}`;

function journal(){
 const base={cwd:'/home/dev/shop',sessionId:'c0ffee00-0000-4000-8000-0000000000e1',version:'2.1.0',userType:'external',entrypoint:'cli',isSidechain:false};
 let n=0,parent:string|null=null;const rows:string[]=[];
 const push=(type:'user'|'assistant',message:object)=>{const uuid=`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;rows.push(JSON.stringify({...base,parentUuid:parent,type,message,uuid,timestamp:`2026-09-21T10:00:${String(n).padStart(2,'0')}.000Z`}));parent=uuid;};
 const use=(name:string,input:object,result:string)=>{const tool=`toolu_c${n}`;push('assistant',{id:`msg_${n}`,type:'message',role:'assistant',model:'claude-opus-5',content:[{type:'tool_use',id:tool,name,input}],stop_reason:'tool_use'});push('user',{role:'user',content:[{type:'tool_result',tool_use_id:tool,content:result,is_error:false}]});};
 push('user',{role:'user',content:'Run the commands and write the notes.'});
 use('Bash',{command:LONG_COMMAND,description:'Check out main'},'Switched to origin/main\nok');
 use('Bash',{command:HEREDOC,description:'Read the tasks file'},'ok 5 bytes');
 use('Bash',{command:'git log --oneline -40',description:'Show the log'},OUTPUT);
 use('Bash',{command:HEREDOC.replace('print(','print("x",'),description:'Print wide output'},WIDE_OUTPUT);
 use('Write',{file_path:'/home/dev/shop/docs/notes.md',content:MARKDOWN.join('\n')+'\n'},'File created successfully.');
 use('mcp__ccd_session_mgmt__send_message',ARGS,RESULT);
 return rows.join('\n')+'\n';
}

const card=(page:Page,kind:string,nth=0)=>page.locator(`article.op-${kind}`).nth(nth);
async function open(page:Page,width:number){await page.setViewportSize({width,height:900});await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);await expect(page.locator('article.op').first()).toBeVisible();}
const frame=async(el:Locator,name:string)=>{const out=process.env.DRISHYA_FRAMES;if(out){mkdirSync(out,{recursive:true});await el.screenshot({path:join(out,`${name}.png`)});}};
const settle=async(page:Page,el:Locator)=>{await el.scrollIntoViewIfNeeded();await page.mouse.move(1,1);await page.waitForTimeout(150);};

/** Elements inside the card's body that are wider than their box (a horizontal scroll or a clipped line). */
const overflowing=(el:Locator)=>el.evaluate(card=>[...card.querySelectorAll<HTMLElement>('.op-body, .op-body *, .op-expanded, .op-expanded *')].filter(e=>!e.closest('.captured-result-views')&&(e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).display!=='inline'&&getComputedStyle(e).overflowX!=='visible'||e.getBoundingClientRect().right>card.getBoundingClientRect().right+1)).map(e=>`${e.tagName}.${e.className}`));
/** Collapsed content hidden behind a scrollbar of its own (an older fixed-height box): only the whole-line clamps may hide text. */
const scrollBoxes=(el:Locator)=>el.evaluate(card=>[...card.querySelectorAll<HTMLElement>('.op-body, .op-body *')].filter(e=>/auto|scroll/.test(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+1).map(e=>`${e.tagName}.${e.className}`));
/** Text lines of a node: one entry per visual line, from the real layout. */
const LINES=`(root)=>{const r=document.createRange(),w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),boxes=[];for(let t=w.nextNode();t;t=w.nextNode()){if(!t.data.trim())continue;r.selectNodeContents(t);for(const b of r.getClientRects())if(b.height>0&&b.width>0)boxes.push({top:b.top,bottom:b.bottom});}boxes.sort((a,b)=>a.top-b.top);const out=[];for(const b of boxes){const l=out.at(-1);if(l&&b.top<l.bottom-1)l.bottom=Math.max(l.bottom,b.bottom);else out.push({...b});}return out;}`;
/** Every clamped preview in a card ends exactly on a line boundary: no text line is cut by its box. */
const clampsAreWhole=(el:Locator)=>el.evaluate((card,src)=>{
 const lines=eval(src) as (root:Element)=>{top:number;bottom:number}[];
 return [...card.querySelectorAll<HTMLElement>('.line-clamp[data-clamped]')].map(box=>{
  const rect=box.getBoundingClientRect(),cut=lines(box).filter(l=>l.bottom>rect.top+1&&l.top<rect.bottom-1&&(l.top<rect.top-1||l.bottom>rect.bottom+1));
  return {cls:box.className,cut:cut.length,height:Math.round(rect.height)};
 });
},LINES);

/** The card body either shows all of its content or is cut between two lines: no text line straddles the visible edge. */
const bodyEdge=(el:Locator)=>el.evaluate(card=>{
 const body=card.querySelector<HTMLElement>('.op-body')!,box=body.getBoundingClientRect(),cut=body.hasAttribute('data-cut')?parseFloat(body.style.getPropertyValue('--card-cut')):undefined;
 const edge=box.top+(cut??body.clientHeight),range=document.createRange(),walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);
 let straddling=0;
 for(let t=walker.nextNode() as Text|null;t;t=walker.nextNode() as Text|null){
  if(!t.data.trim()||t.parentElement!.closest('.captured-result-views'))continue;
  const clip=t.parentElement!.closest('.line-clamp[data-clamped]')?.getBoundingClientRect();
  range.selectNodeContents(t);
  for(const r of range.getClientRects()){if(!r.height||(clip&&(r.top>=clip.bottom-1||r.bottom<=clip.top+1)))continue;if(r.top<edge-1&&r.bottom>edge+1)straddling++;}
 }
 return {cut:cut!==undefined,straddling,clipped:cut===undefined?body.scrollHeight-body.clientHeight:0};
});

for(const width of [1440,600]){
 test.describe(`at ${width}px`,()=>{
  test('every collapsed card ends on a whole line, however tall its content',async({page})=>{
   await open(page,width);
   const cards=page.locator('article.op');const count=await cards.count();expect(count).toBeGreaterThanOrEqual(6);
   for(let i=0;i<count;i++){
    const el=cards.nth(i);await settle(page,el);if(await el.evaluate(c=>c.classList.contains('expanded')))continue;
    const edge=await bodyEdge(el);
    expect(edge.straddling,`card ${i} cuts a line`).toBe(0);expect(edge.clipped,`card ${i} hides content`).toBeLessThanOrEqual(1);
    if(i===3)await frame(el,`wide-output-${width}`);
   }
  });

  test('a long shell command keeps its words whole, wraps at paths, and ends on a whole line',async({page})=>{
   await open(page,width);
   const el=card(page,'shell',0);await settle(page,el);await frame(el,`shell-command-${width}`);
   expect(await overflowing(el)).toEqual([]);
   expect(await scrollBoxes(el),'a fixed-height box hides part of the preview').toEqual([]);
   // An option such as -q or --detach is never broken at its hyphen.
   expect(await el.locator('.cmd-option').count()).toBeGreaterThan(2);
   expect(await el.locator('.cmd-option').evaluateAll(es=>es.filter(e=>e.getClientRects().length>1).length)).toBe(0);
   // The command text is exactly the command, and no clamp cuts a line.
   const text=await el.locator('.cmd code').first().evaluate(c=>c.textContent);
   expect(text!.replace(/\n$/,'')).toBe(LONG_COMMAND);
   for(const c of await clampsAreWhole(el))expect(c.cut,`clamp ${c.cls} cut a line`).toBe(0);
   // The card's own body does not hide anything behind a scrollbar or a half line.
   const body=await el.locator('.op-body').evaluate(b=>({clipped:b.scrollHeight-b.clientHeight,overflowY:getComputedStyle(b).overflowY}));
   expect(body.clipped,'op-body content is clipped').toBeLessThanOrEqual(1);
   // Expand: the whole command, unclamped.
   await el.locator('.op-expand').click();await expect(el).toHaveClass(/expanded/);
   expect(await overflowing(el)).toEqual([]);
   await expect(el.locator('.line-clamp[data-clamped]')).toHaveCount(0);
   await expect(el.locator('.cmd code').first()).toContainText('sync-tasks.ts --check');
   await el.locator('.op-expand').click();
  });

  test('a heredoc keeps its line structure and copies back as written',async({page})=>{
   await open(page,width);
   const el=card(page,'shell',1);await settle(page,el);await frame(el,`shell-heredoc-${width}`);
   const lines=HEREDOC.split('\n');
   const blocks=await el.locator('.cmd .cmd-line').allTextContents();
   expect(blocks.map(b=>b.replace(/\n$/,''))).toEqual(lines.slice(0,blocks.length));
   // Each command line is its own block: its top is below the previous line's, in order (the blank line is a line too).
   const tops=await el.locator('.cmd .cmd-line').evaluateAll(els=>els.map(e=>Math.round(e.getBoundingClientRect().top)));
   expect(tops).toEqual([...tops].sort((a,b)=>a-b));expect(new Set(tops).size).toBe(tops.length);
   // Expanded, every line is there and selecting the command yields the original text.
   await el.locator('.op-expand').click();await expect(el).toHaveClass(/expanded/);
   await expect(el.locator('.cmd .cmd-line')).toHaveCount(lines.length);
   const copied=await el.locator('.cmd code').first().evaluate(c=>{const s=getSelection()!,r=document.createRange();r.selectNodeContents(c);s.removeAllRanges();s.addRange(r);return s.toString();});
   expect(copied.replace(/\n+$/,'')).toBe(HEREDOC);
   await el.locator('.op-expand').click();
  });

  test('long output wraps at spaces, never ends on half a line, and Expand shows all of it',async({page})=>{
   await open(page,width);
   const el=card(page,'shell',2);await settle(page,el);await frame(el,`shell-output-${width}`);
   expect(await overflowing(el)).toEqual([]);
   // 40 lines fold to the first three, a count, and the last three; whatever wraps past its lines is cut between lines.
   await expect(el.locator('.terminal-fold')).toHaveText('34 more lines');
   await expect(el.locator('.terminal-preview')).toContainText('line 39: ok');
   expect(await scrollBoxes(el),'a fixed-height box hides part of the preview').toEqual([]);
   for(const c of await clampsAreWhole(el))expect(c.cut,`clamp ${c.cls} cut a line`).toBe(0);
   const body=await el.locator('.op-body').evaluate(b=>b.scrollHeight-b.clientHeight);
   expect(body,'op-body content is clipped').toBeLessThanOrEqual(1);
   await el.locator('.op-expand').click();await expect(el).toHaveClass(/expanded/);
   expect(await overflowing(el)).toEqual([]);
   await expect(el.locator('.op-expanded')).toContainText('line 39: ok');
   // A selection over the full output yields its lines in order.
   await el.locator('.op-expand').click();
  });

  test('a long Markdown write wraps inside the card, line by line, collapsed and expanded',async({page})=>{
   await open(page,width);
   const el=card(page,'edit',0);await settle(page,el);await frame(el,`write-markdown-${width}`);
   expect(await overflowing(el)).toEqual([]);
   const box=await el.boundingBox();expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
   const row=el.locator('.ln.add',{hasText:'Why it matters'}).first();await expect(row).toBeVisible();
   const copied=await row.locator('.ln-tx').evaluate(c=>{const s=getSelection()!,r=document.createRange();r.selectNodeContents(c);s.removeAllRanges();s.addRange(r);return s.toString();});
   expect(copied).toBe(MARKDOWN[2]);
   await el.locator('.op-expand').click();await expect(el).toHaveClass(/expanded/);
   expect(await overflowing(el)).toEqual([]);
   await expect(el.locator('.op-expanded')).toContainText('Last line of the file.');
   await el.locator('.op-expand').click();
  });

  test('a tool call lays its arguments out as key/value rows that wrap, and ends on a whole line',async({page})=>{
   await open(page,width);
   const el=card(page,'mcp',0);await settle(page,el);await frame(el,`tool-call-${width}`);
   expect(await overflowing(el)).toEqual([]);
   const rows=el.locator('dl.tool-input-fields').first().locator(':scope > div');
   expect(await rows.count()).toBeGreaterThanOrEqual(3);
   // Keys line up in one column; every value starts to the right of its key.
   const geometry=await rows.evaluateAll(rs=>rs.map(r=>{const dt=r.querySelector('dt')!.getBoundingClientRect(),dd=r.querySelector('dd')!.getBoundingClientRect();return {keyLeft:Math.round(dt.left),valueLeft:Math.round(dd.left),keyRight:dt.right};}));
   expect(new Set(geometry.map(g=>g.keyLeft)).size).toBe(1);
   expect(new Set(geometry.map(g=>g.valueLeft)).size).toBe(1);
   for(const g of geometry)expect(g.valueLeft).toBeGreaterThanOrEqual(g.keyRight-1);
   for(const c of await clampsAreWhole(el))expect(c.cut,`clamp ${c.cls} cut a line`).toBe(0);
   expect(await scrollBoxes(el),'a fixed-height box hides part of the preview').toEqual([]);
   const body=await el.locator('.op-body').evaluate(b=>b.scrollHeight-b.clientHeight);
   expect(body,'op-body content is clipped').toBeLessThanOrEqual(1);
   // Expanded, the whole message and the whole result are there.
   await el.locator('.op-expand').click();await expect(el).toHaveClass(/expanded/);
   expect(await overflowing(el)).toEqual([]);
   await expect(el.locator('.op-expanded')).toContainText('at-the-end');
   await expect(el.locator('.op-expanded')).toContainText('message_id: 0df76c1f');
   await el.locator('.op-expand').click();
  });
 });
}
