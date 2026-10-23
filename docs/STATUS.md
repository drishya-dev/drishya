# STATUS — where we are

**For *what* we are building, start at [`VISION.md`](VISION.md) and the [precedence map](README.md). This file is *where we are*.**

Two builders, shared ownership, mutual review. No fixed track split — take the next thing from the queue, and **claim it here before you start** so we never edit the same file at once.

> **Rule: update this file when you stop working, not when you start.** Thirty seconds at the end of a session saves the other person twenty minutes at the start of theirs.
>
> **The chat is not the memory. This file and the blueprint are.** Session history does not survive folder renames, account switches or the 30-day retention sweep. If losing a conversation would lose real context, that context belongs in these files. (Blueprint App. A2)

---

## Right now

| | |
|---|---|
| **Milestone** | [TASKS.md](TASKS.md) is the single current checkbox list. Modern UI/themes and native workflow finishing remain open; local draft editing exists. Previous tool boxes restored by PR92. One coherent commit per PR; local checks only. |
| **Repo** | [`drishya-dev/drishya`](https://github.com/drishya-dev/drishya) — **private**, Apache-2.0, `main`; backend draft merged via PR #1 |
| **Blocked on** | No B2/B3 implementation blocker. The full draft contract freeze still needs both builders' review |
| **Next gate** | Use and refine the real integrated product; human comprehension/preference pilot and physical/platform B4 release acceptance. No further standalone HTML approval gate. See [PRODUCT_DELIVERY](PRODUCT_DELIVERY.md) |

### Claimed

**Claim before you start, so two people (or two agents) never work on the same thing.** The table is keyed by [TASKS](TASKS.md) IDs.

1. `git pull`, then run `node scripts/claims.ts` (add `P0`, `P1`… for one priority, `--free` for unclaimed only). It lists open items in priority order and marks claimed ones.
2. Pick a **free** item that does not share files with a claimed row. Overlapping files → pick another, or talk to the claimer first.
3. Add one row below and **push it to `main` immediately** (`docs: claim <ID>`; a docs-only commit is allowed on `main`). If the push is rejected, someone claimed at the same time: pull and re-check.
4. When the work merges, **delete your row in the same PR** (or right after), tick the item in [TASKS](TASKS.md) and run `node scripts/sync-tasks.ts`. Add a "Last session" block as usual.
5. A claim with no branch or commit for 3 days is stale; anyone may take it after asking.

| TASKS ID | Who | Branch | Since | Files |
|---|---|---|---|---|
| PERF-2 | @harsh + Claude Opus 5.5 (took over from Codex) | `harsh/perf-2-combined` | 2026-10-23 | One combined candidate superseding #188 and #197–#205: `apps/daemon/src/{app,history,history-worker,server}.ts`, `packages/ingest`, `packages/privacy`, `components/History.tsx`, `components/common.tsx`, `lib/{material-motion,passage-content,history-artifacts,tool-output}.ts`, bench scripts |
| DATA-3 | @yash + Claude | `yash/data-3-codex-turn-metadata` | 2026-10-23 | First slice: Codex `task_complete` timing/error, `turn_context` settings (model, effort, approval, sandbox, collaboration) on the turn observations, `session_meta` policies; S1 of docs/review/125 (additive optional fields, `CONTRACT_VERSION` bump), `packages/adapter-codex`, `packages/contracts`, `packages/projection` (`Projection.turns`, reducer bump), tests. No UI; TURN-1 and CONTENT-5 consume it. Schema change per S1: Harsh reviews in the PR. |


---

## Last session

### Yash with Claude (Sonnet 5.5) — CONTENT-5 delegation card
- **CONTENT-5 slice:** a delegation card now says who ran it (address, model, effort) and expands to the agent, the task it was given and the result returned to the parent, in Modern and Classic. Claude Code's reply is shown; Codex's result is only a `{task_name}` acknowledgement and is labelled as such. Counts from the local journals and what stays open (link to the agent's own recording, the Codex interacted/completed lifecycle, depth/role from DATA-3) are in TASKS CONTENT-5. No schema change.

### Yash with Claude (Opus 5.5) — TEST-2 spec races fixed and accepted (PR #196)
- **Claimed TEST-2.** PR #196 changes only specs: a keyboard `expandCard` helper, waiting until history can scroll before wheel gestures, polling a popup's URL instead of its load event, and settling composer animations before measuring. Causes are in TASKS TEST-2.
- **Acceptance met:** three consecutive clean full runs on the branch (295 passed, 26 skipped, 0 failed each). TEST-2 is ticked and its claim row removed in #196, which is still a draft awaiting review.
- **Watch out for:** a CPU burner makes slow scans miss their 10 s waits; that is not the rotating set. Reproduce at normal load.

### Yash with Claude — CONTENT-4 pinned checklist; CONTENT-1, DATA-4/5/6 and CONTENT-9 earlier
- **CONTENT-4 slice:** the turn's todo list is pinned under the prompt in Modern and rewritten in place; each update in the stream is one line. Details and what stays open (TaskCreate/ExitPlanMode, Codex plan) are in TASKS CONTENT-4. Harsh's PERF-2 PR #188 merges cleanly with main (731 unit tests pass on the trial merge) but is still a draft awaiting the real-journal benchmark runs it requests.
- **CONTENT-3 slice (declined actions):** a Claude action the person declined, or that auto mode blocked, is now shown as "did not run" with the harness's reason instead of a red failure, and counted as "declined" in the turn ledger. Details, the real-journal counts and the Codex gap (no approval events in any local Codex journal) are in TASKS CONTENT-3. Old recordings need a rescan to show it.

#### Earlier the same day
- **CONTENT-1 slice 1:** images in Claude tool results are kept under the revised D7 (signature-checked, 4 MiB each, 256 MiB per session), served lazily by hash and shown as thumbnails with a reader. Details are in TASKS CONTENT-1. Slice 2 added images pasted into prompts and Codex prompt/tool-output images. Slice 3 added path-only cards with a consented "open current file". Claim released; the acceptance gaps (real Codex ImageView, phone) are listed in TASKS CONTENT-1.

- **DATA-6:** Claude Code's "file changed outside its edits" notices show as a muted line in history (snippet on click, placed in recorded order) and a ≠ mark on the file row, never attributed to a person. Details are in TASKS DATA-6. review125 S5 is now complete. **Next:** CONTENT-1 (images) with the revised D7.

- **DATA-5:** each Claude edit links to its turn's checkpoint, and "Show file before this turn" reads the backup on request with workspace approval. Details are in TASKS DATA-5. **Watch out for:** never copy `node_modules` into a scratch git worktree on Windows. Removing it followed pnpm junctions and deleted this checkout's `packages/` and installed dependencies (21 Oct; restored from git plus a forced frozen-lockfile install). **Next:** DATA-6, then CONTENT-1 with the revised D7.

- **DATA-4 (PR #187):** Claude command facts (interrupted, background, exit note, saved-output reference with an on-request redacted reader), WebFetch status/size/time and permission mode per prompt. Details and what stays unmapped are in TASKS DATA-4. **Next:** DATA-5 (checkpoints), DATA-6 (changed outside the agent), then CONTENT-1 with the revised D7.

- **CONTENT-9 (PR #186):** Yash approved review125 S3, S5 and D7 (decision logged; D7 caps provisional). Reasoning saved without text now reads as one quiet "Reasoning not recorded by <harness>" line per turn; saved thinking and summaries are unchanged. Old recordings need a journal rescan to show it. Measured counts are in TASKS CONTENT-9 and DATA-8. **Next:** S5 (DATA-4, DATA-5, DATA-6), then CONTENT-1 with D7.
- **When (PERF-2):** 21 October 2026. Policy-version cache (≈ 900 ms of daemon main-thread time per probe window), map palette cache, file-tree early return; all pixel-identical. API p95 unchanged because the remaining cost is the page's render work during live bursts. Builder decision: continue other TASKS items while PERF-2 stays red (logged).

### Yash with Claude (Opus 5.5) — paused 21 Oct: PERF-2 measured, TEST-2 awaiting acceptance runs

- **Merged today:** PERF-2 fixes 1–3 (#176), TEST-2 spec fixes (#177 connected-workspace Home search, #178 hover-fit retry, #179 keyboard Expand/ⓘ, #180 settings-typography waits for colour transitions). No open PRs or claims.
- **PERF-2 (gate red):** idle re-measure is in [perf-2-latency](review/perf-2-latency.md). Visible update passes; interaction p95 (145–294 ms) and append + browser RSS on 563.8 MB (529 / 573 MiB) fail. First history page 6.8 → 4.0 s head-to-head. Next: profile the daemon thread during append beyond ingest; measure the worker's resident reducer + projection.
- **TEST-2 (open):** every full-run failure seen so far has a recorded cause and fix. Acceptance still needs three consecutive clean full runs on main after #180; they were started and stopped at the builder's request. Run `DRISHYA_BROWSER_CHANNEL=msedge npx playwright test` three times and tick TEST-2 if all are clean.

### Harsh with Codex, then Claude (Opus 5.5) — PERF-2 combined candidate; gate still unproven

- **When:** 21–23 October 2026. Codex built the fixes as ten stacked drafts (#188, #197–#205) but stalled re-running parallel browser suites without an end-to-end comparison. Claude took over, measured the stack against main, added two page fixes and squashed everything onto main `e276aaa` as `harsh/perf-2-combined`; the drafts are closed as superseded.
- **Delivered:** ownership-safe history-blob reuse; URL-credential precondition and keyword-first secret-assignment scan (redaction byte-identical on fixtures, 5,000 generated cases and the invented corpus; policy p3 unchanged); yields between records inside 1 MiB slices; worker-encoded history pages streamed in 64 KiB chunks; single-owner projection cache; SQLite page release after bulk work; interruptible live history renders, per-passage memo and batched layout reads; batched diff-preview scrolls (about 560 ms of forced layouts per 16 MiB burst) and plain-line skipping in tool-output decoding (about 150 ms). Opt-in diagnostics and the invented-journal generator; raw sample files kept local. No visual or animation change intended.
- **Validation:** see the PR. Invented-journal comparison against main (alternating, i7-13650HX, not reference acceptance): 171 MB daemon event-loop max 105–189 → 38–43 ms, import 7.5–8.7 → 6.1–6.3 s; 374 MB peak RSS 495–549 → 458–477 MiB, API p95 210–299 → 127–181 ms. Tried and reverted for no measured gain: batching material-motion retargets; removing #201’s height reuse (its reads are not free here).
- **Next:** Yash’s five full-import and five browser runs per private 166/347 MB source on this branch. If API p95 still misses 100 ms, the remaining cost is one React commit plus forced layout when a burst mounts many cards; staging a burst’s new cards over a few frames would need builder sign-off as a visual change. DATA-3 stays held until the gate passes.

### Yash with Claude (Opus 5.5) — PERF-2 fixes 1–3 (gate still red)

- **When:** 21 October 2026. Derived blobs as rows (`SqliteBlobStore`, `HISTORY_VERSION` h2), ordered read sorts row ids, ingest stores reads in 1 MiB slices. Paired A/B on the 564 MB journal under heavy machine load: first history page ≈ 43% faster, RSS lower, tail catch-up slower but < 1.5 s, ids/order identical. See [perf-2-latency](review/perf-2-latency.md).
- **Open:** API p95 < 100 ms not established (load); re-measure five runs per source unloaded. Claim released; next candidates are listed in the report.

### Yash with Claude (Opus 5.5) — PERF-2 profiled after DATA-1/2 (claim held, fixes tomorrow)

- **When:** 20 October 2026. Merged DATA-2 (#149), DATA-1 (#151), TEST-2 (#175) and Codex PERF-1 (#171). Re-measured the 564 MB journal with typed items (26,593 observations): first history page ≈ 6.6 s, append+browser RSS 531–545 MiB, API p95 139–214 ms. The cold build's largest cost is ≈ 2.7 s of per-file derived blob writes (≈ 4,400 new files, 90 MB); then ≈ 1.8 s reducer logic and 0.66 s ordered read; live sync turns block the event loop 110–150 ms. Ordered plan for the fixes is under PERF-2 in TASKS. The performance gate stays red, so feature items wait.

### Yash with Codex — PERF-1 measured; PERF-2 gate open, ready for Claude review

- **When:** 20 October2026. PR **#171**, `codex/perf-1-large-journals`. Claimed the first independent dependency-ready item after DATA-3…6 overlapped Harsh's DATA-1/2 files. Adds opt-in isolated real-journal benchmark and a regression for partial writes/source preservation. Native journals stay read-only; normal/error completion removes snapshots and redacted stores. [Report](review/perf-1-large-journals.md).
- **Result:** five complete-import and five append/browser runs per166/347/564MB actual source. Zero capture gaps; every append result matches full-import observation IDs/order; repeated sync adds nothing. The biggest journal exceeds the512MiB reference screening budget and shows API stalls. PERF-1 measurement is complete; **PERF-2 remains open and new feature work is gated pending restoration or an explicitly agreed narrower support range**. No green scale/release claim.
- **Validation and limits:** 679 integrated unit tests plus36 focused JSONL/ingest/probe checks; both project types and direct script typecheck. Installed Edge on the reference Windows machine; uncontrolled background development load, warm OS cache, headless frame/API proxies, physical/human acceptance unmeasured. Rerun after DATA-1/2 retention changes. No runtime/schema/dependency changes, native turn or hosted CI.
- **Merge signal:** **#171 READY FOR CLAUDE REVIEW / SQUASH** after final numeric matrix and local checks. Own claim removed only in this finishing PR. Main #172 TodoWrite and subsequent EXPLAIN priority change integrated; other claims and dependency order preserved.


### Yash with Claude (Opus 5.5) — TEST-2 flaky specs (main cause fixed) and DATA-1/DATA-2 merged

- **When:** 20 October 2026. Found that a prompt-rail jump left follow on, so `followLatest` undid the jump on the next update in a warm browser; the rail now sets `follow: false` (History.tsx). That was the cause of the rotating `turn-fold`/`prompt-timeline`/product-workspace rail failures. Gated Harsh's DATA-2 (#149) and DATA-1 (#151) together on one tree (705 unit, 286 browser pass, only `hover-fit` codex failing, which also failed on main before) and merged both at the builder's request. #151 was stacked on the DATA-2 branch, so deleting that branch auto-closed it; it was reopened, retargeted to main and merged.
- **Open:** `hover-fit.spec.ts:51` (codex) fails only inside the full suite; TEST-2 stays open for it.

### Harsh with Codex — DATA-1 typed work and historical Script evidence

- **When:** 20 October 2026. PR151 implements review125 S2 and BUG-5, stacked on DATA-2/PR149. Typed commands retain actual command/exit/duration/output; source-ID matching wins, otherwise exactly one open exec permits a labelled enclosing-call relationship. Multiple/zero open calls remain standalone. Nested patch outcomes require an exact path set. Mixed multi-file patch/test wrappers keep every real card and one captured Script parent in details. MCP enrichment retains existing input. Agent metadata does not invent lineage from proximity; images remain references, unknown shapes metadata-only, and old observation IDs stay stable. No second reducer bump.
- **Verified locally:** `corepack pnpm check` — 695 tests; full browser run — 286 passed, 25 skipped. Dedicated synthetic and isolated real historical-reader journeys both passed after the mixed-wrapper correction. The real copy retained all 4,992 old observations, gained 1,484 typed observations and exposes 1,550 child operations including edits, plus 42 test runs; the next rescan adds zero. Native/live/refresh browser routes were blocked. Package verification passed; demo regeneration is byte-identical and old scene goldens are unchanged. Standard ten-minute synthetic reader soak: 84 rounds, peak 806 DOM nodes, 604478 ms.
- **Latest integration:** rebased onto the DATA-2 candidate containing main `343acf5` (READ-6 and bounded JSONL batches). The integrated check passes 705 tests; focused typed/Usage/READ-6 browser checks, including the real historical reader, packaging and identical demo checks pass. Full browser/soak counts above predate that upstream rebase. PERF-2's performance gate remains open and is not waived.
- **Limits/next:** the historical 441-test journal was not among the two available imported Codex sources; the 441-pass synthetic regression and real 42-run recording are verified, but that exact historical example remains unverified. No signed-in native/account turns, hosted CI or broad physical/platform/typed-heavy workload readiness is claimed. `SubAgentActivity` and image-generation shapes have synthetic coverage; per-CLI limits are in the adapter README. Typed reasoning/message extras remain S3/S4, D3/D7 stay undecided and FILES-1's deletion display gate remains open. Both PRs are for Yash's review; do not merge here. Preserve PERF-1/TEST-2 claims.

### Harsh with Codex — DATA-2 recorded usage and retained-journal enrichment

- **When:** 20 October 2026. PR149 implements DATA-2/BUG-6 under agreed D4–D6/D8. Additive contracts `0.2.0-draft`, the single reducer bump to `r5`, source-labelled Codex/Claude receipts, primary rate limits only, unknown-model cost suppression and a quiet rescan action inside Usage. Rescan resets the existing cursor/parser, retains generation/recording identity, and appends only new observation IDs. Existing timeline/evidence preservation has adapter, reducer, ingest and daemon coverage.
- **Verified locally:** `corepack pnpm check` — 685 tests, including a final regression for rate updates after a turn closes/restarts; those points remain unassigned to the finished turn. Full browser run — 282 passed, 25 skipped, 3 load-sensitive failures (patch-controls, prompt-rail-evidence, workspace-toolbar), all 3 passed in an isolated rerun. Focused Usage journeys cover both harnesses, missing values, unknown cost and rescan. Existing Codex/Claude UI verification used a separate redacted store copy with native/live routes blocked. Package verification passed; regenerated demo changes only `r4` → `r5` and a subsequent regeneration is identical. Final ten-minute soak: 84 rounds, peak 806 DOM nodes, 605117 ms.
- **Latest integration:** rebased onto main `343acf5` (READ-6 and bounded JSONL batches). The integrated check passes 695 tests; Usage/READ-6 browser integration, packaging and identical demo checks pass. The full browser/soak counts above predate that upstream rebase. PERF-2's performance gate remains open; this work does not waive it.
- **Limits/next:** no hosted CI, signed-in native/account turns, physical-device or cross-platform release checks. PR149 is for Yash's review; do not merge here. DATA-1 continues separately in PR151, stacked on this branch until DATA-2 merges. Preserve the other builders' current claims and scope.


### Yash with Codex — PERF-2 bounded batching accepted for merge; gate still open

- **When:**20 October2026. PR **#174**, `codex/perf-2-jsonl-batches`. Builder explicitly approved merging the current bounded batching increment. Claim released; PERF-2 remains open for separately claimed follow-up. Only JSONL source/test changed; no files owned by DATA-1/2 or TEST-2. Complete-record soft4MiB batches preserve16MiB records and all byte/cursor/gap semantics.
- **Evidence:** five rotated before/after actual564MB runs, each8,803 observations identical to full import with zero gaps. Median peak RSS514.50→389.52MiB (-24.3%), but median bulk time7.12→8.14s (+14.2%); API/frame responsiveness remains outside targets. [Numbers and reproducible comparison](review/perf-2-jsonl-batches.md).
- **Checks:**688 integrated unit tests and backend TypeScript pass. Added maximum16MiB/split/UTF-8 offset/partial-write/truncation/oversized-gap regressions. No hosted CI or native turn.
- **Signal:** **MERGE AUTHORIZED BY BUILDER (20 October).** Accept the current memory reduction with the measured import slowdown; throughput/latency tradeoff is still unresolved. Next scope is coordinated ingest/sealing/history profiling and retest after DATA-1/2; preserve their claims. PERF-1 #171 remains a separate measurement PR for Claude review. No new features under the red gate.


### Yash with Claude (Sonnet 5.5) — READ-6 read-before-write (Claude edits)

- **When:** 20 October 2026. `readBeforeWriteFor` (scene) lists the same agent's earlier successful reads of the edited file and relates them to the lines the edit replaces; one line in the expanded edit card; worker route `read-before`; bundles compute locally. New `read-before-write.spec.ts`. **CONTENT-9 was not started:** it needs review-125 S3 (an observation for empty/encrypted reasoning) in adapter-claude, adapter-codex, contracts and projection, which Harsh's DATA-1/DATA-2 rows hold. Take CONTENT-9, DATA-3…6 and the data-dependent CONTENT items after those merge; they are the critical path.
- **Limits:** Claude only; a read taken before an earlier edit is not compared by line number; the count of reads is of this capture, not of everything the agent knew.

### Yash with Claude (Sonnet 5.5) — CONTENT-4 plan checklist (TodoWrite slice, partial)

- **When:** 20 October 2026. `planThreads` (scene) groups TodoWrite lists by agent and turn; `PlanChecklist` shows the newest as a checklist and earlier ones as one change line each, with a revision stepper when expanded and in the Inspector. `plan` cards can now be expanded. New `plan-checklist.spec.ts`. DATA-4 was **not** started: it needs adapter-claude/contracts/projection, which Harsh's DATA-2/DATA-1 rows hold; take it after those merge.
- **Limits:** synthetic data only (no real TodoWrite in any local journal); TaskCreate/TaskUpdate/ExitPlanMode and pinning under the turn header remain open.

### Yash with Claude (Sonnet 5.5) — READ-7 failure → fix chains

- **When:** 20 October 2026. `fixChainFor` (scene) links a failed shell/test run to the next run of the same command identity and lists the edits recorded between; shown as one line in the expanded card on both runs. Worker + `GET /v1/recordings/:id/fix-chain/:op`; bundles compute locally. New `fix-chain.spec.ts`; also repaired `investigation-finishing.spec.ts` (title became a button in FILES-2, same cause as #162). Whole suite: 674 unit; browser 273 pass, `hover-fit` and `settings-typography` pass alone (load-flaky).
- **Limits:** identity is exact command text (or captured input blob), so a re-run with different arguments is not linked; relationship is order only.

### Yash with Claude (Sonnet 5.5) — CONTENT-3 Claude question card (partial)

- **When:** 20 October 2026. `lib/ask-question.ts` parses a captured AskUserQuestion (input plus "The user answered: …" result); `QuestionCard` shows each question, chosen options when known, and typed answers; hooked into the generic preview and the expanded view only for `AskUserQuestion`. Found on a real session that the projection bounds nested input so option lists arrive as placeholders (DATA-4 needed). Unit and browser specs pass; also merged Codex #165 (UI-5 reader density) after fixing one stale phone spec.

### Yash with Claude (Sonnet 5.5) — GIT-2 session ↔ commit links (partial)

- **When:** 20 October 2026. `git-session-links.ts` reads the recording search index per commit page (full hash or 7-char prefix in tool results); UI shows a turn chip, a peek line and a "Seen in turn N" button. Search hits now carry `operationId`; turn falls back to prompt count for harnesses without `turn.start`. Verified on a real Claude session and daemon/browser specs. Also stabilised the commit-row grid (empty refs/turn cells keep columns aligned). **Open:** time+path matching and the working-tree entry.

### Yash with Claude (Sonnet 5.5) — REVIEW-1 Changes (partial)

- **When:** 20 October 2026. `sinceSnapshot` gains `fileStats` (captured +/-, last-edit turn) and `gapGroups`; the Review dialog shows them; Modern gets a top-bar **Changes** button. Verified on a real Codex session and review specs. Also fixed two rail specs from #152 that still expected the old near/current tick lift (ticks are uniform now). REVIEW-1 stays open (test recognition needs DATA-1).

### Yash with Claude (Sonnet 5.5) — HOME-1 quiet rows (UI slice)

- **When:** 20 October 2026. Home drops the per-row "Available locally", cleans titles for display, and shows an "Active now" line for followed journals. New `session-title.test.ts`, `home-active.spec.ts`; all 18 Home specs pass. HOME-1 stays open for harness-reported stats (DATA-2).

### Yash with Claude (Sonnet 5.5) — LIVE-3 opt-in notifications

- **When:** 20 October 2026. `lib/notifications.ts` (pure transition rule, stored opt-in, permission asked only from the Settings switch), `NotifyWatcher` (fires only when the tab is hidden, from the existing now-state) and a Settings row. 3 unit tests, 2 permission journeys, settings/live specs pass (20).
- **Not done:** notifying for sessions that are not open, and a human check on a real desktop notification.

### Yash with Claude (Sonnet 5.5) — REVIEW-2 search result context

- **When:** 20 October 2026. `Store.search` joins each hit to its observation (turn, kind, tool, path/command, time) and returns capture order; the Search panel groups by turn with one context line per hit; the jumped-to operation keeps a marker. A dropped backslash in the query splitter (`/s+/`) was caught by the b4 history spec and fixed, with a multi-word regression test. Verified on a real Codex session (47 hits, 16 turn headers) and the search specs (15 passed).
- **Note:** two `classic-refinement` explorer specs already fail on `main` (found while checking Harsh's #149); not touched here.

### Yash with Claude (Sonnet 5.5) — prompt rail made quiet (TURN-3 follow-up)

- **When:** 20 October 2026, builder feedback on the merged TURN-3. Rail ticks are now one length at rest, with no edit dot and no failure mark; the captured turn ledger (operations, failures, edits) appears only in the hover/focus card. The size encoding, `prompt-rail-mark.ts` and its unit test are removed. Verified with the rail spec (uniform tick widths, no mark nodes, ledger on hover) and a screenshot.
- **Decision:** the rail does not encode outcomes; a Tests view (every run, every failing case) was drafted and deferred to P3 as TESTS-1 until it is clear anyone would open it.

### Yash with Claude (Sonnet 5.5) — GIT-3 commit rows and ref filter

- **When:** 20 October 2026. Reviewed, locally verified and squash-merged Codex #144–#148 first (UI-5, UI-2, UI-10, TURN-3, TURN-4); one stale assertion in `fresh-workspace.spec.ts` (the Git review file toggle is now "Files") was fixed in #144.
- **GIT-3:** `CommitRows` beneath the Git graph (graph-header toggle, remembered as `git/rows`): hash · message · refs · author · age, newest first, hover and selection mirror both ways, a row pick reveals an off-screen commit. The reference list starts as refs named by loaded commits (plus checked-out/picked) with "In view / All N"; search and All restore the paged server list. Fixed the reference column clipping its bottom controls.
- **Verified:** typecheck/build, unit tests, the Git specs, and the real repo (50 rows; 18 of 86 refs in view). **Not done:** keyboard arrows between rows beyond Tab; row virtualization beyond `content-visibility` (6 pages × 50 rows).

### Yash with Codex — UI-10 complete, ready for Claude review

- **When:** 20 October 2026. PR **#169**, `codex/ui-10-collections`. Finishes the remaining count-dependent surfaces after #146/#160. Imports share clamped collection paging; long Git file lists gain264px desktop/144px phone budgets with viewport caps, short lists stay natural. Prompt-rail keyboard focus waits for the React commit instead of a guessed frame. Specialized tree/rail/hover/ledger owners retained; 3/300 matrix covers their complete supported navigation. [Evidence and policy](review/ui-10-collection-completion.md).
- **Verified:** 672 local units and14 browser journeys after integration; both types/build. Copied real Drishya/Skeletongraph Codex and Skeletongraph Claude rails cover41/48/287 prompts; real import/current-Git reading checked at desktop/phone widths. Missing old journal metadata logged an ENOENT separately; NATIVE-1 now records that recheck. No native request, source writes or hosted CI.
- **Merge signal:** PR #169 ready for Claude review/squash; whole UI-10 ticked, claim removed only here. Main #167/#168 integrated without source conflicts; other claims preserved. Prior completed FILES-2 handoff is retained in its merged review.

### Yash with Codex — UI-5 complete, ready for Claude review

- **When:** 20 October 2026. PR **#165**, `codex/ui-5-file-evidence-chrome`. Finishes the whole remaining UI-5 scope, retaining the Git/patch/source work from #144. Captured-file chrome is consolidated; action trail is tucked away by default on new phone readers and remains in Actions; Workspace imports move into File actions and phone New file into layout Actions. Legacy content, consent, draft/selection/state owners and visualization motion retained.
- **Verified:** 648 local unit tests before integrating #166; both typechecks/build; focused reader/Git/Workspace journeys including actual copied Drishya Codex and Skeletongraph Claude mouse/touch. See [completion evidence](review/ui-5-reader-workspace-completion.md). No native request submitted, hosted CI or project/harness mutation. Physical/human acceptance stays REL-3.
- **Merge signal:** ready for cross-builder review; final build, both typechecks and six affected browser journeys pass after integration; squash PR #165. Claim removed in the finishing PR only. Integrated #166 cleanly; DATA claims retained. Next work must be claimed separately from TASKS.

### Yash with Codex — UI-2 Toolbox typography ready

- **When:** 20 October 2026. Branch `codex/ui-2-toolbox-type`, PR #159, **READY FOR CLAUDE REVIEW / MERGE**. Claim removed in this PR; parent UI-2 remains open for other surfaces.
- **Changed:** Toolbox counts/MCP labels/agent states reach11px; disclosure/filter controls12px. Modern-only scoped CSS; no inventory, geometry or motion rewrite.
- **Verified:** both3/300-tool browser journeys now include metadata/control floors, Agents, Clear focus, seven palettes and1440/390/320px layouts. Large lists retain keyboard End and visible disclosure. Actual redacted Drishya Codex before/after and Skeletongraph Claude checked; no measured Toolbox text below11px. UI TS/build and palette contrast guard pass; local frames inspected.
- **Limits:** human/physical and other UI-2 surfaces remain open. No capture/backend/schema/native/journal writes or hosted CI. [Evidence](review/ui-2-toolbox-typography.md). FILES-2 prose/typed History paths are independently ready in #157.

### Yash with Codex — UI-10 agent inventory ready

- **When:** 20 October 2026. Branch `codex/ui-10-agent-inventory`, PR #160, **READY FOR CLAUDE REVIEW / MERGE**. Claim removed in this PR; parent UI-10 remains open for other collections.
- **Changed:** recorded Agents reuse ToolCollection: short lists retain natural height, more than six agents use216px/36dvh local scrolling. Existing explicit family nesting and filtering remain; no new panel/control or lineage inference.
- **Verified:** synthetic normalized3/300-agent fixtures with long names, nested disclosure, exact counts, filter/clear, keyboard End and1440/390/320/short320px bounds. Existing3/300 MCP/runtime checks pass alongside them (four journeys). Real redacted Drishya Codex seven-agent list now216px; last row and outer summary stay reachable. UI TS/build pass; local frame inspected.
- **Limits:** no agent-row virtualization/native-lineage certification. Native/data, physical/human and other UI-10 surfaces remain open. [Evidence](review/ui-10-agent-inventory.md). No backend/schema/dependency/native/journal writes or hosted CI.
- **Other independent handoffs:** FILES-2 prose/card/search navigation ready in #157; Toolbox typography ready in #159. UI-2 Settings/Git typography merged as #155 and LIVE-2b as #153. Preserve the other builders' claims and inspect docs conflicts when merging these separate task branches.

### Yash with Codex — UI-2 Settings/Git typography ready

- **When:** 20 October 2026. Branch `codex/ui-2-settings-type`, PR #155, **READY FOR CLAUDE REVIEW / MERGE**. Settings and Git graph typography slice only; parent UI-2 stays open. Claim removed in this PR; Claude owns squash-merge.
- **Changed:** Settings metadata/captions at11px, controls/shortcut rows at12px, visible phone palette descriptions and wrapping shortcut/parent rows. Git references, badges, hover/caption metadata reach11px and controls12px. Modern-only; timeline geometry/motion and Legacy visualization retained.
- **Verified:** four new browser journeys across seven palettes and desktop/short/390/320px layouts; two existing root/merge and continuous Git journeys; both TS/build and palette contrast guard. Actual redacted Drishya Codex Settings/current Git with commit rows and Skeletongraph Claude phone Settings checked; local screenshots inspected. Settings tests measure actual composited contrast, not tokens alone.
- **Limits:** other UI-2 surfaces remain open; no whole-product/physical/human ten-minute claim. No capture/schema/native writes, native prompt or hosted CI. See [verification](review/ui-2-settings-git-typography.md). LIVE-2b remains independently ready in #153.

- **When:**20 October 2026. Branch `codex/live-2b-composer-access`, PR #153, **READY FOR CLAUDE REVIEW / MERGE**. Claim removed and TASKS checked; Claude owns squash-merge.
- **Delivered:** Ctrl/Cmd+Shift+Enter expands/focuses the visible prompt without sending or changing its draft. ARIA and Settings keyboard help expose it. Fields/editors, visible dialogs/menus, IME/repeat and hidden Workspace/map/replay surfaces retain ownership; replay clock continues.
- **Clearance:** the existing measured composer gap/end-padding already works; retained it and proved final expanded-card bottom clearance with a long draft at1440/900/390/320px. No padding or motion rewrite.
- **Verified:** three new browser journeys, existing compact-composer consent/scroll regression, both typechecks/build and actual redacted Drishya Codex before/after focus check. No native submission/hosted CI. Physical keyboard/IME and human ten-minute acceptance remain REL-3. Review: `docs/review/live-2b-composer-access.md`.
### Yash with Codex — TURN-2 keyboard reading ready

- **When:** 20 October 2026, `codex/turn-2-keyboard-reading`, PR #141. **merged by Claude after review** — final cursor checks passed. Main through `4d22126` integrated: resolved adjacent read-only worker/API/test additions, retaining both FILES-1 and TURN-2; no changes to FolderExplorer, schema/adapters/projection, Git or Usage.
- **Delivered:** j/k operations, n/p edits, f failures, t/T turns, g/G absolute edges, e expansion, o existing peek, y existing copy/selection/preview, c/C fold-other-finished/unfold-all, ? shared guide in Settings → Keyboard and on Home. Whole-session worker cursors retain recorded identity and existing filters; keyboard focus stays on the real DOM card and never opens the inspector. Input/editor/menu/reader ownership, replay and capture remain independent. No keyboard motion added.
- **Validation:** full 624/624 unit tests (114 files), both typechecks and build; final focused cursor/API check after stable-turn-key refinement passed 45/45. Browser verification: four new journeys (45-turn synthetic, Home320/CodeMirror, running-replay guide, actual Drishya/Skeletongraph Codex+Claude), existing replay-hover/reading check, three existing turn-fold checks and two FILES-1 checks. One stale Settings selector was corrected; final journeys pass. Known pre-existing missing Skeletongraph native-journal ENOENT remains outside this scope; no new page errors.
- **Dependency tracking:** pushed `TASKS.md` §0 “Dependency gates and retest triggers” on main before implementation. Every gate names required data/decision/environment plus an explicit retest; merging the prerequisite alone never ticks the dependent item. FILES-1 D, missing reasoning, typed images/questions/plans, stats/limits, model validation and physical/native acceptance are recorded there. No second active queue.
- **Next:** Claude verifies/squash-merges #141. Continue an unclaimed item after checking the dependency table and current claims; DATA-1/DATA-2 remain Harsh's. Local checks only.

### Yash with Claude (Opus 5.5) — GIT-1 Sacred Timeline integrated; UI-1 drafted; READ-9 reviewed

- **When:** 20 October 2026. GIT-1 prototype #135 and integration #138; UI-1 draft #137; Codex READ-9 #136 reviewed, run locally (connected-workspace 18/18) and merged after resolving a claim-table conflict.
- **GIT-1:** the Git graph draws WebGL2 filament light (`lib/git-light.ts`, `lib/light-renderer.ts`) under unchanged DOM commits; SVG ribbon only without WebGL2. Builder feedback applied: brighter core, branches clear of the river at every zoom, lightning opens forward only so time reads left → right. Still open: 60 fps measurement at 500 commits, fork/merge acceptance matrix, optional flow ([TASKS](TASKS.md) GIT-1).
- **UI-1:** session title · repo · harness · model and a watch dot share the brand's outline (no capsule); phone brand mark restored. Builder approved and #137 merged; rest of UI-1 stays open, claim released. Branch is not shown: the projection drops `session-meta.branch`.
- **Working with Codex in parallel:** Codex claims on `main`, works in its own worktree (which holds the local `main` branch, so this checkout pushes docs with `git push origin HEAD:main` from a detached `origin/main`), and marks its PR ready plus a STATUS note as the merge signal; Claude verifies and squash-merges.

### Yash with Codex - READ-9 (PR136, merged)

- **Signal for Claude:** PR136 was marked ready for review; merged by Claude on 20 October after review.
- **Claim:** `docs: claim READ-9` b0ed3ec was pushed to main before product edits. Isolated managed worktree at `C:/Users/ASUS/.codex/worktrees/review-search-context/drishya`; root checkout and dirty package/logo files untouched. Current GIT-1/UI-1 coordination claims were merged into this branch without conflicts; no overlapping code files changed. Claim removal in this PR takes effect when Claude merges it.
- **Delivered:** compact source search and inline matches; existing line/wrap/file controls and provenance in header Reading options on narrow views. Escape owns only that disclosure. Mouse and touch input/menu sizing checked; desktop/Legacy retain their existing controls. [Evidence](review/read-9-phone-source.md).
- **Validation:** baseline390px allocation0.463 reproduced; real imported Drishya Codex/Skeletongraph Codex/Claude files now0.690 mouse /0.635 emulated touch at390/320px, no horizontal overflow/page errors. Both TS/build,10focused units,18connected-workspace journeys and two actual-session matrix journeys pass. No native turn/capture/schema/API/dependency or hosted CI. Physical phone/keyboard acceptance remains REL-3.

### Yash with Claude (Opus 5.5) — TURN-1b fold finished turns

- **When:** 20 October 2026, `yash/turn-1b-collapse`.
- **Delivered:** in Modern, a finished turn folds to its prompt and ledger by clicking the ledger line (chevron). Scene passages carry `inTurn`; `apps/ui/src/lib/turn-fold.ts` decides header/hidden slots and heights; `History.tsx` keeps the reading anchor, holds the document extent when a fold near the end would clamp the scroll, unfolds for selection/expansion/rail jumps, and never folds the active newest turn or replay. Folds persist as `history/folded-turns` (working-locations allowlist). Details in [TASKS](TASKS.md) TURN-1b.
- **Validation:** unit 605/605; scene goldens differ only by `inTurn`; `turn-fold.spec.ts` 3/3; real 38-turn Codex session folded/unfolded with the header at 0 px movement, no page errors.
- **Next:** GIT-1 (Sacred Timeline prototype; needs builder sign-off on stills), then UI-1.

### Yash with Claude (Sonnet 5.5) — UI-9 hover cards fit their content

- **When:** 20 October 2026, `yash/ui-9-hover-fit`.
- **Delivered:** hovered cards are allocated their natural height (up to the viewport cap), not padded: `lib/hover-reading.ts` laid the card out, then added the hidden depth of the clamped command box and floored the height at 112% of the resting card. The result clamp now follows `--hover-room` (stage.css) instead of the card height. New `tests/browser/hover-fit.spec.ts` measures the empty band under the last visible text of every hovered card (86 and 167 px before, at most 42 px after); `fresh-workspace.spec.ts:477` asserts the new relation.
- **Validation:** hover-fit 6/6 (3 repeats), material-motion, p1-pacing, product-workspace, tool-exchange-real-review 59 passed, typecheck clean.
- **Next:** UI-10 (count-dependent surfaces need a small and a large state), from Yash's second note.

### Yash with Claude (Sonnet 5.5) — TEST-1 browser specs

- **When:** 20 October 2026, `yash/test-1-browser-specs`. Test code only.
- **Delivered:** full browser suite measured first (212 pass, 21 fail, 18 opt-in skips). Fixed all 21: shared `openComposer(page)` for specs that assume an expanded composer (LIVE-2's pill); stale selectors updated to the current design (no `h1` in the modern header, session id in the identity tooltip, Git review resizes from window edges, right-hand navigation group moves at ≤ 1100 px and the history may start below it); `session-segments` and `prompt-timeline` outside-click and pill order; the import list remembers being open. The product-workspace flakes (:65, :158, :772) did not recur.
- **Validation:** fresh-workspace + connected-workspace + prompt-timeline + session-segments: 99 passed together. Run the full suite again before relying on this.
- **Found, not fixed:** phone-width source reader keeps 0.46 of the window for source (READ-9; its 390/320 px assertions are off until then); hover-reading cards are padded to a maximum height instead of fitting their content, and count-dependent surfaces need a small/large rule (UI-9, from Yash's screenshots).
- **Next:** UI-9, then LIVE-3 or EXPLAIN-1; DATA-1/DATA-2 are Harsh's and wait on Yash ticking D1, D2, D4, D5, D6, D8 in review 125 §9.

### Harsh with Claude (Opus 5.5) — BUG-7 open/refresh race; PR110 closed

- **When:** 19 October 2026, `harsh/bug-7-open-refresh-race`.
- **Delivered:** a live refresh starting while `openRecording` was still fetching took the newest projection token and discarded the open, so a returning session lost its restored reader. `reloadProjection` now waits for an in-flight open of the same recording (no schema or API change). PR110 closed with a disposition comment; its two remaining ideas are IDEA-5.
- **Validation:** both TS; 575 units/106 files including the new race test (fails without the fix); "session detours" browser journey 10/10 at 150 ms and 10/10 with coalescing forced to 25 ms; `p1-pacing` and `connected-workspace` pass except the two TEST-1 journeys that also fail on main.
- **Next:** review alongside PR128, which restores 150 ms coalescing and notes this race in STATUS; whichever lands second should drop that note.

### Harsh with Codex, then Claude (Opus 5.5) — Investigation, saved evidence and draft recovery finishing

- **When:** 18–19 October 2026, `codex/investigation-finishing` (not yet pushed).
- **Delivered:** items 2–6 of the remaining-work request ([107](review/107-investigation-finishing.md)): joined investigation with exact origin and return, Saved moments (50 references) and paged legacy notes, selected-evidence packets, explicit encrypted draft recovery in Workspace Actions, shared focus/Escape/switch polish; default journal poll 750→500 ms. Reconciled with main up to `b66f160` (PR111–125, claims). Claude concluded the merges, fixed three branch regressions (Workspace layout keyboard order; draft-bar reload-loss wording; Codex’s 25 ms browser refresh coalescing, reverted to 150 ms because it superseded `openRecording` and lost the reader restored after a session switch) and ran the final checks.
- **Validation:** both TS; 562 units/103 files. Full browser on the pre-PR125 merge: 224 pass / 18 opt-in skip / 9 fail, all failing identically on clean main or flaky. After PR125, every `fresh-workspace` failure except the session-switch regression (now fixed, 3/3) also fails on clean `b66f160`; all are listed under TEST-1. Ten-minute soak 604 s / 88 rounds / 772 peak nodes; overhead observer −0.4%, observer+browser +2.4%, 0 lost (500 ms poll). Signed-in native checks remain builder-owned; no hosted CI.
- **Next:** Yash reviews the PR; TEST-1 (now including the PR124/PR125 journeys); decide PR110 (conflicting, partly integrated per [111](review/111-adaptive-content-and-pr110.md)); the open/refresh race it noted is fixed by BUG-7 (merged right after).

### Yash with Claude (Opus 5.5) — Developer review, harness data audit, restructured TASKS

- **When:** 19 October 2026, on `main` (docs only).
- **Delivered:**
  - an independent developer review of the running product ([122](review/122-developer-product-review.md), with builder corrections at the top);
  - an aggregate-only audit of what Claude Code and Codex journals record versus what the adapters use ([123](review/123-harness-data-audit.md)): reasoning is mostly *not* recorded (Claude 223/225 thinking blocks empty; Codex reasoning encrypted, about 3% summaries), while much typed data is ignored;
  - the Sacred Timeline Git graph spec ([124](review/124-sacred-timeline-git-graph.md));
  - [TASKS](TASKS.md) restructured into a tagged priority list (P0–P3) plus per-category detail with acceptance lines, the old completed items archived verbatim;
  - the hackathon fit refreshed ([HACKATHON](HACKATHON.md));
  - the north star and minimalism rule added to AGENTS;
  - Emil Kowalski's web skills installed for Claude Code (`~/.claude/skills`) and `animation-performance` added for Codex.
- **Validation:** product exercised at 1440×900 (headless Edge) and in the app pane on a 1,100-operation Codex session, a Claude Code session, this live session and the demo. No code changed.
- **Then (same day, Claude Sonnet 5.5, branch `yash/p0-bugs`):** BUG-1 (wheel chains from cards to history), BUG-2 (Git drawer clears the navigation; Escape closes the newest reader), BUG-3 (links inside bold/italic Markdown), BUG-4 (no top-control overlap from 601–1100 px). One commit each. 546 unit tests, both typechecks and 9 browser specs (Git review, manual scroll, Markdown references, interface craft) pass. Bottom-corner pills at narrow widths remain (UI-1).
- **LIVE-2 (branch `yash/live-2-composer`):** the idle composer defaults to its pill; auto/open/closed choice persisted (new `composer/choice` key in `working-locations.ts`, both allowlists). Four browser specs were found failing or flaky on main before this work (TEST-1).
- **READ-1 + READ-2 (branch `yash/read-cards`, Sonnet 5.5):** wide no-wrap code diff cards with `+N −M`, and quiet provenance with one ⓘ popover per card. Pure helpers in `lib/card-evidence.ts` (4 tests). Browser: 72 of 74 card/history specs pass; the failures are the known `product-workspace:158` and a rare prompt-rail flake (TEST-1).
- **TURN-1 (branch `yash/turn-1-chapters`, Sonnet 5.5):** each prompt is a chapter with a three-line clamp and, once the turn is over, a ledger line (read / searched / edited files +/− / commands / tests / failed / duration), from a new `GET /v1/recordings/:id/turns` over the whole recording (paged sessions included) and the pure `scene/turns.ts`; Modern only, so the retained UIs are unchanged. Collapse is split out as TURN-1b (virtual-list work, Opus-sized). Also: the priority tables now carry a Done column kept in sync by `node scripts/sync-tasks.ts`; the hackathon was removed from TASKS/CONTINUITY (decision logged); Harsh's PR #128 was reviewed and merged. Found while verifying: my LIVE-2 left several specs assuming an expanded composer; on this branch the same three spec files give the same results as main (37 pass, the 2 known TEST-1 failures).
- **DATA-10 (Sonnet 5.5, docs only):** [review 125](review/125-event-schema-proposal.md), the batched additive schema proposal (five slices, evidence, privacy, order). Measured: typed Codex items cannot be matched to calls by id, 85% sit inside the `exec` window. **Needs both builders to tick D1–D10 before DATA-1/DATA-2 start.** Also corrected 123: no real TaskCreate/ExitPlanMode uses exist locally.
- **LIVE-1 (branch `yash/live-1-now`, Sonnet 5.5):** the Now line in the composer pill and header, the tab title and favicon state, backed by `GET /v1/recordings/:id/now` (facts from the tail; no schema change). 21 new tests; verified on this live session. Two more browser specs found failing since before PR #124 (`live-sync:8`, `prompt-timeline:22`), added to TEST-1.
- **Next:** see `node scripts/claims.ts` (the hackathon items were dropped from the list on 19 Oct)., EXPLAIN-4 (real key), DATA-10 → DATA-1/2, LIVE-1, TURN-1.

### Yash with Codex - Compact right-docked Explorer preview

- **When:**18 October2026, `codex/compact-file-preview`.
- **Delivered:**Narrower/taller28vw preview default bounded360–720px, preserving navigation/composer/time-rail clearances and custom geometry. Desktop fine-pointer passage content is90% while preview is open, normal size on close/phone. Material motion translates screen/local pixels consistently under compact scale. Removed File reader move icon; title/tab bar keeps direct drag and keyboard arrows/Home; all four edge controls/reset remain. [121](review/121-compact-file-preview.md).
- **Validation:**Both TS/build;543units/99files; five focused browser journeys including defaults, title keyboard/drag, all edges, restored bounds and phone, plus actual Drishya/Skeletongraph Codex/Claude Blueprint/current-file/scroll stability journey. Private frames inspected. No capture/native/project write or hosted CI; preference/platform acceptance and broader TASKS remain open.

### Yash with Codex - Shared captured-result view selection

- **When:**18 October2026, `codex/captured-result-views`.
- **Delivered:**One bounded supplied-text selector and result-control owner for JSON, delimited and resource modes. Native shell JSON gains data inspection; folded terminal/error excerpts inspect the whole supplied preview, with no duplicate candidates or excerpt-derived false grids. Open readers snapshot selected text/fields; stable owners survive raw/decoded and folded/unfolded body changes. [120](review/120-shared-result-views.md).
- **Validation:**Both TS/build;542units/98files; ten structured/resource browser journeys including plain shell/wrapped shell/MCP exact-original inspection and focus; actual three-session long-history/multi-file regressions pass. Final body-owner extraction rechecked with UI TS/build and all ten focused journeys. No capture/schema/API/dependency/body persistence/native write/hosted CI. Media/artifact transport, full selector acceptance and broad UI tasks remain open.

### Yash with Codex - Captured resource references and documents

- **When:**18 October2026, `codex/resource-previews`.
- **Delivered:**Explicit resource inspection from sealed native/MCP/result fields, retained reference/body provenance, clean HTTP(S) links opened only by click, captured Markdown/source and JSON/CSV handoffs. Limits256KiB/64references/1024visits/eight nested levels; no arbitrary code/prose scraping. Nested dialog cancel now closes only its owner and returns focus. [119](review/119-captured-resource-reading.md).
- **Validation:**Both TS/build;540units/97files; seven structured/resource browser journeys plus final native/MCP rerun, desktop/390/320px, exact copying, no automatic remote load, link opening and nested Escape/close/focus. Three actual Drishya/Skeletongraph Codex/Claude long-history/multi-file Workspace regressions pass. No native/project writes, source-body persistence, schema/dependency/telemetry or hosted CI. Binary media/general selector and broader TASKS remain unfinished.

### Yash with Codex — Explorer preview safe layout

- **When:**18 October2026, `codex/peek-safe-layout`.
- **Delivered:**Restored tall centred preview geometry is bounded by its adjacent reading lane, navigation, composer and independent time-rail clearance. Shared move/four-edge resize constraints handle viewport/composer changes. Workspace hides the right navigation and rises to the Files row instead of reserving the Git stack. [118](review/118-explorer-preview-bounds.md).
- **Validation:**Both TS/build;535units/96files. Four focused browser journeys, actual Markdown/Workspace transfer and actual three-session Drishya/Skeletongraph Codex/Claude tabs/phone reading, including old oversized geometry and long Blueprint. No project/native writes or hosted CI. Resource-reader WIP is preserved in the named stash; broad TASKS remain open.


### Yash with Codex — Bounded captured JSON reading

- **When:**18 October2026, `codex/structured-result-reader`.
- **Delivered:**Shared History/Inspector on-demand Tree/Table/Original reading, virtual rows and full supported field access, search, exact pointers/value/original copy, keyboard and phone bounds. Complete supplied preview only; no new artifact fetch, current-file/media inference or native write. Graph remains deferred. [114](review/114-structured-result-reading.md).
- **Validation:**Both TS/build;517units/92files.1200-row/late-field/tree/search/original/320px journey, existing external preview journey and actual three-session Codex/Claude test-reading regression pass. Follow-up shared reader exit/actual-frame reversal, keyboard/reduced-motion/focus/settings and folder-state browser checks pass. Broader motion remains unchecked in TASKS; native/physical/assistive-tech acceptance remains open.


### Yash with Codex — Compact test evidence and the actual horizontal prompt row

- **When:**18 October2026, `codex/compact-outcome-reading`; graph presentation deferred by builder.
- **Delivered:**[113](review/113-compact-test-reading.md): fixed the remaining column layout so symbol and basename share one horizontal line at320/390/desktop with ellipsis. Shared native/MCP/Inspector result bars expose captured cases by hover/focus/keyboard/selection, using a focused portal reader and original raw-output handoff. Grouped counts, partial rows and unsupported formats remain explicit. Bounded stored head/tail reading recovers clipped wrappers without joining disjoint slices. Real pytest warning summaries are recognized without counting warnings as tests. Fixed the discovered count1 history centering error; no graph/source/native-control/capture-schema change.
- **Validation:**Both TS/build;511units/91files and focused parser/history checks. Native/MCP/mixed/long-artifact/keyboard/raw browser journeys and actual three-session Codex/Claude desktop/phone investigation, plus both-harness horizontal identity geometry. Portal-close regression now prevents the underlying action from opening Inspector. Review113 covers limits. No hosted CI or physical/native-account release certification.

### Yash with Codex — Luminous reference material and compact prompt identity

- **When:**18 October2026, `codex/luminous-git-ribbon`; spatial correctionPR113 previously merged as1ad074c.
- **Delivered:**Replaced rejected stroked wires with contiguous filled spectral layers and a broad continuous sweep. Maintained near32px envelope,16px branch cap, actual parent/rim connections and explicit orbit. Hover no longer fades unrelated ribbon segments; commit dots are quieter. Subpixel overlap covers primary mesh antialias joints. Modern composer identity restores the original symbol and shows the workspace basename only, removing Codex/Claude from that row while keeping necessary native connection details.
- **Validation:**Both TS/build and10focused geometry/window/topology cases pass. Graph root/merge/orbit/phone and continuous-history/composer assertions pass; actual three-session Codex/Claude desktop/phone journey checked. Final mesh-coverage/material frames inspected. See review112 latest correction and Before/After/Why table. No hosted CI, native turn, artwork dependency or capture/API change; physical/preference acceptance remains open.

### Yash with Codex — Spatial bundle and rim forks

- **When:**18 October2026, `codex/spatial-git-ribbons`; precedingPR112 merged ascb2a674.
- **Delivered:**Review112 spatial correction: sampled XYZ fiber bundles, depth-sorted branch pieces, actual forks peeling from the outer rim and explicit viewing-axis orbit (drag/keyboard), with ordinary pan retained. The latest builder correction rejects DNA/edge-on collapse: nearly uniform32px main diameter,2%variation, branch cap16px and nonzero neck. Primary reference research uses Bo Zonneveld’s Loki concept collection; no artwork download/dependency. PR110 is still open/conflicted; useful distinct parts were already integrated and credited throughPR112, duplicates not merged.
- **Validation:**Both TypeScript checks/build;10focused geometry/window/topology cases (including all-angle diameter/rim/depth/budget guards), two synthetic graph/continuous-history journeys and actual three-session Codex/Claude desktop/phone journey pass. Desktop/phone/orbit frames inspected. No hosted CI, native turn or new capture/Git-write behavior. Review112 records bounds and the explicit limit: orthographic spatial rendering, not a full freely orbitable WebGL scene.

### Yash with Codex — Continuous spectral Git threads

- **When:**18 October2026, `codex/branch-threads-integration`; selective PR110 work is commit7198cb0.
- **Delivered:**[112](review/112-git-threads-integration.md): graph-first local Git timeline with actual fork/merge paths, continuous edge loading/anchor preservation, six retained metadata slices/300nodes, explicit bounds, hover/focus details, exact file/patch reading and direct right-side entry. The attached reference informs32px primary cyan/blue/white/violet/pink fiber material, four times the earlier8px band; branches use the same texture, weighted by loaded segment commits and capped at16px. Extra texture strokes are bounded separately and reduced in low-resource mode. Composer identity trimmed. No event-schema change, writes or network Git fetch.
- **Validation:**Both TS checks/build and496units/89files pass. Focused continuous/root/merge/phone journeys pass; actual three-session Codex/Claude desktop/phone graph coverage and frame inspection. Seven prior focused comparison/map/status/graph journeys pass. No hosted CI or native turn; physical/human acceptance remains open. TASKS holds compact test bars/media/native/UI work separately unfinished.

| Before | After | Why |
| --- | --- | --- |
| Linear rail and commit-range pages | Continuously scrollable graph with real parent paths | Make fork/merge structure navigable |
| Thin warm8px line |32px fine spectral fiber ribbon, branch cap16px | Match the supplied attached material and requested weight |
| New metadata resets fit | Shared-anchor preservation | Keep investigation stable while loading history |
| Long composer identity sentence | Harness/workspace/status, details on demand | Reclaim input space |

### Yash with Codex — Selective review integration and neutral result marks

- **When:**18 October2026, `codex/branch-threads-integration`; selected source ideas/fixes from Harsh PR110 at d071ff3.
- **Integrated:**Captured source vs separately approved current disk using current readers/version owners, exact line positions, complete bounded material, derived provenance labels and stale source/request guards. Missing positions/partial/oversized material fails explicitly. Narrow Files exits map, refit after whole-map consent, current-index importer→dependency arrows capped at40; newer map labels/occlusion/palettes retained. Did not adopt duplicate ReviewTools/history index/source-version class/follow-up state.
- **Tool marks:**Unknown nested edit/creation is Change unverified with a neutral dash and explanation; other missing results remain neutral. Shared History now actually renders that mark rather than its hardcoded question mark. No inferred success or reducer/schema change.
- **Validation:**Both TS/build and493units/89files. Five focused Git/source/map browser cases and actual three-session Git journey pass; comparison phone and graph frames inspected. Final shared unknown-mark and map/graph style checks recorded with the graph increment. No native turn/hosted CI; user package/logo files excluded.

| Before | After | Why |
| --- | --- | --- |
| Captured source and current disk require separate reading | Explicit bounded comparison in the existing reader | Keep historical evidence and current state distinct and accessible |
| Files click can leave the map active | Explicit exit plus approved-map fit and regression | Restore the requested file tree |
| Question mark on a proposed edit | Neutral mark, accessible unverified-change explanation | Make missing nested results understandable without fabricating success |

### Yash with Codex — Adaptive visual-content audit and PR110 review

- **When:**18 October2026, after Git atlas PR111 merged as ea05492.
- **Investigated:**Actual redacted Codex/Claude histories and capture/privacy/artifact/readers. Content-first matrix in [audit111](review/111-adaptive-content-and-pr110.md) covers images/browser/data/documents/web/source/test/native/delegation/process/media, including MCP and wrapped calls. Native image bytes are currently omitted; no new image persistence, reader or schema claimed. TASKS records investigation complete and implementations/acceptance separately unchecked.
- **PR110:**Reviewed d071ff3 against current owners. Left open/unmerged: Commands/findings/prompts/source comparisons/follow-up overlap existing implementations; conflicting source-version exports would break callers if merged blindly. Captured-to-current range comparison and bounded import directions/map-return regression remain useful selective candidates in TASKS. No message/comment sent to Harsh.
- **Validation:**Read-only SQLite metadata/signature audit and code/diff review; no private content committed. Documentation links/unique checklist checked. Git implementation checks remain in the next block. Hosted CI not run.

### Yash with Codex — Local Git branch atlas

- **When:**18 October2026, `codex/local-git-atlas`.
- **Delivered:**Read-only local branches/tags/ref search, paged real commit-parent rail, complete bounded commit messages and redacted safe patches with root/merge-parent choice. Existing Git consent and current/captured-file destinations; adjustable surface and phone list/detail reading.16 rail lanes report omissions rather than invent edges. Shallow boundary parents come from real objects; unavailable parent comparison fails explicitly. No network fetch, project/config/journal writes or daemon dependency.
- **Verified:**Both TS/build;488 units/87 files, followed by7 backend cases after shallow correction and2 focused Git browser journeys. Actual Drishya/Skeletongraph Codex/Claude histories checked at desktop/phone; both frame types inspected. Process/response/paging limits are explicit; broad device/native release acceptance remains open. No hosted CI.

| Before | After | Why |
| --- | --- | --- |
| Only staged/working changes | On-demand branch atlas beside existing Git review | Investigate local history without a permanent panel |
| Historical patches could share working-tree labels | Commit scope with explicit parent choice | Preserve historical vs current meaning |
| Dense unbounded graph would overwhelm reading |50 commit DOM rows,16 parent lanes, continuation disclosure; phone list/detail | Bound work without inventing topology |


### Yash with Codex — Adjustable reading surfaces

- **When:**18 October2026, `codex/adjustable-readers`; command presentation107 merged as3f66683.
- **Delivered:**Modern Git/current/captured file readers gain bounded desktop movement and height sizing, retained numeric session geometry, keyboard movement/resizing, default docking and reset. Captured files also gain overall width control. Existing dock widths reset through double-click/Enter; no visible grip added. Workspace tabs reorder by drag or Alt+Shift+Arrow, split panes balance on double-click, and layout reset preserves files/drafts. Narrow screens ignore desktop window geometry. Non-adjustable dialogs do not consume layout-memory entries.

| Before | After | Why |
| --- | --- | --- |
| Readers have width-only adjustment | Bounded height/movement with reset and keyboard controls | Let developers allocate reading space |
| Desktop size can outlive a viewport change | Clamp live geometry; use normal narrow layouts | Keep controls reachable after resizing |
| Tabs remain in opening order | Retained reorder plus balanced/reset panes | Arrange a reading workflow without reopening files |

- **Validation:**Both typechecks/build and477units/85files pass. Focused desktop/phone move/height/reload/reset, Git width/content, Markdown/6000-line fallback and editor journeys pass; Workspace tab/pane/reset/native-preparation journey passes. Two actual Codex/Claude surface/document-transfer journeys pass; desktop Git frame inspected. Initial failures were test selectors assuming one header button and DOM text including SVG extension labels, corrected to exact targets/references. No native turn, draft/source persistence, dependency change or hosted CI.
- **Next:**Remaining navigation, session identity, Home/phone/UI/palette/motion and native/platform acceptance in TASKS.

### Yash with Codex — Complete command presentation and adjustable-window inventory

- **When:**18 October2026, `codex/command-readability`; current reading106 merged as6c5662c.
- **Delivered:**Static command decoding now validates the whole request, including supported output wrappers/reordered literal fields. Multi-call/trailing/dynamic/truncated requests stay complete source. Modern action headings prioritize a safely decoded command; exact raw request/copy remain available. Added the builder's adjustable-window requirement to TASKS, covering Workspace/workflow tabs/panes, Git, Files and reading windows with bounded layout recovery/reset/keyboard controls. Existing widths/split resizing remain; missing window controls are still unchecked.

| Before | After | Why |
| --- | --- | --- |
| Prefix decoding can hide later statements | Only a complete supported literal call decodes | Retain every captured command |
| Modern heading emphasizes orchestration syntax | Safely decoded command with unchanged tool identity | Make actual work easier to scan |
| Every decoded label says JSON | Format-neutral decoded argument label | Script wrappers are not JSON documents |

- **Validation:**Four parser tests, both typechecks/build and two browser journeys pass: long at-sign script highlighting/exact copy/raw access plus complete multi-statement copy. Core box dimensions/motion, capture classification and outcome status are unchanged. No native turn or hosted CI.
- **Next:**User-adjustable window implementation and remaining UI/native/platform acceptance remain in TASKS.

### Yash with Codex — Current reading consistency

- **When:**18 October2026, `codex/current-reading-polish`; findings105 merged asd9382e3.
- **Delivered:**Files Markdown now offers the same safe Document/Source presentation as Workspace, with independent scroll/query/mode recovery, exact raw copy and complete-source fallback above256KiB/5000lines. Desktop CodeMirror matches source12px/22px; its inner scroller no longer silently shortens line height. Inspector starts below measured navigation and yields to Workspace while retaining origin. Current readers wait for approved reading, offer consent after restart, and approval supersedes older polls. Recovery normalizes legacy simultaneous modal owners.

| Before | After | Why |
| --- | --- | --- |
| Files Markdown is only raw source | Document/Source with exact source access | Make the same file equally readable in both owners |
| Editor inner scroller uses shorter default leading | Explicit leading matches source reading | Avoid an unintended density/zoom jump |
| Restored Inspector covers Workspace controls | Measured clearance and one active reading owner | Keep navigation reachable without losing origin |
| Current reader fetch can race consent/restart | Wait for access; direct explicit reader approval | Recover without a generic permission error detour |

- **Validation:**Both TS/build and473units/84files pass; final focused editor/Markdown/recovery-consent journeys pass.6000-line complete fallback, fresh consent/no pre-approval document request, one modal owner, navigation clearance and retained Inspector tested. Actual Codex/Claude Document→Source→Workspace at desktop/phone pass; frames inspected. Earlier real probes exposed Inspector overlap and consent timing, now repaired; an initial heading assumption was corrected for real Markdown without an h1. No native turn, direct write, dependency/schema change or hosted CI.
- **Next:**Command scanning, session identity, remaining Home/phone/palette/motion/Uiverse and native/platform acceptance remain in TASKS.

### Yash with Codex — Complete finding membership

- **When:**18 October2026, `codex/findings-navigation`; reliability104 merged asa4bc497.
- **Delivered:**On-demand finding membership uses the full worker projection and exact same command/artifact identity as summaries.25thin rows, complete/filtered counts, bounded title/path/command-preview query, exact action navigation, refresh/error/empty states. Gaps expose captured detail and label only next captured activity. Condition filtering avoids burying unknown/missing/gap aggregates behind recent repeated-command groups. Back returns focus to the originating finding; no new main-canvas panel.

| Before | After | Why |
| --- | --- | --- |
| Aggregates expose only first/latest examples | Every exact member is paged and searchable | Investigate the actual affected set |
| Recent repetition groups can bury aggregate conditions | Explicit condition filter | Reach missing outcomes/material and gaps directly |
| A gap has no captured action to open | Missing interval remains explicit; next activity is labelled | Do not fabricate evidence at the gap |

- **Validation:**Both TS/build,472units/84files, focused member/API and existing Review/packet browser journeys pass. Actual271-unknown set reaches older actions at desktop/phone; frames inspected. Initial real probe selected a recording with zero unknown outcomes; corrected to the authorized271-member history. No native turn, direct writes, output-body transport, schema/dependency changes or hosted CI.
- **Next:**Command scanning, current Markdown/reader consistency, UI/palette/phone/navigation and native/platform acceptance stay in TASKS.

### Yash with Codex — Independent critics and reliability repairs

- **When:**18 October2026, `codex/review-reliability`; map103 merged as5938ef5.
- **Review:**Three independent first-hand critics used existing redacted Codex/Claude histories, Modern primary. Developer utility6/10, design polish6.3/10; companion7/10 versus native/IDE replacement2/10 from one critic. These are subjective agent judgments, not user research. They valued exact evidence search, current source, split reading and guarded handoff. They found a reproducible saved-file recovery crash, ambiguous outer-success marks, a false Test classification from quoted `mocha`, map overlap (repaired103), and investigation/navigation/mobile density gaps. Complete private reports/screenshots stay under.local; selected remaining work is in TASKS, not a new queue.

| Before | After | Why |
| --- | --- | --- |
| Restored metadata object is treated as loaded file evidence | Exact reference keys persist; evidence re-fetches or gives an unavailable state | Avoid crashes and persisted source bodies |
| Failed view stays failed when navigating elsewhere | Boundary resets on hash navigation | A bad reader must not trap healthy sessions |
| Missing exit is represented as0; outer success gets a tick | Missing exit remains null; wrapper receipt is neutral Tool returned | Separate transport completion from nested command success |
| Quoted search separators promote runner mentions to tests | Quote-aware splitting plus explicit direct Node runners | Preserve truthful verification headlines |

- **Validation:**Both TS/build,470units/84files and four focused browser journeys pass. Actual original recovery-state store across all three sessions opens without a boundary; the Claude failure is repaired. Actual false-Test command is now Shell; nested Git failure retains null exit and Commands renders Tool returned. No native turn/regex failure guessing, direct writes, source-body recovery persistence or hosted CI.
- **Next:**Findings membership, command scanning, quieter mobile navigation/current Markdown consistency, remaining all-pages/palette/motion and real native/platform gates remain in TASKS.

### Yash with Codex — Captured-change map investigation

- **When:**18 October2026, `codex/map-investigation`; Review102 merged as9107012.
- **Delivered:**Review change paths focus typed static-import neighborhoods, with distinct captured/current destinations and explicit reading consent. All/Observed/Changes scopes retain metadata-only preference and disclose absent index locations. Measured controls clear navigation; phone drawers clear controls/zoom. Workspace status resolves independently of native CLI failure. Root recovery now skips title-only Claude headers and companion roots; first sync also repairs older missing summary roots without a journal append.

| Before | After | Why |
| --- | --- | --- |
| Changes and map are separate investigations | Exact change-to-import-to-source route | Make the map useful without inferred causal links |
| Fixed map control offsets overlap navigation | Measured navigation clearance and bounded phone drawer | Keep complete labels and targets available |
| Title-only metadata can hide captured workspace | Main root-bearing metadata chosen independently | Restore current-file access without inventing a root |
| CLI failure discards reading status | Independent reading/controller resolution | Observation and approved reading do not require a working controller |

- **Validation:**Both TS/build and466units/83files pass. Initial seven browser regressions: six pass, one queued-wheel test flake; corrected the test to enqueue one upward burst, then both final affected journeys pass. Final map journey also passes after consent/overlap refinements. Actual Codex indexed/current-reading and Claude unavailable-index fallback pass; desktop/phone frames inspected. No native prompt, direct project write, dependency change or hosted CI.
- **Next:**Independent critics have found a saved-file-reference recovery crash and misleading nested-command outcomes. Address these before broader UI/theme acceptance; record selected findings in TASKS.

### Yash with Codex — Factual Review workflow

- **When:**18 October2026, `codex/review-workflow`; Commands101 merged as001d327.
- **Delivered:**Grouped Review tools menu and Ctrl+K destinations for factual findings, complete paged prompt overview and explicit packet preview/copy/Markdown. Findings use exact command/artifact identity and captured unknown/missing/gap conditions with first/latest action references. Recognized pure polling wrappers are excluded after seeing real-session noise. Prompt windows count started calls without attributing outcomes causally. Packet includes complete counts and bounded evidence samples plus open local questions, with provenance/current-work exclusions and another redaction pass. Main visualization gains no resident panel.

| Before | After | Why |
| --- | --- | --- |
| Repeated/unknown material must be found manually | Quiet exact-evidence findings with precise references | Support investigation without a safety/stuck score |
| Prompt rail has navigation but no factual overview | Whole-session20-row windows and exact prompt opening | Reach older work and understand recorded activity |
| Captured outcomes and reviewer questions have separate handoffs | One inspectable redacted Markdown packet with scope/counts | Share useful review context without mixing today's files into history |
| Optional review actions would create many buttons | One grouped tools disclosure and command navigation | Keep the core canvas calm |

- **Validation:**Both TS/build and464units/83files pass; final polling refinement passes its focused pure tests. Three final focused browser journeys pass, including all45prompt windows, exact older-prompt navigation, command/Review entry, packet redaction/copy/download and1440/390px bounds. Additional actual Review-tools journey covers existing Drishya Codex and Skeletongraph Claude histories at desktop/phone; frames inspected. API authentication/range bounds and worker whole-session coverage checked. No hosted CI, native turn, private captures or user package/artwork changes committed.
- **Next:**Useful changed/import map investigation, bookmarks/indicator audit, remaining all-pages/UI/theme/motion and real native/platform acceptance stay in TASKS.


### Yash with Codex — Whole-session captured commands

- **When:**18 October2026, `codex/captured-commands`; interface100 merged as97bc6fa.
- **Delivered:**On-demand Captured commands from Review work and Ctrl+K, with complete-session worker coverage, preview/tool search, captured outcome/exit/time, stable Newer/Older/Newest cursors and25-row pages. Exact ordinary command copy uses existing decoded/raw display. Long command previews never masquerade as full copy: explicit Full captured input opens the paged artifact reader; activity navigation loads the exact operation. No resident panel, runner or direct project writes. UI remains within desktop/phone bounds and existing evidence owners.

| Before | After | Why |
| --- | --- | --- |
| Commands are scattered across loaded tool boxes | Whole-session filtered command reader | Find older commands without loading every passage |
| New live rows shift offset-based pages | Sequence/ID keyset paging in both directions | Keep browsing stable, including tied sequences |
| Small-session full projections cannot resolve worker-derived long-input IDs | Valid operation-linked input IDs route to worker artifacts | Keep complete long captured inputs readable |
| Initial debounce can reset a newly selected page | Empty initial filter is treated as unchanged | Preserve deliberate pagination |

- **Validation:**Both typechecks/build and459units/81files pass. Three focused browser journeys pass: recorded Review paging, completed-turn review, and71-command whole flow with all pages/filter/copy/full7000-character input/exact activity/Review entry/390px bounds. Additional real-session command reader journey covers three existing Drishya/Skeletongraph Codex/Claude histories at1440/390px, whole-session counts and next-page access; frames inspected. Fixture output corrected to the supported Codex JSON exit-code format rather than inventing failure metadata. No hosted CI, new schema/dependency, private captures or user package/artwork changes committed.
- **Limits/next:**Preview search is explicitly labelled and does not scan unseen full-input blobs. Captured outcomes are evidence, not a safety judgement or coverage claim. TASKS retains quiet findings, prompt overview, factual packet, remaining UI/theme and real native/hardware acceptance.


### Yash with Codex — Modern navigation and utility polish

- **When:**18 October2026, `codex/interface-polish`; prior connected-workflow batch99 merged as e4c3a02.
- **Delivered:**Home keeps the selected workspace when filtering removes its final match, adds clear-search/Escape and clear-filters actions plus refresh progress, and supports Arrow/Page/Home/End navigation through every session while mounting only the visible window. Utilities have coherent grouped sections, consistent readable row targets and keyboard traversal of visible rows only. Retain outside dismissal/Escape and neutral focus/press feedback. Reader close targets improve without expanding compact Git chrome. A real large-repository check exposed a graph-group label intercepting file-search clicks; map controls now have an explicit layer above graph labels. Legacy presentation and core card choreography stay shared.

| Before | After | Why |
| --- | --- | --- |
| Empty selected workspace falls back to other workspaces | An honest empty result with direct clearing controls | Preserve the user's filter scope |
| Keyboard cannot reach unmounted sessions | Jump/arrow navigation mounts and focuses the bounded target window | Make long libraries usable without a mouse |
| Utility rows mix weights and nested disclosures | Grouped sections, consistent targets and visible-row navigation | Reduce search and avoid focusing hidden actions |
| Real graph labels cover file search | Map controls stack above map labels | Keep repository navigation clickable at any density |

- **Design:**Applied installed Emil/animate skills. Consulted [Uiverse](https://uiverse.io/) for control/hover/form composition; implementation is original and uses existing theme tokens, not copied effects or another library. Pointer feedback is brief and reversible; keyboard/reduced-motion paths stay immediate. This is a bounded cross-component pass, not completion of the all-pages Uiverse/theme checklist.
- **Validation:**Both typechecks/build pass. Broad connected/Modern regression run70passed/1failed; compact Git-header regression repaired and all four affected Home/Git/utility journeys pass together. Two actual surface/Home journeys pass across recorded material/current source/Review/usage/map and desktop/phone/short-window Home. The deterministic spatial-label/search-overlap regression also passes; frames inspected. No backend/API/schema/dependency/project-write change, hosted CI or native turn. User package-manager files/artwork excluded.
- **Next:**TASKS keeps full UI/theme/motion and actual native investigation acceptance open, alongside optional Commands/findings/review-packet work. Do not mark the whole product complete from this batch.


### Yash with Codex — Connected reading and quiet controls

- **When:**18 October2026, `codex/workflow-finishing`; grouped related work per the latest builder direction. Code editor98 merged as9a354c3.
- **Delivered:**Modern native scrollbar thumbs disappear after1200ms idle without changing gutters. Explorer/reader resize grips are invisible while cursor, drag, keyboard and forced-colors focus remain. Imported daemon histories start passive watching by default; Follow only controls camera movement, with focus/visibility freshness recovery. Both supported controller protocols surface exact pending native questions/options/free text, reply through an authenticated route and expire cancelled/stale requests. Retained source versions have explicit keep/compare/accept; native edit preparation blocks stale bases. Utilities retain original reading context and offer chronological captured review after a turn without claiming causality. No direct disk writes, new dependency or event-schema change.

| Before | After | Why |
| --- | --- | --- |
| Persistent scroll thumbs and decorative resize grip | Idle transparent thumbs, stable gutters and cursor-only resize edge | Reduce visual noise while preserving access |
| Camera Follow also starts journal watching | History starts observation; Follow moves only the viewport | Keep new content current during reading |
| Interactive native question fails as unsupported | Exact owned-turn question form and validated reply | Unblock genuine input without guessing a new prompt |
| Refresh replaces reading; draft base may be stale | Retained snapshot comparison and disk preflight | Preserve context and disclose conflicts before submission |
| New return actions expand the compact composer | Return/review actions inside existing workspace utilities | Keep the prompt compact and native options unobstructed |

- **Validation:**Both TypeScript checks/build,456unit tests/80files and69browser journeys pass. These include default watching for both journal formats with Follow off, local Claude native-protocol/HTTP question round trip, Codex/Claude exact question/cancellation guards, pending input at1440/390px, source-version conflict flow, scrollbar idle/stable geometry/invisible keyboard resize and compact Legacy/Modern composer regression checks. Four actual redacted session surface/history/workspace journeys also pass; phone/source frames inspected. Signed-in native accounts, physical/platform checks and whole-product/UI/palette acceptance remain open. No hosted CI, native account turn, private captures or user package/artwork changes committed.
- **Next:**TASKS is the single queue: complete actual native investigation acceptance, selected developer utilities and all-pages Uiverse/design/palette/motion review. Do not interpret bounded implementation checkmarks as full product completion.


### Yash with Codex — Workspace draft code editor

- **When:**18 October2026, `codex/workspace-code-editor`. Palettes97 merged as340dafe.
- **Delivered:**Lazy browser-only CodeMirror editor with language syntax, line numbers, inferred indentation, undo/redo, brackets, wrap and cursor/line-ending status. Active-pane focus and hidden comparison state remain. CRLF/mixed text is retained; over256KiB changes fail intact. Escape then Tab leaves the editor without closing Workspace. Exact existing volatile draft/download/native-request owners unchanged; no direct disk writes, new backend dependency or captured-text copy.

| Before | After | Why |
| --- | --- | --- |
| Plain textarea without a source gutter | One virtualized code editor with semantic syntax and line numbers | Make corrections easier to read and locate |
| Browser Tab leaves the draft | Indent/outdent with undo and explicit Escape/Tab exit | Support editing without a keyboard trap |
| Comparison depends on textarea selection fields | Same editor stays mounted and resumes its selection/scroll | Preserve the user's working position |
| Every viewer would otherwise load editor parsers | Editor/languages load only on explicit editing | Keep ordinary observation light |

- **Validation:**Both TS checks/build and447units/77files pass. Four focused browser journeys pass: two files/retained draft,1500-line comparison/selection/scroll, indentation/undo/CRLF/mixed/oversized rejection/Tab exit/narrow bounds, and complete3000-line paste/native-request attachment with disk unchanged. Three actual redacted session history/two-file/edit-entry journeys pass; frames inspected. Initial textarea-specific test assumptions were updated to real editor selection and paste semantics; Escape conflict fixed before final pass. No hosted CI/native account turn/private capture committed. User package-manager prefix/artwork remain excluded; only the new browser editor dependency entries are staged.
- **Next:**TASKS retains version refresh/compare, joined correction workflow, whole-product/palette and real native/hardware acceptance.


### Yash with Codex — Rebuilt Modern palette materials

- **When:**18 October2026, `codex/theme-materials`. Current reader96 merged as d37cb43.
- **Delivered:**Six new Modern color compositions: Deep Ocean, Porcelain, Orchid, Blueprint, Evergreen and Copper. Keep Jet Black's base colors and all saved palette IDs. Legacy retains its own choices. Explicit source/external/pass/fail/edited/graph colors, derived status washes, neutral raised chrome, coherent selection ink and matching swatches replace incomplete inherited theme combinations. No action sizing, choreography or capture/controller changes.

| Before | After | Why |
| --- | --- | --- |
| Derivative theme names with broadly tinted surfaces | Distinct dark materials and a warm off-white alternative | Establish a coherent visual hierarchy rather than recoloring every layer equally |
| Alternatives inherit unrelated sage/status colors | Complete semantic ink and derived washes per palette | Keep code, diffs, statuses and controls consistent |
| Preview cards mix old swatches with new palette values | Canvas, two surfaces and accent match the selected theme | Make choices predictable |

- **Validation:**Both typechecks/build, expanded contrast guard for text/syntax/source/external/status/focus on all four solid surfaces, Home/session palette journey and actual desktop/phone Settings/material survey pass. Actual command, prose and Settings frames inspected. These are bounded checks, not a claim every surface/human preference is accepted. No hosted CI, native turn or private capture committed; user package/artwork excluded.
- **Next:**TASKS remains the single queue. Editable-source ergonomics, retained-version comparison, joined native correction and whole-product/palette acceptance remain open.


### Yash with Codex — Current-source reading allocation

- **When:**18 October2026, `codex/current-reader-controls`; Review pager95 merged as b98186b.
- **Delivered:**Shared compact reading-history arrows in the action row; short visible Workspace/Go/Wrap with stable accessible names, explicit refresh/evidence icons and unchanged current/captured destinations. Hide empty current import context, reduce margins/footer chrome and override the inherited 48vh source cap in Modern. Keep real import connections and full find/line/wrap/copy behavior. TASKS checkbox updated; no new task list.

| Before | After | Why |
| --- | --- | --- |
| Separate history/action strips | Compact arrows and actions together | Return vertical space to source |
| Source capped at48vh inside a larger bounded reader | Source fills remaining flex space | Remove the unexplained unused lower area |
| Import summary has stacked margins and padding even when empty | Omit empty context; compact meaningful connections | Keep useful information with less repeated chrome |
| Repeated disk label and spacious footer | One On disk qualifier and compact line-count/copy footer | Keep provenance clear without repeating it |

- **Validation:**Both typechecks/build and447units/77files pass. Three focused reader journeys cover retained Legacy, Modern and import destinations; Modern source allocation reaches at least62% at1440/390/320px with active Find and Wrap, no horizontal dialog overflow. The pre-cap-fix Modern layout failed this guard. Keyboard evidence navigation and actual desktop/phone surface journey pass; settled frames inspected. No hosted CI/native turn/private content; package/artwork excluded. Physical/touch acceptance remains open; coarse-pointer controls have44px targets/16px inputs.
- **Next:**Use TASKS for editable-source ergonomics, retained-version comparison and joined native correction/check workflow. Whole UI/themes/native/human finishing remains open.

### Yash with Codex — Compact recorded review navigation

- **When:**18 October2026, `codex/review-navigation-density`.
- **Delivered:**Short Previous/Next arrows with stable accessible names, separate live page count and page-limit note; responsive bounded grid,44px coarse-pointer targets. Right outcome groups align at the top. Paging/data/evidence behavior unchanged; TASKS checkbox updated.

| Before | After | Why |
| --- | --- | --- |
| Long page labels and limits compete in one flex row | Three compact controls and separate limits caption | Preserve information without tall phone chrome |
| Outcome groups stretch to match a long file column | Top-aligned groups | Keep related facts together |

- **Validation:**Both typechecks/build pass. Existing70-check paging journey strengthened for320/390/1440px fails on the old layout and passes on the new; final-page counts/destination still verified. Actual desktop/phone surface journey passes; phone frame inspected. No hosted CI/native turn/private content; package/artwork excluded.
- **Next:**Continue TASKS current-source controls and editable-source ergonomics; broader UI/themes and native acceptance remain open.

### Yash with Codex — Clear Workspace edit entry and focus

- **When:**18 October2026, `codex/workspace-edit-entry`; checklist93 merged as ee286ef.
- **Delivered:**Leading neutral Edit file action with pencil/read icon and truthful local-draft/harness context. Focus the real editor on entering edit mode or returning from comparison, only in the active pane; do not reset selection or create duplicate text. Workspace introduction mentions editing. TASKS checkbox updated; full editor-grade syntax/indentation remains explicitly open.

| Before | After | Why |
| --- | --- | --- |
| Edit file trails secondary navigation with equal emphasis | Leading raised neutral action and mode icon | Make the existing workflow discoverable |
| Entering editing leaves focus on the old action | Focus the active editor without scrolling | Typing should act on the file the user chose |
| Comparison returns focus to its toolbar | Return to the same mounted editor | Preserve selection and continue editing immediately |
| Generic full accent outline | Neutral inset editor boundary | Show focus without a large colored box |

- **Validation:**Baseline focus assertion fails before the repair. Both typechecks/build and447units/77files pass. Three focused existing-file/comparison/New file journeys and all three actual Drishya/Skeletongraph histories/Workspace/edit-entry journeys pass; final two-case CSS rerun passes. Actual frame inspected; drafts discarded without submitting native work or writing project files. No hosted CI/private content; package/artwork excluded.
- **Next:**Use TASKS.md only for the current queue. UI/theme finishing, improved editable source presentation, current-source version comparison and real native edit/create acceptance remain open.

### Yash with Codex — One current product checklist

- **When:**18 October2026, `codex/single-product-checklist`; box restoration92 merged as8547fec.
- **Delivered:**TASKS.md consolidates implementation, unfinished UI/theme/component work, Workspace editing/native write boundary, selected features, deferred ideas and release checks with checkboxes. AGENTS/README link it;84/85/92 are historical evidence, not competing queues. CONTINUITY is a compact handoff pointing to it.
- **Validation:**Local Markdown link/checkbox inspection; no runtime changes or hosted CI. User package/artwork excluded.
- **Next:**Follow TASKS; improve existing Workspace edit discoverability and editor focus without implying direct disk saves.

### Yash with Codex — Restore the previous tool boxes

- **When:**18 October2026, `codex/restore-exchange-layout`.
- **Delivered:**Builder rejected104/PR88; restore the exact preceding request/result CSS and update retained length/hover expectations. Later independent prose/Follow repairs remain.
- **Validation:**Local UI build and12 synthetic length/type combinations plus actual captured command pass. No hosted CI; preserve user package/artwork.
- **Next:**One authoritative checked work list, then make existing Workspace editing easier to find; UI/themes remain partly complete.

### Yash with Codex — Complete original failed-case acceptance

- **When:**18 October2026, `codex/origin-tree-acceptance`; PR90 merged/pushed asd35cabe.
- **Delivered:**103 final result: explicitly open Files ancestors, settle font/camera geometry and place the synthetic planar point outside the final card. Compare node/path geometry in one frame; retain map occlusion and map-off reference assertions. No runtime change in this increment.
- **Validation:**Both origin journeys pass, then all four original full-suite failures pass together. UI rebuild passes; latest functional type/unit check447units/77files passes. Original full run174passed/6skipped/4failed remains recorded; targeted closure does not invent a second clean full run. No hosted CI/native turn/private content.
- **Next:**84 narrow Review pagination/current-source control density; source-version/joined workflow and92 selected secondary tools remain. Physical/native/assistive-tech/human release acceptance stays open. Preserve package/artwork.

### Yash with Codex — Follow measured composer clearance

- **When:**18 October2026, `codex/follow-composer-resize`; PR89 merged/pushed as5b59d0e.
- **Delivered:**[105](review/105-follow-composer-clearance.md): border-box history observation accounts for late composer padding and uses existing Follow while respecting detached reading/clicked destinations. No timing/wheel/native/capture change.
- **Validation:**Both typechecks/build and447units/77files pass; two initial plus three final focused journeys and all three actual long-history/Workspace journeys pass, including95 upward-wheel samples each. No hosted CI/native turn/private content.
- **Next:**Fix two old closed-tree origin-test assumptions and record103 final acceptance.84/92 retain broader feature/polish/release work.

### Yash with Codex — Actual-surface acceptance and prose overflow

- **When:**18 October2026, `codex/interface-acceptance-repairs`; PR88 merged/pushed as497b1b3.
- **Delivered:**[103](review/103-interface-acceptance-sweep.md): bounded prose veil horizontal extent and repeatable opt-in actual-session review/evidence/questions/usage/current source/Workspace/map survey at1440/390px. Private frames inspected; loading/recovery races removed from the survey setup.
- **Validation:**UI build and both focused browser journeys pass; preceding full type/unit check447units/77files passes. Broad pre-repair browser run174passed/6skipped/4failed, honestly retained in103. No hosted CI/native turn/private content.
- **Next:**Repair two closed-tree motion journeys and reproduced72px initial-follow gap. Narrow Review pagination/current-source controls remain polish findings;84/92 keep feature/native/human scope.

### Yash with Codex — Request/result reading balance

- **When:**18 October2026, `codex/tool-exchange-balance`; isolated builder feedback during the broader audit.
- **Delivered:**[104](review/104-tool-exchange-balance.md):21px transferred from result to request preview, mirrored in hover; redundant result rule/padding removed and control gaps compacted. No captured text trimming or motion/native change.
- **Validation:**Both typechecks/build and447units/77files pass. Twelve short/long/type combinations, two wheel/hover cases and actual-session command check pass; frame inspected. Full pre-change browser run174passed/6skipped/4failed, to investigate in103. No hosted CI/private content.
- **Next:**Finish acceptance findings: prose veil overflow, closed-tree assumptions in two older motion tests, prompt-follow bottom offset. Continue84/92 afterward; preserve user package/artwork.

### Yash with Codex — Native composer target and control clearance

- **When:**18 October2026, `codex/composer-target-context`, separate increment after86 merged asdb33958.
- **Delivered:**[102](review/102-composer-target-navigation.md): visible root/recording/state, compact phone settings glyph, measured floating phone Tools/Follow row clear of Send, direct command-menu Files/Workspace and16px coarse-pointer inputs. Existing native policy/consent/attachments/submission/Stop/evidence owners unchanged.
- **Validation:**Both typechecks/build and447units/77files pass; six focused Edge journeys plus final four targeted/touch cases pass. Explicit target/geometry/navigation/minimized lifecycle and both harness forwarding/attachments/options covered; phone frame inspected. Paper browser expectation updated to101's intended canvas. No hosted CI/actual native turn/private content; package/artwork excluded.
- **Next:**Full surface/browser audit, readers/menus/evidence/search/map presentation.84/92 source-version/joined workflow and selected optional features remain separate; physical/native/assistive-tech/human/platform acceptance stays open.

### Yash with Codex — Palette contrast and quiet prose reading

- **When:**18 October2026, `codex/palette-reading-contrast`; one focused increment after85 merged as601d3d7.
- **Delivered:**[101](review/101-palette-reading-contrast.md): targeted tertiary/syntax contrast lifts, softer Paper hierarchy and static fading background below the same unboxed prose. No text duplication, layout/motion/native/capture/schema change. Retain Jet Black baseline and saved choices.
- **Validation:**Both typechecks/build and447units/77files pass. New token guard fails18 pairs on baseline and passes revised seven palettes. Actual seven-palette/no-horizontal-overflow survey and all three Drishya/Skeletongraph Codex/Claude history/Workspace journeys pass; frames inspected privately. No hosted CI/native turn/private content; package/artwork excluded. Solid-token guard is not full accessibility certification.
- **Next:**Finish84's untouched reader/menu/composer/map presentation and source-version/joined workflow;92 quiet optional Review tools remain planned. Core palette pass has bounded evidence, broad physical/native/assistive-tech/human acceptance remains.

### Yash with Codex — Settings interaction and actual palette survey

- **When:**18 October2026, `codex/settings-palette-audit`; coherent increment after84 merged as9eb5188.
- **Delivered:**[100](review/100-settings-palette-survey.md): reset section reading offsets, responsive tab orientation, shared SVG style, progressive native reasoning picker, touch sizes and corrected hover/shortcut help. No new motion/native/content persistence/dependency; Legacy retained.
- **Validation:**Both typechecks/build and446units/76files pass. Three focused Edge journeys and updated actual-session seven-palette/six-phone-section survey pass; frames inspected privately. No hosted CI/native turn/private content; user package/artwork excluded. Physical/assistive-tech/human acceptance remains open.
- **Next:**Measured tertiary/syntax palette refinement and quiet unboxed prose/map separation; continue84's untouched components and source-version/joined workflow,92 optional quiet Review tools. Do not conflate this survey with whole-product acceptance.

### Yash with Codex — Adjustable Files reading width

- **When:**18 October2026, `codex/files-reading-width`; separate coherent increment after83 merged asf3176e8.
- **Delivered:**[99](review/99-files-reading-width.md):260px default/220–420px bounded Files rail,32%-viewport cap and retained preference; stable agent allocation on minimize; Workspace clearance and reclaimed hidden Files area; observe the actual history column for origin geometry. Existing tree/narrow navigation and Legacy retained. Navigation dimensions only; no content/grant/native/repository write.
- **Validation:**Both typechecks/build and446units/76files pass. Four focused Edge journeys cover resize/clearance/minimize/responsive defaults and six-width controls. All three actual Drishya/Skeletongraph Codex/Claude histories and multi-file Workspace pass, including post-render upward-scroll sampling. Frame inspected privately. No hosted CI/native turn/private content; user package/artwork excluded.
- **Next:**Continue84's untouched readers/menus/settings/composer and palette quality together, retaining Jet Black; source-version/joined workflow and92 optional quiet Review tools remain open. Native/physical/accessibility/platform/human release acceptance remains.

### Yash with Codex — Adjustable Git reading space

- **When:**18 October2026, `codex/git-reading-space`; one focused increment after82 merged as43f119e. Builder now prefers UI/theme decisions mixed as useful; geometry/readability first, retain Jet Black baseline.
- **Delivered:**[98](review/98-git-reading-space.md): compact-default bounded Git width with sticky-header pointer/keyboard separator, collapsible proportional file rail, basename/parent identity,12px patch text and validated source/session width/list recovery. Existing consent/content identity/patch/native boundaries unchanged; Legacy retains its layout.
- **Validation:**Both typechecks/build and446units/76files pass; metadata bounds regression. Two focused Edge journeys cover resize/hide/reopen/phone and retained Find/layout; actual read-only Drishya Git review also passes, frame inspected privately. Final type refinement rerun separately. No hosted CI/native turn/repository write/private content; package/artwork edits excluded.
- **Next:**Files sizing and broader84 component/palette pass, then source-version/joined workflow and92's quiet optional Review tools. Physical/native/human/platform acceptance remains open.

### Yash with Codex — Home scan density and complete session reachability

- **When:**18 October2026, `codex/home-reading-density`, one coherent commit/PR after81 merged asf4301a5.
- **Delivered:**[97](review/97-home-reading-density.md): compact Home chrome/resume, larger title/metadata text, synchronized80px desktop/104px narrow row allocation, responsive session-position preservation and touch input/utility sizing. Inventory/filter/native picker/recovery and shared visualization retained; no new panel/endpoint/dependency/native action.
- **Validation:**Both typechecks/build and445 units/76 files pass. Seven selected Edge journeys pass together; final density/touch rerun passes.160 fixture sessions all reachable; actual library checked after discovery at three sizes,597 sessions/317 workspaces in that snapshot. Frames inspected privately. No hosted CI/native submission/private content; package/artwork edits excluded. Physical-phone/accessibility/platform acceptance remains open.
- **Next:**Continue84's untouched component/Uiverse/palette pass, retained/refreshed/captured-source comparison and joined evidence→native correction→recorded-check workflow.92's quiet optional Review tools remain planned; this is a Home slice, not product-wide completion.

### Yash with Codex — Responsive Workspace Files navigation

- **When:**17 October2026, `codex/responsive-workspace-files`; one coherent commit/PR after80 merged as1dd1076.
- **Delivered:**[96](review/96-responsive-workspace-files.md): chooser below the measured narrow Workspace header, local Files access, close/outside/Escape dismissal, selected-document focus, responsive default/explicit-preference separation and neutral/coarse-pointer search/close polish. Folder scroll recovery retained; no new source grant, native turn, direct write, endpoint or dependency.
- **Validation:**Both typechecks/build and445 units/76 files pass; final UI typecheck rerun. Ten selected Edge journeys pass together and the three new responsive cases pass after final focus refinements.390px frames inspected. Physical-phone/platform acceptance remains open under mobile-native; no hosted CI/private content. User package/artwork edits excluded.
- **Next:**84's whole-component/Uiverse/palette audit, source-version comparison and joined investigation workflow.92's optional Review tools remain planned; this fixes a reproduced navigation case without claiming the whole queue complete.

### Yash with Codex — Local Workspace draft comparison

- **When:** 17 October 2026, `codex/workspace-draft-comparison`, separate coherent commit/PR after79 merged as8235360.
- **Delivered:** [95](review/95-workspace-draft-comparison.md): inline Compare draft / Edit draft; retained-base provenance; bounded Changes/Side by side, Find/Wrap/hunk/page navigation and complete-text fallback. Editor selection/scroll is retained. Per-draft revision prevents another pane's edits from resetting the comparison, without changing draft text or persisting bodies. No new permanent panel, endpoint, dependency, schema or native policy.
- **Validation:** Both type checks/build and445 units/76 files pass. Six focused Edge journeys pass together: current Git, two-file drafts/comparison/native preparation, large comparison/phone/selection recovery, Markdown, whole-file Find and unsent New file attachment. Screenshots inspected; no native turn or disk mutation. The expanded phone Files overlay remains a broader navigation/audit item. No hosted CI/private content; user package/artwork edits excluded.
- **Next:** Continue84's full UI/skills/Uiverse/palette audit, retained/refreshed/captured-source version comparisons and joined evidence→correction→recorded-check workflow. Optional T1 Commands and related findings/repetitions/turn overviews remain under92's quiet Review placement. Local comparison is a completed slice, not a claim the whole queue is done.

### Yash with Codex — Manual history scroll stability

- **When:** 17 October 2026, `codex/manual-scroll-stability`; one focused commit/PR.
- **Delivered:** [94](review/94-manual-history-scroll.md): reproduced delayed reading-anchor correction and virtual-run measurement gaps. Newly mounted allocations and anchor recovery now reconcile before paint; settlement only records the current position. Paged-out placeholders retain known heights and do not overwrite real measurements. No new motion, wheel interception or capture/projection/schema change.
- **Validation:** Both type checks, production build and 441 units across 75 files pass. A delayed, variable-height paging regression fails on the original code and passes after repair. All13 selected Edge journeys pass together, including actual Drishya/Skeletongraph Codex/Claude history and Workspace, 6,000-command capture-anchor/search/replay, hover/reduced motion and camera follow. Claude also passes twice separately after the late-artifact observer repair. Post-render sampling avoids treating pre-paint ResizeObserver geometry as a displayed frame. Broad platform/input-device/physical low-resource and human acceptance remains open. No hosted CI/private content; user package/artwork edits excluded.
- **Next:** Continue84's whole UI/skills/Uiverse/palette pass, source/base/draft comparison and92's useful secondary developer tools. T3 is already delivered in93; optional Commands/findings/repetitions/turn overviews remain planned behind Review/navigation. Fresh AV updater attribution stays separate in38.

### Yash with Codex — Fresh recurring-alert updater attribution

- **When:**17 October2026, independent documentation increment after PR77.
- **Confirmed:**[38](review/38-windows-antivirus-audit.md): read-only sampler catches PowerShell PID14144 at10:21:41.823, parent22268 managed0.160.0 Codex `app-server daemon pid-update-loop`. Independent PowerShell400 at10:21:41 and McAfee10:21:43.503 match wrapper/signature/size. This occurrence is from the updater, not Drishya/Corepack/test commands.
- **Limits:**Blocked bytes/hash and vendor classification rationale remain unavailable. Legitimate updater/AV conflict is the leading assessment, not certified benignness or a verified remedy. No blocked script execution, installer/protection/config change, native-session interruption or upload. Bounded four-minute metadata sampler exited; nothing installed persistently.
- **Next:**Supported idle-time update/recurrence or vendor-reviewed compatibility resolution; product core scroll/theme/UI queue remains open.92/93 record selected useful features and quiet placement.

### Yash with Codex — Cross-session evidence search

- **When:**17 October2026, `codex/cross-session-evidence-search`, selected T3 from83/92; one coherent commit/PR.
- **Delivered:**[93](review/93-cross-session-evidence-search.md): one read-only imported-library FTS query behind worker/store, bounded50-result keyset pages, exact workspace/harness/UTC-date filters, Home/command-menu modal, stale-query guards and exact observation navigation. No new permanent canvas panel, schema/migration/dependency or native action.
- **Validation:**441units/75files and both typechecks/build; five focused Home/search journeys plus actual private-library search pass. Phone layout inspected; initial focus/Escape and stale-response assertions retained. Single actual-store query samples78ms including startup/5ms/3ms, not a universal gate claim. Final DTO/harness additions pass focused API/worker tests. No hosted CI/private content; package/artwork edits excluded.
- **Next:**Core upward-scroll report, full skills/Uiverse/theme audit, source-version/draft comparison and joined review workflow. Optional Commands/findings/repetition/turn summaries stay planned under existing Review; no claim all92 work is implemented. Fresh AV updater trace is separately tracked in38.

### Yash with Codex — Static updater threat assessment

- **When:**17 October2026, independent documentation increment after PR75 merged as4ec9f78.
- **Evidence:**[38](review/38-windows-antivirus-audit.md): managed binary has a Valid OpenAI Authenticode signature; the exact observed wrapper sits beside updater-only strings/settings and official installer URL. Startup/detection timing supports the updater hypothesis. Official installer source read without execution; blocked script bytes/hash and fresh parent trace remain unavailable.
- **Assessment:**Legitimate managed-updater/antivirus conflict is the leading explanation, not a confirmed false positive or safe-to-allow verdict. No Drishya-origin malicious script identified. Automatic review blocked a reference download; safer web source inspection succeeded. No installer execution, protection/configuration change, upload or session termination.
- **Next:**Idle-time supported runtime update/recurrence validation or sanitized vendor review if blocked; continue selected useful features and core UI/scroll work without calling the whole list complete.

### Yash with Codex — Feature value and quiet utility navigation

- **When:**17 October2026, `codex/quiet-workspace-navigation`, separate coherent increment.
- **Delivered:**[92](review/92-feature-value-and-placement.md) selects/places all25 feature/polish ideas by developer value. Prioritize cross-session search; optional Commands/findings/repeats/turn overview live under existing review/navigation, not permanent canvas panels. Newer native work remains useful, now in the existing utilities menu as Newer session work, with contextual command-palette route and no header arrow/filename suffix.
- **Validation:**Both typechecks/build and five focused browser journeys pass; repaired nested outside/Escape dismissal and command-dialog focus restoration before showing the destination. Native segment validation/import/late-Home guards retained. No hosted CI/native turn; package/artwork edits excluded.
- **Next:**Cross-session evidence search as a separate worker/store/UI increment, alongside the still-open core upward-scroll reliability and whole skills/Uiverse/theme queue. Selected features are not all implemented. AV evidence is independently in38.

### Yash with Codex — Complete backlog index and reopened scroll acceptance

- **When:**17 October2026, documentation-only after PR73 merged/pushed as2e035e5.
- **Finding:**84 did not clearly incorporate Harsh's82 feature audit/83 top-five implementation plan. Added an authoritative opening queue, exact links, T1–T5 dispositions, all25-item retention and explicit remaining theme/Uiverse/component/native acceptance. PR66 is proposal;67 delivers reliability. Audit statuses atb3184bd are historical, not current completion totals.
- **Scroll:** Builder still reports upward auto-scroll/skip after73. Reopened as first priority despite passing narrower regressions; source inspection shows several navigation/follow/measurement scroll writers, but no new exact cause or repair is established. Need actual-session reproduction and a failing regression before claiming fixed.
- **McAfee:**38 separates previously captured managed-runtime parent attribution from unknown payload purpose/classification. The supported daemon updater is a candidate, not a verified cure. No protection/native setting changes or external submissions.

### Yash with Codex — Exact captured prose references

- **When:**17 October2026, `codex/markdown-reference-navigation`, one coherent commit/PR after71/72 merged/pushed as08c336a/a886487.
- **Delivered:**[91](review/91-exact-markdown-references.md): native keyboard inline reference buttons, captured-work navigation with retained line, bounded artifact range/page reveal, explicit unavailable-line notices, separate line visits and safe navigation-only recovery. Existing ordinary destinations route through the state action to clear stale reference targets. No current-disk substitution, captured-event schema or native policy change.
- **Validation:**439units/74files, both typechecks/build, six focused new/retained keyboard/search/evidence/replay journeys and three actual private Drishya/Skeletongraph Codex/Claude history/scroll/Workspace journeys pass. Actual Drishya frame inspected; missing Claude workspace root stays explicit. No hosted CI/native prompt; user package/artwork edits excluded.
- **Next:** Source-version/base/draft comparison; primary joined investigation;84/85/87 component/palette work; native signed-in, human/assistive-tech and physical/platform acceptance. McAfee38 remains a separate unresolved runtime update/recurrence check. The whole list is not complete.

### Yash with Codex — Recurring Windows antivirus diagnosis

- **When:**17 October2026, separate documentation-only increment after PR71 merged/pushed as08c336a.
- **Finding:**[38](review/38-windows-antivirus-audit.md): new09:21:40 McAfee detection follows the same09:21:38 PowerShell wrapper. Supported native diagnostic confirms CLI0.163.0 but managed/running app-server0.160.0. Global CLI is parent of currently running old app-servers; the alert process's parent is no longer available. Earlier direct attribution remains evidence, not proof for every recurrence.
- **Action:** Document the supported separate `codex app-server daemon update` plus before/after version check and recurrence validation. Not run while native work is active because its own help warns of interruption. No native config/binary edits, protection exclusions, uploads, session termination or verified-fix claim. Official feedback guidance checked; local metadata only.
- **Next:** Idle-time managed-runtime update/verification; continue exact keyboard path/line reading and84/85/87 product queue. All-list completion is explicitly false.

### Yash with Codex — Faithful Markdown instruction lists

- **When:**17 October2026, `codex/faithful-markdown-lists`, one coherent commit/PR.
- **Delivered:**[90](review/90-faithful-markdown-lists.md): nested/mixed list structure, captured starting/discontinuous ordinals, item paragraphs/quotes/fences, safe bounded-depth fallback and compact reading spacing. No source/provenance/native/schema changes.
- **Validation:**435units/73files, both typechecks/build, focused1440/900/390px browser and actual private Drishya continuation history/scroll/Workspace pass. Local only; user package/artwork changes excluded.
- **Next:** Exact keyboard path/line destinations, source/draft comparison, joined investigation and the remaining84/85/87 audit/acceptance list. McAfee recurrence diagnosis stays separate in38; no antivirus fix claimed.

### Yash with Codex — Bottom prompt timeline and independent page scrolling

- **When:** 17 October 2026, `codex/prompt-timeline-scroll`, one focused commit/PR after69 merged/pushed as574973a. Builder explicitly requests merge after local checks.
- **Delivered:** [89](review/89-bottom-prompt-timeline.md): bottom-anchored timeline grows upward, only the topmost marker clears intersecting Workspace/header controls, complete independently scrollable virtual prompt list, captured timestamps in previews/global outlines, far-right Modern page scrollbar with preserved center allocation. Composer/Tools/Follow bottom clearance adapts on phones. No event schema or native permission changes.
- **Validation:**431units/72files, both typechecks/build; five focused prompt/navigation/browser journeys pass. Four golden updates add captured turn times only; missing time is never invented. Actual Drishya continuation history/manual-scroll/multi-file Workspace also passes; details in89. No hosted CI/native turn. User package/artwork edits preserved.
- **Next:** Continue84/85/87: joined evidence/source/correction/check workflow, broader component/palette audit, native signed-in and human/platform/accessibility acceptance. Review88 remains explicit segment navigation, not automatic stitching.

### Yash with Codex — Native segment navigation

- **When:** 17 October 2026; branch `codex/native-segment-navigation`, one focused commit/PR after merged68 (45a09e7).
- **Delivered:** [88](review/88-native-session-segments.md): authenticated bounded native-parent lookup, only Codex discovery, explicit header navigation to newer segments, safe untitled header fallback, outside/Escape/phone geometry and stale-import guards. No silent stitching, native prompt/watch, event schema or policy changes. Actual old Drishya journal positively matches one newer native-linked segment.
- **Validation:** Full430units/72files, both typechecks/build; four focused browser journeys pass (two segment flows plus header/responsive checks). Real metadata check is read-only; no private source identifiers committed. No hosted CI/native turn. Builder requests merge after verification.
- **Next separate PR:** Restore bottom-anchored prompt timeline; only its uppermost marker needs Workspace clearance. Independent timeline scrolling and timestamp previews, page scrollbar at the far-right edge. This supersedes87 top-anchoring. Then resume84/85/87 product work.

### Yash with Codex — Whole-file reading and stable Modern workflow

- **When:** 16 October 2026, `codex/multi-file-workspace` / [PR68](https://github.com/drishya-dev/drishya/pull/68). Builder explicitly requests push/squash-merge after local gates. Later PRs use one coherent commit each; the existing branch retains its earlier purpose increments for backtracking.
- **Delivered:** [87](review/87-modern-reading-and-component-audit.md): stable larger header and centered glyphs, in-capsule minimize/fresh collapsed folders, whole-file2MiB virtual source Find/Go/Copy, higher compact Workspace/Back,256KiB native-attached Edit/New file drafts, wrapped connectors, decoded execution/MCP arguments/results with raw access, independent input/result allocations, nested-content hover sizing, removed duplicate delayed scroll correction, prompt-rail clearance, passive stopped-journal catch-up and Home update hints/refined native filters. No direct project writes or automatic prompt submission.
- **Validation:** Both typechecks/build,426units/71files pass.105 distinct selected browser journeys have passing final results across the103-pass sweep and corrected focused reruns; not one all-green full run. Four private actual recordings also pass. No hosted CI/native turn. Review87 records test races, fixes and exact limits;38 records renewed antivirus evidence without a false-positive/fixed claim.
- **Next:** Native segmented-history continuity, joined evidence/source/correction/check workflow, broader component/palette audit and native/human/platform acceptance. An old journal stopped growing while its newer imported segment was behind; opening the newer one catches up now, automatic stitching is not implemented. Preserve user package/artwork edits and private stores.

### Yash with Codex — Modern daily workflow, recovery, reading and HUD

- **When:** 16 October 2026, `codex/multi-file-workspace` / [PR68](https://github.com/drishya-dev/drishya/pull/68), based on integrated main `b3184bd`. Every coherent purpose is a separate commit; do not collapse this working history into a single authored increment.
- **Merged earlier:** PR66 proposal `c809a1b`, PR67 reliability `b3184bd`, preserving Harsh's authorship; React Flow/ELK remains proposal. Prior centered-header rollback retained as history; latest floating HUD explicitly supersedes its surrounding chrome only.
- **Delivered:** Eight-tab/two-pane Workspace/current source/local volatile drafts/native preparation ([82](review/82-developer-workspace.md)); consistent tool envelope formatting/readable card minimums; independent edge controls; Modern default; bounded daemon-backed navigation recovery/CAS/privacy/forget; complete merged Home session library and Drishya introduction; sustained live refresh/Follow restart; React185/manual-scroll positioning repairs and error recovery; Markdown Document/Source and fenced exact Copy/Wrap; header HUD/minimized composer with Stop/status/Toolbox; seven effective Modern palettes. Shared actual visualization and native/privacy boundaries remain.
- **Validation:** Both typechecks, production build and **415 units/68 files pass**. Three real-Git integration cases now have an explicit20s test budget after measuring two-snapshot journeys above5s on Windows; assertions/product limits unchanged. Browser validation: the full156-case run had153 passes,2 explicit opt-in skips and one obsolete palette-parity expectation; its corrected focused rerun passes. Three additional actual redacted recordings (Skeletongraph Codex, Skeletongraph Claude, Drishya) pass history/manual-scroll/text-wrap/multi-file reading checks. Thus157 distinct browser journeys have passing final results across the full run and focused rerun; no single all-green full-suite claim. Five focused HUD/palette/Git journeys also passed earlier. No hosted CI or real native turn. Private stores/screenshots and user package-manager/artwork excluded.
- **Critical review and remaining work:** [84](review/84-modern-daily-workflow.md) is the ordered complete request queue; [85](review/85-modern-component-review.md) records independent developer/component gaps; [86](review/86-hud-palettes-and-reading.md) records current HUD/palette/reading contract. Next: faithful keyboard/path-line Markdown navigation/list structure, whole-file find/current version continuity, joined evidence/source/correction/check workflow, reader density and useful typed map neighborhoods. Native-account, sustained human reading, physical/platform/accessibility gates remain open. CUA unavailable; automated journeys/source/rendered frames are the evidence.
- **Publication:** PR68 awaits other-builder review; no automatic merge or CI dispatch. The running local daemon was not silently restarted. Refresh serves the built frontend; new metadata endpoints require a normal restart of the existing local server.

### Harsh with Codex — Everyday workspace reliability

- **Review:** [PR #67](https://github.com/drishya-dev/drishya/pull/67) merged as `b3184bd` after Yash review and queued-retry correction. No hosted CI dispatched.
- **When:** 16 October 2026, `codex/workspace-reliability`, based on main `15974a4`. The builder requested the remaining work after PR #65 and explicitly keeps real native-account checks for themselves.
- **Delivered:** [81](review/81-workspace-reliability.md): bounded source/session reading memory, history/evidence/map/folder continuity, exact-patch Git control restoration, queued concurrent file preparation, attachment previews/retry, UTF-8 prompt limits and rejection-safe drafts, qualified cached reading/native receipts on disconnect/authentication loss, contextual retries, corrected keyboard review navigation and file glyphs/folder keys. Review work now pages every captured outcome/file through the existing history worker, capped at 20/group and 50 paths with complete global counts. Existing 3D/reading/review features were audited and retained; no event/store schema or native permission change.
- **Validation:** Final Windows Node 24.11.1 / cached pinned pnpm 10.34.5: both typechecks and **387 units / 63 files pass**; final complete browser sweep **145 passed / two explicit opt-in skips** (147 total, 8.2 minutes); isolated offline package installation/import/API/persisted restart and unchanged deterministic demo pass. Ten-minute synthetic reading: **601,301 ms / 84 rounds / peak 862 DOM nodes**, with pinned evidence/anchors retained; last native offline disclosure and Usage geometry pass three repetitions each and the final full browser sweep. Earlier layout failures were repaired and the two finite Follow/menu test races were corrected without weakening evidence or exact geometry assertions. Details/limits in 81.
- **Runtime:** Actual server on `http://127.0.0.1:7878/`, normal user store. Restarted only with all six native controllers idle, then restored the three previously enabled passive watches. New launch link is required in separately signed-out browsers. Existing real recording/Settings and deployed bounded review API inspected; no new real-session import, native prompt/approval or hosted CI.
- **Next/limits:** Other-builder code review before merge. Builder-owned real Claude/Codex lifecycle, human comprehension/preference and assistive-tech checks, physical low-resource and macOS/Linux release acceptance remain open. Review 75's retired independent-shell parity list is superseded by the shared foundation; do not reopen delivered 3D, Home, reading or Git functionality as missing features. Private stores/screenshots/logs stay ignored.

### Harsh with Codex — Repository map and live workflow proposal

- **PR:** [#66](https://github.com/drishya-dev/drishya/pull/66) merged as `c809a1b` after Yash review. Labels: documentation, area: map, area: canvas, decision. No implementation or merge performed.

- **When:** 16 October 2026, isolated branch `codex/repository-workflow-proposal`, based on main `15974a4`. The builder requested a written proposal and a PR for Yash before implementation.
- **Proposed:** [Repository map and live workflow](review/repository-map-live-workflow-proposal.md): retain the current 3D overview; compare a bounded optional 2D folder/import focus view with the existing renderer; preserve chronological passages, terminal evidence and shared evidence/navigation owners. React Flow/ELK remain candidates, not adopted dependencies.
- **Review gate:** Yash should accept/revise/reject the six explicit questions. No visualization/default/native/schema change is approved by this document; agree the first bounded implementation task after review. Current Modern-on-Legacy and Canvas boundaries remain authoritative.
- **Validation:** Documentation links, Markdown fences, whitespace and exact file scope checked locally. No runtime/UI code changed; no browser/performance/human acceptance claim and no hosted CI. The active workspace-reliability checkout and its uncommitted changes are outside this PR.

### Yash with Codex — Modern breadcrumb header and shared panel material

- **When:** 15 October 2026. PR #65 squash-merged as `84f76e2`; local `main` fast-forwarded. Original increments remain on local `codex/modern-reading-craft`; [80](review/80-modern-breadcrumb-header.md), implementation `5ec7578`.
- **Changed:** Files and Toolbox share a neutral graphite gradient. Modern uses a horizontal Home / repository badge / session title header, with Search and utilities on the right. Responsive project/brand collapse preserves the title and working controls; compact Git from 79 and Legacy visualization stay intact.
- **Verified locally:** Both typechecks/build. All **14 Modern journeys pass** across the initial run plus final responsive correction rerun; added header geometry assertions caught and now prevent the inherited mobile overlap. Actual local Codex UI inspected; Files/Toolbox gradient equality verified. No new real-workspace access, native prompt or hosted CI; unit baseline not rerun for this presentation-only change.
- **Brand follow-up, 15 October:** Browser tab/ICO/bookmark/touch icons now use size-optimized derivatives of the supplied logo; shared Home/Legacy/Modern/Canvas mark and retained Fresh brand use the 192 px derivative rather than the 5 MB source. Build, local HTTP MIME/status checks and actual browser image/icon metadata pass. No hosted CI.
- **Continue:** Review 80 supersedes header/material choices in 79; review 79 still governs separate Git/Toolbox controls. User package-manager/artwork edits remain untouched. Human preference/native-account/physical/platform acceptance remains separate.

### @yash (with Claude)
- **When:** 2026-09-22 → 25
- **Did:** Built the whole backend draft and a base UI on branch `yash/backend-draft`:
  - Contracts, privacy/redaction, capture core, and the Claude Code and Codex adapters.
  - The SQLite store with blobs and search, ingest with live tailing, the projection reducer, the repository indexer, and the pure scene composer with golden scenes.
  - The Nemotron explain layer, the local API and CLI, synthetic fixtures (Claude + subagent + Codex review of a small repo), and the base React UI.
  - 96 tests and CI on Linux and Windows.

  Validated on this machine's 602 real sessions. That found and fixed: blob refs in long commands, new record types, over-eager test detection, Claude's `originalFile: null`, Codex `exec`/collaboration/MCP namespaces, and injected Codex context in titles. See [`CODEBASE.md`](CODEBASE.md).
- **Left half-done:** Nemotron layer untested against the live API (no key yet). DB worker thread, tree-sitter, Pixi and CodeMirror are follow-ups by design.
- **Watch out for:**
  - The contracts are `0.1.0-draft`. Review them before building on them; the freeze needs both of us.
  - Golden scenes change only deliberately (`vitest -u` after reviewing the diff).
  - Never commit real sessions. `fixtures/synthetic/` is generated by `scripts/fixtures/make-synthetic.ts`.
  - The repo must be public before any hackathon submission.

### @harsh (Harsh-4210)
- **When:** 2026-10-02 → 06 (with Claude Opus 5.5). Latest: P1 presentation polish (local checks only; no hosted CI, per CI_POLICY).
- **Did:** Docs review and proposals H–L (PR #2). B0 privacy (PRs #3–#5, policy `p3`). B1 capture lifecycle and recovery (PRs #6–#7). This session, B2-R on `harsh/b2-artifacts-graph`:
  - **Bounded artifact reads (A15):** `BlobStore.readLines()` uses a sparse line index (one streaming pass, LRU of 128) and seeks near the requested start. Responses are capped at 2 MiB, and `GET …/artifacts/:id` returns an `ArtifactSlice` (`available`/`reason`, `start`, `returnedLines`, `totalLines`, `totalBytes`, `truncated`, `hasMore`). Missing or uncaptured content is an explicit unavailable state; the UI no longer mislabels empty text as "Protected file", and shows "Showing lines a–b of N" when cut.
  - **Graph approval and freshness:** the map scans only an approved root (explicit `graphRoot` via `--workspace`, or `POST …/graph/approve` for the captured root only; drive roots and the home folder are refused). Until then it is files-only with `approvalNeeded`. A cached map reports `stale` from a walk-and-stat `probeGeneration()` (reused 15 s) and is rebuilt only on `?refresh=1`, so the layout stays pinned while reading. The indexer never opens a protected file such as `.env.js`. Exports strip `stale`/`approvalNeeded`.
  - 182/182 tests (12 new, all confirmed failing first); typechecks, UI build, demo bundle unchanged. Checked in the real app: files-only map plus approve button, then the full map, then "Out of date · Refresh" after a file was added (no auto-redraw), then refreshed.
- **Also did (B2 close-out, `harsh/b2-real-acceptance`):** added `tests/browser/b2-real.spec.ts`, an opt-in Playwright journey on real sessions (skipped unless `DRISHYA_REAL_SESSIONS` names a `{ adapterId: path }` JSON file; it copies journals, asserts only counts/ids/states). Real-session result (4 Oct, Harsh's machine, opt-in): one finished Claude Code session (1,172 journal lines → 556 observations, 480 steps, 189 operations) and one finished Codex session (704 lines → 234 observations, 211 steps, 80 operations). Each was copied to a temp folder and grown in two live bursts; the reader anchor held at 1440 and 390 px, map-off held, an operation opened, a reconnect reloaded the same history, and a resync added nothing. 0 visible gaps; 2/2 passed twice. Only counts were reported; the copies and stores were deleted.
- **Also did (B4, `harsh/b4-capture-overhead`):** `scripts/bench-overhead.ts` times a synthetic agent process with and without the live observer, and with a browser open; rotated order, 5 runs, loss check against a fresh import. Within the <5% budget on the reference machine: observer −0.3%, observer+browser +2.2%, write-bound −0.8%, 0 lost. Recorded in [B4 record](review/07-b4-scale-install.md) with its limits.
- **Also did (CI flake, `harsh/fix-flaky-b3-reader-test`):** the B3 "expands captured content in place, pages it" browser test failed once on ubuntu-latest (run 37303810939, a docs-only commit) and passed on the next run. It could not be reproduced locally, even with Chrome CPU throttled 20×. The test now pins the read by `data-op-id` instead of a re-resolved `.last()`, waits for "Next lines" to be enabled, and confirms the page moved (Previous enabled, first line number 201). CI uploads `test-results/` (synthetic only) when a browser job fails, so a repeat can be diagnosed. If it recurs with the snapshot showing page 1 after a click, suspect a reader remount on live reload.
- **Also did (P2-A, `harsh/p2-since-last-visit`):** **P2-A "Since your last visit" implemented (5 Oct, Harsh, `harsh/p2-since-last-visit`):** a local reading mark per recording (`reading_boundaries`, store schema v4; `GET/POST /v1/recordings/:id/boundary`) that moves only on explicit Mark all as seen / Mark through here, with Undo via the kept previous mark. The pure `sinceBoundary()` in `packages/scene` lists failures, edits, test runs, still-running operations and capture gaps whose outcome landed after the mark, each linked to its operation. Briefing opens with this digest, and the crown shows "N new since your mark". Single recordings only (combined views have no mark). Also fixed Briefing's "Since step N" comparing a timeline step with observation sequences. 203/203 tests (9 new). Checked in the real app: not marked → mark all → nothing new; new work → "7 new since your mark" listing only the post-mark test run; link opens the operation; Undo restores; reload does not move the mark.
- **Also did (P2-C, `harsh/p2-verification-freshness`):** **P2-C verification freshness implemented (5 Oct, Harsh, `harsh/p2-verification-freshness`):** pure `verificationFor()` in `packages/scene` gives, for one change, the test runs recorded after it, later changes to the same files, and one of three verdicts (no run recorded after / a run recorded after / the last run predates a later change). It is served by the history worker at `GET /v1/recordings/:id/verification/:opId` (bundles compute it locally) and shown as "Test runs after this change" in an edit's detail, with order-only wording and no coverage or "safe" claims. 221/221 tests (6 new). Checked in the demo: Codex's patch shows "A test run was recorded after this change… Last recorded run: npm test · 7 passed, 0 failed", and the link opens the run. Not yet: freshness tags in the since-your-mark digest (`since.ts` is in open #23; follow-up after it merges).
- **Also did (P1 polish, `harsh/p1-presentation-polish`, 6 Oct, local only):** named palettes via `data-palette` (`data-theme` unchanged): **Jet**, the signature default (stored as `dark`): matte jet black with champagne gold, flat surfaces, gold accents/keywords and a static fine grain plus vignette for a matte finish (dropped in low resource mode); **Midnight** (the prototype's near-black world); Light; System. Prototype-like type and materials, wider reading shapes (source 620 px), compact toolbox, and a **history activity timeline** (edit/failure/pass ticks in recorded order; tick or Next failure / Previous failure / Next edit opens the action). `Marker.operationId` added (golden marker strip updated deliberately). Read arrivals now show a document silhouette lifting from the real map node / working-set row into the action header (finite, interruptible, no text travels). Fixed: jumping to a distant action could leave it off-screen (anchor restore pulled it back; tall passages centred past their first action). Proposals for paid-grade features in [19](review/19-developer-feature-proposals.md); details in [20](review/20-presentation-polish.md). Local: typecheck + 245 units, 35 browser journeys (2 opt-in skips; new timeline/palette journey failed first), package:verify, demo bundle unchanged, ten-minute soak passed (604,732 ms, 114 rounds, peak 709 DOM nodes; run before the final CSS-only Jet palette pass, after which the full browser suite and package:verify passed again).
- **Left half-done:** nothing in B2. B4: overhead on a 4–8 core laptop is unmeasured; the worker/paged-projection redesign is unclaimed (coordinate before starting, it touches ingest/projection/UI). Pending @yash's OK: the additive contract fields from B0–B2.
- **Watch out for:** a map now needs one approval click per recording whose root was not set with `--workspace`. Old data still needs re-import if tagged "older privacy policy".

### Yash with Codex — Integrated interface craft
- **When:** 13 October 2026, `codex/interface-craft`, following merged functional PR #59. [PR #60](https://github.com/drishya-dev/drishya/pull/60) squash-merged as `f5f672d`; local main updated, individual implementation commits retained on the local branch. The builder lifted the UI hold, supplied four screenshots, required real-session review and approved `docs/Logo.png` as the temporary brand. A final small Home discovery loading/error/retry correction passed both Home browser journeys on main.
- **Delivered in separate commits:** [69](review/69-interface-craft.md) documents bounded two-axis Git/source/patch reading with scroll restoration, single container input focus, centered vector Settings glyph, simplified Settings/native controls, lighter shared toolbar/rail/Home materials, pointer-only modal/search feedback, GPU prompt marks, exact Markdown/text highlighting, supplied crystal brand and compact read-only prompting when native workspace metadata is absent. Real-map testing also fixed selected-file camera offsets when a reader reallocates the canvas, and the first-use map consent button's pointer access. Captured/current/native consent boundaries remain intact.
- **Checks:** Windows Node 24.14.0. Full browser suite: 107 passed/two explicit opt-in skips; final map consent/source-neighborhood/reader/Fit regressions pass independently after the camera change. Final full units: 360 passed. Both TypeScript checks, production UI build and isolated packed CLI installation/import/API/persisted-restart verification pass. No hosted CI. Real UI inspection used Codex 4,021-operation/eight-agent Drishya and Claude 2,215-operation Skeletongraph recordings, including long commands/Write, native missing-root state, actual repository/source reading, short 844×390 layout and Paper controls. No real native turn was submitted. User package-manager/source artwork stays untouched; real captures and screenshots stay ignored/local.
- **Next:** Fresh human/developer visual preference and comprehension review on these actual recordings, real native-account lifecycle, screen-reader and physical/platform/low-resource release acceptance. Do not interpret the UI pass or synthetic transport as full release certification or complete review-50/editor feature delivery. An older Claude recording's root remains unavailable rather than inferred from its journal filename or a map hint.

### Yash with Codex — Independent connected design
- **When:** 14 October 2026, `codex/fresh-product-design`, based on main `906215e`. Reviewed and squash-merged Harsh's PR #61 with original contributor attribution; both typechecks, 17 daemon Git tests and six focused Git browser journeys passed locally.
- **Delivered:** [71](review/71-independent-new-frontend.md): a new application from concept/backend contracts and installed design/motion skills, designed by an isolated agent without old frontend/prototype/screenshot references. Independent `?experience=fresh` entry, styles/API/layout; Classic stays default and backup. Session discovery, bounded history, captured/full prose/artifact reading/search, tools/agents/files, consented current source/Git, exact revalidated handoffs, local questions, native prompt/attachments/approvals/settings/usage and optional sequence replay. Corrected replay cache/search/file-activity identity, lazy visible preview reads and rootless bounded captured-path handling.
- **Checks:** 366 units, both TypeScript projects, production build, eight fresh browser journeys and isolated offline packed CLI/import/API/restart passed. Real Drishya Codex (4,118 operations/eight agents) and Skeletongraph Claude (2,215 operations) inspected; no native prompt issued. Earlier full browser sweep: 116 passes/two opt-in skips/one Classic source-range hover timeout. That unchanged journey passed an isolated retry but reproduced in a combined rerun; follow-up remains, so no clean full-browser-suite claim. One concurrent unit run timed out in Git; the full suite passed rerun without parallel browser/typecheck load. No hosted CI; private captures/screenshots and user package-manager/artwork edits excluded.
- **Next:** Builder firsthand comparison, then bounded draft promotion/parity choices. This draft has a 2D bounded map, not Classic's 3D camera/clustering; full resource/theme controls, offline bundle entry, prompt draft persistence and wider Classic reading/focus conveniences remain explicit. Native real-account, human/ten-minute, physical/platform/accessibility acceptance remains open. Keep Classic available and track its source-utilities pointer issue separately.

### Yash with Codex — Modern spatial workspace
- **When:** 14 October 2026, `codex/modern-spatial`, based on merged main `1733c98`. Previous switcher commit `fe87519` pushed and PR #62 squash-merged on builder instruction. Harsh can pull that baseline; current Modern work is separate.
- **Delivered:** [72](review/72-modern-spatial-workspace.md): new library, floating explorer/toolbox/inspector, neutral connected materials with per-kind evidence compositions, safe prose formatting, compact native controls, bounded spatial-density map with actual import links and quiet real-topology background. Legacy remains isolated; the Workbench choice is removed and `fresh` links migrate to Modern. Files search reveals nested matches; opening Files keeps the canvas allocation. Initial Git readiness race corrected separately in `28a7f2b`. Latest builder direction and skill-based interaction review are persisted in 72/VISION.
- **Checks:** 371 unit tests/57 files, both typechecks, production build and 12 distinct focused browser journeys pass locally (11 together, plus targeted dismissal and multi-block prose regression checks). Browser coverage includes both harness captures, native consent/idle acknowledgement, current Git stale handoffs, replay evidence boundaries, Legacy/Modern switches, nested Files, map navigation and 1440×900/1280×720/390×844/844×390 bounds. Actual Codex Drishya and Claude Skeletongraph recordings inspected through the local daemon, including long shell/patch material and Claude test counts; no real native prompt sent. No hosted CI. Real captures/screenshots and user root package-manager/artwork edits remain excluded. This is not a clean full-Classic-suite claim: review 71's unrelated Classic source-range hover timeout remains tracked.
- **Remaining:** Modern is an opt-in candidate. Full 3D/resource controls, offline entry, draft persistence, richer history/evidence navigation and review-50 utility parity are explicit in 72. Real native-account, human comprehension/preference, ten-minute, physical/platform/accessibility release acceptance remain open. Do not call this every-feature or every-device completion.
### Harsh with Codex — Git handoff candidate
- **When:** 14 October 2026, branch `codex/git-handoff-revalidation`; based on integrated main `0ec6caf`. [PR #61](https://github.com/drishya-dev/drishya/pull/61) open into main; review requested from `yashdoke7` before merge. PRs 57–60 already merged.
- **Delivered:** [70](review/70-revalidated-git-handoff.md) rechecks the current Git page before preview/save, retains exact previewed text, rejects content/branch drift, labels completed sampling time and omissions, clears previews on review edits and suppresses late downloads after closing/source changes. Invocation-only configured filter suppression, shared 30-second Git subprocess deadline and final consent recheck preserve four-reader/50-path/content bounds. Earlier merged readers, notes, interface/logo and capture/native behavior retained.
- **Local checks:** Windows Node 24.11.1/pnpm 10.34.5: frozen lock, both typechecks, **364 units**, complete browser suite **110 passes / two opt-in skips**, six focused Git journeys, production build, isolated offline packed CLI install/Claude-Codex import/authenticated API/persisted restart, unchanged deterministic demo and clean whitespace. Synthetic 50-file sample: **4,921 ms**, zero omissions, 9,800 patch bytes; one reference-machine sample, not a resource/platform gate. No hosted CI.
- **Fixture correction:** Initial full run: 109 pass/one reading-baseline failure/two skips. Unchanged test passed three isolated repeats. Replaced its two-frame wait with measured stable visible allocations; all three-pixel preservation assertions retained. Five repetitions and final full suite pass. Separate test commit for backtracking.
- **Next/limits:** Git remains optimistic sampling; filesystem/configuration are not locked and the subprocess deadline is not a hard filesystem bound. Native real-account lifecycle, human comprehension and physical/platform/assistive-tech acceptance remain release gates; wider review-50 semantic/diagnostic/historical-handoff work remains separate. No new real imports/prompts or ten-minute run. Private local stores/guidance/screenshots excluded. Preview runs on 7878 from ignored display home.

### Harsh with Codex — Observation canvas
- **Review:** [PR #64](https://github.com/drishya-dev/drishya/pull/64) is open into `main`; Yash (`yashdoke7`) review requested. Branch published through implementation `c78eba4`; local checks below are unchanged. No hosted CI dispatched. Do not merge before the other builder reviews.
- **When:** 15 October 2026, local `codex/picgen-redesign`, continuing the existing uncommitted PicGen foundation after merge `39a8df0`.
- **Delivered:** [72](review/72-observation-canvas.md), the pasted read-only canvas brief: exact material/type/color roles, 56 px header/rail, activity switches, connected DOM action cards, separate bounded reader, search/jumps/ticks, agent lanes, repository files, grouped Home, Dark/Light/System and local WOFF2. Existing API, scene, worker history and artifact readers are reused; no production daemon/schema/capture changes. Classic/Workbench remain explicit alternatives.
- **Validation:** Final Windows Node 24.11.1 typechecks and **371 units pass**. Complete browser sweep: **128 passed / two opt-in skips**. Final scoped follow-ups (light-theme hit paths, saved version choices, reconnect disclosure and material-only copy) pass **21 focused Canvas/Settings/Workbench journeys**. Final offline package verification passes isolated install, Claude/Codex synthetic import, demo export, authenticated API and persisted restart. Desktop/phone/light visual review has no page errors or document overflow. Requested scripts ran using cached pinned pnpm 10.34.5 after sandbox Corepack attempted a registry download; normal local filesystem/loopback access was required for tests.
- **Separate test increments:** `61edf65` waits for independent Codex runtime inventory; `a28311d` follows consent controls after saved workspace permission resolves. Production daemon code is unchanged. Private local assets, tooling and stores are now explicitly ignored.
- **Limits:** Current attachment includes text but no reference image files, so exact side-by-side visual acceptance remains unverified. No hosted CI, native account turn or real import. Preview `http://127.0.0.1:5177/?demo&experience=canvas`.

### Harsh with Codex — Local PicGen redesign
- **15 October sync:** Merged `origin/main` through `1733c98` into `codex/picgen-redesign` as `39a8df0`, preserving all uncommitted work. Upstream's independent Fresh entry/switcher is retained; the local visual layer now loads from `classic-entry.tsx`. Documentation conflicts retain both builders' records. Frontend typecheck, production build and whitespace checks pass after integration; a recovery stash remains available. No push.
- **When:** 14 October 2026, local `codex/picgen-redesign`, based on the Git handoff candidate. The builder authorized the requested installed skills without the missing `emil-design-eng` requirement and supplied six PicGen screenshots. No remote push or PR.
- **Delivered:** [71](review/71-picgen-workspace.md) and [UI design system](../apps/ui/DESIGN.md): locally served/licensed Outfit, static dotted canvas, neutral floating materials, flatter tool rail, session-library rows and inventory, shared Jet/Midnight/Paper materials, responsive utilities and named multi-agent shortcuts sharing compound focus and measured prose origins. Explicit prompt/action navigation now clears fixed controls; single-agent headers avoid duplicate badges. Existing captured/current/native behavior stays intact.
- **Validation:** Both typechecks, **364 units**, production build and isolated offline packaged install/synthetic import/authenticated API/restart pass. Final broad browser sweep: **108 passed / two failures / two opt-in skips**; the Usage overflow and old 280 px preview assertion were corrected and both pass focused reruns (the active reviewed preview ceiling is 340 px). Earlier agent/reader/origin/settings/map/short-layout failures were corrected and their focused reruns pass. Do not describe this as one clean all-green full invocation. Visual QA on synthetic data confirms Outfit loaded, no page errors and zero document overflow at 1440 and 390 px; existing browser journeys cover 1920/1280/844/390 layouts.
- **Next/limits:** Human visual preference/comprehension and real native-account/physical/platform/accessibility acceptance remain separate. Local preview on 5175 (`?demo=live`); screenshots and synthetic QA stores stay local and outside candidate files. No real recordings imported or native prompts submitted by this pass. Existing PR #61 remains separate.

## Next up

**Current ordered work:** [84](review/84-modern-daily-workflow.md) supersedes the historical checklist below for active product/UI tasks. Keep every builder request and review disposition there; use85 for critical findings and86 for current HUD/palette contract. Native/platform/human acceptance remains release work.

**Current backend-first sequence:**

1. ~~**B0: privacy hardening.**~~ Done 2 Oct: A01 (PR #3); A02 sinks, A03, A04 (PR #4); protected-file scopes, safe forget, outdated-policy flag (`harsh/b0-leftovers`). Policy now `p3`.
2. ~~**B2: identity, artifacts and honest history.**~~ Done 4 Oct: anchors, as-of boundaries, worktree identity (PR #10); bounded artifact slices, graph approval/staleness (PR #11); synthetic browser gate (PR #12); real-session acceptance on opted-in Claude Code and Codex sessions (`harsh/b2-real-acceptance`, `tests/browser/b2-real.spec.ts`). Real-session result (4 Oct, Harsh's machine, opt-in): one finished Claude Code session (1,172 journal lines → 556 observations, 480 steps, 189 operations) and one finished Codex session (704 lines → 234 observations, 211 steps, 80 operations). Each was copied to a temp folder and grown in two live bursts; the reader anchor held at 1440 and 390 px, map-off held, an operation opened, a reconnect reloaded the same history, and a resync added nothing. 0 visible gaps; 2/2 passed twice. Only counts were reported; the copies and stores were deleted.
3. ~~**B3: integrated base history.**~~ Merged 5 Oct as PR #15 with accumulating history, virtualized/in-passage reading, bounded material caches, session/file/tool navigation and synthetic browser acceptance on Windows and Linux. Premium animation remains P1.
4. **B4: scale and installation.** Engineering candidate implemented: bounded worker history, low-resource mode, explicit storage/cleanup and verified offline packaging. Reference-machine normal/long latency and physical valid 1 GiB probes improved substantially; passive overhead retest is +2.7% with browser, no lost/duplicate events. Physical low-resource/lower-core and real macOS/Linux validation remain release gates. See [current evidence](review/08-b4-history-reader.md); historical measurements stay in [07](review/07-b4-scale-install.md). **Do not claim broad-release B4 certification.**
5. **P1/P2 integrated product candidate delivered.** The shared workspace, content-shaped readers, measured finite origins, since-your-mark, global file comparison and qualified verification are implemented. Use [PRODUCT_DELIVERY](PRODUCT_DELIVERY.md) for run/architecture details. Next is refinement on the real app plus the human comprehension/preference pilot and physical/platform acceptance, rather than another standalone prototype.

6. **Later:** additional harnesses, privacy-reviewed packets, theme variants. Optional model validation follows exact-payload consent hardening and is not a baseline dependency.

The older checklist below is kept as a record. Items done by the backend draft are ticked when it merges.

Ordered by dependency, not by owner. Take from the top of either column. Tick when merged, not when written.

### Capture side — indexer, adapters, daemon

- [ ] Repo skeleton: TS monorepo, lint/typecheck/test, CI skeleton
- [ ] SQLite schema + content-addressed blob store (event schema §4)
- [ ] **Capture 5 fixture sessions** (blueprint §17.3) — *unblocks all rendering work, do this first*
- [ ] Tree-sitter parse → symbol table, Python + TypeScript, via `web-tree-sitter` (§10.6 stages 1–2)
- [ ] **Import resolution** (§10.6 stage 3) — the hard part; budget for it
- [ ] Measure cold index on a 5k-file repo against the 30 s budget (§14.5)
- [ ] **M0 GATE:** index 10 OSS repos, hand-check a sample of resolved edges

### Scene side — renderer, motion, pacing

- [ ] Design tokens: color, type, timing (§7.4)
- [ ] Three-layer render shell — Pixi canvas / DOM / backdrop surfaces (§14.3)
- [ ] Static placeholder graph rendering in Pixi
- [ ] **Lift prototype against a fake graph** (catalog §0.6) — *the signature move; get this right before anything else*
- [ ] Scene composer skeleton **as a pure function** + first golden test (§9.6)

### Both, at M0

- [ ] Freeze v1 of the event schema — it is the seam, and it is the one thing that needs agreement
- [ ] Agree the graph API surface the renderer consumes

---

## Decisions made

- **23 October — PERF-2 gate holds DATA-3 (Harsh, no exception):** Keep the existing interaction p95 <100 ms, visible update <1.5 s and process RSS ≤512 MiB targets. Resume DATA-3 onward only after all three pass the full real-journal matrix. Yash owns the private-source acceptance runs; local invented sources and the 57.7 MB real sanity check are diagnostic evidence only. Keep #188 frozen pending a narrowed non-regression rerun; diagnostics and each subsequent fix stay in separate PRs. #206 remains an unmerged draft and receives no schema agreement from this gate coordination. This supersedes any earlier permission to resume the data lane while this gate is red. Reason: the red interaction/memory gate remains unresolved and the builder explicitly rejected exceptions.
- **23 October — #207 (CONTENT-5 slice 1) kept despite the PERF-2 hold (Yash):** Yash directed the merge of #207 (UI only, no schema change, full browser gate clean) before seeing the hold above, which Claude had not seen when it claimed CONTENT-5; Yash then chose to keep it merged rather than revert. The hold otherwise stands: no more feature work, and #206 (DATA-3) stays an unmerged draft, until the PERF-2 gate passes on the full real-journal matrix. Reason: the change is isolated to the delegation card and revertable, and reverting would only churn history; it is not a precedent for the next item.

- **21 October — Reasoning state, Claude extras and inline image bytes (review125 S3, S5, D7):** Yash approved building S3 (CONTENT-9), S5 (DATA-4/5/6) and D7 (image bytes only when already inline in the journal; paths stay references). **D7 caps revised the same day after measuring local journals:** at most 4 MiB per image, no count cap, at most 256 MiB of distinct image bytes per recording; anything over shows a placeholder; images load lazily and never travel inside history pages. The first proposal (1 MiB, 32 per recording) would have dropped 196 large Codex screenshots and most images in sessions with up to 384 distinct images (measurements in review125 §9). Harsh reviews each slice in its PR. Reason: these keep facts the journals already hold and the UI currently drops; S3 lets the UI say honestly that reasoning happened but was not saved.

- **16 October — Bounded everyday reading and review:** Keep source-scoped reading locations only in memory, capped at eight sessions/64 slots with existing eight-visit evidence trails. Review continuation uses bounded pages of existing worker-owned derived snapshots, retaining global counts and tied-sequence outcomes. No whole-history browser cache or new capture schema. Real native-account acceptance is assigned to the builder by explicit request. See [81](review/81-workspace-reliability.md).

- **15 October — Modern foundation reset:** The builder explicitly supersedes independent/no-reference Modern: reuse Legacy's full functionality and preserve its agent visualization; modernize only surroundings with scoped styles. Shared code prevents parity drift. See [76](review/76-modern-legacy-foundation.md).

- **15 October - Keep both builders' UI designs:** Canvas, Modern and Legacy remain selectable after PRs #63/#64. Canvas is the new-install default; saved/explicit selections win, fresh links migrate to Modern and Workbench stays retired. See [73](review/73-ui-version-integration.md).

**15 October observation presentation:** The builder's pasted rebuild brief requests an observer-only node canvas with a search/jump field. Make that the default presentation, retain the earlier native workspaces as explicit versions, and keep the capture/data contracts unchanged. Use the requested DOM materials and 2D SVG relationships, local WOFF2 and bounded worker-backed reading. [72](review/72-observation-canvas.md) records the specific scope and qualified validation.

- **11 October — Classic is the active product (48):** The builder preferred Classic's original composition and only Studio's right panel. Consolidate that evidence/tool desk and captured roster into Classic; retain Studio/Legacy as advanced backups. Larger continuous explorer, explicit palettes without System and a neural-eye identity refine the current product. Developer utility and real native lifecycle acceptance take precedence over further theme prototypes. Fresh critique and exact remaining jobs are in [48](review/48-classic-evidence-workspace.md).

- **11 October — two working experiences and complete preview reading:** Studio is a separately composed integrated UI; Classic remains an explicit backup in Settings. Both reuse one captured evidence/motion engine. Source/patch previews expose real scrolling or bounded pages, not unreachable omitted-line counts. Hover caps apply only at rest and both dimensions move together. Fresh reviews support developer evidence utility over decoration alone; review 46 records fixes and remaining jobs. Current Git is separately consented/read-only and cannot certify attribution or atomic disk state. Hosted CI remains publishing-only.

- **10 October — design skills support developer evidence:** Emil's guidance informs hierarchy, source reading, interruption and scoped stress checks; builder/evidence constraints take precedence. Whole-recording Review is explicit and unavailable in replay/combined daemon views. Current source search remains page-local, and chosen patch context remains reachable. Review 42 records implementation and remaining R1–R6 scope. Skills are machine-local, not runtime dependencies.

- **10 October — adoption across developer jobs:** following independent critique and builder direction, visualization and efficient evidence/source reading are both core product work. Prioritize connecting existing review capabilities and improving relevant previews/readers before adding more decorative motion or theme variants. Review 41 orders R1–R6, distinguishes implemented/source-audited/planned coverage, and preserves neutral independent-review prompts plus dedicated angle tests. Git remains a separately designed read-only proposal, not authorization for checkout/stage/commit from the product.

- **10 October — capture wrappers and native truth:** recognize only statically literal awaited Codex patch calls; never evaluate captured JavaScript. Rebuild legacy projections at `r3`, preserve raw observations and redaction, label nested outcomes unknown and proposed artifacts derived. Native model/effort options travel through supported protocols; full access/config mutation remain unsupported. Every prompt is addressable without sampling. Reviews 39 and 40 preserve implemented boundaries and product priorities; hosted CI stays publishing-only.

- **8 October — hover moves with history, superseding viewport pinning:** the builder clarified that fixed means retaining enlarged size, not screen position. Carry the enlarged real card by history scroll deltas; determine retention/return from its moving bounds and cursor position. This supersedes the earlier fixed-hover entry below, which records our mistaken interpretation. Latest section of review/35.

- **8 October — fixed hover reader after scroll:** keep the enlarged card at its viewport allocation through scrolling; only actual cursor movement outside its enlarged bounds triggers pointer return. Scroll-driven source-slot movement or stale browser `:hover` targets cannot dismiss it. Escape/explicit view guards remain; latest clarification in review/35.

- **8 October — scrolling is not motion cancellation:** latest builder feedback keeps finite arrivals/settlement/reflow and hover readers alive through wheel input. A nested hover result consumes its own scroll, then forwards the gesture to history without collapsing the card. Pin its one source passage. Restore the anchor after the gesture, not before the native scroll event; hold the document start independently of virtualized DOM presence. Independent prompt chapter rail, icon composer controls and corner-only search entrance; duplicate native output receipt removed, errors/approvals retained. See review/35. Supersedes the dismissal/cancellation parts of review 34; upward-only Follow stays.

- **8 October — upward-only Follow and compact native work:** latest builder direction overrides click-to-detach rules. Ordinary clicks and downward scrolling preserve camera preference; upward main-history scrolling or explicit off detaches it. Navigation destinations hold until actual new captured work, not measurement changes. New visible motion is independent of following/capture. Compact prompt/receipts, one right-side Follow switch, no second toolbar, known-native-install discovery; conservative native approvals and send-time idle consent remain mandatory. See review/34. Local tests only, no hosted CI.

- **7 October — native continuation explicitly authorized:** the builder requested an actual prompt input and session-correct workspace now, superseding observe-only product scope. Keep passive capture independent and read-only, use separate opt-in supported native protocols, conservative approval/sandbox policy, root consent and idle-client acknowledgement. No arbitrary terminal injection or schema fabrication. Details/limits: review/26.
- **7 October — developer density and graph detail:** use tinted window chrome, content-sized centred/wrapping materials, extension/folder icons, ordinary prompt input and quiet utilities. Current maps derive folder groups before individual files, exclude private `.local` caches, and aggregate only actual imports. Captured model names supersede generic names; usage is native reported data only. Paragraph fades do not delay capture or type characters. Preserve `layout.total` outside padding while virtual runs change; animate growth clip, never virtual layout height.
- **7 October — connected workspace composition:** folders left, compact observed/runtime tools right, one accumulating history with visible recorded-order links, expanded connected file-tile map and agent switches. CodeForge informs crisp black materials/vivid semantic colour/finite fades, not fake typing or causal claims. Current disk reads never replace historical artifacts.

*Append only. Never delete a row — supersede it with a new one.*

**5 Oct amendment:** the builder resumed B4 before further premium experience work. This supersedes the earlier deferral row below; its historical record remains intact.

| Date | Decision | Why | Where |
|---|---|---|---|
| 2026-10-21 | **Other TASKS items continue while the PERF-2 gate is red** | Builder: PERF-2's remaining work (cheaper history renders during live bursts, append + browser memory) is long and architectural, Harsh + Codex hold it and Claude may race it; meanwhile "complete the others" and decide when all is ready. Performance fixes may not cost anything visible. Supersedes the "no new feature while a performance gate is red" hold for now, by explicit builder decision. | TASKS PERF-2; AGENTS.md rule |
| 2026-10-20 | **Nemotron explanation work (EXPLAIN-1…5) moves to P3, after everything else** | Builder: it depends on an external service (key, model ids, cost, latency) that we do not control; build the product first, then this. Existing code stays, off unless `NEBIUS_API_KEY` is set; nothing new is built on it. The 19 Oct decision to drop the hackathon stands. | TASKS (P3, EXPLAIN section) |
| 2026-10-19 | **The Nebius × NVIDIA hackathon is dropped from the active list** | Builder: product first, as fast as possible; the hackathon items (HACK-1…3, the `hack` tag, the 30 Oct deadline) are removed from TASKS. The Nemotron explain work stays as ordinary product items (EXPLAIN-1…5, P1/P2). [`HACKATHON.md`](HACKATHON.md) is kept only as a reference. | `TASKS.md` |
| 2026-10-19 | **Restructured TASKS (tagged P0–P3 + detail); north star and minimalism rule; harness data before more visuals; keep the wrap-plus-arrows passage layout, hover-only toolbox connectors, peek and Workspace as two modes, and the 3D map as aesthetic; Git graph = Sacred Timeline** | Builder corrections to review 122; audit 123 shows reasoning is mostly unrecorded, so the *why* comes only from labelled, cited model output | `TASKS.md`, `review/122`–`124`, `AGENTS.md` |
| 2026-10-14 | **Keep Legacy; build independent Modern and retire Workbench selection** | Builder wants a new coherent developer workspace, not another palette pass; use real dense sessions and meaningful evidence motion. Saved fresh links migrate without losing the selected session. | `review/72-modern-spatial-workspace.md` |
| 2026-10-14 | **Current Git handoffs revalidate the inspected page on both preview and save** | Cached review content can drift before export; retain reading on failures, invalidate the packet and preserve exact previewed text. Shared subprocess deadline/filter overrides keep inspection bounded without an atomic claim. | `review/70-revalidated-git-handoff.md` |
| 2026-10-13 | Recheck raw Git patches, scoped index identities and worktree change markers; four-reader batches per inspection | Status/HEAD miss same-status edits. Bound extra subprocess/memory work, preserve ordering, return 409 rather than mixed evidence; still an optimistic current sample, not a filesystem lock | `review/60-git-consistent-inspection.md` |
| 2026-10-07 | **Normal navigation uses captured prompts; actual DOM material may arrive from a measured origin** | Builder requested whole-box/content travel and removal of ordinary movie controls. Keep finite interruptible real-surface translation/reveal, compact content allocations and adjustable reading; no text copying/scaling/typing or delayed capture. Harness prompting remains a researched, separate controller decision. | `review/24-prompt-workspace.md` |
| 2026-10-06 | **Repository context follows held reading; action widths remain allocated as siblings arrive** | Builder highlighted prototype horizontal flow and prose boundaries. Unrelated latest-file focus and shrinking existing source text make accumulated work harder to understand. Use captured locations, bounded composed actions and explicitly current static imports; preserve live capture and the reader's anchor. | `review/13-reader-context-flow.md` |
| 2026-10-06 | **Keep improving and committing the integrated product; use an explicitly synthetic growing demonstration for visible arrivals** | Builder rejected palette polish and standalone HTML approval as completion. Demonstrate genuine request/result states through the reader's existing data boundary without agent launch, artificial token streaming, future-result exposure or changes to real capture. | `review/12-material-experience.md`, `apps/ui/src/lib/sample-source.ts` |
| 2026-10-05 | **Live evidence appears without a presentation queue; stage the reading camera for bursts and show input before result in one surface** | Fast agents can produce many actions or a long result before a person can read them. Holding the viewport preserves comprehension without adding agent or data latency. Replay dwell applies to the visible step; fake token streaming would misrepresent a final-only journal result. | `VISION.md` §0, `PRODUCT_DIRECTION.md`, `apps/ui/src/components/History.tsx` |
| 2026-10-05 | **Defer long-session paging/worker optimization while product experience work proceeds; do not claim B4 or large-session readiness** | Builder accepts slower/large-memory behavior for now. It can be fixed later, but the current full-projection API and main-thread composition make it an architectural migration; preserve an API seam and stable evidence/history identity. Other release checks remain open. | `IMPLEMENTATION_ROADMAP.md` §7, `review/07-b4-scale-install.md` |
| 2026-09-25 | **`node:sqlite` instead of `better-sqlite3`** (proposal, pending @harsh) | Built into Node 24, so there is no native binary and a clean `npx` install cannot fail on compilers — exactly the risk the clean-install gate guards; FTS5 included. Cost: marked experimental, and one Node line | `packages/store` |
| 2026-09-25 | **`node:http` + SSE instead of Fastify + `ws`** (proposal) | The daemon has zero runtime dependencies; notifications are one-way, so SSE is enough and reconnects natively | `apps/daemon/src/server.ts` |
| 2026-09-25 | TypeScript runs directly on Node 24 (type stripping); backend has no build step | Removes a build pipeline for a two-person team; the only cost is erasable-syntax-only TS | `tsconfig.base.json` |
| 2026-09-25 | Dock groups tools by **kind of action**, with harness tool names listed | Claude's `Read` and a Codex `sed -n` read must come from the same instrument, or the renderer knows harnesses | `packages/scene` |
| 2026-09-25 | Shell commands are classified into read/search/test by a named, versioned rule and shown as **derived** | Codex does everything through a shell; without this its work is all "shell". Never shown as captured | `packages/projection/src/shell.ts` |
| 2026-09-25 | Exports mask local paths **and re-key path-derived ids** | Ids are short hashes of local paths, and a guessable path (`C:\Users\<name>\…`) can be brute-forced back out of them | `apps/daemon/src/app.ts` |
| 2026-09-25 | Model use: explicit action → exact preview → redacted evidence keyed E1…En → uncited claims dropped → "Generated by <model>" | Keeps Nemotron's output on the derived side of the captured/derived line; the "non-obvious use" the hackathon asks for | `packages/explain` |
| 2026-09-21 | **Theme: a clean developer tool** (Linear / Vercel / GitHub idiom) — graphite, flat hairline surfaces, one sans + one mono, GitHub-dark syntax, colour only for meaning; replaces glow pools, blur, grain and serif prose | Builder review of the first prototype: functionality right, look too busy | `docs/VISION.md` §5, `docs/prototype/` |
| 2026-09-21 | Repo workflow: squash-only merges, branches deleted on merge, `CODEOWNERS` auto-requests the other builder, PR template = the non-negotiables, area/`schema`/`decision` labels | Makes "we check each other's work" the default rather than a habit to remember | `.github/`, `AGENTS.md` |
| 2026-09-21 | **`docs/prototype/` is the design reference**, superseding the first storyboard; Read surfaces show abstract ghost shapes, never uncaptured text | A working scene settles design questions faster than prose; showing lines outside a captured range would invent bytes | `docs/prototype/README.md`, `VISION.md` §4 |
| 2026-09-21 | **`AGENTS.md` is the single canonical agent file**; `CLAUDE.md` only imports it | One rule set for both builders' agents: Codex reads `AGENTS.md` natively, Claude Code via `@AGENTS.md` | `AGENTS.md` |
| 2026-09-21 | **`docs/VISION.md` is authoritative for creative direction**; `docs/README.md` resolves precedence between overlapping docs | Replaces a three-level chain of override notices an agent had to decode | `docs/VISION.md`, `docs/README.md` |
| 2026-09-21 | Creative doctrine: **quiet at rest, articulate in motion** — motion spent on relationships and arrivals, never on simulating reading | Reconciles the builder's demand for maximal craft with the review's truthfulness constraints | `docs/VISION.md` §1 |
| 2026-09-21 | Branch `<handle>/<topic>` → PR → other builder reviews → squash-merge | "We both check each other's work"; branch protection is unavailable on a private Free-plan repo (verified: API 403), so review is by convention | `AGENTS.md` |
| 2026-09-21 | Continuous canvas is the default: retained left-to-right action passages, unboxed emitted prose beneath, top agents, right tool/MCP origins and a background map | Explicit user refinement: the composition must accumulate and remain navigable; reading focus must not replace the surrounding work | `docs/reference/04-continuous-canvas.md`, experience spec §2 |
| 2026-09-21 | Review amendments supersede conflicting v1.2 planning claims; schema changes remain proposals | Primary-source research and design review found overstated completeness, causality, competitive and pacing claims | `docs/review/01-product-review.md`, blueprint review notice |
| 2026-09-21 | First gate is the evidence-linked replay interaction; graph benchmark follows | Prove useful comprehension and visual craft before investing in a comprehensive indexer | Review §8–9, engineering §12 |
| 2026-09-21 | Privacy precedes the first real import; historical artifacts need explicit availability | Prevent irreversible sensitive persistence and misleading replay | Engineering §4, §10 |
| 2026-09-20 | Named **Drishya** (दृश्य, "the visible / a scene") | Vantage is occupied in devtools; npm `drishya` verified free | §App. A |
| 2026-09-20 | **Nothing is reused.** Graph engine from scratch, Python + TS only | Existing engines target retrieval, not a timeline with stable layout | §10.6 |
| 2026-09-20 | **TypeScript everywhere**, incl. daemon | One language for a duo; the schema stops being duplicated | §14.5 |
| 2026-09-20 | **`web-tree-sitter` (WASM)**, not native | A failed `npx` on Windows costs a user permanently; slow cold index costs seconds once | §14.5 |
| 2026-09-20 | **No ownership split.** Shared code, mutual review, claim work here | Small codebase; both understanding the whole system beats parallelism | §20 |
| 2026-09-20 | Localhost web app + daemon; Tauri later; never Electron | GPU access, zero packaging, `npx` install | §14.1 |
| 2026-09-20 | PixiJS v8 WebGL2; WebGPU behind a flag | Pixi itself recommends WebGL for production | §14.2 |
| 2026-09-20 | CodeMirror 6, not Monaco | Many small views + one Reader; Monaco is heavy per instance | §14.4 |
| 2026-09-20 | Apache-2.0 + trademark policy | Local-first, no SaaS to protect; AGPL costs adoption | §19.1 |
| 2026-09-20 | **Observe-only.** Drishya never launches or steers an agent | Control makes it a harness, and it loses that fight | §5.4 |
| 2026-09-20 | Replay before live | Replay is the durable job; live is what sells it | §3.1, §20 |
| 2026-09-20 | **Lift** is the signature mechanic — content is lifted out of the map, never faded in | It is the moat made visible in one second | §7.4 |
| 2026-09-20 | GitHub org **`drishya-dev`**, not `drishya-ai` | `drishya` was taken; `-ai` collides with Drishya AI Labs and contradicts the captured-not-generated positioning | §12 |
| 2026-09-20 | Org owned by a **personal account**, both builders as **Owners**, 2FA required | No legal entity; either builder must be able to administer | — |
| 2026-09-20 | Repo starts **private** | Nothing worth showing yet; flip to public at the M1 demo | §18.5 |
| 2026-09-30 | **Live history accumulates independently of reading position; recorded playback is optional** | Builder explicitly clarified that scrolling revisits ongoing work and play/pause is not the final live metaphor; supersedes transport-led defaults | `VISION.md`, canvas contract, `PRODUCT_DIRECTION.md` |
| 2026-09-30 | **Backend hardening + integrated base UI before premium expansion** | Current audit found privacy/recovery/history gaps despite green tests; builder requested a dependable main backend first | `IMPLEMENTATION_ROADMAP.md`, audit |
| 2026-09-30 | **Keep `apps/ui`; port prototype behaviors, not its synthetic playback engine** | Preserve real integration while improving sizing, scrolling, selection and origins; neither UI is final | Product direction §4–6 |
| 2026-09-30 | **Real baseline audit stays in memory until known privacy bypasses close** | Synthetic probes failed for retained base64 siblings and secret object keys; avoids new sensitive persistence while still checking local adapter/reducer behavior | `scripts/validate-baseline.ts`, audit |
| 2026-09-30 | **Prioritize return-to-work comprehension and evidence-linked review** | Live spectacle attracts attention; since-last-visit/file history/verification freshness are testable repeat-use hypotheses, not established demand | Product direction §7–9 |
| 2026-09-30 | **Consumer ChatGPT/Claude chats are separate from coding-harness journals** | Current local adapters and OpenAI conversation-state APIs do not establish generic live access to consumer chat archives | Roadmap §9, research ledger |
| 2026-10-02 | **Privacy policy `p2`:** redact before truncating (window = 4× the string limit); redact object keys, giving colliding redacted keys a ` #n` suffix rather than overwriting; walk fields beside dropped base64 payloads; sanitize envelope `branchRef` (proposal, pending @yash) | Closes the audit's two reproduced bypasses plus the truncation-boundary leak; a collision must never silently drop a captured value | `packages/privacy`, `packages/capture-core` |
| 2026-10-02 | **Model consent binds to a request digest** (endpoint, model, max tokens, messages, privacy and explain versions). No digest → preview only; mismatch → 409 + fresh preview, nothing sent; cache reused only for the same digest (proposal, pending @yash) | Audit A04: the old confirm rebuilt evidence after preview, so live data could change what was sent | `packages/explain`, `apps/daemon/src/server.ts` |
| 2026-10-02 | **Export masks every root in the selection**, including each observation's captured cwd and the dash-joined project-dir form; roots of ≤2 chars are skipped; `harness` stays the first recording's id, while count and times cover all (proposal) | Audit A03; a multi-value `harness` broke UI label/style lookups | `apps/daemon/src/app.ts` |
| 2026-10-02 | **Privacy policy `p3`:** protected-file scope keeps only paths and short labels; shell commands/patches naming a protected file make their output protected; forget reclaims only unshared blobs after the ingest lock; `RecordingSummary.privacyOutdated?` flags older-policy data (proposal, pending @yash; contract field) | Closes the last B0 items; harness result shapes vary, so an allowlist of content keys leaked unexpected fields | `packages/privacy`, `packages/capture-core`, `packages/store`, `packages/ingest` |
| 2026-10-02 | **Capture health is explicit** (`CaptureState`, `RecordingHealth`, `RecordingSummary.health?`, SSE `event: health`). Live tailing coalesces ticks and bounds each turn to one read per source (≤16 MiB, records must fit one read). A harness root that exists but can't be read is a discovery error, not an empty list (proposal, pending @yash; additive contract) | Audit A05/A06/A09: errors were swallowed, ticks queued without limit, and `import --live` was ignored | `packages/ingest`, `packages/contracts`, `apps/daemon` |
| 2026-10-03 | **Recovery contract:** a per-recording revision committed with its data; every SSE connection opens with `sync` (all revisions); viewers compare and reload only if behind. Subscribers >1 MiB behind are dropped. The launch token is valid for the launch; sessions expire (12 h idle, 7 d max), are capped (32, LRU) and can be revoked (proposal, pending @yash; additive contract, schema v2) | Audit A07/A10: missed notices left views stale until the next write; sessions were unbounded and the docs called the token one-time | `packages/store`, `apps/daemon/src/server.ts`, `apps/ui` |
| 2026-10-04 | **The map scans only an approved root** (explicit `graphRoot`, or approving the captured root; never a drive root or home). A cached map reports `stale` from a cheap probe and rebuilds only on request. **Artifact reads are bounded slices** that state totals, cuts and unavailability (B2 contract additions reviewed by @yash; whole-contract freeze remains later) | Roadmap B2: a journal's cwd could make the map scan any folder; maps went stale silently; artifact reads loaded whole blobs and empty text read as "protected" | `apps/daemon/src/app.ts`, `packages/indexer`, `packages/store` |
| 2026-09-30 | **Small docs and low-risk changes go directly on `main`; branch major work** | Builder clarified the preferred workflow after the audit commit. Major code changes still receive the other builder's PR review | `AGENTS.md` |
| 2026-10-03 | **Historical views use a pure as-of projection.** Invocation fields remain at call; result fields/artifacts appear at `op-end`; model evidence uses the same boundary. Passages anchor to captured event IDs, with reader offset preserved in the UI | Final projection data previously leaked into earlier replay frames and positional passage IDs moved when late records arrived | `packages/contracts/src/as-of.ts`, `packages/scene`, `apps/ui` |
| 2026-10-03 | **Combined worktrees remain viewable, with path namespaces and per-recording reconstruction bases.** When no single root is valid, use a captured-path map instead of indexing the first checkout | Rejecting mixed roots broke valid combined export; merging same relative paths or captured bases would imply a false shared file state | `packages/projection`, `packages/ingest`, `apps/daemon/src/app.ts` |
| 2026-10-05 | **Resume B4 now; separate captured writer, derived worker and paged reader** | Builder explicitly requested finishing B4. Full projection rebuilds and browser transfer caused the red scale gates. Keep deterministic fallback rebuilds and truthful global navigation; reference results do not replace physical release validation. | `review/08-b4-history-reader.md`, `IMPLEMENTATION_ROADMAP.md` §7 |

---

| 2026-10-05 | **Proceed to P1 on merged B4 engineering baseline** | Builder requested merging our B4 work and proceeding to P1. Physical release certification remains open. Content shapes and finite origin contours must preserve reader anchors and immediate captured text. | `review/09-p1-content-origins.md` |

## Open decisions

| # | Question | Blocks | Blueprint |
|---|---|---|---|
| 1 | Complete Agent Flow/native-tools task comparison. Source inspection already confirms edit/write snippets and tool results | Workflow differentiation claims; no longer an open question whether any content is shown | `review/04-research-ledger.md` |
| 2 | Trademark clearance for "Drishya", class 9/42 | Commercial use only | §App. A |
| 5 | **Require 2FA for the org.** Currently off (verified). Enabling it removes any member without 2FA, so Harsh confirms his first — then an Owner turns it on in org Settings → Authentication security | Security of a repo that will publish an npm package | — |
| 3 | When do we flip the repo public? Proposed: at the M1 hosted demo. Going public also unlocks free branch protection | Launch timing, enforced review | §18.5 |
| 6 | **Freeze contracts `0.1.0-draft`?** Implemented in `packages/contracts` following engineering plan §3. Needs @harsh's review | Third-party adapters, the frontend | [`CODEBASE.md`](CODEBASE.md) |
| 8 | **Agree the schema additions** in [review 125](review/125-event-schema-proposal.md) §9 (D1–D10: typed-item correlation, usage, images, cost, re-import) | DATA-1, DATA-2, CONTENT-1/2/3 | [`125`](review/125-event-schema-proposal.md) |
| 7 | Accept `node:sqlite` and `node:http`+SSE over the proposed `better-sqlite3` and Fastify+`ws`? (Decisions log, 25 Sep) | Packaging | [`CODEBASE.md`](CODEBASE.md) |

---

## How to update this file

**For humans and agents alike:**

1. **Claim before you start.** One row in *Claimed*. Delete it when you stop. This is the whole concurrency protocol and it is enough for two people.
2. **Overwrite your own "Last session" block.** It is a snapshot, not a diary.
3. **Tick "Next up" only when merged.** A ticked box means the other person can build on it.
4. **Append to "Decisions made" whenever something is settled** that a future agent would otherwise re-litigate. One line, with the why. This is the highest-value part of the file.
5. **If a decision contradicts the blueprint, update the blueprint too** and say so in the decisions row. The blueprint is the source of truth, so it must not go stale — a stale source of truth is worse than none.

### October integration and presentation decisions

**14 October independent frontend:** The builder explicitly requested a new design from concept/backend, without old frontend references. Keep the independent `?experience=fresh` route opt-in and Classic default while evaluating developer utility and visuals. Separate entry/CSS prevents accidental reskin coupling. Review [71](review/71-independent-new-frontend.md) records connected scope, skill/motion decisions, actual-session findings, local tests, Classic hover follow-up and parity/release limits. Harsh PR #61 is merged as `906215e`; do not review/merge it again.

| Date | Decision | Reason | Record |
|---|---|---|---|
| 2026-10-05 | **Reading marks use whole-recording worker facts; store schema 4 combines both prior schema-3 layouts** | P2 could otherwise count only a B4 browser page or omit the normalized clock during integration. Harsh's scope was merged separately after seven green CI jobs. | PR #21; CODEBASE |
| 2026-10-05 | **Timeline position drives semantic motion; consume an arrival only after its measured frame** | Combined views repeat source sequences, and synchronous layout could otherwise lose an arrival before paint. Same-step page loads and rewinds are not new work. | `lib/choreography.ts`, P1 record |
| 2026-10-05 | **Visible repository lens plus background world; qualified fallback when neither node is visible** | A mostly obscured map felt like wallpaper. A second view of the same real geometry makes file origins usable without guessing locations or import/runtime links. Map-off still removes both renderers. | P1 record |
| 2026-10-05 | **P1 is a presentation engineering candidate, not a frozen design or proof of a market moat** | Builder explicitly rejected decorative transcripts and emphasized creativity in theme, colour, motion and comprehension. Human comparison with raw logs remains P2 validation. | VISION; P1 record |
| 2026-10-06 | **Keep essentials visible; left composition is open; retain three fresh design studies** | Builder requested fresh alternatives and full creative exploration. Studio best preserves combined chronology and code width; Relay/Atlas remain useful optional comparison/map ideas, not mandatory parallel apps. | VISION; review/10-p1-design-directions.md |
| 2026-10-06 | **Whole-recording verification is qualified and hidden during sequence replay** | Refresh on live revisions, but never expose later tests as if known at an earlier replay step. Keep the existing endpoint's whole-session contract. | VerificationPanel; P1 browser regression |
| 2026-10-06 | **Studio, Relay and Atlas become task views of one product, integrated in stages** | Builder proposed retaining all three for different applications. Studio follows work; Relay compares agents; Atlas explores files. Share capture/evidence, preserve selection/reading/replay cutoff, and render only the active heavy view. | VISION; review/10-p1-design-directions.md |
| 2026-10-06 | **Petrol ink/jade, copper changes, lilac external tools form the current visual identity candidate** | Builder rejected a dull neutral treatment and wanted recognizable product colour. Use blue-ink Relay and sage-paper Atlas as coordinated task views; keep open reading rails, unboxed prose, measured origins, contrast and finite motion. | VISION §5; review/10-p1-design-directions.md |
| 2026-10-06 | **Older index prototype's bounded surfaces/presentation are preferred; new palettes stay experimental** | Latest builder feedback prefers its boxes and their colours; the new themes are "not that great." Do not treat removal of boxes or the new tint as approved. Keep integrated neutral tokens, retain studies, and use the older material treatment as the next Studio reference. | VISION §0/§5; review/10-p1-design-directions.md |
| 2026-10-06 | One unified visual system; task views independent of charcoal/light theme | Builder rejected per-view palettes and flat rail-only layouts. Original bounded material surfaces guide the next candidate; permanent left lists and panel slabs are not approved | VISION §0; review/11; concepts/canvas |

| 2026-10-06 | Finish the integrated local product before further art-direction iteration | Builder explicitly moved away from standalone HTML studies. Shared themes/task views and global file evidence comparison now form the working baseline; human and physical release checks remain separate | PRODUCT_DELIVERY; VISION |
| 2026-10-06 | External content earns reading space; structured rendering retains original evidence | Actual rendered documentation was squeezed at 300 px; long results now use 560 px without turning every action full width. JSON formatting must not erase null/missing distinctions or hide the source preview | UI presentation/StructuredResult; review/14 |
| 2026-10-06 | Toolbox motion transfers identity, while captured content stays in place | A finite app-owned glyph connects the actual visible instrument to its action header. Bounds/hit-testing suppress hidden glyph origins, and existing interruption/burst gates own the cue | Origins; review/15 |
| 2026-10-06 | Exact stored read opens in place; find searches only the loaded source page | Generic file opening could select a different moment. Returned artifact coordinates and provenance stay authoritative; bounded literal find does not imply whole-file search or current workspace access | History/ArtifactReader; review/16 |


| 2026-10-06 | **Manual final-candidate Actions verification** | Builder requested hosted runs only for explicitly selected final candidates after the 90% organization allowance alert; local checks during development, seven platform jobs retained, no automatic push/PR triggers. See CI_POLICY | CI / both builders |

| 2026-10-06 | **Publishing-only hosted verification; local development commits** | Builder narrowed manual Actions to the finished product at publishing or immediately before it. Keep local code/browser/package checks throughout development; intermediate feature completion must not dispatch hosted CI. This supersedes the earlier selected-final-candidate wording | CI_POLICY / both builders |

| 2026-10-06 | Isolate the integrated ink presentation on its own branch; use both builder references without copying fictional behavior | Builder explicitly requested a separate branch. Clear coloured materials and a wider real repository world preserve meaningful origins; prose stays open. Canonical no-grain/no-blur rules supersede the decorative treatment in PR #37 | review/21; codex/ink-presentation |
| 2026-10-06 | History strip has a strict 400-tick visual budget, even when all operations fail | Failure-preserving thinning could otherwise grow without bound. The sample prioritizes failures while retaining chronology; it is not an exhaustive navigation index | lib/activity.ts; two regression tests |

| 2026-10-06 | Keep finite origin arrivals across passive React updates; reserve a readable curve for travel | Ordinary capture/hover cleanup was erasing cues before they could communicate their relationship. Bounded ownership and geometry/reading interruption preserve truthful, quiet motion | Origins; review/22 |
| 2026-10-06 | Retire redundant standalone HTML studies; preserve docs/prototype references | Latest builder instruction supersedes the earlier retain-every-study direction. Continue the integrated app and keep written historical findings, without alternate production-looking pages | review/22; both builders |

| 2026-10-06 | Finish P1 through the material's actual display, rather than a file-icon animation alone | Builder requested slower, smoother presentation and readable sizing. Actual source readiness, spatial unfolding and late-growth camera holds preserve evidence while making the work readable | review/23; Origins/History |
| 2026-10-06 | Budget staged-burst motion from its beginning | The held camera reads earliest new work; selecting final calls spent animation below the viewport. Capture remains immediate and all work remains accessible, without a playback queue | choreographyBetween; regressions |

| 2026-10-07 | Whole real DOM material zoom is a narrow exception to the former no-scale doctrine | Builder explicitly requested the entire box growing all the way to its final allocation, with smooth reflow. One finite, selectable DOM surface retargets on real geometry changes; no cloned/typewritten text, fake scanning or delayed capture | review/27; Origins/History |
| 2026-10-07 | Local result scrolling preserves live follow; automatic pacing holds preserve active arrivals | Builder asked not to stop the flow while scrolling within a box. Main-history navigation/selection still holds reading, and capture is independent; large-result camera holds are not manual interruption | review/27; History/Origins |
| 2026-10-07 | Repository detail groups spatial density, not only folder hierarchy | Builder rejected folder-card drill-down as a replacement for nodes. Groups preserve measured node positions and real aggregated imports; zoom reveals member files, root config files remain identifiable and folder navigation stays in Explorer | review/27; map-detail/MapCanvas |

| 2026-10-07 | One material arrival and a quieter unified stage | Builder rejected disconnected travel/zoom and redundant chrome. Remove separately timed proxy surfaces; retain one retargetable real DOM transform, vivid compact materials, bottom composer and one spatial dot map that gradually reveals real files/imports. Attachments remain later work. | review/28; Origins/stage/map-detail |

| 2026-10-07 | Retain sequence replay only as a temporary side option | Builder explicitly requested keeping optional replay now and removing its controls and playback functionality at the product stage. Ordinary accumulating history, scroll and captured-prompt navigation remain; do not delete the capture/history data path with the playback transport. | Settings; review/28; CONTINUITY |

| 2026-10-07 | Stable centred work, neutral materials and secondary utilities | Builder requested full-height explorer independent of work, vertically centred tools, one translucent compact composer, icon-only type colour and error-only red contours. Prompt positions supplement ordinary scrolling; replay remains temporary. Hover relocation/multi-agent windows require the documented interaction and native evidence checks. | review/29 |

| 2026-10-07 | Implement the full recent request audit; stop deferring hover reading | Builder explicitly asked to revisit every prompt and work through omissions. Preserve the entire checklist and later native/multi-agent/attachment/release matrix in one shared ledger | review/30; codex/fading-world |
| 2026-10-07 | Whole-card hover zoom, source-near clamped placement, 780 ms transfers | Builder rejected width/height-only hover because content reflow preceded the box; keep one measured real DOM material. Exclude lifted popovers from history reflow and preserve selection/follow | review/30; hover-reading |
| 2026-10-07 | Reserve arrival allocation, then grow after 280 ms settlement | Competing flight/result-size motion looked like a terminal snap. Captured result remains mounted immediately; reading/navigation cancels presentational holds | review/30; material-motion |
| 2026-10-07 | Permit bounded masked edge blur and actual world behind chrome | Builder explicitly clarified progressive translucency at header/composer. Lower-opacity veils preserve reading; low-resource removes blur | review/30; stage.css |
| 2026-10-07 | Discrete truthful outcome tiles and quiet graph context | Summary counts cannot locate failures by runner index; only complete flat numbered captured TAP is indexed. True-import paint budget grows with zoom; hover reveals incident edges, navigation stays at map edges | review/30; test-tiles; MapCanvas |

- **7 October — explicit replay clock and compact prompt:** the builder wants Play to continue during reading, independently of camera follow, and clarified a professional solid prompt instead of transparency. See [31](review/31-independent-replay-reading.md). Capture and as-of truth are unchanged.

| 2026-10-08 | Keep live/replay following through bursts; make reference interactions visibly usable and replace frame-by-frame layout motion | Builder reported persistent lag, missing auto-scroll, opaque-looking navbar and invisible UX additions, and explicitly requested executing 32's map steps. Use faster compositor transforms, one translucent navbar tint, explicit Follow/Activity and on-demand bounded static import navigation. Deliberate reading still holds the camera independently of capture/replay. | review/33; local candidate on harsh/fix-workspace-toolbar |

| 2026-10-08 | Expose honest native progress before captured output; keep reasoning detail local | Builder reported a blank initial turn. Show immediate submitting/connection receipts and genuine native phases; buffer arbitrary token fragments until complete-block redaction and hand receipts to journal evidence using zero-based observation order. Never promise hidden reasoning or silently alter model effort/policy. | review/36 |
| 2026-10-08 | Permit optional bounded perspective orbit, static default | Builder explicitly requested evaluating a rotating 3D background. Reuse canvas projection, white dots, density groups and shared DOM origins; cap redraws and freeze while interacting/reduced motion/low resources. Native permissions/settings synchronization and attachments remain separate next-stage work. | review/36 |
| 2026-10-08 | True spatial map and bounded native attachments | Builder corrected shallow perspective to multi-axis spatial navigation and requested file/folder/screenshot inputs. Use shared GPU/DOM camera math, 12-second manual hold, private inline image transport, text redaction and explicit limits. Conservative native policy remains. | review/37 |


**11 October design decision:** Prior Studio becomes default Classic; a distinct Studio organizes captured working files, continuous materials and an evidence/tool desk. Legacy preserves the older design. Backend evidence/controller engines stay shared; a local real-preview reference never publishes private journals or substitutes synthetic evidence. See [47](review/47-studio-workbench.md).

| 2026-10-16 | Persist bounded navigation metadata, never content or grants | Builder requested recovery after accidental/intentional close. Own-store CAS checkpoints re-fetch source and recheck consent; drafts remain volatile/exportable. | review84; working-locations |
| 2026-10-16 | Modern default with independent overlays and seven semantic palettes | Latest builder HUD/palette direction supersedes earlier three-palette limit. Keep Legacy visualization/backups; correct CSS precedence and collapsed lifecycle feedback. | review85–86 |
| 2026-10-16 | Keep purpose-specific branch commits and local validation | Builder explicitly requires independent backtracking and no hosted Actions until final publication candidate. Final PR merge method remains governed by repository policy. | PR68; review86 |
