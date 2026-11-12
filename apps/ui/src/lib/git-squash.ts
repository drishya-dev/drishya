import type {GitCommit,GitGithubSquashMatch,GitHistoryPage} from '../../../daemon/src/git-types.ts';
import type {LightBranch} from './git-light.ts';

export type SquashJoinBasis=
  |'content-signature'
  |'patch-id'
  |'path-superset'
  |'github-pr'
  |'github-subject-pr';

export interface SquashJoin {
  head:string;
  target:string;
  basis:SquashJoinBasis;
  pr?:number;
}

export interface SquashEvidence {
  changeSignatures?:ReadonlyMap<string,string>;
  branchSignatures?:ReadonlyMap<string,string>;
  changePatchIds?:ReadonlyMap<string,string>;
  branchPatchIds?:ReadonlyMap<string,string>;
  changeFiles?:ReadonlyMap<string,ReadonlyMap<string,string>>;
  branchOwnFiles?:ReadonlyMap<string,ReadonlyMap<string,string>>;
  githubPulls?:readonly GitGithubSquashMatch[];
  changes?:ReadonlyMap<string,string>;
  branches?:ReadonlyMap<string,string>;
}

function mergeFileMaps(pages:readonly GitHistoryPage[],pick:(page:GitHistoryPage)=>Record<string,Record<string,string>>|undefined):Map<string,Map<string,string>> {
  const out=new Map<string,Map<string,string>>();
  for(const page of pages){
    const raw=pick(page);if(!raw)continue;
    for(const [hash,files] of Object.entries(raw)){
      if(!out.has(hash))out.set(hash,new Map(Object.entries(files)));
    }
  }
  return out;
}

export function collectSquashEvidence(pagesIterable:Iterable<GitHistoryPage>):SquashEvidence {
  const pages=[...pagesIterable];
  const changeSignatures=new Map<string,string>(),branchSignatures=new Map<string,string>();
  const changePatchIds=new Map<string,string>(),branchPatchIds=new Map<string,string>();
  const githubByPr=new Map<number,GitGithubSquashMatch>();
  for(const page of pages){
    for(const [k,v] of Object.entries(page.changeSignatures??{}))changeSignatures.set(k,v);
    for(const [k,v] of Object.entries(page.branchSignatures??{}))branchSignatures.set(k,v);
    for(const [k,v] of Object.entries(page.changePatchIds??{}))changePatchIds.set(k,v);
    for(const [k,v] of Object.entries(page.branchPatchIds??{}))branchPatchIds.set(k,v);
    for(const match of page.githubPulls??[]){
      const prev=githubByPr.get(match.pr);
      if(!prev||(prev.basis==='github-subject-pr'&&match.basis==='github-pr'))githubByPr.set(match.pr,match);
    }
  }
  return {
    changeSignatures,
    branchSignatures,
    changePatchIds,
    branchPatchIds,
    changeFiles:mergeFileMaps(pages,p=>p.changeFiles),
    branchOwnFiles:mergeFileMaps(pages,p=>p.branchOwnFiles),
    githubPulls:[...githubByPr.values()],
  };
}

export function squashEvidenceSignature(evidence?:SquashEvidence):string {
  if(!evidence)return '';
  const chSig=evidence.changeSignatures??evidence.changes,brSig=evidence.branchSignatures??evidence.branches;
  const chPid=evidence.changePatchIds,brPid=evidence.branchPatchIds;
  const chFiles=evidence.changeFiles,brFiles=evidence.branchOwnFiles;
  const gh=evidence.githubPulls??[];
  if(!chSig?.size&&!brSig?.size&&!chPid?.size&&!brPid?.size&&!chFiles?.size&&!brFiles?.size&&!gh.length)return '';
  const mapStr=(m?:ReadonlyMap<string,string>)=>m?[...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`${k}=${v}`).join(','):'';
  const nestedStr=(m?:ReadonlyMap<string,ReadonlyMap<string,string>>)=>m?[...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`${k}:[${mapStr(v)}]`).join(';'):'';
  const ghStr=gh.map(p=>`${p.pr}:${p.basis}:${p.mergeCommit}:${p.headOid}:${(p.eligibleTips??[]).join(',')}`).sort().join('|');
  return [mapStr(chSig),mapStr(brSig),mapStr(chPid),mapStr(brPid),nestedStr(chFiles),nestedStr(brFiles),ghStr].join('||');
}

export function resolveSquashJoins(
  commits:readonly Pick<GitCommit,'hash'|'parents'>[],
  main:ReadonlySet<string>,
  branches:readonly LightBranch[],
  nodes:readonly {hash:string;x:number}[],
  evidence?:SquashEvidence,
):Map<string,SquashJoin> {
  const joins=new Map<string,SquashJoin>();
  if(!evidence)return joins;
  const byHash=new Map(commits.map(c=>[c.hash,c]));
  const xOf=new Map(nodes.map(n=>[n.hash,n.x]));
  const primaryByX=[...nodes].filter(n=>main.has(n.hash)).sort((a,b)=>a.x-b.x);
  if(!primaryByX.length)return joins;

  const ancMemo=new Map<string,Set<string>>();
  const ancestorsOf=(start?:string):Set<string>=>{
    if(!start)return new Set();
    const cached=ancMemo.get(start);
    if(cached)return cached;
    const seen=new Set<string>(),queue=[start];
    while(queue.length){
      const cur=queue.pop()!;
      if(seen.has(cur))continue;
      seen.add(cur);
      const c=byHash.get(cur);
      if(c)for(const p of c.parents)if(!seen.has(p))queue.push(p);
    }
    ancMemo.set(start,seen);
    return seen;
  };

  const changeSig=evidence.changeSignatures??evidence.changes;
  const branchSig=evidence.branchSignatures??evidence.branches;
  const changePid=evidence.changePatchIds;
  const branchPid=evidence.branchPatchIds;
  const changeFiles=evidence.changeFiles;
  const branchOwn=evidence.branchOwnFiles;
  const githubPulls=evidence.githubPulls??[];

  const pickCandidate=(branch:LightBranch,predicate:(hash:string)=>boolean):string|undefined=>{
    const hx=xOf.get(branch.head);
    const fx=branch.fork?xOf.get(branch.fork):undefined;
    const root=branch.fork??byHash.get(branch.members[0]!)?.parents[0];
    const before=ancestorsOf(root);
    const eligible=primaryByX.filter(n=>!before.has(n.hash)&&predicate(n.hash));
    if(!eligible.length)return undefined;
    const forward=hx!==undefined?eligible.find(n=>n.x>hx):undefined;
    if(forward)return forward.hash;
    return fx!==undefined?eligible.find(n=>n.x>fx)?.hash:eligible[0]?.hash;
  };

  const ghMatchFor=(h:string,target?:string,basisFilter?:GitGithubSquashMatch['basis']):GitGithubSquashMatch|undefined=>
    githubPulls.find(p=>(!basisFilter||p.basis===basisFilter)&&(!target||p.mergeCommit===target)&&(p.headOid===h||!!p.eligibleTips?.includes(h)));

  for(const branch of branches){
    if(branch.merge)continue;
    if(!branch.members.some(m=>(byHash.get(m)?.parents.length??0)<=1))continue;
    const h=branch.head;

    let target:string|undefined,basis:SquashJoinBasis|undefined,pr:number|undefined;

    // 1a. Exact content signature match
    const sig=branchSig?.get(h);
    if(sig&&changeSig){
      target=pickCandidate(branch,c=>changeSig.get(c)===sig);
      if(target)basis='content-signature';
    }

    // 1b. Stable patch-id match of net branch diff against squash commit diff
    if(!target&&branchPid&&changePid){
      const pid=branchPid.get(h);
      if(pid){
        target=pickCandidate(branch,c=>changePid.get(c)===pid);
        if(target)basis='patch-id';
      }
    }

    // 1c. Path superset: squash commit wrote identical contents for every path the branch's own commits changed
    if(!target&&branchOwn&&changeFiles){
      const own=branchOwn.get(h);
      if(own&&own.size>0){
        target=pickCandidate(branch,c=>{
          const cf=changeFiles.get(c);
          if(!cf||cf.size<own.size)return false;
          for(const [path,blob] of own)if(cf.get(path)!==blob)return false;
          return true;
        });
        if(target)basis='path-superset';
      }
    }

    // 2. Opt-in GitHub closed merged PR match
    if(!target&&githubPulls.length){
      for(const match of githubPulls){
        if(match.basis!=='github-pr')continue;
        if(match.headOid!==h&&!match.eligibleTips?.includes(h))continue;
        const hit=pickCandidate(branch,c=>c===match.mergeCommit);
        if(hit){target=hit;basis='github-pr';pr=match.pr;break;}
      }
    }

    // 3. Opt-in GitHub (#N) squash-subject PR lookup
    if(!target&&githubPulls.length){
      for(const match of githubPulls){
        if(match.basis!=='github-subject-pr')continue;
        if(match.headOid!==h&&!match.eligibleTips?.includes(h))continue;
        const hit=pickCandidate(branch,c=>c===match.mergeCommit);
        if(hit){target=hit;basis='github-subject-pr';pr=match.pr;break;}
      }
    }

    if(target&&basis){
      if(pr===undefined&&githubPulls.length)pr=ghMatchFor(h,target)?.pr;
      joins.set(h,{head:h,target,basis,...(pr!==undefined?{pr}:{})});
    }
  }
  return joins;
}
