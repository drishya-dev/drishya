# Antigravity as a third harness: instructions for Codex

Yash, 13 November. Paste the block below into Codex (ChatGPT) to start the work. Everything it needs is in this repository; the block only sets the boundaries.

**Why it matters.** Antigravity has been free on student plans, so many students use it, along with some professionals. Supporting it reaches new developers and part of the main market alongside Claude Code and Codex.

**Release rule.** This work lives on its own branch. It joins `main` only if AG-1 to AG-5 are accepted there before Release 1 ships and Yash says so; otherwise it ships in the next version. Nothing in it may change how Drishya behaves for Claude Code or Codex sessions.

---

## The prompt

```text
You are working in the Drishya repository (drishya-dev/drishya). Drishya is a local, read-only replay and live view
for coding agents. It already supports Claude Code and Codex. Your job: add Google Antigravity as a third, passive,
read-only harness, and change nothing else.

READ FIRST, IN THIS ORDER
1. AGENTS.md — the binding rules (claims, definition of done, real-session checks, non-negotiables 1–10).
2. docs/review/antigravity-harness.md — the research: where Antigravity stores sessions, formats, the record → operation
   mapping, what can and cannot be shown, redaction, schema impact, risks.
3. docs/TASKS.md, section "HARNESS-AG" — the build items AG-1 to AG-6, each with Files, Do and Accept. AG-1 to AG-5 are
   the scope; AG-6 is optional.
4. docs/CODEBASE.md ("how to add a harness") and packages/adapter-codex (the closest existing adapter).

BRANCHES — THIS WORK STAYS OFF MAIN
- Create the integration branch `codex/harness-antigravity` from the current origin/main. All Antigravity work merges
  into it, never into main.
- Each item gets its own branch from the integration branch (`codex/ag-1-adapter`, `codex/ag-2-product`, ...) and its
  own PR whose BASE IS `codex/harness-antigravity`. Open it as a draft after the first commit.
- Bring main in by merging origin/main into `codex/harness-antigravity` at least once a day and before each item PR
  is marked ready (merge, do not rebase or force-push a shared branch).
- When AG-1 to AG-5 are accepted, open ONE pull request from `codex/harness-antigravity` into main, marked ready, with
  the acceptance summary. Do not merge it: Fable reviews, Yash decides whether it goes into Release 1 or the next version.
- Claims are the one exception: claim each AG item with a docs-only commit on main, as AGENTS.md says
  (`node scripts/claims.ts` first). Delete the claim row in the item's PR to the integration branch, and
  tick nothing on main until the whole branch merges.

WHAT YOU MAY CHANGE
- New files: anything under `packages/adapter-antigravity/`, `fixtures/synthetic/antigravity/`,
  `scripts/real-cases/antigravity*.ts`, new tests for these.
- Existing files: ONLY the ones each AG item lists under "Files", for the reason it gives. If you find you need another
  existing file, stop and write in the PR which file, which lines and why, before changing it.
- AG-2's harness-name sites (Home counts, the Harness filter, library search, the server allow-list, the store's
  harness lists, native-action guards) are the only product UI you touch. Add Antigravity beside Claude Code and Codex;
  do not restyle, move or rename anything. Every colour comes from a token in apps/ui/src/tokens.css (paint policy test).

WHAT YOU MUST NOT CHANGE
- The Claude Code and Codex adapters, their parsers, fixtures, real-case scripts or golden scenes.
- Layout, typography, motion, palettes, the map, History, the composer, Files, Workspace, Git views, Settings, the site.
- The event schema, except the additive items named in TASKS (correlation basis 'call-order'; image omission
  'referenced-file'; a plan-artifact observation only after Yash and Harsh agree). No renames, no removals, no changed
  meanings. If an addition lands, CONTRACT_VERSION and the reducer version move together and golden scenes are
  regenerated, with the reason in the PR.
- Runtime dependencies of the daemon (it has none; keep it that way: no protobuf or SQLite packages, use node:sqlite).
- tests/browser/workspace-shared-draft.spec.ts, docs/PROJECT_MASTER_DESCRIPTION.md, docs/Logo*.

SAFETY AND PRIVACY (non-negotiable)
- Antigravity files are opened READ-ONLY. SQLite only as `file:<path>?mode=ro&immutable=1`. No -wal/-shm may appear.
  Never write, rename, lock or touch anything under ~/.gemini or %APPDATA%\Antigravity.
- Never read the paths the research lists as never-read (daemon hub_*.json, the browser profile, mcp_config.json,
  installation_id, machineid, %APPDATA%\Antigravity\). Enforce it with an allow-list and a test per path, including
  media URIs that resolve outside the conversation's own folder.
- Redact before persisting: everything passes seal() in the ingest path, before SQLite, blobs, search, export or screen.
- Drishya never starts, steers, approves or answers anything in Antigravity. Its sessions open with no composer and a
  one-line "Read-only: Antigravity cannot be steered from Drishya".
- Never print, quote or commit real conversation content. Name real sessions by id prefix, size and counts only.
  Screenshots of real sessions stay in .local/ and are never committed.
- Use a scratch Drishya home for every real import (pnpm check:real), never the user's real one.
- Run your own `corepack pnpm install --frozen-lockfile` in your own worktree; never share node_modules.
- Never `git reset --hard` in a shared checkout.

DONE MEANS (per item, from AGENTS.md)
- The item's Accept list is met on REAL Antigravity sessions at 600 and 1440 px; fixtures are regression guards only.
- Claude Code and Codex do not regress: before marking any PR ready, run typecheck, all units, and the browser specs that
  cover Home, library search, harness filters and session opening, and say which ran. Before the final PR into main, run
  the full gate once on the integration branch (`DRISHYA_WORKERS=3`, UI rebuilt first) and report the counts.
- A case no local session has is produced in AG-5 with a real signed-in Antigravity, or listed as not run with the
  reason. Never claim a case you did not see.

ORDER
AG-1 (adapter, discovery, import) → AG-2 (product identity) and AG-3 (live tail) in parallel → AG-4 (images, plan
artifacts, thinking: after the builders' decisions) ; AG-5 alongside, needs Yash's signed-in Antigravity. Smallest
useful cut if time runs short: AG-1 + AG-2.

Commit trailer: Co-Authored-By: Codex <noreply@openai.com>
```

---

## For the reviewer (Fable)

- Each item PR targets `codex/harness-antigravity`; check its diff touches only the files its TASKS entry lists.
- Before the branch merges to main: `git diff origin/main...codex/harness-antigravity --stat` must show no Claude Code or Codex adapter, schema rename or UI styling change; Claude Code and Codex real-session acceptance is re-run; the full gate is green or its failures reproduce on clean main.
- The decisions it needs (images: reference only or copy; thinking label; the schema additions) are Yash's and Harsh's, recorded in the STATUS decisions log.
