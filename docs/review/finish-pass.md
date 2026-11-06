# The finishing pass: audit, UI and motion together, one component at a time

Builder direction, Yash, 6 November 2026. This document is how the FINISH items in [TASKS](../TASKS.md) are run. It replaces "three separate passes" for everything still open. AUDIT-1, UI-8 and MOTION-1 found and fixed a lot. Yash's own ten minutes on 5 November still turned up a basic composer, unreadable menus, wasted facts, motion that opens but does not close, and a Home that "looks terrible". The answer is not a fourth pass over everything. It is to **finish each component once, to the fullest: its features, its presentation and its motion, decided together.** After that comes one integrated pass over the whole.

## Why components, and why all three lenses at once

- **One decision, not three.** A separate audit, UI pass and motion pass each decided part of a component and handed the rest on. The handoffs are where the 5 November findings came from: a menu restyled without its close motion, a fact kept because the UI pass did not own the decision to drop it.
- **Finished means finished.** When a component's FINISH item merges, it meets the premium bar in every state, at every supported size, opening and closing. Nobody returns to it except in the integrated pass.
- **Foundations first.** Every component uses the same menus, selects, popovers, buttons, inputs, motion tokens and layout rules. Those are finished first (FINISH-0), so each later component is built on them rather than inventing its own.

## The order

| # | Item | Covers | Absorbs |
|---|---|---|---|
| 0 | FINISH-0 Foundations | Type, spacing, colour roles per palette, radii, hairlines. Buttons, icon buttons, menus, dropdowns and selects (no native `<select>`), popovers, tooltips, inputs, toggles, segmented controls, tabs, disclosure, scroll areas, focus rings, key hints, empty, loading and error states, notices. Motion tokens, each enter paired with its exit. Layout rules: reading measure, what grows on wide screens, zoom. | MOTION-4, LAYOUT-1's rules |
| 1 | FINISH-1 Home | First screen, repositories, Running now, sessions, import, empty first run | HOME-3 follow-ups (after #347) |
| 2 | FINISH-2 Header, session menu and Usage | Agents strip, session menu, Usage and context, theme entry | UI-29, USAGE-1 (except the #344 schema decision), LIVE-4b's visibility note |
| 3 | FINISH-3 Conversation | Prompts (capsule), agent prose and Markdown (tables, code, links, lists), "reasoning not recorded", notices, plans, questions, prompt images | UI-27, CONTENT-16, CONTENT-17, FILES-12 |
| 4 | FINISH-4 Composer and approvals | Prompt box, attachments, model and effort menus, Connection & permissions, native approvals and questions, queued prompts | UI-28, CONNECT-3 (after CONNECT-2, #348) |
| 5 | FINISH-5 Action cards | Every action type's card: read, edit or patch, write, command and test runs, search, web and browser, MCP, images and screens, sub-agents, todo and plan, failures, declined, stored results, Expand and Inspector | — |
| 6 | FINISH-6 History flow and live motion | Passages, Lift, Emit, Settle, Surface and Resolve, connector lines, Follow and Back to latest, turn folding, prompt rail, scrolling | LIVE-6, FLOW-1 |
| 7 | FINISH-7 Toolbox | Dock, instruments, MCP drawers, the floating window | After TOOLS-2 (#349, Harsh) |
| 8 | FINISH-8 Files rail, peek and Inspector | Side explorer, file peek tabs, evidence marks | — |
| 9 | FINISH-9 Workspace | File-work window, editor, drafts, compare with disk, Original | — |
| 10 | FINISH-10 Git review and history | Review, graph, branch header, patches, access consent | — |
| 11 | FINISH-11 Search, palette and review tools | Library and session search, command palette, Prompt overview, Changes, Findings, Saved moments, session compare | — |
| 12 | FINISH-12 Replay, settings, themes, Screen view and map | Transport, settings window, palettes, Screen view, the 3D map's chrome | — |
| 13 | FINISH-13 The whole product | All sizes and zoom levels, transitions between surfaces, the freeze, truth and ten-minute tests, then MOTION-3's evaluation, and AUDIT-1 closes with the ranked list | LAYOUT-1's acceptance, MOTION-3, AUDIT-1 |

UI-26 (one stylesheet layer behind a pixel guard, Harsh) is **paused until FINISH-12 merges** (Yash, 6 Nov). A pixel guard fights a pass whose purpose is to change pixels. After the pass, UI-26 consolidates the stylesheets and guards the finished look.

## How one component is finished

**Opus (the coordinating session): audit, decide, specify, verify.**

1. **Read** the surface's AUDIT-1 rows (including the open UI-8 findings Z1, Z2, Z4, Z5, N6, N7, N8 and V1 where they belong), the ledger in the [UI pass brief](ui-pass-brief.md), the items it absorbs, and [VISION](../VISION.md) §8.
2. **Walk it as a user** on real Claude Code and Codex sessions that contain each case. Follow the depth standard in TASKS (AUDIT-1, "Depth, Yash, 5 Nov"):
   - every state: empty, one, many, long, failing, live, loading;
   - widths 600, 1440, 1920 and 2560 px, and browser zoom 80 % and 125 %;
   - every palette;
   - each open and each close, in slow motion.
   
   Compare it with the same surface in Claude Code's desktop app, ChatGPT and Codex.
3. **Use the lenses.** These skills are installed in `~/.claude/skills`:

   | Skill | What it is used for |
   |---|---|
   | Impeccable `critique` | Ranked UX findings first |
   | Impeccable `audit`, `harden`, `clarify`, `layout`, `typeset`, `distill`, `polish` | Accessibility, edge cases, copy, spacing, type, removing what isn't needed, final finish |
   | `emil-design-eng` | Composition and the invisible details |
   | Taste's `copy`, `system`, `motion` and `layout-v4` references | Rules for app screens |
   | `break-ui` | Worst-case data |
   | `review-animations` and `animate` | Every transition, opens and closes |
   | `apple-design` | Touch feel, springs and interruption |

   Two of these were installed in reduced form:
   - Impeccable has its Markdown only, with no launcher, hooks or detector. Its "launcher unavailable" path applies, and it never writes `PRODUCT.md`, `DESIGN.md` or `.impeccable/` into this repo. The detector runs only through `npx impeccable detect --cdp`, as on 1 November.
   - Taste has its rules only, no generator.

   Doctrine wins over any skill: no labelled boxes, no glow, motion only where it carries origin, relationship or change.
4. **Write the spec** in `docs/review/finish/finish-<n>-<slug>.md`:
   - what the component is for and what the developer must understand there;
   - the ranked findings;
   - each decision with before, after and why;
   - exact values (tokens, sizes, spacing, copy);
   - a states table;
   - a motion table where each open has its close: property, from and to, duration, curve, origin, interruption, reduced motion and low resource;
   - the facts removed, and why;
   - the acceptance list, with the real-session cases each line needs.
   
   For a large visual decision (Home's concept, the composer, the conversation layout), first show Yash two or three rendered concepts as an artifact, and spec the one he picks.
5. **Verify the build** against every acceptance line:
   - real sessions of both harnesses, at 600 and 1440 px plus the wide sizes and zoom;
   - every palette;
   - motion stepped frame by frame;
   - the lenses re-run on the result.
   
   Send fixes back to the builder. Mark the PR ready only when every line holds. Harsh reviews; the PR is squash-merged.

**Sonnet (a builder session per component): build exactly what the spec says.**

- Start fresh with the spec as its brief (`claude-sonnet-5-5`). It works on branch `claude/finish-<n>` in its own worktree, runs its own `corepack pnpm install --frozen-lockfile`, and never shares `node_modules`.
- It builds the spec. It does not change the design. A spec that cannot be built as written comes back to Opus as a question.
- While working it runs `pnpm check:affected`, the named browser specs and `pnpm check:real -- <case>`. It opens a draft PR after its first commit, keeps screenshots in `.local/`, and ends commits with its own `Co-Authored-By` line.
- A component too large for one session is split into spec parts, with a fresh session for each. The spec file holds the state, so a new session loses nothing.

**Pipelining and limits**

- While Sonnet builds component *n*, Opus walks and specs *n+1*.
- At most two builders run at once, and never on the same files.
- FINISH-0 merges before any other component is built, because everything rebases on it.
- The full gate runs once per batch, in `.local/wt-gate` and in the background: after FINISH-0–2, 3–5, 6–9 and 10–13.
- After each component, Opus updates this document's progress table and the STATUS handoff, so compaction loses nothing.

## Acceptance common to every FINISH item

- Every state of the component, on real Claude Code and Codex sessions that contain it (id prefixes, sizes and counts only; screenshots stay in `.local/`).
- 600, 1440, 1920 and 2560 px, and 80 % and 125 % zoom: no dead gaps, no line past a readable measure, nothing under the 11 px floor.
- Every palette.
- Each control opens and closes with matching motion from the FINISH-0 tokens; reduced motion and low resource respected; nothing animates without carrying information.
- Every visible fact is one a person reads or acts on; each fact removed is listed with why.
- Keyboard and focus work. The lenses' remaining findings are fixed or rejected in writing.
- `check:affected`, the component's browser specs, and `package:verify` when ingest or packaging changed.

## Progress

| Item | Spec | Build | Verified | Merged |
|---|---|---|---|---|
| FINISH-0 | — | — | — | — |
| FINISH-1 | — | — | — | — |
