import './site.css';
import './landing-motion.css';
import {initLandingMotion} from './landing-motion.ts';
initLandingMotion();
interface Chapter {key:string;title:string;step:number;kind:string;path?:string;command?:string;status:string;provenance:string;text:string}

// All material is public synthetic text; render it as text, never as captured HTML.
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const noMotion=()=>reduce.matches||new URLSearchParams(location.search).get('motion')==='0';
const header=document.querySelector('.site-header');
const updateHeader=()=>header?.classList.toggle('scrolled',scrollY>12);
addEventListener('scroll',updateHeader,{passive:true});updateHeader();

const menu=document.querySelector<HTMLDetailsElement>('.compact-nav');
document.addEventListener('pointerdown',event=>{if(menu?.open&&!menu.contains(event.target as Node))menu.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.open){menu.open=false;menu.querySelector<HTMLElement>('summary')?.focus();}});
menu?.addEventListener('toggle',()=>{if(menu.open&&!noMotion())menu.querySelector('nav')?.animate([{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'translateY(0)'}],{duration:140,easing:'cubic-bezier(.22,1,.36,1)'});});
menu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.open=false;}));
document.querySelectorAll<HTMLAnchorElement>('a[href*="#"]').forEach(link=>link.addEventListener('click',()=>{
  const target=new URL(link.href);if(target.pathname!==location.pathname||!target.hash||link.matches('[data-chapter-key]'))return;
  const destination=document.getElementById(target.hash.slice(1));if(destination){const title=destination.querySelector<HTMLElement>('h2')??destination;title.tabIndex=-1;requestAnimationFrame(()=>title.focus({preventScroll:true}));}
}));

for(const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')){
  let timer:ReturnType<typeof setTimeout>;
  button.addEventListener('click',async()=>{
    const source=document.getElementById(button.dataset.copy!),status=button.parentElement?.querySelector<HTMLElement>('.copy-feedback');
    if(!source||!status)return;
    clearTimeout(timer);
    try{await navigator.clipboard.writeText(source.textContent??'');button.textContent='Copied';status.textContent='Commands copied with line breaks.';}
    catch{const selection=getSelection(),range=document.createRange();range.selectNodeContents(source);selection?.removeAllRanges();selection?.addRange(range);source.focus();button.textContent='Select and copy';status.textContent='Clipboard unavailable. The commands are selected; copy them with your keyboard.';}
    timer=setTimeout(()=>{button.textContent='Copy commands';},1200);
  });
}

const stage=document.getElementById('chapter-material'),section=document.getElementById('session');
async function enhanceSample(){
  const response=await fetch('/chapters.json');if(!response.ok)throw Error('Sample unavailable');
  const data=await response.json(),chapters=data.chapters as Chapter[];
  if(chapters.length!==4||chapters.some(c=>!Number.isInteger(c.step)||typeof c.text!=='string'))throw Error('Sample metadata invalid');
  const controls=[...document.querySelectorAll<HTMLAnchorElement>('[data-chapter-key]')],range=document.getElementById('sample-range') as HTMLInputElement,play=document.getElementById('play-sample') as HTMLButtonElement,counter=document.getElementById('chapter-counter')!,full=document.getElementById('full-replay') as HTMLAnchorElement,announce=document.getElementById('sample-announcement')!;
  let current=0,playing=false,visible=false,timer:ReturnType<typeof setTimeout>|undefined,raf=0;
  const durations=[1600,2200,2600,1800];
  const indexFromURL=()=>Math.max(0,chapters.findIndex(c=>c.key===new URLSearchParams(location.search).get('moment')));
  function pause(message=''){clearTimeout(timer);playing=false;play.textContent=current===3?'Replay sample ↻':'Play sample ▷';play.setAttribute('aria-pressed','false');if(message)announce.textContent=message;}
  function render(index:number,reason:'initial'|'pointer'|'play'|'keyboard'|'drag'|'restore',updateURL=true){
    current=Math.max(0,Math.min(3,index));const c=chapters[current]!;stage!.getAnimations().forEach(a=>a.cancel());
    const lines=c.text.split('\n').map((line,i)=>`<span class="code-line ${line.startsWith('+')?'added':line.startsWith('-')?'removed':''}"><span class="line-number" aria-hidden="true">${i+1}</span><span>${escape(line).replace(/\b(import|from|export|type|function|if|return|const|undefined|null)\b/g,'<span class="keyword">$1</span>')||' '}</span></span>`).join('');
    stage!.innerHTML=`<div class="evidence-heading"><span class="file-symbol" aria-hidden="true">${c.kind==='test'?'>_':'{ }'}</span><span>${escape(c.path??c.command??'')}</span><span class="result ${c.key==='failure'?'failed':c.key==='retest'?'passed':''}">${escape(c.status)}</span></div><div class="provenance">${escape(c.provenance)}</div><pre class="material" tabindex="0" aria-label="${escape(c.title)} material"><code>${lines}</code></pre>`;
    stage!.dataset.kind=c.kind;counter.textContent=`${current+1} of 4`;range.value=String(current+1);range.setAttribute('aria-valuetext',c.title);
    controls.forEach((control,i)=>{if(i===current)control.setAttribute('aria-current','step');else control.removeAttribute('aria-current');});
    full.href=`/demo/?demo&at=${c.step}${noMotion()?'&motion=0':''}`;
    if(updateURL){const url=new URL(location.href);url.searchParams.set('moment',c.key);url.hash='session';history.replaceState({moment:c.key},'',url);}
    if(!noMotion()&&['pointer','play'].includes(reason))stage!.animate([{transform:'translateY(6px)'},{transform:'translateY(0)'}],{duration:190,easing:'cubic-bezier(.22,1,.36,1)'});
    if(reason!=='initial')announce.textContent=`${current+1} of 4. ${c.title}. ${c.status}.`;
    if(!playing)pause();
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if(!playing||document.hidden||!visible){pause();return;}if(current===3){pause('Sample complete. Replay it or open the full replay.');return;}render(current+1,'play');schedule();},durations[current]);}
  controls.forEach((control,i)=>control.addEventListener('click',event=>{event.preventDefault();pause();render(i,event.detail===0?'keyboard':'pointer');}));
  range.addEventListener('input',()=>{pause();cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>render(Number(range.value)-1,'drag'));});
  range.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();pause();render(event.key==='Home'?0:event.key==='End'?3:current+(['ArrowRight','ArrowUp'].includes(event.key)?1:-1),'keyboard');}});
  play.addEventListener('click',()=>{if(playing){pause('Sample paused.');return;}if(current===3)render(0,'pointer');playing=true;play.textContent='Pause sample Ⅱ';play.setAttribute('aria-pressed','true');announce.textContent='Playing the four recorded moments.';schedule();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')pause('Sample paused.');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  addEventListener('pagehide',()=>pause());addEventListener('pageshow',()=>{pause();render(indexFromURL(),'restore',false);});
  addEventListener('popstate',()=>{pause();render(indexFromURL(),'restore',false);});
  addEventListener('resize',()=>{pause();stage!.getAnimations().forEach(a=>a.cancel());});
  reduce.addEventListener('change',()=>{pause();stage!.getAnimations().forEach(a=>a.cancel());full.href=`/demo/?demo&at=${chapters[current]!.step}${noMotion()?'&motion=0':''}`;});
  new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;if(!visible)pause();},{threshold:.2}).observe(section!);
  try{render(indexFromURL(),'initial',false);play.hidden=false;range.parentElement!.hidden=false;}
  catch{document.getElementById('sample-error')!.hidden=false;}
  if(!noMotion()&&!performance.getEntriesByType('navigation').some(entry=>(entry as PerformanceNavigationTiming).type==='back_forward'))document.querySelector('.evidence-tether')?.animate([{opacity:.25},{opacity:1}],{duration:360,easing:'cubic-bezier(.22,1,.36,1)'});
}

if(stage&&section)void enhanceSample().catch(()=>{document.getElementById('sample-error')!.hidden=false;});
