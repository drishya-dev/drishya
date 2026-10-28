import './study.css';
import './picker.css';
import {ledger} from './ledger.ts';
import {strips} from './strips.ts';
import {outline} from './outline.ts';

const variants = [ledger, strips, outline];
const stage = document.querySelector<HTMLIFrameElement>('#stage')!;
const picker = document.querySelector<HTMLElement>('.proto-picker')!;
const highlight = picker.querySelector<HTMLElement>('.proto-picker-highlight')!;
const items = [...picker.querySelectorAll<HTMLButtonElement>('.proto-picker-item')];
const parameters = new URLSearchParams(location.search);
const token = new URLSearchParams(location.hash.slice(1)).get('token');
const recording = parameters.get('recording');
let current = 0;
let connected = false;

function moveHighlight() {
  const el = items[current]!;
  highlight.style.width = el.offsetWidth + 'px';
  highlight.style.transform = `translateX(${el.offsetLeft}px)`;
}
function mount() {
  document.querySelector('#direction')!.textContent = variants[current]!.axis;
  if (connected) stage.contentWindow!.postMessage({type:'read3-variant',variant:current,css:variants[current]!.css},location.origin);
}
function setActive(i:number) {
  if (i < 0 || i >= variants.length) return;
  current = i;
  items.forEach((el,j) => { el.toggleAttribute('data-active',j===i); if(j===i)el.setAttribute('aria-current','true');else el.removeAttribute('aria-current'); });
  moveHighlight();
  const url = new URL(location.href); url.searchParams.set('v',String(i+1)); history.replaceState(null,'',url);
  mount();
}
items.forEach((el,i) => el.addEventListener('click',()=>setActive(i)));
window.addEventListener('resize',moveHighlight);
document.addEventListener('keydown',event => {
  const target=event.target as HTMLElement;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)||target.isContentEditable||event.metaKey||event.ctrlKey||event.altKey) return;
  const num=Number.parseInt(event.key,10);
  if(num>=1&&num<=variants.length)setActive(num-1);
  else if(event.key==='ArrowRight')setActive((current+1)%variants.length);
  else if(event.key==='ArrowLeft')setActive((current-1+variants.length)%variants.length);
});
window.addEventListener('message',event => {
  if(event.origin!==location.origin||event.source!==stage.contentWindow)return;
  if(event.data?.type==='read3-ready'){ connected=true; mount(); }
  if(event.data?.type==='read3-status')document.querySelector('#status')!.textContent=event.data.message;
  if(event.data?.type==='read3-key'){
    if(event.data.key==='ArrowRight')setActive((current+1)%variants.length);
    else if(event.data.key==='ArrowLeft')setActive((current-1+variants.length)%variants.length);
    else if(/^[123]$/.test(event.data.key))setActive(Number(event.data.key)-1);
  }
});
stage.addEventListener('load',()=>{
  const doc=stage.contentDocument;
  if(!doc)return;
  const script=doc.createElement('script');script.type='module';script.src='/prototypes/read-ledger/bridge.ts';
  script.dataset.recording=recording??'';doc.head.append(script);
});
const appURL=new URL('/index.html?experience=modern&motion=0',location.origin);
if(parameters.has('bundle'))appURL.searchParams.set('bundle',parameters.get('bundle')!);
if(token)appURL.hash=new URLSearchParams({token}).toString();
else if(recording)appURL.hash=`/r/${encodeURIComponent(recording)}`;
stage.src=appURL.href;
if(token)history.replaceState(null,'',location.pathname+location.search);
setActive(Math.max(0,Math.min(2,(Number.parseInt(parameters.get('v')??'1',10)||1)-1)));
requestAnimationFrame(()=>requestAnimationFrame(()=>picker.setAttribute('data-ready','')));
