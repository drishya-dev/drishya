# Modern: workflow craft, not a palette-only pass

15 October 2026. Continues [74](74-modern-reading-craft.md) on `codex/modern-reading-craft`, PR #65. Builder direction: improve the whole product, including defects and unfinished interactions they have not individually identified. Canvas and Legacy remain separate, intact choices. Installed `emil-design-eng` and `animate` guide composition and motion; evidence and consent rules still win.

## Review and implemented corrections

| Before | After | Why |
| --- | --- | --- |
| Native tool focus used the first tool name. Edit, Shell and Test can all be `exec`. | Focus uses operation kind; MCP uses server plus tool. Agent focus combines independently and toggles off independently. | Focus must answer a developer's actual question, not accidentally select unrelated actions. Verified on the real Codex recording. |
| One rejected graph/workspace/native request discarded every successful result. | Requests settle independently; a map failure reports its scope while native state and captured work remain usable. Native failures get an explicit unavailable state. | Repository indexing must not gate reading or native connection discovery. |
| Search retained previous hits while a new query ran, and clearing could leave a busy indicator. | Clear stale hits immediately, cancel superseded work and update pending/error state per query. Captured-artifact find also cancels on query/artifact changes. | A result must belong to the text the developer actually searched for. |
| Motion, hover reading and background rendering had no user controls. | Persisted local switches for material motion, header-hover reading, repository backdrop and compact spacing. | Quiet reading and lower presentation overhead must be deliberate choices. OS reduced motion always wins; turning motion off also stops animated Follow. |
| Session navigation replaced browser history; Settings and review were not reloadable locations. | Push actual session/view routes, safely decode IDs and honor Back/Forward/reload. Switching UI versions normalizes to the shared recording route. | The browser's navigation must work without breaking Canvas/Legacy. The cross-version regression was caught and fixed locally. |
| Connect session appended a potentially huge inventory below the library. | Bounded, searchable native dialog: 40 initial rows, explicit continuation, complete inventory search, Escape/outside dismissal and trigger-focus return. | Discovery stays reachable on large libraries. Pointer opening has a finite 180 ms opacity/transform entrance; keyboard and reduced motion stay immediate. |
| Library displayed a `/` hint without a working shortcut. | `/` focuses session search except when an editable control or dialog owns input. | Keyboard hints are a functional promise. |
| Reading history offered only page-level navigation. | Previous/next prompt queries the complete stored marker index; loading its passage leaves future captured history intact. Latest and Follow clear that reading destination. | No sampled-marker shortcut that silently skips old prompts; this is navigation, not sequence playback. |
| Reader width was fixed, and file selection could leave Follow enabled. | Explicit Widen/Narrow control remains viewport-bounded; selecting a file detaches camera following. | Wide code needs space without losing navigation control or creating page overflow. |
| A deep link briefly showed “Choose a session” during metadata loading. | Shows “Opening your session” until the initial request resolves. | Loading must not look like missing data. |

## Scope and implementation

- Frontend only. No schema, capture, daemon policy, harness configuration or runtime dependency change.
- `modern/work-focus.ts` retains existing composer filter semantics: surrounding actions recede, they are not deleted. Runtime availability remains distinct from captured tool use counts.
- `modern/presentation.tsx` stores four boolean preferences only. Session content, drafts, attachment data and native permissions are not persisted there.
- `modern/navigation.ts` routes session/work/repository/review/settings. `lib/ui-version.ts` strips presentation-specific suffixes when crossing shells.
- `SessionDiscovery` displays local discovery results; opening it does not grant workspace permission or submit a native prompt.
- `PromptNavigation` calls existing `history-marker` with `turn` and then existing `history` with `promptStep`. It does not create a timeline, infer a prompt, alter replay evidence, or load the full transcript into the DOM. From no selected prompt, Previous starts at the newest prompt and Next starts at the oldest.
- Reader enlargement is a deliberate width control, separate from header-hover geometry. No duplicate captured text or fake thinking animation.
- Real local Codex Drishya and Claude Skeletongraph sessions inspected. Private screenshots/captures remain under ignored `.local/`; no native turn submitted.

## Validation

- Both TypeScript projects and 376 unit tests / 59 files passed. A subsequently added UI-version normalization regression passed with its three-test file (377 total unit cases in the repository).
- Production build passed. Final combined Modern/Canvas browser run: **36 passed**. Includes native consent, current Git consistency, backward replay, complete patches, header-hover geometry, MCP wheel boundaries, responsive reading, per-session drafts, partial map failure, compound focus, stale-search cancellation, persistent presentation settings, browser navigation, full discovery filtering, prompt-index navigation and widening the reader.
- Real Codex prompt navigation reached older actions in the large recording and kept the composer/tools in place. Both real harness recordings still render their actual captured work.
- Local only. No hosted CI, no new performance benchmark, no actual native-account lifecycle submission, and no claim of full public release acceptance.

## Remaining product work — do not lose this backlog

This pass is not completion of Modern or of review 50. Continue in coherent, locally verified increments, not a new theme prototype.

1. **Reading continuity:** retain bounded history offset, file/operation selection, reader location and map camera across Settings/session detours. Browser view routes and text drafts now survive, but full evidence navigation memory is still missing. Add reader Back/Forward with scope reset at replay boundaries.
2. **Native composer:** aggregate UTF-8 attachment limits, simultaneous selection/paste handling, explicit attachment preview and rejection/retry; clearer workspace/worktree target and policy freshness; validate both real harness lifecycles without weakening approval settings. Synthetic tests are not actual-account certification.
3. **Recovery:** distinguish SSE disconnected/cached reading from agent stopped or journal not watched; reconnect reload and visible recovery; contextual retry for map/source/artifact/verification failures without resetting the chosen evidence. Initial connection isolation is implemented, not the entire recovery system.
4. **Repository:** Modern map remains a bounded 2D spatial drawing. Implement the requested actual 3D orientation/idle rotation with resource/hidden/reduced-motion gates, meaningful neighborhoods, zoom detail and preserved camera. Do not label the present map 3D. Plain files remain the reliable alternative; improve folder state and complete extension icons.
5. **Review utility:** bring the review-50/51 navigation and review queue usefulness into Modern; expose checks/diagnostics with exact evidence and scope, preserve Git notes/selected hunks, improve source/patch find and keyboard destinations. No inferred coverage or causal links.
6. **Presentation sweep:** audit each menu, disclosure, overlay, empty/error state and input on real dense recordings. Improve responsive toolbox/agent discoverability, header/composer allocation, exits and interruption. Existing material arrival still caps scale at .92–1.08; review its visual match with the requested single whole-material arrival before claiming motion is final. Current palette is a direction, not accepted final artwork.
7. **Offline and acceptance:** Modern offline bundle entry, ten-minute reading, screen-reader/touch/keyboard checks and physical/platform/low-resource evidence remain open. Keep Canvas/Legacy available and maintain shared version-switch regressions.

The next bounded task should be reading continuity plus native composer attachment correctness, then recovery. The product needs those reliable everyday interactions as much as attractive materials.
