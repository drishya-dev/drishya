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
- `pnpm check:affected` is running with `DRISHYA_BROWSER_CHANNEL=msedge`, `DRISHYA_WORKERS=2`. The new shared Modern sheet maps it to the complete browser suite, with its normal serial pass. No separate full gate, all-unit sweep or packaging run was added.
- A pre-existing overlap blocked the Screen menu entry from pointer input on the real 1440 px Claude scene; keyboard focus + Enter opened it. No geometry, menu or phase A fix is hidden in this colour task. Opus should recheck it after the phase A merges.
- No `SessionWorkspace.tsx`, composer, PromptRail, LINK-1, scale/ReadingWindow, History arrival or protected file was changed. Opus reviews/merges; the look of the surrounding geometry remains owned by its existing tasks.
