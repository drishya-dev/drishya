// Synthetic retained-heap diagnostic, not the aggregate RSS acceptance gate.
// node --expose-gc scripts/bench-discovery-retention.ts
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {useSyntheticHarnessHomes} from './synthetic-harness-homes.ts';

const collect=(globalThis as typeof globalThis & {gc?:()=>void}).gc;
if(!collect)throw Error('Run this diagnostic with --expose-gc; production never forces GC.');
const cleanup=useSyntheticHarnessHomes();
const heap=()=>{collect();collect();return process.memoryUsage().heapUsed/1048576;};
try {
  const {codexAdapter}=await import('../packages/adapter-codex/src/index.ts');
  const {claudeAdapter}=await import('../packages/adapter-claude/src/index.ts');
  for(const adapter of [codexAdapter,claudeAdapter]) {
    const codex=adapter.descriptor.id==='codex',home=process.env[codex?'DRISHYA_CODEX_HOME':'DRISHYA_CLAUDE_HOME']!;
    const dir=join(home,codex?'sessions':'projects/synthetic');mkdirSync(dir,{recursive:true});
    for(let i=0;i<200;i++) {
      const prefix=`Synthetic discovery prompt ${i}: `,text=prefix+'x'.repeat(180000-prefix.length);
      const rows=codex?[
        {type:'session_meta',payload:{id:`retention-${i}`,cwd:home}},
        {type:'response_item',payload:{type:'message',role:'user',content:[{type:'input_text',text}]}},
      ]:[{type:'user',cwd:home,uuid:`retention-${i}`,message:{role:'user',content:text}}];
      writeFileSync(join(dir,`rollout-${i}.jsonl`),rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
    }
    const before=heap(),sources=await adapter.discover(),after=heap();
    assert.equal(sources.length,200);assert(sources.every(source=>source.title?.length===160));
    const retainedHeapDeltaMiB=after-before;
    console.log(JSON.stringify({harness:adapter.descriptor.id,syntheticOnly:true,sources:sources.length,titleCharacters:sources.reduce((n,s)=>n+s.title!.length,0),retainedHeapDeltaMiB}));
    // 32k bounded title characters must not pin 36 million prompt characters.
    // This generous diagnostic bound isolates retention; it is not a new RSS budget.
    assert(retainedHeapDeltaMiB<8,'Bounded discovery titles retain large source strings.');
  }
} finally {cleanup();}
