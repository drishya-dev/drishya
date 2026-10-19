import {it,expect} from 'vitest';
import {materialTransform} from '../src/lib/material-transform.ts';
it('maps real screen origins to the same endpoints under normal and compact passage scales',()=>{
 const target={left:500,top:200,width:400,height:300},source={left:100,top:50,width:200,height:150};
 expect(materialTransform(source,target)).toBe('translate(-400px,-150px) scale(0.5,0.5)');
 expect(materialTransform(source,target,.9)).toBe(`translate(${-400/.9}px,${-150/.9}px) scale(0.5,0.5)`);
 expect(materialTransform(target,target,.9)).toBe('translate(0px,0px) scale(1,1)');
 expect(materialTransform(source,target,0)).toBe(materialTransform(source,target));
});
