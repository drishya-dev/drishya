import type {GitBranchComparison} from './git-types.ts';
type Git=(args:string[])=>Promise<string>;

/** One inspection can ask for the same ancestry for current/default labels.
 * Only complete object IDs are stable; refs/config/worktree reads remain fresh. */
export function withAncestryReads(read:Git):Git {
  const pending=new Map<string,Promise<string>>();
  const object=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
  return args=>{
    const operands=args.slice(1).filter(arg=>!arg.startsWith('-'));
    const flags=args.slice(1).filter(arg=>arg.startsWith('-'));
    const allowed=args[0]==='merge-base'?['--is-ancestor','--']:args[0]==='rev-list'?['--count','--left-right','--']:[];
    const immutable=(args[0]==='merge-base'||args[0]==='rev-list')&&flags.every(flag=>allowed.includes(flag))&&operands.length>0&&operands.every(arg=>{const ids=arg.split('...');return ids.length<=2&&ids.every(id=>object.test(id));});
    if(!immutable)return read(args);
    const key=JSON.stringify(args),hit=pending.get(key);
    if(hit)return hit;
    const result=read(args);
    if(pending.size<64)pending.set(key,result);
    return result;
  };
}

/** Counts use immutable local objects. Shallow walks cannot certify the missing ancestry. */
export async function compareBranch(git:Git,tip:string,base:{name:string;tip:string;basis?:GitBranchComparison['basis']},shallow:boolean):Promise<GitBranchComparison> {
  const reference={name:base.name,...(base.basis?{basis:base.basis}:{})};
  if(tip===base.tip)return {...reference,state:'known',ahead:0,behind:0};
  if(shallow)return {...reference,state:'shallow'};
  try {
    const mergeBase=(await git(['merge-base',base.tip,tip]).catch(()=>'')).trim();
    if(!mergeBase){
      // A failed merge-base can also mean missing/corrupt objects or a read limit.
      // Only report unrelated after both ancestry walks succeed locally.
      const count=(await git(['rev-list','--count',base.tip,tip,'--'])).trim();
      return {...reference,state:/^\d+$/.test(count)?'unrelated':'unavailable'};
    }
    const counts=(await git(['rev-list','--left-right','--count',`${base.tip}...${tip}`,'--'])).trim().split(/\s+/).map(Number);
    if(counts.length!==2||counts.some(n=>!Number.isSafeInteger(n)||n<0))return {...reference,state:'unavailable'};
    return {...reference,state:'known',behind:counts[0],ahead:counts[1]};
  }catch{return {...reference,state:'unavailable'};}
}
