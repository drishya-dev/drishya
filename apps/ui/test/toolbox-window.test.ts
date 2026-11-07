import {describe,expect,it} from 'vitest';
import {toolboxAllocation,toolboxTransform} from '../src/lib/toolbox-window.ts';

describe('floating Toolbox allocation',()=>{
 for(const width of [600,1440])it(`centres natural content between measured header and composer at ${width}px`,()=>{
  const result=toolboxAllocation({x:0,y:0,width,height:900},84,704,{width:420,height:280});
  expect(result).toEqual({x:(width-420)/2,y:254,width:420,height:280});
 });
 it('bounds a long inventory without inventing more room below the composer',()=>{
  expect(toolboxAllocation({x:0,y:0,width:600,height:900},84,500,{width:1200,height:1000}))
   .toEqual({x:12,y:96,width:576,height:392});
 });
 it('respects stage offsets and a changed or minimized composer',()=>{
  expect(toolboxAllocation({x:100,y:20,width:1100,height:800},80,760,{width:320,height:200}))
   .toEqual({x:490,y:320,width:320,height:200});
 });
 it('never imposes a minimum height larger than the remaining reading space',()=>{
  const result=toolboxAllocation({x:0,y:0,width:600,height:300},100,180,{width:320,height:400});
  expect(result.y+result.height).toBe(168);
  expect(result.height).toBe(56);
 });
 it('maps the same material from its CURRENT visual bounds, including interrupted scale',()=>{
  expect(toolboxTransform({x:500,y:120,width:80,height:32},{x:120,y:200,width:400,height:240}))
   .toBe('translate(380px, -80px) scale(0.2, 0.13333333333333333)');
  expect(toolboxTransform({x:300,y:180,width:240,height:144},{x:120,y:200,width:400,height:240}))
   .toBe('translate(180px, -20px) scale(0.6, 0.6)');
 });
});
