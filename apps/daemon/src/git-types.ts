/** Current Git review DTOs, independent of captured event contracts and Node implementation. */
export interface GitFile { path: string; previousPath?: string; status: string; fingerprint: string; patch: string }
export interface GitSnapshot {
  scope: 'current-git'; head: string; branch: string; fingerprint: string; files: GitFile[]; omitted: number; limit: number;
  pageStart?: number; totalAllowed?: number; protectedCount?: number; omissions?: GitOmission[];
}
export interface GitOmission { path: string; reason: 'content-limit' | 'process-limit' }
