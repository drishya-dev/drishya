import type { CurrentFile } from '../api.ts';

/** At most two snapshots per mounted reader. Never persist source bodies. */
export interface SourceVersions { shown?:CurrentFile; candidate?:CurrentFile; previous?:CurrentFile }
export function sameSource(a:CurrentFile,b:CurrentFile) {return a.text===b.text&&a.redacted===b.redacted;}
export function observeSource(state:SourceVersions,next:CurrentFile):SourceVersions {
  if(!state.shown)return {shown:next};
  if(sameSource(state.shown,next))return {shown:next,previous:state.previous};
  return {shown:state.shown,candidate:next};
}
export function acceptSource(state:SourceVersions):SourceVersions {
  return state.candidate?{shown:state.candidate,previous:state.shown}:state;
}
