import { useApp } from '../state.ts';
import type { Operation } from '@drishya/contracts';
import type { ControllerStatus } from '../api.ts';
import {operationObservation} from '../../../../packages/scene/src/operation-observations.ts';
interface ReturnLocation {workspace:boolean;selectedOp?:string;filePanel?:string;filePanelFocus?:'change';filePanelLine?:number;filePanelEvidence?:string;currentFile?:string;explore:boolean}
const contexts=new WeakMap<object,Map<string,ReturnLocation>>();
export interface Investigation {operationId:string;sequence?:number;title:string;path?:string;prepared:boolean;runId?:string;afterSequence?:number}
export const investigationReference=(item:Investigation)=>`Review origin: captured operation ${JSON.stringify(item.operationId)}, observation ${item.sequence??'unavailable'}.`;
const investigations=new WeakMap<object,Map<string,Investigation>>();
const changed=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('drishya-native-return'));};
export function investigation(source:object,id:string) {return investigations.get(source)?.get(id);}
export function beginInvestigation(source:object,id:string,op:Operation) {
  investigations.get(source)?.delete(id);
  rememberNativeReading(source,id);
  let sessions=investigations.get(source);if(!sessions){sessions=new Map();investigations.set(source,sessions);}
  sessions.delete(id);sessions.set(id,{operationId:op.id,sequence:operationObservation(useApp.getState().projection,op.id),title:op.title,path:op.paths[0]?.path,prepared:false});
  if(sessions.size>8)sessions.delete(sessions.keys().next().value!);
  changed();
}
export function markInvestigationPrepared(source:object,id:string) {
  const item=investigation(source,id);if(item){item.prepared=true;item.runId=undefined;item.afterSequence=undefined;changed();}
}
/** Only a response to our explicit submit records acceptance; status polling cannot create it. */
export function acceptInvestigation(source:object,id:string,status:ControllerStatus,prompt:string) {
  const item=investigation(source,id);
  if(!item?.prepared||item.runId||!status.runId||status.afterSequence===undefined||!prompt.includes(investigationReference(item)))return;
  item.runId=status.runId;item.afterSequence=status.afterSequence;changed();
}
export function clearInvestigation(source:object,id:string) {investigations.get(source)?.delete(id);contexts.get(source)?.delete(id);changed();}
export function rememberNativeReading(source:object,id:string) {
  const state=useApp.getState();
  if(!state.developerWorkspace&&!state.selectedOp&&!state.filePanel&&!state.currentFile)return;
  let sessions=contexts.get(source);if(!sessions){sessions=new Map();contexts.set(source,sessions);}
  // A correction prepared from a draft keeps the original captured action as its home.
  if(investigation(source,id)&&sessions.has(id))return;
  sessions.delete(id);sessions.set(id,{workspace:state.developerWorkspace,selectedOp:state.selectedOp,filePanel:state.filePanel,filePanelFocus:state.filePanelFocus,filePanelLine:state.filePanelLine,filePanelEvidence:state.filePanelEvidence,currentFile:state.currentFile,explore:state.explore});
  if(sessions.size>8)sessions.delete(sessions.keys().next().value!);
  if(typeof window!=='undefined')window.dispatchEvent(new Event('drishya-native-return'));
}
export function hasNativeReading(source:object,id:string) {return contexts.get(source)?.has(id)??false;}
export async function returnToNativeReading(source:object,id:string) {
  const location=contexts.get(source)?.get(id),current=()=>{const state=useApp.getState();return state.source===source&&state.recordingId===id&&state.mode==='history';};
  if(!location||!current())return;
  let state=useApp.getState();
  if(location.selectedOp&&state.historyPage&&!state.projection?.operations.some(op=>op.id===location.selectedOp))await state.loadHistoryWindow({selectedOperationId:location.selectedOp});
  if(!current())return;state=useApp.getState();
  const {workspace,...reading}=location;
  state.set(workspace?{developerWorkspace:true,explore:false,selectedOp:undefined,filePanel:undefined,currentFile:undefined,follow:false}:{...reading,developerWorkspace:false,follow:false});
}
