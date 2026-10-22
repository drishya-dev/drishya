import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {test,expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-images-'));app=new App(join(dir,'data'));server=await startServer({app,port:0});});
test.afterAll(async()=>{await server?.close();await app?.close();if(dir){if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw new Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});}});

// A real 2×1 PNG (one red, one blue pixel).
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAEElEQVR4nGP4z8DA8B9IAAAc+gT8Xdw8fQAAAABJRU5ErkJggg==';

test('an image the agent read shows as a lazy thumbnail and opens whole; a refused one says why',async({page})=>{
 const session='images',base={timestamp:'2026-10-21T00:00:00Z',cwd:dir,sessionId:session},source=join(dir,session+'.jsonl');
 const image=(data:string)=>({type:'image',source:{type:'base64',media_type:'image/png',data}});
 const rows=[
  {...base,type:'user',uuid:'p',message:{role:'user',content:[image(PNG),{type:'text',text:'Look at the diagram'}]}},
  {...base,type:'assistant',uuid:'a1',message:{id:'m1',role:'assistant',content:[{type:'tool_use',id:'read1',name:'Read',input:{file_path:join(dir,'diagram.png')}},{type:'tool_use',id:'read2',name:'Read',input:{file_path:join(dir,'notes.png')}}]}},
  {...base,type:'user',uuid:'r1',toolUseResult:{type:'image',file:{base64:PNG,type:'image/png',originalSize:75,dimensions:{originalWidth:2,originalHeight:1,displayWidth:2,displayHeight:1}}},message:{role:'user',content:[{type:'tool_result',tool_use_id:'read1',content:[image(PNG)]}]}},
  {...base,type:'user',uuid:'r2',message:{role:'user',content:[{type:'tool_result',tool_use_id:'read2',content:[image(Buffer.from('plain text pretending to be a picture').toString('base64'))]}]}},
 ];
 writeFileSync(source,rows.map(row=>JSON.stringify(row)).join('\n')+'\n');const id=(await app.ingest.importSource('claude-code',source)).recordingId;
 await page.goto(server.launchUrl);await expect(page.locator('.home')).toBeVisible();await page.goto(`${server.url}/?experience=modern&motion=0#/r/${id}`);
 // The image pasted into the prompt sits under the prompt text.
 await expect(page.locator('.turn .turn-images .op-image')).toHaveCount(1);
 if(process.env.IMG_SHOT)await page.locator('.turn').first().screenshot({path:resolve('.local/turn-image.png')});
 const card=page.locator('article.op').filter({hasText:'diagram.png'}).first();
 const thumb=card.locator('.op-image');await expect(thumb).toHaveCount(1);
 const img=thumb.locator('img');await expect(img).toHaveAttribute('loading','lazy');
 await expect.poll(()=>img.evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBe(2);
 const box=(await thumb.boundingBox())!;expect(box.height).toBeGreaterThan(40);expect(box.width).toBeGreaterThan(box.height);
 await expect(page.locator('article.op').filter({hasText:'notes.png'}).first().locator('.op-image-missing')).toContainText('not a recognised image type');
 if(process.env.IMG_SHOT)await card.screenshot({path:resolve('.local/image-card.png')});
 await thumb.click();
 const reader=page.locator('dialog.image-reader');await expect(reader).toBeVisible();await expect(reader).toContainText('2×1');
 await page.keyboard.press('Escape');await expect(reader).toHaveCount(0);
 // Served with the type the bytes carry, cacheable, never sniffed by the browser.
 const response=await page.request.get(await img.evaluate((el:HTMLImageElement)=>el.src));
 expect(response.headers()['content-type']).toBe('image/png');expect(response.headers()['x-content-type-options']).toBe('nosniff');
});
