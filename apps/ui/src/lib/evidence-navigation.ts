export interface EvidenceLocation {
  filePanel?: string;
  filePanelFocus?: 'change';
  filePanelEvidence?: string;
  filePanelLine?: number;
  currentFile?: string;
  selectedOp?: string;
  explore: boolean;
}

export interface EvidenceVisit {
  id: number;
  location: EvidenceLocation;
  memory: Map<string, unknown>;
}

const identity = (location: EvidenceLocation) => JSON.stringify([location.currentFile, location.filePanel, location.filePanelFocus, location.filePanelEvidence, location.filePanelLine, location.selectedOp, location.explore]);

/** Ephemeral bounded reading visits. No fetched source cache or capability grants. */
export class EvidenceTrail {
  private visits: EvidenceVisit[] = [];
  private cursor = -1;
  private nextId = 0;
  readonly limit: number;
  constructor(limit = 8) { this.limit = Math.max(2, limit); }
  get current() { return this.visits[this.cursor]; }
  get canBack() { return this.cursor > 0; }
  get canForward() { return this.cursor < this.visits.length - 1; }
  snapshot() { return {cursor:this.cursor,visits:this.visits.map(visit=>({id:visit.id,location:visit.location,memory:[...visit.memory]}))}; }
  static restore(saved:{cursor:number;visits:{id:number;location:EvidenceLocation;memory:[string,unknown][]}[]}) {
    const trail=new EvidenceTrail();
    trail.visits=saved.visits.slice(-8).map(visit=>({...visit,memory:new Map(visit.memory)}));
    trail.cursor=Math.max(-1,Math.min(saved.cursor,trail.visits.length-1));
    trail.nextId=Math.max(0,...trail.visits.map(visit=>visit.id+1));
    return trail;
  }
  visit(location: EvidenceLocation) {
    if (this.current && identity(this.current.location) === identity(location)) {
      this.current.location = { ...location };
      return this.current;
    }
    const previousFile=location.currentFile?[...this.visits].reverse().find(visit=>identity(visit.location)===identity(location)):undefined;
    this.visits.splice(this.cursor + 1);
    this.visits.push({ id: this.nextId++, location: { ...location }, memory: new Map(previousFile?.memory) });
    if (this.visits.length > this.limit) this.visits.shift();
    this.cursor = this.visits.length - 1;
    return this.current!;
  }
  move(direction: -1 | 1) {
    const next = this.cursor + direction;
    if (next < 0 || next >= this.visits.length) return undefined;
    this.cursor = next;
    return this.current;
  }
}
