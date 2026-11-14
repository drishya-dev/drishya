# Antigravity parity matrix (PR #490)

Yash's requirement, 14 Nov: Antigravity is one more harness with the same functionality as Claude Code and Codex, no differences, everything works properly. This file records the check, surface by surface, on **real local sessions** imported into a scratch Drishya home (never the real one). Counts and id prefixes only; frames are in `.local/frames/` and are not committed.

Legend: **same** = same component, same behaviour, checked. **fixed** = it differed, fixed in this PR. **necessity** = differs because Antigravity does not record the data, or because Drishya may not steer it; the evidence is given. **follow-up** = a gap that is a feature, not a bug in parity, recorded in TASKS.

## Sessions used

Scratch daemon with 13 Antigravity (AG), 6 Claude Code (CC) and 6 Codex (CX) real sessions. Richest-session UI pass: AG `rec_7c8b19e5` (grown live sessions such as `rec_a01fc1a0`, 47 MB, were used for the live checks), CC `rec_5e2feb95`, CX `rec_13949e17`. Each opened at 1440 and 600 px; zero console or page errors in all 12 runs (`.local/parity-ui.json`).

## UI surfaces

| Surface | CC | CX | AG | Evidence |
|---|---|---|---|---|
| Home: counts, filter, harness groups | same | same | same | 25 sessions listed; AG rows carry the `A` icon in the violet token, same row layout; empty state names all three harnesses |
| Home: running state | same | same | same | live AG session shows running exactly as a live CC/CX one |
| Library search | same | same | same | Search control present and opens on all three |
| Opening a session (`#/r/<id>`) | same | same | same | opens, history renders, 0 errors at 1440 and 600 |
| Work view and Conversation view and the switch back | same | same | same | Conversation has content on all three, switch back restores Work, 1440 and 600 |
| Composer | same | same | **necessity** | AG has no composer and shows the read-only line. Drishya may not steer Antigravity (controller supports Claude Code and Codex only). This is the one accepted difference (Yash). |
| Changes, Open developer workspace, Git, Search, Notes, Copy reference, Previous/Next failure, Next edit, Export, Show files, Explore repository map | same | same | same | the control set is identical across the three; each of Changes, Workspace, Git, Search, Map, Files opened without error on all three at 1440 |
| Files tree and peek | same | same | same | AG file operations carry the same file links as CC/CX (26,100 links on the AG set) |
| Map | same | same | same | opens, no errors; AG operations resolve to repository files the same way |
| Changes and Git linking | same | same | same | opens on all three; AG edits link to their files (1,250 edit operations on the AG set) |
| Workspace | same | same | same | opens on all three |
| Replay (`?at=<step>`) | same | same | same | transport appears on all three |
| Live follow | same | same | **fixed** | the append-only fold and history worker could serve a stale projection for a live AG recording, because AG replaces a step's receipt in place. Fixed (see below), pinned by unit tests; the Follow switch is the same component. |
| Export (`GET /v1/recordings/<id>/export`) | same | same | same | 200 on all three (706 KB, 598 KB, 246 KB in 31 to 62 ms) |
| Offline bundle (`?bundle=`) | same | same | same | all three load read-only with no composer, 0 errors, 1440 and 600 |
| 600 and 1440 | same | same | same | no layout error, no console error in any of the six runs each |

## Cards and projection coverage

Counts are operations on the six-to-thirteen real sessions above. A zero for CC or CX means those sessions simply have no such case, not that the feature is missing.

| Card or feature | CC | CX | AG | Status |
|---|---|---|---|---|
| Shell | 123 | 164 | 2,676 | same |
| Read | 33 | 0 | 3,391 | same (CX records reads as shell) |
| Edit and diff | 2 | 0 | 1,250 | **necessity**, see below |
| Search | 34 | 0 | 559 | same |
| Web and browser | 0 | 0 | 10 web | same card; `browser-ops` passes (CC/CX), AG web operations present in projection |
| MCP | 11 | 35 | 3 | same |
| Images | case | case | not on a real session | `check:real antigravity-media` found 0 image references in the 12 local AG sessions (AG-4 media is covered by the fixture and the adapter tests only). CC/CX images: cases `multi-image-prompts`, `image-only-prompt`. **Unverified on a real AG session**: none exists locally; make one when a harness run is available. |
| Plans | 8 | 0 | 26 | same; AG plan is the `artifact.plan` addition (schema 0.2.2) |
| Questions | case | case | not on a real session | `check:real questions` reports no AG session containing the case; AG's question tool is covered by the native-cases fixture. **Unverified on a real AG session.** Minor: AG `ask_question` is matched by tool name globally (follow-up) |
| Sub-agents | 6 | 7 | 17 agents, 22 spawns | same |
| Thinking / reasoning | 28 | 6 | 3,006 | same card. AG records plaintext thinking, so it has the most |
| Excerpts, outputs, snapshots | 59 / 13 / 2 | 0 / 46 / 0 | 2,083 / 604 / 1,263 | same |
| Gaps | 29 | 0 | 582 | same (honest "not recorded" markers) |
| Compaction | case | case | summaries present | same card; AG source value `antigravity-checkpoint` (schema 0.2.2). The checkpoint boundary count mismatch in `check:real` also occurs on clean main. |
| Turns | 0 | 38 | 69 | same |

## Where Antigravity differs, and why

These are **necessity** rows. Each is a field the Antigravity transcript does not contain, so there is nothing to show truthfully; Drishya's rule is to say "not recorded" and never invent it.

| Difference | Why | Evidence |
|---|---|---|
| No composer; read-only line | Drishya may not steer Antigravity | accepted by Yash |
| Command pass/fail is mostly `unknown` (3,277 of the AG operations) | the transcript has no exit codes; the DB has typed exit codes | research note [antigravity-harness](antigravity-harness.md) section 1 |
| Edits show the requested change; reconstruction is `unavailable` | the transcript records what the agent asked for, not the applied file | same note |
| No context window, usage, available tools or recorded branch | transcript lacks branch, model and tool lists; token fields exist in only 46 of 134 local transcripts | same note; `usage` and `context` keys are absent only for AG |

## Follow-ups (not parity bugs)

- **Real AG sessions for images and questions**: none exist locally, so both are fixture-checked only. Run Antigravity on a throwaway repository to record them before claiming them.
- **AG-6 (P1)**: enrich from the per-conversation DB (exit codes, applied diffs, branch, model, tokens, durations). This removes the unknown-status and edit-reconstruction differences above.
- **AG usage from transcript tokens**: 7,906 rows in 46 of 134 transcripts. `UsagePayload.source` is a closed union, so a new value needs both builders' agreement (schema change); not done here.
- AG `ask_question` matched by tool name globally (minor).
- Pre-existing browser-gate flakes (10 specs, the Follow switch intercepting composer clicks at narrow widths) reproduce on clean main.
- PERF-4 will refactor `createReducer` state; the Antigravity exclusion from the resident fold (`ingest`), the incremental history reducer (`history-worker`) and `ProjectionFold.plan` are three small, commented guards that need carrying over.

## What was fixed for parity in this PR

- The resident `ProjectionFold` and the history worker's incremental reducer (LIVE-7b) are append-only. Antigravity replaces a step's receipt in place (same observation id and sequence) and orders by step index, so a followed AG recording could serve a stale or divergent projection. The fold now refuses it, so it is rebuilt. Pinned by `fold-parity.test.ts` (AG case at every split, finished and live), `antigravity-live.test.ts` and `apps/daemon/test/antigravity-live-history.test.ts`.
- `check:real` no longer reports a false failure when a live AG journal grows during the check.
- `packages/capture-core/src/index.ts` NUL bytes escaped as `\u0000` (ids pinned by `ids.test.ts`), so git treats the file as text.
