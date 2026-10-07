# 24 — Prompt-led reading and material arrivals

7 October 2026 · Yash / Codex · `codex/prompt-workspace`.

PR #38 was squash-merged as `62d2d56` at the builder's explicit request. This pass is a separate refinement branch, preserving both builders' work and both original prototype references. P1 closure was implementation closure, not a permanent art-direction approval. This refinement was squash-merged via [PR #39](https://github.com/drishya-dev/drishya/pull/39) as `61bb47b` after local acceptance; local main is updated.

## Latest direction and implemented behavior

Normal use is scrolling captured history and returning to a prompt. The footer shows captured prompt chapters, which grow horizontally as new turns arrive. Selecting one holds the camera at the first passage after that prompt without hiding later captured work. “Follow from prompt” presents the existing recording from that point; it never reruns an agent. Full history restores independent live reading. Play/pause/speed transport belongs behind explicit Diagnostics, not normal use. Explicit diagnostic URLs retain historical inspection compatibility.

Large recordings keep the worker boundary: prompt chips are a sample of captured turn markers, with Previous/Next prompt querying the entire derived index. Both bundle and paged strips mount at most 60 chips; bundle Previous/Next visits the complete local turn list. The bounded internal HistoryQuery gains validated promptStep navigation; no observation/event schema change. Worker page selection locates the passage after that turn while retaining the latest visibility cutoff. Do not imply the sampled strip lists every prompt in a very large recording.

Receipts no longer inherit oversized source allocations. Short shell/search inputs start compact; bounded output previews can widen them. Source width derives from its first twelve displayed captured lines, within 320–580 px; no disk reads or full-file inference. Source/external defaults are 480/540 px, with compact receipts around 248 px. Siblings do not stretch to fill a row. Result-driven width changes are deliberate; the camera growth guard and semantic reading anchors remain. Preview height is bounded at 210–350 px depending on viewport. Full readers still use their existing bounded pages.

The builder explicitly asked for the whole surface and its content to arrive, rather than a stationary card with a travelling border. This is a specific exception to the prior stationary-character arrival doctrine: a finite translation/clip reveal moves the real DOM action surface from its measured origin, without copying or scaling captured text, typing it, inventing output chunks or delaying capture. The final layout slot exists throughout; animation does not drive layout. Reduced motion and reading cancel immediately to the normal full surface. The registry never deletes a real DOM action when cancelling SVG cues. Both kinds share the 36-animation cap. Glyph endpoints use final layout geometry independently of the travelling ancestor transform.

Files use a visible map/reference origin when available. An unavailable file origin falls back to its actual observed calling instrument, including Write's shared Edit instrument; no invented map location. Source readiness retains the captured-filename unfold from review/23. Every observed tool kind can use the common finite arrival path; only visible arrivals within the bounded burst budget animate. This is not a promise to animate every off-screen action in a hundred-call burst.

Operation detail has a wider, draggable/keyboard-adjustable reading area. Left/Right move the separator; Home/End select its bounds. The file workspace has an adjustable action-trail divider and a Reading space toggle. Comparison initially hides the action trail, with Show actions restoring it. Split patch rows wrap inside two real columns instead of imposing the old 720 px minimum and horizontal scroll. Adaptive diff layout uses the reader's actual width. Mobile retains stacked evidence and bounded source pages.

A real write-rendering bug was fixed: writes can contain actual after-source without patch hunks. Those now preview/open their recorded source and default the inspector to After. File evidence no longer offers an empty patch before real source states. Unknown/unrecorded whole files remain explicit unavailable evidence; map approval still does not grant current-file content access.

## Charcoal and graph

The supplied fabric reference was inspected locally. Its charcoal/stone tonal separation informs Jet's neutral charcoal background and fine boundaries. No cloth bitmap, animated shine, glow or grain was added. Pale nodes and stronger quiet edges improve visibility; semantic activity keeps its own colours. Real static import edges were already drawn in the world and repository lens. A files-only captured map cannot invent connections. Map on/off remains available in Follow and Agents; no separate graph animation clock or polling loop is added.

## Harness prompting feasibility — researched, not implemented

Claude Code provides non-interactive `-p`, structured/stream-json output and session continuation: [official programmatic CLI documentation](https://code.claude.com/docs/en/headless). Codex app-server provides threads, turn/start and progress notifications: [official protocol](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md). A separate client could therefore send prompts through supported harness interfaces. This does not establish that arbitrary existing interactive terminal sessions accept injected prompts or that all harnesses share such an interface.

Doing this inside Drishya would change the observe-only product boundary and require a separately approved controller design: owning/resuming an explicit session, authentication, workspace permissions, tool-approval UI, process cancellation and compatibility. Do not pipe untrusted text into a shell, inject keystrokes into existing terminals, reuse an observer hook for control, or silently approve harness actions. This turn researched feasibility; it did not add prompt-sending or launch endpoints.

## Critic review and next evidence

These are the implementer's judgments on synthetic sessions, not first-hand adoption reports from real users. Agent critique was explicitly deferred by the builder. The useful case is reviewing multi-file agent work while retaining source, changes and test evidence in one place. I would use it beside the harness for that task; it is not a replacement for ordinary non-code chat or an editor.

The weak areas remain repository exploration beyond captured excerpts, broad harness compatibility, dense multi-agent orientation, and discovering the value before a session contains useful evidence. Visual polish alone cannot establish adoption. Existing staged Claude proposals in review/19 already cover larger folder/current-file/symbol/navigation features; retain the shared workspace rather than allocate another permanent panel to each. Next candidate improvements are a qualified current-file reader with separate approval, folder/symbol navigation, and exact evidence-to-prompt context. Prioritize measured review/comprehension benefits over decorative motion. No fake connections or inferred private reasoning.

Local acceptance: final typechecks and 253 units; 36 ordinary browser journeys, including real-surface arrivals/cancellation for all eleven observed action kinds; two private-session/ten-minute opt-ins skipped in the ordinary suite. Offline package install/import/API/restart passes; generated demo bundle is unchanged. Dark/light, mobile, prompt and comparison frames were inspected locally. The fresh sustained reader passed at 603,167 ms, 111 live/read/return rounds and peak 716 DOM nodes. It covers the material/layout/readiness implementation and precedes only the final prompt-flow Return-to-latest correction, checked by the final ordinary suite. No new real journals were imported for this refinement. Hosted CI remains publishing-only; no billing setting changes. Physical/platform release and real user comprehension checks remain separate.

### Strict implementer scorecard

Scores are provisional judgments from the integrated synthetic journeys and inspected frames, not a user study or a market benchmark.

| Area | Score / 10 | Assessment |
|---|---:|---|
| Core capture/evidence utility | 8 | Inputs, actual source, diffs and test evidence stay connected. Private reasoning and uncaptured files cannot be supplied. |
| Reading and navigation | 7 | Prompt chapters, exact ranges, comparison and resizable reading help; fuller file/folder/symbol navigation remains staged. |
| Layout and information density | 7 | Content widths and compact receipts are materially better. Dense multi-agent/long-line workloads still need actual user observation. |
| Visual identity and motion | 6.5 | Coherent charcoal, semantic boundaries and real surface arrivals. Useful motion is clearer; it is not yet a distinctive, user-validated premium identity. |
| Onboarding and session choice | 6 | Local session discovery works, but permissions, incomplete capture and proving value quickly need a more guided first-run journey. |
| Developer workflow coverage | 6.5 | Good review companion; historical excerpts are not a full IDE, runtime debugger or execution interface. |
| Multi-agent comprehension | 6 | Ownership and shared chronology exist; contention and handoffs can become hard to scan at density. |
| Resource/accessibility behavior | 7 | Bounded worker pages, low resource/reduced motion and keyboard readers are implemented. Broad physical/platform release acceptance is still outstanding. |
| Privacy and trust communication | 8 | Provenance, approval boundaries and unavailable evidence are explicit. Redaction remains best effort; screenshots cannot certify the privacy implementation. |
| Adoption / everyday usefulness | 6.5 | I would use it for reviewing unfamiliar multi-file changes. I would not replace ordinary chat, an editor or a harness with it. Repeat voluntary use is the real test. |

Overall judgment: a useful review companion, roughly 7/10 as a local candidate, not yet a reason every agent user would switch. The strongest next improvements reduce application switching and uncertainty, rather than add animations to every idle element.
