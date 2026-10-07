# Product direction — work you can follow, evidence you can revisit

**Latest frame/material correction (7 October):** [29 — Centred neutral workspace](review/29-centred-neutral-workspace.md) centres work independently of the full-height explorer, hides single-agent header switches, keeps one compact translucent bottom input, moves prompt navigation to overflow, and uses shared neutral boxes with coloured icons and error-only red boundaries. This supersedes conflicting chrome/colour choices in 28; consent, evidence and temporary Settings replay remain.

**Latest presentation correction (7 October):** [28 — Unified stage](review/28-unified-stage.md) replaces duplicate plate/glyph arrivals with one real DOM transform, tightens vivid materials and the bottom composer, removes redundant chrome, and introduces a cached spatial pyramid with smooth dot-map zoom/detail. It supersedes conflicting presentation in 24–27; captured truth, native permissions and publishing-only CI remain unchanged.

**Latest scope, 7 October:** [26](review/26-connected-workspace.md) implements session-specific folders/current-file reading, a larger connected map, agent switches and an opt-in native prompt composer. The builder explicitly requested real prompting, superseding the earlier observe-only product boundary. Passive capture remains independent, offline evidence remains read-only, and native sessions retain conservative approval/sandbox handling. Actual Codex continuation passed locally; Claude live validation is blocked by this account's organization subscription restriction.

**7 October refinement:** [24](review/24-prompt-workspace.md) records implemented captured-prompt navigation, compact parallel receipts, actual DOM surface arrivals, resizable reading/comparison and the strict implementer review. Normal use is scrolling and following from a captured prompt; movie transport is optional Diagnostics. This records the previous scope; the explicit controller decision in [26](review/26-connected-workspace.md) is newer.

**Decision date: 30 September 2026.** This is the durable product plan following the builder's clarification and a review of the working draft. Read with [VISION](VISION.md), the [implementation roadmap](IMPLEMENTATION_ROADMAP.md), and the [baseline audit](review/06-baseline-audit.md). Proposed features below are **not claims about what the application already does**.

## 1. What we are trying to make indispensable

**6 October developer-workspace expansion:** the builder wants enough read-only source/evidence navigation to keep a developer in Drishya for supported comprehension tasks: genuine toolbox/file origins, captured-range peeks, deeper source reading, graph/folder alternatives and later symbols/evidence navigation. [DEVELOPER_WORKSPACE](DEVELOPER_WORKSPACE.md) is the staged backlog. Finish the agent-working presentation first. Do not broaden into editing/execution or equate captured excerpts with a current whole-file editor.

Drishya turns an agent's work into a navigable account of the actual material it encountered and changed. The promise is: **come back understanding the work, with the evidence one action away**. Someone should be able to find the relevant read, compare the edit, inspect the test, and continue reading without reconstructing a story from terminal output.

The builder's ambition remains a product whose motion and presentation feel exceptionally crafted. “Jarvis” describes fluent orchestration of information: material appears from an intelligible origin, assumes the shape it needs, remains available, and responds immediately to the reader. It does not require sci-fi decoration, incessant movement, fabricated reasoning, or an assistant that takes control of the user's harness.

The product must work for people who prompt and leave. Continuous watching is an optional pleasure; efficient return and review are daily utility. We should not optimize watch time or guilt people into supervising every action. The compelling feeling is “I can actually understand what happened here; returning to raw logs would take more effort.”

### The latest builder clarification governs

> “The convo should keep going, the user can just scroll up and revisit all the things … not like a pause button … that's not the final one.”

**Live defaults to an accumulating history.** Scrolling up holds the reader's position, never capture or history construction. New work continues below. A quiet “12 new actions · 2 edits” affordance offers return to latest. Selecting an old file must not hide everything that happened afterward. Recorded history also opens as a readable history; chronological playback is an optional secondary inspection/presentation mode. Play/pause, speed and timestamp scrubbing are useful there and in the diagnostic prototype, but are not the organizing metaphor of normal live use.

This supersedes earlier language that made replay transport the default footer, or treated selection as a reason to stop the live timeline. Pure, time-addressable scenes and historical correctness remain necessary even when no play button is visible.

### Live pace and tool input/output — 5 October 2026

The call is an immediate receipt: show its actual command, path, query or MCP arguments as soon as observed, then show a waiting state in the same action surface. The captured result resolves beneath that input when available. Let a result update incrementally only when the harness actually records successive chunks. A single final journal result must never be displayed as invented token-by-token output. Its arrival can be animated briefly, while the full captured text remains selectable and accessible at once.

The reader's *camera* sets the pace, not a queue that delays evidence. Small arrivals may follow naturally. For a burst of actions or a long prose/result arrival, retain the viewport at the start of new work, accumulate everything below, and show a quiet count with a return-to-latest action. Reasoning that the harness exposes should be readable by default and collapsible by choice; unavailable private thinking stays unavailable. In optional chronological replay, dwell belongs to the **currently visible** step and scales with its actual content. Reduced motion removes animation rather than speeding through steps. Long-session browser performance remains a separate B4 release gate.

## 2. Who adopts first, and for what job

“Everyone using agents” is the eventual audience, not a useful first launch segment. Start with individual developers who use Claude Code or Codex for multi-file work and are responsible for reviewing the result. We can serve both builders' actual workflow before expanding.

| Audience | Trigger | Useful outcome | Evidence of demand to seek |
|---|---|---|---|
| Agent-heavy solo developer | Returns after 10–30 minutes | Understand changes and unresolved problems without rereading the whole session | Uses Drishya for their next unrelated task voluntarily |
| Developer reviewing agent changes | Agent claims “fixed” or “tests pass” | Locate the diff and see which test execution the claim refers to | Faster correct review; fewer incorrect assumptions |
| Developer learning an unfamiliar repo | Agent reads several connected files | Follow actual source excerpts and relevant relationships | Can explain the changed behavior afterward |
| Pair/small team | Another builder hands over work | Open an explicit, privacy-reviewed evidence packet | Recipient can answer review questions without the author present |
| Multi-agent user | Several workers touch overlapping areas | Distinguish agents, worktrees and outcomes without losing context | Correctly attributes changes; notices unresolved overlaps |

The first three share one interface. Team sharing and many simultaneous agents raise identity, privacy and scale costs; deliver them after single-session trust and readability.

## 3. Market reality and the differentiation to earn

We are not first to visualize agent activity. Agent Flow documents live Claude Code/Codex graphs, session views, timelines, transcripts, file attention and log replay. These are table stakes for this category, not our moat. This review inspected its published description, not a hands-on feature/performance comparison. [Agent Flow](https://github.com/patoles/agent-flow).

Native environments also keep improving. Cursor documents checkpoints and file previews/restoration, so “see code changes” alone is insufficient. Drishya's opportunity is a consistent captured account across environments, with the actual historical material and useful navigation between it. [Cursor Agent](https://cursor.com/docs/agent/overview).

Langfuse's tracing is adjacent competition for understanding execution. We should compete on the developer's repository and review task, rather than recreating a generic tracing dashboard. [Langfuse observability](https://langfuse.com/docs/observability/overview).

The 2025 Stack Overflow survey reports frustration with almost-correct AI answers (66%) and more time debugging AI code (45%). These are motivation to investigate review/comprehension problems, **not proof of demand for Drishya, market size, or willingness to pay**. [Survey AI section](https://survey.stackoverflow.co/2025/ai).

Our differentiation hypothesis is the combination of five qualities: captured content rather than labels; exact historical availability; fluid movement between history/file/evidence; useful return-to-work review; and consistent behavior across harnesses. No single animation is uncopyable. Defensibility can compound through adapter compatibility fixtures, trustworthy artifact lineage, excellent long-session navigation, and repeated usability learning. We must earn this with users, not declare competitors' UIs “bad.”

## 4. The experience to build first

Keep `apps/ui` as the integrated application. Treat `docs/prototype/index.html` as an interaction reference and a test source. Do not replace the app with the prototype's hardcoded playback engine. Neither surface is the final design.

### One coherent composition

- **Top:** session identity, source/harness, and stable agent presences. Active agents receive emphasis; idle agents stay in a compact overflow after a sensible limit. Do not reshuffle their positions each time activity changes. Default to all agents in one chronological history; selecting an agent filters emphasis, with explicit isolation available.
- **Behind:** a calm repository map. Work files sit near their corresponding history passages; unrelated structure recedes. Relationships are typed and revealable, not a glowing spaghetti background. The map can be off without losing any information or navigation.
- **Middle:** one vertically accumulating history. Within a passage, actions arrive left to right; exposed prose sits below on the shared background, unboxed. A new paragraph is visual punctuation, not a new dashboard card.
- **Right:** stable native instruments, followed by observed MCP servers. A call emits from its actual instrument. Servers disclose their tools as drawers. Clicking a dock entry reveals its activity in history; it is not only an animation anchor. Missing/unobserved tools are not presented as an inventory of installed capabilities.
- **Bottom:** a small live/reading-position affordance when useful. In ordinary history there is no mandatory movie controller. Explicit “Replay sequence” reveals the transport.

### The first 90 seconds should demonstrate six useful moments

1. Choose an existing session by project, source, date and safe title. Show whether it is imported, updating, stale, unsupported or incomplete. Do not label “live” solely because a file was modified recently.
2. A captured read lifts from its file node (or a labelled unresolved origin) into actual selectable code. Path, range, availability and provenance are accessible without dominating the composition.
3. A search emits from the dock. Matches share a query baseline and link directly to their historical excerpts. Hover/focus traces a result to its file; it never claims the search caused the next edit.
4. A related edit takes the width of a diff. A test result lands as command, outcome and useful failing assertion, not a confetti success tile. Prose remains prose.
5. Scroll back and select a line. The viewport stays put as new actions arrive. Expand the read in place or enter its reader; close it and return to the same line and surrounding passage.
6. “Since your last visit” highlights new edits, test executions, failures and gaps. Selecting an item lands on the original event. Returning to latest is explicit and does not run every missed animation.

This small complete journey is more valuable than a gallery of twenty effects. Use the same synthetic scenario across prototype, integrated UI, screenshot review and launch demonstration.

## 5. Content determines the presentation

The visual system needs an intermediate **presentation plan**, not an LLM choosing arbitrary layout. Given an operation, available artifacts, viewport, density and expansion state, it chooses a deterministic shape, bounded preview, relevant anchors and an accessible full reader. This is a proposed view-layer contract; it does not silently change the event schema.

| Material | Default visual composition | Expand / interaction | Truth and overload behavior |
|---|---|---|---|
| Source read | File spine, exact range, readable code excerpt | Expand vertically; full-width reader for long lines; copy range | Missing context uses a labelled gap; never fetch today's file as if historically read |
| Search | Query baseline, file-grouped excerpt rows | Result opens captured location; clear match count | Show result cap and omitted count; text-only when parsing is uncertain |
| Edit | Inline hunk for a small change; aligned before/after at sufficient width | Change lens can switch between captured before, patch, verified reconstruction and current file | Patch intent, tool success and observed disk write are different facts |
| Shell | Command line, working directory when captured, output below | Fold noisy output by explicit rule; open bounded full-output reader | Preserve stdout/stderr and exit status when available; no invented progress bars |
| Test | Outcome aligned with command, failed assertion first | Previous comparable run beside current; jump to evidence | Green means that invocation succeeded; it does not certify all current code |
| MCP | Server/tool origin, compact input, content-shaped result | Safe JSON tree, table for uniform records, list for search-like output, text fallback | Generic renderer first; no arbitrary remote HTML or untrusted scripts |
| Delegation | Branch from parent presence to a child presence | Follow child work and return to parent position | Only explicit parent/child evidence creates the branch |
| Agent prose | Attributed text on a quiet background, normal selection | Expand long exposed rationale; link mentions only with reliable resolution | No hidden reasoning reconstruction; captured words and generated explanation remain separate |
| Gap / omission | A visible break in the sequence with short reason | Inspect type, bounds and available evidence | Unknown remains unknown; an attractive composition cannot conceal missing capture |

A short command should not occupy a code-sized rectangle. A six-line diff should not be crushed into a 280 px card. A long JSON result should not become a screen of tiny text. This requires deliberate renderers, useful previews and stable expansion, not unlimited automatic resizing.

### Layout rules to implement and test

Start with readable widths rather than fixed card counts: code roughly 420–720 px when available, prose around 65–85 characters per line, minimum body text 14 px on desktop. These are initial design targets, subject to testing.

At wide widths, at most three compact actions share a passage; a substantial diff can occupy the row alone. Around 900 px, collapse secondary navigation before making source unreadable. At narrow widths, actions stack and dock/map become deliberate overlays. Long individual code lines may scroll horizontally; browsing the main passage should not require a horizontal carousel. The inspected base app currently violates the latter at 900 px.

Content arrives whole within its bounded preview. Reserve initial geometry from the presentation plan, grow only at meaningful boundaries, and keep the reader's anchor stable. A changing output should not repeatedly stretch the page beneath the cursor. Full content can use a scrollable reader; avoid nested scrolling until the reader is explicitly expanded.

Earlier actions overlap **only at margins**; titles and useful excerpts remain readable. Do not scale text down to make more fit. Expand one action within its passage, with a full reader as an escape hatch. The inspector/evidence panel can remain for deep debugging, but ordinary reading should not require opening it for every event.

## 6. Craft: motion as an information channel

Retain Lift, Emit, Settle, Surface and Resolve. Implement them as transitions between already-defined semantic states. No animation callback changes captured data, event ordering, selection or availability. The final layout exists first; a presentation overlay bridges origin to destination and disappears. DOM text stays selectable and accessible in the settled composition.

Proposed initial timing vocabulary: focus/hover 100–140 ms, arrival 180–260 ms, settle 140–180 ms, result change 120–180 ms. These are tunable targets, not measured optimums. Limit travel distance on wide screens; the origin indicator and short tether can carry meaning without flying across the whole desktop. Use transforms/opacity, avoid per-frame layout and large backdrop filters, and use measured anchors shared across scroll containers.

During bursts, animate one representative relationship per group and settle the rest immediately with an explicit count. Never queue minutes of spectacle behind live capture. The user may expand the group afterward. If an origin is offscreen, use an attributed edge marker; do not invent a graph position. Offscreen history insertion is quiet. Returning to latest reveals the settled current state, not a catch-up movie.

At rest nothing pulses, orbits or drifts. Static pending marks indicate unfinished operations. Hover/focus makes the relevant relationship crisp. Copy acknowledges once beside the copied range. Selection remains visibly selected until dismissed. Prefer a clean hairline and tonal contrast to glow, blur, tilt or particles. Reduced motion and map-off retain the same meaning and keyboard route.

Every transition must be interruptible by scroll, selection, focus or navigation. Escape unwinds reader → selection → filter/explore while restoring anchors. Do not globally consume Space when a button, input or reader already owns it. The accessibility tree follows reading order, even when visual actions share a horizontal passage. Do not announce every token/action through a live region; coalesce useful status updates.

## 7. Features that can make the product worth returning to

These are prioritized hypotheses. Every feature needs a cheaper raw-transcript comparison and an evidence model before implementation.

### A. Since your last visit — first differentiation feature

**Implemented 5 Oct (P2-A):** per-recording local mark, explicit marking only (all / through here / undo), and a deterministic digest of failures, edits, test runs, still-running operations and gaps after the mark, with direct links. Not yet: a separate "last visited" timestamp, and marks for combined views.

Persist a **local per-user reading boundary** by recording revision and stable item identity. On return, show edits, outcomes, still-unfinished operations and capture gaps since that boundary. First implementation is deterministic facts with direct links; no model call. “Last visited” is not proof the person read or understood every item. Allow “mark through here,” preserve the previous boundary until acknowledged, and offer the complete history beside the digest.

The useful moment: someone returns after lunch and goes straight to two edits and a failed verification rather than watching a replay. This is likely a stronger retention mechanism than live animation alone.

### B. One file, through the work

Select a file from any excerpt to see its reads, intended edits, available before/after artifacts and later verification references across the selected session. A compact version rail links captured states; choosing one opens that state. Compare “as read,” “after this edit” and “current” only where each exists, clearly labelled. The current working tree is never a replacement for a missing historical artifact. Same path in different worktrees is not the same file identity.

### C. Verification freshness, with honest limits

**Implemented 5 Oct (P2-C):** per change, the test runs recorded after it, later changes to the same files, and a verdict (none recorded after / recorded after / last run predates a later change). A captured failure naming the changed file is labelled as a reference, and a run by another agent is labelled. Order only: no coverage, score or "safe" badge. Combined views on the daemon are not supported yet (bundles are).

Place test executions relative to relevant edits. If a test ran before a later edit, say “last recorded run predates this edit.” When exact test scope or workspace revision is unknown, say so. A later passing command is not automatically proof it covers the change. Use captured command, root, timestamps/order, observed revision and declared test scope where present. No invented coverage score, “safe to merge,” or green badge inferred solely from proximity.

### D. Review trail from a claim to its evidence

Expose a final claim beside the edit/result evidence linked to it, distinguishing explicit references from candidate related events. A click opens the exact excerpt with source and availability. Deterministic identifiers and quoted paths first; generated explanations later, explicitly labelled and cited. Citation existence is not semantic entailment. Let the reader inspect why a suggested link was made and dismiss it.

### E. Continuity across sessions, without false causality

Group sessions by user-approved repository/worktree identity. Show “later work on this file” and “also touched here,” with harness and time. Only explicit native relationships justify “continued from” or “delegated to.” Worktree boundaries remain visible. Do not merge histories automatically merely because two cwd strings look alike.

### F. A review packet worth sharing

Eventually export selected operations, minimal required artifacts, relevant outcomes, gaps and provenance. Preview exactly what leaves the machine; redact again under the chosen export policy and replace all local identities. Offline review needs no account or daemon. The recipient can explore evidence, not only watch a video. Existing full-bundle export needs hardening first; no auto-upload or public share button in the baseline.

### G. Attention aids, not invented intelligence

Later deterministic cues can reveal a file edited by two agents in the same worktree, a failed command with no observed retry, or repeated identical reads of an unchanged captured artifact. Label these conditions literally. A repeated read is not automatically waste; two edits are not automatically a conflict. Provide “why shown” and a link to each observation.

### Proposed additions — 2 October review (not yet agreed)

*Added by @harsh with Claude Opus 5.5 after a review of all docs and the 30 Sep audit. These are proposals for both builders to accept, change or reject. Accepted items move into the decisions log in STATUS. Nothing below is implemented.*

The 30 Sep direction already covers most of what that review suggested: return-to-work first, since-last-visit, verification freshness, a simpler stack, privacy before real data. What follows fills gaps the review found.

#### H. Start from the changed line ("why is this line here?")

Every feature above starts *inside* Drishya: you scroll the history or pick a file. Reviewers usually start from the **changed code**, in their editor or a pull request, and ask why a line exists. Let them select a changed line (in Drishya's diff view, or later `drishya why <path>:<line>`) and inspect a captured edit when the evidence supports a match. Show the reads and test runs around that edit and the agent's words, with the usual provenance.

Matching can compare captured edit text (patch hunks, new strings, captured writes) with the file in an approved worktree. Recent Claude Code often records `originalFile: null` (see CODEBASE), so exact reconstruction is often unavailable. A text match is a candidate, not proof of authorship; assert a specific origin only when the captured edit, file identity and version lineage support it. Otherwise say: *"No recorded edit can be confidently linked to this line."* The user may have typed it, a shell command or formatter may have changed it, or later work may have overwritten it; those remain possibilities, not conclusions. This builds on B (one file through the work) and uses the same as-of artifact rules as roadmap B2.

#### I. Link sessions to commits and pull requests

Real work is several sessions plus manual edits, ending in commits and a pull request. E groups sessions by worktree but doesn't connect them to git. Propose a read-only link: for a selected commit range or branch diff, show candidate sessions that touched those files in that worktree and period. Link a changed line to an edit only when H's evidence supports it; otherwise mark the origin unknown. Read git, never write it; no remote calls. This could support an "explain this PR" entry point when its branch or commit range is available locally, and later make F (review packets) worth attaching to a PR.

#### J. Review flags: expand G and bring it forward

G's cues are good but soft, and scheduled late. The cues that best answer "where should I look first?" are missing. Propose adding these literal, rule-based flags, each with "why shown", its rule version and links to the observations:

| Flag | Rule, stated literally |
|---|---|
| Edited without a recorded read | A file was edited, and no read of that file was captured earlier in the session |
| Test files changed | A test file was edited or deleted, or a skip marker (`.skip`, `xit`, `@pytest.mark.skip`, etc.) was added |
| Sensitive files changed | Config, `.env*`, CI workflows, lockfiles or dependency manifests were edited |
| Risky command | A captured command matches a named list (`rm -rf`, `git push --force`, `git reset --hard`, `--no-verify`, …) |
| Large deletion | An edit removed more than a configurable number of lines |

Same honesty rules as G: a flag means "look here", not "this is wrong". **No flags does not mean safe**, only that no rule matched in the available capture. Ship these with A and C as one return-to-work view rather than after them.

#### K. A "reviewed" mark per change

A's "mark through here" records where reading stopped. Add an explicit, local **Reviewed** mark per edit or hunk, plus a simple list of what's still unreviewed. "Viewed" stays separate from "reviewed"; only the user's explicit action counts. This turns review into a finishable checklist and gives the pilot a concrete behavior to observe.

#### L. Proposed sequencing change: test usefulness earlier

The roadmap runs B0 → B4 → P1 → P2 → pilot, which means months of infrastructure and polish before anyone outside the team tries it. Proposed instead:

1. B0 → B1 → B2 → B3 as written.
2. **Then the usefulness features in plain form:** A, C, H, J and K, without the premium motion.
3. **Then early testing:** the two builders on their own sessions first, then 5–10 developers running from a checkout. Use the existing pilot questions in §9.
4. Then B4 and P1, guided by what testers struggled with.
5. Then I, a VS Code entry point, F, and more harnesses.

This keeps privacy and correctness first. It only moves the question "is this actually useful?" ahead of scale, packaging and visual polish.

### Deliberately defer or remove

Defer dashboards of token spend without reliable captured accounting, comprehensive runtime/database graphs, every-harness promises, generated architecture narration, team surveillance, and theme marketplaces. Remove mandatory autoplay, idle animation, fake complete-file context, default model-generated titles as if captured, and giant history carousels. The builder subsequently authorized an opt-in supported native controller (review/26). This narrow extension does not authorize arbitrary terminal attachment, unattended prompts, rollback, IDE execution or file mutation by Drishya.

## 8. Base theme now; alternatives later

Use the established graphite developer-tool theme from VISION: flat surfaces, restrained hairlines, one sans and one mono, syntax consistent with GitHub Dark, color for identity/outcome/change. Improve spacing, composition, contrast and movement before adding skins.

Future theme experiments can be **Graphite**, **Paper** (high-contrast light reading), and **Stage** (more spacious presentation). These are proposed directions, not three apps to build now. Share semantic renderers, density, hit targets and interaction. Theme tokens control colors/type/spacing; motion and quality settings remain separate. Compare the same fixture at the same width, long prose, failure, huge output and reduced motion. Choose by readability and preference testing, not a beautiful empty screenshot.

## 9. Adoption and ethical FOMO

Lead with a concrete before/after task: “Find what changed, why the agent said it changed, and what verification actually ran.” Show a real product interaction with synthetic data: source lifts, diff expands, test links, the user scrolls away while work continues. A short promotional edit should be made from working behavior, with omissions labelled; it must not promise hidden reasoning access.

Launch the local reader with no account and no model key required. Preserve Apache-2.0 as the current project decision. Open development can earn trust around capture/privacy and attract adapter contributions. Paid collaboration, managed review or support are later business hypotheses; there is no pricing evidence yet. Open source is not itself a distribution strategy.

Use an interactive browser demo, a concise install path, compatibility table, sample replay and an evidence-led launch video. Recruit 8–12 developers who already review Claude Code/Codex work. Publish a clear comparison by jobs supported, with dates and links, not competitor insults or unsupported exclusivity. Never upload people's recordings by default for a demo, issue or analytics.

### Decide with pilot evidence

Run matched tasks on native transcripts and Drishya, counterbalance order, and include success, failure, missing content, multi-agent and changed-after-test cases. Measure correct answers to: what changed; what was actually read; which test ran; what remains unknown. Record completion time and confidence calibration. Ask whether they choose it again on their own work after a week.

Proposed pilot gate: at least 8 participants; median task time improves by 25% without a drop in correctness; at least 6 voluntarily use it on a second task; no critical false inference caused by presentation. Small-sample results guide iteration, not population-level claims. If visual polish delights but comprehension does not improve, revise navigation and evidence presentation before expanding effects. No telemetry: use consented observed studies and user-controlled local aggregate reports.

## 10. Build sequence and durable handoff

**Latest builder direction, 6 October:** finish the integrated local product now and refine art direction later. Standalone HTML exploration no longer blocks implementation. [PRODUCT_DELIVERY](PRODUCT_DELIVERY.md) is the current account of the workspace, shared themes/settings, global file evidence comparison and usable workflows. Technical acceptance does not substitute for the pilot below or certify all devices/harness versions.

Finish trust and reliability first, alongside a usable integrated history. Then implement the content-shaped visual system and one differentiating return-to-work feature. Only then expand themes, sharing and harness breadth. [IMPLEMENTATION_ROADMAP](IMPLEMENTATION_ROADMAP.md) defines gates and acceptance criteria; STATUS identifies the next actual commit.

The next agent should preserve these four things even under a smaller context budget: **live history keeps growing; the reader owns their position; content and evidence drive the layout; backend completion precedes premium expansion**. Read the [continuity brief](CONTINUITY.md) before proposing a new direction. These repository files, not chat memory, are the durable product memory.
