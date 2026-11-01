import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {expect,test} from './legacy-test.ts';
import {pointAtHistory} from './history-gestures.ts';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer,type RunningServer} from '../../apps/daemon/src/server.ts';
let dir:string,app:App,server:RunningServer;
test.beforeAll(async()=>{dir=mkdtempSync(join(tmpdir(),'drishya-delimited-acceptance-'));app=new App(dir);server=await startServer({app,port:0});});
test.afterAll(async()=>{await server.close();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('unsafe path');rmSync(dir,{recursive:true,force:true});});

test('literal CSV cells stay distinct from missing cells through header, filter and block changes',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).copied=text;}}}));
 const sample=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8')),op=sample.projection.operations.find((item:{kind:string})=>item.kind==='mcp');op.artifactIds=[];
 const csv='\ufeffname,name,note\r\n00042,,"line\r\nnext"\r\nshort\r\n=SUM(A1:A2),1e400,"say ""hello"""\r\n,,',tsv='name\tvalue\n"a\tb"\t"line\nnext"';
 op.detail={kind:'mcp',server:'records',tool:'arbitrary',input:{},resultPreview:JSON.stringify({content:[{type:'text',text:csv},{type:'text',text:tsv}]})};
 await page.route('**/demo/bundle.json',route=>route.fulfill({json:sample}));await page.goto(new URL('/?demo&experience=modern&motion=0',server.launchUrl).href);
 await expect(page.locator('.history')).toBeVisible();await pointAtHistory(page);await page.mouse.wheel(0,-100000);const card=page.locator(`article[data-op-id="${op.id}"]`);await card.scrollIntoViewIfNeeded();const trigger=card.getByRole('button',{name:'Inspect delimited text',exact:true});await card.getByRole('group',{name:'Captured result views',exact:true}).hover();await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Captured delimited text',exact:true}),selection=dialog.getByRole('region',{name:'Selected delimited cell',exact:true});
 await dialog.getByRole('button',{name:'CSV',exact:true}).click();await dialog.getByRole('checkbox',{name:'First record contains column names'}).check();await expect(dialog.getByRole('columnheader',{name:'name',exact:true})).toHaveCount(2);
 await dialog.getByRole('button',{name:'Inspect record 2, column 2',exact:true}).click();await expect(selection).toContainText('Empty captured cell');await selection.getByRole('button',{name:'Copy cell',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toBe('');
 await dialog.getByRole('button',{name:'Inspect record 3, column 2',exact:true}).click();await expect(selection).toContainText('Cell not present');await expect(selection.getByRole('button',{name:'Copy cell',exact:true})).toBeDisabled();
 await dialog.getByRole('button',{name:'Inspect record 2, column 3',exact:true}).click();await selection.getByRole('button',{name:'Copy cell',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toBe('line\r\nnext');
 await dialog.getByRole('button',{name:'Inspect record 2, column 1',exact:true}).click();await selection.getByRole('button',{name:'Copy cell',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toBe('00042');
 const find=dialog.getByRole('searchbox',{name:'Find delimited cells',exact:true});await find.fill('not in these records');await expect(dialog.getByRole('cell')).toHaveCount(0);await expect(dialog).toContainText('0 of 4 records');await find.fill('say "hello"');await dialog.getByRole('button',{name:'Inspect record 4, column 3',exact:true}).click();await selection.getByRole('button',{name:'Copy cell',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toBe('say "hello"');
 await dialog.getByRole('combobox',{name:'Captured text block',exact:true}).selectOption('1');await expect(selection).toHaveCount(0);await expect(dialog.locator('.data-original')).toHaveText(tsv);await dialog.getByRole('button',{name:'TSV',exact:true}).click();await expect(find).toHaveValue('');await expect(dialog.getByRole('checkbox')).not.toBeChecked();await dialog.getByRole('button',{name:'Inspect record 2, column 1',exact:true}).click();await selection.getByRole('button',{name:'Copy cell',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toBe('a\tb');
 await dialog.getByRole('combobox',{name:'Captured text block',exact:true}).selectOption('0');await dialog.getByRole('button',{name:'Copy original',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toBe(csv);
 for(const width of [390,320]){await page.setViewportSize({width,height:844});expect(await dialog.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);}
 await page.screenshot({path:resolve('.local/delimited-acceptance-phone.png')});await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
});

test('over-column captured CSV stays exact Original instead of a partial grid',async({page})=>{
 const sample=JSON.parse(readFileSync(resolve('apps/ui/public/demo/bundle.json'),'utf8')),op=sample.projection.operations.find((item:{kind:string})=>item.kind==='mcp');op.artifactIds=[];
 const raw='a,b\n'+Array(33).fill('literal').join(',');op.detail={kind:'mcp',server:'records',tool:'arbitrary',input:{},resultPreview:raw};
 await page.route('**/demo/bundle.json',route=>route.fulfill({json:sample}));await page.goto(new URL('/?demo&experience=modern&motion=0',server.launchUrl).href);await expect(page.locator('.history')).toBeVisible();await pointAtHistory(page);await page.mouse.wheel(0,-100000);const card=page.locator(`article[data-op-id="${op.id}"]`);await card.scrollIntoViewIfNeeded();await card.getByRole('group',{name:'Captured result views',exact:true}).hover();await card.getByRole('button',{name:'Inspect delimited text',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Captured delimited text',exact:true});await dialog.getByRole('button',{name:'CSV',exact:true}).click();await expect(dialog.getByRole('table')).toHaveCount(0);await expect(dialog).toContainText('32 columns');await expect(dialog.locator('.data-original')).toHaveText(raw);
});
