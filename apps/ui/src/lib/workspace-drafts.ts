import { utf8Bytes } from './prompt-files.ts';

export interface WorkspaceDraft { base: string; text: string; modifiedAt: string }
export const WORKSPACE_DRAFT_BYTES = 32 * 1024;
/** Memory only, eight explicit drafts per source; refuse a ninth rather than evict work. */
export class WorkspaceDrafts {
  private items = new Map<string, WorkspaceDraft>();
  get(id: string, path: string) { return this.items.get(JSON.stringify([id,path])); }
  hasChanges() {return [...this.items.values()].some(item=>item.text!==item.base);}
  create(id: string, path: string, draft: WorkspaceDraft) {
    // A slower second pane must not replace edits made while it loaded.
    if (!this.get(id,path)) this.set(id,path,draft);
  }
  set(id: string, path: string, draft: WorkspaceDraft) {
    const key = JSON.stringify([id,path]);
    if (!this.items.has(key) && this.items.size >= 8) throw new Error('Eight drafts are open. Discard a retained draft before editing another file; preparing a request keeps the draft.');
    if (utf8Bytes(draft.text) > WORKSPACE_DRAFT_BYTES || utf8Bytes(draft.base) > WORKSPACE_DRAFT_BYTES) throw new Error('Local drafts support up to 32 KiB of UTF-8 text.');
    this.items.set(key, draft);
    if(typeof window!=='undefined')window.dispatchEvent(new Event('drishya-unsaved-change'));
  }
  entries() { return [...this.items.keys()].map(key => { const [id,path] = JSON.parse(key) as [string,string]; return {id,path}; }); }
  discard(id: string, path: string) { this.items.delete(JSON.stringify([id,path]));if(typeof window!=='undefined')window.dispatchEvent(new Event('drishya-unsaved-change')); }
}
const sources = new WeakMap<object, WorkspaceDrafts>();
export function workspaceDrafts(source: object) {
  let store = sources.get(source);
  if (!store) { store = new WorkspaceDrafts(); sources.set(source,store); }
  return store;
}
