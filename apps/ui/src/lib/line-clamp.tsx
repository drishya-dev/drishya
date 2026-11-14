import {useLayoutEffect,useRef,type CSSProperties,type ReactNode} from 'react';
import '../components/card-content.css';

/** The visual lines of a block, top to bottom, from the real layout of its text: one entry per line box, merged where
 * fragments of one line (a token span, a key beside its value) overlap vertically. Empty text nodes have no box and add nothing. */
export function visualLines(root:HTMLElement,visibleOnly=false):{top:number;bottom:number}[] {
  const range=document.createRange(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),boxes:{top:number;bottom:number}[]=[];
  for(let node=walker.nextNode();node;node=walker.nextNode()){
    if(!(node as Text).data.trim())continue;
    const parent=(node as Text).parentElement;
    let clip:DOMRect|undefined;
    if(visibleOnly){
      // Not lines a reader sees: the floating reading chips, text inside a closed <details>, and text a whole-line clamp hides.
      if(parent?.closest('.captured-result-views'))continue;
      const closed=parent?.closest('details');
      if(closed&&!closed.open&&!parent?.closest('summary'))continue;
      clip=parent?.closest<HTMLElement>('.line-clamp[data-clamped]')?.getBoundingClientRect();
    }
    range.selectNodeContents(node);
    for(const rect of range.getClientRects())if(rect.height>0&&rect.width>0&&(!clip||(rect.top<clip.bottom-1&&rect.bottom>clip.top+1)))boxes.push({top:rect.top,bottom:rect.bottom});
  }
  boxes.sort((a,b)=>a.top-b.top||a.bottom-b.bottom);
  const lines:{top:number;bottom:number}[]=[];
  for(const box of boxes){
    const last=lines.at(-1);
    if(last&&box.top<last.bottom-1)last.bottom=Math.max(last.bottom,box.bottom);else lines.push({...box});
  }
  return lines;
}

/**
 * UI-46: a collapsed preview that ends on a whole line. The first `lines` visual lines show in full; if there is more, the box
 * is cut exactly at the bottom of the last of them and that line fades, so no half line ever peeks out. The height comes from
 * measuring the real layout (wrapping included), not from a pixel guess, and follows the width. Expanding the card shows all.
 */
export function LineClamp({lines,tail=false,className,style,children}:{lines:number;tail?:boolean;className?:string;style?:CSSProperties;children:ReactNode}) {
  const outer=useRef<HTMLDivElement>(null),inner=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const box=outer.current,content=inner.current;
    if(!box||!content)return;
    const measure=()=>{
      const found=visualLines(content);
      if(found.length<=lines){box.removeAttribute('data-clamped');return;}
      const rect=content.getBoundingClientRect(),base=rect.top;
      // The cut falls between two lines, halfway through the leading between them (a text box is shorter than its line box),
      // which is the line-box boundary. From the start by default; with `tail`, the last lines (the end of an output, where its verdict is).
      const between=(upper:{bottom:number},lower:{top:number})=>(upper.bottom+lower.top)/2;
      const top=tail?between(found[found.length-lines-1]!,found[found.length-lines]!):base;
      const bottom=tail?rect.bottom:between(found[lines-1]!,found[lines]!);
      const edge=tail?found[found.length-lines]!:found[lines-1]!;
      box.style.setProperty('--clamp-height',`${Math.round(bottom-top)}px`);
      box.style.setProperty('--clamp-offset',`${Math.round(top-base)}px`);
      box.style.setProperty('--clamp-fade',`${Math.round(edge.bottom-edge.top)}px`);
      box.setAttribute('data-clamped','');
    };
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(content);
    return()=>observer.disconnect();
  });
  return <div ref={outer} className={`line-clamp${className?` ${className}`:''}`} data-from={tail?'end':undefined} style={style}><div ref={inner} className="line-clamp-body">{children}</div></div>;
}
