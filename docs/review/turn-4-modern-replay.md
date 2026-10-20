# TURN-4 — explicit Modern replay

20 October 2026 · PR #148.

| Before | After | Why |
|---|---|---|
| Replay buried under Settings → Playback → Sequence diagnostics | Explicit Replay captured work entry inside existing workspace utilities | Discoverable without a resident button or changing live-by-default behavior |
| Full-width diagnostic transport includes resource/map/motion controls | Compact bottom transport for playback, stepping, speed, outcome jumps, timeline and Exit | Keep replay focused; settings retain their established home |
| Scrubber built from a pointer-driven div | Native keyboard-accessible range, turn ticks in one SVG path, established Timeline label/value attributes | Browser interaction and focus behavior without adding a node for every marker |
| No visible Modern replay route in normal menu | Menu and Settings entry reuse the same state clock, marker API and seek owner | One playback implementation, independent from passive capture |

## Behavior and motion

Normal mode stays full live history; choosing Replay is explicit. The menu starts from step0 when entering from history, and merely reveals controls for an already selected replay cursor. Play/Pause, step, native Home/End/arrow scrub and0.5/1/1.5/2/4× use existing state actions. Next edit/failure still queries the whole paged recording, not the resident marker sample. Exit stops replay and restores current history, including subsequently captured work. Existing Settings Replay sequence opens this same Modern bar. Retained Legacy transport is unchanged.

Captured order is paced for reading, not a promise to reproduce original execution timing. No harness prompt, command or native control is run by this UI. Existing capture/SSE and historical as-of material remain independent; hover, reading and upward history scroll do not stop an explicitly running clock. Pausing/seeking/stepping/jumping/exiting are deliberate transport changes.

Pointer entry: same surface, opacity and6px translation over160ms using existing ease-out token. No keyboard entry animation; reduced-motion and low-resource preferences also suppress it. Exit is immediate, so no teardown delay can block reading or capture. No new motion dependency or rendered text animation. Focus moves to Play/Pause without scrolling; established Play/Pause/Timeline accessible names preserve existing shortcut-guide acceptance.

## Local validation

- Running actual Modern application inspected before edits: the old Settings diagnostic transport is functional but crowded and full width. Menu had no direct Replay entry. Before/after screenshots inspected.
- Two new browser journeys (`modern-replay.spec.ts`) exercise default absence, entry, pause/play/restart, steps, speed, next edit/failure, timeline bounds and loaded end material, turn tick path, Exit, plus viewport containment/no transport overflow at1440/900/390/320px.
- Reading journey confirms the clock advances while hovering a tool header and scrolling upward. While paused, importing appended synthetic captured events increases total steps without moving the paused cursor; exiting reveals the appended prompt in ordinary history. It never resumes a native harness.
- Existing Reading shortcuts replay regression passes unchanged: the guide leaves playback advancing. UI typecheck and production build pass. Three focused browser checks total, no hosted CI.
- Actual redacted Drishya Codex2671 steps, Skeletongraph Codex2912 and Skeletongraph Claude5955: explicit menu entry, advancement, pause, keyboard seek to end, supplied turn ticks, and clean exit. End checks wait for visible loaded material, rather than treating an updated counter as completed paged rendering. Screenshots inspected locally.

## Limits

Physical touch/low-resource/platform acceptance and broader motion/theme checks remain release work. Ordinary paged fetch/settlement behavior is reused, not rewritten; exact original wall-clock timing is not claimed. The old Skeletongraph native journal ENOENT warning is pre-existing; imported captured content remains readable. TURN-3's41-ledger/38-chapter coverage audit remains independently open. No event schema, backend/runtime, controller policy, History layout, global palette or native-settings change.
