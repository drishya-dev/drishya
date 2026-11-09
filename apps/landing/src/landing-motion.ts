import {identityPolygons} from './identity.ts';
import {trackProgress} from './identity-geometry.ts';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const desktop=matchMedia('(min-width: 1000px) and (min-height: 700px)');
const connection=(navigator as Navigator & {connection?:{saveData?:boolean}}).connection;
export const motionAllowed=()=>!reduced.matches&&new URLSearchParams(location.search).get('motion')!=='0'&&!connection?.saveData;
export const scrollMotionAllowed=()=>motionAllowed()&&desktop.matches&&!document.hidden;

export function initLandingMotion():void {
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
  const request=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const settle=()=>{cancelAnimationFrame(frame);frame=0;update();};
  addEventListener('scroll',request,{passive:true});
  addEventListener('resize',request,{passive:true});
  reduced.addEventListener('change',settle);desktop.addEventListener('change',settle);
  document.addEventListener('visibilitychange',settle);
  addEventListener('pagehide',()=>{stopped=true;settle();});
  addEventListener('pageshow',()=>{stopped=false;settle();});
  update();
}
