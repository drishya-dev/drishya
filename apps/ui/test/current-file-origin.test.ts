import {it,expect} from 'vitest';
import {currentFileOrigin,rememberCurrentFileOrigin} from '../src/lib/current-file-origin.ts';
const roots=[{root:'/repo',prefix:'main'},{root:'/other',prefix:'other'}];
it('returns the exact main alias after a current read, isolated by source and session',()=>{
 const source={},another={};rememberCurrentFileOrigin(source,'a','src/file.ts','main/src/file.ts');
 expect(currentFileOrigin(source,'a','src/file.ts',roots,'/repo')).toBe('main/src/file.ts');
 expect(currentFileOrigin(another,'a','src/file.ts',roots,'/repo')).toBe('src/file.ts');
 expect(currentFileOrigin(source,'b','src/file.ts',roots,'/repo')).toBe('src/file.ts');
 expect(currentFileOrigin(source,'a','src/file.ts',roots,'/repo-copy')).toBeUndefined();
 expect(currentFileOrigin(source,'a','src/file.ts',[], '/repo')).toBeUndefined();
});
it('refuses other-root aliases and lets a later explicit plain-file visit replace the old origin',()=>{
 const source={};rememberCurrentFileOrigin(source,'a','src/file.ts','other/src/file.ts');
 expect(currentFileOrigin(source,'a','src/file.ts',roots,'/repo')).toBeUndefined();
 rememberCurrentFileOrigin(source,'a','src/file.ts','main/src/file.ts');
 rememberCurrentFileOrigin(source,'a','src/file.ts','src/file.ts');
 expect(currentFileOrigin(source,'a','src/file.ts',roots,'/repo')).toBe('src/file.ts');
});
it('bounds navigation references and rejects oversized paths',()=>{
 const source={};for(let i=0;i<33;i++)rememberCurrentFileOrigin(source,'a',`f${i}`,`main/f${i}`);
 expect(currentFileOrigin(source,'a','f0',roots,'/repo')).toBe('f0');
 expect(currentFileOrigin(source,'a','f32',roots,'/repo')).toBe('main/f32');
 for(let i=0;i<8;i++)rememberCurrentFileOrigin(source,`s${i}`,'f','main/f');
 expect(currentFileOrigin(source,'a','f32',roots,'/repo')).toBe('f32');
 rememberCurrentFileOrigin(source,'s0','f','x'.repeat(2049));
 expect(currentFileOrigin(source,'s0','f',roots,'/repo')).toBe('main/f');
});
