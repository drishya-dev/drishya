import {expect,it} from 'vitest';
import {filePeekState,openFilePeek,closeFilePeek} from '../src/lib/file-peek.ts';
it('replaces only the transient preview and keeps explicitly pinned tabs',()=>{
 let state=openFilePeek({files:[]},'a.ts').state;
 state=openFilePeek(state,'b.ts').state;expect(state).toEqual({files:[],preview:'b.ts'});
 state=openFilePeek(state,'b.ts',true).state;
 state=openFilePeek(state,'c.ts').state;
 expect(openFilePeek(state,'b.ts').state).toEqual({files:['b.ts'],preview:'c.ts'});
 expect(closeFilePeek(state,'b.ts')).toEqual({files:[],preview:'c.ts'});
 expect(closeFilePeek(state,'c.ts')).toEqual({files:['b.ts']});
});
it('bounds retained file references and rejects invalid recovery or new paths',()=>{
 const state={files:Array.from({length:8},(_,n)=>`${n}.ts`),preview:'preview.ts'};
 expect(openFilePeek(state,'preview.ts',true).error).toContain('Eight');
 expect(openFilePeek(state,'latest.ts').state.preview).toBe('latest.ts');
 expect(openFilePeek(state,'').state).toBe(state);
 expect(filePeekState({files:['a.ts','a.ts',null,5],preview:'a.ts'})).toEqual({files:['a.ts']});
 expect(filePeekState(null)).toEqual({files:[]});
});
