# Codebase — the system as built

**Draft built 22–25 Sep; audited 30 Sep 2026.** This maps the code that exists. The [baseline audit](review/06-baseline-audit.md) qualifies verified behavior and known gaps; the [roadmap](IMPLEMENTATION_ROADMAP.md) governs current execution. For architecture rationale see the engineering plan; for creative intent see VISION. [`packages/contracts`](../packages/contracts/src/index.ts) remains `0.1.0-draft`, and freezing it needs both builders ([`AGENTS.md`](../AGENTS.md)).

## B4 reader amendment — 5 October 2026

The current architecture and validation limits are in [08: bounded history reader](review/08-b4-history-reader.md). This section supersedes older full-projection descriptions for large interactive histories.

- Captured SQLite remains ingestor-owned; schema 3 adds a derived normalized source clock without changing observation JSON. Streaming SQL ordering matches reducer order. Session labels update through bounded metadata SQL.
- `apps/daemon/src/history.ts` starts a capped worker, whose read-only captured connection and separate `history/index.db`/blobs own versioned projections (`r2`, `h1-4096`). One metadata workspace is resident. Valid single-recording append is incremental; late/context-changing and combined updates rebuild through streaming reads.
- `packages/scene/src/history.ts` defines the internal page/summary contracts. `/history`, `/history-marker`, `/summary` and `/file-operations` serve global navigation with bounded nearby content. Above 10k observations or 32 MiB committed source offsets the integrated app uses these routes, including worker-backed material/map/model lookup. Small sessions and offline bundles retain complete projection compatibility.
- Worker command/prose previews are 4,096 characters; complete captured input/prose remains in bounded artifact readers, with as-of provenance intact. Passage boundaries cap operation/prose density. The browser virtualizes both history and file spine; global summaries never count just a page.
- Low-resource mode persists map/motion off plus reduced overscan/text cache budgets. `/storage` and `drishya storage` report own-store categories and the 10 GiB advisory budget. Forget invalidates derived combinations and preserves shared blobs; there is no automatic deletion or secure-erase promise.
- Packaged builds bundle the worker separately and verify `BUILD.json`/`SHA256SUMS`, offline install, authenticated history and restart. Development remains direct TypeScript on Node 24; daemon runtime dependencies remain zero.

Full projection/export and arbitrarily heavy edit metadata remain explicit memory limitations. See the report before making scale claims or adding features that assume the current browser page is the whole recording.

## P2 reading-mark integration — 5 October 2026

Store schema 4 combines the B4 normalized clock and P2 reading boundaries. Both prior schema-3 layouts migrate by checking actual columns/tables. `GET /v1/recordings/:id/since?after=N` computes facts in the derived-history worker across the full recording, returns at most 20 items per group and 50 file names, and carries global counts. Marks remain explicit, local, per-recording and undoable. The UI never counts only a loaded page.

## The pipeline

```text
harness journal (read-only)
  │  capture-core/jsonl.ts     bounded incremental read; cursor = offset + generation + fingerprint
  ▼
adapter-claude / adapter-codex  record → RawObservation (harness names mapped to neutral intents)
  │  capture-core seal()       best-effort redaction/omission; known bypasses tracked in audit
  ▼
store                           SQLite (node:sqlite, WAL) + content-addressed blobs; cursor committed
  │                             in the same transaction as the observations
  ▼
projection/reduce()             operations, prose, agents, artifacts, typed evidence links, timeline,
  │                             passages. Versioned (REDUCER_VERSION), rebuildable, cached
  ▼
scene/compose()                 PURE: projection + step + filter → what is on screen. Golden-tested
  ▼
daemon (local API) → ui         loopback HTTP + SSE; the browser only renders compose() output
```

Replay works with the map absent. The indexer (`indexer`) and the model layer (`explain`) are enrichments on the side, never on the capture path.

## Packages

| Package | Job | Key files |
|---|---|---|
| `contracts` | The shared types: `Observation`, `Projection`, `Operation`, `Artifact`, `EvidenceLink`, `RepoGraph`, `ReplayBundle` | `src/index.ts` |
| `privacy` | Redaction rules, protected paths, deep `sanitize()` | `src/index.ts` |
| `capture-core` | JSONL reader, stable ids, `seal()`, adapter interface, neutral tool intents | `src/jsonl.ts`, `src/index.ts`, `src/intent.ts` |
| `adapter-claude` | `~/.claude/projects/<slug>/<session>.jsonl` plus `<session>/subagents/agent-*.jsonl` | `src/index.ts` |
| `adapter-codex` | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | `src/index.ts` |
| `store` | SQLite schema, append with cursor, blobs, FTS5 search, projection/graph/generated caches | `src/index.ts` |
| `ingest` | Import, resume, live tailing (polling, coalesced bounded turns), projection caching, combined views, change events, capture health (`health()`, `health` events), discovery error report | `src/index.ts` |
| `projection` | The reducer, plus derived rules: shell classification, test-output parsing, patch/diff | `src/reduce.ts`, `src/shell.ts`, `src/tests.ts`, `src/patch.ts` |
| `indexer` | Repository map: file enumeration, import extraction and resolution, deterministic layout | `src/index.ts` |
| `scene` | `compose()`, markers, pacing (`dwellFor`), step lookups — runs in Node and the browser | `src/index.ts` |
| `explain` | Nemotron on Nebius Token Factory: evidence packs, consent preview, citation validation | `src/index.ts` |
| `apps/daemon` | `drishya` CLI and the local API server | `src/cli.ts`, `src/commands.ts`, `src/server.ts`, `src/app.ts` |
| `apps/ui` | Base UI: React 19 + Vite + Zustand | `src/App.tsx`, `src/components/*` |

TypeScript runs directly on Node 24 (type stripping), with no build step for the backend. Source files therefore use erasable syntax only: no enums and no parameter properties.

## Identity and provenance

- **Recording id** = hash of adapter + main journal path. **Observation id** = hash of adapter, source, and the native record id (Claude `uuid`) or generation + byte offset (Codex), plus the part index. Re-importing adds nothing, and restart resumes from the committed cursor.
- **History identity (3–4 Oct):** passage IDs derive from their first captured timeline event rather than array position. The reader holds a passage ID and pixel offset while detached, restoring it after late artifact growth as well as new events. `asOfProjection()` masks an operation's result fields/artifacts until its `op-end`; the same view feeds the composer, passage/inspector renderer and model evidence. Mixed-worktree views use `worktree-<root hash>/path` file identities and a captured-path map; complete file bases are isolated by recording before reconstruction. Bounded artifact slices and approved, freshness-marked maps are implemented.
- **Captured / derived / generated.** Captured = bytes the harness recorded (after redaction). Derived = computed by a named, versioned rule, e.g. `shell-classify-v1` (a `sed -n` shown as a read), `apply-edit-verified-v1` (an after-state reconstructed from a captured base), or test counts parsed from output. Generated = written by a model and labelled with that model. The UI shows the badge and the rule.
- **Links** carry `relation` and `basis`. Temporal neighbours are "nearby in time", never a reason. `test-outcome-change` says a test failed and later passed; it does not say which edit fixed it.
- **Edits.** The captured hunks are always shown. A full after-state exists only when the edit applies exactly once to a captured base; otherwise `reconstructionNote` says why. Recent Claude Code (2.1.x) often records `originalFile: null`, so this is common, and it is expected.

## Privacy (constraint 3)

`seal()` applies a best-effort privacy policy before observation storage. Rules cover private keys, common provider tokens, JWTs, bearer tokens, URL credentials and high-entropy assignments. Protected-file content has omission rules; supported image shapes are dropped; model evidence is redacted again; bundle export masks configured paths and re-keys ids. `packages/ingest/test` checks database/blob bytes for selected planted secrets.

**Status, 2 Oct (policy `p3`):** the audit's reproduced bypasses are fixed. Fields beside a `base64` payload and object keys are redacted; colliding redacted keys get ` #n`. Matching runs before truncation. Envelope fields (`branchRef`, `harnessVersion`, `recordId`, `agentId`, `operationId`, `sourceTime`) are redacted too, and call/result ids still pair because the redaction is deterministic. Parser errors drop the input slice V8 quotes. Session titles (import and discovery list), bookmark notes, map labels, generated model output, HTTP error bodies and the server's error log are redacted. Inside a protected-file scope every string is omitted except paths and short labels (`type`, `kind`, `tool`, `status`, `mode`). A shell command or patch that names a protected file (`cat .env`, `*** Add File: .env.local`) makes its output protected, and a Codex patch body too. Forget waits for any ingest in flight, then deletes rows and only the blob files no other recording references. Recordings with data sealed under an older policy are flagged `privacyOutdated` in the API and tagged in the UI; re-import them. Inline secrets inside a shell command itself still rely on pattern redaction. Pattern detection stays best effort, never a guarantee.

## Adapters — how to add a harness

1. Add `packages/adapter-<name>` implementing `Adapter` (`capture-core/src/index.ts`): `discover`, `sourceSet`, `createParser`, `sniff`, and a `descriptor` with an honest capability matrix.
2. Map the harness's tools to `ToolIntent` and its results to `ToolOutcome`. The reducer and UI never see harness tool names, except for display.
3. Emit `unknown` for record types you do not know, and ignore bookkeeping records deliberately (keep a named list).
4. Write synthetic fixtures in the real format (`scripts/fixtures/make-synthetic.ts`) and parser tests. Never commit a real session.
5. Register it in `ingest/src/index.ts` (`defaultAdapters`).

Formats verified on this machine on 22–25 Sep 2026 against 574 Claude Code and 28 Codex sessions. Newer records that are handled: Claude `ai-title` and `cost-state`; Codex `exec` (code mode), `spawn_agent`/`agent_message` (collaboration) and `namespace: "mcp__<server>"`.

## Local API and security

Loopback only. `drishya serve` prints a per-launch token in the URL fragment. The UI exchanges it at `POST /v1/session` for an `HttpOnly; SameSite=Strict` cookie with `Max-Age`, then removes it from the address bar. The token stays valid for the server's lifetime (it is the launch credential, and scripts may use it as a bearer token). Sessions expire after 12 h idle or 7 days, are capped at 32 (least recently used dropped), and `DELETE /v1/session` signs out. Sessions live in memory, so a server restart signs every browser out; the UI probes an authenticated route after a stream error and shows signed-out on 401. Host/Origin checks, JSON mutation requirements and CSP are implemented. `/v1/import` is discovery-allowlisted. Paging parameters must be integers (400 otherwise) and are clamped. Model calls (`explain`, `briefing`, `labels`) return a preview with a SHA-256 digest of the exact request: endpoint, model, token budget, messages, privacy and explain versions. Sending requires `consent` equal to that digest. If the rebuilt request no longer matches, the server sends nothing and answers 409 with the new preview. Cached answers are reused only for the same digest. `GET …/artifacts/:id?start&count` returns a bounded `ArtifactSlice` read through a sparse line index, capped at 2 MiB, with `available`/`reason`, totals, `truncated` and `hasMore`. `GET …/graph` returns a files-only map with `approvalNeeded` until the captured root is approved (`POST …/graph/approve`), then the cached map with `stale`; `?refresh=1` rebuilds it. SSE carries `change` notices (with the committed `revision`) and, separately, `health` notices. Every connection opens with `event: sync` listing each recording's revision, so a reconnecting viewer reloads only what it missed. Subscribers whose queued bytes plus the next event would exceed 1 MiB are disconnected and resync on reconnect. `/v1/revisions` and `RecordingSummary.revision` expose the same counter; `/v1/sources` returns `{ sources, errors }`. Routes and tests are in `apps/daemon/src/server.ts` and `apps/daemon/test/server.test.ts`. `GET/POST …/boundary` reads and moves the reader's "seen through here" mark (single recordings; an integer from -1 to the last sequence); it never moves on its own. `GET …/verification/:opId` returns the P2-C verification trail for one change (worker-computed on the whole session; 404 if not a change; per recording).

## Base UI — what is placeholder

The base UI exercises home/session import/watch, combined views, synthetic demo, agent crown, file spine, passages, unboxed prose, dock/MCP filters, inspector, search, map and optional explanations. Recordings open as complete scrollable history; new committed steps extend it while the reader follows or inspects an earlier passage. Selection and scrolling up detach; only explicit return restores live follow. The map can be turned off persistently, which also skips graph loading and polling. File and search navigation can target captured work without entering replay. Sequence replay and its filmstrip are opt-in. Passage actions wrap at narrow widths. **B3 integrated reader:** all passages remain in the logical sequence, but the DOM mounts only the measured viewport plus 900 px overscan and disjoint selected, focused, expanded and reading-anchor passages. Read/edit/search/test/shell actions expand within their passage; captured material loads 200 lines per page, diffs render 120 lines per page, and closing expansion keeps the reading context. Preview and full-reader LRU pools budget 8 and 40 MiB of settled decoded text, with four in-flight reads reserved against the 64 MiB target. The file panel virtualizes fixed-height action rows and filters within a file; the chooser groups sessions by project and filters title/path, harness and age. Native kinds and MCP tools filter the same chronology without discarding other events. This is still integration scaffolding: full projection metadata and scene composition are not paged, and long-session resource limits remain B4 work. See the audit and roadmap.

These parts are placeholders for the frontend pass: the Canvas 2D map (→ PixiJS), the regex highlighter and code views (→ CodeMirror 6), and the simple CSS arrivals (→ the choreographed Lift/Emit/Settle/Surface/Resolve with origin tethers). The passage virtualizer is a first bounded implementation, not the final reader or a measured B4 performance pass. `compose()` output is the contract the frontend renders; change it deliberately and update the goldens.

## Tests

`pnpm check` runs typecheck and 191 unit tests. `pnpm test:browser` builds the UI and runs synthetic live-history Playwright acceptance, including long-session mounted-DOM/focus, paged reading/file navigation and combined-demo tool filters; CI installs Chromium and runs it on Linux and Windows. The opt-in real-session journey stays skipped without its local manifest. The main groups:

- **JSONL**: partial lines, truncation, oversized and malformed records.
- **Adapters**: intents, correlation, unknown records, encrypted reasoning never surfaced.
- **Privacy**: rules, and end-to-end with no secret found on disk.
- **Projection rules**: diffs, patches, shell classification, test parsers.
- **Indexer**: resolution and determinism.
- **Explain**: evidence cut-off, citation validation, tier routing, no secret sent.
- **Daemon**: host, origin, token, CSRF, import allow-list, export leak checks.
- **Golden scenes**: `packages/scene/test/__golden__`, a pure composer at the fail, edit, pass and end moments.

CI runs on Linux and Windows and checks that the committed demo bundle is reproducible.

## Measured on real sessions (this machine)

These are informal, not the performance gates. An 83 MB Claude session: 6,930 observations, import 1.3 s, reduce under 1 s, compose ~3 ms per step. 21 MB Codex: 0.2 s. No crashes across the six largest sessions after the fixes on 25 Sep.

## Deliberate deviations from the proposed stack (see STATUS decisions)

| Proposed | Built | Why |
|---|---|---|
| `better-sqlite3` | `node:sqlite` (built in) | No native binary, so a clean `npx` install cannot fail on compilers; FTS5 included |
| Fastify + `ws` | `node:http` + SSE | Zero runtime dependencies for the daemon; notifications are one-way |
| `web-tree-sitter` | line-anchored import rules | Draft map; tree-sitter replaces extraction, the resolver and layout stay |
| PixiJS map | Canvas 2D | Base UI only; Pixi is frontend work |
| DB in a worker | Main thread | Tracked follow-up; fine at measured sizes |

## Current audit and next gate (30 September)

Fresh typechecks, 96 tests and Vite 8 production build passed. Synthetic persistence/restart/API/viewerless tailing checks passed. Four real journals were parsed/reduced/composed in memory only; the sampled Claude records exposed compaction/unsupported-record gaps. This is narrower than a production baseline. `node scripts/validate-baseline.ts --real-read-only` reproduces the opt-in diagnostics without persisting real content.

The [baseline audit](review/06-baseline-audit.md) is authoritative for these results and open findings. The [implementation roadmap](IMPLEMENTATION_ROADMAP.md) orders privacy, lifecycle/recovery, identity/history correctness, integrated base UI and resource/install gates before premium expansion. No frontend design is frozen. Optional remote model calls, packed distribution, long-session performance and complete real-live browser behavior remain unverified.
