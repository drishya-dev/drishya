# Codebase — the system as built

**Integrated local product updated 6 October 2026.** This maps the code that exists. The [baseline audit](review/06-baseline-audit.md) retains historical findings; [PRODUCT_DELIVERY](PRODUCT_DELIVERY.md) and the [roadmap](IMPLEMENTATION_ROADMAP.md) govern current execution. For architecture rationale see the engineering plan; for creative intent see VISION. [`packages/contracts`](../packages/contracts/src/index.ts) remains `0.1.0-draft`, and freezing it needs both builders ([`AGENTS.md`](../AGENTS.md)).

## Material presentation amendment — 6 October 2026

`ArtifactReader` can copy a validated loaded source interval and pin one temporary historical range. `ReadingReferenceProvider` owns one snapshot of at most 200 lines/64 KiB decoded text outside virtualized passages; no artifact fetch or persistence. Source/session/load and replay mode/cutoff scope checks hide it synchronously and release it on cleanup; normal history growth preserves it. Descriptor provenance remains visible, including derived/generated and redacted content. See [source reference](review/18-source-reference.md).

`ArtifactReader` adds deliberate matching-line navigation and validated go-to-line within actual stored source, retaining at most 64 page offsets and one bounded page. Controls stay mounted during loading. `common.useArtifact` now keys immutable blob-backed pages by complete artifact descriptor plus source/recording/scope/range, avoiding focus/selection loss on unrelated appends; non-blob/unlisted material remains revision-keyed. Metadata changes still invalidate. `ArtifactView.totalLines` comes from the existing slice response. See [source navigation](review/17-source-navigation.md).

`History.ReadPreview` opens its exact read artifact through existing in-place expansion, using returned artifact coordinates for preview numbering. Read expansion now shows provenance/ranges and reserves the full passage width. `ArtifactReader` supports literal case-insensitive find within its loaded 200-line code page; query persists across pages, highlights source-coordinate lines and resets on artifact change. This is not whole-file/session search or current-file access. See [captured-range reading](review/16-captured-range-reader.md).

`Origins.toolTransfer` adds a finite instrument-silhouette transfer from a hit-tested visible dock glyph to its measured action-header glyph. It copies only app-owned SVG paths; DOM text stays stationary. Native/MCP resting marks remain named and filtering-compatible. It reuses the existing three-arrival budget, ownership/cancellation and reduced-motion/follow gates. See [toolbox emission](review/15-toolbox-emission.md).

External previews choose a stable 300 px receipt or 560 px reading surface from the currently available captured content. `StructuredResult` parses the existing bounded result preview without a second 1,400-character cut, preserves the original representation, and distinguishes absent/null scalar fields. No artifact payload, observation contract or worker preview limit changes. Repository context keeps bounded display labels beside action IDs, masking completed ranges while a replay action is pending. See [external reading](review/14-external-reading.md).

`lib/repository-context.ts` resolves a captured primary file from an explicit scene selection, the held reader's first visible passage, or the latest composed action. `History` publishes ephemeral `readingPassageId` only on identity changes; `Spine` uses it while held, with no capture/replay cursor change. `RepositoryContext` renders at most three composed action links and two typed current imports per direction. Unknown locations remain unknown; worker pages are labelled shown history, not global counts. Map-off still releases graph data. Material flex allocations now stay stable as siblings arrive, wrap by available width, and preserve the reducer's prose boundaries. See [reader context and flow](review/13-reader-context-flow.md).

`apps/ui/src/lib/sample-source.ts` publishes only the built-in synthetic fixture at `?demo=live` through the existing DataSource subscription/reload boundary. Its projection, artifacts, search and verification expose only published evidence; reader holds do not pause publication. The optional `sample`/`completeSample` source methods are presentation metadata, not observation-contract changes. Ordinary bundles and daemon sources retain their existing behavior. Exact combined recording identity is preferred before component matching when handling notices and refreshed summaries.

`Origins.tsx` uses finite SVG material backings measured from visible real origins while characters remain selectable in their final DOM positions. The repository overview adds DOM path labels on actual geometry; pending reads and patches distinguish captured input from a result not yet observed. Full readers, deterministic scenes and large-session paging remain unchanged. See [material experience](review/12-material-experience.md) for details and limits.

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

## P1 presentation amendment — 5 October 2026

[09: presentation and acceptance](review/09-p1-content-origins.md) supersedes the older CSS-arrival placeholders below. Content shapes use actual remaining reading width. The repository lens and background share real graph geometry and bounded DOM anchors; origin paths use measured visibility/occlusion and retain a qualified file-reference fallback. `lib/choreography.ts` plans the five finite moves from timeline positions, including the global offset of a worker page; captured characters never animate or wait. Initial mounts and rewinds do not replay arrivals. `Origins` owns cancellation; the map has no separate arrival loop.

Captured patches have adaptive/unified/split 120-line pages; split alignment is patch order, not whole-file reconstruction. Terminal middle folding is reversible, JSON previews remain inert and bounded, and test outcome strips are parsed counts grouped by status with assertion navigation. Deliberate focus/selection/scroll holds the camera while capture/history continue. Canvas 2D and DOM/highlighting remain measured implementation choices, with replaceable renderer/reader boundaries. No event-schema or runtime-dependency change. Human comprehension/preference, final art direction and physical release acceptance remain separate gates.

## Integrated product amendment — 6 October 2026

[PRODUCT_DELIVERY](PRODUCT_DELIVERY.md) supersedes the older base-UI placeholder account below. `ProductShell` owns persisted shared charcoal/light/system themes and native dialog focus/close/restore; `Workspace` switches Follow/Agents/Repository on the existing chronology. Map geometry reads theme tokens and updates on OS theme changes. `FileHistory` uses global `/file-operations` pages of 24 for daemon sessions, rather than just the browser's projection window. Comparison retains at most two selected operation/artifact references across pages; query/path/recording/replay changes discard stale choices. `file-evidence` never substitutes a prior read for an edit's before-state. Returned artifact metadata supplies actual provenance and range. Source/diff readers remain 200/120 lines per page. History anchors and captured text stay independent of visual cues; dialogs/view/theme changes cancel arrivals. No capture/store/schema/daemon dependency changes.

233 unit tests/typechecks and six new integrated product browser journeys cover settings/OS preference/focus, real file comparison, agent ownership/replay cutoff, distant paged comparison, sanitized export round-trip and semantic anchors across views/themes. Existing B4 performance limitations and the separate physical/platform/pilot gates remain in force.

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

## Integrated UI and replaceable renderers

`apps/ui` is the production local reader. Home discovers and filters sessions; recordings open as accumulating scrollable history. Deliberate reading holds the viewport while capture continues. Sequence replay is optional. The crown shows evidenced agents, the centre contains source/patch/result material and unboxed prose, and the right dock keeps recorded native/MCP identities visible. Follow, Agents and Repository share the same history and evidence cutoff. Shared themes/settings and file comparison are detailed in [PRODUCT_DELIVERY](PRODUCT_DELIVERY.md).

The DOM mounts the measured viewport, overscan and disjoint selected/focused/expanded/anchor passages; the B4 worker supplies bounded windows for large sessions. Source readers request 200 lines, diff readers render 120 lines and daemon file history requests 24 actions. Comparison retains at most two selected references across trail pages. Source metadata, full export and arbitrary heavy edit limitations remain qualified by the B4 report. Resource preferences persist; map-off skips geometry loading/polling and motion-off retains every readable character.

Canvas 2D and DOM syntax rendering remain replaceable implementations; PixiJS and CodeMirror 6 are later options only when a measured need justifies them. P1's five finite semantic moves and measured origins are implemented. The old HTML studies remain under `/concepts/` as synthetic references; they do not replace the integrated worker/as-of engine. `compose()` output remains the contract, with golden tests. No capture or schema changes accompany the product presentation.

## Tests

`pnpm check` runs typecheck and 245 unit tests. `pnpm test:browser` builds the UI and runs synthetic live-history Playwright acceptance, including long-session mounted-DOM/focus, paged reading/file navigation and combined-demo tool filters; CI installs Chromium and runs it on Linux and Windows. The opt-in real-session journey stays skipped without its local manifest. The main groups:

- **JSONL**: partial lines, truncation, oversized and malformed records.
- **Adapters**: intents, correlation, unknown records, encrypted reasoning never surfaced.
- **Privacy**: rules, and end-to-end with no secret found on disk.
- **Projection rules**: diffs, patches, shell classification, test parsers.
- **Indexer**: resolution and determinism.
- **Explain**: evidence cut-off, citation validation, tier routing, no secret sent.
- **Daemon**: host, origin, token, CSRF, import allow-list, export leak checks.
- **Golden scenes**: `packages/scene/test/__golden__`, a pure composer at the fail, edit, pass and end moments.

CI is manually dispatched for explicitly selected final candidates, with checks/browser journeys on Linux and Windows and packaging on Linux/Windows/macOS. Commits and PRs do not trigger hosted runs; development verification runs locally. The committed demo bundle must remain reproducible. See [CI policy](CI_POLICY.md).

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
