// Opt-in differential over invented make-large-journal output. No output is committed.
import assert from 'node:assert/strict';
import { createReadStream, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { compareRedaction, compareValue } from '../packages/privacy/test/redact-differential.ts';
assert.equal(process.argv[2],'--invented','usage: node scripts/check-redaction-corpus.ts --invented <generated.jsonl> ...');
assert.ok(process.argv.length>3,'supply invented corpus files');
for(const file of process.argv.slice(3)) {
  let records=0,strings=0; const hash=createHash('sha256'); const started=performance.now();
  const input=createReadStream(file);input.on('data',chunk=>hash.update(chunk));
  for await(const line of createInterface({input,crlfDelay:Infinity})) {
    if(!line)continue;
    const value=JSON.parse(line);
    if(records===0) assert.equal(value.payload?.id,'invented-performance-session','only generated invented corpora are accepted');
    compareRedaction(line);strings+=compareValue(value);records++;
  }
  console.log(JSON.stringify({invented:true,bytes:statSync(file).size,sha256:hash.digest('hex'),records,strings,byteIdentical:true,elapsedMs:performance.now()-started}));
}
