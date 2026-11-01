# LIVE-5 — completion evidence and queued-input completion

## 1 November — Harsh continuation

The acceptance scanner now compares enqueues from the **physical source ID it scanned**. Filtering by the main agent was insufficient: continuation journals also have main agents, and a main journal may contain sidechain rows. The regression retains all three receipts while checking two from the scanned source, and still fails an incorrect expected count. This corrects the check's boundary; it does **not** prove the origin of the earlier 33 receipts. `rec_c8e5c9c8` is unavailable on Harsh's machine and Harsh confirmed no copy is available. That exact discrepancy remains unverified rather than being reported fixed.

Fresh local acceptance:

- `check:real -- mid-turn-input --pick 2`: Claude `rec_6b23303f`, 59.6 MB, 477/477 scanned-source receipts, 481 delivered turns; `rec_a7e9af7d`, 28.3 MB, 190/190 receipts, 213 delivered turns. Both projections have zero additional-source receipts in these samples. Codex `rec_5da1cec3`, 15.8 MB, one input recorded while a command reports running, 24 delivered prompts. The source scan does not certify a controller steer RPC.
- Private genuine-journal copy run: Claude source prefix `ecdd7477`, 24,459,453 bytes, 28 receipts and 29 delivered prompts; Codex `rec_5da1cec3`, 15,795,654 bytes, one running-command input and 24 prompts. History and replay frames at 600 and 1440 px are under `.local/live5-acceptance/`; no screenshots or journal text are committed. Queued input text is readable; Codex uses its ordinary recorded input, without inventing a Claude queue receipt.
- Standalone native assistant rows, appended alone to scratch copies while the passive watcher runs: Claude 34,837-byte prefix 845 ms, 24,456,646-byte prefix 846 ms; Codex 46,736-byte prefix 816 ms, 15,672,372-byte prefix 2,662 ms. Initial history was settled before timing. These are individual observations, not a p95 claim. The Codex large sample exceeds the provisional 1.5 s typical-latency target. An earlier run overlapping initial loading measured 4,424 ms; it is retained here, not silently discarded. No following source record was needed in either run.
- Both typechecks and all 11 `live-captured-text` browser cases pass; all six sealed queue units pass, including the new physical-source regression. Package/full batch gate and the unavailable exact-source repeat are still outstanding.

No native journal, configuration or credential was edited. The native source's omission of some visible Claude text remains a harness boundary.

### Genuine native Codex mid-turn input

The current signed-in native app-server wrote source `01a1965b` (280,518 bytes). Its own read-only turn began a bounded sleep command, then accepted one text-and-image input through `turn/steer` with the exact active turn ID. The native protocol reported `on-request` and `readOnly`; no permission was widened and no journal/configuration/credential was edited. Exactly one source row contains that steer and exactly one image part.

Scratch import `rec_0d7fccd4` has two delivered inputs, one captured image on the second input and six operations. History and replay frames at both 600 and 1440 show the image exactly once. These genuine frames and RPC evidence remain private under `.local/live5-native-check/` and `.local/live5-native-rpc.json`. This closes the earlier Codex source/RPC-ordering gap; the older scanner's candidate alone did not.

### First full gate and clean-main diagnosis

Isolated install, LIVE-5 `ee82e38`: typecheck/package pass; units 1,163 pass / seven fail / one skip; parallel browsers 583 pass / 17 fail / 27 skip; serial browsers 33 pass / one skip. This is **not** a green full gate.

Clean main `c2cfe75` repeats all four image-related unit failures and all twelve image-related browser failures. All three Git unit files pass alone. The Windows short TEMP alias caused the image path refusals: the six units in `image-grant-race`/`path-images` pass unchanged when TEMP/TMP point at a canonical scratch directory. No production path/consent check or assertion was weakened. The other browser failure group passes 17 of 18 contention repeats on clean main; the workspace-toolbar scroll failure repeats there. Composer cleanup and the three Git browser cases pass in the bounded clean-main repeat. Their initial full-run failures remain recorded, without claiming each was reproduced on main.

The finished integrated batch is recorded below; the earlier failed run is retained as evidence, not relabelled green.


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

## Final acceptance (1 November)

Genuine Claude `rec_93a3f541`, 10,613,483 bytes, contains one image in a native `queued_command` delivery. At 600/1440 the recorded delivery renders that image once. Its enqueue rows have no image references and the receipt renders none; bytes are not invented before the recorded delivery. The local metadata survey found no array-form enqueue image content, so the early-receipt image path remains fixture-checked; native delivery-image reading is genuinely checked. These facts do not correlate an anonymous receipt with a delivery by text, time or matching pixels. Private frames: `.local/claude-queue-image-real/`.

Finished isolated integration `9f2ba26` (UI-17 `e185b8e` plus LIVE-5 `ee82e38`, each with its own workspace install): both types/build and package pass; all 192 unit files pass, 1,170 tests/one skip; 602 parallel browsers/27 skips; serial 32 pass/one skip and only `b2-live:63` fails. That is the exact five-pixel offset tracked by TEST-2. It fails alone on the integration and reproduces on rebuilt clean main `c2cfe75` in three of six runs. No assertion, timeout or native scrolling was weakened. This is not a clean-full-browser claim; the known baseline exception remains with TEST-2.

UI-17's final reasoning-default correction is separately checked on isolated integration `8da0576`: both types/build, all thirteen affected browser journeys and package verification pass. The complete suite was not needlessly repeated for that bounded fix. All completion scope is checked within the explicit source/capability limits above. Other-builder review/squash remains; no self-merge.
