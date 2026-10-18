import type {gitThreadLayout} from './git-thread-layout.ts';
type Graph=ReturnType<typeof gitThreadLayout>;
type Point={x:number;y:number;z:number};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(high,value));
const path=(points:{x:number;y:number}[])=>points.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
/** Actual parent edges become ribbons in XYZ space; depth is presentation, never Git metadata. */
export function gitRibbonGeometry(graph:Graph,scale:number,angle=.35,lowResource=false,offset=0) {
  const middle=graph.height/2,cos=Math.cos(angle),sin=Math.sin(angle);
  const source=new Map(graph.nodes.map((node,index)=>{
    const phase=(index+offset)*.055;
    // A broad continuous sweep replaces the repeated small wire-like wiggle.
    const spine=(Math.sin(phase)*.8+Math.sin(phase*.47+.6)*.2)*54/scale;
    const separation=node.primary?0:Math.sign(node.y-middle)*Math.max(Math.abs(node.y-middle),64/scale);
    return [node.hash,{...node,y:middle+spine+separation,phase,z:Math.sin(phase*.8)*24/scale}] as const;
  }));
  const project=(point:Point)=>({x:point.x,y:middle+(point.y-middle)*cos-point.z*sin,depth:(point.y-middle)*sin+point.z*cos});
  const nodes=graph.nodes.map(node=>({...node,...project(source.get(node.hash)!)}));
  // Split longer crossing curves before depth sorting; only real edges are subdivided.
  const divisions=graph.edges.map(edge=>edge.primary?1:lowResource?1:3);
  const count=divisions.reduce((sum,value)=>sum+value,0),budget=lowResource?1200:6000;
  const perPiece=Math.min(lowResource?4:24,Math.floor(budget/Math.max(1,count)));
  const pieces=graph.edges.flatMap((edge,edgeIndex)=>{
    const from=source.get(edge.from)!,to=source.get(edge.to)!,bend=Math.max(28,(to.x-from.x)*.45),parts=divisions[edgeIndex]!;
    const sample=(t:number,fraction:number,silhouette=false)=>{
      const u=1-t,phase=mix(from.phase,to.phase,t);
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
      // The material envelope keeps its diameter under orbit: no edge-on collapse/DNA pinches.
      if(silhouette){point.y+=fraction*width*cos;point.z-=fraction*width*sin;}
      else {
        // Irregular filled laminae give one continuous material rather than parallel wire outlines.
        const warp=Math.sin(phase*2.1+fraction*13)*.018*Math.sin((fraction+.5)*Math.PI);
        const across=(fraction+warp)*width,depth=Math.cos(fraction*Math.PI)*width*.12;
        point.y+=across*cos+depth*sin;point.z-=across*sin-depth*cos;
      }
      return project(point);
    };
    return Array.from({length:parts},(_,part)=>{
      const steps=lowResource?5:12,ts=Array.from({length:steps+1},(_,index)=>(part+index/steps)/parts);
      // Subpixel coverage hides antialias seams between neighboring primary mesh pieces.
      const paint=(t:number,fraction:number,silhouette=false)=>{const point=sample(t,fraction,silhouette);if(edge.primary)point.x+=t===0?-.4/scale:t===1?.4/scale:0;return point;};
      const upper=ts.map(t=>paint(t,-.5,true)),lower=ts.map(t=>paint(t,.5,true));
      const layers=Math.min(perPiece,edge.primary?24:12);
      const bands=Array.from({length:layers},(_,index)=>{
        const left=index/layers-.5,right=(index+1)/layers-.5;
        const front=ts.map(t=>paint(t,left)),back=ts.map(t=>paint(t,right));
        return {path:`${path(front)} ${path([...back].reverse()).replace(/^M/,'L')} Z`,shade:.55+Math.sin(index*2.4)*.16,color:index%10};
      });
      return {edge,key:`${edge.from}/${edge.to}/${part}`,surface:`${path(upper)} ${path([...lower].reverse()).replace(/^M/,'L')} Z`,depth:sample((part+.5)/parts,0).depth,bands};
    });
  }).sort((a,b)=>a.depth-b.depth);
  return {nodes,pieces};
}
