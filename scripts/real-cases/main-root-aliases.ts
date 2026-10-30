import type {RealCase} from './types.ts';

const sessions=new Map<string,{primary:string;roots:Set<string>}>();
let codexSession:string|undefined;
const normalize=(root:string)=>{const path=root.replace(/\\/g,'/').replace(/\/+$/,'');return /^[a-z]:\//i.test(path)?path.toLowerCase():path;};
/** Native session IDs bound root declarations across rows; no prose or tool-argument guesses. */
export const mainRootAliases:RealCase={
  name:'main-root-aliases',
  about:'Multiple native working roots and preserved namespaced files (pair with FILES-7 current-reader checks)',
  harnesses:['codex','claude-code'],prefilter:'cwd',
  scan(row,harness){
    const payload=row.payload as {cwd?:unknown;id?:unknown}|undefined;
    if(harness==='codex'&&row.type==='session_meta')codexSession=typeof payload?.id==='string'?payload.id:undefined;
    const id=harness==='codex'?codexSession:typeof row.sessionId==='string'?row.sessionId:undefined;
    const value=harness==='codex'&&['session_meta','turn_context'].includes(String(row.type))?payload?.cwd:harness==='claude-code'?row.cwd:undefined;
    if(!id||typeof value!=='string'||!value)return;
    const root=normalize(value),key=`${harness}/${id}`;let session=sessions.get(key);
    if(!session){session={primary:root,roots:new Set([root])};sessions.set(key,session);return;}
    if(session.roots.has(root)||root.startsWith(session.primary+'/'))return;
    session.roots.add(root);return {hits:1};
  },
  verify(projection){
    const files=projection.files.filter(file=>/^worktree-[a-f0-9]{10}\//.test(file.path));
    return [`${files.length?'PASS':'NOT VERIFIED'} ${files.length} preserved namespaced files across ${new Set(files.map(file=>file.path.split('/')[0])).size} captured prefixes; exact main-root identity and consent-bound current reading require the FILES-7 reader checks`];
  },
};
