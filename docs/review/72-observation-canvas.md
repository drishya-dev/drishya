# 72 — Observation canvas presentation

15 October 2026, Harsh with Codex, local `codex/picgen-redesign` after integrating
main through `1733c98`. Continues the existing local PicGen foundation in review
71 and preserves the independent Workbench draft from the other review 71.

## Builder instruction and precedence

The pasted brief explicitly requests a read-only node canvas: no prompt, approval,
command execution or file editing controls. This supersedes the earlier native
composer layout for this new presentation. Native protocols and consent policy
remain implemented in the retained Classic/Workbench versions. The default Canvas
uses the existing `api.ts`, Zustand state, scene composer, historical projections,
history pages, search and artifact readers. There is no capture/store/schema or
production daemon change.

The attachment contains the written specification, but no reference image files.
The available written dimensions, materials, type, colors and motion guide this
implementation. Exact side-by-side similarity to those missing images has not
been certified. The earlier supplied PicGen reference remains recorded in 71.

## Delivered composition

- 56 px header: brand, Follow/Agents/Repository pills, session title, search,
  recorded briefing, settings, white live/follow pill and sanitized export.
- 56 px icon rail; floating activity panel with captured agents, observed native
  and MCP counts, compound tool/agent switches, and evidence-backed working files.
- A pan/zoom DOM world with a static 22 px dot grid. Content-shaped 292 px cards
  show captured source lines, search hits, patches, command output, runner facts,
  MCP inputs and helper descriptions. Missing results remain explicit.
- Curved SVG order links, bounded ports, a recorded-order legend and explicit
  captured helper branches. No temporal link is described as a cause. An unloaded
  passage interrupts the next-action chain rather than inventing adjacency.
- An independent 380 px source/result reader with full bounded artifact/diff
  controls, copy, file history, previous/next and visible-line navigation. File
  history uses the shared bounded reader as a floating modeless reading space.
- Unboxed captured prose, one horizontal lane per agent, and a derived file-map
  layout with indexed static-import edges and evidence-backed activity colors.
- Bottom search/jump bar, sampled timeline, zoom/Fit, status, optional replay and
  an explicit return to new activity. Search stays local and respects replay's
  evidence cutoff. Long-session marker jumps use the existing whole-recording API.
- Saved explicit UI choices survive a launch without a query. Reconnect status
  qualifies cached reading, and material copying excludes interface controls and
  line-number gutters.
- Session Home retains real discovery/import/loading/retry and workspace/time
  grouping, with floating project groups and an Import entry.
- Local Outfit and JetBrains Mono WOFF2, their redistribution licenses, exact
  charcoal/blue/yellow/magenta/mint roles, white primary pills, and Dark/Light/System.

## Motion, reading and resources

The real card enters by 8 px/260 ms; its connector draws over 320 ms. A read uses
the real visible file-row origin for its header icon's 500 ms lift; other tools
receive one finite emphasis. Outcome glyph/pill feedback is 150/200 ms, with one
400 ms failure outline. The occasional pointer-opened reader enters by 12 px over
220 ms. Camera Fit uses the explicitly requested 400 ms transform. Body text is
never typed, duplicated for a visual effect, or withheld until a cue completes.

Camera movement is interruptible. Panning, zooming and selecting evidence detach
following. Live ingestion and explicitly playing replay continue. Following
responds to new actions and captured prose; detached reading offers the new-step
count and Back to latest. Scrolling inside a card/result remains local.

Only nearby nodes/prose mount; selected evidence is retained. Caps are 96 nodes,
28 groups, 240 order connections and 80 timeline marks. Low resource mode reduces
nodes to 32, file labels to 40, disables motion and removes the dot field. Stored
artifacts retain their byte-bounded shared cache and explicit source/diff paging.
Worker history pages are reused rather than loading a long recording wholesale.

The required `emil-design-eng`, `animate` and `review-animations` local skill copies
and installed redesign skill informed interaction choices. Explicit builder
timings override the generic 300 ms skill ceiling for Fit/file-origin movement.
The landing-page taste workflow excludes app screens and was not used to choose
a different visual direction.

## Validation and scope

| Before | After | Why |
|---|---|---|
| One polished history shell for every presentation | Scoped observation canvas and explicitly retained alternatives | Follow the builder's specific layout and read-only brief |
| Reader search anchor remained active after opening | Consume the observation once it is located | Closing the reader must not reopen the same result |
| Full-recording marker helper received an as-of subset | Compute marks from the complete projection and apply the replay boundary | Avoid missing-operation errors and future evidence |
| Camera rerenders could cancel owned arrivals | Keep finite animations until completion, interruption policy or unmount | Preserve continuous arrivals while following live work |
| Theme tiles kept an older minimum width | Let the existing grid shrink each tile | Fit the retained 390 px Settings surface without overflow |

New layout units check non-overlap, recorded order, exact captured helper links,
unloaded-passage boundaries and replay visibility. New browser journeys exercise
the real application/daemon paths, local fonts, absence of native action controls,
source/history reading, keyboard navigation, compound focus, repository files,
System appearance changes, reduced motion, low resources, phone/landscape bounds,
paged global jumps and live follow/detach/return.

Existing Classic journeys now select their retained presentation explicitly via
`tests/browser/legacy-test.ts`; their evidence/anchor/native assertions remain.
Fresh's independent acceptance stays separate. Final Windows Node 24.11.1 gates:

- `check`: both typechecks and **371 unit tests pass**.
- Complete `test:browser`: **128 pass / two opt-in skips**. The subsequent scoped
  light-hit-path/version/reconnect/copy corrections pass all **21 focused
  Canvas/Settings/Workbench journeys** on the final source; this count overlaps
  the complete sweep and must not be added to it as new distinct cases.
- Final `package:verify`: isolated offline install, Claude/Codex synthetic import,
  demo bundle, authenticated API and persisted restart pass.
- Settled dark/light/phone browser review: no page errors or horizontal document
  overflow, with local Outfit loaded and bounded source material retained.

The scripts used the existing cached pinned pnpm 10.34.5 after sandbox Corepack
tried a registry download. Normal local test permissions were needed for temp
renames, symlink fixtures and loopback/browser processes. No hosted CI or real
native account turn is triggered.
Private `.local` stores, tooling, references and screenshots are excluded.

The full unit gate exposed a pre-existing mock-protocol race: approval can precede
the optional runtime inventory response. Separate commit `61edf65` makes that
test poll the inventory itself; all 16 controller tests pass in its focused run.
Production controller code is unchanged.

Separate test-only commit `a28311d` follows a consent/refresh locator when the
saved workspace permission resolves between a visibility check and a click. The
same Git revalidation assertions pass; production Workbench behavior is unchanged.

This local candidate does not replace the existing physical low-resource,
platform, assistive-technology or human comprehension release acceptance.
