import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface PromptChapter { id: string; label: string; index: number; time?:string }
const ROW = 16;

/** All chapters are addressable; only the visible rail rows enter the DOM. */
export function PromptRail({ chapters, activeId, open }: { chapters: PromptChapter[]; activeId?: string; open: (chapter: PromptChapter) => void }) {
  const rail = useRef<HTMLElement>(null);
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
      const bounds=node.getBoundingClientRect();let top=16,bottom=48;
      for(const control of controls) {
        const r=control.getBoundingClientRect();
        if(!r.width||!r.height||r.right<=bounds.left||r.left>=bounds.right) continue;
        if(control.matches('.prompt-composer')) {if(control.matches('.open'))bottom=Math.max(bottom,innerHeight-r.top+12);}
        else if(control.matches('.catalog-toggle,.workspace-follow,.follow-pill')) bottom=Math.max(bottom,innerHeight-r.top+12);
        else top=Math.max(top,r.bottom+14);
      }
      node.style.setProperty('--prompt-rail-bottom',`${bottom}px`);
      node.style.setProperty('--prompt-rail-max-height',`${Math.max(0,innerHeight-top-bottom)}px`);
      setViewport(old=>old.top===node.scrollTop&&old.height===node.clientHeight?old:{top:node.scrollTop,height:node.clientHeight});
    };
    observer = new ResizeObserver(measure);observer.observe(node);measure();
    const changes=new MutationObserver(measure);if(viewer)changes.observe(viewer,{childList:true,attributes:true,attributeFilter:['class']});
    window.addEventListener('resize',measure);
    return () => {observer.disconnect();changes.disconnect();window.removeEventListener('resize',measure);};
  }, []);
  useLayoutEffect(() => {
    const node = rail.current;
    if (!node || hovering.current || node.contains(document.activeElement)) return;
    node.scrollTop = Math.max(0, active * ROW - node.clientHeight / 2 + ROW / 2);
    setViewport({ top: node.scrollTop, height: node.clientHeight });
  }, [active, chapters.length]);
  const first = Math.max(0, Math.floor(viewport.top / ROW) - 2);
  const end = Math.min(chapters.length, Math.ceil((viewport.top + viewport.height) / ROW) + 2);
  const nearest = preview?.ordinal ?? active;
  const show = (ordinal: number, node: HTMLElement) => {
    const r = node.getBoundingClientRect();
    setPreview({ ordinal, top: Math.max(80, Math.min(innerHeight - 150, r.top)), left: Math.max(8, r.left - 274) });
  };
  return <>
    <nav ref={rail} tabIndex={0} className="history-prompt-marks complete-prompt-rail" aria-label="Prompt positions in history" style={{ height: chapters.length * ROW }} onKeyDown={e => {
      if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const current = Number((e.target as HTMLElement).closest<HTMLElement>('[data-prompt-ordinal]')?.dataset.promptOrdinal ?? active + 1) - 1;
      const stride = Math.max(1, Math.floor(e.currentTarget.clientHeight / ROW));
      const next = Math.max(0, Math.min(chapters.length - 1, e.key === 'Home' ? 0 : e.key === 'End' ? chapters.length - 1 : current + (e.key.endsWith('Up') ? -1 : 1) * (e.key.startsWith('Page') ? stride : 1)));
      e.currentTarget.scrollTop = Math.max(0, next * ROW - e.currentTarget.clientHeight / 2);
      setViewport({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight });
      requestAnimationFrame(() => rail.current?.querySelector<HTMLButtonElement>(`[data-prompt-ordinal="${next + 1}"]`)?.focus());
    }} onPointerEnter={() => { hovering.current = true; }} onPointerLeave={() => { hovering.current = false; setPreview(undefined); }} onScroll={e => { setViewport({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight }); setPreview(undefined); }}>
      <div style={{ height: chapters.length * ROW, position: 'relative' }}>
        {chapters.slice(first, end).map((chapter, offset) => {
          const ordinal = first + offset;
          return <button key={chapter.id} style={{ position: 'absolute', top: ordinal * ROW }} data-prompt-ordinal={ordinal + 1} data-proximity={ordinal === nearest ? 'current' : Math.abs(ordinal - nearest) === 1 ? 'near' : 'normal'} aria-label={`Go to prompt: ${chapter.label}`} aria-current={chapter.id === activeId ? 'location' : undefined} onMouseEnter={e => show(ordinal, e.currentTarget)} onFocus={e => show(ordinal, e.currentTarget)} onBlur={() => setPreview(undefined)} onClick={() => open(chapter)}><span className="prompt-rail-tick" aria-hidden="true" /></button>;
        })}
      </div>
    </nav>
    {preview && chapters[preview.ordinal] && createPortal(<div className="prompt-rail-preview" style={{ position: 'fixed', top: preview.top, left: preview.left, right: 'auto', opacity: 1, visibility: 'visible', transform: 'none', zIndex: 80 }}><small>Prompt {preview.ordinal + 1} of {chapters.length}</small>{chapters[preview.ordinal]!.time&&<time dateTime={chapters[preview.ordinal]!.time}>{new Date(chapters[preview.ordinal]!.time!).toLocaleString()}</time>}<span>{chapters[preview.ordinal]!.label}</span></div>, document.body)}
  </>;
}
