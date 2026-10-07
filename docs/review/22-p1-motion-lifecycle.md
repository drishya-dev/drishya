# 22 — P1 motion survives live updates

6 October 2026 · Yash / Codex · `codex/ink-presentation` · supersedes the standalone-study queue.

The builder explicitly reopened P1: the running app still felt like popups rather than a finished animated product. Keep improving the integrated application, preserve `docs/prototype/`, and remove redundant HTML versions. Passing code checks does not establish that the builder accepts the presentation.

## What was wrong

`Origins` tied animation ownership to an effect which also depended on capture revisions, scene composition and passive hover. Its cleanup cancelled all animations and removed the SVG children. A normal update could erase a 620–700 ms arrival before the relationship became visible. This was a functional motion defect, not just a palette preference.

Finite animations now belong to a component-owned registry across ordinary renders. Passive threads redraw separately. A cue retains its measured destination; moving or unmounting that destination cancels the cue rather than leaving a stale screen coordinate. Completed and cancelled animations remove their SVG elements and registry entries. At most 36 finite animations are retained, in addition to the existing three-action arrival budget. Nothing loops and capture never waits for this registry.

Reading, pointer-down, keyboard navigation, scroll, resize, theme/view/session/source changes and opening auxiliary reading surfaces still cancel motion. Pointer movement alone does not. Hidden documents drain motion; new hidden-document arrivals are suppressed. Session changes establish a fresh semantic baseline so loading old history cannot look like new agent work.

Tool and file travel use a separate, slower-starting travel curve. The material expansion curve remains quick; it must not make the origin relationship finish in the first few frames. The empty backing and app-owned glyph can move; captured characters remain stationary, whole and selectable. All five moves remain finite: Lift, Emit, Settle, Surface and Resolve.

## One implementation to continue

The production UI is `apps/ui`, served from its built assets. Removed: the Studio/Relay/Atlas/Canvas gallery and supporting assets under `apps/ui/public/concepts`, its five browser study tests, and the obsolete single-panel `docs/review/05-experience-storyboard.html`. Their written design records remain historical, explicitly superseded. Keep both `docs/prototype/index.html` and `docs/prototype/vantage-ink.html`; neither is the production renderer. Never delete the required `apps/ui/index.html` entry point.

No new HTML alternative replaces the app. Shared task views, palettes, real map origins, in-place reading, independent live capture, historical provenance, source utilities and bounded worker projections remain. Larger read-only IDE features in DEVELOPER_WORKSPACE and review/19 are staged features, not missing animation placeholders.

## Running the updated app

An already running daemon serves `apps/ui/dist`, not TypeScript source. Rebuild and reload before assessing the changes:

```powershell
corepack pnpm ui:build
corepack pnpm serve
```

Use the printed authenticated launch URL. For visible ongoing synthetic work choose **Watch live demo**, not the completed demo; actual completed recordings remain immediately readable and are not animated again as if new. For development use `corepack pnpm dev` and `corepack pnpm ui:dev` in separate terminals. Check Motion is enabled and low-resource/reduced-motion settings are not intentionally suppressing it.

## Acceptance

The new browser regression freezes an actual instrument transfer mid-flight, hovers its operation, and confirms the same animation remains connected. Deliberate expansion must remove it immediately and leave no active cue. A second case switches system reduced motion during the frozen transfer and verifies cleanup after the browser dispatches its native media-change event. Existing checks cover source/tool origins, all five moves, stationary captured text, input before result, stable row wrapping, burst holds, reduced motion, map fallback and source navigation. Synthetic frames include the real mid-flight transfer, not a mockup.

Local verification results are recorded in STATUS. Hosted CI remains publishing-only under CI_POLICY. Human visual acceptance and physical/platform release gates remain separate; no market-superiority claim follows from these tests.
