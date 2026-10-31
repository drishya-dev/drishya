import {describe,expect,it} from 'vitest';
import {webMaterial} from '../src/web.ts';

describe('captured web material',()=>{
  it('keeps repeated unclosed list starts literal without rescanning their remainder',()=>{
    const text='Links: [\n'.repeat(10000);
    const value=webMaterial(text);
    expect(value.results).toEqual([]);expect(value.text).toBe(text);expect(value.original).toBe(text);expect(value.listRecorded).toBe(false);
  });
  it('keeps every full result and removes only the balanced Claude list',()=>{
    const rows=Array.from({length:61},(_,n)=>({url:`https://example.test/${n}`,title:`Captured title ${n} ${'detail '.repeat(60)}`,snippet:`Snippet ${'context '.repeat(100)}`,extra:{nested:['[quoted]','escaped " ]', {deep:true}]}}));
    const original='Captured introduction.\n  Links \t:\n'+JSON.stringify(rows,null,2)+'\nCaptured closing prose.';
    const value=webMaterial(original,[{url:rows[0]!.url,title:'clipped…'}]);
    expect(value.results).toHaveLength(61);expect(value.results.at(-1)).toMatchObject({url:rows[60]!.url,title:rows[60]!.title,snippet:rows[60]!.snippet});
    expect(value.text).toBe('Captured introduction.\n  \nCaptured closing prose.');expect(value.original).toBe(original);expect(value.listRecorded).toBe(true);
  });
  it('supports complete structured lists and captured prose siblings without inventing prose',()=>{
    const rows=[{snippet:'Exact snippet',url:'https://example.test/1',title:'A title'}];
    expect(webMaterial(JSON.stringify(rows))).toMatchObject({results:rows,text:'',listRecorded:true});
    expect(webMaterial(JSON.stringify({results:rows,text:'Captured summary'}))).toMatchObject({results:rows,text:'Captured summary',listRecorded:true});
    const plain=JSON.stringify({results:rows,other:'Other captured field'});
    expect(webMaterial(plain).text).toBe(plain);
  });
  it('retains all separate lists in recorded order, including duplicate result entries',()=>{
    const row={url:'https://example.test/same',title:'Exact repeated result'};
    const original=`First captured response.\nLinks: ${JSON.stringify([row,row])}\nSecond captured response.\nLinks: broken [\nThird captured response.\nLinks:\t${JSON.stringify([row])}\nFinal captured prose.`;
    expect(webMaterial(original)).toEqual({results:[row,row,row],text:'First captured response.\n\nSecond captured response.\nLinks: broken [\nThird captured response.\n\nFinal captured prose.',original,listRecorded:true});
  });
  it.each(['Links: [{"url":"https://example.test/1"}', 'Links: [{"url":"https://example.test/1"},]', 'Links: [{"title":"No URL"}]', 'A prose https://example.test/1 reference.', 'The example says Links: [{"url":"https://example.test/1"}]'])('retains unsupported or incomplete material literally: %s',original=>{
    expect(webMaterial(original)).toEqual({results:[],text:original,original,listRecorded:false});
  });
  it('keeps explicit invalid schemes literal for inert rendering and does not mine nested examples',()=>{
    const rows=[{url:'javascript:alert(1)',title:'Captured unsafe address'},{url:'file:///private/source'},{url:'not a URL'}];
    expect(webMaterial('Links: '+JSON.stringify(rows)).results).toEqual(rows);
    expect(webMaterial(JSON.stringify({example:{results:[{url:'https://example.test'}]}})).listRecorded).toBe(false);
  });
  it('distinguishes a recorded empty list from missing result material',()=>{
    expect(webMaterial('Links: []')).toMatchObject({results:[],text:'',listRecorded:true});
    expect(webMaterial('')).toMatchObject({results:[],listRecorded:false});
    expect(webMaterial('Captured fetch prose',[{url:'https://example.test',title:'Unclipped'}])).toMatchObject({results:[{url:'https://example.test',title:'Unclipped'}],text:'Captured fetch prose',listRecorded:true});
  });
});
