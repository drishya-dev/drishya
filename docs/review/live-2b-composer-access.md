# LIVE-2b — keyboard prompt entry and end clearance

20 October 2026 · PR #153 · uses installed Emil design-engineering guidance.

| Before | After | Why |
|---|---|---|
| Collapsed live prompt requires pointer entry or tab traversal | Ctrl/Cmd+Shift+Enter expands and focuses without changing text or submitting | Deliberate keyboard entry with no extra resident button |
| No shortcut discovery | ARIA key-shortcuts on the prompt region and Settings → Keyboard entry | Keep the ordinary interface compact while exposing the action |
| End-padding item had no focused acceptance | Existing measured gap is verified with a long draft and final expanded card at four widths | Retain working layout instead of adding a competing padding rule |

The shortcut is inactive for other editable fields/editors, visible menus/dialogs, IME, repeats, unavailable surfaces and hidden live controls during replay. It does not change native permissions, send, stop, replay state or capture. It clears pointer-motion eligibility before opening, reusing the existing choice/focus path; keyboard entry adds no animation. Hidden Search markup is not mistaken for an open dialog. Replay deliberately hides the native composer; its clock keeps advancing and its saved collapsed state remains when leaving replay.

## Verification

- Running actual redacted Drishya Codex store inspected before editing: chord did not open the prompt. After editing it opens/focuses. Native submission was never invoked.
- Existing gap measurement remains composer logical height +24px; real-session reading shows167px bottom padding with159px gap for a135px composer. This was already working. The focused final-tool fixture verifies actual card-bottom clearance, rather than equating a CSS value with visible success.
- Three new Edge journeys pass: Ctrl/Meta focus and unchanged draft/no send; other-field/menu/dialog/IME ownership; long-draft/final expanded400-line tool result clearance at1440/900/390/320px with no document overflow; replay continues while its hidden composer remains untouched. Mock controller supplies idle state only; no harness execution.
- Existing Modern compact composer consent/no-needless-scrollbar regression passes. Both TypeScript checks and production build pass. Local screenshots inspected.
- The isolated production build resolves this worktree's scene source explicitly because shared UI dependency junctions otherwise resolve the other checkout. No dependency changes or other-checkout edits.

## Limits

Physical keyboard/IME and human ten-minute acceptance remain REL-3; phone widths are emulation. No native signed-in turn or controller permission change is certified here. Source capture, projection, Search/Viewer (REVIEW-2), themes, full Workspace and submission behavior are unchanged.
