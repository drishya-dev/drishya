# SHIP-20 — Reader and Workspace ink

Work in progress, 11 November, Yash with Codex. Uses the settled [SHIP-17 roles](ship-17-palette-contract.md). Colour and weight only; no geometry, font family, content, motion or controller changes.

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

Pending: focused checks, all-three-palette real-session comparison at 600 and 1440 px, and affected checks. Private frames belong in `.local/ship-20/compare/` only.

Genuine baseline: Claude Code `rec_39af3c94`, 14,545,573 bytes, 747 operations, 46 file references; Codex `rec_7cb1cda1`, 15,023,432 bytes, 1,115 operations, 25 file references. Scratch Drishya home; no native journal content printed.

The `computer-frames` scan found 12 Claude Code sessions; selected `rec_6e3b7ccf`, 5.1 MB, 232 operations, 45 steps and 31 retained frames. Its current scanner has no Codex computer-frame implementation, so zero Codex matches are not proof that no Codex frame recording exists. Verify imported Codex browser/Screen operations separately.
