import {expect,it} from 'vitest';
import {readingWindowLayout} from '../src/lib/reading-window.ts';
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
