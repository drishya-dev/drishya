import {it,expect} from 'vitest';
import {delimitedData,delimitedBlocks} from '../src/lib/delimited-data.ts';
it('preserves quoted commas, multiline cells, escaped quotes and exact literal values',()=>{
 const result=delimitedData('name,value\r\n"a,b","line 1\r\nline 2"\r\n"say ""hello""",=SUM(A1:A2)\r\n',',');
 expect(result.data).toEqual({columns:2,rows:[['name','value'],['a,b','line 1\r\nline 2'],['say "hello"','=SUM(A1:A2)']]});
});
it('distinguishes missing cells, empty cells, duplicate names and BOM without changing the original',()=>{
 const text='\ufeffname,name,\n1,,3\n2\n';expect(delimitedData(text,',').data).toEqual({columns:3,rows:[['name','name',''],['1','','3'],['2']]});
 expect(text.charCodeAt(0)).toBe(0xfeff);expect(delimitedData('',',').data?.rows).toEqual([]);expect(delimitedData('"",',',').data?.rows).toEqual([['','']]);
});
it('uses only the chosen delimiter and retains tabs/newlines inside quoted TSV cells',()=>{
 expect(delimitedData('a\tb\n"c\td"\t"e\nf"','\t').data?.rows).toEqual([['a','b'],['c\td','e\nf']]);
 expect(delimitedData('a,b\nc,d','\t').data?.columns).toBe(1);
});
it('rejects malformed/incomplete quotes without returning a partial table',()=>{
 for(const text of ['ok,1\n"unfinished','a"b,c','"closed"x,y','"closed" ,y']){const result=delimitedData(text,',');expect(result.data).toBeUndefined();expect(result.error).toBeTruthy();}
});
it('bounds byte size, rows, columns and cells and accepts exact boundaries',()=>{
 expect(delimitedData('界'.repeat(90000),',').error).toContain('256 KiB');
 expect(delimitedData(Array(5001).fill('x').join('\n'),',').error).toContain('5,000');
 expect(delimitedData(Array(33).fill('x').join(','),',').error).toContain('32');
 expect(delimitedData(Array(2000).fill(Array(26).fill('x').join(',')).join('\n'),',').error).toContain('50,000');
 expect(delimitedData(Array(5000).fill('x').join('\n'),',').data?.rows).toHaveLength(5000);
});
it('finds literal fields in complete native/MCP/wrapped captures without flattening siblings',()=>{
 const csv='a,b\n1,2';expect(delimitedBlocks(csv)).toEqual([{text:csv,field:'Captured text'}]);
 const envelope=JSON.stringify({content:[{type:'image',data:'omitted'},{type:'text',text:csv},{type:'resource_link',uri:'https://example.invalid'}]});
 expect(delimitedBlocks(envelope)).toEqual([{text:csv,field:'/content/1/text'}]);expect(JSON.parse(envelope).content).toHaveLength(3);
 expect(delimitedBlocks(JSON.stringify([{status:'fulfilled',value:{output:csv,exit_code:0}}]))).toEqual([{text:csv,field:'/0/value/output'}]);
 expect(delimitedBlocks(JSON.stringify({unrelated:csv}))).toEqual([]);
 expect(delimitedBlocks(JSON.stringify({output:csv}))).toEqual([]);
});
it('does not decode code escapes or fetch paths and bounds field suggestions',()=>{
 expect(delimitedBlocks('a,b\\n1,2')).toEqual([]);expect(delimitedBlocks('/tmp/report.csv')).toEqual([]);
 const blocks=Array.from({length:20},(_,i)=>({type:'text',text:`a,b\n${i},v`}));expect(delimitedBlocks(JSON.stringify({content:blocks}))).toHaveLength(8);
});
it('retains trailing empty records and fields without inventing a record after a terminal line ending',()=>{
 for(const end of ['\n','\r','\r\n']){
  expect(delimitedData(`a,b${end}${end}`,',').data?.rows).toEqual([['a','b'],['']]);
  expect(delimitedData(`a,b${end},`,',').data?.rows).toEqual([['a','b'],['','']]);
  expect(delimitedData(`a,b${end}""`,',').data?.rows).toEqual([['a','b'],['']]);
 }
});
it('accepts exact byte and cell boundaries and refuses an extra field without partial data',()=>{
 const exact='x'.repeat(262144);expect(delimitedData(exact,',').data?.rows).toEqual([[exact]]);
 expect(delimitedData(exact+'x',',').data).toBeUndefined();
 const row=Array(10).fill('x').join(','),text=Array(5000).fill(row).join('\n');
 expect(delimitedData(text,',').data?.rows).toHaveLength(5000);
 expect(delimitedData(text+',',',').data).toBeUndefined();
});
it('round trips literal Unicode, formula-like text, leading zeroes and multiline cells for both explicit formats',()=>{
 const records=[['name','name',''],['00042','1e400','-0'],['=SUM(A1:A2)','+cmd','@call'],['a,b','a\tb','"quoted"'],['line\r\nnext','दृश्य','👁️'],['','','']];
 for(const delimiter of [',','\t'] as const){
  const raw=records.map(row=>row.map(cell=>`"${cell.replaceAll('"','""')}"`).join(delimiter)).join('\r\n');
  expect(delimitedData(raw,delimiter).data).toEqual({rows:records,columns:3});
 }
});
