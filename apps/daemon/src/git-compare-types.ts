/** GIT-8 Compare DTOs. Plain data, shared by the daemon and the Modern UI. */
import type {GitBranchComparison,GitSessionLink} from './git-types.ts';

export interface CompareRef {
  /** Full ref name (`refs/heads/x`) the daemon accepts back; PR heads without a local ref use their commit id. */
  ref:string; name:string; kind:'branch'|'remote'|'tag'; tip:string; current:boolean; lastCommit?:string;
}
export interface CompareRefs {
  generation:string; shallow:boolean;
  /** The commit HEAD points at; present even when HEAD is detached and no branch is checked out. */
  head?:string;
  /** The checked-out branch, when HEAD is on one. */
  current?:CompareRef;
  /** The repository's default branch: `origin/HEAD` when present locally, else `main` or `master`. */
  defaultBase?:CompareRef;
  refs:CompareRef[]; total:number;
}
export interface CompareSide {ref:string;name:string;tip:string}
/** `head` = the compare side's own work since the merge-base, `base` = the base side's, `both` = a file both sides changed (a merge can conflict). */
export type CompareGroup='both'|'head'|'base';
export interface CompareFile {
  path:string; group:CompareGroup;
  /** Git status letter of the compare side's change (`A`, `M`, `D`, `T`), and of the base side's change. */
  headStatus?:string; baseStatus?:string;
  /** Identity of the change shown first (the blobs it goes from and to), and of the base side's change for a file changed on both. Reviewed marks key on it. */
  fingerprint:string; baseFingerprint?:string;
  /** `+N −M` of the side shown first: the compare side's change, else the base side's. Absent for binary files. */
  added?:number; removed?:number; baseAdded?:number; baseRemoved?:number; binary?:boolean;
  /** Remote (GitHub) compares carry each patch; local compares fetch it per file. */
  patch?:string;
}
export interface CompareCommit {hash:string;subject:string;author:string;time:string;session?:GitSessionLink}
export interface GitCompareResult {
  base:CompareSide; head:CompareSide; mergeBase?:string;
  state:GitBranchComparison['state']|'remote';
  ahead?:number; behind?:number;
  files:CompareFile[]; omitted:number; protectedCount:number;
  commits:CompareCommit[]; commitTotal:number;
  /** `local`: read from this machine's Git objects. `github`: GitHub's read-only compare through `gh`; only the compare side's changes are known. */
  source:'local'|'github';
  generation:string; sampledAt:string;
}
export interface CompareFilePatch {path:string;side:'head'|'base';patch:string;fingerprint:string;binary:boolean}

export type ComparePullsStatus='ready'|'disabled'|'gh-missing'|'gh-unauthenticated'|'no-remote'|'failed';
export interface ComparePull {
  number:number; title:string; author?:string; draft?:boolean; url:string;
  baseName:string; headName:string; headOid:string;
  /** The local ref that stands for the PR's base (`main`), when there is one. */
  baseRef?:CompareRef;
  /** Whether the PR's head commit exists in this repository's objects. */
  local:boolean;
  /** A local branch that already points at the head commit, to name it the way the person knows it. */
  headRef?:CompareRef;
}
export interface ComparePulls {status:ComparePullsStatus;repo?:string;pulls:ComparePull[];signedIn?:boolean}

/** What agents edited a path in the session being read. Names come from the projection's agents. */
/** `elsewhere`: every one of this agent's edits was in another checkout of the repository (a `worktree-…` root), not the one this session started in. */
export interface CompareEvidenceAgent {agentId:string;edits:number;firstOperationId:string;lastOperationId:string;firstTime?:string;elsewhere?:boolean}
export interface CompareEvidence {[path:string]:{agents:CompareEvidenceAgent[]}}
