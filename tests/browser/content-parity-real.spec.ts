import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {test,expect,type Locator,type Page} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer} from '../../apps/daemon/src/server.ts';
import {askQuestions} from '../../apps/ui/src/lib/ask-question.ts';
import {planThreads} from '../../packages/scene/src/plan-threads.ts';
import {compose} from '../../packages/scene/src/index.ts';
import {asOfProjection} from '../../packages/contracts/src/index.ts';
import {browserStep,groupBrowserSteps} from '../../apps/ui/src/lib/browser-evidence.ts';
import {capturedContent} from '../../apps/ui/src/lib/captured-content.ts';

interface Sample {recording:string;operation:string;family:string;selector:string}
interface Corpus {home:string;samples:Sample[]}
// The manifest and scratch stores stay private. Only identifiers, counts and pixels remain in .local.
const file=process.env.DRISHYA_PARITY_MANIFEST;
const corpus:Corpus[]=file?JSON.parse(readFileSync(file,'utf8')):[];
// Virtual passages can replace their nodes during the expansion reflow.
async function reveal(locator:Locator){
 await expect(async()=>{await locator.waitFor({state:'attached'});await locator.evaluate(el=>el.scrollIntoView({block:'center'}));expect(await locator.isVisible()).toBe(true);}).toPass({timeout:15000});
}
async function findCard(page:Page,card:Locator,passages:string[],target:string,paged:boolean){
 if(!await card.count()){
  const history=page.locator('.history');await history.press('PageUp');await history.press('PageDown');
  if(!paged){
   await history.evaluate(el=>{el.scrollTop=0;});
   for(let n=0;n<400&&!await card.count();n++){
    await history.press('PageDown');await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
   }
   await reveal(card);return;
  }
  const wanted=passages.indexOf(target);let lo=0,hi=await history.evaluate(el=>el.scrollHeight),next=hi*Math.max(0,wanted)/Math.max(1,passages.length-1);
  for(let n=0;n<80&&!await card.count();n++){
   await history.evaluate((el,top)=>{el.scrollTop=top;},next);
   await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
   if(await card.count())break;
   const resident=await history.locator('.passage-slot').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-passage-id')!));
   const indexes=resident.map(id=>passages.indexOf(id)).filter(i=>i>=0);
   if(indexes.length&&wanted>=Math.min(...indexes)&&wanted<=Math.max(...indexes)){
    await page.waitForTimeout(100);continue;
   }
   const top=await history.evaluate(el=>el.scrollTop);
   if(indexes.length&&wanted<Math.min(...indexes))hi=top;else lo=top;
   next=(lo+hi)/2;
  }
 }
 await reveal(card);
}
test.describe('genuine cross-tool content parity',()=>{
 test.skip(!file,'Opt in with DRISHYA_PARITY_MANIFEST pointing to private scratch stores');
 test.setTimeout(1200000);
 for(const width of[600,1440])test(`captured families retain their material at ${width}px`,async({browser})=>{
  mkdirSync('.local/content-parity',{recursive:true});
  const results:unknown[]=[];
  const failures:{prefix:string;family:string;replay:boolean;stage:string}[]=[];
  let stage='starting';
  try{for(const source of corpus){
   const app=new App(source.home),server=await startServer({app,port:0});
   try{for(const sample of source.samples){
    const projection=app.projection(sample.recording),op=projection.operations.find(item=>item.id===sample.operation);
    if(!op)throw Error('Recorded operation is unavailable');
    const end=projection.timeline.findIndex(item=>item.type==='op-end'&&item.operationId===op.id);
    for(const replay of[false,true]){
     stage=`${sample.recording.slice(4,12)}/${sample.family}/${replay?'replay':'history'}/opening`;
     const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'}),page=await context.newPage();
     await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).parityCopied=text;}}}));
     page.setDefaultTimeout(15000);let errors=0,external=0;page.on('pageerror',()=>errors++);
     await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==server.url){external++;return route.abort();}return route.continue();});
     // These are archived redacted snapshots, sometimes referencing moved native journals.
     // Do not initiate more native watching; the late-arrival spec owns ingest/SSE acceptance.
     await page.route('**/v1/recordings/*/live',route=>route.fulfill({json:{live:false}}));
     await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[{id:sample.recording,entries:[['location',{selectedOp:op.id,follow:false,held:true}]]}]}}):route.continue());
     try{
      await page.goto(server.launchUrl);await page.locator('.home').waitFor();
      await page.goto(`${server.url}/?experience=modern&motion=0${replay&&end>=0?`&at=${end+1}`:''}#/r/${sample.recording}`);
      await page.locator('.history').waitFor({timeout:60000});
      if(replay&&end>=0)await expect(page.getByRole('slider',{name:'Timeline',exact:true})).toHaveAttribute('aria-valuenow',String(end+1));
      const scene=compose(projection,{step:replay&&end>=0?end+1:projection.timeline.length}),target=scene.passages.find(ps=>ps.ops.some(item=>item.id===op.id));
      if(!target)throw Error('Genuine operation has no captured passage');
      const card=page.locator(`article[data-op-id=${JSON.stringify(op.id)}]`),group=groupBrowserSteps(target.ops,new Map(projection.operations.map(o=>[o.id,o]))).find(group=>group.some(item=>item.id===op.id));
      const strip=group&&group.length>1?page.locator(`.browser-strip[data-browser-first-op=${JSON.stringify(group[0]!.id)}]`):undefined;
      await findCard(page,strip??card,scene.passages.map(ps=>ps.id),target.id,app.paged(sample.recording));
      if(strip&&group){const slider=strip.getByRole('slider',{name:'Browser step',exact:true});await slider.press('Home');for(let n=0;n<group.findIndex(item=>item.id===op.id);n++)await slider.press('ArrowRight');await reveal(card);}
      const expand=card.locator('button.op-expand');if(await expand.count()&&await expand.getAttribute('aria-expanded')!=='true')await expand.press('Enter');
      // Expansion pins the virtual passage before closing the restored inspector selection.
      const inspector=page.locator('.inspector');if(await inspector.count())await inspector.getByRole('button',{name:'Close',exact:true}).press('Enter');
      const material=card.locator(sample.selector).last();await reveal(material);
      if(sample.family!=='image')expect(await material.evaluate(el=>!!el.textContent?.trim())).toBe(true);
      const view=replay&&end>=0?asOfProjection(projection,end+1):projection;
      if(sample.family==='browser'){
       const step=browserStep(op);expect(!!step).toBe(true);
       expect(await material.locator('.browser-action').evaluate((el,action)=>el.textContent?.includes(action),step!.action)).toBe(true);
      }
      if(op.detail.kind==='web')expect(await material.locator('.web-results li').count()).toBe(op.detail.results?.length??0);
      if(sample.family==='image'){
       const thumb=material.locator('button.op-image').first();await reveal(thumb);
       await expect.poll(()=>thumb.locator('img').evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
       await thumb.press('Enter');const reader=page.getByRole('dialog',{name:'Captured image reader',exact:true});
       await expect.poll(()=>reader.locator('img').evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
       await reader.getByRole('button',{name:'Actual size',exact:true}).press('Enter');await reader.getByRole('button',{name:'Fit',exact:true}).press('Enter');await page.keyboard.press('Escape');
      }
      if(sample.family==='image-path'){
       await expect(material).toContainText('image bytes not captured');
       const open=material.getByRole('button',{name:'Open current file',exact:true});
       if(await open.count()){await open.press('Enter');await expect(material.locator('[role=status],.path-image-current,.path-image-consent').first()).toBeVisible();}
      }
      if(op.detail.kind==='other'&&sample.family==='question'){
       const questions=askQuestions(op.detail.input,op.detail.resultPreview);
       expect(await material.locator('.question-text').count()).toBe(questions.length);
       expect(await material.locator('.question-options li').count()).toBe(questions.reduce((n,q)=>n+q.options.length,0));
       expect(await material.locator('[data-chosen]').count()).toBe(questions.reduce((n,q)=>n+q.chosen.length,0));
       expect(await material.evaluate((el,questions)=>[...el.querySelectorAll('.question-text')].every((node,i)=>node.textContent===questions[i]?.question),questions)).toBe(true);
       expect(await material.evaluate((el,questions)=>[...el.querySelectorAll('.question')].every((section,i)=>[...section.querySelectorAll('.question-options li')].every((node,n)=>{
        const option=questions[i]?.options[n];return !!option&&node.querySelector('.question-label')?.childNodes[0]?.textContent===option.label&&node.hasAttribute('data-chosen')===questions[i]!.chosen.includes(option.label);
       })),questions)).toBe(true);
      }
      if(op.detail.kind==='plan'){
       const position=planThreads(view).get(op.id),items=position?position.thread.revisions[position.index]!.items:op.detail.items;
       expect(await material.locator('.plan-list li').count()).toBe(items.length);
       expect(await material.evaluate((el,items)=>[...el.querySelectorAll('.plan-list li')].every((node,i)=>node.classList.contains('plan-'+items[i]?.status)&&node.querySelector('.plan-text')?.textContent===items[i]?.text),items)).toBe(true);
       if(op.detail.document){
        expect(await material.locator('.plan-document').count()).toBe(1);
        const heading=op.detail.document.text.match(/^#{1,6}\s+(.+)$/m)?.[1];
        if(heading)expect(await material.locator('.plan-document').evaluate((el,text)=>el.textContent?.includes(text),heading)).toBe(true);
       }
      }
      if(op.detail.kind==='search'){
       expect(await material.locator('.search-bead').count()).toBe(Math.min(50,op.detail.hits.length));
       expect(await material.locator('.query').evaluate((el,query)=>el.textContent?.startsWith(query),op.detail.query)).toBe(true);
       expect(await material.locator('.search-bead').evaluateAll((nodes,hits)=>nodes.every((node,i)=>node.textContent?.startsWith(hits[i]!.path)),op.detail.hits)).toBe(true);
      }
      if(op.detail.kind==='spawn'){
       stage+=' / delegation first page';
       let dto=await app.history.delegationThread(sample.recording,op.id,0,replay&&end>=0?end+1:undefined);
       if(!dto)throw Error('Genuine delegation unavailable');
       await material.locator('.delegation-thread > summary').press('Enter');
       await expect.poll(()=>material.locator('.delegation-thread li').count()).toBe(dto.steps.length);
       const link=material.getByRole('link',{name:'Open child session',exact:true});
       await expect(link).toHaveCount(dto.child?.recordingId?1:0);
       if(dto.child?.recordingId)expect(await link.getAttribute('href')).toBe(`#/r/${dto.child.recordingId}`);
       expect(await material.evaluate((el,dto)=>!dto.child?.name||el.querySelector('.delegation-facts')?.textContent?.includes(dto.child.name),dto)).toBe(true);
       expect(await material.evaluate((el,dto)=>!dto.child?.model||el.querySelector('.delegation-facts')?.textContent?.includes(dto.child.model),dto)).toBe(true);
       let steps=0;
       while(dto){
        stage+=` / page ${dto.start}`;
        await expect.poll(()=>material.locator('.delegation-thread li').count()).toBe(dto.steps.length);
        expect(await material.evaluate((el,dto)=>[...el.querySelectorAll('.delegation-thread li')].every((node,i)=>node.getAttribute('data-delegation-step')===dto.steps[i]?.kind&&node.textContent?.includes(dto.steps[i]!.label)),dto)).toBe(true);
        steps+=dto.steps.length;
        if(dto.start+dto.limit>=dto.total){expect(steps).toBe(dto.total);break;}
        const next=dto.start+dto.limit;await material.getByRole('button',{name:'Next steps',exact:true}).press('Enter');
        dto=await app.history.delegationThread(sample.recording,op.id,next,replay&&end>=0?end+1:undefined);
        await expect.poll(()=>material.locator('.delegation-thread ol').getAttribute('start')).toBe(String(next+1));
       }
      }
      if(sample.family==='orchestration'){
       const script=card.locator('.captured-script').first();await script.locator(':scope > summary').press('Enter');
       await expect(script).toContainText('Drishya genuine parity acceptance: deliberate synthetic rejected sibling');
       const parent=projection.operations.find(item=>item.id===op.parentOperationId);
       if(!parent||parent.detail.kind!=='shell'||!parent.detail.outputPreview)throw Error('Actual parent output is unavailable');
       const original=parent.detail.outputPreview;
       expect(/"status"\s*:\s*"fulfilled"/.test(original)&&/"status"\s*:\s*"rejected"/.test(original)).toBe(true);
       await script.getByRole('button',{name:'Inspect data',exact:true}).last().press('Enter');
       const dialog=page.getByRole('dialog',{name:'Captured data',exact:true});await dialog.getByRole('button',{name:'Original',exact:true}).press('Enter');
       expect(await dialog.locator('.data-original').evaluate((el,original)=>el.textContent===original,original)).toBe(true);
       await dialog.getByRole('button',{name:'Copy original',exact:true}).press('Enter');
       await expect.poll(()=>page.evaluate(original=>(window as any).parityCopied===original,original)).toBe(true);
       await page.keyboard.press('Escape');
      }
      if(['mcp','mixed','incomplete'].includes(sample.family)&&'resultPreview' in op.detail&&op.detail.resultPreview){
       const original=material.locator('.result-original:has(> pre)').last();
       if(await original.count()){await original.locator('summary').press('Enter');expect(await original.locator('pre').evaluate((el,text)=>el.textContent===text,op.detail.resultPreview)).toBe(true);}
      }
      if(sample.family==='mixed'&&op.detail.kind==='mcp'&&op.detail.resultPreview){
       const text=op.detail.resultPreview,content=capturedContent(text),views=material.getByRole('group',{name:'Captured result views',exact:true}).last();
       expect(content.data.length).toBeGreaterThan(1);
       await views.locator('.captured-data-sources > summary').press('Enter');
       expect(await views.getByRole('combobox',{name:'Captured content',exact:true}).locator('option').count()).toBe(content.data.length);
       await views.getByRole('combobox',{name:'Captured content',exact:true}).selectOption('Whole captured result');
       await views.getByRole('button',{name:'Inspect data',exact:true}).press('Enter');
       const dialog=page.getByRole('dialog',{name:'Captured data',exact:true});await dialog.getByRole('button',{name:'Original',exact:true}).press('Enter');
       expect(await dialog.locator('.data-original').evaluate((el,text)=>el.textContent===text,text)).toBe(true);
       await dialog.getByRole('button',{name:'Copy original',exact:true}).press('Enter');
       await expect.poll(()=>page.evaluate(text=>(window as any).parityCopied===text,text)).toBe(true);await page.keyboard.press('Escape');
      }
      if(sample.family==='unknown-mcp'&&op.detail.kind==='mcp'&&op.detail.resultPreview){
       const literal=material.locator('.result-prose');
       expect(await literal.evaluate((el,text)=>el.textContent===text&&getComputedStyle(el).userSelect!=='none',op.detail.resultPreview)).toBe(true);
      }
      if(sample.family==='native-returned')expect(await card.locator('.state-running').count()).toBe(0);
      if(sample.family==='error')expect(await card.locator('.state-error').count()).toBe(1);
      if(['shell','test','read'].includes(op.detail.kind)){
       stage+=' / copy artifact page';
       const detail=op.detail as unknown as {outputArtifactId?:string;excerptArtifactId?:string};
       const id=detail.outputArtifactId??detail.excerptArtifactId,copy=material.getByRole('button',{name:'Copy captured page',exact:true}).last();
       if(id&&await copy.count()){
        await expect(copy).toBeEnabled();await copy.press('Enter');
        const original=app.artifactSlice(projection,id,0,200).text;
        await expect.poll(()=>page.evaluate(original=>(window as any).parityCopied===original,original)).toBe(true);
       }
      }
      const captured=sample.family==='missing'?material.locator('.muted,pre.output').filter({hasText:/not captured|No .*captured|Waiting for/i}).last():material.locator('.question-text,.plan-text,.plan-document>h1,.plan-document>h2,.plan-document>p,.delegation-task,.ln-tx,.change-text,.query,.search-bead,pre.output,.browser-action,.web-results a,.op-image img,.path-image-path,.data-original,.result-fields dd,.structured-result td,[role=treeitem],.data-table td').filter({visible:true}).first();
      await captured.waitFor();
      if(await captured.count()){
       await reveal(captured);
       expect(await captured.evaluate(el=>{const r=el.getBoundingClientRect();let top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);for(let p=el.parentElement;p;p=p.parentElement)if(/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowY)){const b=p.getBoundingClientRect();top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}return Math.max(0,bottom-top)})).toBeGreaterThan(3);
      }else throw Error('No visible captured material in dedicated reading');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
      expect(errors).toBe(0);expect(external).toBe(0);
      writeFileSync(`.local/content-parity/current-${width}.json`,JSON.stringify({prefix:sample.recording.slice(4,12),family:sample.family,replay}));
      await page.screenshot({path:resolve(`.local/content-parity/${sample.recording.slice(4,12)}-${sample.family}-${width}-${replay?'replay':'history'}.png`)});
      if(op.detail.kind==='spawn'){
       const link=material.getByRole('link',{name:'Open child session',exact:true});
       if(await link.count()){const href=await link.getAttribute('href');await link.press('Enter');await expect.poll(()=>new URL(page.url()).hash).toBe(href);await page.locator('.history').waitFor();}
      }
      if(op.detail.kind==='search'&&op.detail.hits.length){
       await card.press('Enter');const inspector=page.locator('.inspector');
       await expect(inspector.locator('.hit-row')).toHaveCount(op.detail.hits.length);
       expect(await inspector.locator('.hit-path').evaluateAll((nodes,hits)=>nodes.every((node,i)=>node.textContent===hits[i]?.path),op.detail.hits)).toBe(true);
      }
      results.push({prefix:sample.recording.slice(4,12),family:sample.family,width,replay,observations:projection.observationCount,errors,external});
     }catch(error){
      writeFileSync(`.local/content-parity/navigation-${width}-private.json`,JSON.stringify(await page.locator('.history').evaluate(el=>({scrollTop:el.scrollTop,height:el.clientHeight,extent:el.scrollHeight,passages:el.querySelectorAll('[data-passage-id]').length,operations:[...el.querySelectorAll('[data-op-id]')].map(node=>node.getAttribute('data-op-id'))}))));
      await page.screenshot({path:resolve(`.local/content-parity/failure-${width}-private.png`)}).catch(()=>{});
      failures.push({prefix:sample.recording.slice(4,12),family:sample.family,replay,stage});
      writeFileSync(`.local/content-parity/failure-${width}-${failures.length}-private.txt`,stage+'\n'+(error instanceof Error?error.stack??error.message:String(error)));
     }finally{await context.close();}
    }
   }}finally{await server.close();await app.close();}
  }if(failures.length)throw Error(`${failures.length} genuine reading journeys failed`);
  }catch(error){
   // Playwright failures must not quote the real captured material in console or public artifacts.
   writeFileSync(`.local/content-parity/error-${width}-private.txt`,stage+'\n'+(error instanceof Error?error.stack??error.message:String(error)));
   throw Error(`Genuine parity acceptance failed after ${results.length} journeys; private diagnostic retained in .local`);
  }finally{writeFileSync(`.local/content-parity/counts-${width}.json`,JSON.stringify(results));writeFileSync(`.local/content-parity/failures-${width}.json`,JSON.stringify(failures));}
 });
});
