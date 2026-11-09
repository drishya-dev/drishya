# SHIP-14: pending queue and receipt history

Task acceptance is complete for other-builder review. The final genuine journeys below supersede the initial candidate gaps; the full gate is honestly red on four failures reproduced on clean main.

The reader previously counted all enqueue receipts and resolved them only against later queue-operation rows. Replay stopped resolution at the last queue row even when later prompt or completion evidence was already visible. The default dialog now requests only pending inputs. Earlier receipts remain readable under **Earlier receipts · history**, with their original full content, images and captured evidence labels. The trigger counts the entire bounded pending queue, independent of the current receipt page; zero pending inputs has no count.

Resolution is derived from the whole bounded timeline. Exact complete sealed prompt text plus image hashes consumes one oldest matching receipt in the same physical source, generation and agent. An explicit native queue identity still establishes delivery only with the corresponding visible prompt. Anonymous dequeue/removal and later captured completion retire receipts with outcome unknown; exact native removal stays removed. Missing image bytes, empty input and clipped previews cannot establish anonymous delivery. Owners, sources, generations and subagents remain separate. Completed-turn receipts cannot consume a later anonymous prompt ahead of newly queued identical inputs; exact native identity can still prove the corresponding visible prompt.

The history worker builds one revision-keyed evidence cache for one view/physical owner. It uses Store.orderedObservations (the same retained lineageObservations stream for proven continuations) and actual observation identities to map completion after all preceding material. Received sequence is never compared to a replay cursor. Queue text reading checks the same ordered physical observation boundary, including late-arriving receipts. Unknown material ownership disables completion inference. Full content matching hashes complete sealed text with SHA-256 plus UTF-8 byte length after the normal privacy boundary; partial/unavailable material cannot establish anonymous delivery. The single-entry owner/view/revision cache retains only compact fingerprints and completion references, never raw observations or long text. Receipt reading continues through sealed artifacts/chunks. Owner/view/revision changes evict the cache. No native journals, recorded-event definitions, UsagePayload, dependencies or controller policy changed.

Claude assistant rows whose recorded stop_reason is end_turn now retain a turn.end observation after existing usage and content. Part 4,294,967,295 (0xffffffff) is reserved for this enrichment, outside the ECMAScript array-index range; existing part identities remain unchanged. The event has no invented native turnId and creates no TurnAccumulator entry. Already imported rows require an explicit **Rescan** to acquire previously discarded completion evidence. Advancing a tail alone does not replay old rows.

## Compatible reader API additions

- QueueQuery.step?: number — complete timeline cursor, independent of raw ingest sequence. Existing through observation boundaries remain supported.
- QueueQuery.state?: 'pending' | 'history' — omitted preserves the existing all-receipts API page.
- QueuePage.pendingTotal?: number — total across the whole bounded queue before filtering or pagination. Existing total remains the count of all enqueue receipts.
- QueuePage.completionEvidence?: boolean — whether exact completion boundaries are available to the resolver.

Legacy replay bundles contain neither complete anonymous prompt/source evidence nor exact completion boundaries. They retain conservative pending receipts when neither explicit native identity nor queue mutation proves their departure; the dialog discloses this precision limit. Whole queue artifacts remain readable. Bundles never guess idle or delivery from a clipped prompt or raw endSequence. No bundle/projection shape change was introduced.

## Phase-one verification inventory

Implementation includes focused scene, adapter, daemon and browser regressions for exact content, duplicate inputs, image/textless inputs, source/agent/generation ownership, anonymous mutation, page-independent counts, out-of-order arrival, continuation ordering, partial text, reserved-part seal/store round-trip, cache reuse/eviction, completed-turn and prompt replay boundaries, reload, and 600/1440 px queue reading. These had not been executed at the phase-one PR opening; measured continuation results follow below.

The phase-one next-check list was: scoped typechecks/units; rebuild UI; live-captured-text.spec.ts and approval-clearance.spec.ts; real Claude busy-enqueue/delivery, Claude removal and Codex mid-turn sessions through normal redacted scratch imports at 600/1440. Existing check:real mid-turn-input can locate genuine captures. Native account-dependent capture remains coordinated with Yash. Record only session prefixes, bytes and numeric counts, with private screenshots in .local. Package verification is required because retained ingest observations changed. Full gate awaits the coordinator's separate assignment.

## Initial 9 November measured verification

Final product source `5c389b14`: 31 scene/adapter/daemon units and typechecks pass. An independent review found that continuation agent-stop identities referenced parent operations rather than observation ids. The new regression failed first, then passed after using those operations' observation ownership; its red evidence remains private. Earlier source `a80a849` passed UI build and 21 queue/approval browsers. The final integrated source `dba7530a` passes 46 Workspace/queue compatibility browsers / one existing skip / zero failures or retries at three workers, including the same queue/approval cases. The initial typecheck failure for the stale cache initializer is preserved, then corrected and rechecked.

Normal redacted scratch imports measured Claude `2226bdea` (687,248 bytes, one receipt), `c743c426` (2,019,147 bytes, three receipts) and `d78dfff2` (7,568,934 bytes, 47 receipts). All 51 receipts remain available in history and none remains pending; all outcomes are unknown, not falsely delivered. At the first receipt's replay boundary, each source has one pending input. The first two sources were also checked on screen at 600/1440: no count at zero pending, the pending list is empty, Earlier receipts retains all one/three receipts, and replay before retirement shows one pending input. Eight private queue frames are retained under the integration checkout's `.local/release-real/`.

The three imports retain 1/4/43 completion boundaries. Removing completion evidence in a diagnostic calculation does not change their final pending totals: their genuine queue mutations already retire the receipts. Therefore these sources do not prove completion-only retirement or matching-prompt delivery. The native Codex worktree capture `01a1be5d` (182,354 bytes) has zero queue receipts; it is not a mid-turn enqueue/delivery acceptance case. Genuine matching-prompt delivery, completion-only retirement and the Codex mid-turn case remain unverified. Native Claude account-dependent capture remains delegated to Yash; the passing synthetic regressions are not relabelled as genuine acceptance.

The integrated full gate (including packaging) is running at source `b843726`, three parallel workers plus one serial worker, zero retries. Its result is pending. Retain the task's open checkbox and claim until the genuine cases and full-gate disposition are recorded. No native event schema, configuration, credential or permission bypass was introduced.


## Final integrated gate disposition (9 November)

Product source `35e4393`: both typechecks and UI build pass; all 215 unit files pass, **1,315 tests / one existing skip**. Browser run used **three parallel workers plus one serial worker, zero retries**: **696 parallel passes / 27 skips; 28 serial passes / one skip / four failures**. This is not a clean full browser gate.

All four failures reproduce with the same assertions on separately rebuilt, clean main `f93d880b`, one serial worker and zero retries: B2 live :63 opens an unexpected operation detail (expected zero, got one); material-motion :132 loses its hover-reading surface; p1-pacing :40 sees three active animations instead of zero; p1-pacing :266 has no repository tether. These remain TEST-2/MOTION-3 baseline failures, not fixes claimed by this task. The baseline control lives in the coordinator checkout's `.local/release1-baseline-20261109/`.

The first gate `b843726` stopped at three golden mismatches after 1,312 unit passes / one skip. Only the reviewed raw sequence expectations changed (18 to 19, 20 to 21, 22 to 23), reflecting retained Claude completion observations; all other golden fields remain unchanged. Golden/queue checks then passed 46/46. The first independent packaging run also failed its old exact observation count of 34: the fixture now retains three completed-turn rows. The corrected exact assertion is 37, with zero capture gaps. **package:verify passes at integration `70825e6`**, including isolated offline installation, both imports, checksums, demo, authenticated API and persisted restart. Its apps/packages tree is byte-identical to the full-gate product source; the additional change is the verification script, plus docs. No browser assertion, retry or timeout was relaxed.

Private complete gate evidence: `.local/release-gate-20261109-141147/` and `release-gate-20261109-142009/` in the isolated integration checkout. No further full-suite command was run to erase these failures. Other-builder review remains required; no merge or release certification is implied.

## Final genuine queue journeys

A broader counts-only audit of the 45 local Claude journals found the required captured cases. It separates person-authored inputs from internal notifications; exact complete sealed text plus physical source/generation/agent ownership is checked after normal scratch redaction. No account-dependent Claude capture was needed for these acceptance journeys.

| Genuine source | Bytes | Verified at 600 and 1440 |
| --- | ---: | --- |
| Claude `43745e02` | 5,007,911 | A matching person input is enqueued while an operation is running: replay shows one pending among 12 receipts, then zero when the prompt appears. That point has seven proven deliveries. The full session has 33 receipts: 13 delivered, 20 unknown, zero pending. Native removal boundaries also retire waiting inputs. |
| Claude `1b9299bd` | 1,296,549 | Separate native removal journey: two receipts at the sampled removal boundary, zero pending; all four final receipts stay in history with unknown outcome. Anonymous native removal is never falsely assigned to a specific receipt. |
| Codex `01a1bf92` | 160,060 | Genuine app-server turn/steer accepted with the exact active turn id after its bounded command started. Native readOnly and on-request policy confirmed, turn completed. Two recorded prompts, zero queue receipts: History and replay show the recorded input; no invented queue entry or count. |

All **16 native queue frames/checks** pass, including every 20-receipt history page with no duplicate API identities, exact pending/delivery counts and zero horizontal overflow. Source/RPC evidence and frames remain under `.local/release-real/` and `.local/ship14-native-codex/` in the integration checkout. The Codex capture uses the normal signed-in native protocol; it reads/writes no project file, changes no policy/configuration/credential and persists its own journal normally.

The earlier Codex zero-receipt worktree capture was not used to prove steering. Earlier probes had an incorrect 33-row unpaged expectation, a replay readiness guard on a keyboard notice, and a history assertion before its actual projection response finished. The corrected probe waits for that response, then uses the same UI assertions/timeouts and walks real pages. Failed logs are retained. An unconstrained candidate probe also selected a still-pending case; it was not relabelled as an ended session.

The audit additionally exposed a separate renderer failure on Claude `f49a9e6d` (3,370,797 bytes): two of 1,766 hunk lines are sealed blob references, and DiffView calls slice on them. The crash reproduces on clean main at 600 px. It is recorded as unclaimed P0 **CONTENT-19** in TASKS, not silently fixed, bypassed or counted as accepted queue-screen coverage. The genuinely checked queue cases above have their own recorded evidence.

Completed-turn retention and resolution are verified by the native stored boundary counts and the passing scene/adapter/daemon regressions. An isolated genuine completion-only-retirement journey is not claimed: the sampled ended Claude sessions also contain native queue mutations. The explicit SHIP-14 Accept journeys (busy enqueue/delivery, removal, native Codex mid-turn input, resolution units) are covered. No broader native-case or release readiness claim is made.

SHIP-14 completion docs are included in this PR. The whole scope is 19 paths, explicitly approved by Harsh; other-builder review and the recorded baseline release defects remain outstanding.
