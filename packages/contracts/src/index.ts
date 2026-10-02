// The seam between capture and rendering. DRAFT — changes need both builders (AGENTS.md).
// Shapes follow docs/review/03-engineering-plan.md §3–4: immutable observations, a versioned
// projection built from them, typed evidence links, historical artifacts with explicit gaps.

export const CONTRACT_VERSION = '0.1.0-draft';

// ─── Observations: what a source actually said, sanitized, never rewritten ─────────────

export type Availability = 'complete' | 'partial' | 'metadata-only' | 'unavailable';

export interface ObservationSource {
  adapterId: string;
  adapterVersion: string;
  harnessVersion?: string;
  /** Opaque identity of the journal within an approved scope (a hash of its path). */
  sourceId: string;
  /** Changes when the source is truncated or replaced. */
  generation: number;
  /** Native record identity (e.g. a Claude record uuid), when the harness provides one. */
  recordId?: string;
  byteOffset: number;
  /** Index of this observation within one source record (one record can yield several). */
  part: number;
}

/** Normalised observation kinds. Adapters may emit any string; unknown kinds stay visible. */
export type ObservationKind =
  | 'session.meta'
  | 'turn.start'
  | 'turn.end'
  | 'message.user'
  | 'message.assistant'
  | 'reasoning'
  | 'tool.call'
  | 'tool.result'
  | 'agent.spawn'
  | 'agent.stop'
  | 'compaction'
  | 'capture.gap'
  | 'unknown';

export interface Observation {
  /** Stable: the same source record always yields the same id, so re-import adds nothing. */
  id: string;
  recordingId: string;
  source: ObservationSource;
  /** Append order within the recording. Assigned by the store. */
  receivedSequence: number;
  sourceTime?: string;
  observedAt: string;
  workspaceRoot?: string;
  branchRef?: string;
  /** Acting agent. Subagents have their own id; see agent.spawn for the parent relation. */
  agentId: string;
  /** Native tool call id, so a call and its result correlate into one operation. */
  operationId?: string;
  kind: ObservationKind | (string & {});
  payload: ObservationPayload;
  privacyPolicyVersion: string;
  redactions: RedactionNote[];
  availability: Availability;
}

export type ObservationPayload =
  | SessionMetaPayload
  | MessagePayload
  | ToolCallPayload
  | ToolResultPayload
  | AgentSpawnPayload
  | AgentStopPayload
  | GapPayload
  | UnknownPayload
  | Record<string, unknown>;

export interface SessionMetaPayload {
  harness: HarnessId;
  harnessVersion?: string;
  cwd?: string;
  branch?: string;
  model?: string;
  title?: string;
}

export interface MessagePayload {
  text: TextValue;
  model?: string;
  /** Codex exposes reasoning only as summaries; Claude as thinking text. */
  exposure?: 'full' | 'summary';
}

export interface ToolCallPayload {
  /** Harness tool name exactly as captured, e.g. "Read", "shell_command", "mcp__github__search". */
  tool: string;
  input: unknown;
}

export interface ToolResultPayload {
  tool?: string;
  isError: boolean;
  /** Plain text the model received. */
  text?: TextValue;
  /** Harness-structured result, when present (Claude's toolUseResult). Sanitized. */
  structured?: unknown;
  exitCode?: number | null;
  durationMs?: number;
}

export interface AgentSpawnPayload {
  childAgentId: string;
  agentType?: string;
  description?: string;
  /** How the child was tied to the parent. */
  basis: 'source-id' | 'captured-reference' | 'heuristic';
}

export interface AgentStopPayload {
  reason?: string;
}

export interface GapPayload {
  reason: 'malformed-record' | 'oversized-record' | 'unsupported-content' | 'source-truncated' | 'privacy-omitted';
  bytes?: number;
  detail?: string;
}

export interface UnknownPayload {
  recordType: string;
  /** Sanitized, bounded extras only (engineering plan §3.3). */
  extras?: unknown;
}

/**
 * A string that may have been externalised to the blob store. Large content lives in blobs so
 * observations stay small and seekable.
 */
export type TextValue = string | BlobText;

export interface BlobText {
  $blob: string; // sha256 of sanitized bytes
  bytes: number;
  preview: string;
}

export function isBlobText(v: unknown): v is BlobText {
  return typeof v === 'object' && v !== null && typeof (v as BlobText).$blob === 'string';
}

export interface RedactionNote {
  /** JSON-path-ish location of the field, e.g. "payload.input.command". */
  field: string;
  rule: string;
  count: number;
}

// ─── Harnesses and capabilities ──────────────────────────────────────────────────────────

export type HarnessId = 'claude-code' | 'codex' | (string & {});

export type CapabilityState = 'supported' | 'partial' | 'unavailable';

/** Feature-level capabilities, not a single numbered level (engineering plan §3.2). */
export interface CapabilityMatrix {
  liveLifecycle: CapabilityState;
  chunkedOutput: CapabilityState;
  readContent: CapabilityState;
  patchIntent: CapabilityState;
  confirmedWrite: CapabilityState;
  beforeSnapshot: CapabilityState;
  afterSnapshot: CapabilityState;
  exposedRationale: CapabilityState;
  delegation: CapabilityState;
  replay: CapabilityState;
}

export interface AdapterDescriptor {
  id: string;
  harness: HarnessId;
  version: string;
  label: string;
  testedHarnessVersions: string[];
  capabilities: CapabilityMatrix;
}

// ─── Projection: derived, versioned, rebuildable ─────────────────────────────────────────

export type Provenance =
  | { kind: 'captured'; observationIds: string[] }
  | { kind: 'derived'; rule: string; observationIds: string[] }
  | { kind: 'generated'; generator: string; observationIds: string[] };

/** The shapes the renderer knows. Harness names never reach it; these do. */
export type OperationKind =
  | 'read'
  | 'search'
  | 'edit'
  | 'write'
  | 'shell'
  | 'test'
  | 'mcp'
  | 'web'
  | 'spawn'
  | 'plan'
  | 'other';

export type OperationStatus = 'running' | 'ok' | 'error' | 'unknown';

export interface Operation {
  id: string;
  agentId: string;
  kind: OperationKind;
  /** Captured tool name, shown in inspection. */
  tool: string;
  /** Short, derived, one line. Carries its own provenance. */
  title: string;
  titleProvenance: Provenance;
  /** Where the tool came from: "native" or an MCP server name. */
  origin: { type: 'native'; tool: string } | { type: 'mcp'; server: string; tool: string };
  status: OperationStatus;
  startSequence: number;
  endSequence?: number;
  startTime?: string;
  endTime?: string;
  /** Workspace-relative paths this operation touched, with how we know. */
  paths: PathRef[];
  /** Kind-specific detail for the surface, all sanitized. */
  detail: OperationDetail;
  artifactIds: string[];
  observationIds: string[];
  /** How the kind itself was determined, e.g. a shell command classified as a test run. */
  classification: Provenance;
}

export interface PathRef {
  path: string;
  role: 'read' | 'write' | 'search-hit' | 'test' | 'mentioned';
  basis: 'captured' | 'derived';
  lines?: { start: number; end: number };
}

export type OperationDetail =
  | { kind: 'read'; path: string; startLine: number; lineCount: number; totalLines?: number; excerptArtifactId?: string }
  | { kind: 'search'; query: string; mode: 'text' | 'file' | 'web'; hits: SearchHit[]; total?: number }
  | { kind: 'edit'; path: string; hunks: Hunk[]; created: boolean; reconstruction: Availability; reconstructionNote?: string }
  | { kind: 'shell'; command: string; exitCode?: number | null; outputArtifactId?: string; outputPreview?: string }
  | { kind: 'test'; command: string; exitCode?: number | null; summary?: TestSummary; outputArtifactId?: string; outputPreview?: string }
  | { kind: 'mcp'; server: string; tool: string; input: unknown; resultPreview?: string }
  | { kind: 'web'; url?: string; query?: string; resultPreview?: string }
  | { kind: 'spawn'; childAgentId?: string; agentType?: string; description?: string; resultPreview?: string }
  | { kind: 'plan'; items: { text: string; status: string }[] }
  | { kind: 'other'; input: unknown; resultPreview?: string };

export interface SearchHit {
  path: string;
  line?: number;
  text?: string;
}

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  /** Unified lines with a leading ' ', '+' or '-'. */
  lines: string[];
}

export interface TestSummary {
  framework: string;
  passed: number;
  failed: number;
  skipped: number;
  failures: { name: string; file?: string; line?: number; message?: string }[];
  /** Test names seen passing, when the output lists them. */
  passing: string[];
  basis: 'derived';
}

export interface Prose {
  id: string;
  agentId: string;
  role: 'assistant' | 'reasoning' | 'user';
  text: string;
  truncated: boolean;
  exposure: 'full' | 'summary';
  sequence: number;
  time?: string;
  observationIds: string[];
}

export interface Agent {
  id: string;
  harness: HarnessId;
  label: string;
  parentId?: string;
  agentType?: string;
  model?: string;
  firstSequence: number;
  lastSequence: number;
  stoppedSequence?: number;
}

export type ArtifactKind = 'excerpt' | 'snapshot' | 'patch' | 'output';

/** A captured or reconstructed piece of content with explicit availability. */
export interface Artifact {
  id: string;
  kind: ArtifactKind;
  path?: string;
  /** For excerpts: the captured range. Nothing outside it is known. */
  range?: { start: number; end: number };
  totalLines?: number;
  /** When this content is known to have existed. */
  observedAtSequence: number;
  blob?: string;
  bytes: number;
  lineCount: number;
  availability: Availability;
  /** "captured" if the harness gave us these bytes; "derived" if we reconstructed them. */
  provenance: Provenance;
  /** Whether line numbers in the captured text were added by the harness and stripped. */
  harnessLineNumbers?: boolean;
  redacted: boolean;
  note?: string;
}

export type EvidenceRelation =
  | 'tool-result'
  | 'explicit-reference'
  | 'same-artifact'
  | 'temporal-neighbor'
  | 'static-import'
  | 'test-reference'
  | 'test-outcome-change'
  | 'observed-write-overlap'
  | 'spawned';

export interface EvidenceLink {
  id: string;
  from: string;
  to: string;
  relation: EvidenceRelation;
  basis: 'source-id' | 'captured-reference' | 'deterministic-rule' | 'heuristic';
  sourceObservationIds: string[];
  ruleVersion?: string;
  /** Plain language, never causal unless the evidence is. */
  explanation: string;
}

/** One unit of playback. The timeline is what the transport steps through. */
export type TimelineItem =
  | { type: 'turn'; id: string; sequence: number; agentId: string; prompt?: string; time?: string }
  | { type: 'op-start'; id: string; operationId: string; sequence: number; agentId: string; time?: string }
  | { type: 'op-end'; id: string; operationId: string; sequence: number; agentId: string; time?: string }
  | { type: 'prose'; id: string; proseId: string; sequence: number; agentId: string; time?: string }
  | { type: 'agent-stop'; id: string; sequence: number; agentId: string; time?: string }
  | { type: 'gap'; id: string; sequence: number; agentId: string; reason: string; time?: string };

export interface Passage {
  id: string;
  agentId: string;
  /** Operations in the order they started. Rendered left to right. */
  operationIds: string[];
  /** Prose emitted right after these operations, rendered beneath. */
  proseIds: string[];
  firstStep: number;
  lastStep: number;
}

export interface Projection {
  reducerVersion: string;
  recordingId: string;
  observationCount: number;
  lastSequence: number;
  harnesses: HarnessId[];
  workspaceRoot?: string;
  title?: string;
  agents: Agent[];
  operations: Operation[];
  prose: Prose[];
  artifacts: Artifact[];
  links: EvidenceLink[];
  timeline: TimelineItem[];
  passages: Passage[];
  /** Files this recording touched, workspace-relative, with first/last step. */
  files: { path: string; firstStep: number; lastStep: number; roles: PathRef['role'][] }[];
  gaps: { sequence: number; reason: string; detail?: string }[];
  capabilities: Record<string, CapabilityMatrix>;
}

// ─── Recordings and sources ──────────────────────────────────────────────────────────────

export interface RecordingSummary {
  id: string;
  title: string;
  harness: HarnessId;
  workspaceRoot?: string;
  /** A user-chosen root for the repository map, when the captured workspace is elsewhere. */
  graphRoot?: string;
  sourcePath?: string;
  createdAt: string;
  updatedAt: string;
  firstSourceTime?: string;
  lastSourceTime?: string;
  observationCount: number;
  live: boolean;
  pinned: boolean;
  /** Set by the local API: some stored data was sealed under an older privacy policy. Re-import to apply the current one. */
  privacyOutdated?: boolean;
}

export interface DiscoveredSource {
  adapterId: string;
  harness: HarnessId;
  path: string;
  bytes: number;
  modifiedAt: string;
  /** Best-effort, read from the first records only. */
  cwd?: string;
  title?: string;
  importedRecordingId?: string;
  /** Related files the adapter reads together with this one (e.g. subagent transcripts). */
  companions: string[];
}

// ─── Repository map ──────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string; // workspace-relative path, forward slashes
  path: string;
  dir: string;
  language?: string;
  bytes: number;
  lines?: number;
  x: number;
  y: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: 'static-import';
  basis: 'deterministic-rule';
  specifier: string;
}

export interface RepoGraph {
  generation: string;
  root: string;
  /** "current" — built from the workspace as it is now, never presented as historical. */
  temporal: 'current' | 'recording-files-only';
  builtAt: string;
  indexerVersion: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  unresolved: { from: string; specifier: string }[];
  truncated: boolean;
  stats: { files: number; parsed: number; edges: number; unresolved: number; skipped: number; ms: number };
}

// ─── Replay bundle (static export) ───────────────────────────────────────────────────────

export interface ReplayBundle {
  format: 'drishya-replay';
  version: 1;
  exportedAt: string;
  privacyPolicyVersion: string;
  recording: RecordingSummary;
  projection: Projection;
  graph?: RepoGraph;
  /** Artifact text by artifact id. Only sanitized content. */
  artifactText: Record<string, string>;
}
