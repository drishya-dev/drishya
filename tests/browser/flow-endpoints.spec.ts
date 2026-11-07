import { resolve } from 'node:path';
import { build } from 'esbuild';
import { expect, test } from '@playwright/test';

for (const width of [600, 1440]) test(`connections follow only their visible endpoints at ${width}`, async ({ page }) => {
  const component = JSON.stringify(resolve('apps/ui/src/components/FlowConnections.tsx').replaceAll('\\', '/'));
  const bundled = await build({ stdin: { contents: `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{FlowConnections}from ${component};
const projection={links:[]};function Fixture(){const[margin,setMargin]=useState(0);return <><button onClick={()=>setMargin(500)}>Move target out of view</button><button onClick={()=>setMargin(0)}>Restore target</button><div className="history"><div className="ops-row"><article className="op" data-op-id="a">Synthetic source</article><article className="op" data-op-id="b" style={{marginTop:margin}}>Synthetic target</article></div></div><FlowConnections projection={projection}/></>};createRoot(document.getElementById('root')).render(<Fixture/>);`, loader: 'tsx', resolveDir: resolve('apps/ui') }, bundle: true, write: false, format: 'iife', platform: 'browser', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"' } });
  await page.setViewportSize({ width, height: 700 });
  await page.route('https://flow-fixture.invalid/', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><style>body{margin:0}.history{position:absolute;top:40px;left:20px;width:500px;height:350px;overflow:auto}.ops-row{display:flex;gap:20px;min-height:900px}.op{box-sizing:border-box;flex:0 0 180px;height:180px;border:1px solid}.flow-connections{position:fixed;inset:0;width:100%;height:100%;pointer-events:none}.flow-connections path{fill:none;stroke:black}</style><div id="root"></div><script>${bundled.outputFiles[0]!.text}</script>` }));
  await page.goto('https://flow-fixture.invalid/');
  const paths = page.locator('.flow-connections [data-flow-link]');
  await expect(paths).toHaveCount(1);
  // Outlive the existing one-off 1,800 ms relayout timer: position changes must
  // remain observable later, without a new projection or a window resize.
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Move target out of view' }).click();
  await expect(paths).toHaveCount(0);
  await page.getByRole('button', { name: 'Restore target' }).click();
  await expect(paths).toHaveCount(1);
  await page.locator('.op').first().evaluate(el => { el.style.height = '420px'; });
  await page.locator('.op').last().evaluate(el => { el.style.marginTop = '190px'; });
  await page.locator('.history').evaluate(el => { el.scrollTop = 100; el.dispatchEvent(new Event('scroll')); });
  // The source body intersects the viewport, but its route endpoint is above it.
  await expect(paths).toHaveCount(0);
});
