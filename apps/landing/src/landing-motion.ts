import {identityPolygons} from './identity.ts';
import {trackProgress} from './identity-geometry.ts';
import type {MotionRuntime} from './motion-runtime.ts';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const desktop=matchMedia('(min-width: 1000px) and (min-height: 700px)');
const connection=(navigator as Navigator & {connection?:{saveData?:boolean}}).connection;
export const motionAllowed=()=>!reduced.matches&&new URLSearchParams(location.search).get('motion')!=='0'&&!connection?.saveData;
export const scrollMotionAllowed=()=>motionAllowed()&&desktop.matches&&!document.hidden;

export function initLandingMotion(runtime?:MotionRuntime):void {
  const track=document.querySelector<HTMLElement>('[data-identity-track]');
  const sculpture=track?.querySelector<SVGElement>('.identity-sculpture');
  if(!track||!sculpture)return;
  document.documentElement.classList.add('landing-home');
  let frame=0,previous=-1,stopped=false;
  const update=()=>{
    frame=0;
    const active=!stopped&&scrollMotionAllowed();
    track.dataset.motion=active?'active':'static';
    const rect=track.getBoundingClientRect();
    const progress=active?trackProgress(rect.top-64,rect.height,innerHeight-64):0;
    if(progress===previous)return;
    previous=progress;track.dataset.progress=progress.toFixed(3);
    track.style.setProperty('--identity-progress',String(progress));
    sculpture.innerHTML=identityPolygons(progress);
    document.querySelector<HTMLElement>('.site-header .wordmark')?.style.setProperty('--mark-turn',`${-progress*24}deg`);
  };
  // Events invalidate one frame. No animation clock or self-scheduling RAF runs at rest.
  const request=()=>{if(runtime)runtime.invalidate('identity',update);else if(!document.hidden&&!frame)frame=requestAnimationFrame(update);};
  const settle=()=>{cancelAnimationFrame(frame);frame=0;update();};
  const unsubscribe=runtime?.subscribe(()=>settle());
  addEventListener('scroll',request,{passive:true});
  addEventListener('resize',request,{passive:true});
  reduced.addEventListener('change',settle);desktop.addEventListener('change',settle);
  document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);frame=0;if(!document.hidden)update();});
  addEventListener('pagehide',()=>{stopped=true;cancelAnimationFrame(frame);frame=0;});
  addEventListener('pageshow',()=>{stopped=false;settle();});
  update();
}

export function initScrollStory(section:HTMLElement,select:(index:number)=>void,pause:()=>void,initialManual:boolean):{takeControl:()=>void;restoreControl:(manual:boolean)=>void} {
  const stops=[...section.querySelectorAll<HTMLElement>('[data-story-stop]')];
  const follow=section.querySelector<HTMLButtonElement>('#follow-scroll')!;
  let manual=initialManual,frame=0,selected=-1;
  const showOwner=()=>{
    section.dataset.storyOwner=manual?'manual':'scroll';
    follow.setAttribute('aria-pressed',String(!manual));
  };
  const takeControl=()=>{manual=true;showOwner();};
  const update=()=>{
    frame=0;
    const enabled=motionAllowed()&&desktop.matches;
    section.dataset.story=enabled?'scroll':'manual';follow.hidden=!enabled;
    showOwner();
    const rect=section.getBoundingClientRect();
    if(!enabled||manual||document.hidden||rect.top>=innerHeight||rect.bottom<=0)return;
    let index=0;
    stops.forEach((stop,i)=>{if(stop.getBoundingClientRect().top<=innerHeight*.38)index=i;});
    section.style.setProperty('--story-progress',String(index/Math.max(1,stops.length-1)));
    if(index!==selected){selected=index;select(index);}
  };
  const request=()=>{if(!document.hidden&&!frame)frame=requestAnimationFrame(update);};
  const settle=()=>{cancelAnimationFrame(frame);frame=0;update();};
  follow.addEventListener('click',()=>{pause();manual=!manual;selected=-1;settle();});
  section.querySelector('.stage')?.addEventListener('focusin',event=>{if(event.target!==follow)takeControl();});
  section.querySelector('#chapter-material')?.addEventListener('pointerdown',takeControl);
  addEventListener('scroll',request,{passive:true});addEventListener('resize',request,{passive:true});
  reduced.addEventListener('change',settle);desktop.addEventListener('change',settle);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else settle();});
  addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});
  addEventListener('pageshow',settle);
  const restoreControl=(value:boolean)=>{manual=value;selected=-1;request();};
  update();return {takeControl,restoreControl};
}

export function initSectionArrivals(runtime?:MotionRuntime):void {
  const animations=new Set<Animation>();
  const settle=()=>{animations.forEach(a=>a.cancel());animations.clear();};
  const applyPreference=()=>{document.documentElement.dataset.landingMotion=motionAllowed()&&!document.hidden?'on':'off';if(!motionAllowed()||document.hidden){settle();document.getAnimations().forEach(a=>a.cancel());}};
  applyPreference();
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      observer.unobserve(entry.target);
      if(!motionAllowed()||document.hidden||entry.target.contains(document.activeElement))continue;
      const animation=runtime?.animate(entry.target,[{transform:'translateY(18px)'},{transform:'translateY(0)'}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)'})??entry.target.animate([{transform:'translateY(18px)'},{transform:'translateY(0)'}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)'});
      animations.add(animation);animation.finished.then(()=>animations.delete(animation)).catch(()=>animations.delete(animation));
    }
  },{threshold:.12});
  document.querySelectorAll('.editorial-row,.closing,.statement>.wrap,.local-section>.wrap').forEach(el=>observer.observe(el));
  document.addEventListener('focusin',event=>{if(event.target instanceof Element)event.target.closest('.editorial-row,.closing,.statement>.wrap,.local-section>.wrap')?.getAnimations().forEach(a=>a.cancel());});
  reduced.addEventListener('change',()=>{applyPreference();settle();});document.addEventListener('visibilitychange',applyPreference);
  addEventListener('pagehide',()=>{settle();document.getAnimations().forEach(a=>a.cancel());observer.disconnect();});
  addEventListener('pageshow',applyPreference);
}
