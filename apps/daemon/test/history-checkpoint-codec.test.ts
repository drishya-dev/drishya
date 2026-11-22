import {serialize,deserialize} from 'node:v8';
import {deepStrictEqual} from 'node:assert/strict';
import {expect,it} from 'vitest';
import {encodeCheckpoint,decodeCheckpoint} from '../src/history-checkpoint.ts';

it('bounds SQLite binding copies while preserving exact serialized reducer state',()=>{
  const state={operations:new Map(Array.from({length:1000},(_,i)=>[`op-${i}`,{id:`op-${i}`,input:'Synthetic repeated captured command '.repeat(100),sequence:i}])),ids:new Set(['synthetic-a','synthetic-b'])};
  const raw=serialize(state),stored=encodeCheckpoint(raw);
  expect(stored.byteLength).toBeLessThan(raw.byteLength/4);
  expect(decodeCheckpoint(stored).equals(raw)).toBe(true);
  deepStrictEqual(deserialize(decodeCheckpoint(stored)),state);
});

it('reads existing uncompressed checkpoints without changing their bytes',()=>{
  const raw=serialize({legacy:new Map([['synthetic',42]])});
  expect(decodeCheckpoint(raw)).toBe(raw);
  expect(deserialize(decodeCheckpoint(raw))).toEqual({legacy:new Map([['synthetic',42]])});
});

it('rejects a damaged compressed cache rather than returning partial state',()=>{
  const stored=encodeCheckpoint(serialize({text:'Synthetic checkpoint '.repeat(10000)}));
  stored[stored.length-5]=stored[stored.length-5]!^0xff;
  expect(()=>decodeCheckpoint(stored)).toThrow();
});

for(const delta of [-1,1])it(`rejects a compressed checkpoint whose original length differs by ${delta}`,()=>{
  const raw=serialize({text:'Synthetic checkpoint '.repeat(10000)});
  const stored=encodeCheckpoint(raw);
  stored.writeUInt32LE(raw.byteLength+delta,4);
  expect(()=>decodeCheckpoint(stored)).toThrow();
});
