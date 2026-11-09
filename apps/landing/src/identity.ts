import {identityFaces} from './identity-geometry.ts';

export function identityPolygons(turn:number,pointer?:{x:number;y:number}):string {
  return identityFaces(turn,pointer).map(face=>{
    const tone=Math.round(48+face.shade*185);
    const color=`rgb(${tone-7},${tone+7},${tone+3})`;
    return `<polygon points="${face.points.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' ')}" fill="${color}" stroke="${color}" stroke-width=".7"/>`;
  }).join('');
}

export function identityHTML():string {
  const nodes=[[56,90],[140,30],[242,65],[334,20],[420,112],[470,200],[377,271],[264,215],[163,286],[65,227],[213,145],[335,140]];
  const edges=[[0,1],[0,9],[1,2],[1,10],[2,3],[2,10],[3,4],[3,11],[4,5],[4,11],[5,6],[6,7],[6,11],[7,8],[7,10],[8,9],[9,10],[10,11]];
  const rearNodes=nodes.slice(0,6);
  const frontNodes=nodes.slice(6);
  const rearEdges=edges.filter(([a,b])=>a!<6&&b!<6);
  const frontEdges=edges.filter(([a,b])=>a!>=6||b!>=6);
  return `<div class="identity-world" aria-hidden="true"><svg class="identity-map identity-map-rear" viewBox="0 0 520 320"><g>${rearEdges.map(([a,b])=>`<path d="M${nodes[a!]!.join(',')}L${nodes[b!]!.join(',')}"/>`).join('')}</g>${rearNodes.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.5"/>`).join('')}</svg><svg class="identity-map identity-map-front" viewBox="0 0 520 320"><g>${frontEdges.map(([a,b])=>`<path d="M${nodes[a!]!.join(',')}L${nodes[b!]!.join(',')}"/>`).join('')}</g>${frontNodes.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i===4?5:2.5}"/>`).join('')}</svg><svg class="identity-sculpture" viewBox="-230 -215 460 430" focusable="false">${identityPolygons(0)}</svg><span class="identity-coordinate">दृश्य <span>that which is seen</span></span></div>`;
}
