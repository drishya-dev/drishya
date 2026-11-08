import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe,it,expect} from 'vitest';
import {resolveChapters,validateRelease,homeHTML,codeHTML} from '../../../scripts/build-landing.ts';

const bundle=JSON.parse(readFileSync(fileURLToPath(new URL('../public/demo/bundle.json',import.meta.url)),'utf8'));
const preview={state:'preview',sourceUrl:null,releases:[],requirements:{node:'24.x',pnpm:'10.34.5',minimumWidth:600}};
describe('public landing evidence and availability',()=>{
  it('derives all four bookmarks and literal materials from the fixed synthetic fixture',()=>{
    const chapters=resolveChapters(bundle);expect(chapters.map(c=>c.step)).toEqual([4,24,26,28]);
    expect(chapters[0]!.text).toBe(bundle.artifactText[bundle.projection.operations.find((o:any)=>o.id===chapters[0]!.operationId).detail.excerptArtifactId]);
    expect(chapters[2]!.text).toContain('-  if (!cart.total)');expect(chapters[2]!.text).toContain('+  if (cart.total == null)');
    expect(chapters[3]!.status).toBe('6 passed · 0 failed');expect(chapters[0]!.mapped).toBe(true);
  });
  it('fails closed on missing, reordered, changed-kind or changed-result evidence',()=>{
    for(const change of [(b:any)=>b.projection.operations.shift(),(b:any)=>b.projection.operations.find((o:any)=>o.id.endsWith('synthetic0010')).detail.kind='read',(b:any)=>b.projection.operations.find((o:any)=>o.id.endsWith('synthetic0011')).detail.summary.failed=1,(b:any)=>b.artifactText={}]){
      const bad=structuredClone(bundle);change(bad);expect(()=>resolveChapters(bad)).toThrow();
    }
    const bad=structuredClone(bundle);bad.projection.timeline.reverse();expect(()=>resolveChapters(bad)).toThrow();
  });
  it('does not turn absent map nodes into a file relationship',()=>{
    const noMap=structuredClone(bundle);noMap.graph.nodes=[];expect(resolveChapters(noMap)[0]!.mapped).toBe(false);
  });
  it('escapes captured characters and retains complete static walkthrough when scripts fail',()=>{
    expect(codeHTML('<script>alert(1)</script>')).not.toContain('<script>');
    const html=homeHTML(bundle,resolveChapters(bundle),preview);
    for(const step of [4,24,26,28])expect(html).toContain(`/demo/?demo&at=${step}`);
    expect(html).toContain('Read the complete walkthrough');expect(html).toContain('Synthetic sample');expect(html).not.toContain('Download for');
  });
  it('never invents preview source/download destinations and rejects malformed release declarations',()=>{
    expect(validateRelease(preview).state).toBe('preview');
    expect(()=>validateRelease({...preview,sourceUrl:'https://github.com/private/repo'})).toThrow();
    expect(()=>validateRelease({...preview,state:'release'})).toThrow();
    expect(()=>validateRelease({...preview,state:'source',sourceUrl:'http://127.0.0.1:7878'})).toThrow();
    expect(()=>validateRelease({...preview,state:'source',sourceUrl:'https://user:password@example.com'})).toThrow();
    expect(()=>validateRelease({...preview,state:'source'})).toThrow();
  });
});
