import type {gitThreadLayout} from './git-thread-layout.ts';
type Graph=ReturnType<typeof gitThreadLayout>;
type Point={x:number;y:number;z:number};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(high,value));
const path=(points:{x:number;y:number}[])=>points.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
/** Actual parent edges become ribbons in XYZ space; depth is presentation, never Git metadata. */
export function gitRibbonGeometry(graph:Graph,scale:number,angle=.35,lowResource=false,offset=0) {
  const middle=graph.height/2,cos=Math.cos(angle),sin=Math.sin(angle);
  const source=new Map(graph.nodes.map((node,index)=>[node.hash,{...node,y:node.primary?node.y:middle+Math.sign(node.y-middle)*Math.max(Math.abs(node.y-middle),42/scale),phase:(index+offset)*.13,z:Math.sin((index+offset)*.13*.8)*40}]));
  const project=(point:Point)=>({x:point.x,y:middle+(point.y-middle)*cos-point.z*sin,depth:(point.y-middle)*sin+point.z*cos});
  const nodes=graph.nodes.map(node=>({...node,...project(source.get(node.hash)!)}));
  // Split longer crossing curves before depth sorting; only real edges are subdivided.
  const divisions=graph.edges.map(edge=>edge.primary?1:lowResource?1:3);
  const count=divisions.reduce((sum,value)=>sum+value,0),budget=lowResource?1200:6000;
  const perPiece=Math.min(lowResource?4:32,Math.floor(budget/Math.max(1,count)));
  const pieces=graph.edges.flatMap((edge,edgeIndex)=>{
    const from=source.get(edge.from)!,to=source.get(edge.to)!,bend=Math.max(28,(to.x-from.x)*.45),parts=divisions[edgeIndex]!;
    const sample=(t:number,fraction:number,silhouette=false)=>{
      const u=1-t,phase=mix(from.phase,to.phase,t),twist=Math.sin(phase*.72)*.12;
      const point={x:u*u*u*from.x+3*u*u*t*(from.x+bend)+3*u*t*t*(to.x-bend)+t*t*t*to.x,y:u*u*u*from.y+3*u*u*t*from.y+3*u*t*t*to.y+t*t*t*to.y,z:mix(from.z,to.z,t)+(edge.primary?0:Math.sin(t*Math.PI)*(edge.lane%2?32:-32))};
      // A fork peels from the primary's rim, never through the center of its visible material.
      if(!edge.primary){
        for(const [node,weight,side] of [[from,(1-t)**3,Math.sign(to.y-from.y)||1],[to,t**3,Math.sign(from.y-to.y)||1]] as const){
          if(!node.primary)continue;
          const rim=side*16/scale*weight;
          point.y+=rim*cos;point.z-=rim*sin;
        }
      }
      const taper=edge.primary?1:Math.min(from.primary?clamp(t/.2,.25,1):1,to.primary?clamp((1-t)/.2,.25,1):1);
      const width=edge.width/scale*taper*(.98+.02*Math.sin(phase*.65));
      // Volumetric cross-section keeps its diameter under orbit: no edge-on collapse/DNA pinches.
      if(silhouette){point.y+=fraction*width*cos;point.z-=fraction*width*sin;}
      else {const theta=fraction*Math.PI*2+twist,radius=width*.5;point.y+=radius*Math.cos(theta);point.z+=radius*Math.sin(theta);}
      return {...project(point),twist};
    };
    return Array.from({length:parts},(_,part)=>{
      const steps=lowResource?5:12,ts=Array.from({length:steps+1},(_,index)=>(part+index/steps)/parts);
      const upper=ts.map(t=>sample(t,-.5,true)),lower=ts.map(t=>sample(t,.5,true));
      const fibers=Array.from({length:Math.min(perPiece,edge.primary?32:16)},(_,index)=>{
        const fraction=(index+.5)/Math.min(perPiece,edge.primary?32:16)-.5,points=ts.map(t=>sample(t,fraction));
        return {path:path(points),shade:clamp(.65+Math.sin(fraction*Math.PI*2+angle)*.25,.35,1),color:index%10};
      });
      return {edge,key:`${edge.from}/${edge.to}/${part}`,surface:`${path(upper)} ${path([...lower].reverse()).replace(/^M/,'L')} Z`,depth:sample((part+.5)/parts,0).depth,fibers};
    });
  }).sort((a,b)=>a.depth-b.depth);
  return {nodes,pieces};
}
