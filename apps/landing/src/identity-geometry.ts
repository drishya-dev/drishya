type Point3 = [number,number,number];
export interface Face {points:[number,number][];depth:number;shade:number}

export function trackProgress(top:number,height:number,viewport:number):number {
  if(![top,height,viewport].every(Number.isFinite)||height<=viewport)return 0;
  return Math.max(0,Math.min(1,-top/(height-viewport)));
}

// Original aperture geometry: a six-sided major ring with an eight-facet tube.
// The same projection renders the static artifact and every reversible scroll pose.
export function identityFaces(turn:number,pointer?:{x:number;y:number}):Face[] {
  const progress=Number.isFinite(turn)?Math.max(0,Math.min(1,turn)):0;
  const px=pointer&&Number.isFinite(pointer.x)?Math.max(-1,Math.min(1,pointer.x)):0;
  const py=pointer&&Number.isFinite(pointer.y)?Math.max(-1,Math.min(1,pointer.y)):0;
  const pointerYaw=px*(4*Math.PI/180);
  const pointerPitch=py*(2.5*Math.PI/180);
  const yaw=-.32+progress*.96+pointerYaw,pitch=.34-progress*.16+pointerPitch,roll=-.14-progress*.24;
  const rotate=([x,y,z]:Point3):Point3=>{
    const a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw);
    const c=y*Math.cos(pitch)-b*Math.sin(pitch),d=y*Math.sin(pitch)+b*Math.cos(pitch);
    return [a*Math.cos(roll)-c*Math.sin(roll),a*Math.sin(roll)+c*Math.cos(roll),d];
  };
  const vertex=(u:number,v:number):Point3=>{
    const angle=u*Math.PI/12,cross=v*Math.PI/4;
    const sector=((angle+Math.PI/6)%(Math.PI/3))-Math.PI/6;
    const radius=122/Math.cos(sector)+44*Math.cos(cross);
    return rotate([radius*Math.cos(angle),radius*Math.sin(angle),44*Math.sin(cross)]);
  };
  const faces:Face[]=[];
  for(let u=0;u<24;u++)for(let v=0;v<8;v++){
    const points=[vertex(u,v),vertex(u+1,v),vertex(u+1,v+1),vertex(u,v+1)];
    const a=points[0]!,b=points[1]!,c=points[2]!;
    const ab=b.map((x,i)=>x-a[i]!),ac=c.map((x,i)=>x-a[i]!);
    const normal=[ab[1]!*ac[2]!-ab[2]!*ac[1]!,ab[2]!*ac[0]!-ab[0]!*ac[2]!,ab[0]!*ac[1]!-ab[1]!*ac[0]!];
    const length=Math.hypot(...normal)||1;
    const light=(normal[0]!*(-.35)+normal[1]!*(-.5)+normal[2]!*.78)/length;
    faces.push({points:points.map(([x,y,z])=>{const scale=650/(650-z);return [x*scale,y*scale];}),depth:points.reduce((sum,p)=>sum+p[2],0)/4,shade:Math.max(0,Math.min(1,.33+light*.6))});
  }
  return faces.sort((a,b)=>a.depth-b.depth);
}
