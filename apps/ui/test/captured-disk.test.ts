import {expect,it} from 'vitest';
import type {ArtifactSlice} from '@drishya/contracts';
import type {CurrentFile} from '../src/api.ts';
import {capturedDiskPair,excerptSpan} from '../src/lib/captured-disk.ts';
const captured:ArtifactSlice={artifact:{id:'a',kind:'excerpt',range:{start:2,end:3},observedAtSequence:1,bytes:8,lineCount:2,availability:'complete',provenance:{kind:'captured',observationIds:['o']},redacted:false},available:true,start:0,text:'old2\nold3',returnedLines:2,totalLines:2,totalBytes:9,truncated:false,hasMore:false};
const disk:CurrentFile={path:'a.ts',scope:'current-workspace',text:'one\nnew2\nnew3\nfour',start:0,totalLines:4,returnedLines:4,hasMore:false,redacted:false,modifiedAt:'now'};
const excerpt=(text:string,start:number):ArtifactSlice=>({...captured,text,returnedLines:text.split('\n').length,artifact:{...captured.artifact,range:{start,end:start+text.split('\n').length-1}}});
const onDisk=(text:string):CurrentFile=>({...disk,text,totalLines:text.split('\n').length,returnedLines:text.split('\n').length});
it('keeps the same line numbers when none of the captured lines remain, and says so',()=>{expect(capturedDiskPair(captured,disk)).toEqual({before:'old2\nold3',after:'new2\nnew3',label:'Captured lines 2–3',afterLabel:'Current disk · same line numbers, none of these lines were found'});});
it('finds a passage that moved, so a shifted file shows no change',()=>{
  const pair=capturedDiskPair(excerpt('alpha\nbeta\ngamma',2),onDisk('zero\none\ntwo\nthree\nalpha\nbeta\ngamma\nend'));
  expect(pair).toMatchObject({before:'alpha\nbeta\ngamma',after:'alpha\nbeta\ngamma',afterLabel:'Current disk · lines 5–7'});
});
it('does not read a difference of line endings as a change',()=>{
  expect(capturedDiskPair(excerpt('alpha\nbeta',2),onDisk('zero\r\none\r\nalpha\r\nbeta\r\nend'))).toMatchObject({after:'alpha\nbeta',afterLabel:'Current disk · lines 3–4'});
});
it('keeps real edits inside a moved passage, lines added within it included',()=>{
  expect(capturedDiskPair(excerpt('alpha\nbeta\ngamma\ndelta',2),onDisk('a\nb\nc\nalpha\nbeta\nadded\ngamma\ndelta\nend')).after).toBe('alpha\nbeta\nadded\ngamma\ndelta');
  expect(capturedDiskPair(excerpt('alpha\nbeta\ngamma\ndelta',2),onDisk('a\nb\nc\nalpha\nBETA\ngamma\ndelta\nend')).after).toBe('alpha\nBETA\ngamma\ndelta');
  expect(capturedDiskPair(excerpt('alpha\nbeta\ngamma\ndelta',2),onDisk('a\nb\nalpha\ndelta\nend')).after).toBe('alpha\ndelta');
});
it('does not place a passage by lines common in the file, and prefers the nearest of equal matches',()=>{
  const repeated=Array.from({length:12},()=>'}').join('\n');
  expect(excerptSpan(['}','}'],repeated.split('\n'),4)).toEqual({start:4,end:6,found:false});
  expect(excerptSpan(['one','two'],'one\ntwo\nx\none\ntwo'.split('\n'),3)).toEqual({start:3,end:5,found:true});
});
it('rejects unavailable, partial, oversized and unpositioned material',()=>{
  for(const patch of [{available:false},{hasMore:true},{truncated:true},{totalBytes:300000},{start:3}])expect(()=>capturedDiskPair({...captured,...patch},disk)).toThrow();
  expect(()=>capturedDiskPair({...captured,artifact:{...captured.artifact,range:undefined}},disk)).toThrow('position');
  expect(()=>capturedDiskPair({...captured,artifact:{...captured.artifact,kind:'snapshot',availability:'partial'}},disk)).toThrow();
});
