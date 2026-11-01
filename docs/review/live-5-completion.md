# LIVE-5 — completion evidence and queued-input completion

## 1 November — Harsh continuation

The acceptance scanner now compares enqueues from the **physical source ID it scanned**. Filtering by the main agent was insufficient: continuation journals also have main agents, and a main journal may contain sidechain rows. The regression retains all three receipts while checking two from the scanned source, and still fails an incorrect expected count. This corrects the check's boundary; it does **not** prove the origin of the earlier 33 receipts. `rec_c8e5c9c8` is unavailable on Harsh's machine and Harsh confirmed no copy is available. That exact discrepancy remains unverified rather than being reported fixed.

Fresh local acceptance:

- `check:real -- mid-turn-input --pick 2`: Claude `rec_6b23303f`, 59.6 MB, 477/477 scanned-source receipts, 481 delivered turns; `rec_a7e9af7d`, 28.3 MB, 190/190 receipts, 213 delivered turns. Both projections have zero additional-source receipts in these samples. Codex `rec_5da1cec3`, 15.8 MB, one input recorded while a command reports running, 24 delivered prompts. The source scan does not certify a controller steer RPC.
- Private genuine-journal copy run: Claude source prefix `ecdd7477`, 24,459,453 bytes, 28 receipts and 29 delivered prompts; Codex `rec_5da1cec3`, 15,795,654 bytes, one running-command input and 24 prompts. History and replay frames at 600 and 1440 px are under `.local/live5-acceptance/`; no screenshots or journal text are committed. Queued input text is readable; Codex uses its ordinary recorded input, without inventing a Claude queue receipt.
- Standalone native assistant rows, appended alone to scratch copies while the passive watcher runs: Claude 34,837-byte prefix 845 ms, 24,456,646-byte prefix 846 ms; Codex 46,736-byte prefix 816 ms, 15,672,372-byte prefix 2,662 ms. Initial history was settled before timing. These are individual observations, not a p95 claim. The Codex large sample exceeds the provisional 1.5 s typical-latency target. An earlier run overlapping initial loading measured 4,424 ms; it is retained here, not silently discarded. No following source record was needed in either run.
- Both typechecks and all 11 `live-captured-text` browser cases pass; all six sealed queue units pass, including the new physical-source regression. Package/full batch gate and the unavailable exact-source repeat are still outstanding.

No native journal, configuration or credential was edited. The native source's omission of some visible Claude text remains a harness boundary.

31 October 2026. Whole task claimed before work; merged part 1 (#310) remains intact. This branch finishes remaining acceptance and prepares the early-queue decision. No native journal, configuration or credential is changed. Native content and screenshots remain private in `.local/`.

## Current evidence

- Bounded metadata scan: 151 Claude journals and 53 Codex journals; four larger journals excluded from that first pass. Claude source `dd136b25`, 30,473,646 bytes: 77 recorded enqueues, 42 dequeues, 35 removes, 45 delivered attachments (14 person prompts and 31 task notices), eight image blocks. These counts update the earlier snapshot; they do not describe every queue event as a human message.
- Queue enqueue rows have a session, timestamp and content, but no recorded queue identifier in the inspected shape. A dequeue can contain no item identity. Only 23 of the 45 attachments have one exact content-and-timestamp match to an enqueue; 22 do not. Temporal proximity or matching text alone must not manufacture delivery identity or withdraw a different input.
- A separate streaming Codex metadata scan includes the two large real journals at 590,880,857 and 134,522,849 bytes. Both retain user inputs as response items, not `event_msg:user_message`. This is source-shape research, not presentation/performance acceptance of those sizes. Determining which inputs arrived during unresolved tool work is still pending.
- The earlier Claude measurements in TASKS establish that some visible assistant text never reached its journal. This branch cannot reconstruct it or claim a Drishya fix for nonexistent source material. Fresh small/large text-only append measurements and Codex equivalent checks remain acceptance work.

## Approved early-queue contract

The immediate display is a **recorded queue receipt**, not an ordinary delivered user turn. Existing `queued_command` delivery remains the sole owner of the ordinary prompt and its images. No queued receipt starts a harness turn or grants controller authority.

Capture an additive `queue.operation` observation carrying exactly the recorded operation (`enqueue`, `dequeue`, `remove`), content when present, and an optional native queue identifier only when present. Content and images use the existing pre-persistence redaction/blob path. Keep physical source identity and observation IDs, rather than treating a timestamp as an ID.

A projection queue receipt has stable observation identity, agent/source ownership, recorded time/sequence, its captured content artifact, and one of these evidence states:

| State | Evidence required | Presentation |
|---|---|---|
| Queue receipt recorded | Native enqueue | A small unboxed `Queued input recorded` excerpt; full recorded input is reachable. It does not claim delivery or inclusion in context. |
| Removed from queue | A removal identifies this exact item | The receipt records removal; it does not appear as a delivered prompt. |
| Queue changed; item outcome unknown | A dequeue/removal has no exact item identity | No invented `delivered`/`withdrawn` status. The receipt settles to a quiet event marker, with its original input still reachable. |
| Delivered reference | Native identity explicitly links the receipt and delivering row | The delivered prompt is the reading home; the receipt becomes provenance. Without such identity, no automatic causal link or prompt suppression. |

Replay reveals receipts only at their recorded sequence. Counts, prompt rail and search distinguish queue receipts from actual delivered prompts; existing prompt counts do not silently increase. Rescan and repeated source records must not duplicate receipts. The resting interface has no permanent queue panel; only current recorded queue activity appears near the composer, with keyboard-accessible details.

Both builders approved this contract through Yash on 31 October (recorded on main in 8bc94a9f). Implementation keeps the bounded paged-history boundary: one exact physical queue-observation pointer per History page, bounded sealed-store receipt pages, and 256 KiB UTF-8 input chunks. It does not claim Claude exposes reliable pending-message IDs. The exact cross-layer path reservation is on main in STATUS.

## Whole acceptance still required

- Real Claude and Codex mid-turn inputs, with images where recorded; every delivered input is reachable once in History and replay.
- Text-only live append without a subsequent record, measured on small and large genuine captures; no dependency on a later tool result.
- Parser guards for known row shapes; queue receipt/delivery/removal/ambiguous identity/rescan/replay cases if the early-queue contract is approved.
- Both typechecks, focused units and browsers, genuine 600/1440 frames, then one finished-task batch gate. No fixture is described as a real harness run.

## State at 1 November (Claude took over; stopped here at the builder's request)

Built and passing: Claude `queue-operation` rows captured as `queue.operation` receipts (adapter, projection r31, sealed-store reader, `/queue` routes, receipt dialog, exported bundles); typecheck, 732 units (packages and daemon) and all 11 browser cases in `tests/browser/live-captured-text.spec.ts` at 600/1440 px, including the new text-alone live append (within 3 s, also before a running call).

Fixed on the way: receipts were hidden because the composer is minimized by default (the chip now sits above the composer and shows minimized), replay hides the composer (the chip is portalled to the page in replay), and the page's replay queue boundary used the newest queue event instead of the one at the replay cursor.

Pending before this can merge:
- `check:real -- mid-turn-input` fails on `rec_c8e5c9c8` (145 native enqueues in the main journal, 178 projected). Counting only the main agent did not change it, so the extra receipts come from somewhere else (sub-agent files carry their own `agent` ids, or rows the scan's prefilter misses). Find the 33 and decide whether the scan or the projection is wrong. `rec_ab475ed8` (97 of 97) and the Codex case pass.
- Real-session screen frames of a receipt at 600 and 1440 px, and the Codex equivalent (inputs sent while a command runs) recorded.
- Large-recording latency for text-only append (measured earlier at 0.2 to 1.6 s on this journal's copy; record it in the PR), `package:verify`, `check:affected`, then docs: tick LIVE-5, delete the claim row, `sync-tasks`.
