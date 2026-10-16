/** Text-only, memory-only drafts. Attachments and credentials are never persisted. */
export class PromptDrafts {
  private drafts = new Map<string, string>();
  get(id: string) { return this.drafts.get(id) ?? ''; }
  hasDrafts() {return this.drafts.size>0;}
  set(id: string, text: string) {
    this.drafts.delete(id);
    if (text) this.drafts.set(id, text.slice(0, 65_536));
    if (this.drafts.size > 8) this.drafts.delete(this.drafts.keys().next().value!);
    if(typeof window!=='undefined')window.dispatchEvent(new Event('drishya-unsaved-change'));
  }
}
const sources = new WeakMap<object, PromptDrafts>();
export function promptDrafts(source: object) {
  let drafts = sources.get(source);
  if (!drafts) { drafts = new PromptDrafts(); sources.set(source, drafts); }
  return drafts;
}
