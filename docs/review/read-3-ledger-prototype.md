# READ-3 — compare older work before changing the canvas

28 October 2026 · draft PR #274. Production History, card rendering, measurements, turn folding and themes are unchanged. The task explicitly requires builder selection before integration; no direction is promoted by this PR.

## Three different reading models

| Direction | Before | After | Why / cost |
| --- | --- | --- | --- |
| Ledger | Older successful cards retain full previews | One chronological row per action; heading hover or E reopens the same material, Escape releases a pinned reading | Most direct scanning; less source/output visible at rest |
| Passage strips | Older cards occupy their original allocations | Compact left-to-right headers; chosen material takes the passage width | Keeps the canvas grammar; long titles truncate sooner |
| Passage outline | Every older action is resident | One disclosure per captured passage; reopening restores all original cards | Most space for prose; finding an individual action takes another disclosure |

Running, failed, unresolved and current actions are never candidates. A passage containing one of these is not hidden by the outline. Browser groups retain their native presentation. The prototype uses the existing captured scene's settled classification, not a fabricated wall-clock age or completion claim. Selecting the winner must also settle the final age threshold.

The study reuses the real application inside an isolated frame. It neither copies material text nor changes captured operations. Original readers, Expand, selection, copy and evidence navigation remain the application's controls. Prototype disclosure and the production hover reader do not independently reposition the same card. The variant picker switches instantly; its highlight is the installed skill's fixed picker specification. Reduced motion retains ordinary immediate disclosure.

## Isolation

Before the embedded application loads, working-location GET/PUT/DELETE are handled only in frame memory. Local and session storage are also frame-local memory. Folding, follow/hold, scrolling and preferences cannot replace normal saved working state. Authentication still uses the ordinary local launch token and HttpOnly session cookie. This is a local development route, with no production import or product navigation entry.

An independent source review found the initial risk of autosaving prototype folds through the normal app. The isolated bootstrap fixes it; a browser guard verifies no working-location write reaches the daemon and the existing stored value stays identical. The comparison creates no native turn, source write or permission change.

## Reproduce locally

Run the normal authenticated daemon and UI dev server. Open `/prototypes/read-ledger/?recording=<imported-recording-id>` on that UI origin, using the current launch token in the fragment if a session cookie is not already available. The local private launcher prepared during this review opens the actual stored Codex sample; its credentials and screenshots are ignored under `.local/` and are not part of this PR.

Keys 1–3 and Left/Right select directions; editing controls ignore these shortcuts. Selection survives reload via `?v=1`, `2` or `3`. The picker is at the top because bottom-center belongs to the composer. The frame preserves desktop support down to 600 px.

```powershell
node node_modules/typescript/bin/tsc --noEmit -p apps/ui/prototypes/read-ledger/tsconfig.json
$env:DRISHYA_BROWSER_CHANNEL='msedge'
node node_modules/@playwright/test/cli.js test tests/browser/read-ledger-prototype.spec.ts --workers=1
```

## Actual acceptance and limits

Actual stored captures were inspected before styling, then each direction was rendered at 600 and 1440 px: twelve combinations, not the demo. Screenshots remain private. Counts concern the loaded native history window, not a claim to mount the entire recording.

| Harness / prefix | Native source bytes / observations | Mounted comparison cases |
| --- | --- | --- |
| Codex `4b5ca5b1` | 44,016,822 / 1,530 | 31 settled successful actions, 14 prose blocks; outline has four eligible passages |
| Claude Code `c8e5c9c8` | 82,859,509 / 10,466 | Seven settled successful actions, six prose blocks; outline has four eligible passages |

All twelve combinations have zero viewport overflow and zero page exceptions. Existing duplicate-recording-key diagnostics and unavailable original-path requests remain visible in these stored-source environments; the study does not suppress them or claim a clean whole-product console. The real captures include shell and file-change/read material; fixtures additionally protect mixed successful/failed passages, current work, pointer hover, E/Escape, fast picker switching, editing shortcuts, retained DOM identity and recovery isolation. Four focused browser journeys pass. Typechecking includes the prototype explicitly because production's normal include intentionally remains `src` only.

**Not done:** builder choice, integration of the chosen direction, final age threshold, measurement/anchor integration with TEST-2's owner, full native scroll/replay acceptance after that integration, and human ten-minute preference. These are explicit decision/integration dependencies, not claims that the prototype finishes READ-3. No full batch gate was run for this draft.

**Claude handoff:** review the three directions on the same actual sessions, help choose the final density/age behavior, and coordinate production History integration with the active History owner only after selection. Do not merge a prototype direction as the default merely because its regression fixtures pass.
