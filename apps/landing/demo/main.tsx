import {createRoot} from 'react-dom/client';
import {loadBundle} from '../../ui/src/api.ts';
import {setMotion} from '../../ui/src/state.ts';
import {ModernApp} from '../../ui/src/modern/entry.tsx';

// Normalize before mounting the unchanged app: only its fixed-bundle boot branch is reachable.
const query=new URLSearchParams(location.search),at=query.get('at'),step=at&&/^\d{1,3}$/.test(at)?Number(at):undefined;
const motion=query.get('motion')==='0'||matchMedia('(prefers-reduced-motion: reduce)').matches;
const canonical=new URL('/demo/',location.origin);canonical.searchParams.set('demo','');if(step!==undefined)canonical.searchParams.set('at',String(step));if(motion)canonical.searchParams.set('motion','0');history.replaceState(null,'',canonical.pathname+canonical.search);
document.documentElement.dataset.uiVersion='modern';document.documentElement.dataset.uiSkin='modern';
const style=document.createElement('style');style.textContent=`@font-face{font-family:Inter;src:url('/fonts/InterVariable.woff2') format('woff2');font-weight:100 900;font-display:swap}.public-demo-nav{height:40px;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:0 24px;background:#17251f;color:#e8f4ed;font:12px Inter,sans-serif;position:fixed;inset:0 0 auto;z-index:10000}.public-demo-nav a{color:#b1e7d2}.public-demo-nav span{font-size:11px;color:#c1d4ca}#public-replay{height:calc(100dvh - 40px);margin-top:40px}#public-replay .crown{top:40px}#public-replay .sample-watch{display:none}#public-replay>p{padding:30px;color:#d4e5db;font:16px Inter,sans-serif}.public-narrow{padding:60px 28px;font:18px/1.6 Inter,sans-serif;color:#edf4ef}.public-narrow a{color:#92d6c3}@media(max-width:767px){.public-demo-nav{padding:0 16px;gap:12px}.public-demo-nav span{display:none}}`;document.head.append(style);
const root=document.getElementById('public-replay')!;
// Defence in depth: even a local-only control mistakenly exposed by a future reader cannot call a daemon.
const fetchPublic=globalThis.fetch.bind(globalThis);
globalThis.fetch=(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
  if(url.origin!==location.origin||url.pathname.startsWith('/v1')||!['GET','HEAD'].includes(init?.method??(input instanceof Request?input.method:'GET')))return Promise.reject(Error('The public sample cannot connect to local sessions.'));
  return fetchPublic(input,{...init,credentials:'omit'});
};
async function start(){
  if(innerWidth<600){root.innerHTML='<div class="public-narrow"><h1>A little more room to read.</h1><p>The full replay needs a desktop window at least600px wide.</p><a href="/#session">Read the four-moment walkthrough instead →</a></div>';return;}
  try{
    const bundle=await loadBundle('/demo/demo/bundle.json');
    if(bundle.recording.id!=='rec_x0001+rec_x0002'||bundle.projection.operations.some(o=>!o.id.startsWith('rec_x')))throw Error('The fixed synthetic sample did not validate.');
    const valid=step!==undefined&&step>0&&step<=bundle.projection.timeline.length?step:undefined;
    if(step!==undefined&&valid===undefined){canonical.searchParams.delete('at');history.replaceState(null,'',canonical.pathname+canonical.search);const note=document.querySelector('.public-demo-nav span');if(note)note.textContent='Synthetic sample · bookmark unavailable; showing the default view';}
    if(motion)setMotion(false);createRoot(root).render(<ModernApp token=""/>);
  }catch{
    root.replaceChildren();const message=document.createElement('p');message.textContent='The synthetic sample could not open. Your local sessions are not connected.';
    const actions=document.createElement('p'),retry=document.createElement('button'),walkthrough=document.createElement('a');retry.textContent='Retry sample';retry.onclick=()=>void start();walkthrough.href='/#session';walkthrough.textContent='Read the walkthrough';actions.append(retry,' · ',walkthrough);root.append(message,actions);
  }
}
void start();
