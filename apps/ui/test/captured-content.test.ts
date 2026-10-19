import {expect,it} from 'vitest';
import {capturedContent} from '../src/lib/captured-content.ts';
it('offers all applicable modes for mixed native and MCP material without dropping siblings',()=>{
 const text=JSON.stringify({content:[{type:'text',text:'a,b\n1,2'},{type:'resource_link',uri:'resource://report',name:'Report'},{type:'text',text:'Sibling'}]});
 const result=capturedContent(text);expect(result.json).toBe(true);expect(result.delimited).toEqual([{field:'/content/0/text',text:'a,b\n1,2'}]);expect(result.resources?.items[0]?.uri).toBe('resource://report');
 const native=capturedContent(JSON.stringify({output:'a,b\n1,2',exit_code:0}));expect(native.json).toBe(true);expect(native.delimited).toHaveLength(1);
});
it('keeps candidate hints distinct from validity and rejects oversized or arbitrary content',()=>{
 expect(capturedContent('{incomplete').json).toBe(true);
 expect(capturedContent('plain prose')).toEqual({json:false,delimited:[],resources:undefined});
 expect(capturedContent('界'.repeat(90000))).toEqual({json:false,delimited:[],resources:undefined});
 expect(capturedContent('https://example.org').resources).toBeUndefined();
});
