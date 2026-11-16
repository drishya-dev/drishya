import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect,type Page,type Locator} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
// UI-44: Edit and Write cards show whole lines. A long line wraps inside the card, as a Read does, instead of
// running out of it behind a sideways scrollbar. The gutter keeps one number per source line, the sign and the
// added/removed background span the wrapped height, and copying yields the source line with no inserted newline.
let dir:string,app:App,server:RunningServer,id:string;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-diff-wrap-'));app=new App(dir);server=await startServer({app,port:0});
 const file=join(dir,'long-lines.jsonl');writeFileSync(file,journal());id=(await app.ingest.importSource('claude-code',file)).recordingId;});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

/** A 300-character line made of words, so the card may break it at spaces. */
const prose=Array.from({length:30},(_,i)=>`value${i}`.padEnd(9,'x')).join(' ').slice(0,300);
const longLine=`const sentence = '${prose}';`;
/** One token with no break opportunity, longer than any card. */
const token=`const blob = '${'0123456789abcdef'.repeat(20)}';`;
const WRITE_LINES=['// Long lines wrap inside the card.','import {join} from \'node:path\';',longLine,'export const answer = 42;',token,'export default answer;'];

function journal(){
 const base={cwd:'/home/dev/shop',sessionId:'c0ffee00-0000-4000-8000-0000000000f1',version:'2.1.0',userType:'external',entrypoint:'cli',isSidechain:false};
 let n=0,parent:string|null=null;const rows:string[]=[];
 const push=(type:'user'|'assistant',message:object)=>{const uuid=`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;rows.push(JSON.stringify({...base,parentUuid:parent,type,message,uuid,timestamp:`2026-09-21T10:00:${String(n).padStart(2,'0')}.000Z`}));parent=uuid;};
 const use=(name:string,input:object,result:string)=>{const tool=`toolu_w${n}`;push('assistant',{id:`msg_${n}`,type:'message',role:'assistant',model:'claude-opus-5',content:[{type:'tool_use',id:tool,name,input}],stop_reason:'tool_use'});push('user',{role:'user',content:[{type:'tool_result',tool_use_id:tool,content:result,is_error:false}]});};
 push('user',{role:'user',content:'Write the module and tweak it.'});
 use('Write',{file_path:'/home/dev/shop/src/long.ts',content:WRITE_LINES.join('\n')+'\n'},'File created successfully.');
 use('Edit',{file_path:'/home/dev/shop/src/long.ts',old_string:'export const answer = 42;',new_string:longLine.replace('sentence','edited')},'The file has been edited.');
 return rows.join('\n')+'\n';
}

const overflowing=(card:Locator)=>card.evaluate(el=>[...el.querySelectorAll<HTMLElement>('.op-body, .op-body *, .op-expanded, .op-expanded *')].filter(e=>e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).display!=='inline').map(e=>`${e.tagName.toLowerCase()}.${e.className}: ${e.scrollWidth}>${e.clientWidth}`));
async function open(page:Page,width:number){
 // These layout cases share a server. Each starts with no saved card or reading location.
 await page.route('**/v1/working-locations', route => route.request().method() === 'GET'
  ? route.fulfill({json:{version:1,sessions:[]}})
  : route.continue());
 await page.setViewportSize({width,height:900});await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);await expect(page.locator('article.op-edit')).toHaveCount(2);}
const frame=async(page:Page,name:string)=>{const out=process.env.DRISHYA_FRAMES;if(out){mkdirSync(out,{recursive:true});await page.screenshot({path:join(out,`${name}.png`)});}};

for(const width of [1440,600]){
 test(`a Write and an Edit with 300-character lines wrap inside the card at ${width}px, collapsed and expanded`,async({page})=>{
  await open(page,width);
  const cards=page.locator('article.op-edit');
  for(const [index,kind] of ['write','edit'].entries()){
   const card=cards.nth(index);await card.scrollIntoViewIfNeeded();
   await expect(card.locator('.ln.add').first()).toBeVisible();
   await frame(page,`${kind}-collapsed-${width}`);
   expect.soft(await overflowing(card),`${kind} card, collapsed`).toEqual([]);
   const box=await card.boundingBox();expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
   // The long line is one row: its gutter shows one number and the sign once, the code hangs beside them.
   const row=card.locator('.ln.add',{hasText:kind==='write'?'sentence':'edited'}).first();await expect(row).toBeVisible();
   const geometry=await row.evaluate(el=>{const r=el.getBoundingClientRect(),tx=el.querySelector('.ln-tx')!.getBoundingClientRect(),no=[...el.querySelectorAll('.ln-no')].map(n=>n.textContent??''),sign=el.querySelector('.ln-sign')!;
    return {height:r.height,txLeft:tx.left,txHeight:tx.height,numbers:no.filter(Boolean),sign:sign.textContent,lineHeight:parseFloat(getComputedStyle(el.querySelector('.ln-tx')!).lineHeight)||20};});
   expect(geometry.height,'the 300-character line wrapped to several visual lines').toBeGreaterThan(geometry.lineHeight*1.5);
   expect(geometry.numbers).toHaveLength(1);expect(geometry.sign).toBe('+');
   const gutterRight=await row.evaluate(el=>[...el.querySelectorAll('.ln-no,.ln-sign')].reduce((m,e)=>Math.max(m,e.getBoundingClientRect().right),0));
   expect(geometry.txLeft,'wrapped lines hang under the code, not the gutter').toBeGreaterThanOrEqual(gutterRight-1);
   // Copying the code yields the source line exactly: a soft wrap inserts no newline.
   const copied=await row.locator('.ln-tx').evaluate(el=>{const s=getSelection()!;const r=document.createRange();r.selectNodeContents(el);s.removeAllRanges();s.addRange(r);return s.toString();});
   expect(copied).toBe(kind==='write'?longLine:longLine.replace('sentence','edited'));
   // After Expand the same holds.
   await card.getByRole('button',{name:/^Expand .* in history$/}).click();
   await expect(card).toHaveClass(/expanded/);
   await expect(card.locator('.diff-scroll').first()).toBeVisible();
   await card.scrollIntoViewIfNeeded();await frame(page,`${kind}-expanded-${width}`);
   expect.soft(await overflowing(card),`${kind} card, expanded`).toEqual([]);
   await card.getByRole('button',{name:/^Close .* in history$/}).click();await expect(card).not.toHaveClass(/expanded/);
  }
 });
}

test('one token longer than the card breaks inside it',async({page})=>{
 await open(page,600);
 const card=page.locator('article.op-edit').first();await card.scrollIntoViewIfNeeded();
 const row=card.locator('.ln.add',{hasText:'blob'}).first();await expect(row).toBeVisible();
 const [rowBox,cardBox]=await Promise.all([row.boundingBox(),card.boundingBox()]);
 expect(rowBox!.x+rowBox!.width).toBeLessThanOrEqual(cardBox!.x+cardBox!.width+1);
 expect(await overflowing(card)).toEqual([]);
});
