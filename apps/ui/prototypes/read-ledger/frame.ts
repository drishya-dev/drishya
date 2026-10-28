import {workingLocations,type WorkingLocations} from '../../../../packages/contracts/src/working-locations.ts';

// Install isolation before the normal app module evaluates or mounts. No prototype
// navigation or preferences can replace the developer's durable working state.
let saved:WorkingLocations={version:1,sessions:[]};
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
  const path=new URL(input instanceof Request?input.url:String(input),location.href).pathname;
  if(path!=='/v1/working-locations')return nativeFetch(input,init);
  const method=(init?.method??(input instanceof Request?input.method:'GET')).toUpperCase();
  let result:unknown=saved;
  if(method==='PUT'){
    const text=typeof init?.body==='string'?init.body:input instanceof Request?await input.clone().text():'';
    const update=workingLocations(JSON.parse(text));
    const sessions=new Map(saved.sessions.map(session=>[session.id,session]));
    for(const session of update.sessions)sessions.set(session.id,{...session,revision:(sessions.get(session.id)?.revision??0)+1});
    saved=workingLocations({version:1,last:update.last??saved.last,sessions:[...sessions.values()]});
    result={saved:true,revisions:Object.fromEntries(saved.sessions.map(session=>[session.id,session.revision??0]))};
  }else if(method==='DELETE'){saved={version:1,sessions:[]};result={cleared:true};}
  return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});
};
function transientStorage():Storage {
  const values=new Map<string,string>();
  return {get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(String(key),String(value));},removeItem:key=>{values.delete(key);},clear:()=>values.clear()};
}
Object.defineProperty(window,'localStorage',{value:transientStorage()});
Object.defineProperty(window,'sessionStorage',{value:transientStorage()});
const query=new URLSearchParams(location.search),recording=query.get('recording');
if(!query.has('bundle')){
  const {signIn}=await import('../../src/api.ts');
  const auth=await signIn();
  if(auth==='ok'&&recording)history.replaceState(null,'',`${location.pathname}${location.search}#/r/${encodeURIComponent(recording)}`);
}
await import('./bridge.ts');
const [{createElement},{createRoot},{ModernApp},{ScreenBoundary}]=await Promise.all([
  import('react'),import('react-dom/client'),import('../../src/modern/entry.tsx'),import('../../src/components/ScreenBoundary.tsx'),
]);
document.documentElement.dataset.uiVersion='modern';
createRoot(document.getElementById('root')!).render(createElement(ScreenBoundary,null,createElement(ModernApp,{token:''})));
