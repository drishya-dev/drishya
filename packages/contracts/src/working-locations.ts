/** Navigation metadata only. This is not a captured event or executable capability. */
export interface WorkingLocations { version: 1; last?: string; sessions: { id: string; revision?:number; entries: [string,unknown][] }[] }
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const fields=new Set('developerWorkspace selectedOp expandedOp currentFile filePanel filePanelFocus filePanelEvidence filePanelLine explore compareAgents mapFocusPath filter follow held inspectorTab inspectorWidth readingPassageId start agentId kind server tool x y k zoom top left id offset query line wrap formatted activeLine scope pages index width layout match trailWidth trailHidden right leftKey rightKey version primary secondary split pane ratio cursor visits location memory open name root harness days workspace'.split(' '));
const slot=/^(composer\/collapsed|toolbox\/collapsed|location|history\/(top|anchor|heights)|desk\/(files|primary|secondary|split|pane|ratio)|desk\/document\/.+|folders\/(query|open|top)|map\/(yaw|pitch|camera|query|observed|connections|file|page|neighborhood)|git\/(selected|page|open)|canvas\/(view|panel|panelFocus|camera)|home\/.+|evidence\/trail)$/;
const readerSlot=/^(disk\/(start|version|query|line|lineInput|wrap|width)|file\/(trailWidth|trailHidden|query|start|left|right)|(?:.*\/artifact|diff)\/.+\/(pages|index|query|wrap|line|lineInput|offset|layout|match)|scroll\/.+)$/;
const locationStrings='selectedOp expandedOp currentFile filePanel filePanelFocus filePanelEvidence mapFocusPath readingPassageId'.split(' ');
function location(input:unknown):Record<string,unknown> {
  const out:Record<string,unknown>={explore:false,inspectorTab:'detail',inspectorWidth:760};
  if(!record(input))return out;
  for(const key of locationStrings)if(typeof input[key]==='string'&&input[key].length<=2048)out[key]=input[key];
  for(const key of ['developerWorkspace','explore','compareAgents','follow','held'])if(typeof input[key]==='boolean')out[key]=input[key];
  for(const key of ['start','inspectorWidth'])if(typeof input[key]==='number'&&Number.isFinite(input[key])&&input[key]>=0&&input[key]<=1e10)out[key]=input[key];
  if(typeof input.filePanelLine==='number'&&Number.isSafeInteger(input.filePanelLine)&&input.filePanelLine>=1&&input.filePanelLine<=999999999)out.filePanelLine=input.filePanelLine;
  if(input.inspectorTab==='detail'||input.inspectorTab==='evidence')out.inspectorTab=input.inspectorTab;
  if(record(input.filter)) { const filter:Record<string,string>={};for(const key of ['kind','agentId','server','tool'])if(typeof input.filter[key]==='string'&&input.filter[key].length<=2048)filter[key]=input.filter[key];out.filter=filter; }
  return out;
}

function value(input:unknown,depth=0):unknown {
  if(depth>12)return undefined;
  if(input===null||typeof input==='boolean')return input;
  if(typeof input==='number')return Number.isFinite(input)&&Math.abs(input)<=1e10?input:undefined;
  if(typeof input==='string')return input.length<=2048?input:undefined;
  if(Array.isArray(input))return input.slice(0,256).map(x=>value(x,depth+1));
  if(record(input)) { const out:Record<string,unknown>={}; for(const [key,item] of Object.entries(input))if(fields.has(key))out[key]=value(item,depth+1); return out; }
}

function entries(input:unknown,allowed:RegExp):[string,unknown][] {
  if(!Array.isArray(input))return [];
  return input.slice(-64).flatMap(pair=>Array.isArray(pair)&&typeof pair[0]==='string'&&pair[0].length<=1400&&allowed.test(pair[0])?[[pair[0],value(pair[1])] as [string,unknown]]:[]);
}
function readerValue(key:string,item:unknown) {
  if(key.startsWith('scroll/'))return record(item)&&typeof item.top==='number'&&typeof item.left==='number';
  const tail=key.split('/').at(-1);
  if(tail==='pages')return Array.isArray(item)&&item.every(x=>typeof x==='number');
  if(['wrap','trailHidden'].includes(tail!))return typeof item==='boolean';
  if(['query','lineInput','version'].includes(tail!))return typeof item==='string';
  if(tail==='layout')return item==='unified'||item==='split';
  if(tail==='left'||tail==='right')return typeof item==='string'||record(item);
  return typeof item==='number';
}

export function workingLocations(input:unknown):WorkingLocations {
  if(!record(input)||input.version!==1||!Array.isArray(input.sessions))return {version:1,sessions:[]};
  const sessions=input.sessions.slice(-9).flatMap(session=>{
    if(!record(session)||typeof session.id!=='string'||session.id.length>256||!/^[@\w+.-]+$/.test(session.id))return [];
    const clean=entries(session.entries,slot).filter(([key,item])=>{
      if(key==='composer/collapsed'||key==='toolbox/collapsed')return typeof item==='boolean';
      if(key==='location')return record(item);
      if(key==='evidence/trail')return record(item)&&Array.isArray(item.visits);
      if(key==='desk/files'||key==='folders/open')return Array.isArray(item)&&item.every(x=>typeof x==='string')&&(key!=='desk/files'||item.length<=8);
      if(key==='history/heights')return Array.isArray(item)&&item.every(x=>Array.isArray(x)&&typeof x[0]==='string'&&typeof x[1]==='number');
      if(key==='history/anchor')return record(item)&&typeof item.id==='string'&&typeof item.offset==='number';
      if(key==='map/camera')return record(item)&&['x','y','k'].every(k=>typeof item[k]==='number')&&Number(item.k)>0&&Number(item.k)<=1000;
      if(key==='canvas/camera')return record(item)&&['x','y','zoom'].every(k=>typeof item[k]==='number')&&Number(item.zoom)>0&&Number(item.zoom)<=1000;
      if(key==='desk/pane')return item===0||item===1;
      if(key==='desk/ratio')return typeof item==='number'&&item>=25&&item<=75;
      if(key==='home/groups/shown')return typeof item==='number'&&Number.isInteger(item)&&item>=50;
      if(key==='home/days')return item===0||item===1||item===7||item===30;
      if(key.startsWith('desk/document/'))return key.includes('/scroll/')?record(item)&&typeof item.top==='number'&&typeof item.left==='number':record(item)&&typeof item.start==='number'&&Number.isInteger(item.start)&&item.start>=0&&typeof item.query==='string'&&typeof item.line==='string'&&typeof item.wrap==='boolean';
      if(['desk/primary','desk/secondary','folders/query','map/query','map/file','git/selected','home/query','home/harness','home/workspace','canvas/panelFocus'].includes(key))return typeof item==='string';
      if(['history/top','folders/top','map/yaw','map/pitch','map/page','git/page','desk/pane','desk/ratio','home/days','home/top','home/groups/shown'].includes(key))return typeof item==='number';
      if(['desk/split','map/observed','map/connections','map/neighborhood','git/open','canvas/panel'].includes(key))return typeof item==='boolean';
      if(key==='canvas/view')return item==='follow'||item==='repository'||item==='agents';
      if(key.startsWith('home/group/'))return typeof item==='boolean'||typeof item==='number';
      return false;
    });
    for(const pair of clean) {
      if(pair[0]==='location')pair[1]=location(pair[1]);
      if(pair[0]==='evidence/trail'&&record(pair[1])&&Array.isArray(pair[1].visits)) {
        pair[1]={cursor:typeof pair[1].cursor==='number'?Math.trunc(pair[1].cursor):-1,visits:pair[1].visits.slice(-8).flatMap((visit,index)=>record(visit)?[{id:index,location:location(visit.location),memory:entries(visit.memory,readerSlot).filter(([key,item])=>readerValue(key,item))}]:[])};
      }
      // Search strings are user input; no controller, source body, grant or draft fields survive.
    }
    return [{id:session.id,revision:typeof session.revision==='number'&&Number.isSafeInteger(session.revision)&&session.revision>=0?session.revision:0,entries:clean}];
  });
  const result:WorkingLocations={version:1,sessions};
  if(typeof input.last==='string'&&input.last.length<=256&&/^[\w+.-]+$/.test(input.last))result.last=input.last;
  return result;
}
