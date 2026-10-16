# 83 — Independent developer adoption review

16 October 2026. Three fresh reviewers: daily developer, design/interaction, and workflow/adoption. This supersedes assumptions that presentation alone establishes a reason to switch. Implementation details and acceptance are in [82](82-developer-workspace.md).

## Basis and limits

Each reviewer received the product purpose and current implementation/screenshots, not earlier review conclusions. They inspected source, current-source Workspace frames and actual Codex/Claude captured-history frames. They did **not** operate a native account, run a live turn, observe motion interactively, or conduct a ten-minute human reading test. CUA browser access was unavailable. Their ratings are judgments, not measured usability results or market evidence.

The first actual-history screenshots were premature: `.history` existed before a visible passage had settled. The acceptance journey now waits for a captured action/prose intersecting the history viewport. Both real recordings show substantial material in refreshed frames; the daily reviewer explicitly withdrew the blank-history P0. Do not turn that screenshot timing error into a claimed persistent history defect. The workflow/design reports' original empty-frame concern is resolved on this basis, not ignored.

## Verdict

All three would try Drishya for understanding/reviewing substantial agent work. None would yet abandon their IDE/native client and depend on it as their sole development surface. Daily developer: revised main-interface readiness **6/10**, evidence **8/10**, review **7/10**. Design: integrated product **6/10**, specialized review potential **7/10**, differentiation **8/10**. Workflow: overall **5.5/10**, proposition/evidence **8/10**, review **7/10**, current-source reading/workspace **6/10**. Motion remains experientially unrated.

Strengths to preserve: actual historical inputs/results/patches; distinct current disk; exact-patch Git review; anchored questions and return marks; bounded source reading; explicit native ownership; offline/privacy boundaries; selectable code and unboxed prose. A useful product already exists beyond animated logs. The adoption gap is a joined-up **understand → inspect → correct/request → check → return** loop.

## Immediate findings and disposition

| Finding | Disposition in 82 |
| --- | --- |
| Tab switching loses each file's page, find, wrap and reading position | Retain per-pane/path controls and page scroll in bounded navigation memory; source bodies stay out of that memory. |
| Draft cap has no recovery | Retained-draft shelf exposes all eight source-scoped drafts, including other sessions; explicit discard never silently evicts work. |
| Draft lifetime unclear | “Lost on reload” disclosure and explicit text download; closing a tab retains the in-memory draft. Durable recovery remains future work. |
| Workspace without captured local root is a dead end | Offer captured-file reading instead. Never infer/rewrite a historical root. Explicit current-root association remains future work. |
| Opening Workspace loses direct import navigation | Reuse the existing qualified current-index import context; open destinations in the active pane, or leave for captured work/map. |
| Stacked phone split panes leave too little reading space | Show one active pane with an explicit switch on narrow screens. Desktop keeps a resizable two-pane desk. |
| Prepared SHA check can be mistaken for enforced application | Document it as a native-agent instruction. No transactional write or guaranteed conflict resolution is claimed. |
| Current source can be malformed/incomplete while opening a draft | Strict UTF-8 decoding and complete bounded page loading, rejecting changing versions, redaction and inconsistent continuation. |

## Prioritized remaining work

### P0 — demonstrate the real continuation loop

For **both signed-in native harnesses**, continue an actual task through submission, image/file delivery, one exact approval, refusal/rejected command, interruption, disconnect/reconnect and final durable captured result. Confirm CLI/version/session target and settings. Existing synthetic protocol tests are necessary but cannot prove native-account acceptance. The builder owns these real-account checks; never silently spend a native turn for a screenshot.

### P1 — make review the organizing workflow

1. Expose recorded-work review and unresolved questions alongside current Git; avoid burying the differentiator behind a utility glyph.
2. Compose selected captured evidence, current source, questions and a precise next request without repeatedly hiding one mode for another. The desk currently hides history/composer/toolbox; it reduces external windows but still imposes an internal context switch.
3. Add bounded whole-file literal find with exact line destinations. Current desk find truthfully searches the loaded 200-line page; it is not repository search.
4. Add clear changed-since-open freshness and predictable draft eligibility before entering a small correction workflow. Limits remain 1,000 lines/32 KiB, not arbitrary editor capacity.
5. Show a human-readable base/proposed diff before native preparation, deliberate append/replace when a prompt already exists, and a return link from actual results to the originating file/task.
6. Make review coverage and incomplete pages clear at handoff; current Git packet contains explicitly reviewed patches on its current page. A whole-change-set packet needs bounded revalidation across pages.
7. Provide intentional draft recovery/export and multi-file change-set preparation. Current export solves deliberate preservation, not automatic recovery or coordinated edits.

### P1 — make the map answer a developer question

The anonymous background graph is visually present but earns little practical attention in the reviewed frames. Existing implementation already has observed-only filtering, path search, static imports/imported-by, direct-neighborhood focus and source/history destinations. **Expose and refine those; do not recreate them as alleged missing features.**

Default question: **“Where in this repository is the work I am reviewing?”** Show a bounded set of explicitly referenced files with readable selected labels. Keep edges away from prose reading areas. Distinguish current static imports, folder containment and density groups; none imply historical execution or agent reasoning. Preserve stable positions, optional rotation/static preferences and reduced motion.

Acceptance task: choose a captured-changed file → identify two resolved import neighbors → open one alongside source → find its captured edit → return to the same review location. Compare accuracy/time/preference against Files-only navigation. If the map does not help, keep it optional context. PR66's React Flow/ELK proposal is a candidate experiment, not an adopted renderer or a reason to replace the working shared map.

### P2 — improve sustained developer reading

- Resizable explorer/full-path reveal and a working-set view; similarly named paths truncate too readily.
- Lightweight symbol outline/definition handoff where supported, followed by meaningful import navigation. A folder/path reader alone cannot replace mature code navigation.
- Obvious pane assignment and “open alongside”; eight-tab overflow/replace choices instead of only a capacity error.
- Keep critical task labels readable; 10–11 px secondary metadata must not set the whole task's hierarchy.
- Collapse secondary source controls on phones; fitting inside a viewport does not establish comfortable reading/editing/touch use.
- User-owned concise session names while preserving complete original prompts; clear current-prompt/changes navigation when landing at latest work.
- Tool rail should prioritize scoped current activity/failures, with lifetime inventory counts secondary.
- Multi-agent running/waiting/overlap/intervention context and identity at relevant work; inventory/filtering is not coordination.
- Make local questions/marks scope and lifetime clear; add deliberate inclusion in a reusable handoff rather than implying shared coordination.
- Keep source/version comparison distinct from two unrelated file panes. Local drafts are small correction textareas, not syntax-aware editors or an interactive terminal.
- Associate an existing local root only through explicit validated current-workspace consent, without altering captured provenance.

### P3 — polish after the loop works

Review hover dwell/enlargement, quick crossings, interrupted entry/exit, selection during arrival, dense shell output, keyboard parity and reduced motion in actual long sessions. Source indicates meaningful single-material motion, but still screenshots cannot certify feel. Do not contradict the builder's deliberate hover-reading request with a generic duration rule. Audit every surface's hierarchy, padding, focus, menus, and unnecessary chrome through the installed skills; do not add decoration to compensate for missing task continuity.

Eventually recommend one default workflow while retaining specialist/backup versions during acceptance. Theme multiplication, richer topology and extra editor chrome are lower priority than reliable, understandable task completion.

## Success criterion

A developer returns to an unwatched task and can correctly answer **what changed, what is known to have happened, what remains uncertain, and what should happen next** faster and with fewer mistakes than in the native chat plus editor. Evaluate that with people and actual tasks. Agent scores and automated passes cannot establish demand, adoption or release readiness.
