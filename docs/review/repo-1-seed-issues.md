# Seed issues for the public repository

The GitHub Issues to open when the repository becomes public, taken from the open next-release and later items of the private task list. Open them by hand (or paste each block into the matching [issue template](../../.github/ISSUE_TEMPLATE)); nothing here has been created. Each block gives a title, the labels, a body a contributor can act on, and the Product Work History IDs where the earlier thinking is (search the [history](../PRODUCT_WORK_HISTORY.md) for the ID).

## Labels to create first

| Label | Use |
|---|---|
| `good first issue` | Small, self-contained, with a clear way to check it |
| `help wanted` | Needs a person or machine the maintainers do not have |
| `harness integration` | Reading or controlling another coding agent |
| `bug`, `enhancement`, `docs`, `question` | GitHub defaults |
| `schema` | Touches the event schema; both maintainers must agree |
| `decision` | Waiting on a recorded maintainer decision |
| `area: capture`, `area: canvas`, `area: map`, `area: privacy`, `area: ui`, `area: git`, `area: files`, `area: content`, `area: perf`, `area: site`, `area: release`, `area: test` | Where in the product it lives |

Every issue inherits the rules in [AGENTS.md](../../AGENTS.md): capture stays passive, redaction happens before storage, and a change that shows or projects captured content is checked on real sessions of the harnesses involved (see [CONTRIBUTING](../../CONTRIBUTING.md)).

## Harness integrations

### 1. Antigravity: follow a session live, with background commands and subagents (AG-3)

Labels: `harness integration`, `area: capture`, `enhancement`

Antigravity sessions are read after the fact. Follow a session as it is written (the live tail), show background commands as they run, and show subagent conversations nested under the parent. Keep it passive and read-only. Done when a live Antigravity session appears step by step in History within a second or two, a background command and a subagent each show with their own content, and the cases are checked on a real Antigravity session (not only the synthetic fixture). Earlier work: AG-1 to AG-5, [`antigravity-ag3-live.md`](antigravity-ag3-live.md).

### 2. Antigravity: details from its local database (AG-6)

Labels: `harness integration`, `area: capture`, `enhancement`, `schema`

Enrich Antigravity sessions with what its per-conversation database records and the transcript does not: exit codes, applied diffs, branch, model, token use and durations. Read the database copy-free and read-only with a small hand-written reader; add no runtime dependency and skip unknown fields. Done when each added fact is shown labelled as captured, missing values stay visibly missing, and the contract change is additive. Earlier work: AG-6, [`antigravity-harness.md`](antigravity-harness.md).

### 3. T3 Code: embed Drishya in its preview pane and read its sessions (exploring)

Labels: `harness integration`, `help wanted`, `question`

T3 Code is an open-source agent app with desktop, web and mobile clients. Our source reading ([`embed-1-in-app.md`](embed-1-in-app.md)) found a desktop-only preview pane that could host Drishya as a top-level guest view. Nothing has been built or agreed with its maintainers. Open to anyone from the T3 Code side, or with a working setup, to say whether this is wanted and what a session recording looks like. Done for this issue when there is a written plan: capture source, where the pane opens, and what would need to change on either side.

### 4. Hermes Agent: find and read its session recordings (exploring)

Labels: `harness integration`, `help wanted`, `question`

Find where Hermes Agent records its sessions, in what format, and what it records of reads, commands, edits and outputs. Done when there is a short note listing the location and format, a sample of synthetic records, and an assessment against [the adapter guide](../CODEBASE.md#adapters--how-to-add-a-harness). Do not commit a real recording.

### 5. Cursor: adapter from local sessions (ADAPT-1)

Labels: `harness integration`, `area: capture`, `help wanted`

A first look at Cursor's local history was done on one machine and not taken further. Write a short note on where the sessions live and what they record, then, if workable, an adapter that follows [the adapter guide](../CODEBASE.md#adapters--how-to-add-a-harness) with synthetic fixtures. Do not commit real recordings.

## Product features (next release)

### 6. Embed command and launcher (EMBED-2a)

Labels: `area: release`, `enhancement`, `help wanted`

`drishya embed` and the launcher that lets a harness app open the session view for the current session as a top-level guest, never an iframe. Follows the contract in [`embed-1-in-app.md`](embed-1-in-app.md) (loopback only, request gate and cookie rules kept). Done when the command resolves the current session, starts or reuses the daemon, and prints a URL the host can open; the security tests in `tests/security` still pass.

### 7. Embed view, reference host and integration guide (EMBED-2b)

Labels: `area: ui`, `enhancement`, `help wanted`

The narrow side-pane layout (Conversation by default, no map below 600 px, 360 px minimum when embedded) with a full-screen control, a minimal working reference host, and a guide for harness owners. Done when the view works at the embed size on real Claude Code and Codex sessions in all three palettes, the reference host opens it, and the guide lets someone else integrate without help.

### 8. Lit files on the map (MAP-3)

Labels: `area: map`, `area: ui`, `enhancement`

The file the agent is on is pulled forward on the repository map with its name and file type; the rest of the map stays a quiet field. Must read as premium and cost little (no per-frame React work, no text in WebGL). Done when it works live and in replay, the three freeze, truth and ten-minute tests in AGENTS.md hold, and reduced motion and low-resource modes show it without movement. Earlier work: [`map-3-lit-files.md`](map-3-lit-files.md).

### 9. Manage Drishya's local storage (STORE-1)

Labels: `area: ui`, `enhancement`

Settings shows the total local storage and each imported session's size, and lets a person clear chosen sessions' data after a clear confirmation. Clearing removes that session's observations, blobs and search entries from Drishya's own store and never touches the harness's journals. Done when sizes match the store, clearing is reversible by re-importing, and a session that is open or live cannot be cleared by mistake.

### 10. One-click repository setup (CONNECT-4 and CONNECT-4b)

Labels: `area: ui`, `area: files`, `enhancement`

A repository's permissions (reading current files, the repository map, the controller) are asked once, in one compact sheet before its session opens, with "Remember for this checkout" on by default, and a Settings list of remembered checkouts. The grant logic exists; the sheet and the list in the current UI do not. Done when first open of a repository shows the sheet, a sibling worktree is pre-filled, nothing inside the session asks again, and revoking works. Earlier work: [`connect-4-repository-setup-proposal.md`](connect-4-repository-setup-proposal.md).

### 11. More palettes, each a whole system (UI-40)

Labels: `area: ui`, `enhancement`, `decision`

Three palettes ship (Jet Black, Daylight, Midnight). Add more, each designed as a complete system for a developer tool (a black-and-white class first), chosen from frames of real screens, not a colour swap. Needs a maintainer's yes on each palette before it is built. Done when the palette meets the same contrast contract as the shipped three (see the [SHIP-17 entry](../PRODUCT_WORK_HISTORY.md#ship-17)) on every surface, including the Git graph and diffs.

### 12. Motion evaluation on long live sessions (MOTION-3)

Labels: `area: ui`, `area: test`

Evaluate live and replay motion over a ten-minute real session: origin to whole material to settle, hover entry and exit, reflow and scroll, bursts and late results. Done when each finding is a fix or a recorded reason, and nothing implies motion the data cannot support (no fake typing, no invented reasoning).

### 13. Squeezed first Explore (MAP-2)

Labels: `good first issue`, `bug`, `area: map`

Opening Explore straight after loading a recording can draw the whole map squeezed into the top-left corner with no labels, and Fit does not recover it; leaving and re-entering Explore does. Seen on a 108-file and a 307-file Claude Code session. Done when the map is fitted on first open and after a reload that kept a far-out camera, with a browser test that fails before the fix.

### 14. Opt-in draft recovery (FILES-5)

Labels: `area: files`, `enhancement`, `decision`

Workspace drafts are memory-only. Design an explicit opt-in way to keep them across a crash or reload, without storing edited text unless the person turns it on. Keep download and the unsaved warning meanwhile. Done when the design is written and agreed, then built with redaction before storage.

### 15. A session credential another local web server cannot replay (SEC-6)

Labels: `area: privacy`, `enhancement`

The session cookie has no port scope, so a different web server on `127.0.0.1` that the same browser visits receives it. Accepted for 0.1.0 (a replayer must itself be a program on the machine; see [the threat model](sec-3-threat-model.md)). Find a credential scheme that closes it without breaking the launch link, SSE, or the embed view. Done when a test shows another loopback port cannot replay the credential.

### 16. "Waiting for you" from an opt-in hook (DATA-11)

Labels: `area: capture`, `harness integration`, `schema`

A pasted, asynchronous, print-nothing command hook (Claude Code `Notification`, Codex `PermissionRequest`) appends an allow-listed line to a Drishya spool; the card shows how long the agent waited, labelled "from hook". First confirm on real signed-in sessions that the events fire, `async` is honoured and the cost on an interactive exit is negligible. Drishya never edits harness configuration. See [`data-9-hooks-otel`](../PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#data-9-hooks-otel).

### 17. Frames from Codex typed computer-tool results (NATIVE-5a)

Labels: `area: capture`, `area: content`, `bug`

A real browser run recorded screenshots inside typed child tool results, and the Screen view showed three steps and zero frames. Pass directly nested images through the existing redaction and size limits and show them in Screen. Done when a real Codex browser session shows its frames and a synthetic fixture covers the nested shape.

### 18. Page-side latency on journals over 166 MB (PERF-3)

Labels: `area: perf`, `decision`

Memory and server stalls pass, but page-side latency on 166 to 347 MB journals misses the targets (request p95 median 214 to 329 ms against 100; visible update 1.9 to 2.7 s against 1.5 s). Either bring it down or add an opt-in setting between faster live updates and fuller graphics. Needs a maintainer decision first; both paths are in the [history entry](../PRODUCT_WORK_HISTORY.md#perf-3).

## Real-world acceptance (help wanted)

### 19. Run on macOS and Linux and report (MAC-1, REL-2)

Labels: `help wanted`, `area: release`, `area: test`

0.1.0 is built and tested on Windows 11. Run the install, the packaged tarball, `pnpm check:affected`, `pnpm test:security`, the browser suite and a real Claude Code or Codex session on macOS and Linux and report what fails. Include OS version, Node version and the command. Do not paste session content.

### 20. Keyboard, zoom and assistive-technology pass (REL-3)

Labels: `help wanted`, `area: ui`, `docs`

A human check of keyboard operation, browser zoom (100 to 200 percent), screen readers and reduced motion across Home, History, the composer, Workspace and Git. Done when findings are filed one per issue with the surface, the setting and what happened.

### 21. Real signed-in journeys: Codex, Claude Code, multi-agent and conflicts (NATIVE-1 to NATIVE-4)

Labels: `help wanted`, `area: capture`, `area: test`

Exercise the opt-in controller with real accounts: text, files, folders, images and pasted screenshots, model and effort choices, exact approvals, edit and create results, stop, reconnect and the competing-client acknowledgement; then genuine multi-agent sessions and the native edit/create conflict path. Done when each case is recorded as a verified case in `scripts/real-cases/` or listed with why it could not be run. Never commit a personal recording.

### 22. Genuine desktop computer-use sessions (NATIVE-5)

Labels: `help wanted`, `harness integration`, `area: content`

The Screen view needs captures from real desktop computer-use sessions of Claude Code and Codex; none were available. Produce a throwaway session on a scratch repository and record the case; do not commit real personal screens.

### 23. Antivirus conflict and managed-runtime update (REL-1)

Labels: `help wanted`, `area: release`, `question`

Verify that a supported idle-time update of the managed runtime resolves the recurring antivirus conflict seen on Windows ([`38-windows-antivirus-audit.md`](38-windows-antivirus-audit.md)), never interrupts active work and never asks anyone to change antivirus protection.

## Quality and maintenance

### 24. One Modern stylesheet layer behind a pixel-diff guard (UI-26)

Labels: `area: ui`, `area: test`, `good first issue`

Modern still layers several older stylesheets. Fold them into one layer without changing any pixel, guarded by a pixel-diff check at 600 and 1440 px in all palettes. Done when the layers are one and the diff is zero.

### 25. Finishing pass over every surface (FINISH-0 to FINISH-13)

Labels: `area: ui`, `enhancement`

The finishing pass went component by component (tokens and buttons; popovers, menus and dialogs; loading, empty and error states; Home; header and Usage; Conversation; composer; action cards; History flow; Toolbox; Files; Workspace; Git; search and palette; replay, settings and the map). Much of it landed under other IDs. Re-triage each surface against the current product and open one issue per remaining gap, citing the [FINISH entries](../PRODUCT_WORK_HISTORY.md#finish-0a) and [`finish-pass`](../PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#finish-pass).

### 26. Feature-by-feature product audit (AUDIT-1) and usefulness pass (COMP-1)

Labels: `area: ui`, `docs`

Walk each feature as a user, compare with the agent's own app, and list what is badly presented or only half handled by the backend. Then, per component (Git review and graph, Workspace, Files, Search, Review packet, Home, Inspector, composer), ask what a developer still needs. One issue per finding, not one big one.

### 27. Joined investigation route (REVIEW-4)

Labels: `area: ui`, `enhancement`

A recorded failure or change, to the exact captured source, to the current file or draft, to an anchored question or correction, to an explicit native submission, to the actual resulting diff or check, and back to the original evidence, as one route. Needs real signed-in sessions (see issue 21).

### 28. Tests view across runs (TESTS-1)

Labels: `area: ui`, `enhancement`, `decision`

A Tests view in the Review tools menu: every run in a session and every failing case, tracked across runs. Deferred because it is unclear anyone opens it first. Decide whether to build it before doing so.

### 29. The repository map's purpose (MAP-1) and task-shaped views (VIZ-1)

Labels: `area: map`, `area: ui`, `decision`

The 3D map stays an aesthetic, optional surface for now. Collect ideas for what it should become, and for views shaped to the task (a branch or pull request beside the agent's work, the screen beside the work). Discussion first; no code before a maintainer agrees a direction.

## Site

### 30. Compact plain-language explanation on the landing page (LAND-10)

Labels: `good first issue`, `area: site`

The exact two-phrase and paragraph copy above the walkthrough, in normal flow, with three finite emblem arrivals, readable static content, and anchor and keyboard behaviour. Check the hero SVG at 600 and 1440 px.

### 31. Landing page hero: logo, opening and playback (LAND-15, LAND-17, LAND-18)

Labels: `area: site`, `area: ui`, `help wanted`

A matte woven logo in the hero (static SVG with visible interlacing, still through entry, scroll and pointer movement); a three-petal opening (final SVG at 420 ms, the wordmark at 660 ms, an immediate reduced-motion state); and a fixed 16:9 poster with user-started, silent playback of a synthetic recording. One PR each, in this order. Details in the [history entries](../PRODUCT_WORK_HISTORY.md#land-18).
