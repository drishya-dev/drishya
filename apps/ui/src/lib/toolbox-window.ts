import type {SurfaceBounds} from './surface-reflow.ts';

/** Header/composer layout bounds are injected; content never reserves imaginary minimum space. */
export function toolboxAllocation(stage:SurfaceBounds,headerBottom:number,composerTop:number,content:{width:number;height:number}):SurfaceBounds {
 const left=stage.x+12,right=stage.x+stage.width-12;
 const top=Math.max(stage.y+12,headerBottom+12),bottom=Math.max(top,Math.min(stage.y+stage.height-12,composerTop-12));
 const width=Math.min(content.width,Math.max(0,right-left)),height=Math.min(content.height,bottom-top);
 return {x:left+(right-left-width)/2,y:top+(bottom-top-height)/2,width,height};
}

/** A top-left FLIP maps the single real material, including a partially completed previous motion. */
export function toolboxTransform(from:SurfaceBounds,to:SurfaceBounds):string {
 return `translate(${from.x-to.x}px, ${from.y-to.y}px) scale(${to.width?from.width/to.width:1}, ${to.height?from.height/to.height:1})`;
}
