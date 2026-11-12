import {describe,expect,it} from 'vitest';
import type {GitCommit,GitHistoryPage} from '../../../daemon/src/git-types.ts';
import {gitNetworkLayout} from '../src/lib/git-network-layout.ts';
import {
  GitHistoryCacheStore,
  GitNetworkLayoutCache,
  buildNetworkGraphBundle,
  networkBranches,
  type GitHistorySnapshot,
} from '../src/lib/git-history-cache.ts';

function sampleCommits(prefix:string,count=6):GitCommit[] {
  const commits:GitCommit[]=[];
  for(let i=0;i<count;i++){
    const hash=`${prefix}${String(i).padStart(39,'0')}`;
    const parent=i+1<count?[`${prefix}${String(i+1).padStart(39,'0')}`]:[];
    commits.push({
      hash,
      parents:parent,
      author:'Builder',
      time:'2026-11-12T00:00:00Z',
      subject:`Commit ${i}`,
      labels:i===0?['main']:[],
      omittedLabels:0,
    });
  }
  return commits;
}

function samplePage(commits:GitCommit[],generation='g'.repeat(64)):GitHistoryPage {
  return {
    mainline:{name:'main',tip:commits[0]!.hash},
    generation,
    head:commits[0]!.hash,
    branch:'main',
    shallow:false,
    sampledAt:'2026-11-12T00:00:00Z',
    commits,
    start:0,
    more:false,
    limit:50,
    references:[],
    referenceStart:0,
    referenceCount:0,
    referenceTotal:0,
    localBranches:[],
    localBranchTotal:0,
  };
}

function makeSnapshot(commits:GitCommit[],scale=1,scrollLeft=120):GitHistorySnapshot {
  const page=samplePage(commits);
  return {
    approved:true,
    start:0,
    reference:'all',
    referenceStart:0,
    query:'',
    filter:'',
    retry:0,
    value:{key:'0/all/0//0',data:page},
    pages:new Map([[0,page]]),
    selected:commits[1]!.hash,
    parent:0,
    fileStart:0,
    detailKey:`rec:${commits[1]!.hash}:0:0`,
    detailCache:new Map(),
    path:'',
    reading:false,
    allRefs:false,
    scale,
    scrollLeft,
    rowsScrollTop:48,
    mainSeeds:[commits[0]!.hash],
  };
}

describe('git-history-cache',()=>{
  it('buildNetworkGraphBundle matches gitNetworkLayout and networkBranches exactly',()=>{
    const c0='a'.repeat(40),c1='b'.repeat(40),c2='c'.repeat(40),c3='d'.repeat(40);
    const commits:GitCommit[]=[
      {hash:c3,parents:[c2,c1],author:'A',time:'2026-11-12T03:00:00Z',subject:'Merge topic',labels:['main'],omittedLabels:0},
      {hash:c2,parents:[c0],author:'A',time:'2026-11-12T02:00:00Z',subject:'Main work',labels:[],omittedLabels:0},
      {hash:c1,parents:[c0],author:'B',time:'2026-11-12T01:30:00Z',subject:'Topic work',labels:['topic'],omittedLabels:0},
      {hash:c0,parents:[],author:'A',time:'2026-11-12T01:00:00Z',subject:'Root',labels:[],omittedLabels:0},
    ];
    const layout=gitNetworkLayout(commits,c3,{step:44});
    const main=new Set(layout.nodes.filter(n=>n.main).map(n=>n.hash));
    const branches=networkBranches(commits,main,new Map(layout.nodes.map(n=>[n.hash,n.lane])));
    const bundle=buildNetworkGraphBundle(commits,{name:'main',tip:c3},new Set(),0,1);

    expect(bundle.mainTip).toBe(c3);
    expect(bundle.layout).toEqual(layout);
    expect(bundle.branches).toEqual(branches);
    expect(bundle.labels.map(l=>l.text)).toEqual(['main','topic']);
  });

  it('caches graph bundles by structure and scale, and evicts LRU entries cleanly',()=>{
    const cache=new GitNetworkLayoutCache(2);
    const commitsA=sampleCommits('a'),commitsB=sampleCommits('b'),commitsC=sampleCommits('c');
    const primaryA={name:'main',tip:commitsA[0]!.hash};
    const primaryB={name:'main',tip:commitsB[0]!.hash};
    const primaryC={name:'main',tip:commitsC[0]!.hash};

    const first=cache.resolve(commitsA,primaryA,new Set(),0,1);
    expect(first.cached).toBe(false);
    expect(cache.misses).toBe(1);

    // Hit with exact same array reference AND with an equivalent clone (structural match).
    const hit1=cache.resolve(commitsA,primaryA,new Set(),0,1);
    const hit2=cache.resolve(commitsA.map(c=>({...c})),primaryA,new Set(),0,1);
    expect(hit1.cached).toBe(true);
    expect(hit2.cached).toBe(true);
    expect(hit1.bundle).toBe(first.bundle);
    expect(hit2.bundle).toBe(first.bundle);

    // Different scale triggers miss and caches both entries.
    const zoomed=cache.resolve(commitsA,primaryA,new Set(),0,1.25);
    expect(zoomed.cached).toBe(false);
    expect(cache.size).toBe(2);

    // Touch scale=1 so scale=1.25 becomes LRU, then insert commitsB.
    expect(cache.resolve(commitsA,primaryA,new Set(),0,1).cached).toBe(true);
    cache.resolve(commitsB,primaryB,new Set(),0,1);
    expect(cache.size).toBe(2);

    // scale=1 for commitsA survived; scale=1.25 was evicted; commitsC evicts commitsA.
    expect(cache.resolve(commitsA,primaryA,new Set(),0,1).cached).toBe(true);
    cache.resolve(commitsC,primaryC,new Set(),0,1);
    expect(cache.size).toBe(2);
    expect(cache.resolve(commitsB,primaryB,new Set(),0,1).cached).toBe(false);
  });

  it('isolates UI snapshots per source and checkout and respects LRU snapshot limit',()=>{
    const store=new GitHistoryCacheStore(2,8);
    const source1={id:'daemon-1'},source2={id:'daemon-2'};
    const commitsA=sampleCommits('a'),commitsB=sampleCommits('b'),commitsC=sampleCommits('c');

    store.upsert(source1,'rec1:main',makeSnapshot(commitsA,1.5,310));
    store.upsert(source1,'rec1:wt-1',makeSnapshot(commitsB,0.8,90));
    store.upsert(source2,'rec1:main',makeSnapshot(commitsC,2,50));

    // Separate sources do not overwrite each other.
    expect(store.get(source1,'rec1:main')?.scale).toBe(1.5);
    expect(store.get(source1,'rec1:main')?.scrollLeft).toBe(310);
    expect(store.get(source1,'rec1:main')?.rowsScrollTop).toBe(48);
    expect(store.get(source1,'rec1:wt-1')?.selected).toBe(commitsB[1]!.hash);
    expect(store.get(source2,'rec1:main')?.scale).toBe(2);

    // Promote rec1:main in source1, then insert rec2:main to evict rec1:wt-1.
    store.get(source1,'rec1:main');
    store.upsert(source1,'rec2:main',makeSnapshot(commitsC,1,0));
    expect(store.size(source1)).toBe(2);
    expect(store.get(source1,'rec1:main')).toBeDefined();
    expect(store.get(source1,'rec1:wt-1')).toBeUndefined();
    expect(store.get(source1,'rec2:main')).toBeDefined();
  });
});
