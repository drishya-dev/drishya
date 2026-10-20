# TURN-3 — evidence-bearing prompt rail

20 October 2026 · PR #147. Encoding and captured prompt-only chapter coverage implemented.

| Before | After | Why |
|---|---|---|
| Equal tick sizes depend only on pointer proximity | Captured operation count sets a linear4–20px base, with the existing proximity lift | Larger turns are recognizable without expanding the canvas |
| No outcome marks on the rail | Red notch for captured operation/test failures, edited dot from the existing patch ledger | See significant turns without opening every chapter |
| Hover/focus shows only prompt/time | Adds captured operation total and the existing full-turn ledger, including pending-result count | Reading uses the same accounting as turn headers |
| Hover can be the only bright mark | Independent reading-position point and retained aria-current | Pointer exploration does not erase the reading position |
| A prompt has no chapter unless agent material follows | The scene retains a prompt-only reading stop using the captured timeline ID, text and timestamp | Consecutive prompts remain addressable without inventing a response |
| An older operation's late result can hide the next caption | Chapter ownership follows the prompt step rather than the preceding passage's last result | Completion timing does not remove navigation |

Chapter `turnStep` joins the existing `useTurns` store. Paged captures use the whole-recording turn ledger, not counts from the resident material window. Missing ledger has neutral size and no invented counters/statuses. The marker transform and existing finite proximity transition are reused; no text animation, extra request, shared layout change or schema mutation. Hover/focus preview is bounded to the viewport and uses the existing ledger provenance explanation. Selection/navigation and the bottom-anchored independent rail are unchanged.

## Local verification

- Running actual Drishya Codex rail inspected before changes and after. Then actual Drishya Codex, Skeletongraph Codex and Skeletongraph Claude displayed marks were compared to their `/turns` response: operation counts and failure/edit marks match exactly. Verified38,48 and48 currently mounted marks respectively, using full ledgers with41,48 and287 entries. A mounted count is not a claim that the whole virtualized rail is in the DOM.
- Two new browser journeys:75 completed synthetic prompt chapters; captured2/12/80-operation turns, command failure, actual captured Write patch, varying mark sizes, exact ledger preview, keyboard first/last, virtualized rows,1440/390/320px preview containment.
- Two existing prompt-timeline regressions pass: bottom anchor, independent rail scrolling, main scrollbar placement, short and narrow layouts.
- Eight focused tests pass: three mark helpers plus five existing turn-ledger tests. UI typecheck and production build pass. Local screenshots inspected; no hosted CI or native prompt execution.

## Coverage correction and verification

The initial actual Drishya capture exposed41 turn ledgers but38 materialized chapters. The scene only associated prompts with later operation/prose passages. The bounded continuation preserves prompts without material as scene-only reading stops, merges them chronologically and updates paged/history prompt targeting. Stored observations, contracts, reducer and adapters are unchanged. Only supplied prompt strings are shown; missing text does not acquire an inferred label or response. Existing golden scenes remain unchanged.

- Actual final chapter totals reconcile to the full ledger: Drishya Codex41/41, Skeletongraph Codex48/48, Skeletongraph Claude287/287. Visible41/48/48 markers respectively match operation/error/edit counts; the long rail remains virtualized.
- The75-turn browser fixture now deliberately leaves72 consecutive prompts without an assistant response. All75 remain keyboard-addressable, the final captured prompt opens, and1440/390/320px containment and independent scrolling pass (four browser journeys including the retained timeline checks).
-68 focused tests across11 files pass: whole scene suite, daemon history paging and rail mark helper. Added regressions cover consecutive prompts, no future chapters during replay, late results and exact one-slot loading of an older unanswered prompt. Both typechecks and production build pass.
- The isolated worktree's shared UI dependency junction initially resolved the scene package from the other checkout. Local validation rebuilt with an explicit Vite alias to this worktree's scene source; the browser tests then verified the actual new composer in both unpaged and paged paths. No dependency files or other checkout were modified.

Old Skeletongraph native-journal ENOENT remains pre-existing, and imported evidence still reads. This is not signed-in native, physical-device, full-theme or broad ten-minute acceptance. Existing map, agent material, replay and follow behavior are retained.
