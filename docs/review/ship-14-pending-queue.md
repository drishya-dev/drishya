# SHIP-14: pending queue and receipt history

Implementation ready; testing and genuine acceptance are pending the coordinator's testing token. This report does not close SHIP-14.

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

## Verification pending

Implementation includes focused scene, adapter, daemon and browser regressions for exact content, duplicate inputs, image/textless inputs, source/agent/generation ownership, anonymous mutation, page-independent counts, out-of-order arrival, continuation ordering, partial text, reserved-part seal/store round-trip, cache reuse/eviction, completed-turn and prompt replay boundaries, reload, and 600/1440 px queue reading. These have not been executed in phase 1.

Required next: scoped typechecks/units; rebuild UI; live-captured-text.spec.ts and approval-clearance.spec.ts; real Claude busy-enqueue/delivery, Claude removal and Codex mid-turn sessions through normal redacted scratch imports at 600/1440. Existing check:real mid-turn-input can locate genuine captures. Native account-dependent capture remains coordinated with Yash. Record only session prefixes, bytes and numeric counts, with private screenshots in .local. Package verification is required because retained ingest observations changed. Full gate awaits the coordinator's separate assignment.
