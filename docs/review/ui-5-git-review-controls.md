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

The existing WorkspaceOptions owner supplies pointer/keyboard/arrow navigation, Escape/focus return, outside dismissal and its origin-aware pointer transition. No second menu implementation, new dependency, renderer change or automatic animation. The full branch/hash and selected path remain in native titles when truncated. The current-Git qualifier stays visible; longer scope/revalidation detail lives inside Actions. The retained Legacy path is unchanged.

## Local verification

- Current running application inspected before editing using the existing redacted Drishya Codex store, then again after the change; original project/harness content is read only. Screenshots inspected locally.
- Two focused Edge browser journeys in `tests/browser/git-review-controls.spec.ts`: actual local Git operations in an isolated synthetic repository, consent, three top-level control targets, keyboard/ArrowDown/Escape focus return, outside click, show/hide file list, exact reviewed patch preview and stale-content rejection.
- Responsive journey at1440/900/390/320px checks toolbar/menu viewport containment and reachable Open on disk. Local screenshots retained outside Git.
- UI/backend typechecks and production build pass. Existing Legacy Git review consent/progress journey is also checked separately; results recorded in the PR.
- Integrated main through013f59c (#141–143). No hosted CI, project writes, schema/adapter/Usage edits or Git graph changes.

## Limits

The Workspace continuation uses existing file Actions and SourceFind. Actual Drishya Codex current-source reading was inspected before/after at1440/900/390/320px: no document overflow,320px toolbar110→83px (390px76→83px because controls now keep a consistent32px height). Local drafts, version checks, split panes and native forwarding are unchanged. New keyboard/responsive coverage exercises Find/Enter, Go/Enter, Wrap, Copy reachability, Escape/focus return and containment; the existing10,000-line whole-file navigation regression passes. Legacy retains visible Copy and full match-counter wording.

This finishes top-level/selected-file Modern Git review chrome and the Workspace source toolbar. Shared diff layout/find/hunk controls, broader Workspace chrome and other readers still need UI-5's scoped passes. Phone checks are emulated; physical-device, broad theme and ten-minute reading acceptance remain separate. No copied third-party component; existing in-repo controls and theme tokens reused.
