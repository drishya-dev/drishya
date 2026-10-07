# Connected session workspace — 7 October 2026

## Decision and composition

The builder supplied CodeForge as a visual reference and explicitly requested real prompting, session-correct folders, available tools, smaller dock text, stronger colours, connections and a larger map. This supersedes the earlier observe-only **product** boundary. Passive observation remains independently useful; control is a separate opt-in native client, never an instruction from an observer hook or an arbitrary terminal attachment.

The reference informed crisp dark surfaces, cyan connections and finite fade arrivals. Its marketing animations are not evidence semantics. Captured text remains whole/selectable; no simulated typing, invented output, idle scanning or artificial capture delay. Original docs/prototype references remain preserved.

- One #090909 black workspace with the permitted static charcoal lining. Source/cyan, changes/amber, external tools/lilac, outcomes/green and failures/red distinguish content. Materials retain readable boundaries and content-shaped widths; prose remains unboxed.
- Left: a 220 px session folder explorer, 185 px on smaller desktops, minimizable. The selected recording supplies the workspace, with approved graph paths or explicitly recorded paths. Search, disclosures and 120-row pages bound the mounted tree. Reading context remains separately collapsible below it.
- Middle: accumulating passages, wrapping left-to-right. Cyan arrows connect visible neighbouring actions, explicitly labelled **Recorded order**, not a reason or execution dependency. Existing typed links retain their relation/explanation. At most 64 visible rectangles and 36 paths are retained; geometry measures mounted history only. Scroll/resize and one finite arrival remeasure drive updates. Low-resource mode hides connectors.
- Right: 166 px observed tool dock, 150 px on smaller desktops, 9–10 px aliases and full wrapped names. Observed use is not installed availability. Actual native runtime inventory appears separately when supplied by the connected client; unavailable inventory stays unknown.
- Top: recorded agent identity switches and Agent overview switch, replacing Follow/Agents/Repository tabs while retaining shared reading anchors.
- Bottom: a compact Prompts disclosure and edit/failure navigation. The former persistent chapter strip is removed. Normal use retains scrolling, not movie controls. Diagnostics retains optional replay transport. The ordinary native composer opens above the utilities, reserves its measured height outside the history viewport, and can be minimized. It exists only for a local, single-recording daemon source.

## Motion and repository map

Existing finite whole-DOM arrivals originate at measured visible file references/map coordinates or observed instruments. All action kinds retain origin and interruption coverage. Chrome fades once; edit lines resolve colour once instead of typing fabricated changes. Delayed output grows its own allocation without pushing a deliberate reader to the bottom.

The map expands across the main workspace, with pan, zoom, Fit and search. Document tiles and rectangular status outlines replace heat circles. Real static imports are drawn; they do not establish historical execution or causality. Labels remain DOM text. No Pixi/WebGL dependency was introduced. With current-workspace consent, nodes open current files; otherwise they open recorded work. Background visibility remains toggleable and the map recedes under text.

## Latest developer refinement

Window-like material headers have a semantic tinted chrome surface and distinct 1 px border; centred content-shaped cards wrap in a passage. File/folder SVG icons identify extensions without adding an icon dependency. Long names ellipsize in the tree with the full path available as a title. File relationships is folded while following and opens when reading older work. The foreground Map and folder controls remain navigation, not task tabs.

For more than 80 indexed files, `mapDetail()` derives folder membership at overview, revealing progressively deeper folders with zoom; clicking a folder isolates its subtree and exposes a parent action. At zoom 5.5 or a subtree of at most 80 files, original file nodes become available. Group edges count actual imports between member sets; they do not imply runtime flow. Overview lays groups on a legible grid. Current `.local` caches are excluded in both indexing/freshness and cached graph presentation, without hiding historical captured evidence. Existing cached graphs should be explicitly refreshed. The composer and return-to-latest pill hide in foreground exploration. Fit resets drill/search/hover state; hover edges share displayed group/file coordinates. Drawing is bounded to 600 edges and viewport-visible shapes; group labels to 48, file labels to 24. The complete graph is still in memory: this is bounded presentation, not a certified arbitrary-scale GPU renderer.

Captured names take precedence over generic harness labels; actual model names are used when available. Codex's provider field is never presented as its model. Native turn usage appears under Usage: input, output, cached tokens and a USD cost only if reported. Historical usage/cost stays Not reported; native cost is not a subscription bill or a computed pricing estimate.

New agent prose may fade in by paragraph with bounded stagger, at most 12 blocks, while the entire captured DOM is already mounted/selectable. No typewritten characters, invented chunks or capture delay. Reading/reduced-motion cancels reveals. A material arrival stays active when content size changes; clip/reveal follows its final natural size. Later growth reveals the boundary without animating layout height, because intermediate layout heights destabilized virtualized reading. Connectors include partially visible cards, clamp attachment points to the visible edge, and remeasure during finite arrivals and on scroll.

A long-history regression exposed transient scroll clamping when disjoint virtual runs replaced spacers. A separate inner reading surface reserves `layout.total` minimum height outside padding, so native scroll cannot clamp back to a pinned earlier action while runs change. The existing long-session test now reaches the measured end, preserves focused evidence and stays bounded. Keep this geometry invariant.

## Current workspace capability

`apps/daemon/src/workspace.ts` owns per-recording, per-daemon-launch grants. Graph approval alone does **not** grant source reading. Explicitly enabling the selected captured root grants current reading; HTTP cannot select an arbitrary root. Existing home/drive-root protection applies. Forgetting a recording revokes its grant.

The reader accepts only indexed relative forward-slash paths. Privacy-denied paths, traversal, absolute/drive paths, every symlink component and paths outside the canonical root are refused. Location and inode/device are checked after opening. Reads are bounded to 2 MiB plus one sentinel byte, binary/NUL content is rejected, and the whole document is redacted before slicing into at most 200-line pages.

Every result is labelled **Current disk · not a historical snapshot**. Refresh, page navigation, copy-visible-page and a link back to captured work are provided. Current bytes never replace a historical read/edit. New files outside a cached graph require explicit graph refresh. Symbols, LSP, arbitrary huge-file reading, source editing and debugger execution remain future work.

## Native prompt controller

`apps/daemon/src/controller.ts` uses installed executables with `shell: false`, the approved canonical cwd, hidden Windows launches and structured stdin. It reads a native UUID from the first 256 KiB of the original journal; Drishya recording IDs are not guessed native identities. Combined views and offline bundles cannot send.

Before submission the user enables this workspace and acknowledges that the session is idle elsewhere. An active resumed Codex thread is rejected. A separate process cannot prove arbitrary terminal ownership; the acknowledgement is mandatory, not an attachment claim. Finish native turns elsewhere first.

Prompts are limited to 65,536 UTF-8 bytes and redacted before transmission, with a notice when changed. The harness uses its existing account and configuration. Drishya never changes native sign-in, credentials, billing or config. Explicit prompts can consume normal native-account model usage. Viewing remains independent and sends no automatic prompts.

### Codex

Supported `app-server --stdio` protocol: initialize/initialized, thread/resume, turn/start, events and turn/interrupt. Resume uses conservative `untrusted` approval policy and `workspace-write` sandbox. Actual thread MCP inventory uses mcpServerStatus/list, at most eight 100-item pages and 500 displayed names, after prompt submission. Built-in availability is not fabricated from this catalog.

Command-execution and file-change requests produce exact one-time approvals. Responses use native wire IDs, distinct from opaque UI approval IDs. Other interactive requests return explicit protocol errors; generalized user questions, MCP elicitation, extended permissions, dynamic tools and account refresh remain native-harness workflows. This first controller is not a replacement for every native feature.

### Claude Code

Supported programmatic CLI: resume, stream-json input/output, verbose, manual permissions and host permission prompts. Initialization precedes the user message. System-init tools establish actual inventory. can_use_tool requests use exact allow/deny responses. Session-state and local-agent/workflow notifications keep connections alive past intermediate results; final result/idle completes. Older clients without state signals complete on a result only when no background task is pending. Stop sends native interrupt before EOF.

Installed reference versions: **Codex 0.160.0; Claude Code 2.1.282**. These are tested versions, not a proven minimum compatibility matrix. Windows requires actual native .exe clients on PATH; .cmd-only wrappers are not spawned through a shell. Unix uses executable PATH lookup. Older clients/other-platform compatibility remains release validation.

### Limits and shutdown

Two active connections maximum, one per recording; sixteen recent receipts; eight pending approvals; 4 MiB frames; 256 KiB input backpressure; 60-second RPC timeout; 30-minute connection limit. Output receipts cap at 128 KiB **after redaction**. Protected/redacted/oversized approval parameters are refused rather than silently approving altered inputs. Stderr is drained but not published as partial/truncated secret-bearing chunks. Structured native errors are redacted.

Stop requests native interruption, then closes stdin. Graceful EOF allows normal journal writes to settle; a two-second fallback terminates only the owned child. Daemon shutdown waits for owned children and never kills an unrelated harness/terminal. Capture follows native journal writes independently; the controller does not manufacture observations or write a harness journal.

No telemetry or new external service was added. Explicit prompts use the native harness's configured services and data policies; passive observation gains no network dependency.

## Routes and implementation boundaries

All routes inherit loopback Host, Origin, authentication, request/body guards. Under `/v1/recordings/:id/`:

| Method | Route | Purpose |
|---|---|---|
| GET | workspace | Root/grant status |
| POST | workspace/approve | Consent to this captured root, this launch |
| GET | workspace/file?path&start&count | Redacted bounded current text |
| GET | controller | Ephemeral receipt, inventory and pending approvals |
| POST | controller/prompt | Explicit `{prompt, exclusive: true}` submission |
| POST | controller/approval | Exact `{runId, approvalId, allow}` decision |
| POST | controller/stop | Interrupt current owned `{runId}` |

No captured event/store schema or runtime dependency changed. Test-only controllerFactory injects a synthetic subprocess through server constructor options, never HTTP. Controller receipts are ephemeral, not captured events. Workspace consent is distinct from graph approval and explanation consent. Offline DataSource stays read-only; demo UI cannot pretend to prompt.

## Verification and practical limits

- Typechecks and **279 unit tests** pass: current-root grants, links/protected paths, full-document redaction, binary/size limits, consent, structured stdin, permissions, submit races, Claude background lifecycle, native Codex interrupt, API authentication/Origin guards.
- **40 ordinary browser journeys** pass, two separate opt-ins skipped. Four new journeys cover selected folders/current-vs-historical source, real API prompt transport/approval/runtime inventory, connections/agent switches/narrow layout, and a 180-file grouped map with drill-down and Fit. Synthetic subprocesses verify protocol, not model quality.
- Offline packaged install, both imports, demo, authenticated API and persisted restart pass. Demo regenerated deliberately: Codex turn_context now captures its real model even when the workspace is unchanged; provider is no longer a model. One golden end-sequence increments from 15 to 16 for this extra metadata observation. No event schema changed. Hosted CI remains publishing-only and was not dispatched.
- Actual installed Codex resumed a newly created synthetic native thread through this controller and returned the requested harmless response. Normal journal capture observed **nine records**. No real project contents were sent or private journals/stores committed.
- Actual installed Claude returned an organization restriction disabling Claude Code subscription access before a successful initial turn. Live continuation is **not certified on this account**; synthetic protocol/UI checks pass. No account settings were changed to bypass it.
- Fresh ten-minute synthetic live reading passed: **603,101 ms, 113 rounds, peak 775 DOM nodes**, retained pinned evidence/anchors, and no runaway origins. The stable virtual extent/composer reservation were present. Final map hover/Fit/static-chrome changes and removal of unnecessary wheel guards followed its start; full browser/type/package and targeted long/live-history checks passed afterward. Windows reference-machine results do not certify physical low-resource machines, Linux/macOS, every CLI version, unsupported interactive requests or human preference.

Browser review caught duplicate React sibling keys that repeatedly remounted the folder explorer during live reload. Distinct stable keys now keep one explorer per selected recording. Reading intent, provenance and history paging remain preserved.

## Run it

Build/restart so both new routes and UI load:

```powershell
corepack pnpm ui:build
corepack pnpm serve
```

Open the authenticated daemon launch URL, **not `?demo`**. Import/select a discovered local session, enable its workspace and open **Continue with a prompt**. Finish native turns elsewhere, tick **This session is idle in other clients**, then send. The target session/root and native availability are visible before submission. Demo/offline bundles cannot send.

## Sources inspected

- [CodeForge visual reference](https://codeforge-magicui.vercel.app/): dark materials, colour, arrivals and connections, inspected in browser.
- [Claude programmatic mode](https://code.claude.com/docs/en/headless) and installed CLI help: resume and structured formats.
- [Claude SDK query implementation](https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/_internal/query.py): permission/session/background-task protocol.
- [Codex app-server](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md) and installed generated types: resume, turn and approval/interrupt requests.
