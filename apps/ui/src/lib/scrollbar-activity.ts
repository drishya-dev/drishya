/** Reveal native scroll thumbs only while used. Never changes scroll geometry. */
export function installScrollbarActivity() {
  const pending=new Map<HTMLElement,ReturnType<typeof setTimeout>>();
  const show=(node:HTMLElement)=>{
    if(node.scrollHeight<=node.clientHeight&&node.scrollWidth<=node.clientWidth)return;
    const timer=pending.get(node);if(timer)clearTimeout(timer);
    node.setAttribute('data-scroll-active','');
    pending.set(node,setTimeout(()=>{node.removeAttribute('data-scroll-active');pending.delete(node);},1200));
  };
  const scroll=(event:Event)=>{if(event.target instanceof HTMLElement)show(event.target);};
  let lastPointer=0;
  const pointer=(event:PointerEvent)=>{
    const now=performance.now();if(now-lastPointer<40)return;lastPointer=now;
    // Edge access reveals the thumb before the user tries to grab it. No animation
    // frames or tree scans on ordinary pointer movement through the canvas.
    if(!(event.target instanceof HTMLElement))return;
    let node:HTMLElement|null=event.target;
    for(let depth=0;node&&depth<5;depth++,node=node.parentElement) {
      const rect=node.getBoundingClientRect();
      if((node.scrollHeight>node.clientHeight&&event.clientX>=rect.right-16)||(node.scrollWidth>node.clientWidth&&event.clientY>=rect.bottom-16))show(node);
    }
  };
  document.addEventListener('scroll',scroll,true);document.addEventListener('pointermove',pointer,{passive:true});
  return()=>{document.removeEventListener('scroll',scroll,true);document.removeEventListener('pointermove',pointer);for(const [node,timer] of pending){clearTimeout(timer);node.removeAttribute('data-scroll-active');}pending.clear();};
}
