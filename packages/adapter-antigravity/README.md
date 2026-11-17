# Antigravity adapter

Reads Google Antigravity's own session recordings, read-only, and maps them to Drishya's events. Antigravity is passive: Drishya never starts or steers an Antigravity session. Sessions are read after the fact; following one live is on the [roadmap](../../ROADMAP.md) (AG-3). The task record, including the real-session acceptance, is in the [Product Work History](../../docs/PRODUCT_WORK_HISTORY.md#ag-1), and the research is in [antigravity-harness](../../docs/review/antigravity-harness.md).

The adapter follows the steps in [How to add a harness](../../docs/CODEBASE.md#adapters--how-to-add-a-harness). Tests use synthetic records only; never commit a real session.

## Source and truth boundaries

- Adapter ID and harness: `antigravity`. Tested format survey: uninstall entry 2.31.2 and version file 44.9.1; neither is translated into an assumed model name.
- Readable inputs: transcripts and immutable summary index only in AG-1. Conversation databases, protobuf files, chunks, credential/config/browser directories, uploads and scratch files are never opened. `.pb` file names may be statted only to count encrypted-only sessions.
- `SYSTEM_MESSAGE`, `EPHEMERAL_MESSAGE` and `CONVERSATION_HISTORY` content is deliberately ignored: these are harness bookkeeping/context reinjection, not another human prompt or new model response. Each complete step still has a metadata-only receipt so import accounting remains auditable. Unrecognized record/tool types remain visible as unknown.
- Result pairing is positional within the immediately preceding planner's call group. An operation ID is derived from conversation, step and call position; it is never labelled a native ID. A missing result has a materialized gap, cleared when a recorded result is received. An orphan result stays generic with an explicit missing-call field.
- A tool-reported successful edit displays its requested diff without creating an after-state snapshot. A command without a recorded exit code is unknown; a RUNNING receipt is partial. Model-authored checkpoint summaries retain their source and are not presented as Drishya explanations.
- Repeated step receipts update the latest materialized step, removing stale parts and FTS entries; byte cursors and recording identity remain stable. Original native files are never changed. A different physical transcript variant explicitly resets the read cursor while preserving the recording's original identity.
- User/agent image references and artifact writes receive full treatment in AG-4. AG-1 does not copy image bytes, and artifact writes bearing ArtifactMetadata are kept off the repository map.
