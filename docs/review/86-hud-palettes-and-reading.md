# 86 — HUD, palettes and complete reading

**16 October follow-up:** [87](87-modern-reading-and-component-audit.md) supersedes the page-only current Find, small draft limit and hover-expanding header descriptions below. Whole-file virtual reading, native-attached edit/New file drafts, bounded journal catch-up and wrapped-flow fixes are implemented. Recorded artifacts remain separately paged/evidence-backed. Broader adoption, palette/component audit, native-segment continuity and release acceptance remain open.

16 October 2026. Latest builder direction supersedes84's earlier three-choice palette limit. Preserve Legacy/Canvas backups and the shared captured agent visualization. This is a sequence of independent commits, not a replacement harness or a blanket product-complete claim.

## User requests and implementation

| Before | After | Why / acceptance |
|---|---|---|
| A continuous stream could keep resetting a trailing refresh timer | Serialized refresh every bounded opportunity plus one trailing refresh | Live history updates before the burst ends; Follow can start stopped capture. Replay toggle never starts capture. |
| Pre-paint anchor effect depended on viewport-derived layout and could recurse to React185 | Corrections only on content/measurement changes; user gesture cancels pending automatic positioning; detached reading cancels reflow transforms only | Fix the black screen and card-centering competition. Keep live capture and replay clock independent. Real-session regression asserts visible materials do not snap after small manual scrolls. |
| Unexpected render failure produced a blank screen | Recoverable Reload / All sessions surface | Preserve an exit route without claiming the fallback fixes a faulty renderer. |
| Current Markdown was code-like raw text | Default Document view for Markdown, explicit Source view, stable complete bounded loading | Semantic headings/lists/tables/quotes/fences, exact source/drafts still separate. Preview limit5000lines/256KiB with explicit source fallback; no raw HTML or remote-media execution. |
| Fenced natural-language prompt looked horizontally cut | Text fences wrap by default; all fences have language/Wrap/Copy toolbar | Actual Skeletongraph answer was fully captured; visual allocation was the fault. Copy is exact; separately labeled one-line copy is plain-text only, never silently rewrites shell command semantics. |
| Shell command bodies/wrappers had little hierarchy | Shared highlighted command material, dim known leading tool wrapper, exact command copy | Text stays captured and selectable. Syntax coloration is display-only, not a semantic execution analysis. |
| Home advertised the sample | Drishya introduction + complete session library + explicit repository/star link | Real local sessions are the main task; explicit development/demo routes remain available. |
| Header title was squeezed in a solid-looking horizontal band | Three floating groups, centered bounded title pill, anchored hover/focus expansion that does not grow header allocation, scoped pointer targets | Canvas continues behind unused header space. No fabricated “executing” state or attention pulse. |
| Prompt always consumed its reading allocation | Minimize / Expand retaining draft and attachment state; compact approval/running/failure/connection indication and immediate Stop | Reopen deliberately; prepared native requests expand it. Does not interrupt a native turn. |
| Toolbox always occupied its rail | Collapse to one measured icon and restore; hidden instrument origins fall back to that real icon | Motion still comes from an actual visible home. Files retain their existing toggle; Workspace/Git retain explicit close controls. |
| Floating panels were mostly opaque | Bounded 16px blur on header groups, Files, Toolbox and composer; 75vh Files maximum and deep command-bar shadow | Layered HUD without shrinking the central world. Solid fallback when blur unsupported/low resources; automatic motion disabled by existing reduced-resource policies. |
| Three palettes only | Seven choices with shared semantic variables | Modern primary; retained backup versions keep their own design. No new independent frontend implementation. |

## Palette system

The stored identifiers `dark`, `light`, `midnight` remain compatible. Modern shows Jet Black (Linear Dark refinement), Paper (Pristine Light refinement), Midnight, Catppuccin Mocha, Tokyo Night, Nord and Gruvbox Dark. Additional IDs: `mocha`, `tokyo`, `nord`, `gruvbox`.

Implementation: `modern/theme-presets.css` bridges `--bg-canvas`, `--bg-panel`, `--bg-node`, `--border-subtle`, `--text-primary`, `--text-muted`, `--accent-active` to the existing application tokens. Syntax uses per-palette semantic hues. Active/focus colors and pass/fail meanings stay distinct. Tokyo/Nord secondary text was made more legible than the proposed darkest examples.

Measured **base token pairs**, not an application-wide accessibility certification:

| Palette | Primary on panel | Muted on node |
|---|---:|---:|
| Jet Black |16.00:1|5.27:1|
| Paper |17.74:1|4.55:1|
| Midnight |16.12:1|5.78:1|
| Mocha |11.34:1|7.89:1|
| Tokyo |10.59:1|5.63:1|
| Nord |10.84:1|5.09:1|
| Gruvbox |10.75:1|6.03:1|

The final palette layer explicitly outweighs earlier atelier/syntax selectors; browser assertions verify effective base/focus variables for all seven presets. Paper uses a restrained shadow. Collapsed Toolbox uses an instrument icon and retained-filter dot.

Rendered Home/session screenshots for each choice are private local acceptance artifacts. Screenshots establish static composition, not sustained-motion quality. Fonts remain locally hosted; no analytics/font-service dependencies were introduced.

## Current acceptance and next work

Use84 as the **ordered master queue** and85 as the independent component/adoption critique. The latest additions are not a substitute for the remaining investigation loop, whole-file find/current-version comparison, real native-account acceptance, meaningful map tasks and whole-product polish. Do not drop those when a new screenshot or bug arrives.

Both typechecks, production build and415units/68files pass. Three real-Git multi-snapshot integration tests have20s test budgets after measured5–7.5s Windows execution; product limits/assertions remain unchanged. Browser validation: the full156-case run had153 passes,2 explicit opt-in skips and one obsolete palette-parity expectation; its corrected focused rerun passes. Three additional actual redacted recordings (Skeletongraph Codex, Skeletongraph Claude, Drishya) pass history/manual-scroll/text-wrap/multi-file reading checks. Thus157 distinct browser journeys have passing final results across the full run and focused rerun; no single all-green full-suite claim. Five focused HUD/palette/Git journeys also passed earlier. No hosted CI. Final narrow/fullscreen, resource fallback and untouched-component audit remains mandatory before publishing; human/native/platform/assistive-tech acceptance is separate.

## Commit policy

Each purpose is a separate coherent commit: sustained live/black-screen fix, manual scroll positioning, complete Markdown/code reading, render recovery, retained-layout geometry, Home introduction, HUD controls, palette choices, and durable docs. Preserve user package-manager/artwork files. Never squash these increments locally into one giant authored change; normal final PR squash policy is separate from this reviewable branch history.


## Follow-up: long commands containing `@`

The builder supplied a wrapped PowerShell `@'` Python-script command as a reproduction. `Highlighted` previously returned the entire line uncolored above2000characters; long JSON-encoded scripts often hit that threshold. The shared highlighter now uses a forward lexical scan with bounded colored spans (512tokens/64KiB per programming line), preserving the complete remaining text as plain text rather than disabling the entire line. Scoped package/decorator names receive semantic property color. Unterminated quotes are consumed once instead of repeatedly searching a global string regex. This remains a lexical display aid, not an embedded-language/multiline parser. Document prose/plain logs remain uncolored by design.

| Before | After | Why |
|---|---|---|
| Entire long command lost color | Long strings/functions/numbers retain bounded semantic highlighting | Remove the abrupt2000-character visual cliff without unbounded DOM spans. |
| `@scope/package`/decorator prefix lacked a token | Property token preserving exact characters and following syntax | At-sign syntax should not interfere with subsequent expressions. |
| Only short material exercised highlighting | Regression covers long wrapped `@'` scripts, malformed/huge strings, token bounds and browser-computed color/exact Copy | Verify presentation and source fidelity together. |

Validation is recorded in the latest STATUS follow-up. No captured text, command execution, native policy or output indexing changes.
