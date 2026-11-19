import { compose, asOfProjection } from '../../packages/scene/src/index.ts';
import { mapActivity } from '../../apps/ui/src/lib/map-detail.ts';
import { workspaceFiles } from './workspace-files.ts';
import type { RealCase } from './types.ts';
export const mapActivityCase: RealCase = {
 ...workspaceFiles, name:'map-activity', about:'Step-derived file activity agrees in live and replay; indexed coordinates stay unchanged',
 verify(p) {
  const nodes=p.files.map((file,i)=>({id:file.path,path:file.path,dir:'',x:(i%20)/20,y:Math.floor(i/20)/20}));
  const graph={nodes,edges:[],temporal:'observed'} as unknown as import('../../packages/contracts/src/index.ts').RepoGraph;
  const fileOps=new Set(p.operations.filter(op=>op.paths.some(path=>nodes.some(node=>node.id===path.path))).map(op=>op.id));
  const positions=p.timeline.flatMap((item,i)=>(item.type==='op-start'||item.type==='op-end')&&fileOps.has(item.operationId)?[i+1]:[]);
  const samples=[...new Set([positions[0],positions[Math.floor(positions.length/2)],positions.at(-1),p.timeline.length].filter((x):x is number=>x!==undefined))];
  let agreements=0,selected=0,heated=0,matched=0;
  for(const step of samples){
   const heat=compose(p,{step,since:step}).heat; heated+=heat.length; matched+=heat.filter(h=>nodes.some(n=>n.id===h.path)).length;
   const live=mapActivity(graph,heat);
   const replay=mapActivity(graph,compose(asOfProjection(p,step),{step,since:0}).heat);
   if(JSON.stringify(live)===JSON.stringify(replay)&&live.length<=3&&live.every(x=>nodes.includes(x.node)))agreements++;
   selected+=live.length;
  }
  return [`${agreements===samples.length&&selected>0?'PASS':'FAIL'} ${agreements}/${samples.length} live/replay samples; ${selected} selected locations; ${p.files.length} captured files; ${heated} heat cells; ${matched} mapped heat cells; ${p.operations.filter(o=>o.paths.some(p=>p.role==='write')).length} edit/write operations`];
 }
};
