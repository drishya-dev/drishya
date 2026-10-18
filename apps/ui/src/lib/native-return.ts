import { useApp } from '../state.ts';
interface ReturnLocation {workspace:boolean;selectedOp?:string;filePanel?:string;filePanelFocus?:'change';filePanelLine?:number;filePanelEvidence?:string;currentFile?:string;explore:boolean}
const contexts=new WeakMap<object,Map<string,ReturnLocation>>();
export function rememberNativeReading(source:object,id:string) {
  const state=useApp.getState();
  if(!state.developerWorkspace&&!state.selectedOp&&!state.filePanel&&!state.currentFile)return;
  let sessions=contexts.get(source);if(!sessions){sessions=new Map();contexts.set(source,sessions);}
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
