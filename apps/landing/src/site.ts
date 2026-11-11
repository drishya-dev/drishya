import './site.css';
import './landing-motion.css';
import './opening.css';
import './explainer.css';
import './living-sample.css';
import {initSectionArrivals,motionAllowed} from './landing-motion.ts';
import {createMotionRuntime} from './motion-runtime.ts';
import {initOpening} from './opening.ts';
import {initExplainer} from './explainer.ts';
import {loadAndInitLivingSample} from './living-sample.ts';

const motionRuntime=createMotionRuntime();
initSectionArrivals(motionRuntime);
initOpening(motionRuntime);
initExplainer(motionRuntime);
void loadAndInitLivingSample(motionRuntime);

const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const noMotion=()=>!motionAllowed()||document.hidden;
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
