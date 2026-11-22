import {gzipSync,gunzipSync} from 'node:zlib';
const MAGIC=Buffer.from('DRF1');

/** SQLite copies bound BLOBs. Compress the disposable fold cache before that
 * native allocation overlaps the resident reducer and its serialized bytes. */
export function encodeCheckpoint(state:Buffer):Buffer{
  if(state.byteLength<64*1024)return state;
  const compressed=gzipSync(state,{level:1});
  if(compressed.byteLength+8>=state.byteLength)return state;
  const header=Buffer.alloc(8);MAGIC.copy(header);header.writeUInt32LE(state.byteLength,4);
  return Buffer.concat([header,compressed]);
}

/** Existing V8 checkpoints start with 0xff. A versioned envelope records the
 * exact original size so damaged compressed caches cannot expand beyond it. */
export function decodeCheckpoint(state:Buffer):Buffer{
  if(!state.subarray(0,4).equals(MAGIC))return state;
  const length=state.readUInt32LE(4);
  const raw=gunzipSync(state.subarray(8),{maxOutputLength:length});
  if(raw.byteLength!==length)throw Error('Checkpoint length differs from its envelope');
  return raw;
}
