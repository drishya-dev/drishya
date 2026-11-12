import {describe,expect,it} from 'vitest';
import type {GitCommit,GitHistoryPage} from '../../../daemon/src/git-types.ts';
import {buildNetworkGraphBundle,GitNetworkLayoutCache} from '../src/lib/git-history-cache.ts';
import {gitNetworkLayout} from '../src/lib/git-network-layout.ts';
import {collectSquashEvidence,resolveSquashJoins,type SquashEvidence} from '../src/lib/git-squash.ts';

const h=(prefix:string)=>prefix.padEnd(40,'0');
const makeCommit=(hash:string,parents:string[],subject:string,labels:string[]=[]):GitCommit=>({
  hash,
  parents,
  author:'Builder',
  time:'2026-11-12T12:00:00Z',
  subject,
  labels,
  omittedLabels:0,
});

describe('git-squash evidence resolution',()=>{
  const m0=h('a0'),m1=h('a1'),m2=h('a2'),b1=h('b1'),b2=h('b2'),unmerged=h('c1');
  const commits:GitCommit[]=[
    makeCommit(m2,[m1],'Feature (#42)',['main']),
    makeCommit(unmerged,[m1],'WIP unrelated branch',[],),
    makeCommit(b2,[b1],'Branch commit two',['feat']),
    makeCommit(b1,[m0],'Branch commit one'),
    makeCommit(m1,[m0],'Other main commit'),
    makeCommit(m0,[],'Root'),
  ];

  it('matches Rule 1a (content-signature) and emits a squash edge on the network layout',()=>{
    const evidence:SquashEvidence={
      changeSignatures:new Map([[m2,'sig-feat']]),
      branchSignatures:new Map([[b2,'sig-feat'],[unmerged,'sig-wip']]),
    };
    const bundle=buildNetworkGraphBundle(commits,{name:'main',tip:m2},new Set(),0,1,evidence);
    const feat=bundle.branches.find(b=>b.head===b2)!;
    expect(feat.squash).toBe(true);
    expect(feat.merge).toBe(m2);
    expect(feat.squashBasis).toBe('content-signature');
    expect(feat.squashPr).toBeUndefined();

    const wip=bundle.branches.find(b=>b.head===unmerged)!;
    expect(wip.squash).toBeFalsy();
    expect(wip.merge).toBeUndefined();

    const squashEdge=bundle.layout.edges.find(e=>e.squash&&e.from===b2&&e.to===m2);
    expect(squashEdge).toBeDefined();
    expect(squashEdge!.path).toMatch(/^M\d+,\d+ H\d+ Q\d+,\d+ \d+,\d+ V\d+$/);
  });

  it('falls back to Rule 1b (patch-id) when shared files drifted on main',()=>{
    const evidence:SquashEvidence={
      changeSignatures:new Map([[m2,'sig-main-drifted']]),
      branchSignatures:new Map([[b2,'sig-branch-orig'],[unmerged,'sig-wip']]),
      changePatchIds:new Map([[m2,'pid-shared-123']]),
      branchPatchIds:new Map([[b2,'pid-shared-123'],[unmerged,'pid-other']]),
    };
    const bundle=buildNetworkGraphBundle(commits,{name:'main',tip:m2},new Set(),0,1,evidence);
    const feat=bundle.branches.find(b=>b.head===b2)!;
    expect(feat.squash).toBe(true);
    expect(feat.merge).toBe(m2);
    expect(feat.squashBasis).toBe('patch-id');
  });

  it('falls back to Rule 1c (path-superset) when squash commit touches extra files with identical own blobs',()=>{
    const evidence:SquashEvidence={
      changeSignatures:new Map([[m2,'sig-sq']]),
      branchSignatures:new Map([[b2,'sig-b']]),
      changeFiles:new Map([[m2,new Map([['src/a.ts','blob-a'],['docs/TASKS.md','blob-tasks']])]]),
      branchOwnFiles:new Map([[b2,new Map([['src/a.ts','blob-a']])],[unmerged,new Map([['src/a.ts','blob-other']])]]),
    };
    const bundle=buildNetworkGraphBundle(commits,{name:'main',tip:m2},new Set(),0,1,evidence);
    const feat=bundle.branches.find(b=>b.head===b2)!;
    expect(feat.squash).toBe(true);
    expect(feat.merge).toBe(m2);
    expect(feat.squashBasis).toBe('path-superset');
    expect(bundle.branches.find(b=>b.head===unmerged)?.squash).toBeFalsy();
  });

  it('joins via Rule 2 (github-pr) and Rule 3 (github-subject-pr) with PR number and never by name alone',()=>{
    const rule2Evidence:SquashEvidence={
      changeSignatures:new Map(),
      branchSignatures:new Map(),
      githubPulls:[{pr:42,headRef:'feat',headOid:h('remote-rebased'),mergeCommit:m2,eligibleTips:[b2],basis:'github-pr'}],
    };
    const b2Bundle=buildNetworkGraphBundle(commits,{name:'main',tip:m2},new Set(),0,1,rule2Evidence);
    const joined2=b2Bundle.branches.find(b=>b.head===b2)!;
    expect(joined2).toMatchObject({squash:true,merge:m2,squashBasis:'github-pr',squashPr:42});

    // Rule 3 subject PR match
    const rule3Evidence:SquashEvidence={
      changeSignatures:new Map(),
      branchSignatures:new Map(),
      githubPulls:[{pr:99,headRef:'feat',headOid:b2,mergeCommit:m2,eligibleTips:[b2],basis:'github-subject-pr'}],
    };
    const b3Bundle=buildNetworkGraphBundle(commits,{name:'main',tip:m2},new Set(),0,1,rule3Evidence);
    expect(b3Bundle.branches.find(b=>b.head===b2)).toMatchObject({squash:true,merge:m2,squashBasis:'github-subject-pr',squashPr:99});

    // Name alone with no matching headOid/eligibleTips NEVER joins
    const nameOnlyEvidence:SquashEvidence={
      changeSignatures:new Map(),
      branchSignatures:new Map(),
      githubPulls:[{pr:42,headRef:'feat',headOid:h('other'),mergeCommit:m2,eligibleTips:[h('other')],basis:'github-pr'}],
    };
    const unsafeBundle=buildNetworkGraphBundle(commits,{name:'main',tip:m2},new Set(),0,1,nameOnlyEvidence);
    expect(unsafeBundle.branches.find(b=>b.head===b2)?.squash).toBeFalsy();
  });

  it('never joins onto a commit predating the branch fork',()=>{
    const before=h('m00');
    const hist:GitCommit[]=[
      makeCommit(m1,[m0],'Main later',['main']),
      makeCommit(b1,[m0],'Branch work',['feat']),
      makeCommit(m0,[before],'Fork point'),
      makeCommit(before,[],'Earlier main commit'),
    ];
    const evidence:SquashEvidence={
      changeSignatures:new Map([[before,'same-sig']]),
      branchSignatures:new Map([[b1,'same-sig']]),
    };
    const bundle=buildNetworkGraphBundle(hist,{name:'main',tip:m1},new Set(),0,1,evidence);
    expect(bundle.branches.find(b=>b.head===b1)?.squash).toBeFalsy();
  });

  it('collects evidence across pages and invalidates layout cache when evidence changes',()=>{
    const p0:GitHistoryPage={
      generation:'a'.repeat(64),head:m2,branch:'main',shallow:false,sampledAt:'',
      commits:[commits[0]!],start:0,more:true,limit:50,references:[],referenceStart:0,referenceCount:0,referenceTotal:0,
      changePatchIds:{[m2]:'pid-cross'},
    };
    const p1:GitHistoryPage={
      generation:'a'.repeat(64),head:m2,branch:'main',shallow:false,sampledAt:'',
      commits:commits.slice(1),start:50,more:false,limit:50,references:[],referenceStart:0,referenceCount:0,referenceTotal:0,
      branchPatchIds:{[b2]:'pid-cross'},
    };
    const combined=collectSquashEvidence([p0,p1]);
    const joins=resolveSquashJoins(
      commits,
      new Set([m0,m1,m2]),
      [{key:b1,members:[b1,b2],fork:m0,head:b2,side:1,tier:1}],
      gitNetworkLayout(commits,m2).nodes,
      combined,
    );
    expect(joins.get(b2)).toEqual({head:b2,target:m2,basis:'patch-id'});

    const cache=new GitNetworkLayoutCache(4);
    const withoutEv=cache.resolve(commits,{name:'main',tip:m2},new Set(),0,1);
    const withEv=cache.resolve(commits,{name:'main',tip:m2},new Set(),0,1,combined);
    expect(withoutEv.bundle.layout.edges).toHaveLength(5);
    expect(withEv.bundle.layout.edges).toHaveLength(6);
    expect(withEv.cached).toBe(false);
    expect(cache.resolve(commits,{name:'main',tip:m2},new Set(),0,1,combined).cached).toBe(true);
  });
});
