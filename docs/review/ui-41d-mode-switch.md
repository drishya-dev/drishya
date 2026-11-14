# UI-41d: Switching from Work to Conversation keeps the reading place too

## Summary
Yash reported on 14 Nov after UI-41c (#478) merged: *"now toggling from conversation to work keeps the page the same but the other way it doesnt."*
Conversation → Work kept the passage in view, but Work → Conversation lost the place and fell back to the bottom or another passage.

This item fixes Work → Conversation mode switching so that the reader's place (passage and pixel offset) is preserved in both directions, across all window widths (600 px to 1440 px), near the top, in the middle, and near the bottom of long sessions.

## Root Cause
1. **Passage Run Folding Mismatch**:
   - In Work mode, each passage in an operations run renders all of its tool calls inside `.ops-row` elements.
   - In Conversation mode, contiguous tool passages are grouped into a single `Run`. The first passage is the `lead` and renders a `<button className="run-line">`. Subsequent passages in the folded run have `hidden.has(id)` in `runFold` if they have no other content (prose, prompt), rendering empty `<div class="passage-slot" data-folded="hidden" />` placeholders with 0 px height.
2. **Anchor Element Mismatch**:
   - When switching Work → Conversation, the top visible element in Work is often an `.ops-row` or card within a non-lead passage.
   - In UI-41c, the restore logic looked for:
     ```ts
     const part = wanted.kind === 'turn' ? slot?.querySelector('.turn')
       : wanted.kind === 'prose' ? slot?.querySelectorAll('.prose')[wanted.index]
       : slot?.querySelector('.ops-row') ?? leadSlot?.querySelector('.run-line');
     ```
   - For a non-lead folded passage, `slot` has no `.ops-row`. If `leadSlot` was not yet mounted in the viewport (because the reflow shrank the document and the scroll position was far away), `leadSlot` was null, and `part` was not found.
3. **Unmounted Virtual Target**:
   - When `part` was null, UI-41c fell back to:
     ```ts
     const index = scene.passages.findIndex((ps) => ps.id === (slot ? wanted.passageId : lead));
     ```
   - Because `slot` existed as an empty hidden div (`data-folded="hidden"`), `(slot ? wanted.passageId : lead)` evaluated to `wanted.passageId`. Its prefix layout offset was at the end of the previous passage, scrolling to a zero-height placeholder rather than the visible `lead` containing the `.run-line`.
4. **Anchor Overwriting during RAF Settlement**:
   - On restore, UI-41c did not update `readingAnchor.current` with the restored slot and offset.
   - Two RAFs later, a layout effect executed `if (!useApp.getState().follow) rememberReading()`. This re-scanned the viewport from `box.top` and captured whatever arbitrary passage was visible at the temporarily clamped scroll position, overwriting the user's reading anchor.

## Fix
In `apps/ui/src/components/History.tsx`:
1. **Comprehensive Nearest-Element Resolution Chain**:
   - For `wanted.kind === 'ops'`:
     `slot.ops-row` → `slot.run-line` → `leadSlot.run-line` → `slot.prose` → `slot.turn` → `leadSlot.ops-row` → `leadSlot.prose` → `leadSlot.turn`.
   - For `wanted.kind === 'prose'`:
     `slot.prose[index]` → `slot.prose` → `slot.run-line` → `slot.ops-row` → `leadSlot.run-line` → `slot.turn` → `leadSlot.prose` → `leadSlot.ops-row`.
   - For `wanted.kind === 'turn'`:
     `slot.turn` → `slot.prose` → `slot.run-line` → `slot.ops-row` → `leadSlot.turn` → `leadSlot.run-line` → `leadSlot.ops-row`.
2. **Unmounted Virtual Target**:
   - Only target `wanted.passageId` if `slot` is mounted and has visible content (`!slot.dataset.folded !== 'hidden' && slot.dataset.unloaded !== 'true'`). Otherwise, target `lead` so the virtualizer mounts the passage containing the `.run-line`.
3. **Persist Restored Anchor**:
   - When `part` is found and aligned, update `readingAnchor.current` with the containing slot's ID and offset, update `memory` (`history/anchor` and `history/top`), and sync `readingPassageId`.
4. **Prevent Premature Re-anchoring**:
   - Remove premature re-scanning from `useLayoutEffect([historyMode])`. User scrolling via `onScroll` continues to update the anchor normally when the user navigates.

## Real Session Acceptance
Verified on genuine local sessions of both harnesses across scroll positions (near top, middle, near bottom) and window widths (1440 px and 600 px):
- **Claude Code**:
  - `rec_dac6d1d1` (3.7 MB, 45 turns, 267 operations):
    - 1440 px: fraction 0.15 (true, true), fraction 0.50 (true, true), fraction 0.80 (true, true).
    - 600 px: fraction 0.15 (true, true), fraction 0.50 (true, true), fraction 0.80 (true, true).
  - `rec_7baa719e` (390 KB, 4 turns, 11 operations):
    - 1440 px: fraction 0.15 (true, true), fraction 0.50 (true, true).
- **Codex**:
  - `rec_45333698` (5.4 MB, 13 turns, 108 operations):
    - 1440 px: fraction 0.15 (true, true), fraction 0.50 (true, true), fraction 0.80 (true, true).
    - 600 px: fraction 0.15 (true, true), fraction 0.50 (true, true), fraction 0.80 (true, true).

In all cases, toggling Work → Conversation → Work kept the exact same passage in view each way without falling back to the bottom or losing position.

## Automated Specs
`tests/browser/conversation-switch.spec.ts`:
- Added `switching Work to Conversation near the top keeps the reading place at 1440 and 600`
- Added `switching Work to Conversation near the bottom keeps the same passage and never falls back to the bottom`
- Added `switching both ways at 600 px keeps a run cards (or line) where it was`
All 7 specs pass in 52.7s on Edge with 0 retries and 0 failures.
