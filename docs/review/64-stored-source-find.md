# Find across a stored artifact

13 October 2026. Addresses the whole-artifact reading gap in review 50 while preserving the worker/paged boundary.

| Before | After | Why |
| --- | --- | --- |
| Find only sees the resident 200-line page | Explicit Find next stored match searches forward through that immutable artifact | Reach distant code without guessing its line or loading a whole document into the DOM |
| A naive whole-file scan could stall the UI/API or retain a huge line | Worker batches, literal matching, bounded buffers and opaque continuation | Search yields between requests and capture/presentation stay independent |
| An oversized line could silently produce incomplete matches | Lines over 256 KiB are skipped with an explicit count | No claim that every byte of unsupported material was searched |

`BlobStore.findLines` uses the existing sparse line index and read-only sealed blobs. Each history-worker request reads at most 4 MiB, scans at most 10,000 completed requested lines and returns at most 50 zero-based stored-line locations. It retains at most 256 KiB of one partial line in each of eight single-use opaque cursors. A cursor is bound to immutable blob identity and case-folded query; wrong/expired cursors fail explicitly. Large lines can span requests without restarting from their beginning or growing memory indefinitely. No source characters or generated summaries are returned by the find service.

The UI performs up to three yielded worker batches per explicit click, jumps to the actual found source line, mounts the ordinary 200-line reader page, and retains the remaining bounded locations for next-match clicks. If more material remains, continuation is explicit. Scope/source/query changes discard in-flight results. Page-local Find remains available and honestly labeled. Bundle search uses only already-exported sanitized text; missing text stays unavailable. This is literal forward find from the current page, not regex, semantic search, reverse search or a total-occurrence counter.

Authenticated existing artifact route adds `find`, `start` and optional `cursor`; membership is resolved through the recording's artifact index, never a caller-provided filesystem path or blob hash. No capture/event/store-schema change, telemetry, external call or dependencies. Search state is temporary worker/UI memory. Search limits and cursors are read DTOs outside captured contracts.

Local validation: store tests cover distant matches, match/count/cursor bounds, wrong-query/blob and single-use cursors, plus a five-MiB single line with a later real match. Actual daemon/browser journey finds source line 22,346 in a 23,000-line captured Read while mounting <=200 source lines; empty query returns 400. Both TypeScript checks/build pass. Final cumulative verification follows in STATUS. No hosted CI.
