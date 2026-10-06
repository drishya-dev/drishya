# Integrated local product — 6 October 2026

The builder's latest instruction is to **finish the working product in `apps/ui`**, with our best coherent presentation now, and refine colour and animation later. Standalone HTML studies are retained as references; they are no longer an approval gate or the deliverable. This document describes the implemented local product candidate. VISION still governs experience, and the B4 report still governs measured resource claims.

## What you can use

**Source reading refinement:** open the exact read excerpt directly from its preview range; deliberate expansion uses the full passage width and exposes historical provenance/ranges. Find highlights matching lines only in the loaded source page. Hover/focus clarifies the visible excerpt without moving the reader. [16](review/16-captured-range-reader.md) records implementation, tests and remaining source-navigation work.

1. Start the local daemon and open its authenticated launch link. The workspace groups imported recordings and discovered Claude Code/Codex journals by project. Search title/project, filter harness or date, import an existing session, or watch its journal. Discovery does not import everything automatically. Select several imported recordings to open one combined chronology.
2. Follow captured actions in the centre. A tool's request is visible before its result. When the result is captured it resolves beside the request. Reads show the captured source region; searches show file/line hits; edits show actual patches; shell/MCP activity has input and captured output; tests expose parsed outcomes with their derivation qualified. Agent prose is unboxed. Missing content and capture gaps remain explicit.
3. Scroll back, select or expand material without stopping capture. History keeps accumulating below; Back to latest is explicit. Large histories use the existing worker/page boundary and DOM virtualization. Captured text is never typed, artificially streamed or delayed behind animation.
4. Switch between Follow, Agents and Repository without opening another product. Agents adds a bounded ownership overview above the same chronological history. Counts describe shown work, not an invented whole-session total for a browser page. Captured children are distinguished from independent harness sessions. Repository explores the real file map; current static imports are not execution or causal connections.
5. Open a file from the working set, map or search. The file reader queries the **global** daemon file history in 24-action pages, supports filtering, and opens an action back in chronological history. Compare two recorded read/patch/state references side by side. Two explicitly selected references can survive a trail-page change, so distant moments can be compared without retaining every page.
6. Inspect provenance in the file reader. Before/after entries are labelled **state references** until the artifact reader loads the descriptor. Captured excerpts, derived reconstruction and unavailable states remain distinct. An earlier read is never silently substituted as an edit's immediate before-state. Ranges can differ; this is an evidence comparison, not a generated file reconstruction.
7. Use the existing since-your-mark digest and order-qualified verification freshness. Reading marks move only through explicit controls and support undo. Whole-recording verification is hidden during sequence replay; file choices obey the replay step. Optional playback/speed/scrubbing remains separate from ordinary live history.
8. Choose Charcoal, Light or System in Workspace settings. The preference applies to every task view and persists locally. Map geometry also redraws when the OS changes the effective theme. Map, relationship motion and low-resource controls are explicit; browser reduced-motion suppresses animated cues. Native reading dialogs contain focus, close with Escape and restore their trigger.
9. Export sanitized replay evidence using Export or the CLI. Bundles use the same readers without live capture/model calls. A served bundle can be opened with `?bundle=<URL>`; arbitrary downloaded-file upload is not implemented. Export/complete-projection memory is not certified for every large workload. Review exports before sharing: pattern redaction is best effort.

## Presentation baseline

The next integrated material pass is documented in [12](review/12-material-experience.md). **Watch the live demo** (or `?demo=live`) publishes built-in synthetic events into growing history, with requests before results; it is labelled synthetic on desktop and mobile. It never starts an agent. Material shells emerge from measured origins while actual captured text remains stationary/selectable. Pending patch input, aligned MCP arguments, multiline command preview, material silhouettes, four-pixel wide-screen margin overlap and a labelled repository reference strengthen presentation. This increment does not declare the final premium experience complete.

The 6 October material refinement gives the integrated charcoal world a coordinated graphite backing, jade source/navigation, copper edits and lilac external-tool identity; light uses darker corresponding roles. Source/edit/MCP headers have distinct reading edges, command inputs have a quiet backing, selection stays explicit, and agent prose has an unboxed identity rule. Hover transitions change only colour/border/background and respect reduced motion. Origin/resolve contours follow theme/material tokens rather than fixed dark colours. No captured content is delayed or animated. Reviewed dark/light frames and the existing 27 ordinary browser journeys; a fresh ten-minute synthetic reader passed (603,299 ms, 111 rounds, peak 582 history DOM nodes). Checked text/role tokens on world/material/header reach at least 4.85:1 charcoal and 4.67:1 light; this is not a whole-app accessibility certificate. The long-history wheel regression targets the actual history gutter, preserving nested scrollers and all original assertions; five repeated local checks and Linux/Windows CI pass. Human preference remains open.

One graphite world, softly differentiated reading materials, strong hairline boundaries around actual source/patch/output, a persistent recorded working set and real tool/MCP identities. Shared light mode uses paper/stone surfaces and stronger syntax contrast. Task views do not introduce separate brand palettes. Prose remains directly in the world. Source takes more width than compact outcomes; patches support adaptive, unified and aligned columns. Narrow screens use an explicit tool drawer and stack evidence columns.

The five existing finite moves remain evidence-backed: Lift, Emit, Settle, Surface and Resolve. Settings, file reading, theme/view switches and deliberate navigation cancel outstanding cues. There is no idle animation loop. This is a working baseline for later art-direction refinement, not a claim that the builder has approved the final aesthetic or that users prefer it to every competitor.

## Implementation boundaries

- `ProductShell.tsx`: shared theme application, native reading-dialog lifecycle and persisted resource controls.
- `Workspace.tsx`: task navigation and evidence-scoped agent ownership.
- `FileHistory.tsx` / `lib/file-evidence.ts`: global bounded trail, at most two retained comparison references, historical cutoff reset and honest artifact choices. Requests are keyed by recording, path, page, query, cutoff and rendered revisions; stale responses are never displayed under a new key.
- `ArtifactReader.tsx` / `common.tsx`: returned artifact provenance and captured range; 200-line source pages. Diff readers retain 120-line pages.
- `History.tsx`: the existing virtualized chronological reader; view/theme changes preserve its semantic anchor. No replacement fixture renderer, presentation queue or full-session copy is introduced.
- `Origins.tsx`: finite measured choreography and cancellation. Canvas shapes follow shared CSS tokens; DOM still renders every character.
- `product.css`: production tokens, layout, materials, modal and responsive rules. Older CSS and HTML studies remain references for gradual cleanup.

No observation schema, capture behavior, store migration or daemon runtime dependency changes in this delivery. Harsh's since/verification work remains separate and credited to its original authors.

## Run and validate

Use Node 24 and the repository's committed pnpm version, 10.34.5. In a checkout:

```powershell
npx pnpm@10.34.5 install
npx pnpm@10.34.5 ui:build
npx pnpm@10.34.5 serve
```

Open the printed launch link, choose Import or Watch live on a discovered session. Use the synthetic demo for a multi-agent story without importing private evidence. For nonstandard journal locations:

```powershell
npx pnpm@10.34.5 drishya sources
npx pnpm@10.34.5 drishya import "C:\path\to\session.jsonl"
npx pnpm@10.34.5 drishya list
npx pnpm@10.34.5 drishya storage
```

`import --live` tails until Ctrl+C; the home/crown Watch live control is usually easier. Repository scanning requires an explicit captured-root approval. A daemon restart prints a new authentication link; reopen it rather than reusing an expired browser credential.

```powershell
npx pnpm@10.34.5 check
npx pnpm@10.34.5 test:browser
npx pnpm@10.34.5 package:verify
$env:DRISHYA_P1_SOAK='1'
npx pnpm@10.34.5 exec playwright test tests/browser/p1-pacing.spec.ts --grep 'sustained live reading'
```

Browser tests require Playwright's installed Chromium; `DRISHYA_BROWSER_CHANNEL=chrome` selects installed Chrome for local testing. `package:verify` builds a checksummed isolated package, installs it offline, imports synthetic Claude/Codex recordings, exercises authentication/history and verifies persisted restart. The artifact is `dist/package`, with `BUILD.json` and `SHA256SUMS`; it is unpublished. Pre-existing local manifest/lock edits are excluded from product commits.

## Remaining acceptance and expansion

The implementation baseline covers B0–B4 engineering and P1/P2 reading utility. A release still needs physical low-resource/lower-core acceptance, real macOS/Linux journeys, a human comprehension/preference pilot, versioned harness compatibility and release provenance. Existing measured reference-machine results are preserved, not generalized to unmeasured devices or arbitrary huge edits. Contract freeze still needs both builders.

After trying this integrated product, refine material hierarchy, palette, motion timing and layout **on real captured fixtures**, with freeze/truth/ten-minute checks. Additional harnesses, consumer ChatGPT/Claude imports, a desktop/runtime wrapper and richer export packets remain separate expansion work. Consumer chat sessions are not the same integration as Claude Code/Codex journals. Remote model explanations remain optional and live-provider validation remains open; no key is required for the local core.

Do not restart with another isolated HTML prototype or a backend rewrite. Preserve passive capture, evidence distinctions, shared task views, bounded global navigation and the reader's authority over their position.
