// Pure types shared by the daemon and the UI for LINK-1 hover cards (no Node imports, so the UI can import them).
export interface GithubItem {
  kind: 'pull' | 'issue';
  owner: string; repo: string; number: number;
  state: string; title: string; author?: string; url: string;
  draft?: boolean; merged?: boolean;
  additions?: number; deletions?: number; changedFiles?: number;
}
export type GithubReply =
  | { status: 'ready'; item: GithubItem }
  | { status: 'disabled' | 'gh-missing' | 'gh-unauthenticated' | 'not-found' | 'failed' };

export interface GitRefSummary { found: boolean; kind?: 'commit' | 'branch'; name?: string; hash?: string; subject?: string; author?: string; date?: string; additions?: number; deletions?: number; files?: number }
