import {expect,it} from 'vitest';
import {readingWindowLayout,resizeReadingWindow} from '../src/lib/reading-window.ts';
import {workingLocations} from '../../../packages/contracts/src/working-locations.ts';

it('clamps a saved window when the viewport, header or reader size changes',()=>{
  expect(readingWindowLayout({x:1000,y:700,height:800},{width:680,height:800},{width:1000,height:700,top:76})).toEqual({x:308,y:76,height:612});
  expect(readingWindowLayout({x:-100,y:-50,height:10},{width:600,height:500},{width:1440,height:900,top:76})).toEqual({x:12,y:76,height:220});
  expect(readingWindowLayout({},{width:600,height:500},{width:1440,height:900,top:76})).toEqual({});
  expect(readingWindowLayout({x:Infinity,y:NaN,height:NaN},{width:600,height:500},{width:1440,height:900,top:76})).toEqual({});
});
it('persists only allowed numeric window geometry without captured content',()=>{
  const clean=workingLocations({version:1,sessions:[{id:'rec_test',entries:[
    ['surface/Git review',{x:12,y:100,height:500,text:'private source',draft:'private draft'}],
    ['surface/File reader',{x:-1,y:100}],['surface/Captured file',{height:Infinity}],
    ['surface/unexpected',{height:500}],['surface/File reader',{}],
  ]}]}).sessions[0]!.entries;
  expect(clean).toEqual([['surface/Git review',{x:12,y:100,height:500}],['surface/File reader',{}]]);
});

it('anchors the opposite edge for every resize direction and clamps at viewport/minimum bounds',()=>{
 const rect={x:300,y:150,width:600,height:400},viewport={width:1440,height:900,top:76};
 expect(resizeReadingWindow(rect,'left',-100,viewport)).toEqual({x:200,y:150,width:700,height:400});
 expect(resizeReadingWindow(rect,'right',100,viewport)).toEqual({...rect,width:700});
 expect(resizeReadingWindow(rect,'top',-50,viewport)).toEqual({...rect,y:100,height:450});
 expect(resizeReadingWindow(rect,'bottom',50,viewport)).toEqual({...rect,height:450});
 const left=resizeReadingWindow(rect,'left',2000,viewport);expect(left.x+left.width).toBe(900);expect(left.width).toBe(360);
 const top=resizeReadingWindow(rect,'top',2000,viewport);expect(top.y+top.height).toBe(550);expect(top.height).toBe(220);
 expect(resizeReadingWindow(rect,'right',2000,viewport).width).toBe(1128);
 expect(resizeReadingWindow(rect,'bottom',2000,viewport).height).toBe(738);
 expect(readingWindowLayout({x:1000,y:800,width:900,height:700},{width:900,height:700},{width:1000,height:700,top:76})).toEqual({x:88,y:76,width:900,height:612});
});
it('retains bounded peek references and window width without source bodies',()=>{
 const entries=workingLocations({version:1,sessions:[{id:'rec_test',entries:[['peek/tabs',{files:['src/a.ts'],preview:'src/b.ts',text:'not source'}],['surface/File reader',{width:500,x:12,y:90}],['peek/tabs',{files:Array(9).fill('a')}]]}]}).sessions[0]!.entries;
 expect(entries).toEqual([['peek/tabs',{files:['src/a.ts'],preview:'src/b.ts'}],['surface/File reader',{width:500,x:12,y:90}]]);
 const valid=workingLocations({version:1,sessions:[{id:'rec_test',entries:[['peek/tabs',{files:['src/a.ts'],preview:'src/b.ts'}]]}]}).sessions[0]!.entries;
 expect(valid).toEqual([['peek/tabs',{files:['src/a.ts'],preview:'src/b.ts'}]]);
});

it('keeps restored file peeks in their reading lane above the composer and away from the time rail',()=>{
 const bounds={width:1440,height:900,top:174,left:691,right:1392,bottom:660};
 const restored=readingWindowLayout({x:400,y:64,width:850,height:1000},{width:850,height:1000},bounds);
 expect(restored).toEqual({x:691,y:174,width:701,height:486});
 for(const edge of ['left','right','top','bottom'] as const){
  const result=resizeReadingWindow(restored as {x:number;y:number;width:number;height:number},edge,edge==='left'||edge==='top'?-9999:9999,bounds);
  expect(result.x).toBeGreaterThanOrEqual(bounds.left);expect(result.y).toBeGreaterThanOrEqual(bounds.top);
  expect(result.x+result.width).toBeLessThanOrEqual(bounds.right);expect(result.y+result.height).toBeLessThanOrEqual(bounds.bottom);
 }
 const smaller=readingWindowLayout(restored,{width:701,height:486},{...bounds,bottom:520,right:1200});
 expect(smaller.height).toBe(346);expect(smaller.width).toBe(509);
});
