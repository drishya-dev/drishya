# CONTENT-20 — messages typed while the agent works are prompts

## Cause (genuine `dd136b25`, counts only)

The adapter and projection already turn a human `queued_command` into a person prompt (LIVE-5 part 1, #310). The rail showed 121 because the **daemon's stored observations were old**. Observations are stored once and a source cursor only moves forward, so a journal imported before #310 never gained the `queued_command` rows it had already consumed.

- The real store holds 303 `message.user` observations for the recording. A fresh import of the same journal on main holds 356. The 53 missing (14 person messages, 39 task notices, all dated 29 to 31 Oct) are exactly the rows #310 started keeping.
- Reproduced in a scratch home: dropping those 53 gives 124 person prompts; the startup rescan below restores 138 in 8 s (the journal grew while the work ran; 121 in Yash's screenshot is the same state earlier).
- A fresh import already gave the right rail, so no classifier or composer change was needed for this part.

## Fix

1. **Startup rescan** (`IngestService.rescanLegacyClaude`, next to the Codex one; the shared loop is now `rescanLegacyOnce`). For each Claude recording not yet marked (`claude-queued-command-rescan-v1:<id>`), a read-only pass looks for `"queued_command"`; a journal without one is marked done at once, otherwise the recording is re-read once from byte 0 and stored rows are skipped by their stable ids. Per-recording marker, so it never repeats.
2. **One prompt per re-emitted record.** Claude Code re-emits earlier rows (same uuid, same timestamp, a different line) after a resume or compaction. `dd136b25` has five person rows twice (one of them a mid-turn message), so History showed them twice. The reducer keeps the first line that carried a prompt record part and skips copies from other lines (keyed by recording, record id and part; Codex has no record ids and is untouched). `REDUCER_VERSION` r38 to r39.
3. **A message another Claude session sent in is not a person prompt.** Claude Code delivers it as a `queued_command` with origin `peer`, text `<cross-session-message from-name=…>`. The classifier now knows that exact leading tag (`cross-session`, "message from another session"); it stays in History as a notice, not a tick. Found on two genuine journals.

Unchanged by design: a mid-turn message is dated when it was queued (LIVE-5), task notices (`task-notification`, with or without an origin) stay notices.

## Codex

A steer is written as an ordinary `user` response item (LIVE-5, genuine native `turn/steer` run, source `01a1965b`), so it is already a person prompt; no gap. No local Codex journal has input recorded while a command reports running (`check:real -- mid-turn-input`, 0 of the scanned files; one journal over 90 MB skipped), and Codex was out of usage, so no new capture was possible. Not re-verified on screen.

## Checked on genuine sessions

`check:real -- mid-turn-prompts --max-mb 200 --pick 10` (journal person turn starts, deduplicated by uuid, plus human queued commands, against the projection; rail ticks and the overview count): 10 of 10 pass. Includes `rec_81c22a35` (`dd136b25`, 171 MB; snapshot 138 = 106 turn starts + 32 mid-turn), `rec_e84b13de` (157 MB, 71, 28 mid-turn), `rec_f9c1e546` (155 MB, 67, 23), `rec_9101ae78` (42 MB, a joined view of two journals), `rec_554b9318` (10 MB, 38, 2), and five smaller. Through the real server in a scratch home, at 600 and 1440 px: `dd136b25` after the startup rescan restored 356 observations from 303: rail 138, hover "Prompt 88 of 138" (window shows its ordinal of the same total); `rec_554b9318` rail 38. Screenshots and the home stay in `.local/` and were never committed.

Not covered: no real Claude session has a mid-turn message that is itself a slash command or has an image in a re-emitted copy (units cover the image).

## Gate (merged with main d123112d, DRISHYA_BROWSER_CHANNEL=msedge, three workers)

Both typechecks pass. `check:affected`: 712 related units pass (114 files, 1 skip); browsers 724 parallel and 28 serial pass, 27 existing skips, and four serial specs fail (b2-live anchor, material-motion hover boundaries, two in p1-pacing), the same four recorded as failing identically on clean main in the USAGE-1 and CONTENT-19 notes (TEST-2). `package:verify` passes. An earlier run without the Edge channel failed every browser spec on a missing Chromium; that was the environment, not the change.
