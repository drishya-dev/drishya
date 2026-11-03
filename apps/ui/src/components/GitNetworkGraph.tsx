import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {GitCommit,GitSessionLink} from '../../../daemon/src/git-types.ts';
import {gitSessionLinkDescription} from '../../../daemon/src/git-types.ts';
import {gitNetworkLayout} from '../lib/git-network-layout.ts';
import {gitThreadLayout} from '../lib/git-thread-layout.ts';
import type {LightBranch} from '../lib/git-light.ts';
import {BranchChip,BranchPeek} from './GitThreadGraph.tsx';
import {useApp} from '../state.ts';
import './git-network-graph.css';

const MIN_SCALE=.3,MAX_SCALE=3,clampScale=(value:number)=>Math.max(MIN_SCALE,Math.min(MAX_SCALE,value)),zoomStep=1.25;

/** Runs of first-parent commits off the main line: where each left, what it holds, and where it rejoined. Git links only. */
function networkBranches(commits:GitCommit[],main:Set<string>,lanes:Map<string,number>):LightBranch[]{
  const byHash=new Map(commits.map(commit=>[commit.hash,commit])),children=new Map<string,string[]>();
  for(const commit of commits)for(const parent of commit.parents)children.set(parent,[...(children.get(parent)??[]),commit.hash]);
  const taken=new Set<string>(),branches:LightBranch[]=[];
  for(const commit of [...commits].reverse()){
    if(main.has(commit.hash)||taken.has(commit.hash))continue;
    const members=[commit.hash];taken.add(commit.hash);
    for(let cursor=commit.hash;;){
      const next=(children.get(cursor)??[]).map(hash=>byHash.get(hash)!).find(child=>child&&child.parents[0]===cursor&&!main.has(child.hash)&&!taken.has(child.hash));
      if(!next)break;members.push(next.hash);taken.add(next.hash);cursor=next.hash;
    }
    const head=members.at(-1)!,fork=commit.parents[0]&&byHash.has(commit.parents[0])?commit.parents[0]:undefined;
    const merge=(children.get(head)??[]).find(hash=>main.has(hash)&&byHash.get(hash)!.parents[0]!==head);
    branches.push({key:commit.hash,members,fork,merge,head,side:1,tier:lanes.get(commit.hash)??1});
  }
  return branches;
}

/** UI-8 (Yash, 3 Nov): a plain network graph. Time runs left to right, main is the top line, branches leave and rejoin it on lanes below; labels name branch heads. */
export function GitNetworkGraph({select,mirrorRef,commits,selected,choose,primary,seeds,resetKey,moreOlder,moreNewer,loading,extend,offset,mirror,onHover,reveal,links}:{select?:(hash:string)=>void;mirrorRef?:string;links?:Map<string,GitSessionLink>;mirror?:string;onHover?:(hash:string)=>void;reveal?:{hash:string;n:number};evidence?:{changes:Map<string,string>;branches:Map<string,string>};commits:GitCommit[];selected:string;choose:(hash:string)=>void;primary?:{name:string;tip:string};seeds:Set<string>;resetKey:string;moreOlder:boolean;moreNewer:boolean;loading:boolean;extend:(direction:'older'|'newer')=>void;offset:number}){
  const [scale,setScale]=useState(1),[hovered,setHovered]=useState(''),[pinnedKey,setPinnedKey]=useState(''),[branchKey,setBranchKey]=useState('');
  const layout=useMemo(()=>gitNetworkLayout(commits,primary?.tip,{step:44*scale}),[commits,primary?.tip,scale]);
  // Paging the main line still follows the first-parent seeds the history reader keeps.
  const mainSeeds=useMemo(()=>gitThreadLayout(commits,primary?.tip,seeds,offset).mainSeeds,[commits,primary?.tip,offset]);
  const main=useMemo(()=>new Set(layout.nodes.filter(node=>node.main).map(node=>node.hash)),[layout]);
  const branches=useMemo(()=>networkBranches(commits,main,new Map(layout.nodes.map(node=>[node.hash,node.lane]))),[commits,main,layout]);
  const branchOf=useMemo(()=>new Map(branches.flatMap(branch=>branch.members.map(hash=>[hash,branch] as const))),[branches]);
  const byHash=useMemo(()=>new Map(commits.map(commit=>[commit.hash,commit])),[commits]);
  const viewport=useRef<HTMLDivElement>(null),previous=useRef('');
  const motion=useApp(state=>state.motion),lowResource=useApp(state=>state.lowResource);
  const fit=useCallback(()=>{const el=viewport.current;if(!el||!commits.length)return;setScale(clampScale((el.clientWidth-64)/Math.max(1,(commits.length-1)*44)));},[commits.length]);
  useLayoutEffect(()=>{seeds.clear();for(const hash of mainSeeds)seeds.add(hash);},[mainSeeds,seeds]);
  // A new reference opens at the newest commit, on the right.
  useLayoutEffect(()=>{if(previous.current===resetKey)return;previous.current=resetKey;setPinnedKey('');setBranchKey('');setHovered('');setScale(1);requestAnimationFrame(()=>{const el=viewport.current;if(el)el.scrollLeft=el.scrollWidth;});},[resetKey]);
  const zoom=(factor:number)=>{const el=viewport.current;const centre=el?(el.scrollLeft+el.clientWidth/2)/Math.max(1,el.scrollWidth):1;setScale(value=>clampScale(value*factor));requestAnimationFrame(()=>{if(el)el.scrollLeft=centre*el.scrollWidth-el.clientWidth/2;});};
  useEffect(()=>{
    const el=viewport.current;if(!el)return;
    const wheel=(event:WheelEvent)=>{
      if(event.ctrlKey||event.metaKey){event.preventDefault();zoom(Math.exp(-event.deltaY*(event.deltaMode===1?.05:.0025)));return;}
      const delta=event.deltaX||event.deltaY;if(!delta)return;event.preventDefault();el.scrollLeft+=delta;
      if(delta<0&&el.scrollLeft<40&&moreOlder&&!loading)extend('older');else if(delta>0&&el.scrollLeft+el.clientWidth>el.scrollWidth-40&&moreNewer&&!loading)extend('newer');
    };
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
  },[moreOlder,moreNewer,loading,extend]);
  const revealCommit=useCallback((hash:string)=>{
    const el=viewport.current,target=el?.querySelector<HTMLElement>(`[data-commit-hash="${hash}"]`);if(!el||!target)return;
    const box=el.getBoundingClientRect(),at=target.getBoundingClientRect(),cx=at.left+at.width/2-box.left,margin=Math.min(120,el.clientWidth/4);
    if(cx<margin||cx>el.clientWidth-margin)el.scrollBy({left:cx-el.clientWidth/2,behavior:!motion||lowResource?'auto':'smooth'});
  },[motion,lowResource]);
  useEffect(()=>{if(reveal)revealCommit(reveal.hash);},[reveal?.hash,reveal?.n]);
  useEffect(()=>{onHover?.(hovered);},[hovered,onHover]);
  const focused=branches.find(branch=>branch.key===pinnedKey);
  const refBranch=mirrorRef?branchOf.get(commits.find(commit=>commit.labels.includes(mirrorRef))?.hash??''):undefined;
  const active=byHash.get(hovered||mirror||'');
  const peek=!active?branches.find(branch=>branch.key===(branchKey||refBranch?.key||pinnedKey)):undefined;
  const step=(direction:1|-1)=>{if(!focused)return;const at=focused.members.indexOf(selected),next=at<0?(direction>0?0:focused.members.length-1):at+direction;const hash=focused.members[Math.max(0,Math.min(focused.members.length-1,next))];if(hash){(select??choose)(hash);revealCommit(hash);}};
  const lit=new Set(active?[active.hash,...active.parents,...commits.filter(commit=>commit.parents.includes(active.hash)).map(commit=>commit.hash)]:(focused??peek)?.members??[]);
  const dim=lit.size>0;
  return <div className="thread-graph network-graph">
    <div className="thread-controls">{focused?<BranchChip branch={focused} byHash={byHash} selected={selected} step={step} clear={()=>setPinnedKey('')}/>:<span className="thread-title">{primary?`${primary.name} · ${commits.length} commits`:`${commits.length} commits`}</span>}
      <div className="thread-zoom" role="group" aria-label="Git graph view">
        <button type="button" aria-label="Zoom out Git graph" title="Zoom out (−)" onClick={()=>zoom(1/zoomStep)}>−</button>
        <output aria-live="polite">{Math.round(scale*100)}%</output>
        <button type="button" aria-label="Zoom in Git graph" title="Zoom in (+)" onClick={()=>zoom(zoomStep)}>+</button>
        <button type="button" aria-label="Fit graph" title="Fit the loaded history" onClick={fit}>Fit</button>
      </div>
    </div>
    <div className="thread-viewport network-viewport atlas-commit-list" ref={viewport} tabIndex={0} aria-label="Commits, oldest on the left" onKeyDown={event=>{
      if(event.key==='PageUp'&&moreOlder){event.preventDefault();extend('older');return;}if(event.key==='PageDown'&&moreNewer){event.preventDefault();extend('newer');return;}
      if((event.key==='+'||event.key==='=')&&!event.ctrlKey&&!event.metaKey){event.preventDefault();zoom(zoomStep);return;}if(event.key==='-'&&!event.ctrlKey&&!event.metaKey){event.preventDefault();zoom(1/zoomStep);return;}
      if((event.key==='b'||event.key==='B')&&!event.altKey&&!event.ctrlKey&&!event.metaKey){const hash=(event.target as HTMLElement).closest<HTMLElement>('[data-commit-hash]')?.dataset.commitHash,found=hash?branchOf.get(hash):undefined;if(found){event.preventDefault();setPinnedKey(value=>value===found.key?'':found.key);}return;}
      if(event.key==='Escape'){if(pinnedKey||branchKey||hovered){event.stopPropagation();event.preventDefault();}setHovered('');setBranchKey('');setPinnedKey('');return;}
      if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;
      const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('.thread-commit')].sort((a,b)=>parseFloat(a.style.left)-parseFloat(b.style.left));const index=buttons.indexOf(event.target as HTMLButtonElement);
      if(!buttons.length)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,(index<0?buttons.length-1:index)+(event.key==='ArrowLeft'?-1:1)));buttons[next]?.focus();
    }}>
      <div className="network-world" style={{width:layout.width,height:layout.height+28}}>
        <svg className="thread-links network-links" width={layout.width} height={layout.height} aria-hidden="true">
          {layout.edges.map(edge=><g key={`${edge.from}>${edge.to}`} className={`network-edge lane-${edge.main?0:1+(edge.lane-1)%5}${dim&&!(lit.has(edge.from)&&lit.has(edge.to))?' muted':''}`}><path className="network-halo" d={edge.path}/><path className="network-core" d={edge.path} onPointerEnter={()=>{const branch=branchOf.get(edge.to)??branchOf.get(edge.from);if(branch)setBranchKey(branch.key);}} onPointerLeave={()=>setBranchKey('')} onClick={()=>{const branch=branchOf.get(edge.to)??branchOf.get(edge.from);if(branch)setPinnedKey(value=>value===branch.key?'':branch.key);}}/></g>)}
        </svg>
        {layout.nodes.map(node=>{const commit=byHash.get(node.hash)!,link=links?.get(node.hash);return <button key={node.hash} type="button" className={`thread-commit atlas-commit network-commit${node.main?' thread-primary':''}${dim&&!lit.has(node.hash)?' muted':''}${link?' linked':''}`} data-commit-hash={node.hash} style={{left:node.x,top:node.y}} aria-pressed={selected===node.hash} aria-label={`${commit.subject||'Untitled commit'} · ${commit.hash.slice(0,7)}${commit.labels.length?` · ${commit.labels.join(', ')}`:''}${link?` · ${gitSessionLinkDescription(link)}`:''}`} title={`${commit.hash.slice(0,10)} · ${commit.subject}`} onPointerEnter={()=>setHovered(node.hash)} onPointerLeave={()=>setHovered('')} onFocus={()=>setHovered(node.hash)} onBlur={()=>setHovered('')} onClick={()=>choose(node.hash)}/>;})}
        {layout.nodes.filter(node=>byHash.get(node.hash)!.labels.length).map(node=>{const labels=byHash.get(node.hash)!.labels;return <span key={`label-${node.hash}`} className={`network-label${node.main?' main':''}`} style={{left:node.x,top:node.y}} title={labels.join(', ')}>{labels[0]}{labels.length>1?` +${labels.length-1}`:''}</span>;})}
      </div>
    </div>
    {active&&<div className="thread-peek" role="status"><code>{active.hash.slice(0,10)}</code><strong>{active.subject||'Untitled commit'}</strong><span>{active.author} · {new Date(active.time).toLocaleString()}</span><span>{active.parents.length>1?`Merge · ${active.parents.length} parents`:active.parents.length?'Commit':'Root commit'}{active.labels.length?` · ${active.labels.join(', ')}`:''}</span></div>}
    {peek&&<BranchPeek branch={peek} byHash={byHash} primary={primary?.name} focused={peek.key===pinnedKey&&!branchKey&&!refBranch} open={()=>choose(peek.head)}/>}
    <div className="thread-caption"><select aria-label="Choose Git commit" value="" onChange={event=>{if(event.target.value)choose(event.target.value);}}><option value="">Open a commit…</option>{commits.map(commit=><option key={commit.hash} value={commit.hash}>{commit.hash.slice(0,8)} · {commit.subject}</option>)}</select><span className="thread-status">{loading?'Loading connected history…':moreOlder?'Scroll left or Page Up for earlier history':'Start of loaded history'}</span></div>
  </div>;
}
