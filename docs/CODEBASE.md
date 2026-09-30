# Codebase — the system as built

**Draft built 22–25 Sep; audited 30 Sep 2026.** This maps the code that exists. The [baseline audit](review/06-baseline-audit.md) qualifies verified behavior and known gaps; the [roadmap](IMPLEMENTATION_ROADMAP.md) governs current execution. For architecture rationale see the engineering plan; for creative intent see VISION. [`packages/contracts`](../packages/contracts/src/index.ts) remains `0.1.0-draft`, and freezing it needs both builders ([`AGENTS.md`](../AGENTS.md)).

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
| `ingest` | Import, resume, live tailing (polling), projection caching, combined views, change events | `src/index.ts` |
| `projection` | The reducer, plus derived rules: shell classification, test-output parsing, patch/diff | `src/reduce.ts`, `src/shell.ts`, `src/tests.ts`, `src/patch.ts` |
| `indexer` | Repository map: file enumeration, import extraction and resolution, deterministic layout | `src/index.ts` |
| `scene` | `compose()`, markers, pacing (`dwellFor`), step lookups — runs in Node and the browser | `src/index.ts` |
| `explain` | Nemotron on Nebius Token Factory: evidence packs, consent preview, citation validation | `src/index.ts` |
| `apps/daemon` | `drishya` CLI and the local API server | `src/cli.ts`, `src/commands.ts`, `src/server.ts`, `src/app.ts` |
| `apps/ui` | Base UI: React 19 + Vite + Zustand | `src/App.tsx`, `src/components/*` |

TypeScript runs directly on Node 24 (type stripping), with no build step for the backend. Source files therefore use erasable syntax only: no enums and no parameter properties.

## Identity and provenance

- **Recording id** = hash of adapter + main journal path. **Observation id** = hash of adapter, source, and the native record id (Claude `uuid`) or generation + byte offset (Codex), plus the part index. Re-importing adds nothing, and restart resumes from the committed cursor.
- **Captured / derived / generated.** Captured = bytes the harness recorded (after redaction). Derived = computed by a named, versioned rule, e.g. `shell-classify-v1` (a `sed -n` shown as a read), `apply-edit-verified-v1` (an after-state reconstructed from a captured base), or test counts parsed from output. Generated = written by a model and labelled with that model. The UI shows the badge and the rule.
- **Links** carry `relation` and `basis`. Temporal neighbours are "nearby in time", never a reason. `test-outcome-change` says a test failed and later passed; it does not say which edit fixed it.
- **Edits.** The captured hunks are always shown. A full after-state exists only when the edit applies exactly once to a captured base; otherwise `reconstructionNote` says why. Recent Claude Code (2.1.x) often records `originalFile: null`, so this is common, and it is expected.

## Privacy (constraint 3)

`seal()` applies a best-effort privacy policy before observation storage. Rules cover private keys, common provider tokens, JWTs, bearer tokens, URL credentials and high-entropy assignments. Protected-file content has omission rules; supported image shapes are dropped; model evidence is redacted again; bundle export masks configured paths and re-keys ids. `packages/ingest/test` checks database/blob bytes for selected planted secrets.

**Known gaps, 30 Sep:** not every string is covered. The audit reproduced unsanitized retained siblings in a `base64` object and unsanitized object keys; envelope metadata, other sinks, truncation and combined exports need hardening. Do not describe the current policy as a guarantee or expand real-data persistence/sharing before B0. See [audit A01–A04](review/06-baseline-audit.md) and [roadmap B0](IMPLEMENTATION_ROADMAP.md#3-b0--privacy-and-trust-are-release-blockers).

## Adapters — how to add a harness

1. Add `packages/adapter-<name>` implementing `Adapter` (`capture-core/src/index.ts`): `discover`, `sourceSet`, `createParser`, `sniff`, and a `descriptor` with an honest capability matrix.
2. Map the harness's tools to `ToolIntent` and its results to `ToolOutcome`. The reducer and UI never see harness tool names, except for display.
3. Emit `unknown` for record types you do not know, and ignore bookkeeping records deliberately (keep a named list).
4. Write synthetic fixtures in the real format (`scripts/fixtures/make-synthetic.ts`) and parser tests. Never commit a real session.
5. Register it in `ingest/src/index.ts` (`defaultAdapters`).

Formats verified on this machine on 22–25 Sep 2026 against 574 Claude Code and 28 Codex sessions. Newer records that are handled: Claude `ai-title` and `cost-state`; Codex `exec` (code mode), `spawn_agent`/`agent_message` (collaboration) and `namespace: "mcp__<server>"`.

## Local API and security

Loopback only. `drishya serve` prints a per-launch token in the URL fragment. The UI sends it to the local API to obtain an `HttpOnly; SameSite=Strict` cookie. The token currently remains reusable for that server lifetime; earlier “one-time” wording overstated the behavior. Host/Origin checks, JSON mutation requirements and CSP are implemented. `/v1/import` is discovery-allowlisted. SSE carries change notices, but durable revision/reconnect recovery is not yet implemented. Routes and tests are in `apps/daemon/src/server.ts` and `apps/daemon/test/server.test.ts`.

## Base UI — what is placeholder

The base UI exercises home/session import/watch, combined views, synthetic demo, agent crown, file spine, passages, unboxed prose, dock/MCP filters, filmstrip, inspector, search, map and optional explanations. This is integration scaffolding, not final behavior or complete acceptance coverage. Live updates currently depend on a timed playback cursor; selection holds that cursor. Native dock entries lack equivalent filter actions, and fixed action widths cause horizontal passage scrolling at medium widths. The 30 Sep direction requires independent accumulating history, stable reading anchors and content-shaped expansion. See the audit and roadmap B3.

These parts are placeholders for the frontend pass: the Canvas 2D map (→ PixiJS), the regex highlighter and code views (→ CodeMirror 6), the simple CSS arrivals (→ the choreographed Lift/Emit/Settle/Surface/Resolve with origin tethers), and history windowing (→ proper virtualization). `compose()` output is the contract the frontend renders; change it deliberately and update the goldens.

## Tests

`pnpm check` runs typecheck and 96 tests. The main groups:

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
