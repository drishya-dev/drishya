import{test,expect}from'@playwright/test';
import{readFileSync,readdirSync}from'node:fs';
import{resolve}from'node:path';
test('Release 1 build contains no chooser strings or Clarity entry chunk',async({page})=>{
  const assets=resolve('apps/ui/dist/assets'),js=readdirSync(assets).filter(name=>name.endsWith('.js'));
  expect(js.length).toBeGreaterThan(0);
  const built=js.map(name=>readFileSync(resolve(assets,name),'utf8')).join('\n');
  expect(built).not.toMatch(/UI versions|Choose your workspace|The same workspace, being rebuilt/);
  // No runtime variant import: Clarity stays as source, outside the product entry graph.
  const entry=readFileSync(resolve('apps/ui/src/main.tsx'),'utf8');expect(entry).not.toMatch(/import\(['"]\.\/clarity|from ['"]\.\/clarity/);
  expect(entry).toContain("from './modern/entry.tsx'");
});
