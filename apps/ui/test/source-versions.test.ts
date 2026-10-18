import { expect,it } from 'vitest';
import type { CurrentFile } from '../src/api.ts';
import { acceptSource,observeSource } from '../src/lib/source-versions.ts';
const file=(text:string,modifiedAt='1',redacted=false):CurrentFile=>({path:'a.ts',scope:'current-workspace',text,modifiedAt,redacted,start:0,totalLines:text.split('\n').length,returnedLines:text.split('\n').length,hasMore:false});
it('retains the source until explicit acceptance and keeps only one preceding snapshot',()=>{
  const first=file('one'),second=file('two','2'),third=file('three','3');
  let state=observeSource({},first);state=observeSource(state,second);
  expect(state.shown).toBe(first);expect(state.candidate).toBe(second);
  state=acceptSource(state);expect(state.shown).toBe(second);expect(state.previous).toBe(first);expect(state.candidate).toBeUndefined();
  state=observeSource(state,third);expect(state.previous).toBeUndefined();expect(state.shown).toBe(second);
  state=acceptSource(state);expect(state.previous).toBe(second);expect(state.shown).toBe(third);
});
it('does not confuse a timestamp-only touch, returned-to-base file or redaction change',()=>{
  const old=file('same');let state=observeSource({shown:old},file('same','2'));
  expect(state.candidate).toBeUndefined();expect(state.shown?.modifiedAt).toBe('2');
  state=observeSource(state,file('other','3'));state=observeSource(state,file('same','4'));
  expect(state.candidate).toBeUndefined();
  state=observeSource(state,file('same','4',true));expect(state.candidate?.redacted).toBe(true);
});
