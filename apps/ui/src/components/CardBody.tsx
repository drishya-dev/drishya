import {useLayoutEffect,useRef,type ReactNode} from 'react';
import {visualLines} from '../lib/line-clamp.tsx';
import './card-content.css';

/**
 * UI-46: the body of a collapsed card. A card has a fixed height class; when its content is taller, the old layout simply clipped
 * wherever the box ended, often through the middle of a line. Here the body is cut at the last line that fits whole, halfway
 * through the leading below it, and that line fades; nothing past it shows. Expand opens everything. Hover reading lifts the cut.
 */
export function CardBody({children}:{children:ReactNode}) {
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const body=ref.current;
    if(!body)return;
    let frame=0;
    const measure=()=>{
      frame=0;
      body.removeAttribute('data-cut');
      if(body.scrollHeight<=body.clientHeight+1)return;
      const box=body.getBoundingClientRect(),style=getComputedStyle(body);
      // The area a line may occupy: the body's box less the bottom padding that keeps the card's inner rhythm.
      const limit=box.top+body.clientHeight-Math.min(parseFloat(style.paddingBottom)||0,10);
      const lines=visualLines(body,true).filter(l=>l.top>=box.top-1);
      let keep=-1;
      for(let i=0;i<lines.length;i++)if(lines[i]!.bottom<=limit+0.5)keep=i;
      if(keep<0||keep===lines.length-1)return;
      const cut=(lines[keep]!.bottom+lines[keep+1]!.top)/2-box.top;
      body.style.setProperty('--card-cut',`${Math.round(cut)}px`);
      body.style.setProperty('--card-cut-fade',`${Math.round(lines[keep]!.bottom-lines[keep]!.top)}px`);
      body.setAttribute('data-cut','');
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
    measure();
    const resize=new ResizeObserver(schedule),mutations=new MutationObserver(schedule);
    resize.observe(body);
    mutations.observe(body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-clamped']});
    return()=>{resize.disconnect();mutations.disconnect();if(frame)cancelAnimationFrame(frame);};
  });
  return <div ref={ref} className="op-body">{children}</div>;
}
