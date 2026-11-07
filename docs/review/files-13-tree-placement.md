# FILES-13 — evidence-backed repository tree placement

7 November 2026 · `codex/files-13` · draft PR #364

## Cause

`FolderExplorer` unioned every graph path with every captured path. `worktreeFileRows` placed unprefixed captures directly at the root, even when they came only from a search result. In genuine Drishya Claude sessions, `rec_31c2a507` (6,519,293 bytes / 89 files) has **50 bare entries, all from one search operation**, and `rec_860c5728` (2,725,124 bytes / 159 files) has **133, all from two search operations**. None exists at that location in the separately approved current inventories (888 / 858 indexed files). Approval did not remove them because the union kept those captured entries.

These are genuine occurrences of the reported class, not a claim that the exact four screenshot filenames were recovered. Eight local Drishya Claude candidates were freshly imported; those four names did not appear as root files in the resulting projections. The regression fixture includes their exact names and a directory-scoped listing that returns bare results.

`Other working directories` used only a root's last segment. Genuine Codex `rec_a1d4f0e4` (13,948,151 bytes, three agents, five roots, three captured files) has five roots with the same final name. Two non-primary roots actually have visible files, so both previously received the same label. New roots also introduce namespaces into the projection; making the main folder key depend on that namespace closes its existing expansion and can duplicate indexed/current aliases.

This is a placement/proof problem, not a reason to silently grant workspace access. No permission policy changes are made.

## Behaviour

- Exact current inventory paths and direct recorded read/write paths can occupy the repository tree. Search/test/mention-only paths without that proof are shown under **Unplaced paths**; no directory is guessed from an indexed basename. Their tooltip states that the repository location is unresolved.
- Unknown namespaces stay unplaced while root metadata loads. Search retains the same status. Selecting such a row opens its exact captured identity, even after workspace consent; it never silently becomes a read from the repository root.
- Native worktree labels use their actual distinguishing directory and repository suffix, with a full-path fallback for collisions. Full recorded paths remain on hover. No branch name is inferred.
- Main folders keep canonical relative keys when another root arrives, while leaves retain their exact captured identity. Indexed main aliases are not duplicated. Saved old main-folder keys migrate to that canonical form; other roots' state is preserved. Folder reveal and current-reader handoff use the same exact root mapping.
- Existing classes, tokens and reader owners remain; the look is left to FINISH-8. No Clarity, styles, History/Origins, Toolbox, daemon graph/consent, controller or schema changes.

## Genuine UI acceptance

All imports and approvals are in scratch homes. Current inventory is read only after explicit workspace consent. No journal/configuration/project file is edited, and no native turn is submitted. Source manifests, content and screenshots stay only in `.local/`; reports contain prefixes, sizes and counts.

| Case | Widths | Checked |
|---|---|---|
| Claude `rec_31c2a507`, 6,519,293 bytes, 89 files | 600 / 1440 | 50 unresolved root candidates; zero at the repository root. Three representative search rows checked before and after consent per width. Existing captured preview, approved current preview and the same file in Workspace all open. |
| Codex `rec_a1d4f0e4`, 13,948,151 bytes, three agents / five roots / three files | 600 / 1440 | Both displayed non-primary directories have distinct labels. The captured preview opens, and all three files correctly retain their outside-primary-root status. No main-workspace read is offered for them. |
| Codex primary-workspace `rec_5752b823`, 343,031 bytes | 600 / 1440 | An indexed current-file preview opens and the same path becomes a Workspace tab. This preserves FILES-12's existing genuine primary-workspace case. |

The outside-only Codex session cannot be used as a positive current-file control: all three captures belong to other roots. Its graph deliberately remains `recording-files-only`; that existing isolation contract is tested by `workspace-main-root-aliases.test.ts` and is unchanged. A first inspection mistakenly expected an outside file to become a primary file, then corrected the test to assert the actual boundary. No source policy was loosened to make it pass.

Supplementary `pnpm check:real -- worktree-roots`: seven Codex sessions / 480 structural hits, 18 Claude sessions / 5,647 hits. Its selected Codex is the actual multi-agent case above; this scan is not counted as screen acceptance.

## Verification

- 16 tree units: unresolved listings, direct reads/writes, no basename guessing, root-loading state, stable main folders, exact leaf identities, alias deduplication, distinct/stable labels, cross-harness label collision and retained-key migration.
- Eight targeted Edge browser cases pass, requested three workers / zero retries: two new real-component regressions at 600/1440 plus existing FILES-6/7 identity, current/captured isolation, preview and Workspace cases. The new cases include the four reported names, consent, and appended roots; main expansion stays open.
- Final `check:affected` passes both types, 67 related units, UI build and 22 browsers (Edge, four workers, zero retries). The eight explicitly named file/worktree cases also pass with three workers / zero retries, and all six genuine UI checks above were repeated after the retained-state guard.
- Full isolated gate on frozen `5dce5bff`, its own frozen install: both types, 1,240 units / one existing skip, build, **664 parallel + 33 serial = 697 browsers / 28 existing skips / zero failures or retries**, and package verification pass (Edge three parallel / one serial worker). This frozen source precedes only the retained-folder-state compatibility guard in `c61459dd`. On that final source, both types, **all 1,241 units / one skip**, the affected/focused/real checks above, build and package verification pass again. The full browser suite was not repeated after that small guard; its scope is explicit rather than claiming a new complete command on the final revision. No outstanding FILES-13 acceptance line remains. Ready for other-builder review; not merged.
