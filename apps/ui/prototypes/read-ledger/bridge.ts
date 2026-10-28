import {useApp} from '../../src/state.ts';

// This module is injected only by the isolated prototype page. The app never imports it.
const host=window.parent;
const script=document.querySelector<HTMLScriptElement>('script[src="/prototypes/read-ledger/bridge.ts"]');
const recording=script?.dataset.recording??new URLSearchParams(location.search).get('recording');
const style=document.createElement('style');style.dataset.read3='';document.head.append(style);
const base=`
  article.read3-eligible { transform: none !important; opacity: 1 !important; overflow: hidden; }
  article.read3-eligible:is(.read3-open,.expanded,.selected) { height: auto !important; max-height: min(640px, calc(100vh - 180px)) !important; }
  article.read3-eligible:is(.read3-open,.expanded,.selected) > :is(.op-body,.op-expanded) { max-height: min(520px, calc(100vh - 260px)); overflow: auto; }
  :root:not([data-read3='2']) article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) > :is(.op-body,.op-expanded) { display: none !important; }
  :root:not([data-read3='2']) article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) .op-head { cursor: zoom-in; }
  article.read3-pinned > .op-head { box-shadow: inset 2px 0 var(--accent, #a6a4fa); }
  .read3-group-toggle { transition: color 150ms ease-out, background-color 150ms ease-out; }
  @media (prefers-reduced-motion: reduce) { .read3-group-toggle { transition: none; } }
`;
let variant=0,scheduled=false,opening=false,routing=false,prepared=false;
const send=(type:string,value:Record<string,unknown>={})=>host.postMessage({type,...value},location.origin);
const eligible=(card:HTMLElement)=>card.classList.contains('ph-settled')&&card.classList.contains('st-ok')&&!card.classList.contains('resolving');
function reset() {
  document.querySelectorAll('.read3-group-toggle').forEach(node=>node.remove());
  document.querySelectorAll('.read3-eligible,.read3-open,.read3-pinned,.read3-group,.read3-group-open').forEach(node=>node.classList.remove('read3-eligible','read3-open','read3-pinned','read3-group','read3-group-open'));
}
function decorate() {
  scheduled=false;
  const history=document.querySelector<HTMLElement>('.history');
  if(history&&!prepared){
    prepared=true;history.focus({preventScroll:true});
    history.dispatchEvent(new KeyboardEvent('keydown',{key:'C',shiftKey:true,bubbles:true}));
    history.scrollTop=0;
  }
  const cards=[...document.querySelectorAll<HTMLElement>('article[data-op-id]')];
  for(const card of cards)card.classList.toggle('read3-eligible',eligible(card));
  if(variant===2)for(const row of document.querySelectorAll<HTMLElement>('.ops-row')){
    const children=[...row.querySelectorAll<HTMLElement>(':scope > article[data-op-id]')];
    // A running/failed action or a browser group keeps the entire passage visible.
    if(!children.length||children.length!==row.children.length||!children.every(eligible))continue;
    const passage=row.parentElement!;passage.classList.add('read3-group');
    if(passage.querySelector(':scope > .read3-group-toggle'))continue;
    const button=document.createElement('button');button.type='button';button.className='read3-group-toggle';button.setAttribute('aria-expanded','false');
    const label=document.createElement('span');label.textContent=children[0]!.getAttribute('aria-label')??'Recorded passage';
    const count=document.createElement('small');count.textContent=`${children.length} recorded action${children.length===1?'':'s'}`;
    button.append(label,count);passage.insertBefore(button,row);
  }
  send('read3-status',{message:`${document.querySelectorAll('.read3-eligible').length} older successful actions · failures and current work stay open`});
}
function schedule() {if(!scheduled){scheduled=true;requestAnimationFrame(decorate);}}
function pin(card:HTMLElement,value:boolean) {card.classList.toggle('read3-pinned',value);card.classList.toggle('read3-open',value);}
// Compare one disclosure controller at a time. The production document-level
// hover reader must not independently fix/zoom the same prototype material.
window.addEventListener('pointermove',event=>{
  if((event.target as HTMLElement).closest('article[data-op-id],.read3-group-toggle'))event.stopPropagation();
},true);
document.addEventListener('pointerover',event=>{
  if(variant===2)return;
  const target=event.target as HTMLElement,head=target.closest('.op-head'),card=head?.closest<HTMLElement>('.read3-eligible');
  if(card&&head&&!head.contains(event.relatedTarget as Node|null))card.classList.add('read3-open');
});
document.addEventListener('pointerout',event=>{
  const card=(event.target as HTMLElement).closest<HTMLElement>('.read3-eligible');
  if(!card||card.contains(event.relatedTarget as Node|null)||card.classList.contains('read3-pinned'))return;
  const selection=getSelection();
  if(selection&&!selection.isCollapsed&&card.contains(selection.anchorNode))pin(card,true);
  else card.classList.remove('read3-open');
});
document.addEventListener('click',event=>{
  const target=event.target as HTMLElement,group=target.closest<HTMLButtonElement>('.read3-group-toggle');
  if(group){const open=group.parentElement!.classList.toggle('read3-group-open');group.setAttribute('aria-expanded',String(open));return;}
  const head=target.closest('.op-head'),card=head?.closest<HTMLElement>('.read3-eligible');
  if(card&&!target.closest('button,a,input,select,textarea')){event.preventDefault();event.stopPropagation();pin(card,!card.classList.contains('read3-pinned'));}
},true);
window.addEventListener('keydown',event=>{
  const target=event.target as HTMLElement;
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)||target.isContentEditable||event.metaKey||event.ctrlKey||event.altKey)return;
  if(/^[123]$/.test(event.key)||event.key==='ArrowRight'||event.key==='ArrowLeft')send('read3-key',{key:event.key});
  const card=target.closest<HTMLElement>('.read3-eligible');
  if(card&&variant!==2&&(event.key==='e'||event.key==='E')){event.preventDefault();event.stopPropagation();pin(card,!card.classList.contains('read3-pinned'));}
  if(card&&event.key==='Escape'&&card.classList.contains('read3-pinned')){pin(card,false);event.stopPropagation();}
},true);
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==host||event.data?.type!=='read3-variant')return;
  if(![0,1,2].includes(event.data.variant)||typeof event.data.css!=='string')return;
  reset();variant=event.data.variant;document.documentElement.dataset.read3=String(variant);style.textContent=base+event.data.css;schedule();
});
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
function update(state:ReturnType<typeof useApp.getState>) {
  // After launch-token exchange, let the app's normal deep-link boot own opening.
  // Calling openRecording during StrictMode boot races its second Home response.
  if(recording&&state.screen==='home'&&!routing&&location.hash!==`#/r/${encodeURIComponent(recording)}`){
    routing=true;location.replace(`${location.pathname}${location.search}#/r/${encodeURIComponent(recording)}`);location.reload();return;
  }
  if(state.screen==='viewer'&&state.projection&&!opening){opening=true;
    queueMicrotask(()=>useApp.setState({follow:false,held:true,playing:false}));
  }
  schedule();
}
useApp.subscribe(update);
update(useApp.getState());
send('read3-ready');schedule();
