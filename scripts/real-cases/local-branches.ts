import type {RealCase} from './types.ts';

export const localBranches:RealCase={
  name:'local-branches',
  about:'Captured workspace roots for read-only Git branch acceptance (pair with git-branches browser spec)',
  harnesses:['claude-code','codex'],prefilter:'cwd',
  scan(row,harness){
    const root=harness==='codex'?(row.type==='session_meta'?(row.payload as {cwd?:unknown}|undefined)?.cwd:undefined):row.cwd;
    return typeof root==='string'?{hits:1}:undefined;
  },
  verify(projection){return [`${projection.observationCount} observations imported; recording-root access and exact branch counts are checked by the opt-in Git branch browser spec`];}
};
