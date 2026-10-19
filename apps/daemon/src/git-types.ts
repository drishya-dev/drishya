/** Current Git review DTOs, independent of captured event contracts and Node implementation. */
export interface GitFile { path: string; previousPath?: string; status: string; fingerprint: string; patch: string }
export interface GitSnapshot {
  scope: 'current-git'; head: string; branch: string; sampledAt: string; fingerprint: string; files: GitFile[]; omitted: number; limit: number;
  pageStart?: number; totalAllowed?: number; protectedCount?: number; omissions?: GitOmission[];
}
export interface GitOmission { path: string; reason: 'content-limit' | 'process-limit' }

export interface GitReference { id:string; name:string; kind:'branch'|'remote'|'tag'; tip:string; current:boolean }
export interface GitCommit { hash:string; parents:string[]; author:string; time:string; subject:string; labels:string[]; omittedLabels:number }
export interface GitHistoryPage {mainline?:{name:string;tip:string};
  generation:string; head:string; branch:string; shallow:boolean; sampledAt:string;
  commits:GitCommit[]; start:number; more:boolean; limit:number;
  references:GitReference[]; referenceStart:number; referenceCount:number; referenceTotal:number;
  selectedReference?:GitReference;
}
export interface GitCommitDetail {
  hash:string; parents:string[]; parent?:string; message:string;
  files:GitFile[]; start:number; total:number; protectedCount:number; omissions:GitOmission[]; limit:number;
}
