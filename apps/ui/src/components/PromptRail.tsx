import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {useTurns} from '../lib/turns-store.ts';
import {ledgerBasis,ledgerParts} from '../lib/turn-ledger.ts';
import './prompt-rail-evidence.css';

export interface PromptChapter { id: string; label: string; index: number; time?:string; turnStep?:number }
const ROW = 16;

/** All chapters are addressable; only the visible rail rows enter the DOM. */
export function PromptRail({ chapters, activeId, open }: { chapters: PromptChapter[]; activeId?: string; open: (chapter: PromptChapter) => void }) {
  const ledgers=useTurns(s=>s.byStep);
  const rail = useRef<HTMLElement>(null);
  const pendingFocus = useRef<number|undefined>(undefined);
  const hovering = useRef(false);
  const [viewport, setViewport] = useState({ top: 0, height: 400 });
  const [preview, setPreview] = useState<{ ordinal: number; top: number; left: number }>();
  const active = Math.max(0, chapters.findIndex(c => c.id === activeId));
  useLayoutEffect(() => {
    const node = rail.current;
    if (!node) return;
    const viewer=node.closest('.viewer')??document.querySelector('.viewer');
    const observed=new Set<Element>();let observer:ResizeObserver;
    const measure = () => {
      const controls=[...(viewer??document).querySelectorAll<HTMLElement>('.workspace-header,.workspace-leading,.workspace-secondary,.prompt-composer,.catalog-toggle,.workspace-follow,.follow-pill')];
      for(const control of controls) if(!observed.has(control)){observer.observe(control);observed.add(control);}
      const bounds=node.getBoundingClientRect();let top=16,bottom=58;
      for(const control of controls) {
        const r=control.getBoundingClientRect();
        // The composer is judged by its open width, whether it is open or collapsed to the pill, so the rail never moves when it toggles.
        const openWidth=Math.min(590,innerWidth-28),openLeft=(innerWidth-openWidth)/2;
        const overlaps=control.matches('.prompt-composer')?bounds.left<openLeft+openWidth&&bounds.right>openLeft:!(r.right<=bounds.left||r.left>=bounds.right);
        if(!r.width||!r.height||!overlaps) continue;
        if(control.matches('.prompt-composer')) {
          // UI-28b/28c: the rail clears the composer at rest (its fixed --composer-rest above its bottom edge), whether the box is open,
          // collapsed to the pill or grown by a long prompt, so the rail never moves with it.
          const rest=(parseFloat(getComputedStyle(viewer??document.documentElement).getPropertyValue('--composer-gap'))||158)-24; // the gap is written in px by SessionWorkspace
          if(control.matches('.open'))bottom=Math.max(bottom,innerHeight-r.bottom+rest+12);
        }
        else if(control.matches('.catalog-toggle,.workspace-follow,.follow-pill')) bottom=Math.max(bottom,innerHeight-r.top+12);
        else top=Math.max(top,r.bottom+14);
      }
      node.style.setProperty('--prompt-rail-bottom',`${bottom}px`);
      node.style.setProperty('--prompt-rail-max-height',`${Math.max(0,innerHeight-top-bottom)}px`);
      setViewport(old=>old.top===node.scrollTop&&old.height===node.clientHeight?old:{top:node.scrollTop,height:node.clientHeight});
    };
    observer = new ResizeObserver(measure);observer.observe(node);measure();
    const changes=new MutationObserver(measure);if(viewer)changes.observe(viewer,{childList:true,attributes:true,attributeFilter:['class','style']});
    window.addEventListener('resize',measure);
    return () => {observer.disconnect();changes.disconnect();window.removeEventListener('resize',measure);};
  }, []);
  useLayoutEffect(() => {
    const node = rail.current;
    // Virtualizing the requested row briefly removes the old focused button.
    // An active-chapter update in that commit must not steal the pending key request.
    if (!node || pendingFocus.current !== undefined || hovering.current || node.contains(document.activeElement)) return;
    node.scrollTop = Math.max(0, active * ROW - node.clientHeight / 2 + ROW / 2);
    setViewport({ top: node.scrollTop, height: node.clientHeight });
  }, [active, chapters.length]);
  const first = Math.max(0, Math.floor(viewport.top / ROW) - 2);
  const end = Math.min(chapters.length, Math.ceil((viewport.top + viewport.height) / ROW) + 2);
  useLayoutEffect(()=>{
    if(pendingFocus.current===undefined)return;
    const target=rail.current?.querySelector<HTMLButtonElement>(`[data-prompt-ordinal="${pendingFocus.current+1}"]`);
    // A frame callback can run before React commits a newly virtualized row under load.
    if(target){pendingFocus.current=undefined;target.focus({preventScroll:true});}
  },[viewport,chapters]);
  const nearest = preview?.ordinal ?? active;
  const show = (ordinal: number, node: HTMLElement) => {
    const r = node.getBoundingClientRect();
    setPreview({ ordinal, top: Math.max(12, Math.min(innerHeight - 320, r.top)), left: Math.max(8, r.left - Math.min(300,innerWidth - 24) - 14) });
  };
  const previewChapter=preview&&chapters[preview.ordinal];
  const previewLedger=previewChapter?.turnStep===undefined?undefined:ledgers.get(previewChapter.turnStep);
  return <>
    <nav ref={rail} tabIndex={0} className="history-prompt-marks complete-prompt-rail turn-evidence-rail" aria-label="Prompt positions in history" style={{ height: chapters.length * ROW }} onKeyDown={e => {
      if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const current = Number((e.target as HTMLElement).closest<HTMLElement>('[data-prompt-ordinal]')?.dataset.promptOrdinal ?? active + 1) - 1;
      const stride = Math.max(1, Math.floor(e.currentTarget.clientHeight / ROW));
      const next = Math.max(0, Math.min(chapters.length - 1, e.key === 'Home' ? 0 : e.key === 'End' ? chapters.length - 1 : current + (e.key.endsWith('Up') ? -1 : 1) * (e.key.startsWith('Page') ? stride : 1)));
      e.currentTarget.scrollTop = Math.max(0, next * ROW - e.currentTarget.clientHeight / 2);
      pendingFocus.current=next;
      setViewport({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight });
    }} onPointerEnter={() => { hovering.current = true; }} onPointerLeave={() => { hovering.current = false; setPreview(undefined); }} onScroll={e => { setViewport({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight }); setPreview(undefined); }}>
      <div style={{ height: chapters.length * ROW, position: 'relative' }}>
        {chapters.slice(first, end).map((chapter, offset) => {
          const ordinal = first + offset;
          const ledger=chapter.turnStep===undefined?undefined:ledgers.get(chapter.turnStep);
          const description=ledger?`${ledger.operations} operations${ledger.open?`, ${ledger.open} awaiting results`:''}. ${ledgerParts(ledger).map(p=>p.text).join(', ')}`:undefined;
          return <button key={chapter.id} style={{ position: 'absolute', top: ordinal * ROW } as CSSProperties} data-turn-step={chapter.turnStep} data-operation-count={ledger?.operations} aria-description={description} data-prompt-ordinal={ordinal + 1} data-proximity={ordinal === nearest ? 'current' : Math.abs(ordinal - nearest) === 1 ? 'near' : 'normal'} aria-label={`Go to prompt: ${chapter.label}`} aria-current={chapter.id === activeId ? 'location' : undefined} onMouseEnter={e => show(ordinal, e.currentTarget)} onFocus={e => show(ordinal, e.currentTarget)} onBlur={() => setPreview(undefined)} onClick={() => open(chapter)}><span className="prompt-rail-tick" aria-hidden="true" /></button>;
        })}
      </div>
    </nav>
    {preview && chapters[preview.ordinal] && createPortal(<div className="prompt-rail-preview prompt-evidence-preview" style={{ position: 'fixed', top: preview.top, left: preview.left, right: 'auto', opacity: 1, visibility: 'visible', transform: 'none', zIndex: 80 }}><small>Prompt {preview.ordinal + 1} of {chapters.length}</small>{chapters[preview.ordinal]!.time&&<time dateTime={chapters[preview.ordinal]!.time}>{new Date(chapters[preview.ordinal]!.time!).toLocaleString()}</time>}<span>{chapters[preview.ordinal]!.label}</span>{previewLedger&&<div className="prompt-rail-ledger" title={ledgerBasis(previewLedger)}><small>{previewLedger.operations} captured operations{previewLedger.open?` · ${previewLedger.open} awaiting results`:null}</small>{ledgerParts(previewLedger).map((part,index)=><span key={index} className={part.tone}>{part.text}</span>)}</div>}</div>, document.body)}
  </>;
}
