import {describe,it,expect} from 'vitest';
import {surfaceFrames} from '../src/lib/surface-reflow.ts';
describe('explicit dock reflow geometry',()=>{
 it('combines movement and size in one real-material transform',()=>{const before={x:100,y:600,width:180,height:38},after={x:0,y:400,width:380,height:238};const result=surfaceFrames(before,after,'matrix(1,0,0,1,-190,0)')!;expect(result.sx*after.width).toBe(before.width);expect(result.sy*after.height).toBe(before.height);expect(result.frames[0].transform).toContain('translate(0px, 100px)');expect(result.frames[1].transform).toBe('matrix(1,0,0,1,-190,0)');});
 it('uses a currently interrupted allocation rather than a fixed compact size',()=>{const result=surfaceFrames({x:40,y:50,width:240,height:80},{x:30,y:20,width:300,height:140},'none')!;expect(result.sx).toBe(.8);expect(result.sy).toBeCloseTo(80/140);expect(result.frames[0].transform).toContain('translate(-20px, 0px)');expect(surfaceFrames({x:0,y:0,width:0,height:0},{x:0,y:0,width:300,height:140},'none')).toBeUndefined();});
});
