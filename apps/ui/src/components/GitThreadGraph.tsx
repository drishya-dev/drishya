import {gitSessionLinkDescription} from '../../../daemon/src/git-types.ts';
import {useCallback,useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {GitCommit,GitSessionLink} from '../../../daemon/src/git-types.ts';
import {gitRibbonGeometry} from '../lib/git-ribbon-geometry.ts';
import {gitThreadLayout} from '../lib/git-thread-layout.ts';
import {branchAt,gitLight,hashSeed,lightCache,lightLayout,type LightBranch} from '../lib/git-light.ts';
import {LightRenderer} from '../lib/light-renderer.ts';
import {ago} from '../lib/git-commit-rows.ts';
import './git-thread-graph.css';
import {useApp} from '../state.ts';

const ribbonColors=['#e6ffff','#69eaff','#427bff','#b5afff','#ffb7ee','#9068fa','#96f4ff','#e8dbb7','#4fb8ff','#e5dbff'];
const MIN_SCALE=.04,MAX_SCALE=2.5,clampScale=(value:number)=>Math.max(MIN_SCALE,Math.min(MAX_SCALE,value));

export function GitThreadGraph({select,mirrorRef,commits,selected,choose,primary,seeds,resetKey,moreOlder,moreNewer,loading,extend,offset,evidence,mirror,onHover,reveal,links}:{select?:(hash:string)=>void;mirrorRef?:string;links?:Map<string,GitSessionLink>;mirror?:string;onHover?:(hash:string)=>void;reveal?:{hash:string;n:number};evidence?:{changes:Map<string,string>;branches:Map<string,string>};commits:GitCommit[];selected:string;choose:(hash:string)=>void;primary?:{name:string;tip:string};seeds:Set<string>;resetKey:string;moreOlder:boolean;moreNewer:boolean;loading:boolean;extend:(direction:'older'|'newer')=>void;offset:number}) {
  const graph=useMemo(()=>gitThreadLayout(commits,primary?.tip,seeds,offset),[commits,primary?.tip,offset]),viewport=useRef<HTMLDivElement>(null);
  const [scale,setScale]=useState(.6),[hovered,setHovered]=useState(''),[orbit,setOrbit]=useState(false),[angle,setAngle]=useState(.35);
  const [branchKey,setBranchKey]=useState(''),[pinnedKey,setPinnedKey]=useState('');
  const drag=useRef<{x:number;y:number;left:number;top:number;id:number;angle:number;moved:boolean}|undefined>(undefined);
  const centerRiver=useRef(false);
  // Fit sizes the graph to the width and then puts the river on the middle line of the window; branches above and below stay reachable by scrolling.
  const fit=()=>{const el=viewport.current;if(el){setInset({});setScale(clampScale(Math.min(1,(el.clientWidth-48)/graph.width,lit?9:(el.clientHeight-70)/graph.height)));el.scrollLeft=0;centerRiver.current=true;}};
  const previous=useRef<{graph:typeof graph;key:string}|undefined>(undefined);
  const gradient=useId().replace(/:/g,'');
  const lowResource=useApp(state=>state.lowResource),motion=useApp(state=>state.motion);
  // GIT-1: filament light drawn by WebGL behind the DOM commits; the SVG ribbon remains only where WebGL2 is unavailable.
  const canvas=useRef<HTMLCanvasElement>(null),world=useRef<HTMLDivElement>(null),renderer=useRef<LightRenderer|undefined>(undefined),[lit,setLit]=useState(false);
  useLayoutEffect(()=>{const element=canvas.current;if(!element)return;renderer.current??=LightRenderer.create(element);setLit(!!renderer.current);},[]);
  const ribbons=useMemo(()=>lit?undefined:gitRibbonGeometry(graph,scale,angle,lowResource,offset),[lit,graph,scale,angle,lowResource,offset]);
  // A branch head whose whole change a newer primary commit wrote exactly (same paths, same contents) was squash-merged
  // there; Git keeps no parent link for that, so this is the only evidence, and it is exact or absent.
  const squash=useMemo(()=>{
    const into=new Map<string,string>(),byX=[...graph.nodes].filter(node=>node.primary).sort((a,b)=>a.x-b.x);
    for(const node of graph.nodes){
      const mark=!node.primary?evidence?.branches.get(node.hash):undefined;if(!mark)continue;
      const target=byX.find(candidate=>candidate.x>node.x&&evidence!.changes.get(candidate.hash)===mark);
      if(target)into.set(node.hash,target.hash);
    }
    return into;
  },[graph,evidence]);
  const light=useMemo(()=>lit?lightLayout(graph,scale,squash):undefined,[lit,graph,scale,squash]);
  const worldHeight=light?.height??graph.height,heightNow=useRef(worldHeight);heightNow.current=worldHeight;
  useLayoutEffect(()=>{const el=viewport.current;if(!centerRiver.current||!el)return;centerRiver.current=false;el.scrollTop=Math.max(0,(worldHeight*scale+48)/2-el.clientHeight/2);},[scale,worldHeight]);
  useLayoutEffect(()=>{
    const before=previous.current;previous.current={graph,key:resetKey};
    seeds.clear();for(const hash of graph.mainSeeds)seeds.add(hash);
    const el=viewport.current;if(!el)return;
    if(!before||!before.graph.nodes.length||before.key!==resetKey){fit();setHovered('');setBranchKey('');setPinnedKey('');return;}
    const oldX=Math.max(24,(el.clientWidth-before.graph.width*scale)/2),newX=Math.max(24,(el.clientWidth-graph.width*scale)/2);
    const center=el.scrollLeft+el.clientWidth/2-oldX;
    const anchor=before.graph.nodes.filter(node=>graph.nodes.some(next=>next.hash===node.hash)).sort((a,b)=>Math.abs(a.x*scale-center)-Math.abs(b.x*scale-center))[0];
    const next=anchor&&graph.nodes.find(node=>node.hash===anchor.hash);
    if(next)el.scrollLeft+=(next.x-anchor.x)*scale+newX-oldX;
  },[graph,resetKey]);
  const fitCurrent=useRef(fit);fitCurrent.current=fit;
  useEffect(()=>{const el=viewport.current;if(!el)return;let width=0,height=0;const observer=new ResizeObserver(()=>{if(el.clientWidth===width&&el.clientHeight===height)return;width=el.clientWidth;height=el.clientHeight;fitCurrent.current();});observer.observe(el);return()=>observer.disconnect();},[]);

  // Zoom keeps the world point under the anchor (the pointer, or the middle for the buttons) where it was. The new scroll
  // is applied in the same commit as the new scale, measured from the laid-out world, so no frame shows the wrong place.
  // When the graph is smaller than the window there is nothing to scroll, so the world is placed explicitly (`inset`)
  // instead of being centred; otherwise it sits at the 24 px margin and scrolling holds the anchor.
  const pendingZoom=useRef<{wx:number;wy:number;ax:number;ay:number}|undefined>(undefined),scaleNow=useRef(scale);scaleNow.current=scale;
  const [inset,setInset]=useState<{x?:number;y?:number;padX?:number;padY?:number}>({});
  const zoomAt=useCallback((factor:number,ax?:number,ay?:number)=>{
    const el=viewport.current,origin=world.current;if(!el||!origin)return;
    const current=scaleNow.current,next=clampScale(current*factor);if(Math.abs(next-current)<1e-4)return;
    const box=el.getBoundingClientRect(),at=origin.getBoundingClientRect(),x=ax??el.clientWidth/2,y=ay??el.clientHeight/2;
    // y is kept relative to the river's middle line, because the world's height follows the zoom.
    pendingZoom.current={wx:(x-(at.left-box.left))/current,wy:(y-(at.top-box.top))/current-heightNow.current/2,ax:x,ay:y};
    setScale(next);
  },[]);
  useLayoutEffect(()=>{
    const pending=pendingZoom.current,el=viewport.current;if(!pending||!el)return;pendingZoom.current=undefined;
    // Where the world's edge must be on screen for the anchor to hold. A graph that fits stays fully in view; one that
    // overflows gets room on either side when the anchor sits near an end, so scrolling can always reach it.
    const place=(size:number,view:number,world:number,anchor:number)=>{
      const edge=anchor-world*scale;
      if(size+48<=view)return{inset:Math.max(24,Math.min(view-24-size,edge)),scroll:0,pad:0};
      if(edge>24)return{inset:edge,scroll:0,pad:0};
      const scroll=24-edge;return{inset:24,scroll,pad:Math.max(0,scroll+view-(size+48))};
    };
    const x=place(graph.width*scale,el.clientWidth,pending.wx,pending.ax),y=place(worldHeight*scale,el.clientHeight,worldHeight/2+pending.wy,pending.ay);
    pendingScroll.current={left:x.scroll,top:y.scroll};setInset({x:x.inset,y:y.inset,padX:x.pad,padY:y.pad});
  },[scale]);
  // The scroll lands in the same commit as the room it needs.
  const pendingScroll=useRef<{left:number;top:number}|undefined>(undefined);
  useLayoutEffect(()=>{const el=viewport.current,next=pendingScroll.current;if(!el||!next)return;pendingScroll.current=undefined;el.scrollLeft=next.left;el.scrollTop=next.top;},[inset]);
  useEffect(()=>{
    const el=viewport.current;if(!el)return;
    const wheel=(event:WheelEvent)=>{
      event.preventDefault();
      // Pinch on a trackpad and Ctrl/⌘ + wheel zoom around the pointer instead of zooming the whole page.
      if(event.ctrlKey||event.metaKey){const box=el.getBoundingClientRect();zoomAt(Math.exp(-event.deltaY*(event.deltaMode===1?.05:.0025)),event.clientX-box.left,event.clientY-box.top);return;}
      const delta=event.deltaX||event.deltaY;el.scrollLeft+=delta;if(delta<0&&el.scrollLeft<40&&moreOlder&&!loading)extend('older');else if(delta>0&&el.scrollLeft+el.clientWidth>el.scrollWidth-40&&moreNewer&&!loading)extend('newer');
    };
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
  },[moreOlder,moreNewer,loading,extend,zoomAt]);

  const hit=Math.max(3,Math.min(32,76*scale*.8));
  const byHash=useMemo(()=>new Map(commits.map(commit=>[commit.hash,commit])),[commits]);
  // A row hovered in the commit list lights the same commit and its neighbours as hovering it here would.
  const active=byHash.get(hovered||mirror||''),neighbors=new Set(active?[active.hash,...active.parents,...commits.filter(commit=>commit.parents.includes(active.hash)).map(commit=>commit.hash)]:[]);
  // A ref hovered in the list names a head; its branch previews here like a strand hovered in the graph does.
  const refBranch=useMemo(()=>{if(!mirrorRef||!light)return undefined;const head=commits.find(commit=>commit.labels.includes(mirrorRef));return head?light.branchOf.get(head.hash):undefined;},[mirrorRef,light,commits]);
  const focused=light?.branches.find(item=>item.key===pinnedKey);
  const branch=!active&&light?light.branches.find(item=>item.key===(branchKey||refBranch?.key||pinnedKey)):undefined;
  useEffect(()=>{onHover?.(hovered);},[hovered,onHover]);
  // Picking a row, or stepping along a branch, brings its commit into view, nudging the timeline only when the commit is off-screen or at an edge.
  const revealCommit=useCallback((hash:string)=>{
    const el=viewport.current,target=el?.querySelector<HTMLElement>(`[data-commit-hash="${hash}"]`);if(!el||!target)return;
    const box=el.getBoundingClientRect(),at=target.getBoundingClientRect(),cx=at.left+at.width/2-box.left,cy=at.top+at.height/2-box.top,margin=Math.min(120,el.clientWidth/4);
    const dx=cx<margin||cx>el.clientWidth-margin?cx-el.clientWidth/2:0,dy=cy<48||cy>el.clientHeight-48?cy-el.clientHeight/2:0;
    if(dx||dy)el.scrollBy({left:dx,top:dy,behavior:!motion||lowResource?'auto':'smooth'});
  },[motion,lowResource]);
  useEffect(()=>{if(reveal)revealCommit(reveal.hash);},[reveal?.hash,reveal?.n]);
  // Previous and next along the focused branch, oldest to newest; the branch's fork and merge commits are not steps.
  const step=(direction:1|-1)=>{
    if(!focused)return;const at=focused.members.indexOf(selected),next=at<0?(direction>0?0:focused.members.length-1):at+direction;
    const hash=focused.members[Math.max(0,Math.min(focused.members.length-1,next))];if(hash){(select??choose)(hash);revealCommit(hash);}
  };
  // Lightning only where a ref names a head with no loaded child; the layout decides which of those are branches.
  const heads=useMemo(()=>{const children=new Set(commits.flatMap(commit=>commit.parents));return new Set(commits.filter(commit=>commit.labels.length&&!children.has(commit.hash)&&!squash.has(commit.hash)).map(commit=>commit.hash));},[commits,squash]);
  const focusSet=active?neighbors:branch?new Set([...branch.members,...(branch.fork?[branch.fork]:[]),...(branch.merge?[branch.merge]:[])]):undefined;
  const lastFocus=useRef<Set<string>|undefined>(undefined);if(focusSet)lastFocus.current=focusSet;
  const focusMix=useRef(0),cache=useRef(lightCache()),frame=useRef<number|undefined>(undefined),seed=useMemo(()=>hashSeed(primary?.name??'repository'),[primary?.name]);
  const scene=useRef({graph,light,scale,selected,lowResource,heads,seed,moreOlder});scene.current={graph,light,scale,selected,lowResource,heads,seed,moreOlder};
  const view=()=>{const el=viewport.current,origin=world.current;if(!el||!origin)return undefined;const box=el.getBoundingClientRect(),at=origin.getBoundingClientRect();return{box,ox:at.left-box.left,oy:at.top-box.top};};
  // Redraws only when the view, the data or the hover changes; idle costs nothing.
  const schedule=useCallback(()=>{
    if(frame.current!==undefined)return;
    frame.current=requestAnimationFrame(()=>{
      frame.current=undefined;const output=renderer.current,el=viewport.current,s=scene.current,v=view();if(!output||!el||!v||!s.light)return;
      output.resize(el.clientWidth,el.clientHeight,Math.min(2,devicePixelRatio||1));
      const t0=performance.now();
      const built=gitLight(s.graph,s.light,{scale:s.scale,ox:v.ox,oy:v.oy,width:el.clientWidth,height:el.clientHeight},{cache:cache.current,focus:lastFocus.current,focusMix:focusMix.current,heads:s.heads,selected:s.selected,lowResource:s.lowResource,seed:s.seed,olderBeyond:s.moreOlder});
      const t1=performance.now();
      output.draw({lines:built.lines,points:built.points,offset:built.offset,linesKey:built.linesKey,bloom:s.lowResource?0:1,exposure:1.6});
      el.dataset.lightMs=`${(t1-t0).toFixed(1)}/${(performance.now()-t1).toFixed(1)}`;el.dataset.lightBuilds=String(cache.current.builds);
      el.dataset.lightSegments=String(built.segments);
    });
  },[]);
  useLayoutEffect(()=>{if(lit)schedule();},[lit,light,scale,selected,lowResource,heads,schedule]);
  useEffect(()=>()=>{if(frame.current!==undefined)cancelAnimationFrame(frame.current);},[]);
  // Hover brightens the touched commit's or branch's strands and dims the rest over 160 ms; instant without motion.
  const focusKey=active?`c:${active.hash}`:branch?`b:${branch.key}`:'';
  useEffect(()=>{
    if(!lit)return;
    const target=focusKey?1:0,from=focusMix.current,start=performance.now(),instant=!motion||matchMedia('(prefers-reduced-motion: reduce)').matches;let id=0;
    const step=(now:number)=>{const t=instant?1:Math.min(1,(now-start)/160);focusMix.current=from+(target-from)*(1-(1-t)**3);schedule();if(t<1)id=requestAnimationFrame(step);};
    id=requestAnimationFrame(step);return()=>cancelAnimationFrame(id);
  },[focusKey,lit]);
  // The branch under the pointer, between commits; commits keep their own hover.
  const hoverBranch=(clientX:number,clientY:number,target:EventTarget)=>{
    if(!light||(target as HTMLElement).closest('button')){setBranchKey('');return;}
    const v=view();if(!v)return;
    setBranchKey(branchAt(light,{scale,ox:v.ox,oy:v.oy},clientX-v.box.left,clientY-v.box.top)?.key??'');
  };
  const placed=light?.nodes??ribbons!.nodes;
  const zoomStep=1.4;
  return <div className="thread-graph">
    <div className="thread-controls">{focused?<BranchChip branch={focused} byHash={byHash} selected={selected} step={step} clear={()=>setPinnedKey('')}/>:<span className="thread-title" title={lit?'Time runs left to right. Light gathers where history runs together; the primary line is the widest strand and a branch thickens with each commit, up to half of it. Click a branch to focus it.':'One shared mixed-color treatment; primary history is thicker. Width reflects loaded branch-segment commits only.'}>{primary?.name??'Primary'} timeline</span>}<div className="thread-zoom" role="group" aria-label="Git graph view"><button aria-label="Zoom out Git graph" title="Zoom out ( − )" onClick={()=>zoomAt(1/zoomStep)} disabled={scale<=MIN_SCALE+1e-4}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7"/></svg></button><output aria-label="Zoom level">{Math.round(scale*100)}%</output><button aria-label="Zoom in Git graph" title="Zoom in ( + )" onClick={()=>zoomAt(zoomStep)} disabled={scale>=MAX_SCALE-1e-4}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7M6 2.5v7"/></svg></button>{!lit&&<button aria-label="Orbit 3D Git ribbon" title="Toggle orbit, then drag vertically or use Up/Down arrows in the graph" aria-pressed={orbit} onClick={()=>setOrbit(value=>!value)}>3D</button>}<button aria-label="Fit graph" title="Fit the whole graph" onClick={()=>{setAngle(.35);fit();}}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4.5V2h2.5M7.5 2H10v2.5M10 7.5V10H7.5M4.5 10H2V7.5"/></svg></button></div></div>
    <div className={`thread-stage${lit?' lit':''}`}><canvas ref={canvas} className="thread-light" aria-hidden="true"/>
    <div className={`thread-viewport atlas-commit-list${branch?' on-branch':''}`} ref={viewport} tabIndex={0} aria-label={orbit&&!lit?"Commits; drag vertically or use Up and Down arrows to orbit 3D ribbon":"Commits, oldest on the left; drag to pan, pinch or Ctrl + wheel to zoom"} onScroll={event=>{const el=event.currentTarget;if(lit)schedule();if(loading||el.scrollWidth<=el.clientWidth+4)return;if(el.scrollLeft<30&&moreOlder)extend('older');else if(el.scrollLeft+el.clientWidth>el.scrollWidth-30&&moreNewer)extend('newer');}} onPointerDown={event=>{
      if(event.button!==0||(event.target as HTMLElement).closest('button'))return;
      const el=event.currentTarget;drag.current={x:event.clientX,y:event.clientY,left:el.scrollLeft,top:el.scrollTop,id:event.pointerId,angle,moved:false};el.setPointerCapture(event.pointerId);
    }} onPointerMove={event=>{const state=drag.current;if(state&&state.id===event.pointerId){if(Math.hypot(event.clientX-state.x,event.clientY-state.y)>4)state.moved=true;if(orbit&&!lit)setAngle(state.angle+(event.clientY-state.y)*.01);else {event.currentTarget.scrollLeft=state.left+state.x-event.clientX;event.currentTarget.scrollTop=state.top+state.y-event.clientY;}}else if(event.pointerType!=='touch')hoverBranch(event.clientX,event.clientY,event.target);}} onPointerLeave={()=>setBranchKey('')} onPointerUp={event=>{const state=drag.current;if(state&&!orbit){const dx=state.x-event.clientX;if(dx<0&&event.currentTarget.scrollLeft<40&&moreOlder&&!loading)extend('older');else if(dx>0&&event.currentTarget.scrollLeft+event.currentTarget.clientWidth>event.currentTarget.scrollWidth-40&&moreNewer&&!loading)extend('newer');}
      // A click on a strand (not a drag) opens that branch's newest commit.
      if(state&&!state.moved&&light){const v=view();const hitBranch=v&&branchAt(light,{scale,ox:v.ox,oy:v.oy},event.clientX-v.box.left,event.clientY-v.box.top);if(hitBranch)setPinnedKey(value=>value===hitBranch.key?'':hitBranch.key);else if(pinnedKey)setPinnedKey('');}
      drag.current=undefined;}} onPointerCancel={()=>{drag.current=undefined;}} onKeyDown={event=>{
      if(orbit&&!lit&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();setAngle(value=>value+(event.key==='ArrowUp'?-.12:.12));return;}
      if(event.key==='PageUp'&&moreOlder){event.preventDefault();extend('older');return;}if(event.key==='PageDown'&&moreNewer){event.preventDefault();extend('newer');return;}
      if((event.key==='+'||event.key==='=')&&!event.ctrlKey&&!event.metaKey){event.preventDefault();zoomAt(zoomStep);return;}if(event.key==='-'&&!event.ctrlKey&&!event.metaKey){event.preventDefault();zoomAt(1/zoomStep);return;}
      if((event.key==='b'||event.key==='B')&&!event.altKey&&!event.ctrlKey&&!event.metaKey){const hash=(event.target as HTMLElement).closest<HTMLElement>('[data-commit-hash]')?.dataset.commitHash,found=hash?light?.branchOf.get(hash):undefined;if(found){event.preventDefault();setPinnedKey(value=>value===found.key?'':found.key);}return;}
      if(!['ArrowRight','ArrowLeft','Home','End','Escape'].includes(event.key))return;
      if(event.key==='Escape'){if(pinnedKey||branchKey||hovered){event.stopPropagation();event.preventDefault();}setHovered('');setBranchKey('');setPinnedKey('');return;}if(event.altKey||event.ctrlKey||event.metaKey)return;
      const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('.thread-commit')];const index=buttons.indexOf(event.target as HTMLButtonElement);
      if(!buttons.length)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+(event.key==='ArrowLeft'?1:-1)));buttons[next]?.focus();
    }}>
      <div className="thread-space" style={{width:(inset.x??24)+graph.width*scale+24+(inset.padX??0),height:(inset.y??24)+worldHeight*scale+24+(inset.padY??0)}}><div ref={world} className="thread-world" style={{width:graph.width,height:worldHeight,left:inset.x!==undefined?inset.x:`max(24px,calc(50% - ${graph.width*scale/2}px))`,top:inset.y!==undefined?inset.y:`max(24px,calc(50% - ${worldHeight*scale/2}px))`,transform:`scale(${scale})`}}>
        {ribbons&&<svg className="thread-links" width={graph.width} height={graph.height} aria-hidden="true">
          <defs><linearGradient id={gradient} x1="0" y1="0" x2={graph.width} y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#9e81ff"/><stop offset=".24" stopColor="#65dfff"/><stop offset=".48" stopColor="#e0faff"/><stop offset=".7" stopColor="#ae8fff"/><stop offset=".86" stopColor="#ffade9"/><stop offset="1" stopColor="#6be5ff"/></linearGradient></defs>
          {ribbons.pieces.map(piece=>{const edge=piece.edge;return <g key={piece.key} data-depth={piece.depth.toFixed(2)} className={`thread-bundle${active&&!neighbors.has(edge.from)?' muted':''}${selected===edge.to||hovered===edge.to?' active':''}`}>
            <path data-parent={edge.from} data-child={edge.to} style={{fill:`url(#${gradient})`,stroke:`url(#${gradient})`,strokeWidth:0}} className="thread-ribbon" d={piece.surface}/>
            {piece.bands.map((band,index)=><path key={index} d={band.path} className="ribbon-lamina" style={{fill:ribbonColors[band.color],opacity:band.shade}}/>)}
          </g>;})}
        </svg>}
        {placed.map(node=>{const commit=byHash.get(node.hash)!;return <button key={node.hash} className={`thread-commit atlas-commit${node.primary?' thread-primary':''}`} data-commit-hash={node.hash} style={{left:node.x,top:node.y,width:hit,height:hit,margin:`-${hit/2}px 0 0 -${hit/2}px`,transform:`scale(${1/scale})`}} aria-pressed={selected===node.hash} aria-label={`${commit.subject||'Untitled commit'} · ${node.hash.slice(0,8)}`} onPointerEnter={()=>{setHovered(node.hash);setBranchKey('');}} onPointerLeave={()=>setHovered(current=>current===node.hash?'':current)} onFocus={()=>setHovered(node.hash)} onBlur={()=>setHovered('')} onClick={()=>choose(node.hash)}><i aria-hidden="true" style={{width:Math.min(scale<.35?3:6,hit),height:Math.min(scale<.35?3:6,hit),border:0}}/>{!!commit.labels.length&&(scale>=.45||node.hash===hovered||node.hash===selected||light?.branchOf.get(node.hash)?.key===branchKey)&&<span className={`thread-label${(light?.branchOf.get(node.hash)?.side??-1)>0?' below':''}`} style={node.x>graph.width-160?{left:'auto',right:0,transform:'none'}:undefined}>{commit.labels[0]}{commit.omittedLabels+commit.labels.length>1&&<small> +{commit.omittedLabels+commit.labels.length-1}</small>}</span>}</button>;})}
      </div></div>
    </div></div>
    {active&&<div className="thread-peek" role="status"><code>{active.hash.slice(0,10)}</code><strong>{active.subject||'Untitled commit'}</strong><span>{active.author} · {new Date(active.time).toLocaleString()}</span><span>{active.parents.length>1?`Merge · ${active.parents.length} parents`:active.parents.length?'Commit':'Root commit'}{active.labels.length?` · ${active.labels.join(', ')}`:''}{light?.branchOf.has(active.hash)?` · commit ${light.ordinal.get(active.hash)} of ${light.branchOf.get(active.hash)!.members.length} on its branch`:''}</span>{links?.get(active.hash)&&<span className="thread-session-link">{gitSessionLinkDescription(links.get(active.hash)!)}{links.get(active.hash)!.turn?` · turn ${links.get(active.hash)!.turn}`:''}</span>}<small>Click or Enter to read changed files</small></div>}
    {branch&&<BranchPeek branch={branch} byHash={byHash} primary={primary?.name} focused={branch.key===pinnedKey&&!branchKey&&!refBranch} open={()=>choose(branch.head)}/>}
    <div className="thread-caption"><select aria-label="Choose Git commit" value="" onChange={event=>{if(event.target.value)choose(event.target.value);}}><option value="">Open a commit…</option>{commits.map(commit=><option key={commit.hash} value={commit.hash}>{commit.hash.slice(0,8)} · {commit.subject}</option>)}</select><span className="thread-status">{loading?'Loading connected history…':moreOlder?'Scroll left or Page Up for earlier history':'Start of local history'}{moreNewer?' · scroll right for newer history':''}{!graph.primaryFound&&primary?' · primary line outside this loaded neighborhood':''}{graph.omitted?` · ${graph.omitted} additional links: open a commit for its complete parents`:''}</span><span className="sr-only">Up to 300 commit nodes are mounted. Other history remains reachable by scrolling.</span></div>
  </div>;
}

/** What a branch strand is, from Git alone: its name if a ref names its head, where it left and rejoined, and its commits. */
export function BranchPeek({branch,byHash,primary,focused,open}:{branch:LightBranch;byHash:Map<string,GitCommit>;primary?:string;focused?:boolean;open?:()=>void}) {
  const commits=branch.members.map(hash=>byHash.get(hash)).filter((commit):commit is GitCommit=>!!commit);
  const head=byHash.get(branch.head),fork=branch.fork?byHash.get(branch.fork):undefined,merge=branch.merge?byHash.get(branch.merge):undefined;
  const authors=[...new Set(commits.map(commit=>commit.author))];
  const first=commits[0],name=head?.labels[0];
  return <div className={`thread-peek thread-branch-peek${focused?' interactive':''}`} role="status">
    <code>{name??'Unnamed branch'}{head&&head.labels.length+head.omittedLabels>1?` +${head.labels.length+head.omittedLabels-1}`:''}</code>
    <strong>{commits.length} {commits.length===1?'commit':'commits'} · {merge?`${branch.squash?'squash-merged':'merged'} into ${primary??'the primary line'} at ${merge.hash.slice(0,7)}`:'not merged in this history'}</strong>
    <span>{authors.slice(0,3).join(', ')}{authors.length>3?` +${authors.length-3}`:''}{first&&head?` · ${ago(first.time)} → ${ago(head.time)}`:''}{fork?` · left ${fork.hash.slice(0,7)}`:''}</span>
    {branch.squash&&merge&&<span>Git has no merge link: {merge.hash.slice(0,7)} “{merge.subject}” wrote exactly this branch’s file contents.</span>}
    <ol>{[...commits].reverse().slice(0,5).map(commit=><li key={commit.hash}><code>{commit.hash.slice(0,7)}</code>{commit.subject||'Untitled commit'}</li>)}{commits.length>5&&<li className="more">{commits.length-5} earlier</li>}</ol>
    {focused?<button type="button" className="btn ghost" onClick={open}>Open newest commit</button>:<small>Click the strand to focus this branch</small>}
  </div>;
}

/** The focused branch, with previous and next along its commits and a way out. The name is the ref that points at its head, when one does. */
export function BranchChip({branch,byHash,selected,step,clear}:{branch:LightBranch;byHash:Map<string,GitCommit>;selected:string;step:(direction:1|-1)=>void;clear:()=>void}) {
  const head=byHash.get(branch.head),name=head?.labels[0]??'Unnamed branch',at=branch.members.indexOf(selected);
  return <div className="thread-branch-chip" role="group" aria-label={`Focused branch ${name}`} onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();clear();}}}>
    <code title={name}>{name}</code>
    <small>{at>=0?`${at+1} of ${branch.members.length}`:`${branch.members.length} ${branch.members.length===1?'commit':'commits'}`}</small>
    <button type="button" aria-label="Previous commit on this branch" title="Previous commit on this branch" onClick={()=>step(-1)}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2.5 4 6l3.5 3.5"/></svg></button>
    <button type="button" aria-label="Next commit on this branch" title="Next commit on this branch" onClick={()=>step(1)}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5 8 6 4.5 9.5"/></svg></button>
    <button type="button" aria-label="Clear branch focus" title="Clear focus ( Esc )" onClick={clear}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9"/></svg></button>
  </div>;
}
