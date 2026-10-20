import type {GitCommit,GitReference} from '../../../daemon/src/git-types.ts';

/** A short, honest age: "just now", "12 min ago", "5 h ago", "9 d ago", then the date. */
export function ago(iso:string,now=Date.now()):string {
  const s=Math.max(0,(now-new Date(iso).getTime())/1000);
  if(Number.isNaN(s))return '';
  if(s<90)return 'just now';
  if(s<5400)return `${Math.round(s/60)} min ago`;
  if(s<129600)return `${Math.round(s/3600)} h ago`;
  if(s<86400*90)return `${Math.round(s/86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
}

/** References that label a loaded commit, plus the ones a reader always needs (checked-out, picked). The full list
 * stays one toggle away; with 180+ names most of it is history outside the window. */
export function refsInWindow(references:GitReference[],commits:GitCommit[],keep:{selected?:string}={}):GitReference[] {
  const named=new Set(commits.flatMap(commit=>commit.labels));
  return references.filter(ref=>ref.current||ref.id===keep.selected||named.has(ref.name));
}
