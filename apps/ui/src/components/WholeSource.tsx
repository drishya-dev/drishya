import {useEffect,useLayoutEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {Highlighted,langOf} from '../lib/highlight.tsx';

/** Complete current text, with only the visible source rows mounted. */
export function WholeSource({text,path,viewport,wrap,activeLine,revealLine,revealRequest,matches}:{text:string;path:string;viewport:RefObject<HTMLDivElement|null>;wrap:boolean;activeLine?:number;revealLine?:number;revealRequest?:number;matches?:Set<number>}) {
  const lines=useMemo(()=>text.split('\n'),[text]),lang=langOf(path);
  const [size,setSize]=useState({top:0,height:600,width:800}),[revision,measure]=useState(0);
  const measured=useRef(new Map<number,number>()),root=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{measured.current.clear();measure(n=>n+1);},[text,path,wrap,size.width]);
  // This viewport belongs to our parent; its ref attaches after child layout effects.
  useEffect(()=>{
    const node=viewport.current;if(!node)return;
    const read=()=>setSize(old=>{const next={top:node.scrollTop,height:node.clientHeight,width:node.clientWidth};return old.top===next.top&&old.height===next.height&&old.width===next.width?old:next;});
    const observer=new ResizeObserver(read);observer.observe(node);node.addEventListener('scroll',read,{passive:true});read();
    return()=>{observer.disconnect();node.removeEventListener('scroll',read);};
  },[viewport]);
  const offsets=useMemo(()=>{
    const values=new Float64Array(lines.length+1),columns=Math.max(10,Math.floor((size.width-80)/7.2));
    for(let i=0;i<lines.length;i++)values[i+1]=values[i]!+(measured.current.get(i)??22*(wrap?Math.max(1,Math.ceil(lines[i]!.replace(/\t/g,'  ').length/columns)):1));
    return values;
  },[lines,wrap,size.width,revision]);
  const locate=(top:number)=>{let lo=0,hi=lines.length;while(lo<hi){const mid=(lo+hi)>>>1;if(offsets[mid]!<top)lo=mid+1;else hi=mid;}return Math.max(0,lo-1);};
  const first=Math.max(0,locate(size.top)-12),last=Math.min(lines.length,locate(size.top+size.height)+14);
  useLayoutEffect(()=>{
    if(revealLine===undefined||!viewport.current)return;
    const index=Math.max(0,Math.min(lines.length-1,revealLine-1));
    viewport.current.scrollTop=Math.max(0,offsets[index]!-viewport.current.clientHeight/3);
    viewport.current.dispatchEvent(new Event('scroll'));
  },[revealLine,revealRequest,text,path]);
  useLayoutEffect(()=>{
    const node=root.current;if(!node)return;
    const observer=new ResizeObserver(entries=>{let changed=false;for(const entry of entries){const index=Number((entry.target as HTMLElement).dataset.index),height=entry.target.getBoundingClientRect().height;if(height>0&&Math.abs((measured.current.get(index)??0)-height)>.5){measured.current.set(index,height);changed=true;}}if(changed)measure(n=>n+1);});
    for(const row of node.querySelectorAll('[data-index]'))observer.observe(row);
    return()=>observer.disconnect();
  },[first,last,lines,wrap]);
  return <div ref={root} className={`code whole-source${wrap?' whole-source-wrap':''}`} role="region" aria-label={`Content of ${path}`} style={{minHeight:offsets[lines.length]}}>
    <div style={{height:offsets[first]}} aria-hidden="true"/>
    {lines.slice(first,last).map((line,n)=>{const number=first+n+1;return <div key={number} data-index={number-1} data-source-line={number} aria-current={activeLine===number?'location':undefined} className={`ln${matches?.has(number)?' ln-hi':''}${activeLine===number?' ln-current':''}`}><span className="ln-no">{number}</span><span className="ln-tx"><Highlighted line={line} lang={lang}/></span></div>;})}
    <div style={{height:Math.max(0,offsets[lines.length]!-offsets[last]!)}} aria-hidden="true"/>
  </div>;
}
