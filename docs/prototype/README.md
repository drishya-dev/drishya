# Prototype — the continuous canvas

An interactive design prototype of Drishya's core experience, built to make [`VISION.md`](../VISION.md) tangible. **Synthetic data only.** Every event is invented to tell one coherent story; nothing here reads a harness, and it must never be presented as a working integration.

It is the current design reference, in the clean developer-tool theme described in [`VISION.md` §5](../VISION.md#5-theme-a-clean-developer-tool). The obsolete storyboard and app concept gallery were removed at the builder's request. Both prototype HTML references remain; the integrated app is the deliverable. See [motion lifecycle](../PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#22-p1-motion-lifecycle).

## Deep links

Open any moment directly, paused: `index.html?at=16` (the failing test), `?at=22` (the edit and rerun), `?at=end`. Add `&motion=0` for the reduced-motion view. Useful for sharing a single step and for deterministic screenshots.

## Run it

One self-contained file with no dependencies and no network calls. Serve `docs/` and open `prototype/index.html`:

```bash
python -m http.server 5178 --bind 127.0.0.1 --directory docs
```

Then open <http://127.0.0.1:5178/prototype/index.html>. Opening the file straight from disk also works in most browsers.

## The story it tells

A developer asks for free orders to reach checkout. **Claude** reads the guard, searches for `total`, and asks **context7** how falsy and nullish checks differ, then explains the bug in its own words. An **explore** subagent splits off to search the tests. Claude reads the discount logic and runs the suite — **one test fails**. It narrows the guard, the rerun **resolves** the failing test, and a **GitHub** search finds the same pattern elsewhere. **Codex** then reviews the change.

## What to look for

| Move | Where to see it |
|---|---|
| **Lift** | A file's node on the left spine brightens, and its content travels out as light and settles into the passage |
| **Emit** | A search or shell call leaves its instrument in the right dock; an MCP server opens like a drawer, and the call comes out of the named tool |
| **Settle** | Earlier operations ease back and overlap only at their margins, titles and excerpts still readable |
| **Surface** | The agent's words rise beneath each passage, set directly on the world, resolving into focus — never typed |
| **Resolve** | The failing test is a red notch that opens its assertion; the rerun turns the same test into a green tick |
| **Heat memory** | The map glows where work happened and cools slowly; the failing test file glows red, the edited file keeps a warm ring |
| **Evidence hairlines** | Hover a search: fine filaments run from each result row to the exact file it matched |

## Try

- **Hover** any operation to light its origin. **Hover** a file on the left spine to light every operation that touched it.
- **Click** an operation to lift it forward and hold playback while you read. Selecting text holds it too.
- **Click** an agent, a tool or an MCP server to follow only that work. `Esc` clears.
- **Scroll** away while it plays: playback continues, following stops, and a "New activity below" pill appears.
- **Explore map** (`X`) — drag to pan, scroll to zoom, click a file to see its work.
- **Scrub** the filmstrip, or step with `←` `→`. `E` jumps to the next edit, `F` to the next failure, `Space` plays and pauses.
- **Motion** (`M`) off: the same scene, the same information, with no movement. **Map** off: review still works.

## What it proves — and what it does not

**30 September direction:** this remains a synthetic interaction reference, not the final frontend. Its play/pause filmstrip is useful for testing and optional recorded playback. The final live app keeps accumulating history while the reader scrolls back; it does not require a timed playback cursor to reveal new work. Port useful interactions into `apps/ui`, keeping real API integration. See [PRODUCT_DIRECTION](../PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#product-direction) and [IMPLEMENTATION_ROADMAP](../PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#implementation-roadmap).

It demonstrates the composition, the five signature moves, retention and overlap, evidence-linked hover, holding and following, filters, explore, scrubbing, reduced motion and phone width.

It does **not** demonstrate real capture, history virtualization for long sessions, production pacing under overload, the Pixi renderer (the map here is Canvas 2D), CodeMirror, or any performance budget. Those are implementation work described in the [engineering plan](../review/03-engineering-plan.md).

## Structure

Mirrors the product's layers: `#map` (canvas, repository map) · `#tethers` (SVG, origin filaments) · `#history` (DOM, the continuous canvas) · `#crown` / `#dock` / `#film` (agents, instruments, transport). All text is DOM; the canvas draws no characters.

The scene is **deterministic**: `seek(n)` rebuilds any moment from the recording, and map heat is a pure function of the playback position. Every animation is tracked, so any deliberate interaction can finish it instantly.

## Sacred Timeline (GIT-1)

`sacred-timeline.html` is step 1 of [124](../review/124-sacred-timeline-git-graph.md): the Git graph as the Loki Sacred Timeline, on **synthetic topology only** (main plus four branches, two merged, two unmerged). WebGL2 draws light only: hundreds of hair-fine additive filaments per bundle into a half-float buffer, a three-level bloom and a tone map, so the white-hot core comes from overlap rather than paint. Merged branches arch out of the river's rim and fade back into it; only unmerged heads split into lightning, and the real head stays the brightest point with its DOM ref label. Commits are DOM buttons (hover or focus dims other strands; arrows move between commits; Escape closes the peek). No text is drawn in WebGL.

Compare the three variants with the buttons or keys `1`–`3`, or open `?v=river`, `?v=ice` or `?v=storm`. `?lite=1` halves the filaments and turns bloom off (the low-resource budget). Integration into `GitThreadGraph` waits for builder sign-off on these stills.
