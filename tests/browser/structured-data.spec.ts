import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test} from './legacy-test.ts';
import {pointAtHistory} from './history-gestures.ts';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-data-'));app=new App(dir);server=await startServer({app,port:0,token:'synthetic-data'});});
test.afterAll(async()=>{await server.close();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('unsafe path');rmSync(dir,{recursive:true,force:true});});
test('JSON reading reaches late rows and fields with bounded DOM and exact original access',async({page})=>{
 const sample=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8'));
 const op=sample.projection.operations.find((item:{kind:string})=>item.kind==='mcp');op.title='Records';op.artifactIds=[];
 const raw=JSON.stringify({items:Array.from({length:1200},(_,index)=>({id:index,name:`record ${index}`,nested:{text:'line one\nline two'},...(index===1199?{late:'last field'}:{})}))});
 op.detail={kind:'mcp',server:'records',tool:'list',input:{},resultPreview:raw};
 await page.route('**/demo/bundle.json',route=>route.fulfill({json:sample}));
 await page.goto(new URL('/?demo&experience=modern&motion=0',server.launchUrl).href);
 const card=page.locator(`article[data-op-id="${op.id}"]`);await expect(page.locator('.history')).toBeVisible();await pointAtHistory(page);await page.mouse.wheel(0,-100000);await expect(card).toBeAttached();await card.scrollIntoViewIfNeeded();await card.getByRole('button',{name:/^(Open larger|Inspect data)$/}).first().press('Enter');
 const dialog=page.getByRole('dialog',{name:'Data'}),viewport=dialog.locator('.data-viewport');
 await expect(dialog.getByRole('table')).toBeVisible();await expect(dialog.getByRole('columnheader',{name:'late',exact:true})).toHaveCount(1);
 expect(await dialog.getByRole('row').count()).toBeLessThan(30);
 await viewport.evaluate(element=>{element.scrollTop=element.scrollHeight;element.scrollLeft=element.scrollWidth;});
 await dialog.getByRole('button',{name:'last field',exact:true}).click();await expect(dialog.getByRole('region',{name:'Selected data value'})).toContainText('/items/1199/late');
 await dialog.getByRole('button',{name:'Tree',exact:true}).click();await dialog.getByRole('textbox',{name:'Find key or value'}).fill('record 1199');await dialog.locator('.data-value').click();await expect(dialog.locator('.data-selection')).toContainText('record 1199');
 await dialog.getByRole('textbox',{name:'Find key or value'}).fill('');await dialog.getByRole('button',{name:'Expand items',exact:true}).click();await dialog.locator('[role=treeitem]').first().focus();await page.keyboard.press('End');await expect(dialog.locator('[role=treeitem][aria-selected=true]')).toBeFocused();
 await dialog.getByRole('button',{name:'Original',exact:true}).click();await expect(dialog.locator('.data-original')).toHaveText(raw);
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});const box=(await dialog.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);expect(await dialog.evaluate(element=>element.scrollWidth-element.clientWidth)).toBeLessThanOrEqual(1);}
 await page.screenshot({path:resolve('.local/structured-data-phone.png')});
 await dialog.getByRole('button',{name:'Close Data'}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('region',{name:'Operation detail',exact:true})).toHaveCount(0);
});

test('reading windows reverse from their actual entrance and dismiss immediately for keyboard or reduced motion',async({page})=>{
 await page.addInitScript(()=>{
  const original=Element.prototype.animate;(window as any).__readerMotion=[];(window as any).__holdReaderArrival=true;
  Element.prototype.animate=function(frames,options){const animation=original.call(this,frames,options);if(this instanceof HTMLDialogElement){(window as any).__readerMotion.push({frames,options});if((window as any).__holdReaderArrival){animation.pause();animation.currentTime=0;}}return animation;};
 });
 const sample=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8'));
 const op=sample.projection.operations.find((item:{kind:string})=>item.kind==='mcp');op.detail.resultPreview='{"answer":42}';
 await page.route('**/demo/bundle.json',route=>route.fulfill({json:sample}));
 await page.goto(new URL('/?demo&experience=modern',server.launchUrl).href);await expect(page.locator('.history')).toBeVisible();await pointAtHistory(page);await page.mouse.wheel(0,-100000);
 const trigger=page.locator(`article[data-op-id="${op.id}"]`).getByRole('button',{name:/^(Open larger|Inspect data)$/}).first();await trigger.focus();await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Data'});
 const before=await dialog.evaluate(element=>{const animation=element.getAnimations()[0];animation.pause();animation.currentTime=70;(window as any).__holdReaderArrival=false;const style=getComputedStyle(element);return {opacity:style.opacity,translate:style.translate,scale:style.scale};});
 await dialog.getByRole('button',{name:'Close Data'}).click({force:true});
 const frames=await page.evaluate(()=>(window as any).__readerMotion.at(-1).frames);
 expect(frames[0].opacity).toBe(before.opacity);expect(frames[0].translate).toBe(before.translate);expect(frames[0].scale).toBe(before.scale);
 await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 await trigger.focus();await trigger.click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 const exits=await page.evaluate(()=>(window as any).__readerMotion.filter((item:any)=>item.frames.at(-1).opacity===0).length);expect(exits).toBe(1);
 await page.emulateMedia({reducedMotion:'reduce'});await trigger.focus();await trigger.click();await dialog.getByRole('button',{name:'Close Data'}).click();await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).__readerMotion.filter((item:any)=>item.frames.at(-1).opacity===0).length)).toBe(1);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('button',{name:'Workspace settings',exact:true}).click();const settings=page.getByRole('dialog',{name:'Workspace settings',exact:true});await settings.getByRole('button',{name:'Close Workspace settings'}).click();await expect(settings).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).__readerMotion.filter((item:any)=>item.frames.at(-1).opacity===0).length)).toBe(2);
 const folder=page.getByRole('treeitem',{name:'src',exact:true});await folder.click();await expect(folder).toHaveAttribute('aria-expanded','true');expect(await folder.locator('.folder-disclosure').evaluate(element=>getComputedStyle(element).transitionDuration)).toBe('0.14s');
 await folder.focus();await page.keyboard.press('ArrowLeft');await expect(folder).toHaveAttribute('aria-expanded','false');expect(await folder.locator('.folder-disclosure').evaluate(element=>getComputedStyle(element).transitionDuration)).toBe('0s');
});


for(const kind of ['mcp','shell'] as const)test(`${kind} captured delimited text is explicit, bounded and preserves literal cells`,async({page})=>{
 await page.addInitScript(()=>{(window as any).copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).copied=text;}}});});
 const sample=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8'));
 const op=sample.projection.operations.find((item:{kind:string})=>item.kind==='mcp');op.kind=kind;if(kind==='shell')op.origin={type:'native',tool:'shell_command'};op.artifactIds=[];
 const csv='name,name,note\r\n'+Array.from({length:1200},(_,index)=>`record ${index},${index},"${index===1199?'last, captured\nvalue':index===0?'=SUM(A1:A2)':'literal'}"`).join('\r\n')+'\r\nshort';
 const raw=kind==='mcp'?JSON.stringify({content:[{type:'text',text:csv},{type:'text',text:'a\tb\nleft\tright'},{type:'resource_link',uri:'https://example.invalid/never-load'}]}):JSON.stringify({output:csv,exit_code:0,wall_time_seconds:1});
 op.detail=kind==='mcp'?{kind:'mcp',server:'records',tool:'arbitrary_result',input:{},resultPreview:raw}:{kind:'shell',command:'produce report',outputPreview:raw,exitCode:0};
 let remote=0;await page.route('https://example.invalid/**',route=>{remote++;return route.abort();});
 await page.route('**/demo/bundle.json',route=>route.fulfill({json:sample}));await page.goto(new URL('/?demo&experience=modern&motion=0',server.launchUrl).href);
 await expect(page.locator('.history')).toBeVisible();await pointAtHistory(page);await page.mouse.wheel(0,-100000);
 const card=page.locator(`article[data-op-id="${op.id}"]`);await expect(card).toBeAttached();await card.scrollIntoViewIfNeeded();
 const trigger=card.getByRole('button',{name:'Inspect delimited text',exact:true});await expect(trigger).toHaveCount(1);await trigger.press('Enter');
 const dialog=page.getByRole('dialog',{name:'Delimited text'});await expect(dialog.getByRole('table')).toHaveCount(0);await expect(dialog.locator('.data-original')).toHaveText(csv);
 await dialog.getByRole('button',{name:'CSV',exact:true}).click();const table=dialog.getByRole('table',{name:'Delimited records'});await expect(table).toBeVisible();await expect(table).toHaveAttribute('aria-rowcount','1203');expect(await dialog.getByRole('row').count()).toBeLessThan(31);
 await dialog.getByRole('checkbox',{name:'First record contains column names'}).check();await expect(dialog.getByRole('columnheader',{name:'name',exact:true})).toHaveCount(2);
 const find=dialog.getByRole('searchbox',{name:'Find delimited cells'});await find.fill('last, captured');await dialog.getByRole('button',{name:'Inspect record 1201, column 3'}).click();await expect(dialog.getByRole('region',{name:'Selected delimited cell'})).toContainText('last, captured\nvalue');await dialog.getByRole('button',{name:'Copy cell',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toBe('last, captured\nvalue');
 await find.fill('');const viewport=dialog.locator('.data-viewport');await viewport.focus();await page.keyboard.press('Control+End');await expect(dialog.getByRole('button',{name:'Inspect record 1202, column 3'})).toBeFocused();await expect(dialog.getByRole('region',{name:'Selected delimited cell'})).toContainText('Cell not present');await expect(dialog.getByRole('button',{name:'Copy cell',exact:true})).toBeDisabled();
 await find.fill('=SUM');await dialog.getByRole('button',{name:'Inspect record 2, column 3'}).click();await dialog.getByRole('button',{name:'Copy cell',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toBe('=SUM(A1:A2)');
 if(kind==='mcp'){await dialog.getByRole('combobox',{name:'Text block'}).selectOption('1');await dialog.getByRole('button',{name:'TSV',exact:true}).click();await expect(dialog.getByRole('button',{name:'Inspect record 2, column 2'})).toHaveText('right');await dialog.getByRole('combobox',{name:'Text block'}).selectOption('0');}
 await dialog.getByRole('button',{name:'Original',exact:true}).click();await dialog.getByRole('button',{name:'Copy original',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toBe(csv);
 await dialog.getByRole('button',{name:'CSV',exact:true}).click();await find.fill('last, captured');await dialog.getByRole('button',{name:'Inspect record 1201, column 3'}).click();await page.screenshot({path:resolve(`.local/delimited-${kind}-desktop.png`)});
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});const bounds=(await dialog.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);expect(await dialog.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);}
 expect(remote).toBe(0);await page.screenshot({path:resolve(`.local/delimited-${kind}-phone.png`)});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();await expect(page.getByRole('region',{name:'Operation detail'})).toHaveCount(0);
});


test('malformed delimited text keeps the exact source and never shows a partial grid',async({page})=>{
 const sample=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8')),op=sample.projection.operations.find((item:{kind:string})=>item.kind==='mcp');op.artifactIds=[];
 const raw='a,b\n1,2\n"unfinished';op.detail={kind:'mcp',server:'records',tool:'unknown',input:{},resultPreview:raw};
 await page.route('**/demo/bundle.json',route=>route.fulfill({json:sample}));await page.goto(new URL('/?demo&experience=modern&motion=0',server.launchUrl).href);await expect(page.locator('.history')).toBeVisible();await pointAtHistory(page);await page.mouse.wheel(0,-100000);
 const card=page.locator(`article[data-op-id="${op.id}"]`);await card.scrollIntoViewIfNeeded();await card.getByRole('button',{name:'Inspect delimited text'}).press('Enter');const dialog=page.getByRole('dialog',{name:'Delimited text'});await dialog.getByRole('button',{name:'CSV',exact:true}).click();await expect(dialog.getByRole('table')).toHaveCount(0);await expect(dialog).toContainText('Unclosed quoted cell');await expect(dialog.locator('.data-original')).toHaveText(raw);await page.screenshot({path:resolve('.local/delimited-malformed.png')});
});

for(const kind of ['shell','wrapped-shell','mcp'] as const)test(`${kind} offers one complete JSON view even when its text preview is folded`,async({page})=>{
 const sample=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8'));
 const op=sample.projection.operations.find((item:{kind:string})=>item.kind==='mcp');op.artifactIds=[];
 const body=JSON.stringify({items:Array.from({length:20},(_,i)=>({id:i,label:`captured row ${i}`}))},null,2);
 const raw=kind==='wrapped-shell'?JSON.stringify({output:body,exit_code:0}):body;
 if(kind==='mcp')op.detail={kind:'mcp',server:'records',tool:'list',input:{},resultPreview:raw};
 else{op.kind='shell';op.origin={type:'native',tool:'shell_command'};op.detail={kind:'shell',command:'read data',outputPreview:raw,exitCode:0};}
 await page.route('**/demo/bundle.json',route=>route.fulfill({json:sample}));await page.goto(new URL('/?demo&experience=modern&motion=0',server.launchUrl).href);await expect(page.locator('.history')).toBeVisible();await pointAtHistory(page);await page.mouse.wheel(0,-100000);
 const card=page.locator(`article[data-op-id="${op.id}"]`);await card.scrollIntoViewIfNeeded();const views=card.getByRole('group',{name:'Result views',exact:true});await expect(views).toHaveCount(1);
 const trigger=card.getByRole('button',{name:/^(Open larger|Inspect data)$/});await expect(trigger).toHaveCount(1);await trigger.press('Enter');
 const reader=page.getByRole('dialog',{name:'Data',exact:true});await expect(reader).toBeVisible();await reader.getByRole('button',{name:'Original',exact:true}).click();await expect(reader.locator('.data-original')).toHaveText(raw);
 await page.keyboard.press('Escape');await expect(reader).toHaveCount(0);await expect(trigger).toBeFocused();await expect(page.getByRole('region',{name:'Operation detail',exact:true})).toHaveCount(0);
});
