import {useState} from 'react';
import type {Operation} from '@drishya/contracts';
import {useApp} from '../state.ts';
import {beginInvestigation} from '../lib/native-return.ts';
import {prepareNativeRequest} from '../lib/prepare-native-request.ts';
import {FileReadingActions} from './FileReadingActions.tsx';

export function prepareCorrection(op:Operation,text:string) {
  const state=useApp.getState();
  if(!state.source||!state.recordingId)throw new Error('Choose a local recording first.');
  beginInvestigation(state.source,state.recordingId,op);
  prepareNativeRequest(`Investigate this action before proposing a correction.\nAction: ${JSON.stringify(op.title)}\nPaths: ${op.paths.map(path=>JSON.stringify(path.path)).join(', ')||'No file location'}\nReviewer question (local note, not recorded agent output):\n${text}\nUse native permissions. Inspect current files before edits, report conflicts, show the resulting diff and actual checks. State anything unavailable.`,state.source,state.recordingId);
}
/** The captured action remains the return point while current files have their own consent. */
export function InvestigationActions({op}:{op:Operation}) {
  const source=useApp(s=>s.source),id=useApp(s=>s.recordingId),mode=useApp(s=>s.mode);
  const paths=[...new Set(op.paths.map(item=>item.path))], [path,setPath]=useState(paths[0]??''), withMaterial=(op.detail.kind==='read'||op.detail.kind==='edit')&&paths.length<2;
  const modern=document.documentElement.dataset.uiVersion==='modern';
  if(modern&&!path)return null;
  if(source?.kind!=='daemon'||!id||id.includes('+')||mode!=='history')return null;
  return <section className="investigation-entry" aria-label="Investigate this action">{!modern&&<><h3>Investigate this action</h3><p>Read what the agent saw here, or today’s file in Workspace.</p></>}{paths.length>1&&<label>Current file<select aria-label="Investigation file" value={path} onChange={e=>setPath(e.target.value)}>{paths.map(path=><option key={path}>{path}</option>)}</select></label>}{path?<FileReadingActions path={path} op={op} copyPath={!modern} hideCaptured={withMaterial} hideReveal={withMaterial} workspaceLabel="Open current file for correction" beforeWorkspace={()=>beginInvestigation(source,id,op)}/>:<small>No file location was recorded. Leave an anchored question below.</small>}</section>;
}
