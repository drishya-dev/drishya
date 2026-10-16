import { workingLocations, type WorkingLocations } from '../../../../packages/contracts/src/working-locations.ts';
import { EvidenceTrail } from './evidence-navigation.ts';
const changed=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('drishya-location-change'));};
/** Eight bounded session locations per data source. Never store source bodies,
 * graphs, credentials, grants or attachment bytes in navigation memory. */
class LocationMemory extends Map<string, unknown> {
  override set(key: string, value: unknown) {
    this.delete(key); super.set(key, value);
    if (this.size > 64) this.delete(this.keys().next().value!);
    changed();
    return this;
  }
}
export class WorkspaceMemory {
  private sessions = new Map<string, Map<string, unknown>>();
  private revisions:Record<string,number>={};
  private checkpoints=new Map<string,string>();
  private home=new LocationMemory();
  session(id: string) {
    if(id==='@home')return this.home;
    const value = this.sessions.get(id) ?? new LocationMemory();
    this.sessions.delete(id); this.sessions.set(id, value);
    if (this.sessions.size > 8) this.sessions.delete(this.sessions.keys().next().value!);
    return value;
  }
  clear(id: string) { this.sessions.delete(id); }
  snapshot(last?:string):WorkingLocations {
    return workingLocations({version:1,last,sessions:[{id:'@home',revision:this.revisions['@home']??0,entries:[...this.home]},...[...this.sessions].map(([id,entries])=>({id,revision:this.revisions[id]??0,entries:[...entries].map(([key,value])=>[key,value instanceof Set?[...value]:value instanceof EvidenceTrail?value.snapshot():value])}))]});
  }
  versions(revisions:Record<string,number>,written:string[]) {
    // A response lists remote scopes too. Advancing their versions without their
    // contents would authorize a later stale overwrite from this window.
    for(const id of written)if(id in revisions)this.revisions[id]=revisions[id]!;
    for(const id of Object.keys(this.revisions))if(!(id in revisions))delete this.revisions[id];
  }
  saved(id:string) {return this.checkpoints.get(id);}
  committed(sessions:WorkingLocations['sessions']) {for(const session of sessions)this.checkpoints.set(session.id,JSON.stringify(session.entries));}
  restore(snapshot:WorkingLocations) {
    for(const session of workingLocations(snapshot).sessions) {
      this.revisions[session.id]=session.revision??0;
      this.checkpoints.set(session.id,JSON.stringify(session.entries));
      const memory=this.session(session.id);
      for(const [key,value] of session.entries) {
        if(key==='folders/open'&&Array.isArray(value))memory.set(key,new Set(value));
        else if(key==='evidence/trail'&&value&&typeof value==='object')memory.set(key,EvidenceTrail.restore(value as Parameters<typeof EvidenceTrail.restore>[0]));
        else memory.set(key,value);
      }
    }
  }
}
const sources = new WeakMap<object, WorkspaceMemory>();
export function workspaceMemory(source: object) {
  let memory = sources.get(source);
  if (!memory) { memory = new WorkspaceMemory(); sources.set(source, memory); }
  return memory;
}
