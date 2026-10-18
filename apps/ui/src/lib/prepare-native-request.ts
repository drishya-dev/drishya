import { useApp } from '../state.ts';
import { promptDrafts } from './prompt-drafts.ts';
import { PROMPT_BYTES, utf8Bytes } from './prompt-files.ts';
import { rememberFollowUp } from './follow-up.ts';

/** Prepare text only. The existing composer owns submission, consent and native permissions. */
export function prepareNativeRequest(request: string, source: object, id: string, files?:File[], context?:{operationId?:string;path?:string}) {
  const state = useApp.getState();
  if (state.source !== source || state.recordingId !== id || state.source?.kind !== 'daemon' || !state.recordingId || state.recordingId.includes('+') || state.mode !== 'history') throw new Error('Choose one local native session in history mode.');
  const drafts = promptDrafts(state.source), previous = drafts.get(state.recordingId);
  const text = [previous, request].filter(Boolean).join('\n\n');
  if (utf8Bytes(text) > PROMPT_BYTES) throw new Error('The combined request exceeds 64 KiB. Shorten the composer draft before preparing this request.');
  drafts.set(state.recordingId,text);
  rememberFollowUp(source,id,{after:state.projection?.lastSequence??-1,operationId:context?.operationId??state.selectedOp,path:context?.path});
  useApp.getState().set({ developerWorkspace:false, explore:false, currentFile:undefined, filePanel:undefined, selectedOp:undefined });
  window.dispatchEvent(new Event('drishya-composer-draft'));
  if(files?.length)window.dispatchEvent(new CustomEvent('drishya-composer-files',{detail:{source,id,files}}));
}
