/** Current Git review DTOs, independent of captured event contracts and Node implementation. */
export interface GitFile { path: string; previousPath?: string; status: string; fingerprint: string; patch: string }
export interface GitSnapshot {
  scope: 'current-git'; head: string; branch: string; sampledAt: string; fingerprint: string; files: GitFile[]; omitted: number; limit: number;
  pageStart?: number; totalAllowed?: number; protectedCount?: number; omissions?: GitOmission[];
}
export interface GitOmission { path: string; reason: 'content-limit' | 'process-limit' }

export interface GitReference { id:string; name:string; kind:'branch'|'remote'|'tag'; tip:string; current:boolean }
export interface GitCommit { hash:string; parents:string[]; author:string; time:string; subject:string; labels:string[]; omittedLabels:number }
/** A commit whose hash appears in this session's captured command output: the first such output, never proof the session made it. */
export interface GitSessionLink { turn?: number; time?: string; observationId: string; operationId?: string }
export interface GitHistoryPage {sessionLinks?: Record<string, GitSessionLink>;mainline?:{name:string;tip:string};
  generation:string; head:string; branch:string; shallow:boolean; sampledAt:string;
  commits:GitCommit[]; start:number; more:boolean; limit:number;
  references:GitReference[]; referenceStart:number; referenceCount:number; referenceTotal:number;
  selectedReference?:GitReference;
  /** Squash-merge evidence (see git-history.ts): content signatures of each non-merge commit's own change, and of each
   * branch head's whole change since it left the primary line. Equal values mean identical written file contents. */
  changeSignatures?:Record<string,string>; branchSignatures?:Record<string,string>;
}
export interface GitCommitDetail {
  hash:string; parents:string[]; parent?:string; message:string;
  files:GitFile[]; start:number; total:number; protectedCount:number; omissions:GitOmission[]; limit:number;
}
