import {expect,it} from 'vitest';
import {gitThreadLayout} from '../src/lib/git-thread-layout.ts';
import {gitRibbonGeometry} from '../src/lib/git-ribbon-geometry.ts';
const graph=gitThreadLayout([{hash:'merge',parents:['main','feature']},{hash:'feature',parents:['base']},{hash:'main',parents:['base']},{hash:'base',parents:[]}]);
it('keeps real parent identities while constructing depth-ordered spatial ribbons',()=>{
 const result=gitRibbonGeometry(graph,.6);
 expect(new Set(result.pieces.map(piece=>`${piece.edge.from}/${piece.edge.to}`))).toEqual(new Set(graph.edges.map(edge=>`${edge.from}/${edge.to}`)));
 expect(result.pieces.map(piece=>piece.depth)).toEqual(result.pieces.map(piece=>piece.depth).sort((a,b)=>a-b));
 expect(new Set(result.pieces.map(piece=>piece.depth)).size).toBeGreaterThan(2);
 expect(result.pieces.every(piece=>!piece.surface.includes('NaN')&&piece.surface.endsWith(' Z'))).toBe(true);
 expect(gitRibbonGeometry(graph,.6)).toEqual(result);
});
it('peels branch material from the outer primary rim rather than its core',()=>{
 const result=gitRibbonGeometry(graph,1,0),branch=result.pieces.find(piece=>piece.edge.from==='base'&&piece.edge.to==='feature'&&piece.key.endsWith('/0'))!;
 const origin=result.nodes.find(node=>node.hash==='base')!;
 const first=branch.surface.match(/^M([\d.-]+),([\d.-]+)/)!;
 expect(Number(first[1])).toBeCloseTo(origin.x,1);expect(Math.abs(Number(first[2])-origin.y)).toBeGreaterThan(5);
});
it('changes projected depth and geometry when orbiting while preserving node and edge identity',()=>{
 const front=gitRibbonGeometry(graph,.6,0),rotated=gitRibbonGeometry(graph,.6,1.2);
 expect(front.nodes.map(node=>node.hash)).toEqual(rotated.nodes.map(node=>node.hash));
 expect(front.nodes.map(node=>node.y)).not.toEqual(rotated.nodes.map(node=>node.y));
 expect(front.pieces.map(piece=>piece.surface)).not.toEqual(rotated.pieces.map(piece=>piece.surface));
});
it('bounds texture cost independently of dense graph size and lowers it for low resources',()=>{
 const dense=gitThreadLayout(Array.from({length:300},(_,i)=>({hash:`c${i}`,parents:i<299?[`c${i+1}`]:[]})));
 const normal=gitRibbonGeometry(dense,.04),low=gitRibbonGeometry(dense,.04,.45,true);
 expect(normal.pieces.reduce((sum,piece)=>sum+piece.fibers.length,0)).toBeLessThanOrEqual(6000);
 expect(low.pieces.reduce((sum,piece)=>sum+piece.fibers.length,0)).toBeLessThanOrEqual(1200);
 expect(low.pieces.reduce((sum,piece)=>sum+piece.fibers.length,0)).toBeLessThan(normal.pieces.reduce((sum,piece)=>sum+piece.fibers.length,0));
});

it('holds the primary bundle diameter across all orbit angles without flat ribbon pinches',()=>{
 for(const angle of [0,.7,Math.PI/2,Math.PI,Math.PI*1.5]){
  const result=gitRibbonGeometry(graph,1,angle),piece=result.pieces.find(piece=>piece.edge.primary)!;
  const coordinates=[...piece.surface.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map(match=>({x:Number(match[1]),y:Number(match[2])}));
  expect(Math.abs(coordinates[0]!.y-coordinates.at(-1)!.y)).toBeGreaterThan(30);
 }
});
