// SITE-1: the public website shows only the committed synthetic sample. This script turns that sample into the small,
// display-ready JSON the site reads. It reuses LAND-2's chapter resolver so both sites agree on what is safe to publish.
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveChapters} from './build-landing.ts';

const repo=fileURLToPath(new URL('../',import.meta.url));
const safePath=(p:unknown)=>typeof p==='string'&&/^[\w./-]+$/.test(p)&&!p.startsWith('/')&&!p.split('/').includes('..')?p:undefined;

export async function buildSiteSample() {
  const bundle=JSON.parse(await readFile(resolve(repo,'apps/ui/public/demo/bundle.json'),'utf8'));
  const chapters=resolveChapters(bundle); // throws unless this is the committed synthetic replay
  const projection=bundle.projection;
  const agentLabel=(id:string)=>{const a=projection.agents.find((x:any)=>x.id===id);return a?.parentId?`${a.label??'Sub-agent'} sub-agent`:'Main agent';};
  const harnessOf=(id:string)=>id.includes('.toolu_')?'Claude Code':'Codex';
  const operations=projection.operations.map((o:any)=>{
    const d=o.detail;
    const target=safePath(d.path)??(d.kind==='search'?`“${String(d.query).slice(0,40)}”`:d.kind==='mcp'?`${d.server} · ${d.tool}`:d.kind==='spawn'?String(d.description).slice(0,48):String(d.command??'').slice(0,40));
    const outcome=d.kind==='test'||d.kind==='shell'?(d.exitCode===0?'passed':'failed'):undefined;
    return {kind:d.kind,target,path:safePath(d.path),outcome,agent:agentLabel(o.agentId),harness:harnessOf(o.id)};
  });
  const counts:Record<string,number>={};
  for(const o of operations)counts[o.kind]=(counts[o.kind]??0)+1;
  const graph={
    nodes:bundle.graph.nodes.map((n:any)=>({path:safePath(n.path)!,dir:n.dir,language:n.language})).filter((n:any)=>n.path),
    edges:bundle.graph.edges.filter((e:any)=>e.relation==='static-import').map((e:any)=>({from:e.from,to:e.to})),
  };
  const sample={
    title:bundle.recording.title,
    harnesses:[...new Set(operations.map((o:any)=>o.harness))],
    agents:projection.agents.map((a:any)=>({label:a.parentId?`${a.label} sub-agent`:'Main agent',model:a.model,parent:!!a.parentId})),
    chapters:chapters.map(c=>({key:c.key,title:c.title,short:c.short,description:c.description,kind:c.kind,path:c.path,command:c.command,provenance:c.provenance,status:c.status,text:c.text})),
    operations,counts,graph,
  };
  const out=resolve(repo,'apps/site/src/generated');
  await mkdir(out,{recursive:true});
  await writeFile(resolve(out,'sample.json'),JSON.stringify(sample));
  // Fonts come from the product, so the site and the app share one face; they are copied, never committed twice.
  const fonts=resolve(repo,'apps/site/public/fonts');await mkdir(fonts,{recursive:true});
  await cp(resolve(repo,'apps/ui/public/fonts'),fonts,{recursive:true});
  // The laptop runs the real app on the same synthetic bundle, plus the brand assets it references.
  await mkdir(resolve(repo,'apps/site/public/demo'),{recursive:true});await cp(resolve(repo,'apps/ui/public/demo/bundle.json'),resolve(repo,'apps/site/public/demo/bundle.json'));
  await cp(resolve(repo,'apps/ui/public/brand'),resolve(repo,'apps/site/public/brand'),{recursive:true});
  console.log(`Site sample: ${operations.length} operations, ${graph.nodes.length} files, ${chapters.length} chapters (synthetic only).`);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildSiteSample();
