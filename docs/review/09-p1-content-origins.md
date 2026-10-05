# P1 — a working world, readable evidence

5 October 2026. P1 presentation implementation is complete; final acceptance and exact-head CI are being closed on PR #23. This is an engineering candidate, not a claim that the visual identity is final or that users already prefer it to their terminal. B4 physical/platform release checks remain open. Harsh's P2-A reading marks are merged separately through PR #21 (`d190586`).

## The creative bar

The builder's latest direction is explicit: **a different background, attractive boxes and tool-call labels are not the product.** Presentation must make the actual work intelligible while it happens. Theme, colour, motion, pacing and content composition all matter. The desired effect is a world with stable origins and readable consequences, not a decorated transcript. Do not declare the ambition satisfied merely because the five animation names exist in code.

Keep the older prototype's spatial grammar: agents above, repository behind, instruments to the right, actions progressing left to right, agent prose underneath and history continuing down. Improve it through real evidence, responsive reading space and interruption, rather than transplanting hard-coded events. `docs/prototype/index.html` was reviewed as source; browser policy refused its file URL. The production React UI was reviewed in the browser repeatedly, including expanded changes and older history. No visual validation of the blocked prototype is claimed.

## What now exists

### A repository that participates

`RepositoryLens` exposes the same graph geometry in the left gutter while the larger world recedes behind the reading column. It renders actual nodes and static imports, with activity/edited-file marks. Hovering a file emphasizes its real structural relationships and its visible source material; selecting a node opens recorded work. The Repository control opens keyboard-searchable exploration, with at most 30 matching file buttons. No current workspace content is silently substituted for an old captured excerpt.

Both renderers publish bounded, invisible DOM geometry anchors: at most 64 active/hovered locations each. These anchors do not paint a second set of dots over prose. Lift uses the actual visible background node, or the visible node in the repository lens when the world node is covered. If neither is available, it uses a labelled **File reference** fallback. Hidden/unknown origins never get guessed coordinates. The lens does not scan a workspace, bypass map approval, infer runtime flow or fabricate import edges. The combined synthetic demo currently contains recorded file locations without import edges; that limitation is labelled, not disguised with invented links.

### Material instead of uniform cards

`presentationOf` allocates compact, medium, source or wide reading space from the captured content. The remaining column—not the outer browser width—controls packing. Reads and substantial edits have priority; short commands/tests remain smaller. At narrow widths the materials stack without reducing source text size. Inspector space is reserved so it cannot cover expansion controls.

- Reads show twelve captured preview lines and open bounded 200-line pages. Range captions distinguish a read range from the excerpt actually returned; an oversized requested range is not proof that all those lines were received.
- Changes offer Adaptive, Unified and Side by side layouts. Adaptive switches at 880 px of actual reading width. Split columns align **captured patch order**, preserve known old/new numbers and leave unknown or missing states blank. They are not reconstructed whole files or a semantic line-matching claim. Soft wrapping avoids one horizontal scrollbar per source line; a deliberately selected split layout remains horizontally navigable on a small screen. Both layouts cap a page at 120 original patch lines.
- Terminal previews keep the command and result together. Long captured previews fold their middle behind an explicit count; head and tail remain. Expansion restores the captured text, and full output uses the paged reader. This is not synthetic streaming.
- Searches display captured matching excerpts linked to recorded file work. MCP results use bounded field lists/tables when the captured JSON supports them, with access to the original preview. Invalid/nested JSON stays text; no returned HTML runs.
- Tests have a grouped outcome strip: individual marks up to 60 reported outcomes, then proportional aggregate segments. A red failure notch is taller than a pass mark, and its action opens the captured assertion in place. Counts are explicitly parsed from captured output. Grouping does not imply execution order, individual test identity, source coverage or verification freshness.
- Agent prose is unboxed, readable and selectable. Its identity rule and exposed-reasoning qualification remain. Copying a captured reader page gives inline confirmation without moving the text.

### The five moves are semantic

`choreographyBetween` is a pure function of the previous scene, the new scene and available timeline. It emits bounded plans for actual tool starts, tool outcomes, exposed prose and a known passage becoming settled. Combined recordings can repeat source sequence numbers: **global timeline position is the presentation clock**. Large-history projections carry a trailing 128-step window; its global offset is explicit. Initial loads, rewinds and same-step page mounts never replay arrivals.

`Origins` measures the DOM after history following has placed the new material. Only an empty contour, relationship path or margin rule moves; the captured characters remain at their final size and immediately available.

| Move | Implemented meaning |
|---|---|
| Lift | File material connects to an evidence-matched, visible renderer node; otherwise a labelled file reference |
| Emit | The observed native instrument or named MCP server connects to its invocation; its result stays in that invocation |
| Settle | A prior known passage receives a finite margin-only rule when it becomes earlier work; its text is retained |
| Surface | Actual exposed prose connects to its actual agent presence and resolves its identity rule; never a rectangular prose frame |
| Resolve | A captured outcome resolves once, with success/failure/unknown tone; the renderer does not infer a result from elapsed time |

At most three starts, three outcomes, two prose arrivals and two settles are considered in one update; only visible targets animate. Contours finish within 560 ms and are removed. Scroll, selection, keyboard intent, focus and resize interrupt them. The old separate map arrival loop was removed so motion has one owner. Hovering alone does not stop capture or viewport following. Motion off and OS reduced motion remove choreography without shortening reading time or hiding evidence.

A render-frame race was fixed: synchronous layout/hover updates could cancel an effect after it consumed its semantic change but before its first frame. The change is now consumed only when measured. A measured follow scroll can land afterwards and bring initially offscreen prose into view; that scroll retries only this update's unshown cues, with emitted identities preventing duplicates. Captured text never waits for these frames. The live five-move journey passed five consecutive runs after this fix.

## Camera and capture

A tool's input is visible before its result. Capture never waits for animation. Short arrivals may follow naturally; bursts and substantial prose/output keep the reading camera at the earlier anchor while all new work accumulates below. Returning to latest is explicit. Normal history has no mandatory movie transport; recorded sequence replay remains optional and content-aware.

Every deliberate wheel direction, text-selection start and keyboard focus inside a passage detaches follow. A wheel at the scroll boundary must not leave the navigation guard stuck. During a one-frame programmatic-scroll guard, only the exact commanded scroll position is ignored; a genuine intervening reader scroll must still update its viewport and anchor. The earlier Windows paged-reader CI failure and the sustained-reader exercise exposed related cases. The shared viewport fix was also included in Harsh's PR before merge.

## Validation record

- Typechecks, all 223 unit tests and production build passed. Scene goldens are unchanged; no event-schema modification.
- All 14 synthetic browser checks passed; real-session and ten-minute journeys are opt-in and skipped in the ordinary suite. Checks cover live input before output, all five observed cues, bounded finite animation, burst hold/return, MCP input/result, adaptive patch reading, terminal folding, keyboard map search, reduced motion, measured renderer coordinates, occlusion/overview fallback, map-off fallback and actual failed-assertion inspection. Existing live/reconnect, long mounted-DOM and global paged search/replay checks remain. Tests pin a nonempty captured source line and let wheel dispatch settle before measuring; the synthetic occlusion surface has no entrance animation.
- The opt-in ten-minute exercise passed: 602,297 ms, 112 live tool/result/explanation rounds (336 added steps), peak 509 DOM nodes. Each round preserved the captured passage and reading offset within 2 px, reached latest within 2 px on explicit return and left no active contour while reading. Its first run found an anchor race after several minutes; the exact-position programmatic-scroll guard fixed it. This is automated synthetic reading acceptance, **not a human comprehension study**.
- Normal-workload probe: 10,101 initial observations, five 200-record additions, 5,000 files, map on, Edge at 1440×900. With a simultaneous traced reader exercise, open 5.59 s; update p50/p95 505/843 ms; heap 31.58 MiB; 920 DOM nodes; sampled peak daemon RSS 413.75 MiB; viewport-next-frame p95 4.4 ms. This meets the roadmap's 1.5 s visible-update and normal-workload resource bounds on this reference machine, but is not a dropped-frame/whole-browser-RSS certificate. A preceding pre-lens run was 256/397 ms and 413.77 MiB. Do not present these distinct runs as a controlled improvement comparison.

Reproduce:

```powershell
pnpm check
pnpm test:browser
$env:DRISHYA_P1_SOAK='1'
pnpm exec playwright test tests/browser/p1-pacing.spec.ts --grep 'sustained live'
Remove-Item Env:DRISHYA_P1_SOAK
node scripts/bench-browser.ts --observations 10000 --files 5000 --map --repetitions 5
```

On this machine the optional `DRISHYA_BROWSER_CHANNEL=msedge` used the installed browser. CI uses its installed Chromium. Real sessions were not imported for this presentation work. Screenshots, trace artifacts, source selections and model-planning notes stay local.

## What the next builder must preserve

This renderer retains Canvas 2D, DOM code and the existing highlighter: the measured bounded working set does not yet justify introducing PixiJS/CodeMirror just to attach their names to a milestone. Those remain replaceable options for large interactive maps and deeper source reading. The pure scene/data-source boundary and bounded readers are preserved. No new runtime dependency, harness control, telemetry or remote model call was added.

P1 is not the final visual identity or proof of a market moat. Keep iterating against real reading tasks. P2 should make the spatial account useful: complete file-centred comparison/history and evidence-backed verification freshness, building on the already merged reading mark. Match real source identity across reads/edits, keep chronology separate from reason, and test time to locate a change and an unresolved issue against the harness transcript. Human preference and ten-minute comprehension belong to that pilot; they cannot be inferred from green browser tests. Theme exploration must improve hierarchy and semantic motion rather than add wallpaper or ungrounded activity.
