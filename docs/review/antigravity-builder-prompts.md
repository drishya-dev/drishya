# Antigravity as a builder: prompts for UI-49, UI-50, UI-47 and UI-48

Yash, 14 Nov: the four UI items go to Antigravity, so that Claude Sonnet stays on LIVE-7 and PERF-4. Paste **the shared preamble plus one item block** into a new Antigravity conversation, one item per conversation.

**Lanes.**
- UI-49 and UI-50 can run at the same time; they touch different files.
- UI-47 runs next, then UI-48. UI-48's wait cards appear inside UI-47's thresholds.

Fable reviews and merges every PR. Antigravity never merges.

---

## Shared preamble (paste first, every time)

```text
You are working in the Drishya repository (drishya-dev/drishya). Drishya is a local, read-only replay and live view
for coding agents (Claude Code and Codex): TypeScript on Node 24, pnpm via corepack, React 19 + Vite in apps/ui,
a zero-dependency daemon in apps/daemon, Playwright browser specs on Edge.

READ FIRST: AGENTS.md (binding rules: claims, definition of done, real-session checks, the creative doctrine and the
ten non-negotiables), docs/VISION.md (how the product must look and move), then your item's full entry in
docs/TASKS.md (search for its ID). The entry is the spec; its Accept list is what done means.

HOW TO WORK
- First action: `node scripts/claims.ts`. Never start an item it shows as CLAIMED, and never edit files another claim
  row lists (LIVE-7 is being built at the same time and owns the daemon's live path and the UI's live merge).
- Claim the item: a docs-only commit on main adding your row to the Claimed table in docs/STATUS.md (ID, "@yash +
  Antigravity", branch, date, the files you will touch). Push it with `git push origin HEAD:main`.
- Work on your own branch `ag-builder/<id>-<topic>` in your own git worktree, with your own
  `corepack pnpm install --frozen-lockfile`. Never share or copy node_modules. Open a DRAFT PR into main after your
  first commit. One TASKS item per PR.
- Before changing UI, run the app and look at the current behaviour first; several odd-looking things are
  deliberate builder decisions (AGENTS.md lists them).
- Every colour comes from a token in apps/ui/src/tokens.css (a paint-policy test fails on any other colour).
  Motion: purposeful, finite, interruptible; nothing loops or pulses; reduced motion is respected.
- Desktop only: the narrowest supported window is 600 px. Do not design or test phone widths or touch.

REAL SESSIONS, NOT THE DEMO
- The demo and the fixtures are regression guards; acceptance is on real local Claude Code AND Codex sessions that
  contain the case. Use `pnpm check:real -- <case>` (`--list` shows cases). It imports into a scratch Drishya home;
  never import into the real one, and never use or kill ports 7878 or 5180.
- Never print, quote or commit real session content. Name sessions by id prefix, size and counts only.
  Screenshots of real sessions stay in .local/ and are never committed.

NEVER
- `git reset --hard`, force-push, or rebase a shared branch.
- Touch tests/browser/workspace-shared-draft.spec.ts, docs/PROJECT_MASTER_DESCRIPTION.md or docs/Logo*.
- Edit harness files (~/.claude, ~/.codex, ~/.gemini) or anything outside this repository.
- Merge your own PR.

CHECKS
- While working: `pnpm check:affected`, plus the named specs:
  `DRISHYA_BROWSER_CHANNEL=msedge DRISHYA_WORKERS=3 node scripts/test-browser.ts <spec files> --retries=0`
  (run `corepack pnpm ui:build` first).
- Done: every Accept line checked on real sessions at 600 and 1440 px, the item's specs green, and 1440 frames of
  untouched screens unchanged.

FINISHING
- In the PR that finishes the item: delete your claim row, tick the item in docs/TASKS.md with a short dated note
  under its entry (what changed, the real sessions as id prefixes and counts, what could not be checked and why),
  overwrite a "Last session" block in docs/STATUS.md, and run `node scripts/sync-tasks.ts`.
- Mark the PR ready only when the Accept list is met. In the PR body: what changed, the files, the real sessions
  checked, the specs run (with counts), and anything not met with its exact reason.
- Commit trailer: Co-Authored-By: Antigravity <noreply@google.com>
```

---

## UI-49 · Narrow windows: the chrome never covers what is being read

```text
YOUR ITEM: UI-49 (docs/TASKS.md, "Narrow windows: the chrome never covers what is being read").

Yash's screenshot, about 600 px wide:
- The session header capsule and the Files/Repository capsule sit over the agent's prose at the top.
- At the bottom, the fading veil covers a Shell card's command and output, while the Tools capsule, the composer
  ("Ask your agent...") and the Follow latest switch sit over it.
His words: "we did 600px tests but this black faded header and footer are still an issue, as well as the content
around there is not proper."

WHY IT MATTERS: Drishya will be embedded in harness apps' side windows (EMBED-1/2), which are this narrow or narrower.

DO
1. At 600, 720 and 900 px, measure the boxes of the top chrome (header, view switch, Files and Repository) and the
   bottom chrome (Tools, composer, Follow latest, the top and bottom veils).
2. Reserve that space in the reading column (padding and scroll-margin), so the newest row and the row being read
   never rest under chrome.
3. Make the veils fade only empty margin, never text being read.
4. Capsules that would collide share one row or stack neatly.
5. At 1440 px and wider, nothing changes (compare frames pixel for pixel).

START by finding where the stage, the veils and the capsules are laid out (apps/ui/src/modern/*.css, the stage and
history layout components); read UI-37 and UI-45 in TASKS (sizes and side panels) so you do not undo them.

ACCEPT
- On real Claude Code and Codex sessions at 600, 720 and 900, plus 1440 unchanged, no line of text or card control
  sits under a capsule or inside a veil's opaque part. Check this at rest, scrolled to the bottom, and
  mid-history, with the Files panel open and closed.
- A new browser spec measures the overlap: the bounding boxes of the chrome against the visible text and card
  controls.
- Frames before and after, kept in .local/.
```

---

## UI-50 · Text formatting handled the same everywhere

```text
YOUR ITEM: UI-50 (docs/TASKS.md, "Text formatting handled the same everywhere").

Yash's screenshot: a Shell card's output is a Markdown table (the agent printed it with `node table.cjs`). In the card
the rows wrap mid-row and read as broken text. His words: "the same handling we did for normal text, but not done in
boxes, now this also tells that maybe all things are not handled at both the places, and maybe others as well, all
types of text formatting, we should also do that part."

THE RULE YOU MUST KEEP: captured ≠ derived (AGENTS.md, non-negotiable 4). Content that IS Markdown by where it comes
from is rendered (agent prose, plans, .md file previews). Captured command output stays literal: shell stdout is
never re-rendered as Markdown. Literal output must still be readable: it keeps its line structure.

DO
1. Build a matrix of formatting × surfaces and check every cell:
   - formatting: headings, lists, task lists, tables, code blocks, inline code, links, quotes, emphasis, rules,
     long unbroken lines, ANSI colours, tabs;
   - surfaces: agent prose (Work and Conversation views), plans, questions, sub-agent results, MCP and web text
     results, Write and Edit previews of .md files, shell and terminal output, file peek.
2. For each cell, decide rendered or literal by provenance, as above.
3. Literal output: wide or table-shaped blocks scroll sideways inside their card rather than wrapping mid-row. Keep
   UI-46's rule that a collapsed preview ends on a whole line (read UI-46 in TASKS and
   docs/review/ui-46-card-content.md first; it just changed these card bodies).
4. Rendered Markdown looks the same in prose and in cards: one renderer, one style. Where a card renders Markdown
   differently from prose, make it use the same one.

ACCEPT
- The matrix in docs/review/ui-50-formatting.md, each cell checked on a real Claude Code and a real Codex session, or
  recorded as "not present in any local session".
- The screenshot's case (a Markdown table printed by a shell command) reads as aligned rows.
- Units for any renderer change.
- A browser spec for a table in prose, in a plan card and in shell output.
- Frames at 600 and 1440, kept in .local/.
```

---

## UI-47 · Loading messages that match the wait

```text
YOUR ITEM: UI-47 (docs/TASKS.md, "Loading messages that match the wait"). Read its full entry; it is the spec.

Yash: "for somethings like git graph, it takes a lot of time to load the first time, so ask the user to wait and not
close the window, similarly other components give proper messages according to the state and how much time they
take, if less time than they will wait, but if more than proper message."

DO
1. MEASURE FIRST: the first and the repeat load time of every surface that waits: the Git graph, Changes, Compare,
   Files and its first index, peek, Workspace, search, opening a large session, Home's session list, Usage. Use
   real sessions and repositories of both harnesses, and put the table in the PR (ids and sizes only).
2. The rule, from those numbers:
   - under about 400 ms: show nothing;
   - up to about 2 s: show the surface's quiet placeholder (UI-48 will shape it; for now keep whatever placeholder
     the surface has);
   - beyond that: one plain line saying what is happening and, only where it is true, that it is a one-time cost.
     For example: "Reading this repository's history for the first time. This can take a minute; you can keep
     working, but leave the window open."
3. Real progress only when it is actually measured, never a fake bar.
4. A failure says what failed and offers a retry.
5. One small shared mechanism (a hook or component with the thresholds), not a copy per surface.

ACCEPT
- Every listed surface follows the rule, checked on real sessions at 600 and 1440.
- A deliberately slowed load (throttle in the browser spec) shows the message; a fast one never flashes it.
- The messages are in Drishya's plain voice (short, no exclamation marks, no "Oops").
```

---

## UI-48 · Wait cards (after UI-47 merges)

```text
YOUR ITEM: UI-48 (docs/TASKS.md, "Wait cards"). Start only after UI-47 has merged into main; build on its thresholds.

Yash: "proper wait cards, i heard that wait cards also impact the user experience."

DO
1. Each surface that waits shows a placeholder in the shape of what is coming: History rows and cards at their
   measured heights, the Git graph's lanes, Files rows, a reader's lines, Home's session rows.
2. Placeholders use the surface's own tokens. No shimmer or loop that pulls attention (doctrine 1): at most one
   quiet fade in, one quiet fade out. MOTION-4 refines the motion later, so keep it in one place it can tune.
3. The content replaces the placeholder in place: nothing moves when it lands.
4. Reduced motion and the low-resource mode show a static placeholder.

ACCEPT
- Layout shift is 0 when the content lands, measured (CLS) on real sessions in a browser spec.
- Frames of each surface before, during and after loading at 600 and 1440, kept in .local/.
- The ten-minute test still holds: after ten minutes of real reading, nothing distracts.
```
