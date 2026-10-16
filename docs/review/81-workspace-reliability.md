# 81 — Everyday workspace reliability

16 October 2026 · Harsh with Codex · `codex/workspace-reliability`.

## Scope and current architecture

The builder asked to execute all remaining tasks discussed after PR #65. Review
75 is a historical audit of the retired independent Modern app; review 76 and
the shared Legacy-backed Modern entry supersede its parity assumptions. This pass
audits the current product, fixes confirmed gaps and preserves Canvas / Legacy /
Modern. No replacement map, composer, event schema or capture implementation.

The builder explicitly keeps real-account native acceptance for themselves.
No real prompt, approval, interrupt or paid model call is made by this pass.
Physical lower-RAM hardware, macOS/Linux and human preference/comprehension
acceptance cannot be established by this Windows reference machine.

## Task disposition

| Task | Implemented or existing behavior | Acceptance boundary |
| --- | --- | --- |
| Reading continuity | Eight source-scoped memory-only session locations, eight-visit evidence trails, history passage/pixel anchors, map camera/orientation, folder expansion/search/offset, selected readers and controls survive detours. Replay clears retained historical navigation. | Reloads intentionally discard this private ephemeral memory. No fetched current-file response, graph, grant or attachment is stored here. |
| Composer correctness | Serial, bounded file preparation accepts overlapping selection/paste/drop. Exact image padding and aggregate UTF-8 sizes, local text/image preview, explicit rejected-file retry and byte-based prompt validation. Rejected sends retain draft/attachments. Connection errors block sending. | Existing server remains authoritative for names, signatures, redaction, native policies and attachment limits. Real-account checks are assigned to the builder. |
| Recovery | Cache remains readable on disconnected/re-authentication states; browser online/offline handling, explicit stream retry and summary/revision refresh. Cached native receipts switch to “Last received” and do not claim a current thinking/running phase. File listing and current-source retries preserve the chosen destination. Existing artifact/map/verification retries retained. | Fresh launch credentials remain mandatory after server restart; cached data is not a claim of live agent activity. |
| Repository | Modern already shares Legacy's WebGL 3D map, bounded geometry/neighborhoods, DOM labels, 15 fps orbit and hidden/reduced-motion/resource gates. Camera/folder navigation memory and Left/Right folder keys added; extension aliases and meaningful generic format labels added. | No claim that browser emulation substitutes for a physical low-resource device. |
| Review utility | Exact-content Git notes and bounded patch/source find, hunks, reading Back/Forward and check evidence already shared. Git file page/selection and exact-fingerprint patch scope/raw/page controls now survive reader detours. Fixed command-palette Review questions after its relocation. Review work now pages every captured outcome/file instead of stopping at the first summary preview. | Review-50 semantic indexing, repository-wide durable review and diagnostic ingestion are separate feature proposals, not capabilities implied by this pass. No test coverage or causal-link inference. |
| Presentation | Existing header/toolbox/menus/material origins retained. Finite keyboard-immediate controls and bounded attachment/recovery surfaces use the existing theme. Dense real recordings and synthetic phone/landscape/static paths are reviewed locally. | Final visual preference and assistive-technology acceptance remain human checks. |
| Offline/release | Modern uses shared offline bundle reading and disables native controls in bundles. Local full unit/browser/package/demo checks and synthetic ten-minute reading are executed for this candidate. | Public release, platform installs and actual native accounts remain separate acceptance. |

## Design engineering review

Applied the installed local `emil-design-eng` instructions. No new decorative
animation; existing origins/choreography and immediate keyboard actions remain.

| Before | After | Why |
| --- | --- | --- |
| Returning from another session discarded location and reader controls | Bounded source/session location and exact-evidence memory | Reading detours should be reversible without retaining whole recordings |
| A second file selection during preparation silently disappeared | Serial queue with an aggregate 32-file reservation | Every accepted selection must either arrive or report rejection |
| Prompt allowed by character count could exceed server UTF-8 cap | Visible byte budget and disabled invalid submission | Catch emoji/CJK limits before losing a turn to validation |
| Attachment names/thumbnails were the only inspection | Explicit bounded text/image preview and retry after rejection | Let users inspect precisely what they intend to submit |
| Lost authentication replaced the entire loaded workspace | Qualified cached reading plus launch-link recovery | Connection state must not erase captured evidence or pretend the agent stopped |
| Git selection/scope disappeared on close | Metadata-only file page and fingerprint-scoped controls | Restore context while fetching a fresh separately consented Git sample |
| Review questions command targeted a retired container | Target the shared action itself | Keyboard navigation must survive presentation changes |
| Review summaries ended at twenty outcomes | Bounded explicit review pages with unchanged global counts | Reach the complete captured review without an unbounded browser transcript |

## Resource and trust limits

Workspace memory retains at most eight sessions/source and 64 location slots/
session. Each evidence trail remains capped at eight visits with 64 control slots
per visit. Folder expansion caps at 256 paths; history retains at most 96 measured
heights. Existing byte-budgeted artifact pools and paged worker boundaries remain.
This adds no runtime dependency, telemetry, network font, real import or native
permission. Captured bodies stay with the existing redaction/artifact pipeline.

The derived `/since` reader accepts an optional zero-based `page` (0–1,000,000).
Each response still returns at most 20 items/group and 50 changed paths; counts
remain whole-recording counts. Default page zero preserves reading-mark behavior.
The existing history worker computes the snapshot, and offline bundles use the
same pure function. Index pagination preserves tied observation sequences without
skipping sibling outcomes. No captured event/store schema or native API changes.

## Validation

Windows Node 24.11.1, existing cached pinned pnpm 10.34.5. No hosted CI.

- Both TypeScript projects and **387 unit tests across 63 files pass** on the
  completed source, including tied-sequence review paging, worker continuation,
  exact attachment byte accounting, memory eviction and session/replay isolation.
- Final complete browser sweep: **145 passed / two explicit opt-in skips**,
  147 total in 8.2 minutes. This run includes all final code, the native offline
  disclosure, review pagination and the settled Usage/Follow test corrections.
- Final isolated offline package verification passes installation, Claude/Codex
  synthetic import, demo export, authenticated API and persisted restart.
  Regenerating the demo leaves the committed bundle unchanged.
- Ten-minute synthetic live reading passes: **601,301 ms, 84 rounds, peak 862 DOM
  nodes**, retaining pinned evidence and passage/pixel anchors while capture
  appends and the reader repeatedly returns to latest. This run includes the
  composer layout repairs and review pagination; the later offline-native wording
  and theme-token correction are covered by repeated browser checks separately.
- The final native offline-receipt and Usage geometry checks pass three repeats
  each. A prior Usage failure compared intrinsic `scrollWidth` with an actively
  scaled menu rectangle; the regression now waits for finite entry to settle and
  retains the original exact bound. The earlier real composer overlap/height
  regressions were fixed by placing conditional byte feedback inside the form.
- The all-kind arrival journey previously raced a disappearing return pill. Its
  correction accepts an already completed Follow state or activates the real
  control and verifies Follow; all material/evidence assertions remain.
- An existing dense real Codex recording and Settings were inspected locally
  without a new import/consent/prompt. The actual server was restarted only after
  all six native controllers reported idle; the three pre-existing passive
  watches were restored. All six recordings remain available. The deployed
  review API preserves global counts and response bounds.

The final complete browser result is also recorded in the STATUS handoff. Earlier
sweeps exposed the corrected layout/test issues above and are not represented as
one clean run. The initial sandbox unit attempt could not rename its temporary
fixture blobs; normal local Windows permissions resolve that environment failure.
Private stores, screenshots, credentials and tool logs remain outside commits.

## Builder acceptance checklist

Use disposable sessions and explicitly approve each native action in the app:

- Claude and Codex: submit a prompt, follow-up and stop a running turn; verify
  capture continues independently and only the selected session is controlled.
- Exercise a native approval and decline without weakening the CLI policy.
- Attach text, image and folder content; inspect previews and compare captured
  receipts. Check selected model/effort and actual workspace/worktree identity.
- Test second-client activity, compaction where supported, disconnection, daemon
  restart/new launch link, a missing journal and session switching.
- On physical lower-resource Windows plus macOS/Linux: clean install, launch
  authentication, discovery/import/watch, restart, offline reading and retention.
- Screen reader, touch and full keyboard reading; human ten-minute clarity and
  preference review on dense real work. Automated soak is distinct from this.
