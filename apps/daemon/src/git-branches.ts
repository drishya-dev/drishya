import type {GitBranchComparison} from './git-types.ts';
type Git=(args:string[])=>Promise<string>;

/** Counts use immutable local objects. Shallow walks cannot certify the missing ancestry. */
export async function compareBranch(git:Git,tip:string,base:{name:string;tip:string;basis?:GitBranchComparison['basis']},shallow:boolean):Promise<GitBranchComparison> {
  const reference={name:base.name,...(base.basis?{basis:base.basis}:{})};
  if(tip===base.tip)return {...reference,state:'known',ahead:0,behind:0};
  if(shallow)return {...reference,state:'shallow'};
  try {
    const mergeBase=(await git(['merge-base',base.tip,tip]).catch(()=>'')).trim();
    if(!mergeBase)return {...reference,state:'unrelated'};
    const counts=(await git(['rev-list','--left-right','--count',`${base.tip}...${tip}`,'--'])).trim().split(/\s+/).map(Number);
    if(counts.length!==2||counts.some(n=>!Number.isSafeInteger(n)||n<0))return {...reference,state:'unavailable'};
    return {...reference,state:'known',behind:counts[0],ahead:counts[1]};
  }catch{return {...reference,state:'unavailable'};}
}
