# SCREEN-1: Screen view for computer use (30 October 2026)

PR #298. Claude Code's computer tool, direct or inside a browser batch, can now be watched as a run on a large screen: the captured frame, the recorded action drawn on it at its recorded position, a strip of every captured step, keys, playback and a full-window mode. Real session content stays out of this file: ids are prefixes, everything else is counts.

## What was built

- **`packages/scene/src/screen.ts`** (pure): `screenRun(operations)` reads the computer steps of an operation list into `ScreenStep`s. A direct `computer` call is one step; a `browser_batch` is one step per computer action inside it. Each step carries the recorded action word, its recorded position, drag start, text, key, scroll direction and amount, `ref`, `region`, wait, tab, and the tab title and address the result recorded. **Placement rules (never guess):** a position is drawn only on the latest screenshot of its own tab, against the coordinate frame the harness reported ("Screenshot size: WxH") or, when none was reported and no `scale` was asked for, the stored image size; it is not drawn when it names only an element, has no position, lies outside the frame, has no earlier frame, the reported frame disagrees with the stored image, or a scaled image has no reported frame. A batch's images are matched to its screenshot and zoom actions in order only when the counts agree; otherwise none is matched and the step says how many images the operation holds. Capped at the newest 1,000 steps.
- **Reducer r25** (`packages/projection/src/reduce.ts`): a browser batch's input kept its actions' positions as "[2 items]" because positions sit one level deeper than the ordinary bound. `previewBatch` keeps up to 200 actions whole. The cache version moves to r25, so existing recordings rebuild on open without reimport.
- **`GET /v1/recordings/:id/screen[?step=n]`** (history worker, `app.history.screen`): the run over the whole recording whatever page the reader holds; `step` applies the replay boundary, so a later frame is never revealed early. Offline bundles compute the same run from the operations in hand.
- **`ScreenView.tsx`, `screen-view.css`:** a modal reader, Workspace-sized with a full-window mode (F). The frame at its natural shape with the recorded action drawn on it (ring for click, double, triple and right click; line with start dot and end ring for a drag; dot for a pointer move; ring with an arrow for a scroll); typed text, keys, waits and element scrolls are shown in the caption as recorded. A strip of every step (thumbnail for a frame, a short word for the rest, failed steps outlined), arrow keys, Home and End, Space for play, Esc to close. Playback follows captured timestamps with each gap held between 0.6 and 2.5 seconds and long gaps labelled ("12 min later"). A step with no new frame says "No new frame captured · showing step n"; a frame whose bytes were not kept shows its recorded size and why. A live run keeps following its newest frame until the reader moves. "Open operation" returns to the raw operation card.
- **Entries:** "Open screen" in the browser strip when its steps include a frame, and "Screen · n frames" in the session menu (only when the session has one). `browserStep` also reads Claude Code's own `computer` tool.
- **Motion:** one real material change only: the next frame replaces the last (a cross-fade when the two have the same shape, otherwise a plain fade) with a 3 percent settle toward the acted-on point; the marker appears once and holds. No cursor path (it is not recorded), no typing animation. Reduced motion removes the settle and the fade and keeps the swap.

## Real sessions (Claude Code), `check:real -- computer-frames`

Nine local Claude Code sessions contain the computer tool (journals repeat a call across rows, so the journal mention count is higher than the step count). Read together: **308 steps, 131 frames (131 kept, 0 omitted by the 4 MiB and 256 MiB caps), 155 steps from browser batches.** Of 40 pointer steps, **21 are placed** and 19 are not drawn, with the reason shown: 13 name an element only, 6 lie outside the frame they would be placed on.

| Session | Size | Steps (batch) | Frames | Pointer steps placed |
|---|---|---|---|---|
| rec_210973b8 | 234.5 MB | 85 (3) | 51 | 7 of 14 |
| rec_e84b13de | 156.8 MB | 45 (3) | 25 | 5 of 9 |
| rec_45b046b2 | 11.7 MB | 94 (92) | 28 | 4 of 9 |
| rec_ab475ed8 | 39.9 MB | 41 (24) | 15 | 4 of 5 |
| rec_cc002c1f | 24 MB | 36 (33) | 12 | 1 of 3 |
| rec_39af3c94, rec_c8e5c9c8, rec_554b9318, rec_64d5c199 | 8 to 83 MB | 1 to 3 each | 0 | none |

The four small sessions have no frame (screenshots that timed out or no screenshot), so they show no Screen entry. In the reader, on rec_e84b13de at 600 and 1440 px (45 steps, 25 frames, 5 markers, 3 notes) and rec_45b046b2 at 1440 px (94 steps, 28 frames, 4 markers): no page overflow, no page error, every strip step reachable, full-window mode works. A pointer move recorded inside a batch lands on the very node of the screenshot it was aimed at (checked visually; the image stays in `.local/`).

**Not verified, and said so:** *Codex* (`check:real --harness codex`: no real session has a computer-use capture with frames; `mcp__cua_repl` is listed in sessions and called once with no screenshot rows) and a *desktop computer-use tool* (no session uses one; the "computer" tool-name hits in the journals are entries inside browser batches) wait for NATIVE-5. The reader recognises Claude Code's own `computer` tool by name, but no real session has one, so that path is unit-tested only.

## Acceptance

- Markers at the recorded coordinate, checked against the raw input: units for scaling, scaled frames, per-tab frames, drags, batches (14 in `packages/scene/test/screen.test.ts`), and a browser spec on a synthetic run with known coordinates that measures each marker's centre against the displayed image at 600 and 1440 px.
- A step with only a `ref` draws nothing and says so; scrubbing, arrow keys, Home and End, Space and F work; full-window mode fills the window.
- Reduced motion: the image's animation is `none`, the frame swap remains.
- Nothing is requested from another origin (the spec records every request).
- Replay boundary: the endpoint returns fewer steps and frames for an earlier replay position, in the same order, and none at position 0 (browser spec). The reader passes the replay position when it is in replay; that wiring is read from code and not driven through a replay in a browser.
- A 150-step run steps from first to last by keyboard with at most two frame images mounted at any time and all 150 strip cells present; this measures responsiveness, not a ten-minute sitting.
- Checks: both typechecks; 506 affected units; 478 affected browser specs and 33 serial specs, with one failure, `file-deletion-acceptance.spec.ts:41`, which fails identically on clean main since #295 and is repaired in #300. Full gate: see PR.

## Limits

A batch holds at most 200 recorded actions (older recordings rebuild with that bound). A zoom frame is shown but positions never refer to it. Positions in a window whose screenshot was never captured are not drawn. Playback is paced for reading and does not reproduce original timing. The `computer` tool of other harnesses and desktop control are unverified (above).
