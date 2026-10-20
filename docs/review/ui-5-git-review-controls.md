# UI-5 — compact Modern Git review chrome

20 October 2026 · PR #144 · scoped increment; broader UI-5 remains open in TASKS.

| Before | After | Why |
|---|---|---|
| Separate graph link row, repository context, branch toolbar, scope disclosure | One identity/control row: repository and branch with visible current read-only scope; Files, refresh and Actions | Reserve the drawer for the patch and keep the current-Git boundary visible |
| Disabled handoff button occupies toolbar even before anything is reviewed | Handoff inside the existing Actions menu, with its existing exact-fingerprint eligibility and revalidation | Secondary sharing workflow stays available without resident clutter |
| Selected-file path forces its two buttons onto another row | Path and Open on disk on one line; Recorded work in Actions | Keep quick current-file reading visible; preserve captured-work navigation |
| Git history has its own permanent row | Branches & commits in Actions | Same navigation, fewer rows |
| Workspace source Copy consumes a permanent toolbar slot | Copy lives in existing file Actions; Find/Go/Wrap remain visible | Occasional copying does not crowd navigation |
| Verbose match count and wrapping controls fill110px at320px | Compact visual count with full accessible description,32px controls and a two-row phone grid | More source fits without shrinking control text below12px |
| Layout, wrap, always-visible hunk input and full search status occupy109–137px above a patch | Modern shares layout, wrap icon and compact search; multi-hunk navigation lives in Patch options | Single-hunk patches do not need a hunk-number field; multi-hunk navigation remains keyboard reachable |
| Historical source spreads Copy/Wrap, Find, scope and a tools disclosure across several rows | One Find/Wrap/options row and an exact loaded-page scope line; secondary actions share one menu | Preserve historical boundaries while giving source more room |

The existing WorkspaceOptions owner supplies pointer/keyboard/arrow navigation, Escape/focus return, outside dismissal and its origin-aware pointer transition. No second menu implementation, new dependency, renderer change or automatic animation. The full branch/hash and selected path remain in native titles when truncated. The current-Git qualifier stays visible; longer scope/revalidation detail lives inside Actions. The retained Legacy path is unchanged.

## Local verification

- Current running application inspected before editing using the existing redacted Drishya Codex store, then again after the change; original project/harness content is read only. Screenshots inspected locally.
- Two focused Edge browser journeys in `tests/browser/git-review-controls.spec.ts`: actual local Git operations in an isolated synthetic repository, consent, three top-level control targets, keyboard/ArrowDown/Escape focus return, outside click, show/hide file list, exact reviewed patch preview and stale-content rejection.
- Responsive journey at1440/900/390/320px checks toolbar/menu viewport containment and reachable Open on disk. Local screenshots retained outside Git.
- UI/backend typechecks and production build pass. Existing Legacy Git review consent/progress journey is also checked separately; results recorded in the PR.
- Integrated main through013f59c (#141–143). No hosted CI, project writes, schema/adapter/Usage edits or Git graph changes.

## Limits

The Workspace continuation uses existing file Actions and SourceFind. Actual Drishya Codex current-source reading was inspected before/after at1440/900/390/320px: no document overflow,320px toolbar110→83px (390px76→83px because controls now keep a consistent32px height). Local drafts, version checks, split panes and native forwarding are unchanged. New keyboard/responsive coverage exercises Find/Enter, Go/Enter, Wrap, Copy reachability, Escape/focus return and containment; the existing10,000-line whole-file navigation regression passes. Legacy retains visible Copy and full match-counter wording.

The shared patch continuation leaves DiffReader's evidence, offset, whole-patch search, paging, wrap and layout state with their existing owner. Only Modern chrome delegates to PatchControls. One-hunk material omits the redundant hunk input; multiple hunks expose the same input through the existing WorkspaceOptions owner. There is no new animation or menu implementation. Actual Drishya current-Git patch controls measured109→48px desktop and137→86px at320px; no document overflow at1440/900/390/320px. The content's existing height cap is retained; the gain is less chrome, not a fabricated larger patch.

Thirteen focused browser journeys pass: two new current/captured patch journeys, the two Modern Git-control journeys, six retained Git reading/consent/handoff/page journeys, and three existing Modern state-recovery/local-draft/current-source-comparison regressions. New captured-patch material deliberately differs from disk and remains captured. Hunk jump, Escape/focus return, full-patch search, wrap, unified/split, responsive menu bounds and scope-specific labels are checked. Both typechecks and production build pass.

The historical-source continuation moves only controls: ArtifactReader still owns page loading, search, validated absolute source lines, copying and temporary references. Its existing form/range children render in one Modern Stored source options menu; Legacy retains its original rows/disclosure. Form actions keep the menu open so invalid-line errors and copy feedback stay visible; Escape and outside dismissal still use WorkspaceOptions. Provenance and exact loaded-page scope stay outside the menu. Stored-artifact search beyond the resident page remains an explicit visible action when querying.

Actual Skeletongraph Claude stored source was inspected before/after at1440/390/320px; the displayed excerpt remains derived and range-labelled. The sampled Drishya Codex capture has no typed Read artifact, so it was not passed off as a source-reader acceptance sample (DATA-1 is separate). New Modern coverage uses a450-line recorded excerpt starting at81: finds stored line411 beyond the resident page, keeps invalid900 visible with its error, jumps to200, copies exactly200–201 and separately copies the loaded page, returns keyboard focus and bounds the menu at390/320px. Clipboard transport is intercepted in the test, not written to the person's clipboard.

Final relevant browser set:18 journeys (four new patch/source, two Git-control, six retained Git, three existing Modern comparison/recovery and three Legacy stored-source regressions). The short two-line excerpt also keeps its menu buttons clickable without adding a source scrollbar. Five existing diff/cache unit cases, both typechecks and production build pass. Prior Workspace/Legacy/10,000-line checks also passed for this PR. No hosted CI.

This finishes top-level/selected-file Modern Git review chrome, Workspace source toolbar, shared patch toolbar and historical source toolbar. Broader Workspace headers and whole-reader combinations still need UI-5's acceptance pass. Phone checks are emulated; physical-device, broad theme and ten-minute reading acceptance remain separate. No copied third-party component; existing in-repo controls and theme tokens reused.
