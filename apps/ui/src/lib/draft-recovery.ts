import {redactText,isDeniedPath} from '../../../../packages/privacy/src/index.ts';
import {WorkspaceDrafts,WORKSPACE_DRAFT_BYTES,type WorkspaceDraft} from './workspace-drafts.ts';
import {utf8Bytes} from './prompt-files.ts';

export interface RecoverySnapshot {version:1;recordingId:string;root:string;drafts:{path:string;draft:WorkspaceDraft}[]}
const MAX_BYTES=4*1024*1024,encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const windowsRoot=(root:string)=>/^[a-z]:/i.test(root)||root.startsWith('\\\\')||root.startsWith('//');
const rootKey=(root:string)=>windowsRoot(root)?root.replaceAll('\\','/').toLowerCase():root;
const pathKey=(path:string,root:string)=>windowsRoot(root)?path.toLowerCase():path;
const sameDraft=(a:WorkspaceDraft,b:WorkspaceDraft)=>a.base===b.base&&a.text===b.text&&a.modifiedAt===b.modifiedAt&&!!a.creation===!!b.creation;
const encode=(data:Uint8Array)=>{let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(binary);};
function decode(value:unknown,max:number) {if(typeof value!=='string'||value.length>max*1.4+8)throw new Error('Invalid recovery file.');const data=Uint8Array.from(atob(value),c=>c.charCodeAt(0));if(data.length>max)throw new Error('Recovery file exceeds its limit.');return data;}
function validate(value:unknown):RecoverySnapshot {
  const data=value as RecoverySnapshot;
  if(!data||data.version!==1||typeof data.recordingId!=='string'||data.recordingId.length>512||typeof data.root!=='string'||data.root.length>4096||!Array.isArray(data.drafts)||!data.drafts.length||data.drafts.length>8)throw new Error('Invalid recovery snapshot.');
  const paths=new Set<string>();
  for(const item of data.drafts){const {path,draft}=item??{};
    if(typeof path!=='string'||!path||path.length>500||path.includes('\\')||path.startsWith('/')||path.startsWith('.local/')||path.split('/').some(part=>!part||part==='.'||part==='..'||part.toLowerCase()==='.git'||part.includes(':'))||/[\x00-\x1f]/.test(path)||isDeniedPath(path)||paths.has(pathKey(path,data.root)))throw new Error('Recovery contains an unsupported or duplicate path.');
    paths.add(pathKey(path,data.root));
    if(!draft||typeof draft.base!=='string'||typeof draft.text!=='string'||typeof draft.modifiedAt!=='string'||draft.modifiedAt.length>80||(draft.creation!==undefined&&typeof draft.creation!=='boolean')||draft.creation&&draft.base!==''||utf8Bytes(draft.base)>WORKSPACE_DRAFT_BYTES||utf8Bytes(draft.text)>WORKSPACE_DRAFT_BYTES||draft.text.split('\n').length>5000||draft.base.split('\n').length>5000)throw new Error('Recovery contains an unsupported draft.');
  }
  // Refuse changed text rather than quietly restoring redacted code as an exact draft.
  const raw=JSON.stringify(data);if(utf8Bytes(raw)>MAX_BYTES)throw new Error('Recovery supports at most 4 MiB.');
  if(redactText(raw).text!==raw)throw new Error('Detected secret patterns prevent recovery export or restore. Drafts remain unchanged; no redacted code is substituted.');
  return {version:1,recordingId:data.recordingId,root:data.root,drafts:data.drafts.map(({path,draft})=>({path,draft:{base:draft.base,text:draft.text,modifiedAt:draft.modifiedAt,...(draft.creation?{creation:true}:{})}}))};
}
async function key(passphrase:string,salt:Uint8Array<ArrayBuffer>) {
  if(passphrase.length<12||passphrase.length>1024)throw new Error('Use a recovery passphrase of 12–1024 characters. It is never stored.');
  const material=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
/** Explicit user-owned encrypted file; no browser/daemon draft storage or background autosave. */
export async function sealRecovery(value:RecoverySnapshot,passphrase:string):Promise<string> {
  const snapshot=validate(value),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(passphrase,salt),encoder.encode(JSON.stringify(snapshot)));
  return JSON.stringify({format:'drishya-draft-recovery-v1',salt:encode(salt),iv:encode(iv),cipher:encode(new Uint8Array(cipher))});
}
export async function unsealRecovery(raw:string,passphrase:string):Promise<RecoverySnapshot> {
  if(utf8Bytes(raw)>7*1024*1024)throw new Error('Recovery file exceeds 7 MiB.');
  let envelope;try{envelope=JSON.parse(raw);}catch{throw new Error('Invalid recovery file.');}
  if(envelope?.format!=='drishya-draft-recovery-v1')throw new Error('Unsupported recovery format.');
  const salt=decode(envelope.salt,16),iv=decode(envelope.iv,12),cipher=decode(envelope.cipher,MAX_BYTES+16);
  if(salt.length!==16||iv.length!==12)throw new Error('Invalid recovery file.');
  let plain:ArrayBuffer;
  const secret=await key(passphrase,salt);
  try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},secret,cipher);}catch{throw new Error('Incorrect passphrase or damaged recovery file.');}
  let decoded:unknown;
  try{decoded=JSON.parse(decoder.decode(plain));}catch{throw new Error('Recovery contents could not be read.');}
  return validate(decoded);
}
export function recoverySnapshot(store:WorkspaceDrafts,id:string,root:string):RecoverySnapshot {
  return validate({version:1,recordingId:id,root,drafts:store.entries().filter(item=>item.id===id).map(({path})=>({path,draft:store.get(id,path)!}))});
}
export function restoreRecovery(store:WorkspaceDrafts,snapshot:RecoverySnapshot,id:string,root:string) {
  const safe=validate(snapshot);
  if(safe.recordingId!==id||rootKey(safe.root)!==rootKey(root))throw new Error('Recovery belongs to a different recording or workspace. Open its original recording first.');
  const next=new WorkspaceDrafts();
  for(const item of store.entries())next.set(item.id,item.path,store.get(item.id,item.path)!);
  const additions:RecoverySnapshot['drafts']=[];
  for(const {path,draft} of safe.drafts){
    // A Windows spelling alias names the same file, not another slot for old text.
    // Check every existing alias before mutating the actual draft store.
    const aliases=next.entries().filter(item=>item.id===id&&pathKey(item.path,root)===pathKey(path,root));
    if(aliases.some(item=>!sameDraft(next.get(id,item.path)!,draft)))throw new Error(`A live draft already exists for ${path}. Download or discard it before restoring. No drafts were replaced.`);
    if(!aliases.length){next.create(id,path,draft);additions.push({path,draft});}
  }
  for(const {path,draft} of additions)store.create(id,path,draft);
  return safe.drafts.map(item=>item.path);
}
