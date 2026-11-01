# LIVE-5 — completion evidence and queued-input completion

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
