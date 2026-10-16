/** Eight ephemeral session locations per data source. Never store source bodies,
 * graphs, credentials, grants or attachment bytes in navigation memory. */
class LocationMemory extends Map<string, unknown> {
  override set(key: string, value: unknown) {
    this.delete(key); super.set(key, value);
    if (this.size > 64) this.delete(this.keys().next().value!);
    return this;
  }
}
export class WorkspaceMemory {
  private sessions = new Map<string, Map<string, unknown>>();
  session(id: string) {
    const value = this.sessions.get(id) ?? new LocationMemory();
    this.sessions.delete(id); this.sessions.set(id, value);
    if (this.sessions.size > 8) this.sessions.delete(this.sessions.keys().next().value!);
    return value;
  }
  clear(id: string) { this.sessions.delete(id); }
}
const sources = new WeakMap<object, WorkspaceMemory>();
export function workspaceMemory(source: object) {
  let memory = sources.get(source);
  if (!memory) { memory = new WorkspaceMemory(); sources.set(source, memory); }
  return memory;
}
