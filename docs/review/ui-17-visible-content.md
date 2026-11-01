# UI-17 — readable content by default

1 November 2026. Harsh brought this task forward after discussion with Yash. Whole task claimed on main before implementation. Applied the repository's local `emil-design-eng` guidance; existing content/arrival motion stays under Drishya's evidence doctrine.

## Current composition and decisions

The genuine Claude one-item case reproduced the reported defect at both widths: the current reading position had a revision strip with zero list items. Its prompt-level home was outside the mounted reading window. The current captured revision now owns the checklist, shown immediately. The prompt keeps only progress and a jump to that owner. Previous revisions stay change receipts; their complete historical lists remain available in Expand. Replay computes "current" at its cursor rather than consulting future revisions.

| Before | After | Why |
| --- | --- | --- |
| Revision strip with Expand; actual checklist could be offscreen/unmounted | Current captured revision shows its list; prompt is a progress reference | One readable content home at the reading position |
| Long plan's first rows only | Ten rows around unfinished work, exact remaining count and Show all | Both completed and unfinished work remain legible |
| Tools/runtime/agents/Usage/identity disclosures start closed | Open within their existing owning surface, with saved explicit collapse | Show the content after the person enters its owner |
| Utility light dismissal silently closes Usage/identity | Parent menu dismisses; inner reading preferences stay intact | Navigating elsewhere is not a request to hide content |

## Disclosure inventory

This inventory covers active shared/Modern surfaces, including retained-view equivalents. "Shown" means within the surface the person deliberately opened; it does not auto-open every dialog or cover the history with every developer tool.

| Surface / owner | Decision | Reading boundary / reason |
| --- | --- | --- |
| Current plan/task checklist (`PlanChecklist`) | **Shown** | Ten rows; unfinished-work window, exact remaining count, Show all. Explicit collapse and Show all persist by first revision identity. |
| Plan documents / Codex proposals | **Shown** | Real Markdown; bounded captured artifact fallback for truncated material. Proposal remains labelled, not approval or task completion. |
| Earlier plan revisions | Compact change excerpt | Duplicate checklist versions; each receipt describes only its own revision. Expand reaches every previous list. |
| Prompt's plan reference | Compact progress + jump | Pure duplicate of the current checklist; no second list of captured text. |
| Main Toolbox / narrow-desktop Tools entry | Existing visible/contextual owner | Retain user minimization and the existing 600 px contextual entry; opening its owner shows its content. No new overlay at rest. |
| Tools used / harness inventory (`ToolsPanel`) | **Shown**, explicitly collapsible | Search and locally scrollable names with use/available counts. Choice persists. |
| Modern MCP server tool drawers | **Shown**, explicitly collapsible | Existing six-row local scroll boundary and total; choice persists per server. |
| Runtime tool inventory (Modern and retained docks) | **Shown**, explicitly collapsible | Separate native runtime provenance; local list boundary; choice persists. |
| Modern recorded agents | **Shown**, explicitly collapsible | Local list boundary; choice persists. |
| Legacy MCP arrival drawers / nested agent-family branches | Retain contextual/closed | Retained presentation's origin instrument / duplicate family controls; identity, counts and activity remain shown. Does not change connector/arrival doctrine. |
| Tool activity trail | Shown when a tool is selected | Position, total and first/previous/next/last already visible; no blank disclosure. |
| Usage (`RecordedUsage`) | **Shown inside session utilities** | Existing reported/derived labels and complete native values; explicit collapse persists. No automatic menu dismissal. |
| Session details (`Viewer`) | **Shown inside session utilities** | Recorded identity/workspace/observation facts; explicit collapse persists. |
| User prompt text | Readable bounded excerpt | Existing line clamp; full character count and one control; explicit expansion persists by turn step. Images remain shown. |
| Agent prose | Shown | Ordinary assistant prose does not follow the reasoning-collapse setting. |
| Exposed reasoning | Honor explicit global detail setting | Explicit per-prose disclosure survives new data/reload; hidden/encrypted content never invented. |
| Reasoning-not-recorded explanation | One-line truth state + optional reason | No available reasoning text to hide; explanatory metadata is rarely wanted. |
| Action cards: read/edit/search/shell/test/MCP/web/other | Existing readable previews | Actual code/hunks/matches/command/result already shown. Expand changes reading allocation, not presence; full text/artifact owner retained. |
| Browser/web results | Existing bounded visible results | Result counts and paging already say what remains; original envelope/input stays optional duplicate. |
| Image cards | Captured image shown | Original input/output is duplicate forensic reading; path-only/missing bytes stay explicit. |
| Raw tool arguments, Original result, JSON/CSV Sources/format controls | Collapsed secondary representation | Primary parsed/literal content is already visible. Raw/alternative representations are duplicates; no new reading chooser row. |
| Captured resources/documents and stored long results | Existing primary reading + complete reader | Stored sibling counts/readers retained; no schema/ingest change. |
| Injected notices / captured notice text | Notice summary shown; literal wrapper optional | Harness metadata wrapper duplicates the displayed notice, not a person's prompt. |
| Delegation | Identity/outcome/payload excerpt shown | Full child timeline is large secondary evidence; captured step count/full thread remains one control away. |
| Script provenance (`Inspector`) | Closed | Parent script duplicates captured invocation; explanatory linkage metadata is rarely wanted. |
| Continuation lineage / newer session segments | Summary/count shown, provenance optional | Native file identities and link evidence are secondary to joined history; no automatic session switch. |
| Changes / session diff / Git review | Existing file/change lists shown on entry | Counts, bounded pages, hunks and full readers already visible; no individual expansion needed to discover the files. |
| Git graph commit rows / working-tree match list | Keep graph-first optional rows | Rows duplicate the graph's selectable commits; working-tree matches remain explicitly current/inferred. TEST-2-owned consent regions untouched. |
| File evidence/history trails | Existing visible trail; explicit hide retained | Selected evidence remains visible; saved trailHidden state already belongs to workspace navigation. |
| File tree folders | Collapsed until chosen | Repository navigation, potentially unbounded; folder names and captured badges remain visible. Not a substitute for a hidden selected file. |
| Workspace draft/source version/compare and reading options | Content shown; controls optional | Actual selected source/draft remains visible. Version choices and layout/export/discard menus are actions, not hidden captured content. |
| Verification/failure/fix-chain views | Outcome excerpt shown | Full run/case/related edit lists are bounded secondary investigation; exact captured counts and owners retained. |
| Context report/gauge | Captured report shown; deeper accounting optional | Report categories are material; per-request/model/provenance detail is secondary evidence. |
| Home workspace/session groups | Existing bounded visible group rows | Existing counts/Show more and remembered group choices; About remains closed on return as an explicit builder decision. |
| Search, Commands, packets, bookmarks, review questions | Show content on explicit entry | These are destinations; opening them all at rest would obscure visualization. Lists/counts and selected material are visible after entry. |
| Screens/computer-use filmstrip | Show captured frame on entry | Secondary frame history is bounded navigation; no fabricated frames. |
| Composer, native permissions, approvals, recovery | Existing opt-in/attention behavior | Input/actions and permission controls are not captured reading content. Pending questions/approvals retain attention handling. |
| Map controls, settings, keyboard help and utility menus | Existing contextual controls | Navigation/preferences, not hidden agent material. Preserve calm at rest. |

## Persistence and bounds

`Disclosure.tsx` stores one boolean per explicit reading choice, keyed by recording and stable surface identity in versioned browser preferences. No captured text, images, credentials, grants or executable input is stored. Native disclosures remain keyboard-operable; Escape closes the focused reading disclosure. Reload/replay/live updates do not reset a saved choice. Storage-denied sessions retain the choice for the mounted surface only; no durability is claimed if the browser refuses storage. New data and new reading choices do not evict earlier saved preferences; the browser controls its own storage quota.

The shared menu-dismissal owner excludes Usage/identity from ephemeral menus, so unrelated pointer/focus activity cannot turn a programmatic close into a persisted reading choice. Existing history measurement/follow/anchor ownership handles real content growth; no duplicate arrival layer, delayed capture or synthetic typing was added.

## Evidence and remaining acceptance

- Genuine Claude `rec_bbff36ac`, 24,459,453 bytes: 19 native task creations; one-item/current and 19-item/current boundaries inspected at 600/1440. Before: zero visible card items. After: one and ten items respectively, with the remaining-item control. Screenshots and scratch stores stay private under `.local/ui17-real/`.
- Genuine Codex `rec_cf1dca32`, 139,063 bytes, one-item native proposal; `rec_a23abe39`, 138,466 bytes, twenty-item native proposal. Both widths show captured Markdown immediately. These are genuine CLI-written sessions prompted as safe acceptance fixtures, not hand-written journals. The current CLI and app-server runs exposed no `update_plan` tool, so current native Codex task-status transitions are **not** certified. Claude task-status transitions and synthetic Codex task/proposal guards cover their own stated shapes only.
- A fresh Claude CLI fixture attempt required sign-in; no account/configuration change or permission bypass was attempted. Existing genuine Claude sessions supply task evidence instead.
- Targeted plan, persistent-choice, default-tools/Usage/identity, replay, real history/live and full-batch results are recorded below when complete. No demo is counted as acceptance. Human ten-minute preference/comprehension remains a human check; automated stability is not described as that judgement.

### Completed task-specific checks

- Both typechecks and UI build pass. Twelve plan/default/persistence browser journeys pass, including native-task fixtures and replay truth boundaries at 600/1440. The approved default-state migration passes 62 broader browser cases (one opt-in usage case skipped) plus both shared fresh-workspace disclosure cases. Content, geometry, keyboard, counts and palette assertions were retained.
- Genuine Claude same-prompt TaskCreate result append, from `rec_bbff36ac`: two projected plan operations, two shown items after explicit reopening, saved collapse survives the native result append and reload at both 600 and 1440. Raw native files were read only; only scratch copies were appended.
- Eight genuine reading contexts (Claude/Codex × 600/1440 × history/replay), 606–607 seconds each: zero anchor drift, zero page errors, zero horizontal overflow. Motion was disabled for this automated reading-position check. It is not human visual preference acceptance or a certification of map/motion behavior.
- Final real card geometry confirms the previous 340 px cap no longer clips a checklist's remaining-item control: the 19-item excerpt uses a 449 px card, with body client/scroll heights both 390 px at both widths. Native Codex twenty-item proposals use a 446 px card with local document scrolling.
- Full isolated UI-17 gate still pending. LIVE-5 has its own independent gate and report; its failures are not described as a green integrated batch.
