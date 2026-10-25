import {describe,it,expect,vi} from 'vitest';
import {structuredData,visibleDataNodes,dataLabel,dataText} from '../src/lib/structured-data.ts';
describe('bounded captured JSON reading',()=>{
 it('retains late rows and fields omitted from compact previews',()=>{const rows=Array.from({length:1000},(_,i)=>({id:i,nested:{value:`row ${i}`},...(i===999?{late:true}:{})}));const data=structuredData(JSON.stringify({items:rows}))!;expect(data.table?.rows).toHaveLength(1000);expect(data.table?.columns).toEqual(['id','nested','late']);expect(data.nodes.find(node=>node.pointer==='/items/999/late')?.value).toBe(true);});
 it('escapes exact JSON pointers and treats prototype names as literal captured keys',()=>{const data=structuredData('{"a/b":{"~key":null},"__proto__":{"safe":true}}')!;expect(data.nodes.find(node=>node.pointer==='/a~1b/~0key')?.value).toBeNull();expect(data.nodes.find(node=>node.pointer==='/__proto__/safe')?.value).toBe(true);expect(({} as Record<string,unknown>).safe).toBeUndefined();});
 it('collapses only descendants and searches values outside collapsed branches',()=>{const data=structuredData('{"a":{"b":"needle"},"c":3}')!;expect(visibleDataNodes(data.nodes,new Set([''])).map(node=>node.pointer)).toEqual(['','/a','/c']);expect(visibleDataNodes(data.nodes,new Set(),'needle').map(node=>node.pointer)).toEqual(['/a/b']);expect(visibleDataNodes(data.nodes,new Set(['','/a']))).toHaveLength(4);});
 it('keeps wide records in the tree rather than silently dropping columns',()=>{const row=Object.fromEntries(Array.from({length:33},(_,i)=>[`field${i}`,i]));const data=structuredData(JSON.stringify([row]))!;expect(data.table).toBeUndefined();expect(data.nodes.find(node=>node.pointer==='/0/field32')?.value).toBe(32);});
 it('rejects incomplete, scalar, byte-heavy, overly deep and overly large trees as a whole',()=>{for(const text of ['{"a":','null','42',JSON.stringify({text:'界'.repeat(90000)}),`${'{"a":'.repeat(82)}null${'}'.repeat(82)}`,JSON.stringify(Array(25000).fill(0))])expect(structuredData(text)).toBeUndefined();expect(structuredData('{}')?.nodes).toHaveLength(1);expect(structuredData('[]')?.nodes).toHaveLength(1);});
 it('bounds search results while preserving original model values',()=>{const data=structuredData(JSON.stringify(Array(1200).fill('match')))!;expect(visibleDataNodes(data.nodes,new Set(),'match')).toHaveLength(500);expect(data.nodes).toHaveLength(1201);expect(dataLabel(null)).toBe('null');expect(dataLabel('a\nb')).toBe('a\nb');});
});

it('keeps numeric IDs beyond IEEE-754 integer precision literal in labels and search',()=>{
 const data=structuredData('{"id":9007199254740993,"small":42}')!;expect(dataLabel(data.nodes.find(n=>n.pointer==='/id')!.value)).toBe('9007199254740993');expect(visibleDataNodes(data.nodes,new Set(),'9007199254740993').map(n=>n.pointer)).toEqual(['/id']);expect(data.nodes.find(n=>n.pointer==='/small')!.value).toBe(42);
});
it.each(['-0','1e400','1e-400','0.100000000000000005','1.2300','1E+03'])('keeps the supplied number token %s rather than a rounded/null substitute',token=>{
 const data=structuredData(`{"value":${token}}`)!;expect(dataLabel(data.nodes.find(n=>n.pointer==='/value')!.value)).toBe(token);expect(data.nodes.find(n=>n.pointer==='/value')!.container).toBe(false);
});
it('keeps numeric-looking strings distinct from number literals',()=>{
 const data=structuredData('{"value":"9007199254740993","text":"1e400"}')!;expect(data.nodes.find(n=>n.pointer==='/value')!.value).toBe('9007199254740993');expect(data.nodes.find(n=>n.pointer==='/text')!.value).toBe('1e400');
});
it('refuses numeric inspection when the parser cannot supply original number tokens',()=>{
 const parse=JSON.parse;const spy=vi.spyOn(JSON,'parse').mockImplementation((text,reviver)=>parse(text,reviver?function(key,value){return reviver.call(this,key,value);}:undefined));
 try{expect(structuredData('{"id":9007199254740993}')).toBeUndefined();expect(structuredData('{"text":"still readable"}')?.nodes[1]?.value).toBe('still readable');}finally{spy.mockRestore();}
});

it('copies nested objects and records without turning number tokens into strings or containers',()=>{
 const raw='{"items":[{"id":9007199254740993,"precise":0.100000000000000005,"name":"literal"},{"id":1e400,"precise":-0}]}';const data=structuredData(raw)!;expect(data.table?.columns).toEqual(['id','precise','name']);expect(data.table?.rows).toHaveLength(2);expect(dataText(data.value)).toBe(raw);expect(dataText(data.nodes.find(n=>n.pointer==='/items/0')!.value)).toBe('{"id":9007199254740993,"precise":0.100000000000000005,"name":"literal"}');expect(data.nodes.find(n=>n.pointer==='/items/0/id')!.container).toBe(false);
});
