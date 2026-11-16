// SITE-2: validate the complete, private capture; publish only the exact frame set a builder reviewed.
// node scripts/site-footage-publish.ts .local/site-footage-real/<run>
// After Yash reviews review.html: repeat with --approve <printed digest>.
import{createHash,randomBytes}from'node:crypto';
import{lstatSync,realpathSync,writeFileSync,renameSync}from'node:fs';
import{resolve,sep,join}from'node:path';
import{parseArgs}from'node:util';
import{fileURLToPath}from'node:url';
import{FEATURES}from'../apps/site/src/footage.ts';
import{readVerifiedFile}from'./lib/read-verified-file.ts';

const MAX_METADATA_BYTES = 1024 * 1024;
const MAX_FRAME_BYTES = 8 * 1024 * 1024;

const {values,positionals}=parseArgs({allowPositionals:true,options:{approve:{type:'string'}}});
if(positionals.length!==1)throw Error('Provide one capture directory under .local.');
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=realpathSync(resolve(positionals[0]!)),local=realpathSync(resolve(root,'.local'));
if(!directory.startsWith(local+sep)||lstatSync(resolve(positionals[0]!)).isSymbolicLink())throw Error('Capture must be inside this worktree’s .local directory.');
let capture;try{capture=JSON.parse(readVerifiedFile(join(directory,'capture.json'),MAX_METADATA_BYTES).toString('utf8'));}catch{throw Error('Capture metadata is invalid.');}
if(!capture.complete||capture.failures.length||capture.reviewed)throw Error('Only a complete, unfailed, unmodified capture can be reviewed.');
const pairs:[string,string,string?][]=[
 ['explorer','r-explorer','explorer-open-0'],['history-a','r-history-a'],['history-b','r-history-b','history-step'],['workspace','r-workspace'],
 ['changes-session','r-changes-session','changes-session'],['changes-branch','r-changes-branch','changes-branch'],['changes-branch-pick','r-changes-branch-pick','changes-branch-picker'],['changes-branch-picked','r-changes-branch-picked','changes-branch-choose'],['changes-pr-pick','r-changes-pr-pick','changes-pr'],['changes-pr','r-changes-pr','changes-pr-choose'],
 ['git-graph','r-graph'],['git-graph-branch','r-graph-branch','graph-branch'],['tool','r-tool','tool'],['tool-next','r-tool-next','tool-next'],['prompt','r-prompt-a','prompt-a'],['composer','r-composer','composer'],
];
const buffers=new Map<string,Buffer>();
const digest=createHash('sha256');digest.update(JSON.stringify(capture));
const targets=new Map<string,{click?:[number,number];zoom?:[number,number,number,number]}>();
const [width,height]=capture.viewport as[number,number];
if(width!==1440||height!==900)throw Error('Capture must use the agreed 1440×900 viewport.');
for(const [name,source,key] of pairs){
 const bytes=readVerifiedFile(join(directory,`${source}.jpg`),MAX_FRAME_BYTES);
 if(bytes[0]!==255||bytes[1]!==216)throw Error('Capture asset is not JPEG.');
 if(!capture.frames.includes(source)||!capture.frameSources[source])throw Error('Frame provenance is missing.');
 const provenance=capture.frameSources[source];if(!['claude-code','codex','antigravity'].includes(provenance.harness)||!/^rec_[a-f0-9]{8,64}$/.test(provenance.recording))throw Error('Invalid frame provenance.');
 buffers.set(name,bytes);digest.update(name).update(bytes);
 const target:{click?:[number,number];zoom?:[number,number,number,number]}={};
 if(key){
  const point=capture.clicks[key] as[number,number]|undefined;
  if(!point||point.some(n=>!Number.isFinite(n)||n<0||n>1))throw Error('Click coordinates are missing or outside the screen.');
  const actual=capture.targetRects[key] as{point:[number,number];rect:[number,number,number,number]}|undefined;
  if(actual){
   const [x,y,w,h]=actual.rect,[px,py]=actual.point;
   if(Math.abs(point[0]*width-px)>4||Math.abs(point[1]*height-py)>4||px<x||px>x+w||py<y||py>y+h)throw Error('Click does not match the actual target within 4 px.');
  }else if(key!=='prompt-a')throw Error('Click has no actual pointer-event receipt.');
  target.click=point;
 }
 if(name==='prompt'){
  const rect=capture.focusRects[source] as[number,number,number,number]|undefined;
  if(!rect)throw Error('Prompt preview allocation is missing.');
  const [px,py]=target.click!,x=Math.max(0,Math.min(rect[0],px-.015)),y=Math.max(0,Math.min(rect[1],py-.015));
  target.zoom=[x,y,Math.min(1,Math.max(rect[0]+rect[2],px+.015))-x,Math.min(1,Math.max(rect[1]+rect[3],py+.015))-y];
 }
 targets.set(name,target);
}
const hash=digest.digest('hex');
const gallery=pairs.map(([name,source])=>`<section><h2>${name}</h2><p>${capture.frameSources[source].harness} · ${capture.frameSources[source].recording}</p><a href="${source}.jpg"><img src="${source}.jpg" width="${width}" height="${height}" alt="${name}" loading="lazy"></a></section>`).join('');
function atomicWrite(path:string,data:string|Buffer){const temp=path+'.'+randomBytes(8).toString('hex')+'.tmp';writeFileSync(temp,data,{flag:'wx'});renameSync(temp,path);}
atomicWrite(join(directory,'review.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>SITE-2 · private frame review</title><style>body{margin:32px auto;max-width:1440px;padding:0 24px;background:#101214;color:#eee;font:16px/1.5 system-ui}h1,h2{font-weight:500}section{padding:32px 0;border-top:1px solid #333}img{display:block;width:100%;height:auto}p{color:#aaa}code{overflow-wrap:anywhere}</style><h1>SITE-2 · private frame review</h1><p>Review every frame at full size before approving publication. These are local captures, not published assets. This exact set is bound to:</p><code>${hash}</code>${gallery}</html>`);
if(!values.approve){console.log(JSON.stringify({frames:pairs.length,pointerReceipts:pairs.filter(([, ,key])=>key&&capture.targetRects[key]).length,approvalDigest:hash,review:join(directory,'review.html'),published:false}));}
else{
 if(values.approve!==hash)throw Error('Approval does not match this exact capture set.');
 const groups=FEATURES.map(group=>group.map(frame=>({...frame,...targets.get(frame.img)})));
 const canonical=realpathSync(root),destination=resolve(canonical,'apps/site/public/footage'),sourceDir=resolve(canonical,'apps/site/src');
 if(realpathSync(destination)!==destination||realpathSync(sourceDir)!==sourceDir)throw Error('Publish directories must not redirect.');
 for(const [name] of pairs)atomicWrite(resolve(destination,`${name}.jpg`),buffers.get(name)!);
 atomicWrite(resolve(root,'apps/site/src/footage.ts'),`// SITE-2: builder-reviewed real footage. Capture order and timing stay unchanged.\nexport type Frame = { img: string; click?: [number, number]; zoom?: [number, number, number, number] };\nexport const FEATURES: Frame[][] = ${JSON.stringify(groups,null,2)};\n`);
 console.log(JSON.stringify({frames:pairs.length,published:true,approvalDigest:hash}));
}
