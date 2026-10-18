import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {GitCommit} from '../../../daemon/src/git-types.ts';
import {gitThreadLayout} from '../lib/git-thread-layout.ts';
import './git-thread-graph.css';
import {useApp} from '../state.ts';

const fiberColors=['#efffff','#73edff','#348fff','#c5caff','#ff9de7','#9a73ff','#aaffec','#e8d69b','#51bfff','#f2ddff'];

export function GitThreadGraph({commits,selected,choose,primary,seeds,resetKey,moreOlder,moreNewer,loading,extend,offset}:{commits:GitCommit[];selected:string;choose:(hash:string)=>void;primary?:{name:string;tip:string};seeds:Set<string>;resetKey:string;moreOlder:boolean;moreNewer:boolean;loading:boolean;extend:(direction:'older'|'newer')=>void;offset:number}) {
  const graph=useMemo(()=>gitThreadLayout(commits,primary?.tip,seeds,offset),[commits,primary?.tip,offset]),viewport=useRef<HTMLDivElement>(null);
  const [scale,setScale]=useState(.6),[hovered,setHovered]=useState('');
  const drag=useRef<{x:number;y:number;left:number;top:number;id:number}|undefined>(undefined);
  const fit=()=>{const el=viewport.current;if(el){setScale(Math.max(.04,Math.min(1,(el.clientWidth-48)/graph.width,(el.clientHeight-70)/graph.height)));el.scrollTo(0,0);}};
  const previous=useRef<{graph:typeof graph;key:string}|undefined>(undefined);
  const gradient=useId().replace(/:/g,'');
  const lowResource=useApp(state=>state.lowResource);
  // Texture follows the real parent curves. Bound the extra strokes independently of history size.
  const fiberBudget=Math.max(0,Math.min(lowResource?4:32,Math.floor((lowResource?1200:6000)/Math.max(1,graph.edges.length))));
  useLayoutEffect(()=>{
    const before=previous.current;previous.current={graph,key:resetKey};
    seeds.clear();for(const hash of graph.mainSeeds)seeds.add(hash);
    const el=viewport.current;if(!el)return;
    if(!before||!before.graph.nodes.length||before.key!==resetKey){fit();setHovered('');return;}
    const oldX=Math.max(24,(el.clientWidth-before.graph.width*scale)/2),newX=Math.max(24,(el.clientWidth-graph.width*scale)/2),oldY=Math.max(24,(el.clientHeight-before.graph.height*scale)/2),newY=Math.max(24,(el.clientHeight-graph.height*scale)/2);
    const center=el.scrollLeft+el.clientWidth/2-oldX;
    const anchor=before.graph.nodes.filter(node=>graph.nodes.some(next=>next.hash===node.hash)).sort((a,b)=>Math.abs(a.x*scale-center)-Math.abs(b.x*scale-center))[0];
    const next=anchor&&graph.nodes.find(node=>node.hash===anchor.hash);
    if(next){el.scrollLeft+=(next.x-anchor.x)*scale+newX-oldX;el.scrollTop+=(next.y-anchor.y)*scale+newY-oldY;}
  },[graph,resetKey]);
  const fitCurrent=useRef(fit);fitCurrent.current=fit;
  useEffect(()=>{const el=viewport.current;if(!el)return;let width=0,height=0;const observer=new ResizeObserver(()=>{if(el.clientWidth===width&&el.clientHeight===height)return;width=el.clientWidth;height=el.clientHeight;fitCurrent.current();});observer.observe(el);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    const el=viewport.current;if(!el)return;
    const wheel=(event:WheelEvent)=>{if(event.ctrlKey||event.metaKey)return;event.preventDefault();const delta=event.deltaX||event.deltaY;el.scrollLeft+=delta;if(delta<0&&el.scrollLeft<40&&moreOlder&&!loading)extend('older');else if(delta>0&&el.scrollLeft+el.clientWidth>el.scrollWidth-40&&moreNewer&&!loading)extend('newer');};
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
  },[moreOlder,moreNewer,loading,extend]);
  const zoom=(factor:number)=>{
    const el=viewport.current;if(!el)return;
    const next=Math.max(.04,Math.min(2.5,scale*factor)),ratio=next/scale;
    const left=(el.scrollLeft+el.clientWidth/2)*ratio-el.clientWidth/2,top=(el.scrollTop+el.clientHeight/2)*ratio-el.clientHeight/2;
    setScale(next);requestAnimationFrame(()=>el.scrollTo(left,top));
  };
  const hit=Math.max(3,Math.min(32,76*scale*.8));
  const active=commits.find(commit=>commit.hash===hovered),neighbors=new Set(active?[active.hash,...active.parents,...commits.filter(commit=>commit.parents.includes(active.hash)).map(commit=>commit.hash)]:[]);
  return <div className="thread-graph">
    <div className="thread-controls"><span title="One shared mixed-color treatment; primary history is thicker. Width reflects loaded branch-segment commits only.">{primary?.name??'Primary'} timeline</span><button className="btn ghost" aria-label="Zoom out Git graph" onClick={()=>zoom(1/1.25)}>−</button><span>{Math.round(scale*100)}%</span><button className="btn ghost" aria-label="Zoom in Git graph" onClick={()=>zoom(1.25)}>+</button><button className="btn ghost" onClick={fit}>Fit graph</button></div>
    <div className="thread-viewport atlas-commit-list" ref={viewport} tabIndex={0} aria-label="Commits; drag background to pan" onScroll={event=>{const el=event.currentTarget;if(loading||el.scrollWidth<=el.clientWidth+4)return;if(el.scrollLeft<30&&moreOlder)extend('older');else if(el.scrollLeft+el.clientWidth>el.scrollWidth-30&&moreNewer)extend('newer');}} onPointerDown={event=>{
      if(event.button!==0||(event.target as HTMLElement).closest('button'))return;
      const el=event.currentTarget;drag.current={x:event.clientX,y:event.clientY,left:el.scrollLeft,top:el.scrollTop,id:event.pointerId};el.setPointerCapture(event.pointerId);
    }} onPointerMove={event=>{const state=drag.current;if(state&&state.id===event.pointerId){event.currentTarget.scrollLeft=state.left+state.x-event.clientX;event.currentTarget.scrollTop=state.top+state.y-event.clientY;}}} onPointerUp={event=>{const state=drag.current;if(state){const dx=state.x-event.clientX;if(dx<0&&event.currentTarget.scrollLeft<40&&moreOlder&&!loading)extend('older');else if(dx>0&&event.currentTarget.scrollLeft+event.currentTarget.clientWidth>event.currentTarget.scrollWidth-40&&moreNewer&&!loading)extend('newer');}drag.current=undefined;}} onPointerCancel={()=>{drag.current=undefined;}} onKeyDown={event=>{
      if(event.key==='PageUp'&&moreOlder){event.preventDefault();extend('older');return;}if(event.key==='PageDown'&&moreNewer){event.preventDefault();extend('newer');return;}
      if(!['ArrowRight','ArrowLeft','Home','End','Escape'].includes(event.key))return;
      if(event.key==='Escape'){setHovered('');return;}if(event.altKey||event.ctrlKey||event.metaKey)return;
      const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('.thread-commit')];const index=buttons.indexOf(event.target as HTMLButtonElement);
      if(!buttons.length)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+(event.key==='ArrowLeft'?1:-1)));buttons[next]?.focus();
    }}>
      <div className="thread-space" style={{width:graph.width*scale+48,height:graph.height*scale+48}}><div className="thread-world" style={{width:graph.width,height:graph.height,left:`max(24px,calc(50% - ${graph.width*scale/2}px))`,top:`max(24px,calc(50% - ${graph.height*scale/2}px))`,transform:`scale(${scale})`}}>
        <svg className="thread-links" width={graph.width} height={graph.height} aria-hidden="true">
          <defs><linearGradient id={gradient} x1="0" y1="0" x2={graph.width} y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#9e81ff"/><stop offset=".24" stopColor="#65dfff"/><stop offset=".48" stopColor="#e0faff"/><stop offset=".7" stopColor="#ae8fff"/><stop offset=".86" stopColor="#ffade9"/><stop offset="1" stopColor="#6be5ff"/></linearGradient></defs>
          {graph.edges.map(edge=>{const count=Math.min(fiberBudget,edge.primary?32:16),width=edge.width/scale;return <g key={`${edge.from}/${edge.to}`} className={`thread-bundle${active&&!neighbors.has(edge.from)?' muted':''}${selected===edge.to||hovered===edge.to?' active':''}`}>
            <path data-parent={edge.from} data-child={edge.to} style={{stroke:`url(#${gradient})`,strokeWidth:width}} className="thread-ribbon" d={edge.path}/>
            {Array.from({length:count},(_,index)=>{const fraction=(index+.5)/count-.5;return <path key={index} d={edge.path} transform={`translate(0 ${fraction*width*.96})`} className="thread-fiber" style={{stroke:fiberColors[index%fiberColors.length],strokeWidth:(index%5===0?1.05:.55)/scale,opacity:index%3===0?.95:.65}}/>;})}
          </g>;})}
        </svg>
        {graph.nodes.map(node=>{const commit=commits.find(commit=>commit.hash===node.hash)!;return <button key={node.hash} className={`thread-commit atlas-commit${node.primary?' thread-primary':''}`} data-commit-hash={node.hash} style={{left:node.x,top:node.y,width:hit,height:hit,margin:`-${hit/2}px 0 0 -${hit/2}px`,transform:`scale(${1/scale})`}} aria-pressed={selected===node.hash} aria-label={`${commit.subject||'Untitled commit'} · ${node.hash.slice(0,8)}`} onPointerEnter={()=>setHovered(node.hash)} onPointerLeave={()=>setHovered(current=>current===node.hash?'':current)} onFocus={()=>setHovered(node.hash)} onBlur={()=>setHovered('')} onClick={()=>choose(node.hash)}><i aria-hidden="true" style={{width:Math.min(scale<.35?3:6,hit),height:Math.min(scale<.35?3:6,hit),border:0}}/>{!!commit.labels.length&&(scale>=.45||node.hash===hovered||node.hash===selected)&&<span className="thread-label" style={node.x>graph.width-160?{left:'auto',right:0,transform:'none'}:undefined}>{commit.labels[0]}{commit.omittedLabels+commit.labels.length>1&&<small> +{commit.omittedLabels+commit.labels.length-1}</small>}</span>}</button>;})}
      </div></div>
    </div>
    {active&&<div className="thread-peek" role="status"><code>{active.hash.slice(0,10)}</code><strong>{active.subject||'Untitled commit'}</strong><span>{active.author} · {new Date(active.time).toLocaleString()}</span><span>{active.parents.length>1?`Merge · ${active.parents.length} parents`:active.parents.length?'Commit':'Root commit'}{active.labels.length?` · ${active.labels.join(', ')}`:''}</span><small>Click or Enter to read changed files</small></div>}
    <div className="thread-caption"><select aria-label="Choose Git commit" value="" onChange={event=>{if(event.target.value)choose(event.target.value);}}><option value="">Open a commit…</option>{commits.map(commit=><option key={commit.hash} value={commit.hash}>{commit.hash.slice(0,8)} · {commit.subject}</option>)}</select>{loading?'Loading connected history…':moreOlder?'Scroll left or Page Up for earlier history':'Start of local history'}{moreNewer?' · scroll right for newer history':''}{!graph.primaryFound&&primary?' · primary line outside this loaded neighborhood':''}{graph.omitted?` · ${graph.omitted} additional links: open a commit for its complete parents`:''}<span className="sr-only">Up to 300 commit nodes are mounted. Other history remains reachable by scrolling.</span></div>
  </div>;
}
