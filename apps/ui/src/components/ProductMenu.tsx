import {useSurfacePresence} from '../lib/surface-motion.ts';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Operation} from '@drishya/contracts';
import {useApp} from '../state.ts';
import {FileReadingActions} from './FileReadingActions.tsx';
import {copyCardMaterial} from './ReadingKeys.tsx';
import './product-menu.css';

type Target={kind:'file';path:string;op?:undefined}|{kind:'step';op:Operation;path?:string};
interface Open {target:Target;x:number;y:number;origin:HTMLElement}

// The browser's own menu stays where it is the right one: selected text, a link, anything editable.
const browserMenu=(element:Element)=>!!document.getSelection()?.toString()||!!element.closest('a[href],input,textarea,select,[contenteditable="true"],.cm-editor');
const stepPath=(op:Operation)=>op.paths.find(ref=>ref.role!=='search-hit')?.path??op.paths[0]?.path;

function aim(element:Element):{target:Target;origin:HTMLElement}|undefined {
  const file=element.closest<HTMLElement>('[data-spine-path]');
  if(file?.dataset.spinePath)return {target:{kind:'file',path:file.dataset.spinePath},origin:file};
  const card=element.closest<HTMLElement>('article[data-op-id]');
  const op=card&&useApp.getState().projection?.operations.find(item=>item.id===card.dataset.opId);
  return card&&op?{target:{kind:'step',op,path:stepPath(op)},origin:card}:undefined;
}

export function ProductMenu() {
  const [open,setOpen]=useState<Open>(),[status,setStatus]=useState('');
  const menu=useRef<HTMLDivElement>(null);
  const shown=useSurfacePresence(open,menu,'menu');
  useEffect(()=>{
    const show=(event:MouseEvent)=>{
      const element=event.target instanceof Element?event.target:undefined;
      if(!element||element.closest('.product-menu')||browserMenu(element))return;
      const found=aim(element);if(!found)return;
      event.preventDefault();setStatus('');
      // The menu key reports no pointer position, so the menu opens at the focused row.
      const box=found.origin.getBoundingClientRect();
      setOpen({...found,x:event.clientX||box.left+16,y:event.clientY||box.top+16});
    };
    document.addEventListener('contextmenu',show);
    return()=>document.removeEventListener('contextmenu',show);
  },[]);
  const close=(restore=true)=>{setOpen(old=>{if(restore)old?.origin.focus({preventScroll:true});return undefined;});};
  useLayoutEffect(()=>{
    const node=menu.current;if(!shown||!node)return;
    const box=node.getBoundingClientRect();
    node.style.left=`${Math.max(8,Math.min(shown.x,innerWidth-box.width-8))}px`;
    node.style.top=`${Math.max(8,Math.min(shown.y,innerHeight-box.height-8))}px`;
    const items=[...node.querySelectorAll<HTMLButtonElement>('button')];
    for(const item of items)item.setAttribute('role','menuitem');
    items.find(item=>!item.disabled)?.focus({preventScroll:true});
  },[shown]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:Event)=>{if(!menu.current?.contains(event.target as Node))close(false);};
    document.addEventListener('pointerdown',outside,true);window.addEventListener('blur',outside);window.addEventListener('resize',outside);document.addEventListener('wheel',outside,{capture:true,passive:true});
    return()=>{document.removeEventListener('pointerdown',outside,true);window.removeEventListener('blur',outside);window.removeEventListener('resize',outside);document.removeEventListener('wheel',outside,true);};
  },[open]);
  if(!shown)return null;
  const {target}=shown,state=useApp.getState;
  const run=(action:()=>void)=>()=>{close(false);action();};
  const copyPath=(path:string)=>()=>{void navigator.clipboard.writeText(path).then(()=>{close();},()=>setStatus('Copy unavailable'));};
  const step=target.kind==='step'?target.op:undefined,expanded=step&&state().expandedOp===step.id;
  const move=(event:React.KeyboardEvent)=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    const items=[...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],at=items.indexOf(document.activeElement as HTMLButtonElement);
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(at+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    items[next]?.focus();
  };
  return createPortal(<div ref={menu} className="product-menu" role="menu" aria-label={step?`Actions for ${step.title}`:`Actions for ${target.path}`} style={{left:shown.x,top:shown.y}} onKeyDown={move}>
    {step&&<>
      <button type="button" className="btn ghost" onClick={run(()=>state().set({expandedOp:expanded?undefined:step.id,follow:false}))}>{expanded?'Close':'Expand'}</button>
      <button type="button" className="btn ghost" onClick={run(()=>{state().set({expandedOp:step.id,follow:false});requestAnimationFrame(()=>requestAnimationFrame(()=>{const editor=document.querySelector<HTMLDetailsElement>(`article[data-op-id="${CSS.escape(step.id)}"] .review-question-editor`);if(editor){editor.open=true;editor.querySelector('textarea')?.focus();}}));})}>Add a note</button>
      <button type="button" className="btn ghost" onClick={()=>{copyCardMaterial(document.querySelector(`article[data-op-id="${CSS.escape(step.id)}"]`),message=>{setStatus(message);});close(false);}}>Copy</button>
    </>}
    {target.path&&<><FileReadingActions path={target.path} op={step} explain={false} copyPath={false} onNavigate={()=>close(false)}/><button type="button" className="btn ghost" onClick={copyPath(target.path)}>Copy path</button></>}
    <span role="status">{status}</span>
  </div>,document.body);
}
