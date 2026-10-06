# Visual developer workspace — direction and staged backlog

6 October 2026 · Latest builder expansion · **Proposed work, not an implementation inventory**

The builder wants Drishya to support the reading and understanding work that otherwise sends a developer back into an IDE. The distinguishing experience is spatial: a real tool leaves its toolbox, a referenced file lifts from its repository location, and the exact captured lines lead into deeper exploration. First finish the agent-work baseline and its premium presentation; then add useful read-only workspace capabilities in bounded increments. This plan does not authorize editing files, executing commands or controlling a harness.

Read with [VISION](VISION.md), [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md), [PRODUCT_DELIVERY](PRODUCT_DELIVERY.md) and [CODEBASE](CODEBASE.md). The delivery document describes what already works. This document persists the new direction across model/chat switches.

## The developer journey to design around

An agent reads a guard. Its map node highlights and the captured excerpt lifts into the passage. Hovering the reference can clarify the recorded range; deliberate activation opens a reading surface at that range. The developer follows a qualified import to understand a nearby type, compares the captured change, then opens the recorded failing test and the later test run. They return to their original position while live work continues below. They can do this through the map or a familiar folder navigator without reconstructing the session from logs.

That journey is the product test. A toolbox metaphor and smooth motion matter because they make origins and transitions intelligible, rather than adding a second decorative dashboard. Do not promise an IDE replacement before these jobs work well.

## Finish the main baseline first

1. **Toolbox emission.** Keep native tools and observed MCP identities readable on the right. An MCP drawer reveals its actual observed tool names; the invoked instrument leaves a finite silhouette toward the real action surface, with the source instrument staying in place. Input remains immediately available; output resolves in the same action. Cancellation, bursts, offscreen origins and reduced-motion use the existing choreography boundary. Do not fabricate an installed-tool inventory from recorded use.
2. **File lift with an honest fallback.** If a referenced graph node is visible, content unfolds from its measured node. In a future folder view, the visible referenced file row can supply a labelled file-reference origin. If neither is visible, use an explicit reference fallback; never fly content from an invented position or imply the agent browsed a folder merely because our UI shows one. Root/worktree identity must remain exact.
3. **Hover clarity → deliberate reading.** Highlight the actual captured range on the source surface and map reference. A bounded hover peek can display an already available excerpt without stealing focus or moving the viewport. Hover alone does not hold live following. Clicking/keyboard activation opens reading space at that range, holds the reader, and exposes provenance plus close/return. A right-side reading surface is a candidate, not a settled permanent panel: test it against in-place expansion and the existing file dialog, particularly with the tool dock visible.
4. **Content-shaped accumulation.** Keep source, search, patch, command, external result and parsed verification compositions distinct. Side-by-side actions wrap when their useful widths fill the row; actual agent prose starts the next passage. No typewriter, empty theatre or delayed evidence. Review an entire source → explanation → edit → failure → correction → result journey in dark/light, narrow/wide and motion-off modes.

These refine the existing integrated baseline. They should not wait behind a large explorer, language-server or editor rebuild.

## Later capability groups, in priority order

**Proposed paid-grade features (6 Oct, Harsh):** [19](review/19-developer-feature-proposals.md) lists what a senior developer would pay for — agent blame, tripwires, review packet, stuck detector, mission control, and the detailed VS Code-like reader/explorer/flow graph. Proposals only; build after the baseline, in the stage order below.

**W1 range/reference increment:** [18](review/18-source-reference.md) adds exact loaded-range copy and one temporary historical reference (up to 200 lines / 64 KiB decoded text). The reference survives live append and reader close, but clears at session/source/replay boundaries. Provenance remains visible; no persistence or current-file access. Folder/current-file/symbol capabilities and durable bookmarks remain staged.

**W1 navigation increment:** [17](review/17-source-navigation.md) implements loaded-page matching-line navigation, stored-range go-to-line across bounded slices, persistent controls during loading and stable historical material during unrelated live append. Find remains page-local.

**Implemented baseline slice, 6 October:** toolbox emission is in [15](review/15-toolbox-emission.md). Exact read activation, artifact coordinates, hover/focus edge, full-width in-place reading, provenance and loaded-page find are in [16](review/16-captured-range-reader.md). W1 navigation/range/reference now have bounded implementation slices; reversible tabs/breadcrumbs remain proposed. No folder/current-file/symbol explorer has been added. Harsh's agent should read CONTINUITY and STATUS before choosing its next slice and claim files first.

| Stage | Developer job | Concrete experience | Evidence / exit check |
|---|---|---|---|
| W1: deeper source reading | Understand the exact material the agent saw | Range-preserving peek/open, find within loaded source, go to line, copy a range, pin one reading reference, reversible tabs/breadcrumbs | Exact captured lines/provenance; unavailable parts explicit; keyboard/focus and held anchors survive live append |
| W2: map and folders | Locate relevant code through either spatial or familiar navigation | Shared file selection between zoomable map and collapsible directory tree; path quick-open; import/export relationships and selected-file context | Same root/worktree/path in every view; no runtime/cause claims; bounded nodes/rows and retained camera |
| W3: read-only current workspace | Read a file not fully captured in the session | Separately approved workspace reader, whole-file paging, clear **Current workspace** mode, snapshot fingerprint and refresh | Security/redaction design first; no silent historical substitution; approved-root containment and changed-file handling |
| W4: code understanding | Navigate symbols and qualified references | Outline, peek a statically resolved definition, jump between imports and references, source-local search | Location/basis labelled; partial/unresolved extraction explicit; cross-file navigation uses W1/W3 boundaries |
| W5: evidence review | Understand a change and what was checked afterward | Direct read → patch → recorded test links, next failure/change, captured diagnostics at source locations, evidence comparison | Recorded order only; no coverage/safe claim; future evidence hidden during replay; paged whole-recording queries |
| W6: resume and handoff | Return to a problem without rereading everything | Local bookmarks with optional notes, bounded pinned evidence, restore reading place, sanitized review packet | Notes labelled user-authored; bookmarks do not mark work seen automatically; no automatic sharing/provider calls |

Several W5 pieces already exist: file history/comparison, since-your-mark and order-qualified verification. Integrate their navigation into the primary reading journey before inventing duplicate widgets. These stage tags are product increments, not dates or effort estimates.

## Map exploration and semantic zoom

The current map supports repository exploration and opening recorded file work. Improve its usability before adding another rendering engine. At distant zoom, show bounded clusters and useful path labels; at file scale, reveal selected paths and typed relationships; at deliberate reading scale, open a DOM source reader anchored to the selected file. A graph is not the whole repository merely because it fills the screen.

Never place source characters in the canvas/GPU. Zooming should not mount thousands of code excerpts. Only selected/focused or bounded visible references can request artifact pages. Preserve map camera, reader selection and live reading position when switching map/folder/history. Offer fit-working-set, fit-selection, keyboard zoom and Escape back to reading. Wheel behavior must distinguish graph navigation from source/result scrolling; nested readers cannot hijack the whole world.

Graph links need typed legends: current static import, captured file reference, or recorded action ordering. Do not turn imports into an invented agent decision flow or program execution pipeline. Historical replay cannot masquerade as a historical repo snapshot using today's index. Folder layout is a navigation projection, not evidence of agent traversal.

## Whole-file reading is a separate evidence problem

An excerpt does not become a whole file when opened in a larger window. If a complete captured artifact exists, read it through the existing bounded artifact API and label its capture/provenance. If only lines 20–40 were captured, display that range and explicit unknown space; do not stitch unrelated excerpts into a seemingly complete file.

Current workspace reading requires a separate reviewed implementation: explicit root approval, read-only access, canonical containment after symlink resolution, protected/binary/oversize exclusions, secret sanitation before caches/persistence/screen, bounded pages, version fingerprints and stale-response rejection. Distinguish **Captured at this action**, **Derived reconstruction**, **Current workspace** and **Unavailable** at the reader, not only in a tooltip. Reuse captured-root approval only if its actual consent scope covers content reads; graph scanning consent must not silently expand into whole-file viewing.

Prefer a direct read-only service returning sanitized bounded slices; do not copy the entire workspace into the store or browser. Current-file refresh is explicit while reading. Opening a current file during replay remains visibly outside the historical evidence mode. Any artifact/bookmark/export reference must retain which kind of content the user chose.

## Features to deliberately exclude

No prompt composer, approvals, agent launch, terminal execution, file editing, Git checkout/reset/commit, automatic fix, or unattended cloud explanation. Copying a recorded command is useful; running it from Drishya changes the product's role. Captured diagnostics are useful; fabricating live compiler/LSP diagnostics or test coverage is not. Start with static read-only source navigation instead of importing an entire IDE platform.

## Architecture and craft constraints

- Reuse the DataSource/history/artifact boundaries. Worker pages are not whole-session evidence; navigation needing global facts must query existing global services or add an explicitly bounded read-only endpoint.
- A source reader keeps bounded pages (currently 200 lines); comparison keeps two references and a 24-action file-history page. New tabs/pins need an explicit retention budget, cancellation, and eviction; do not accumulate a full file/session per tab.
- Hover peeks reuse or request only a bounded sanitized slice after intentional dwell, cancel on pointer departure, and never request every visible graph node. A keyboard equivalent must exist. Reduced motion changes choreography, not information.
- Motion starts from measured visible origins, is finite, reversible and interruptible, and never gates capture or hides selectable text. No idle looping toolbox, scanner or fake loading performance.
- Existing measured B4 range and physical/platform release limits remain. Record new memory/latency gates before expanding source indexing or graph working sets.

## Acceptance before claiming the workspace is finished

A developer can answer: what was requested, what exact material was seen, what changed, what failed, what was checked afterward, and which source is captured versus current. They can inspect that evidence without launching another editor for the supported reading task, then resume their place. Test keyboard, narrow screen, reduced motion, map-off, missing artifact, mixed worktree, replay cutoff, late result, reconnect and sustained reading. Compare the journey with raw logs in a human pilot; attractive motion and automated tests alone do not prove comprehension or preference.
