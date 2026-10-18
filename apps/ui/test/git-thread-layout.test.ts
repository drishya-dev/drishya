import {withGitPage} from '../src/lib/git-history-window.ts';
import {expect,it} from 'vitest';
import {gitThreadLayout} from '../src/lib/git-thread-layout.ts';
it('draws real fork and merge threads on a horizontal time axis, not a flattened list',()=>{
  const graph=gitThreadLayout([{hash:'merge',parents:['main','feature']},{hash:'feature',parents:['base']},{hash:'main',parents:['base']},{hash:'base',parents:[]}]);
  expect(graph.edges.map(edge=>[edge.from,edge.to])).toEqual([['main','merge'],['feature','merge'],['base','feature'],['base','main']]);
  expect(new Set(graph.nodes.map(node=>node.y)).size).toBeGreaterThan(1);
  for(const edge of graph.edges){expect(graph.nodes.find(node=>node.hash===edge.from)!.x).toBeLessThan(graph.nodes.find(node=>node.hash===edge.to)!.x);expect(edge.path).toContain(' C');}
});
it('retains every bounded-page commit and discloses off-page parents without fabricating edges',()=>{
  const commits=Array.from({length:50},(_,index)=>({hash:`c${index}`,parents:[`outside${index}`]}));const graph=gitThreadLayout(commits);
  expect(graph.nodes).toHaveLength(50);expect(graph.edges).toEqual([]);expect(graph.outside).toBe(50);expect(new Set(graph.nodes.map(node=>node.x)).size).toBe(50);
});

it('keeps a primary first-parent spine thicker than every branch without assigning branch colors',()=>{
  const commits=[{hash:'merge',parents:['main','feature']},{hash:'feature',parents:['base']},{hash:'main',parents:['base']},{hash:'base',parents:[]}];
  const seeds=new Set<string>(),graph=gitThreadLayout(commits,'merge',seeds);
  expect(seeds.size).toBe(0);expect(graph.nodes.filter(node=>node.primary).map(node=>node.hash)).toEqual(['merge','main','base']);
  expect(graph.edges.filter(edge=>edge.primary).every(edge=>edge.width===32)).toBe(true);expect(graph.edges.filter(edge=>!edge.primary).every(edge=>edge.width<=16)).toBe(true);
  const older=gitThreadLayout([{hash:'base',parents:['root']},{hash:'root',parents:[]}],'merge',new Set(graph.mainSeeds));expect(older.nodes.every(node=>node.primary)).toBe(true);
});

it('scrolls through arbitrarily many metadata pages while retaining only six consecutive pages',()=>{
  let pages=new Map<number,{start:number}>();for(let start=0;start<=1000;start+=50){const previous=pages;pages=withGitPage(pages,{start});expect(pages.size).toBeLessThanOrEqual(6);expect(previous.has(start)).toBe(false);}
  expect([...pages.keys()].sort((a,b)=>a-b)).toEqual([750,800,850,900,950,1000]);
  for(let start=700;start>=0;start-=50)pages=withGitPage(pages,{start});expect([...pages.keys()].sort((a,b)=>a-b)).toEqual([0,50,100,150,200,250]);
});

it('sizes actual branch segments by their loaded commits rather than unrelated reused lanes',()=>{
 const graph=gitThreadLayout([{hash:'merge',parents:['main','long3','short']},{hash:'long3',parents:['long2']},{hash:'long2',parents:['long1']},{hash:'long1',parents:['base']},{hash:'short',parents:['base']},{hash:'main',parents:['base']},{hash:'base',parents:[]}],'merge');
 const long=graph.edges.find(edge=>edge.from==='long3'&&edge.to==='merge')!,short=graph.edges.find(edge=>edge.from==='short'&&edge.to==='merge')!;
 expect(long.width).toBeGreaterThan(short.width);expect(long.width).toBeLessThanOrEqual(16);expect(graph.edges.find(edge=>edge.from==='main'&&edge.to==='merge')!.width).toBe(32);
});
