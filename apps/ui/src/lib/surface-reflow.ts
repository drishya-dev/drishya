export interface SurfaceBounds {x:number;y:number;width:number;height:number}
/** FLIP around the centre preserves the dock's existing CSS translation. */
export function surfaceFrames(before:SurfaceBounds,after:SurfaceBounds,base:string){
 if(!before.width||!before.height||!after.width||!after.height)return;
 const x=before.x+before.width/2-after.x-after.width/2,y=before.y+before.height/2-after.y-after.height/2;
 const sx=before.width/after.width,sy=before.height/after.height;
 return {sx,sy,frames:[{transform:`translate(${x}px, ${y}px) ${base==='none'?'':base} scale(${sx}, ${sy})`,transformOrigin:'50% 50%'},{transform:base,transformOrigin:'50% 50%'}]};
}
