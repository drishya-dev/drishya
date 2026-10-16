# 83 — Review of the feature audit, and a plan for its top five

16 October 2026 · Harsh with Claude (Opus 5.5) · review and plan only

Reviews [82-feature-audit.md](82-feature-audit.md), written by Codex the same day at
`b3184bd`. Part 1 checks its claims against the code at that commit. Part 2 turns its
five recommendations into ordered tasks, each with a "done when". No source code was
changed.

## Part 1 — Review of the audit

### Verdict

**Accept.** None of the 25 statuses is wrong, the totals are right, and the
recommendations respect the non-negotiable constraints in `AGENTS.md`. The notes
below sharpen two recommendations and fix one filing problem. None of them changes a
status.

### How it was checked

| Check | Method | Result |
|---|---|---|
| Every cited file, function and test title exists | Script resolving all 151 references in the table at `b3184bd` (same as `HEAD`) | 151 of 151 found |
| The 9 "not built" items really have no implementation | Searched `apps`, `packages` and `tests` for each feature's terms (blame, tripwire/force-push/skip markers, loop/repeated command, report card, symbol extraction, ledger/copy-as-script, commit/PR links, density, `Notification`, `?` shortcut) | No implementing code found. Each search hit was read: `reduce.ts:838` and `scene/src/index.ts:273` use "same command" only to clear an old test failure; "compact" in `lib/presentation.ts` is a card shape; "ledger" in `adapter-claude` is a tool name |
| Active entry claim | Read `apps/ui/src/main.tsx` and `modern/entry.tsx`; searched for importers of `FreshApp` and `PresentationSettings` | Confirmed: `main.tsx` loads `classic-entry` or `modern/entry.tsx`, and the latter reuses `App`. Only `fresh/` imports `FreshApp` and `PresentationSettings` |
| Totals | Recounted the table | 2 built, 14 partly built, 9 not built. Proposals: 0 / 11 / 7. Polish: 2 / 3 / 2 |
| Cited unit tests | `npx vitest run` on the 16 cited unit test files | 16 files, 125 tests passed. The cited Playwright specs were **not run** |

Detail claims spot-checked against the code:

| Item | Claim | Evidence | Holds |
|---|---|---|---|
| 5 | Write overlap is a projection link, not a live service | `reduce.ts:820`, relation `observed-write-overlap` | Yes |
| 10 | File history is paged in 24-action pages | `FileHistory.tsx:58,67,110` | Yes |
| 12 | Search covers only the selected or `+`-joined recordings, 50 hits each, no cursor | `server.ts:320-323`; `Store.search` filters on `recording_id` (`store/src/index.ts:638`) | Yes |
| 12 | The index is bounded | `searchableText` keeps 20,000 characters per field (`store/src/index.ts:704-708`) | Yes |
| 12 | Home filters on title and root, not evidence | `Home.tsx:74-81` | Yes |
| 13 | The active UI has no bookmark create or browse journey | No `bookmark` reference in `apps/ui/src` outside `fresh/` | Yes |
| 14 | `OperationDetail` has no shell cwd or duration | `contracts/src/index.ts:244` | Yes |
| 16 | The passive Codex adapter ignores token records; the projection has no usage | `adapter-codex/src/index.ts:49,54`; no usage or token reference in `reduce.ts` | Yes |
| P1 | The palette shows up to 40 matches | `WorkspaceNavigation.tsx:43,49,69` | Yes |
| P4 | The timeline is sampled to 400 marks | `lib/activity.ts:4` | Yes |
| P5 | Themes are Jet Black, Midnight and Paper | `ProductShell.tsx:63-66` | Yes |
| P6 | Workspace memory is a `WeakMap` that does not survive a restart | `lib/workspace-memory.ts:20` | Yes |

### Notes that sharpen the recommendations

1. **The command ledger's cwd column differs by harness.** Codex shell calls already
   carry the per-command `workdir` in the captured tool call
   (`adapter-codex/src/index.ts:107`), and `reduce.ts:205` reads it to resolve
   paths. It is dropped only when the operation detail is built
   (`contracts/src/index.ts:244`). Claude `Bash` and `PowerShell` calls carry no cwd
   (`adapter-claude/src/index.ts:84-86`), so Claude rows have only the session root.
   For Claude, the column must say "session root" or "unknown", never present the
   root as the command's cwd. Duration has the same split: `parseShellOutput` fills
   `durationMs` only for Codex results whose metadata includes it.
2. **Bookmarks are closer than they look.** The daemon and store path already has a
   working client: the retired Fresh screen's "Save at this point" button calls it
   (`fresh/api.ts:59`). The status is still correctly "partly built" for the active
   UI, but reviving the journey costs less than building it.
3. **All-recordings search must be a new query.** The current handler searches by
   splitting `+`-joined IDs from the URL (`server.ts:322`). Passing every recording ID
   through that route would be unbounded. Task T3 below therefore asks for one
   FTS query without the `recording_id` filter, behind the store.
4. **Filing.** The audit was first saved as `21-feature-audit.md`, a number already
   used by `21-integrated-ink-workspace.md`. It has been renumbered to 82, the first
   free number.

## Part 2 — Plan for the top five

### Build order, and why it differs from the ranking

The audit ranks by value. This plan orders by dependency, because three of the
five read the same command rows:

| Order | Task | Size | Needs | Can run alongside |
|---|---|---|---|---|
| T1 | Command ledger | Small | — | T3 |
| T2 | Tripwires, first slice | Medium | T1 rows for command rules | T3 |
| T3 | Cross-session search | Small | — | T1, T2 |
| T4 | Repeated-work signals | Small | T1 rows | T5 design |
| T5 | Turn report cards | Medium | T1, T2, T4 for their columns | — |

Tripwires remain the highest-value item; they come second only because their
command rules should read T1's rows, not a second command parser.

### Rules for every task

These come from the audit and `AGENTS.md`, and every PR is checked against them:

- Global queries run behind the existing worker and store boundary. The resident
  browser window is never reported as a whole-session count.
- No observation schema change. A derived response type is allowed; a new captured
  field is not.
- Observe-only: no Run button, no agent steering, no model calls, no telemetry. All
  text is DOM.
- Captured, derived and unknown values are labelled separately. No result implies
  "safe", a cause, or test coverage.
- Each task is one PR with unit tests, a daemon test for any new endpoint, and one
  Playwright journey on a fixture.

### T1 — Command ledger

**Goal:** one paged table of every captured shell and test command in a recording,
with its outcome, output and available context.

**Done when:**

1. A pure function turns a recording's operations into rows: operation ID, agent,
   kind (`shell` or `test`), exact command text, exit code, status, output
   artifact, `cwd` with its basis (`captured`, `session root` or `unknown`) and
   `duration` with its basis (`captured`, `derived interval` or `unknown`).
2. A read-only daemon endpoint serves the rows through the history worker, with a
   cursor and a page cap. It returns the whole-recording total, not the loaded
   window's.
3. The table filters by status (failed, passed, unknown), kind, agent and text, and
   opens from the command palette.
4. Selecting a row opens that exact operation and its output artifact.
5. Copy-as-script works only on deliberately selected rows whose command is
   complete. A truncated preview is never copied. It warns when the selected rows
   have different or unknown cwds or unknown outcomes.
6. Tests: unit tests on Codex and Claude fixtures, including a truncated command
   and a missing exit code; an endpoint test for bounds and validation; a
   Playwright journey that filters to failed commands and opens one's output.

**Out of scope:** export across sessions, a Run button, schema changes.

### T2 — Tripwires, first slice

**Goal:** flag captured evidence that deserves a human look, with the exact match
shown.

**Done when:**

1. A pure, versioned matcher returns, for each hit: rule ID, rule version,
   operation and observation IDs, the matched text and range, and any limitation
   (for example, "redaction may hide matches").
2. The default rules cover three groups:
   - Paths: CI configuration, lockfiles, auth or secret-like paths, migrations.
   - Command patterns (read from T1 rows): force-push, `git reset --hard`,
     recursive delete, package publish.
   - Edit hunks that add or remove test-skip markers: `.skip`, `.only`, `xit`,
     `it.todo`, `@pytest.mark.skip`.
3. An optional local JSON rule file is validated: bounded rule count and size,
   literal or glob patterns only, no executable rules or unbounded regexes.
4. The worker evaluates rules per recording revision and caches the result by
   revision and rule version. A read-only, paged endpoint serves the hits.
5. A tripwire section in `EvidenceReview` lists the hits, each opening its exact
   evidence, and T1 gains a tripwire column.
6. Wording is factual: "patch added a skip marker" or "matched rule X". With no
   hits, it says "no rule matched in the captured, redacted evidence", never "safe".
7. Tests: unit tests per rule, including negatives; a worker test; a Playwright
   fixture with a force-push and a lockfile edit that shows exactly two hits.

**Out of scope:** a custom rule language, assertion-value checks, notifications.

### T3 — Cross-session search

**Goal:** answer "where did we touch this last week?" across all locally imported
recordings.

**Done when:**

1. The store has one FTS query without the per-recording filter. It returns
   recording ID and title, observation ID, snippet and source time, with a cursor
   and a result cap.
2. A read-only endpoint exposes it, with filters for project root, date range and
   harness.
3. Home gets an evidence search entry, separate from its title filter. A result
   opens the exact captured point in its recording.
4. The UI states the result cap, and that the index covers bounded, redacted text,
   not every artifact in full.
5. Stale responses are ignored, reusing the `Search` component's handling.
6. Tests: a store query across at least two recordings with paging; endpoint
   validation and bounds; a Playwright journey from Home to a hit in a second
   recording.

**Out of scope:** structured "this command failed" queries (later, on T1 rows), an
index migration.

### T4 — Repeated-work signals

**Goal:** surface repetition worth a glance, without claiming anything about the
agent's state.

**Done when:**

1. A pure function over T1 rows and captured write references takes an injected
   cutoff and thresholds and returns hits with stable IDs:
   - "same captured command failed N times": exact text, same agent and same cwd
     basis.
   - "same file edited N times" within a turn.
2. With missing or incomparable timestamps, a hit reports a count of operations,
   not a time span. Capture gaps are never counted as inactivity.
3. The worker caches the hits by revision. An opt-in, quiet list in the active UI
   opens the occurrences of each hit.
4. A unit test asserts that the labels contain no "stuck", "no progress" or
   "wasting".
5. Tests: unit tests showing that different cwds are not merged and gaps are not
   counted; a Playwright fixture with four repeated failures.

**Out of scope:** revert cycles, OS notifications, any intervention.

### T5 — Turn report cards

**Goal:** a factual index of what each prompt produced in one session.

**Done when:**

1. A pure per-agent turn summariser follows a documented boundary rule.
   Operations it cannot assign confidently are listed as "unassigned".
2. Each turn row shows:
   - the captured prompt reference;
   - operation counts by kind and files changed;
   - test runs and the last failure;
   - failed commands (T1), tripwire hits (T2) and repeat signals (T4);
   - an interval, only when both of its boundaries were captured.
3. A worker query feeds a paged, sortable table for one session. A row opens its
   prompt in history.
4. Derived numbers are labelled separately from the captured prompt text. There are
   no quality scores.
5. Tests: unit tests for overlapping turns, helper agents, an operation finishing
   after the next prompt, and missing timestamps; a Playwright journey that sorts by
   failures and opens a turn.

**Out of scope:** cross-session comparison, prompt-effectiveness scores.

## Limits of this review

The statuses were checked statically, and with the cited unit tests. The cited
Playwright specs were not run, and no feature was exercised in a browser.
"Not found" means the searches above found nothing in `apps`, `packages` and
`tests`. The sizes are the audit's estimates, carried over.
