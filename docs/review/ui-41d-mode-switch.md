# UI-41d: Switching from Work to Conversation keeps the reading place too

## Summary
When switching reading mode between Work and Conversation:
- Conversation → Work currently keeps the passage in view.
- Work → Conversation can lose the reading position and fall back, especially when the anchor in Work is an ops row or a card inside a passage or run that folds differently or does not render an `.ops-row` in Conversation mode.

## Evidence & Investigation
- Harness sessions checked:
  - Claude Code: `rec_c8e5c9c8` (83.7 MB, 2695 operations)
  - Codex: `rec_af2cd202` (3.3 MB, 311 operations)
- Tasks and acceptance criteria:
  - Check real Claude Code and Codex sessions at 600 px and 1440 px.
  - Check scrolled near the top, in the middle (anchor on prose, on a card, on a run line), and near the bottom.
  - Work → Conversation → Work keeps the same passage in view each way.
  - Work → Conversation cases added beside UI-41c's in `tests/browser/conversation-switch.spec.ts`.
