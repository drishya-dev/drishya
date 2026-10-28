import {useEffect,useRef} from 'react';
import type {GitCommit,GitSessionLink} from '../../../daemon/src/git-types.ts';
import {gitSessionLinkDescription} from '../../../daemon/src/git-types.ts';
import {ago} from '../lib/git-commit-rows.ts';
import './commit-rows.css';

/** One compact row per loaded commit, newest first. Selection and hover mirror the timeline both ways. */
export function CommitRows({commits,selected,hovered,choose,hover,links}:{links?:Map<string,GitSessionLink>;commits:GitCommit[];selected:string;hovered:string;choose:(hash:string)=>void;hover:(hash:string)=>void}) {
  const list=useRef<HTMLDivElement>(null);
  // Keep the picked row in view inside this list only; the graph or the dialog never scrolls because of it.
  useEffect(()=>{
    const el=list.current,row=selected?el?.querySelector<HTMLElement>(`[data-row-hash="${selected}"]`):null;if(!el||!row)return;
    const top=row.offsetTop,bottom=top+row.offsetHeight;
    if(top<el.scrollTop)el.scrollTop=top-8;else if(bottom>el.scrollTop+el.clientHeight)el.scrollTop=bottom-el.clientHeight+8;
  },[selected]);
  return <div className="commit-rows" ref={list} role="group" aria-label="Commits, newest first">
    {commits.map(commit=>{
      const shown=commit.labels.slice(0,2),more=commit.labels.length-shown.length+commit.omittedLabels;
      return <button key={commit.hash} className="commit-row" data-row-hash={commit.hash} data-hover={hovered===commit.hash||undefined} aria-pressed={selected===commit.hash} onClick={()=>choose(commit.hash)} onPointerEnter={()=>hover(commit.hash)} onPointerLeave={()=>hover('')} onFocus={()=>hover(commit.hash)} onBlur={()=>hover('')}>
        <code>{commit.hash.slice(0,7)}</code>
        <strong title={commit.subject}>{commit.subject||'Untitled commit'}</strong>
        <span className="commit-row-refs">{shown.map(label=><em key={label} title={label}>{label}</em>)}{more>0&&<small>+{more}</small>}</span>
        <span className="commit-row-turn" title={links?.get(commit.hash)?gitSessionLinkDescription(links.get(commit.hash)!):undefined}>{links?.get(commit.hash)?links.get(commit.hash)!.turn?`turn ${links.get(commit.hash)!.turn}`:'session':''}</span>
        <span className="commit-row-author" title={commit.author}>{commit.author}</span>
        <time dateTime={commit.time} title={new Date(commit.time).toLocaleString()}>{ago(commit.time)}</time>
      </button>;
    })}
  </div>;
}
