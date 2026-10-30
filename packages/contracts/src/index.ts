// The seam between capture and rendering. DRAFT — changes need both builders (AGENTS.md).
// Shapes follow docs/review/03-engineering-plan.md §3–4: immutable observations, a versioned
// projection built from them, typed evidence links, historical artifacts with explicit gaps.

export const CONTRACT_VERSION = '0.2.0-draft';

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
  | 'turn.detail'
  | 'message.user'
  | 'message.assistant'
  | 'reasoning'
  | 'tool.call'
  | 'tool.result'
  | 'agent.spawn'
  | 'agent.stop'
  | 'compaction'
  | 'capture.gap'
  | 'usage'
  | 'item.completed'
  | 'checkpoint'
  | 'external.change'
  | 'tools.snapshot'
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
  correlation?: { operationId: string; basis: 'source-id' | 'enclosing-call' };
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
  | UsagePayload
  | CompactionPayload
  | TurnDetailPayload
  | ItemPayload
  | UnknownPayload
  | Record<string, unknown>;

export interface SessionMetaPayload {
  harness: HarnessId;
  harnessVersion?: string;
  cwd?: string;
  branch?: string;
  model?: string;
  title?: string;
  agentNickname?: string;
  agentPath?: string;
  parentThreadId?: string;
  forkedFromId?: string;
  effort?: string;
  /** How the harness says this thread began: `user` or `subagent`. */
  threadSource?: string;
  /** The client or command that started the thread, as the harness names it (e.g. `exec`, `vscode`). */
  startedBy?: string;
  /** Sub-agent nesting depth below the root thread, as recorded (DATA-3). */
  spawnDepth?: number;
  agentRole?: string;
}

/** Settings a turn ran with, as the harness recorded them (Codex `turn_context`). Policy names only, never paths. */
export interface TurnSettings {
  model?: string;
  effort?: string;
  approvalPolicy?: string;
  sandbox?: string;
  permissionProfile?: string;
  collaborationMode?: string;
  approvalsReviewer?: string;
  personality?: string;
}

/**
 * Facts about one turn (DATA-3, schema S1). Separate from `turn.start`/`turn.end` so a re-import can add them to
 * recordings made earlier without a second turn; several observations may describe one `turnId` and the reducer merges them.
 */
export interface TurnDetailPayload {
  turnId: string;
  rootTurnId?: string;
  parentTurnId?: string;
  /** Why the turn began, as the harness names it (`composer`, `exec`, `edit_user_message`, …). */
  trigger?: string;
  initiatingAgentPath?: string;
  /** ISO times converted from the harness's epoch seconds; nothing is measured by Drishya. */
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  timeToFirstTokenMs?: number;
  outcome?: 'completed' | 'aborted';
  reason?: string;
  /** Present only if the harness recorded an error for the turn; the text is redacted at ingest. */
  error?: { message?: string; code?: string };
  settings?: TurnSettings;
}

/** A file at the start of a turn, as the harness checkpointed it: a backup reference, or "did not exist". */
export type BeforeTurn = { backup: string; version?: number; time?: string } | { absent: true; time?: string };

/** A file backup read on request from the harness's checkpoint folder (DATA-5). */
export type CheckpointFile =
  | { available: true; text: string; bytes: number; truncated: boolean; redacted: boolean }
  | { available: false; reason: 'not-recorded' | 'removed' | 'needs-workspace-approval' | 'protected' };

/** An image an action returned. `sha` names stored bytes; `omitted` says why there are none. */
export interface OperationImage { sha?: string; mime?: string; bytes?: number; width?: number; height?: number; omitted?: string }

/** How a command ran, as the harness recorded it (review125 S5). */
export interface CommandRun {
  interrupted?: boolean;
  backgroundTaskId?: string;
  timedOutAfterMs?: number;
  /** The harness's reading of a non-zero exit, e.g. "No matches found". */
  exitNote?: string;
  /** Full output the harness saved to a file because it was too large. Reference only; read on request. */
  persistedOutput?: { path: string; bytes?: number };
}

/** A harness-saved full output, read on request (DATA-4). */
export type PersistedOutput =
  | { available: true; text: string; bytes: number; truncated: boolean; redacted: boolean }
  | { available: false; reason: 'not-recorded' | 'removed' | 'outside-harness-folder' | 'protected' };

export interface MessagePayload {
  text: TextValue;
  model?: string;
  /** Codex exposes reasoning only as summaries; Claude as thinking text. `none`: a reasoning block was recorded without readable text. */
  exposure?: 'full' | 'summary' | 'none';
  /** Claude Code's permission mode when the person sent this prompt (e.g. acceptEdits, auto). */
  permissionMode?: string;
  /** CONTENT-1: images attached to this prompt; see ToolResultPayload.images. */
  images?: ToolResultPayload['images'];
  /** Why a `none` block has no text: stored encrypted, kept only as a signature, or recorded empty. */
  reason?: ReasoningGap;
}

export type ReasoningGap = 'encrypted' | 'signature-only' | 'empty';

/**
 * A harness checkpoint (review125 S5): which file backups it holds for one turn. References only;
 * the backup bytes stay in the harness's folder and are read on request. `absent`: the file did
 * not exist at the checkpoint (created in that turn).
 */
export interface CheckpointPayload {
  /** The harness's id for the prompt that opens the turn (Claude: the user message uuid). */
  messageId: string;
  at?: string;
  /** The harness session whose checkpoint folder holds the backups (a forked journal continues another session). */
  session?: string;
  files: { path: string; parentDir?: string; backup?: { name: string; version?: number; time?: string }; absent?: boolean }[];
}

/** A harness notice that a file changed on disk outside its own edit tools (review125 S5). Never attributed to a person. */
export interface ExternalChangePayload {
  path: string;
  /** The changed region as the harness showed it to the model, line-numbered. */
  snippet?: TextValue;
  basis: 'harness-notice';
}

/**
 * TOOLS-1: the tools a harness recorded as available to the agent, as names only. A list as recorded at that moment, never what is
 * available now. `tools` adds names (a full list or an addition); `removed` withdraws names the harness reported as no longer available.
 */
export interface ToolsSnapshotPayload {
  source: 'prompt_snapshot' | 'deferred_tools_delta' | 'additional_tools';
  tools?: { name: string; namespace?: string }[];
  removed?: string[];
}

/** A tool the harness listed as available, with the timeline step at which it was first listed (and withdrawn). */
export interface AvailableTool {
  name: string;
  /** A tool group the harness named (Codex `functions`, or an MCP namespace). */
  namespace?: string;
  /** The MCP server, read from the tool's recorded name. */
  server?: string;
  since: number;
  until?: number;
}

/** Accounting reported by a harness, never a price or missing token count inferred by Drishya. */
export interface UsagePayload {
  source: 'codex-token-count' | 'claude-message-usage' | 'claude-cost-state';
  model?: string;
  turnId?: string;
  tokens?: { input?: number; cachedInput?: number; cacheWrite?: number; output?: number; reasoningOutput?: number; total?: number };
  cumulative: boolean;
  contextWindow?: number;
  /** Request input, never cumulative accounting or continuously measured occupancy. */
  contextInput?: { tokens: number; basis: 'captured-request-input' | 'derived-request-input' };
  cost?: { usd: number; basis: 'harness-estimate'; modelCostUnknown?: boolean };
  work?: { linesAdded?: number; linesRemoved?: number; durationMs?: number; apiDurationMs?: number; toolDurationMs?: number };
  limits?: { usedPercent: number; windowMinutes: number; resetsAt: number; plan?: string };
}

/** Optional enrichment of an existing compaction record; its original observation stays immutable. */
export interface CompactionPayload {
  source: 'claude-boundary' | 'claude-summary' | 'codex-compacted' | 'codex-context-compacted';
  phase: 'boundary' | 'summary';
  trigger?: string;
  beforeTokens?: number;
  afterTokens?: number;
  durationMs?: number;
  boundaryRecordId?: string;
  summary?: TextValue;
  summaryAvailability?: 'captured' | 'encrypted' | 'not-recorded';
}

export interface ContextReading {
  id: string;
  agentId: string;
  source: UsagePayload['source'];
  time?: string;
  /** Timeline length at capture; between-step readings appear after the next item in past replay. */
  availableAfterStep: number;
  observationIds: string[];
  input: { tokens: number; basis: 'captured-request-input' | 'derived-request-input' };
  window?: number;
}

export interface Compaction {
  id: string;
  agentId: string;
  step: number;
  time?: string;
  observationIds: string[];
  trigger?: string;
  durationMs?: number;
  beforeTokens?: number;
  afterTokens?: number;
  /** Temporal neighbors, not direct measurements of compaction. */
  priorReadingId?: string;
  nextReadingId?: string;
  summaryId?: string;
}

export interface CompactionSummary {
  id: string;
  agentId: string;
  time?: string;
  availableAfterStep: number;
  observationIds: string[];
  artifactId?: string;
  availability: 'captured' | 'encrypted' | 'not-recorded';
  /** Set only by an exact native reference or content in the boundary record itself. */
  boundaryId?: string;
}

/** Image references only in DATA-1. Inline image byte policy D7 is still undecided. */
export interface ImageRef {
  path?: string; mime?: string; bytes?: number; width?: number; height?: number;
  origin: 'agent-viewed' | 'user-attached' | 'tool-output' | 'generated';
  availability: Availability;
  revisedPrompt?: TextValue;
  savedPath?: string;
}
export interface ItemPayload {
  item: 'command' | 'file-change' | 'mcp-call' | 'image-view' | 'web-search' | 'image-generation' | 'subagent';
  itemId: string;
  status?: string;
  command?: string; cwd?: string; exitCode?: number; durationMs?: number; output?: TextValue;
  parsed?: { kind: string; path?: string }[];
  changes?: { path: string; type: 'add' | 'update' | 'delete' | 'move'; content?: TextValue }[];
  mcp?: { server: string; tool: string; readOnlyHint?: boolean; isError?: boolean; error?: string; result?: TextValue };
  image?: ImageRef;
  web?: { query?: string; results?: { title?: string; url: string; domain?: string; snippet?: string }[] };
  agent?: { threadId: string; path?: string; kind?: string; model?: string; effort?: string };
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
  /** CONTENT-1 (D7): images in the result, kept inline only within limits; see @drishya/privacy captureImage. */
  images?: { kind: 'captured-image'; mime?: string; bytes?: number; width?: number; height?: number; data?: TextValue; omitted?: string }[];
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
  parentOperationId?: string;
  durationMs?: number;
  /** How the harness says a command ran (any command, including ones shown as reads or searches). */
  run?: CommandRun;
  /** CONTENT-1: images this action returned; bytes are fetched by `sha`, never carried in history pages. */
  images?: OperationImage[];
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
  /** CONTENT-3: set when the action was stopped by a permission decision before it ran. `status` stays 'error', but it is not a failure; see operationFailed. */
  declined?: OperationDeclined;
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

/** Who stopped an action, read from the harness's own result text; `reason` is that text's reason, when it gave one. */
export interface OperationDeclined {
  by: 'person' | 'auto-mode';
  reason?: string;
}

/** An action that ran and failed. A declined action did not run, so it is not one. */
export const operationFailed = (op: Pick<Operation, 'status' | 'declined'>): boolean => op.status === 'error' && !op.declined;

export interface PathRef {
  path: string;
  role: 'read' | 'write' | 'search-hit' | 'test' | 'mentioned';
  basis: 'captured' | 'derived';
  lines?: { start: number; end: number };
}

/** Typed children are the material; their enclosing script stays available only as evidence. */
export function materialOperations(operations: Operation[]): Operation[] {
  const scripts = new Set(operations.map(op => op.parentOperationId).filter(Boolean));
  return operations.filter(op => !scripts.has(op.id));
}

export type OperationDetail =
  | { kind: 'read'; path: string; startLine: number; lineCount: number; totalLines?: number; excerptArtifactId?: string }
  | { kind: 'search'; query: string; mode: 'text' | 'file' | 'web'; hits: SearchHit[]; total?: number }
  | { kind: 'edit'; path: string; hunks: Hunk[]; created: boolean; /** The harness recorded this change as deleting the file. */ deleted?: boolean; reconstruction: Availability; reconstructionNote?: string; /** The harness's checkpoint of this file at the start of the turn (DATA-5). */ beforeTurn?: BeforeTurn }
  | { kind: 'shell'; command: string; exitCode?: number | null; outputArtifactId?: string; outputPreview?: string }
  | { kind: 'test'; command: string; exitCode?: number | null; summary?: TestSummary; outputArtifactId?: string; outputPreview?: string }
  | { kind: 'mcp'; server: string; tool: string; input: unknown; resultPreview?: string; readOnlyHint?: boolean; error?: string }
  | { kind: 'web'; url?: string; query?: string; resultPreview?: string; /** Search results the harness recorded, bounded; links are never loaded automatically. */ results?: WebResult[]; /** What the harness recorded about a page fetch. */ fetch?: { status?: number; statusText?: string; bytes?: number; durationMs?: number } }
  | { kind: 'spawn'; childAgentId?: string; agentType?: string; description?: string; resultPreview?: string; /** The harness recorded the task text only in encrypted form. */ descriptionEncrypted?: boolean }
  | { kind: 'plan'; items: { id?: string; text: string; status: string }[]; /** Derived native task-list isolation boundary, not a native list id. */ scope?: string; omittedItems?: number; document?: { text: string; truncated: boolean; artifactId: string; source?: 'file' | 'proposal' } }
  | { kind: 'other'; input: unknown; resultPreview?: string };

export interface WebResult { url: string; title?: string; domain?: string; snippet?: string }

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
  /** `none`: reasoning the harness recorded without text, folded to one line per turn and agent. */
  exposure: 'full' | 'summary' | 'none';
  /** For `none`: how many recorded reasoning blocks the line stands for, and why they have no text. */
  count?: number;
  reason?: ReasoningGap;
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
  nickname?: string;
  address?: string;
  effort?: string;
  forkedFromId?: string;
  /** Recorded thread facts (DATA-3): where the thread began, how deep a sub-agent sits, its stated role. */
  threadSource?: string;
  startedBy?: string;
  spawnDepth?: number;
  role?: string;
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
  | { type: 'turn'; id: string; sequence: number; agentId: string; prompt?: string; time?: string; permissionMode?: string; /** CONTENT-1: images the person attached. */ images?: OperationImage[] }
  | { type: 'op-start'; id: string; operationId: string; sequence: number; agentId: string; time?: string }
  | { type: 'op-end'; id: string; operationId: string; sequence: number; agentId: string; time?: string }
  | { type: 'prose'; id: string; proseId: string; sequence: number; agentId: string; time?: string }
  | { type: 'agent-stop'; id: string; sequence: number; agentId: string; time?: string }
  | { type: 'gap'; id: string; sequence: number; agentId: string; reason: string; time?: string }
  | { type: 'notice'; id: string; noticeId: string; sequence: number; agentId: string; time?: string };

/** DATA-6: the harness noticed a file changed on disk outside its own edits (you, another program, or a command). */
export interface Notice {
  id: string;
  agentId: string;
  kind: 'external-change';
  path: string;
  /** Line-numbered changed region, as the harness recorded it; bounded. */
  snippet?: string;
  truncated?: boolean;
  /** Identical notices that followed (the harness repeats one until the model reads the file). */
  repeats: number;
  sequence: number;
  time?: string;
  observationIds: string[];
}

export interface Passage {
  id: string;
  agentId: string;
  /** Operations in the order they started. Rendered left to right. */
  operationIds: string[];
  /** Prose emitted right after these operations, rendered beneath. */
  proseIds: string[];
  /** Harness notices recorded in this passage (DATA-6). */
  noticeIds?: string[];
  compactionIds?: string[];
  compactionSummaryIds?: string[];
  firstStep: number;
  lastStep: number;
}

/** One turn as the harness recorded it, merged from `turn.start`, `turn.end` and `turn.detail` (DATA-3). */
export interface Turn extends Omit<TurnDetailPayload, 'turnId'> {
  id: string;
  agentId: string;
  startSequence?: number;
  endSequence?: number;
  /** Always captured: harnesses that record no turns (Claude Code) get none here rather than derived ones. */
  basis: 'captured';
}

export interface Projection {
  /** Turns the harness recorded, in start order. Absent in older projections and for harnesses with no turn records. */
  turns?: Turn[];
  usage?: { latest?: UsagePayload; byTurn: Record<string, UsagePayload> };
  context?: { latest?: ContextReading; readings: ContextReading[] };
  compactions?: Compaction[];
  compactionSummaries?: CompactionSummary[];
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
  /** Harness notices, e.g. files changed outside the agent (DATA-6). Absent in older projections. */
  notices?: Notice[];
  /** TOOLS-1: the tools the harness listed as available, as recorded. Absent when the harness recorded no list (and in older projections). */
  availableTools?: AvailableTool[];
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
  /** Harness-reported accounting only; absent fields were not recorded. */
  stats?: {
    source: 'claude-cost-state' | 'codex-turns';
    durationMs?: number;
    linesAdded?: number;
    linesRemoved?: number;
    lastOutcome?: 'completed' | 'aborted';
  };
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
  /** Set by the local API: the observer's current capture state for this recording. */
  health?: RecordingHealth;
  /** Increments with every commit that adds observations; viewers compare it after a reconnect. */
  revision?: number;
}

/**
 * What the observer knows about collecting a recording. It describes Drishya's reading of the
 * source files, never whether the agent itself is alive.
 */
export type CaptureState =
  | 'importing' // reading for the first time or catching up, not following
  | 'following' // tailing, and something new arrived recently
  | 'idle' // tailing, nothing new for a while
  | 'stopped' // imported, not following
  | 'missing-source' // the main journal is gone
  | 'unsupported' // no adapter can read this recording any more
  | 'failed'; // the last read failed; `error` says why

export interface RecordingHealth {
  state: CaptureState;
  live: boolean;
  lastReadAt?: string;
  lastChangeAt?: string;
  /** More bytes remain than the last bounded turn read; the next turn continues. */
  backlog: boolean;
  /** Sanitized. `code` is stable for the UI: missing-source, permission-denied, unsupported, read-failed. */
  error?: { code: string; message: string };
  sources: { path: string; role: 'main' | 'companion'; state: 'ok' | 'missing' | 'unreadable'; bytes?: number }[];
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
  stats: { files: number; parsed: number; edges: number; unresolved: number; skipped: number; ms: number; /** Nested checkouts (agent worktrees, submodules) left out of the walk. */ nestedCheckouts?: number };
  /** Set by the local API: the workspace changed since this map was built. Refresh is explicit. */
  stale?: boolean;
  /** Set by the local API on a files-only map: this captured root can be scanned once approved. */
  approvalNeeded?: { root: string };
}

/** A bounded range of an artifact's text, and what the reader needs to know about the whole. */
export interface ArtifactSlice {
  artifact: Artifact;
  /** False when content was never captured or is no longer stored; `text` is then empty. */
  available: boolean;
  reason?: 'not-captured' | 'no-longer-stored';
  start: number;
  text: string;
  returnedLines: number;
  totalLines: number;
  totalBytes: number;
  /** The response stopped at its byte cap before the requested count. */
  truncated: boolean;
  /** More lines exist after the returned ones. */
  hasMore: boolean;
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
export { asOfProjection } from './as-of.ts';
