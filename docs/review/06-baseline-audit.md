# Baseline audit — 30 September 2026

**Verdict:** the core pipeline works on the existing synthetic corpus and on a bounded, read-only sample of local journals. It is a useful integration draft. It is **not yet a finished backend or a production-ready live reader**. The next milestone is reliability/privacy plus a usable integrated history, followed by the premium presentation pass.

This audit changes docs and adds reproducible validation tooling. It does not fix the production findings below, freeze a schema, or certify real-recording exports. Product direction is in [PRODUCT_DIRECTION](../PRODUCT_DIRECTION.md); ordered implementation gates are in [IMPLEMENTATION_ROADMAP](../IMPLEMENTATION_ROADMAP.md).

## Scope and method

Reviewed the docs precedence, VISION, current STATUS/CODEBASE, engineering/canvas contracts, prototype and major source paths across adapters, capture, privacy, ingest, store, projection, indexer, composer, daemon/API, optional explanation and React UI. Inspected the synthetic prototype and app in the browser, including selection and responsive behavior. This is a product/architecture/source audit with targeted execution, not an exhaustive security review or supported-platform certification.

Source baseline: `23c783f` on `yash/backend-draft`. Environment: Windows, Node `v24.14.0`, local TypeScript, Vitest `3.2.7`, app Vite `8.3.1`. The earlier repair's [Linux/Windows CI run](https://github.com/drishya-dev/drishya/actions/runs/36318704791) was green after push; the previous STATUS note saying it still needed a remote run was stale.

### Reproduce locally

From the checkout after installing dependencies with the pinned pnpm version:

```sh
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p apps/ui/tsconfig.json --noEmit
node node_modules/vitest/vitest.mjs run
node scripts/validate-baseline.ts
node scripts/validate-baseline.ts --real-read-only
```

Build from `apps/ui`: `node node_modules/vite/bin/vite.js build`. The direct binaries avoid the machine's pnpm wrapper attempting an unrelated dependency reconciliation. The validation script also typechecked with `tsc --noEmit --allowImportingTsExtensions --module NodeNext --target ES2023 --skipLibCheck --strict scripts/validate-baseline.ts`.

`--real-read-only` is explicit opt-in. The script discovers local sources, samples the most recent inactive and largest eligible journal per adapter (5 KB–32 MiB, inactive for at least ten minutes), and bounds combined source bytes at 64 MiB per sample. It uses the real parser, sanitizer, reducer and composer **in memory**. It does not exercise real-data SQLite/blob persistence, browser rendering, live tailing or external model calls. It prints only aggregate metrics. SHA-256 before/after checks verify sampled source files did not change during the run. This is not proof of completeness across all discovered journals.

Synthetic data exercises actual persistence, restart, API and live collection in a scratch store, which is closed and removed afterward. The script's privacy probes report known failure booleans; exit zero means its asserted baseline checks completed, **not that every diagnostic or release gate passed**.

## Measured results

| Check | Observed result |
|---|---|
| Backend and UI typecheck | Passed |
| Existing tests | 96/96, 10 files |
| UI production build | Passed; Vite 8.3.1 |
| Synthetic Claude + companion | 34 observations, 12 operations, 6 artifacts, zero import gaps |
| Synthetic Codex | 17 observations, 5 operations, 2 artifacts, zero import gaps |
| Reimport and store restart | Added zero duplicate observations |
| Local API | Unauthorized recordings request 401; authenticated projection/graph/search returned 200 |
| Synthetic Claude artifacts | Zero missing referenced blob contents |
| Live collection without viewer | Partial line withheld; completed line appeared; stop/close completed |
| Ordinary synthetic secret value | Redacted |
| Synthetic secret in retained `base64` sibling | **Not redacted** |
| Synthetic secret as JSON object key | **Not redacted** |

Discovery found **574 Claude Code and 29 Codex sources (603 total)**. Four sampled main journals had no companions and no sources skipped by the byte budget. Results below are from one diagnostic run, not performance percentiles:

| Sample | Source bytes | Observations | Operations | Artifacts | Prose | Visible gaps | Parse errors | Total / compose |
|---|---:|---:|---:|---:|---:|---|---:|---|
| Claude, recent inactive | 7,150,502 | 798 | 292 | 278 | 106 | 2 compaction + 10 unsupported-record | 0 | 110 / 1 ms |
| Claude, largest eligible | 19,555,780 | 2,005 | 698 | 384 | 190 | 2 compaction | 0 | 205 / 2 ms |
| Codex, recent inactive | 1,644,790 | 141 | 39 | 12 | 29 | 0 | 0 | 26 / <1 ms |
| Codex, largest eligible | 21,246,288 | 53 | 16 | 8 | 10 | 0 | 0 | 44 / <1 ms |

All sampled files had unchanged hashes; no malformed or oversized records were reported. Zero exceptions is not proof every record was understood. The ten unsupported Claude records are an explicit follow-up: inspect their structural types locally and create **synthetic** fixtures before changing ignore/classification rules. Compaction is a real source limitation and should stay visible. Large source byte count with few operations is not by itself a parser failure: raw journals may contain large injected context and non-operation data.

The read-only strategy was deliberate after the sanitizer probes failed. No new real recording was persisted, exported or sent to a model by this audit. Fix the known bypasses before running the full persisted/visual real-session baseline. Previous sessions' wider validation reports remain historical reports, not rerun results from this audit.

## Interface comparison

`docs/prototype/index.html` is a synthetic interaction reference, not a harness integration. Its file origins, retained passages, filters and relationship emphasis should inform the app. `apps/ui` connects to real projection/artifact/session APIs and should remain the production base. Preserve that integration and replace weak presentation behaviors incrementally.

In the browser, the base app's synthetic demo opened, advanced, paused, and opened a selected read in the inspector with the full 14-line captured excerpt. The default capture showed content already visible while the read was labelled running, consistent with the source's use of final operation details during a partial replay. At 900 CSS px, two fixed-width action surfaces produced a horizontal passage scrollbar and clipped the next action. Phone-width state was inspected, but this was not a complete mobile/accessibility acceptance test. The prototype was also played and visually inspected; no ten-minute or frame-time claim follows from these spot checks.

The base app currently depends heavily on a persistent movie transport and a side inspector. The builder's final live experience should instead preserve the entire accumulating history and the reader's anchor, support in-place expansion, and make the transport secondary. The actual UI files were not redesigned by this audit.

## Findings ordered by implementation importance

“Reproduced” means an executed probe or browser observation. “Source finding” means the code path was inspected; the suggested failure scenario still needs a regression test. These distinctions matter.

| ID / gate | Evidence | Finding and user consequence | Next test/change |
|---|---|---|---|
| A01 / B0 | **Reproduced**; `packages/privacy/src/index.ts`, `sanitize` | Base64 removal returns retained siblings without recursive sanitation; JSON object keys are never scrubbed. Secrets can cross the stated privacy boundary | Canary tests through nested sanitation and actual store/blob/search sinks; define key collision policy |
| A02 / B0 | Source finding; `capture-core/src/index.ts`, `seal`; privacy; server | Envelope fields such as branch/native ids bypass payload sanitation; truncation precedes matching; notes/error text/discovery metadata need explicit sink policy | Audit every retained string, truncation boundaries and protected nested content; test serialized bytes and errors |
| A03 / B0 | Source finding; `apps/daemon/src/app.ts`, `exportBundle` | Combined export starts from first recording metadata/root and does not inventory every local root; “no local paths” is stronger than implementation | Two-worktree synthetic export fixture, all-root path masking, selection-wide metadata |
| A04 / B0 | Source finding; `server.ts` explain/briefing/labels; explain package | Confirm regenerates evidence after preview; live data may change. Labels preview is not exact payload. Generated caches lack full revision/model/policy identity | Bind consent to exact immutable payload/destination/model; stale-consent and cache tests |
| A05 / B1 | Source finding; `packages/ingest/src/index.ts`; `server.ts` | Discovery failures become empty lists; missing source returns silently; server swallows ingest error events. User can mistake failure for inactivity | Recording-health state and sanitized gap/error delivery; permission/missing-source tests |
| A06 / B1 | Source finding; ingest `startLive`/`locked` | Interval ticks serialize behind slow work without coalescing. Backlog can grow under slow ingest | One in-flight read + pending flag, bounded work; slow-source stress test |
| A07 / B1 | Source finding; `server.ts` events, `apps/ui/src/api.ts`, `App.tsx` | SSE has no revision recovery and client has no reconnect resync. A missed last update can stay invisible until another write | Reconnect with no new event must converge; slow subscriber buffer cap |
| A08 / B1 | Source finding; `server.ts` DELETE; `store/src/index.ts` | Forget can race queued ingest; blob files are not reclaimed with recording rows | Cancellation/await + reference-safe cleanup test; retention wording |
| A09 / B1 | Source finding; `commands.ts` import | Advertised `import --live` is not applied; command closes the app | Implement a lifecycle or remove flag/help promise; CLI test |
| A10 / B1 | Source finding; `server.ts` auth | “One-time” bootstrap token is reusable for launch lifetime; session set has no expiry | Choose/implement token and session lifecycle; align docs and tests |
| A11 / B2 | Source finding; reducer `knownFull`, app combined projection/graph | Multi-session aggregation has insufficient workspace isolation; relative paths can share snapshot state across roots | Separate worktree identity and reconstruction; reject incompatible merge |
| A12 / B2 | Source finding; reducer grouping; UI state | Positional passage ids and reordered late observations cannot reliably anchor long live history; stale async session responses can win | Stable item anchors, revision-aware caches and request cancellation |
| A13 / B2 | **Browser-observed** + source; `History.tsx`, renderer, final projection details | Replay's partial scene status can coexist with future output. Temporal honesty is broader than composer status | Renderer as-of result/artifact tests, evidence-pack cut-off tests |
| A14 / B3 | Source finding; `state.ts`, `App.tsx` | Live reload sets timed playback going; held selection can keep new work out of visible history. Reader and presentation cursor are coupled | Separate committed history from reader/follow/replay states |
| A15 / B3–B4 | Source finding; `History.tsx`, `common.tsx`, API | “Show earlier” mounts ever more history; full projection re-fetch; full blob split for capped artifact endpoint; UI loses truncation metadata; cache is not a strict byte-bounded LRU | Paged history/ranges, virtualization, explicit omission state, in-flight cache accounting |
| A16 / B3 | **Browser-observed** + source; styles/Viewer | Fixed surface widths force horizontal passage reading at medium width; native dock actions aren't clickable like MCP filters | Content-aware wrap/expansion; all origins useful as navigation |
| A17 / B4 | Source finding; store/indexer/app | Synchronous SQLite/reduce; cached graph can remain stale; migration/version handling and packed distribution lack release proof | Benchmarks, worker boundaries, explicit graph generations, migration and packed-install matrix |

Additional follow-ups: guard global keyboard shortcuts on focused controls; preserve previous scroll anchor when loading earlier passages; retry rejected artifact fetches; distinguish heuristic briefing counts from captured facts; review saved live/combined projection cache invalidation. These are concrete parts of B1–B3, not reasons to add a new architecture.

## What remains unverified

- Full real-data import after privacy fixes, real live UI with a running agent, and companion-heavy real-session coverage in this audit.
- 100k-event/1–2 GiB runs, daemon/browser memory ceilings, capture overhead, GPU/frame budget and ten-minute reading comfort.
- macOS clean install; packed npm distribution on all platforms; installed-package Node type-stripping behavior.
- Remote Nemotron requests, model ids/availability, semantic explanation correctness and live consent lifecycle.
- End-to-end automated browser tests, full keyboard/screen-reader behavior, combined-worktree correctness and all export paths.

Passing the current test suite is evidence of the existing supported cases. It does not make these untested cases pass. Use this list and the ordered roadmap to close the baseline before expanding the product.
