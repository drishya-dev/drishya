# TEST-2 — current rail focus and editor timing

31 October 2026. **Whole item remains open.** The builder explicitly chose to wait for Harsh's merges before changing the MCP section of History or the large-draft test in `fresh-workspace.spec.ts`. This branch changes only the unclaimed rail component/spec and records the independent editor diagnosis. No full gate is run for this unfinished item.

## Rail: measured cause and repair

| Before | After | Why |
|---|---|---|
| Home requests ordinal one; the old focused end-row is unmounted by virtualization. A simultaneous active-chapter change sees BODY focused and auto-scrolls back to the active chapter. The next render removes ordinal one. | The active-chapter scroll yields while a keyboard focus request is pending. The existing layout effect focuses the requested real row, and the usual focused-rail guard then owns the position. | An active-history update must not override deliberate keyboard reading during the brief replacement of virtual rows. |

The old production path failed three of twelve instrumented fixture runs. Numeric event logs show pending ordinal zero, viewport zero, a concurrent active change 69 → 70, an automatic scroll to 480, and loss of the requested row. Diagnostics were removed before the production change.

A separate controlled component regression changes the active chapter in the same React commit as Home. It fails on the old component and passes with the guard. The complete existing rail spec plus this regression passes **30 checks** (ten runs of each case, four workers). Focus, activation, viewport containment and bounded mounted rows are still asserted; no wait or timeout was relaxed. Both typechecks pass. No visual timing, History, replay clock, capture or data model changed.

## Genuine acceptance

Private scratch copies of already-redacted sources were checked at 600 and 1440 px. Each frame ran ten End/Home cycles and rechecked ordinal-one focus after the subsequent layout frames: **40 complete cycles**, zero page errors or external requests. The rail mounts at most 46 rows at 600 px and 54 at 1440 px; all presented chapters remain addressable. Real screenshots and numeric diagnostics stay private in `.local/`.

| Prefix / harness | Observations at open → at check | Scratch SQLite bytes | Presented chapters | Widths |
|---|---:|---:|---:|---|
| `c8e5c9c8` / Claude Code | 10,466 → 10,466 | 75,759,616 | 287 | 600, 1440 |
| `32f628ee` / Codex | 36,897 → 36,950 | 142,712,832 | 117 | 600, 1440 |

SQLite sizes describe the private scratch homes, not native journal bytes. The inherited Codex copy initially held 34,975 observations; normal startup enrichment imported newer native material, so the first preliminary frames saw 115 then 117 chapters. The final run above records the actual observation range instead of claiming an immutable snapshot. No native source was edited and no native prompt was sent by this check.

## Workspace comparison: independent diagnosis, shared-test hold

The clean-main failure is at line 1050, before comparison opens: requested editor scroll 250 later reads 11. The test dispatches a synthetic paste, Ctrl+Home and Shift+End, then sets scrollTop immediately. Installed CodeMirror queues selection scrolling for its measurement frame.

A private standalone probe uses the actual unchanged DraftEditor and records the native scroll setter. Across 40 cases at two heights, ten of twenty unchanged sequences depart from 250; zero of twenty sequences that wait for the measurement frames depart. One trace shows immediate 250 with maximum scroll 24,973, then a CodeMirror `DocView.scrollIntoView` / `EditorView.measure` write to 8. This excludes an immediate range clamp in that probe and demonstrates a pending-selection race there. It does not invent an exact full-app stack for the clean-main failure.

The actual-app private copy probe and proposed test-only frame barrier remain local. The original shared spec and DraftEditor are untouched. Completing that repair and its full-file verification waits for UI-1b's file hold to end, as the builder instructed. The existing scroll/selection/comparison assertions must remain intact.

## Remaining before the item can close

- Finish the private actual-app phase measurement and record its results.
- After Harsh's merges, apply and verify the minimal shared-test repair if the measurements support it; do not change the product to accommodate an invalid driver sequence.
- Run the finished item's required real-session/targeted checks and one isolated full gate; update TASKS and remove the claim only then.
