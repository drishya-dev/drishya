# Reference 03 — Normalized Event Schema & Adapter Contract

> **19 October 2026:** the type definitions in [`packages/contracts/src/index.ts`](../../packages/contracts/src/index.ts) are what the code uses; this document is the older design. The pending additions are proposed in [review 125](../review/125-event-schema-proposal.md).

**Schema version `1.0.0-draft`.** Semver, with a stability policy (§7), because third-party adapters depend on it.

> **Do not freeze this draft yet.** The [engineering review](../review/03-engineering-plan.md#3-replace-one-overloaded-event-with-observations-and-projections) proposes immutable observations, stable source IDs, versioned projections, historical artifact availability, typed evidence links and feature-level capabilities. In particular, event-level `captured` provenance must not certify inferred fields; `_raw` must never bypass privacy; timestamp clusters do not prove parallelism; and artifacts must not silently resolve to present-day files. The two builders should reconcile these proposals before the first implementation contract is frozen.

This is the contract that makes blueprint §11.1 true: *the renderer must never know which harness an event came from.*

---

## 1. Design rules

1. **One event type, discriminated by `kind`.** Not a class hierarchy. Adapters emit JSON lines; the store appends them; the composer reads them.
2. **Payloads are references, not bytes.** Any content above 4 KB becomes a `BlobRef`. The event stream stays small and seekable; blobs load lazily. This is what keeps a 2 GB Codex session tractable (`[V]`, evidence pack §2.1).
3. **Provenance is mandatory on every event.** No field may be populated without stating where it came from. This is the trust rule (blueprint §12) enforced at the type level rather than by convention.
4. **Unknown fields are preserved, not dropped.** Forward compatibility, and it lets an adapter carry harness-specific extras that a future renderer might use.
5. **Causality is explicit.** `causal_parent` rather than relying on array order — Claude Code and pi both write transcript *trees* (`[V]`, evidence pack §1.3, §3), and a linear reader silently mis-orders forks.

---

## 2. The event

```typescript
interface DrishyaEvent {
  // ── Identity ────────────────────────────────────────────────
  event_id:      string;        // UUIDv7 — sortable by creation time
  run_id:        string;        // one session
  agent_id:      string;        // the acting agent (parent or subagent)
  parent_agent_id?: string;     // set for subagents
  harness:       HarnessId;     // "claude-code" | "codex" | ...
  harness_version?: string;     // for drift diagnosis

  // ── Workspace ───────────────────────────────────────────────
  repo_root:     string;
  branch?:       string;
  worktree?:     string;
  cwd:           string;

  // ── Time & sequence ─────────────────────────────────────────
  ts:            string;        // ISO 8601 with ms, from the harness
  ingested_ts:   string;        // when Drishya saw it — the two differ in replay
  seq:           number;        // monotonic per run
  causal_parent?: string;       // event_id — the tree edge
  stream_chunk?: { index: number; final: boolean };  // for streamed content

  // ── Structure (blueprint §8) ────────────────────────────────
  turn_id:       string;
  row_id:        string;
  beat_id?:      string;        // absent for row-terminating events
  beat_mode?:    "parallel" | "sequential";

  // ── What happened ───────────────────────────────────────────
  kind:          EventKind;
  payload:       Payload;       // discriminated by kind

  // ── Meaning ─────────────────────────────────────────────────
  title:         string;        // user-visible, one line
  objective?:    string;        // the goal this serves, if known
  evidence?:     string[];      // event_ids this action drew on
  rationale?:    string;        // ONLY if the harness supplied it

  // ── System impact (resolved against the Terrain) ────────────
  terrain: {
    node_ids:    string[];      // resolved graph nodes
    cluster_id?: string;
    symbols?:    string[];
    routes?:     string[];
    db_objects?: string[];      // references only, never data
    confidence:  number;        // 0–1; below 0.6 the Terrain stays quiet
  };

  // ── Scheduling (computed by the classifier, blueprint §9.1) ─
  salience:      number;        // 0–1
  content_mass:  number;        // normalized reading cost
  novelty:       number;        // 0–1, decays on repeat

  // ── Trust (blueprint §12) ───────────────────────────────────
  provenance:    Provenance;

  // ── Privacy (blueprint §13.1) ───────────────────────────────
  sensitivity:   "none" | "low" | "high";
  redactions:    Redaction[];   // WHAT was redacted, never the value

  // ── Telemetry (local only, never transmitted) ───────────────
  duration_ms?:  number;
  tokens?:       { input: number; output: number; cache_read?: number; cache_creation?: number };

  // ── Forward compatibility ───────────────────────────────────
  _raw?:         unknown;       // harness-specific extras, preserved
}
```

### 2.1 `EventKind`

```typescript
type EventKind =
  // lifecycle
  | "run.start" | "run.end" | "turn.start" | "turn.end"
  | "row.terminate" | "beat.start" | "beat.end"
  // the agent acting
  | "file.read" | "file.edit" | "file.write"
  | "search.text" | "search.file" | "search.semantic"
  | "command.run" | "test.run" | "git.op"
  | "web.search" | "web.fetch" | "mcp.call"
  // the agent speaking
  | "message.assistant" | "message.user" | "thinking"
  | "plan.update" | "task.created" | "task.completed"
  // coordination
  | "agent.start" | "agent.stop" | "agent.handoff"
  | "permission.request" | "permission.granted" | "permission.denied"
  // system
  | "error" | "retry" | "compaction" | "model.switch"
  | "file.changed"        // disk truth, independent of agent claims
  | "unknown";            // ← REQUIRED. See §6
```

### 2.2 Supporting types

```typescript
interface BlobRef {
  sha256:       string;         // content address; also the integrity hash
  bytes:        number;
  media_type:   string;
  truncated:    boolean;
  preview?:     string;         // ≤4 KB, inline, enough to render a Stage card
}

interface Provenance {
  kind:         "captured" | "derived" | "inferred";
  origin:       string;         // "hook:PostToolBatch" | "file:...:1423" | "blob:<sha>"
  confidence?:  number;         // derived/inferred only
  generator?:   string;         // "heuristic-title-v1" | "llm:claude-opus-5"
}

interface Redaction {
  span:         [number, number];
  rule:         string;         // "aws-key" | "entropy" | "path-denylist:.env"
  // the value is NEVER stored
}

interface FileRange { path: string; start_line: number; end_line: number; }
```

### 2.3 Payloads — the ones with structure

Every payload is a plain object; only these have non-obvious shapes.

```typescript
interface FileReadPayload  { range: FileRange; content: BlobRef; }

interface FileEditPayload  {
  path:         string;
  hunks:        { old: FileRange; new: FileRange; patch: BlobRef }[];
  before?:      BlobRef;        // from file-history/*.snapshot.N  [V]
  after?:       BlobRef;
  disk_confirmed: boolean;      // did a FileChanged hook confirm it?  [V]
}

interface SearchPayload    {
  query:        string;
  mode:         "text" | "file" | "semantic";
  results:      { path: string; line: number; context: string; score?: number }[];
  total:        number;         // may exceed results.length
  retrieval?:   { engine: string; rank: number; reason?: string };  // when exposed
}

interface CommandPayload   {
  command:      string;
  exit_code:    number | null;  // null while running
  stdout:       BlobRef;
  stderr:       BlobRef;
  cwd:          string;
}

interface TestPayload      {
  framework:    string;
  passed: number; failed: number; skipped: number;
  failures:     { name: string; file: string; line?: number;
                  assertion: string; traceback: BlobRef }[];
  implicates:   string[];       // terrain node_ids → drives the failure Trace
}

interface PermissionPayload{
  tool: string; input: unknown;
  outcome: "granted" | "denied" | "pending";
  mode: string;                 // permission_mode from the hook payload  [V]
  rule?: string;
}

interface CompactionPayload{
  trigger:      "manual" | "auto";   // [V]
  turns_summarised: number;
  summary?:     BlobRef;
}
```

---

### 2.4 `tools.snapshot` (TOOLS-1, 30 October 2026; draft)

The tools a harness recorded as available to the agent, names only. Payload: `source` (`prompt_snapshot`, `deferred_tools_delta` or `additional_tools`), `tools` (names to add, each with an optional `namespace`, the group the harness named), `removed` (names the harness withdrew). Claude Code lists them in `attachment` rows (the same rows carry the system prompt, which is never read); Codex lists tool groups in `additional_tools` response items. A list is "as recorded at that moment", never what is available now. The projection keeps the first-listed step of each tool in `Projection.availableTools`.

## 3. The adapter contract

```typescript
interface Adapter {
  id:            HarnessId;
  capability:    0 | 1 | 2 | 3;          // blueprint §11.2
  supported_versions: string;            // semver range, for drift diagnosis

  discover():    Promise<RunHandle[]>;   // find sessions on disk
  replay(run: RunHandle): AsyncIterable<DrishyaEvent>;
  watch?(run: RunHandle): AsyncIterable<DrishyaEvent>;   // capability ≥1
  resolve(ref: BlobRef): Promise<Uint8Array>;            // lazy content fetch
}
```

### 3.1 Obligations

Every adapter must:

1. **Emit schema-valid events.** Validated in CI against the JSON Schema generated from these types.
2. **Reconstruct the structure** — `turn_id`, `row_id`, `beat_id`, `beat_mode` — natively where the harness provides boundaries, or by inference where it does not.
3. **Mark provenance honestly.** Native batch boundary → `captured`. Timing-inferred → `inferred`. Never `captured` for something reconstructed.
4. **Never mutate source artifacts.** Read-only on every harness path, always.
5. **Emit `kind: "unknown"` rather than throwing** on an unrecognised record (§6).
6. **Stream.** `replay()` is an async iterable and must never materialise a whole session. Non-negotiable given 2 GB Codex files `[V]`.
7. **Declare capability honestly.** The UI degrades visibly by level; an adapter claiming 3 and delivering 1 produces a broken-looking product.

### 3.2 Inferring structure when the harness does not provide it

```
Beat boundary:  gap > 150ms  OR  any assistant text/thinking between calls
Beat mode:      all calls within 50ms of each other → "parallel", else "sequential"
Row boundary:   any assistant text or thinking block
Turn boundary:  user message → next user message
```

All four are marked `provenance.kind = "inferred"` and render with a dotted edge (motion catalog §0, blueprint §12).

### 3.3 Per-harness capability

| Harness | Level | Structure source | Notes |
|---|---|---|---|
| **Claude Code** | **3** | Native: `PostToolBatch`, `MessageDisplay`, `UserPromptSubmit`/`Stop` `[V]` | Transcript for replay, hooks for live, spill dirs for full content |
| **Codex** | 1–2 | Inferred from `response_item` / `event_msg` ordering | Stream-parse + offset index, mandatory |
| **Cursor** | 0–1 | Inferred from SQLite `blobs` | Undocumented; expect drift |
| **opencode** | 0–1 | Inferred from `messages`/`parts` | |
| **pi** | 0–1 | Parent IDs give the tree natively | |
| **Proxy fallback** | 1 | Inferred from request timing | Works for any base-URL-overridable harness |

---

## 4. Storage

```sql
CREATE TABLE events (
  event_id     TEXT PRIMARY KEY,
  run_id       TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  ts           TEXT NOT NULL,
  kind         TEXT NOT NULL,
  turn_id      TEXT NOT NULL,
  row_id       TEXT NOT NULL,
  beat_id      TEXT,
  agent_id     TEXT NOT NULL,
  salience     REAL NOT NULL,
  body         TEXT NOT NULL,          -- the full event as JSON
  UNIQUE(run_id, seq)
);
CREATE INDEX idx_events_run_seq   ON events(run_id, seq);
CREATE INDEX idx_events_kind      ON events(run_id, kind);      -- jump-to-next-edit
CREATE INDEX idx_events_salience  ON events(run_id, salience);  -- Review lens

CREATE TABLE blobs (
  sha256       TEXT PRIMARY KEY,
  bytes        INTEGER NOT NULL,
  media_type   TEXT NOT NULL,
  path         TEXT NOT NULL,          -- blobs/<aa>/<sha256>
  refcount     INTEGER NOT NULL DEFAULT 1
);

CREATE VIRTUAL TABLE events_fts USING fts5(
  title, content, content_rowid=rowid
);
```

**Append-only.** Events are never updated or deleted except by retention sweep. That is what makes replay deterministic and the store auditable.

**Content addressing pays off measurably here.** An agent reading the same file twelve times produces twelve events and one blob.

---

## 5. Worked example — one parallel Beat

Claude Code reads two files in parallel, then thinks. Three events, abbreviated:

```jsonc
{ "event_id":"019a...01","run_id":"r1","seq":41,"kind":"file.read",
  "turn_id":"t3","row_id":"r7","beat_id":"b12","beat_mode":"parallel",
  "title":"Read auth/session.py 40–90",
  "payload":{"range":{"path":"auth/session.py","start_line":40,"end_line":90},
             "content":{"sha256":"9f2c…","bytes":2114,"media_type":"text/x-python",
                        "truncated":false,"preview":"def is_expired(…"}},
  "terrain":{"node_ids":["sym:auth.session.is_expired"],"cluster_id":"c:auth","confidence":0.94},
  "salience":0.50,"content_mass":51,"novelty":1.0,
  "provenance":{"kind":"captured","origin":"hook:PostToolUse"},
  "sensitivity":"none","redactions":[] }

{ "event_id":"019a...02","run_id":"r1","seq":42,"kind":"file.read",
  "turn_id":"t3","row_id":"r7","beat_id":"b12","beat_mode":"parallel",
  "title":"Read auth/tokens.py 1–60", "…":"…" }

{ "event_id":"019a...03","run_id":"r1","seq":43,"kind":"thinking",
  "turn_id":"t3","row_id":"r7",          // no beat_id — this TERMINATES the row
  "causal_parent":"019a...01",
  "title":"Reasoning about expiry handling",
  "payload":{"content":{"sha256":"3e81…","bytes":840,"media_type":"text/plain",
                        "truncated":false,"preview":"The expiry check returns…"}},
  "terrain":{"node_ids":[],"confidence":0},   // thinking has no location
  "salience":0.70,"content_mass":140,"novelty":1.0,
  "provenance":{"kind":"captured","origin":"hook:MessageDisplay"},
  "sensitivity":"none","redactions":[] }
```

Reading it: two Pulses share `beat_id: "b12"` with `beat_mode: "parallel"` — they fan out simultaneously from the agent presence (motion catalog §0.4). The third has no `beat_id`, so it terminates row `r7` — the preceding Beats settle and dim as it enters (motion catalog §8). **That is the row rule, expressed entirely in data.**

---

## 6. Handling drift

Harness formats **will** change — Codex's record set was still growing during 2026 `[V]`.

**The rule: unknown input becomes a visible generic event, never an exception.**

```
unknown record type
  → kind: "unknown"
  → title: best-effort from whatever fields exist
  → provenance: { kind: "inferred", origin: "adapter:<id>:unknown-record" }
  → _raw: the original record, preserved
  → renders as a generic card with a "not yet supported" mark
```

The user sees an honest gap in a working timeline rather than a crash. `_raw` means a later adapter version can reprocess an old recording and light up events that were dark when captured — **recordings improve retroactively**, which is a genuine benefit of preserving unknowns rather than dropping them.

Adapters log unknown-record-type counts locally. A spike is the drift signal, and it is the trigger to check the harness's release notes.

---

## 7. Versioning

Semver on the schema, published with the Adapter SDK (blueprint §19.2).

| Change | Bump | Rule |
|---|---|---|
| New optional field | **patch** | Adapters may ignore |
| New `EventKind` | **minor** | Renderer must fall back to generic |
| New required field | **major** | Migration required |
| Field removed or retyped | **major** | Avoid; prefer deprecate-then-remove over two majors |

The store records the schema version each event was written with, so old recordings remain replayable after a schema bump. A replay that cannot be migrated is a bug, not an acceptable outcome — the product's premise is that a run from months ago is still worth watching.
