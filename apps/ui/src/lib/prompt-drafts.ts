/** Text-only, memory-only drafts. Attachments and credentials are never persisted. */
export class PromptDrafts {
  private drafts = new Map<string, string>();
  get(id: string) { return this.drafts.get(id) ?? ''; }
  set(id: string, text: string) {
    this.drafts.delete(id);
    if (text) this.drafts.set(id, text.slice(0, 65_536));
    if (this.drafts.size > 8) this.drafts.delete(this.drafts.keys().next().value!);
  }
}
const sources = new WeakMap<object, PromptDrafts>();
export function promptDrafts(source: object) {
  let drafts = sources.get(source);
  if (!drafts) { drafts = new PromptDrafts(); sources.set(source, drafts); }
  return drafts;
}
