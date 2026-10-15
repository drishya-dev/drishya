# 78 — Recovered Modern controls and session crown

15 October 2026 · Yash with Codex · `codex/modern-reading-craft`, PR #65.

## Latest builder direction

The builder prefers the pre-reset Modern composer and toolbox over the styled Legacy versions. Recover those actual compositions from existing code/history, keep Legacy's main agent visualization, present Git review on the right, call the explorer Files and the map Repository, and include a distinctly Modern header.

Reviewed the former `fresh/FreshApp.tsx` native composer, `modern/ModernTools.tsx`, `FreshGit.tsx` and their Modern style rules from the retained pre-reset source. These are presentation references, not a reason to reintroduce the retired Fresh app or duplicate session/controller state.

## Implementation and design review

Applied installed Emil design engineering and animation guidance. Existing native details/dialog controls retain focus, keyboard and dismissal behavior. Captured content remains whole/selectable; no new simulated text or reasoning.

| Before | After | Why |
| --- | --- | --- |
| Legacy composer with small cosmetic changes | Recovered Modern top connection row, prompt field and attachment/model/send toolbar | Restore the requested composition, not another skin |
| Plus menu and icon-only Send | Direct file/image and folder buttons; labelled Send/Stop | Match the earlier Modern interaction while keeping ordinary native attachments |
| Native model settings only inside connection menu | Available native model/effort choices also in the compact footer | Keep useful per-turn choices visible when genuinely reported |
| Legacy evidence desk and large instrument rows | Recovered compact Toolbox, semantic dots, counts, MCP drawers and agent families | Preserve the preferred original Modern tool presentation |
| Center modal Git reader | Right-side modeless Git workspace, file list and patch reading | Keep surrounding agent work accessible; retain current-Git consent and exact review/handoff checks |
| Plain full-width Legacy header | Rounded translucent session crown, Sessions home cue, centered project/title and compact utilities | Give Modern a distinct identity without another stage layout |
| Folders / Map | Files / Repository, with matching explorer accessibility labels | Use developer-facing names for the actual jobs |

`ModernTools` is now an active recovered component. `ModernToolStation` binds it to the existing scene, projection, native runtime inventory and compound focus. It keeps native `.instrument.k-*` origins and exact MCP server/tool data attributes, so Legacy arrivals still originate at real visible controls. MCP origin lookup accepts explicit server identity on the new drawer summary. Existing agent-family nesting is reused.

The shared `PromptComposer` still owns drafts, paste/drop/file preparation, limits/redaction, settings, idle acknowledgement, submission, approvals, interruption and resize clearance. Modern changes the real DOM composition and provides direct attachment buttons and available model/effort controls; it does not mount the former independent native controller. Unknown policy stays unknown and full access remains owned by the native harness.

Git shares `GitReader`/`GitPatchReader`, separate read-only consent, content validation, source scopes, notes, paged files/patches and handoff revalidation. Modern uses a right-side reading dialog and starts an initial sample when existing consent is available. Close/Escape restore focus. Small screens use the viewport with bounded scrolling. Legacy stays modal.

Active Modern CSS remains scoped. `recovered-surfaces.css` is the final presentation layer for these restored components; do not resume the old Fresh stage. Legacy's cards, hover, history, graph, connectors and native session owner stay shared.

## Verification

Both typechecks/build and 380 unit tests pass. Final browser results are in STATUS: Modern/Legacy/Canvas journeys include narrow bounds, settings, versions, composer sizing, attachments, captured materials and source/Git reading. New recovered-control tests assert real native origin elements, compound/MCP focus, actual temporary-repository patch reading in the right drawer, and mocked controller forwarding for both Codex and Claude with exact text, attachments, model, effort and an explicit idle acknowledgement. The mocks do not certify real native-account execution.

Actual local Drishya Codex recording inspected: header, recovered composer/toolbox and Git permission state. No prompt submitted or new permission granted to that real recording. Private screenshots stay ignored. No hosted CI, schema or backend permission change; user package-manager/artwork changes remain excluded. Human preference/ten-minute and physical/platform/native-account release acceptance remain separate.
