# SHIP-20 — Reader and Workspace ink

11 November, Yash with Codex, [PR #404](https://github.com/drishya-dev/drishya/pull/404). Uses the settled [SHIP-17 roles](ship-17-palette-contract.md). Colour and weight only; no geometry, font family, content, motion or controller changes.

| Before | After | Why |
| --- | --- | --- |
| Reader line numbers inherit the non-text chrome ink | Muted text ink | Line numbers are readable metadata |
| Review/search excerpts are secondary UI copy | Primary ink | These are the actual captured material |
| Reader paths inherit general UI ink | Source ink | Distinguish location from provenance |
| Workspace types/properties share keyword/function ink | Their own type/property roles | Same syntax vocabulary as captured source |
| Screen thumbnail number sits over a translucent black wash | Primary ink on an opaque palette surface | Contrast no longer depends on image pixels |

## Boundaries

`modern/reader-ink.css` is the sole Modern adoption sheet. `DraftEditor.tsx` changes only its existing HighlightStyle role mapping. SHIP-21 owns Git and agent identities. Phase A's composer, links, viewport scale and peek geometry remain untouched. MOTION-4 stays draft until UI-28c, LINK-1 and the LAYOUT-1b redo merge.

## Scoped literal-colour audit

Reader, editor, evidence, replay, image, review, search and Screen source sheets were inspected. The adoption sheet contains no literal colours. Existing syntax token selectors in theme-presets already apply inside readers. Existing diff signs and washes are adopted explicitly, preserving light-specific diff inks.

Retained exceptions: black neutral shadows and modal scrims; old fallback values behind `--bg`; Screen's black/white double-edged pointer/drag marks, which must remain visible over arbitrary captured pixels. Captured image pixels are never recoloured. Thumbnail number labels now use an opaque palette surface instead of white over a black translucent wash.

## Acceptance

66 genuine-session visual checks at 600 and 1440 px, each in Jet Black, Daylight and Midnight. Scratch Drishya homes only; private frames and side-by-side comparisons in `.local/ship-20/compare/`. No native journal content printed or committed.

| Capture | Size / counts | Cases checked |
| --- | --- | --- |
| Claude Code `rec_39af3c94` | 14,545,573 bytes; 747 operations; 46 file references; 15 presented image prompts, including two image-only prompts | Current source and syntax, peek, Workspace, recorded diff, captured image reader, search; 30 checks |
| Codex `rec_7cb1cda1` | 15,023,432 bytes; 1,115 operations; 25 file references | Recorded diff; six checks. Its old worktree is gone, so it is not used to claim current-disk acceptance |
| Fresh native Codex `rec_0fae4f71` | 248,478 bytes; two operations; one file reference | Current source, syntax, peek and Workspace; 12 checks. Real CLI, throwaway directory, read-only policy; no saved setting changed |
| Codex `rec_13949e17` | 825,746 bytes; 112 operations; one multi-image prompt, two captured images | Captured image reader and search; 12 checks |
| Claude Code `rec_6e3b7ccf` | 5,053,912 bytes; 232 operations; 45 computer steps, 31 retained frames | Screen; six checks |

The Codex captures used here have no Screen run; Screen's genuine frame/marker acceptance is on Claude Code, and Codex shares that same reader. The `computer-frames` scanner is Claude-only internally, so its zero Codex matches are not treated as proof that the entire machine has no Codex frame recording.

The initial real-session run hit an empty early Codex edit; acceptance explicitly selects a recorded nonempty patch instead. This is not a fabricated artifact. The fresh Codex attachment is metadata-only in its projection, so image acceptance uses `rec_13949e17`'s two retained images instead.

## Checks and integration notes

- Six focused `reader-ink.spec.ts` checks pass: all palettes at both widths, real rendered source syntax roles, line-number ink, paths, editor gutter and retained local editing. This synthetic regression guard is separate from genuine-session acceptance.
- `palette-contrast.test.ts` passes the settled SHIP-17 role floors. The adoption sheet adds no colour literals or palette declarations.
- `check:real -- workspace-files` checks both harnesses; `image-only-prompt` checks Claude; `multi-image-prompts --harness codex` confirms both captured Codex images; `computer-frames` checks the genuine Claude Screen run.
- `pnpm check:affected` completed with Edge, two parallel workers and the normal one-worker serial pass: parallel **733 passed / 27 skipped / 16 failed**, serial **25 passed / 1 skipped / 7 failed**. Both typechecks and build passed; no related unit files were found. Shared Modern CSS selected the complete browser suite. No separate full gate, all-unit sweep or packaging run was added.
- Clean-main comparison at `9f643c76`, with its own frozen install/build: **all 23 failures reproduced at the identical test-code frame**. All five assertion failures had identical expected/received values; 17 explicitly show the toolbox rail intercepting pointer events; the remaining timeout is masked by cleanup. Diagnostic caps were 30 seconds rather than the broad run's normal 90 seconds; two workers for parallel, one for serial, zero retries. These are baseline failures, not a green gate or a claim that every failure is a timing flake.
- Final member-function ink correction: the editor now maps callable properties to function ink while ordinary properties keep property ink. Final-head typechecks, UI build and all six focused browser checks pass, including type, property and member-function assertions. The broad run precedes this final one-role correction; it was not repeated. Private logs: `.local/affected.log`, `.local/final-reader-tests.log`; clean-main logs in the sibling `ship20-control-nov11/drishya/.local/`.
- A pre-existing overlap blocked the Screen menu entry from pointer input on the real 1440 px Claude scene; keyboard focus + Enter opened it. No geometry, menu or phase A fix is hidden in this colour task. Opus should recheck it after the phase A merges.
- No `SessionWorkspace.tsx`, composer, PromptRail, LINK-1, scale/ReadingWindow, History arrival or protected file was changed. Opus reviews/merges; the look of the surrounding geometry remains owned by its existing tasks.

## Baseline comparison by check

All rows below failed at the same code frame on this branch and clean main. The shortened diagnostic stopped at the same visible failure frame. B4 is a cleanup-timeout frame and does not prove the masked underlying cause; see the classification below.

| Check | Same test frame | Same waiting locator / assertion values |
| --- | --- | --- |
| `parallel/tests/browser/adaptive-content.spec.ts:41` | Yes | Yes |
| `parallel/tests/browser/b4-history.spec.ts:9` | Yes | Yes |
| `parallel/tests/browser/classic-refinement.spec.ts:50` | Yes | Yes |
| `parallel/tests/browser/composer-access.spec.ts:19` | Yes | Yes |
| `parallel/tests/browser/investigation-finishing.spec.ts:47` | Yes | Yes |
| `parallel/tests/browser/modern-replay.spec.ts:24` | Yes | Yes |
| `parallel/tests/browser/modern-replay.spec.ts:39` | Yes | Yes |
| `parallel/tests/browser/product-workspace.spec.ts:252` | Yes | Yes |
| `parallel/tests/browser/product-workspace.spec.ts:627` | Yes | Yes |
| `parallel/tests/browser/product-workspace.spec.ts:686` | Yes | Yes |
| `parallel/tests/browser/product-workspace.spec.ts:725` | Yes | Yes |
| `parallel/tests/browser/product-workspace.spec.ts:983` | Yes | Yes |
| `parallel/tests/browser/recorded-usage.spec.ts:29` | Yes | Yes |
| `parallel/tests/browser/review-questions.spec.ts:19` | Yes | Yes |
| `parallel/tests/browser/screen-view.spec.ts:112` | Yes | Yes |
| `parallel/tests/browser/session-menu.spec.ts:58` | Yes | Yes |
| `serial/tests/browser/b2-live.spec.ts:63` | Yes | Yes |
| `serial/tests/browser/material-motion.spec.ts:132` | Yes | Yes |
| `serial/tests/browser/p1-pacing.spec.ts:40` | Yes | Yes |
| `serial/tests/browser/p1-pacing.spec.ts:266` | Yes | Yes |
| `serial/tests/browser/p1-pacing.spec.ts:428` | Yes | Yes |
| `serial/tests/browser/p1-pacing.spec.ts:461` | Yes | Yes |
| `serial/tests/browser/p1-pacing.spec.ts:708` | Yes | Yes |

## Failure classification requested by Opus

No further clean-main comparison is running or planned. The toolbox rail and `large-screens.css` are unchanged; the LAYOUT-1b redo owns that fix. The logs identify **17 explicit toolbox-rail pointer interceptions (14 parallel, three serial)**, not every failure as one proven cause.

### Toolbox-rail timeouts

- `parallel/tests/browser/adaptive-content.spec.ts:41`
- `parallel/tests/browser/classic-refinement.spec.ts:50`
- `parallel/tests/browser/composer-access.spec.ts:19`
- `parallel/tests/browser/investigation-finishing.spec.ts:47`
- `parallel/tests/browser/modern-replay.spec.ts:24`
- `parallel/tests/browser/modern-replay.spec.ts:39`
- `parallel/tests/browser/product-workspace.spec.ts:252`
- `parallel/tests/browser/product-workspace.spec.ts:686`
- `parallel/tests/browser/product-workspace.spec.ts:725`
- `parallel/tests/browser/product-workspace.spec.ts:983`
- `parallel/tests/browser/recorded-usage.spec.ts:29`
- `parallel/tests/browser/review-questions.spec.ts:19`
- `parallel/tests/browser/screen-view.spec.ts:112`
- `parallel/tests/browser/session-menu.spec.ts:58`
- `serial/tests/browser/p1-pacing.spec.ts:428`
- `serial/tests/browser/p1-pacing.spec.ts:461`
- `serial/tests/browser/p1-pacing.spec.ts:708`

### Other baseline failures — do not hide these

- `parallel/tests/browser/b4-history.spec.ts:9`: timeout surfaces during `page.unrouteAll` cleanup at line 77, on both branch and clean main. Cleanup masks the original cause; this is not classified as a proven toolbox-rail failure.
- `parallel/tests/browser/product-workspace.spec.ts:627`: `Expected: < 3`; `Received:   34`. Both values match clean main.
- `serial/tests/browser/b2-live.spec.ts:63`: `Expected: 926`; `Received: 928`. Both values match clean main.
- `serial/tests/browser/material-motion.spec.ts:132`: `Expected: true`; `Received: false`. Both values match clean main.
- `serial/tests/browser/p1-pacing.spec.ts:40`: `Expected: 0`; `Received: 3`. Both values match clean main.
- `serial/tests/browser/p1-pacing.spec.ts:266`: `Expected: 1`; `Received: 0`. Both values match clean main.

All six final reader checks, final types/build, palette-floor unit and 66 genuine-session visual checks pass. **No SHIP-20-specific failure was found**, but it would be inaccurate to say nothing else fails: the six non-rail baseline failures above remain recorded. No new run was started to investigate them after Opus's stop instruction.
