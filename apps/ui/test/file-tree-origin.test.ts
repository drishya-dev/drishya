import {expect,it} from 'vitest';
import {containsOrigin} from '../src/lib/file-tree-origin.ts';
const viewport={left:0,top:0,right:600,bottom:800};
const row={left:20,top:40,right:280,bottom:72,width:260,height:32};
it('accepts a fully visible row including exact viewport edges',()=>{
 expect(containsOrigin(row,viewport)).toBe(true);expect(containsOrigin({...row,left:0,right:600,width:600,top:0},viewport)).toBe(true);
});
it('rejects clipped rows on every side and zero-sized virtual/hidden rows',()=>{
 for(const clipped of [{...row,left:-1},{...row,right:601},{...row,top:-1},{...row,bottom:801},{...row,width:0},{...row,height:0}])expect(containsOrigin(clipped,viewport)).toBe(false);
});
it('checks the current scroller bounds rather than a previous frame',()=>{
 expect(containsOrigin(row,{left:0,top:50,right:600,bottom:800})).toBe(false);
 expect(containsOrigin({...row,top:50,bottom:82},{left:0,top:50,right:600,bottom:800})).toBe(true);
});
