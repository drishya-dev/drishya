import {spawn} from 'node:child_process';
import {executable} from './native-executable.ts';

export interface NativeReadiness {
  available:boolean; signedIn:boolean|null; supported:boolean|null;
  state:'ready'|'missing'|'signed-out'|'unsupported'|'unavailable';
  reason?:string;
}
interface Probe {code:number|null;text:string;failed?:boolean}
/** These are CLI metadata commands only: no session, prompt, config write or stdin. */
export async function nativeReadiness(harness:string,cwd:string,options:{launch?:typeof spawn;resolveExecutable?:typeof executable;timeoutMs?:number}={}):Promise<NativeReadiness> {
  const name=harness==='codex'?'codex':harness==='claude-code'?'claude':undefined;
  if(!name)return {available:false,signedIn:null,supported:false,state:'unsupported',reason:'This harness has no supported native connection.'};
  const bin=(options.resolveExecutable??executable)(name);
  if(!bin)return {available:false,signedIn:null,supported:null,state:'missing',reason:'Install the native CLI and restart Drishya.'};
  const probe=(args:string[])=>new Promise<Probe>(resolve=>{
    let text='',settled=false;
    const finish=(result:Probe)=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
    const timer=setTimeout(()=>{child?.kill();finish({code:null,text:'',failed:true});},options.timeoutMs??10_000);
    let child:ReturnType<typeof spawn>;
    try {
      child=(options.launch??spawn)(bin,args,{cwd,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
      const append=(chunk:Buffer)=>{if(Buffer.byteLength(text)+chunk.length>64*1024){child.kill();finish({code:null,text:'',failed:true});}else text+=chunk.toString('utf8');};
      child.stdout?.on('data',append);child.stderr?.on('data',append);
      child.on('error',()=>finish({code:null,text:'',failed:true}));child.on('close',code=>finish({code,text}));
    }catch{finish({code:null,text:'',failed:true});}
  });
  const help=await probe(name==='codex'?['app-server','--help']:['--help']);
  if(help.failed)return {available:true,signedIn:null,supported:null,state:'unavailable',reason:'The native CLI did not answer its capability check.'};
  const supported=help.code===0&&(name==='codex'?/app-server/.test(help.text)&&/--listen/.test(help.text):['--input-format','--output-format','--permission-prompt-tool','--replay-user-messages'].every(flag=>help.text.includes(flag)));
  if(!supported)return {available:true,signedIn:null,supported:false,state:'unsupported',reason:'Update the native CLI; this version lacks the supported connection protocol.'};
  const auth=await probe(name==='codex'?['login','status']:['auth','status','--json']);
  if(auth.failed)return {available:true,signedIn:null,supported:true,state:'unavailable',reason:'The native CLI did not answer its sign-in check.'};
  let signedIn:boolean|null=null;
  if(name==='codex') {
    if(/\bNot logged in\b/i.test(auth.text))signedIn=false;
    else if(auth.code===0&&/^Logged in\b/im.test(auth.text))signedIn=true;
  }else {try{const value=JSON.parse(auth.text);if(typeof value.loggedIn==='boolean')signedIn=value.loggedIn;}catch{/* Unknown output never counts as signed in. */}}
  // Auth output can contain account identifiers. Only this allowlisted result escapes.
  return signedIn===true?{available:true,signedIn:true,supported:true,state:'ready'}:signedIn===false?{available:true,signedIn:false,supported:true,state:'signed-out',reason:'Sign in using the native CLI, then check again.'}:{available:true,signedIn:null,supported:true,state:'unavailable',reason:'The native CLI returned an unrecognised sign-in response.'};
}
