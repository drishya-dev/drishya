export interface EvidenceLocation {
  filePanel?: string;
  filePanelFocus?: 'change';
  filePanelEvidence?: string;
  currentFile?: string;
  selectedOp?: string;
  explore: boolean;
  inspectorTab: 'detail' | 'evidence' | 'explain';
  inspectorWidth: number;
}

export interface EvidenceVisit {
  id: number;
  location: EvidenceLocation;
  memory: Map<string, unknown>;
}

const identity = (location: EvidenceLocation) => JSON.stringify([location.currentFile, location.filePanel, location.filePanelFocus, location.filePanelEvidence, location.selectedOp, location.explore]);

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
  visit(location: EvidenceLocation) {
    if (this.current && identity(this.current.location) === identity(location)) {
      this.current.location = { ...location };
      return this.current;
    }
    this.visits.splice(this.cursor + 1);
    this.visits.push({ id: this.nextId++, location: { ...location }, memory: new Map() });
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
