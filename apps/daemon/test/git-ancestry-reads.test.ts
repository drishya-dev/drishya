import {expect,it,vi} from 'vitest';
import {withAncestryReads} from '../src/git-branches.ts';
const a='a'.repeat(40),b='b'.repeat(40);

it('deduplicates immutable ancestry only within one inspection',async()=>{
  const read=vi.fn(async()=>a),first=withAncestryReads(read);
  const args=['merge-base',a,b];
  await Promise.all([first(args),first(args)]);expect(read).toHaveBeenCalledOnce();
  await withAncestryReads(read)(args);expect(read).toHaveBeenCalledTimes(2);
});

it('never reuses mutable refs, configuration or working-tree reads',async()=>{
  const read=vi.fn(async()=>'synthetic'),run=withAncestryReads(read);
  for(const args of [['merge-base','main','topic'],['merge-base','--fork-point',a,b],['rev-list','--count','HEAD'],['rev-list','--all',a],['config','--list'],['diff',a,b,'--'],['for-each-ref'],['status','--porcelain']]){
    const before=read.mock.calls.length;await run(args);await run(args);expect(read.mock.calls.length-before).toBe(2);
  }
});

it('keeps exact argument direction and immutable count identities',async()=>{
  const read=vi.fn(async()=>'1\t2'),run=withAncestryReads(read);
  const one=['rev-list','--left-right','--count',`${a}...${b}`,'--'];
  const reverse=['rev-list','--left-right','--count',`${b}...${a}`,'--'];
  await run(one);await run(reverse);await run(one);expect(read).toHaveBeenCalledTimes(2);
});
