import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test, expect} from '@playwright/test';
import {App} from '../../apps/daemon/src/app.ts';
import {startServer, type RunningServer} from '../../apps/daemon/src/server.ts';

let dir: string, app: App, server: RunningServer, claude: string, codex: string, imageId: string;
test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'drishya-ui8-reference-'));
  const root = join(dir, 'workspace'); mkdirSync(root);
  const file = join(root, '研究.md'), text = '# Exact file content\nRetained literal input.\n';
  const source = join(dir, 'claude.jsonl'), time = '2026-11-02T00:00:00Z';
  const rows = [
    {type: 'user', uuid: 'u', cwd: root, sessionId: 'reference', timestamp: time, message: {content: 'Check file references.'}},
    {type: 'assistant', uuid: 'call', cwd: root, sessionId: 'reference', timestamp: time, message: {content: [{type:'tool_use', id:'write', name:'Write', input:{file_path:file, content:text}}]}},
    {type:'user', uuid:'result', cwd:root, sessionId:'reference', timestamp:time, message:{content:[{type:'tool_result',tool_use_id:'write',content:'File written.'}]},toolUseResult:{type:'create',filePath:file,originalFile:null,content:text}},
    {type:'assistant',uuid:'prose',cwd:root,sessionId:'reference',timestamp:time,message:{content:[{type:'text',text:`Saved :codex-file-citation{path=${JSON.stringify(file)} purpose="output" line_range_start=1 line_range_end=2}. Outside :codex-file-citation{path="/outside/read-only.txt" purpose="input"}.`}]}},
  ];
  writeFileSync(source, rows.map(row => JSON.stringify(row)).join('\n')+'\n');
  app = new App(join(dir,'home')); claude = (await app.ingest.importSource('claude-code',source)).recordingId;
  const codexSource = join(dir,'codex.jsonl');
  writeFileSync(codexSource,[{type:'session_meta',payload:{id:'image',cwd:root}}, {type:'event_msg',payload:{type:'item_completed',item:{id:'image',type:'ImageView',path:pathToFileURL(join(root,'preview image.png')).href}}}].map(row=>JSON.stringify(row)).join('\n')+'\n');
  codex = (await app.ingest.importSource('codex',codexSource)).recordingId;
  imageId = app.projection(codex).operations[0]!.id;
  server = await startServer({app,port:0});
});
test.afterAll(async()=>{await server.close();await app.close();if(!resolve(dir).startsWith(resolve(tmpdir())+sep))throw Error('Unsafe temporary path');rmSync(dir,{recursive:true,force:true});});

for (const width of [600,1440]) test(`native file references read and navigate safely at ${width}`, async ({page}) => {
  await page.setViewportSize({width,height:950});
  await page.route('**/v1/working-locations',route=>route.request().method()==='GET'?route.fulfill({json:{version:1,sessions:[]}}):route.continue());
  await page.goto(server.launchUrl); await expect(page.locator('.home')).toBeVisible();
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${claude}`);
  const reference=page.getByRole('button',{name:'Open work on 研究.md at line 1',exact:true});
  await expect(reference).toBeVisible();await expect(reference.locator('code')).toHaveText('研究.md:1–2');await expect(reference.locator('svg.file-format')).toBeVisible();
  await expect(page.locator('.prose')).not.toContainText(':codex-file-citation');
  await expect(page.locator('.md-link').filter({hasText:'read-only.txt'})).toHaveCount(1);
  await reference.focus();await page.keyboard.press('Enter');
  await expect(page.locator('.file-workspace')).toBeVisible();
  await expect(page.locator('.file-evidence-material')).toContainText('Exact file content');
  expect(await page.locator('.file-workspace').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.goto(`${server.url}/?experience=modern&motion=0#/r/${codex}`);
  const card=page.locator(`article[data-op-id="${imageId}"]`);
  await expect(card.locator('.op-title')).toHaveText('View image · preview image.png');
  await expect(card).not.toContainText('This image is outside'); // current disk access is never attempted by naming it.
});
