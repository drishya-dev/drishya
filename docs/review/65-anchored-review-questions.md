# Reviewer-owned questions anchored to captured work

13 October 2026. Implements the first durable historical review queue from review 50 item 29, using installed `emil-design-eng` composition/reading guidance.

| Before | After | Why |
| --- | --- | --- |
| Decisions left during agent review disappear when reading context closes | Local questions anchored to an exact recorded operation ID | Return to a concrete unresolved developer concern without inventing an agent summary |
| Agent activity could be mistaken for resolving a user's concern | Explicit Resolve/Reopen with optional owner | Human review state stays separate from captured success/failure |
| A note list can grow or silently drop decisions | 100-question cap, explicit refusal at capacity, explicit removal of resolved items, 20-row expansion | Bound the UI while preserving unresolved questions |
| Sharing requires a whole recording or current Git patch | Privacy-reviewed copy preview of open questions and exact action references | Share reviewer context without exporting private full transcripts by default |

Leave a question in an action's Detail; review the queue from the evidence desk. Questions survive reload in this browser/origin and are scoped by source kind/recording. They are labeled reviewer notes, not captured agent prose. Titles are short captured-label excerpts; IDs are validated without truncating anchor identities. Notes/owner/title are bounded and redacted before storage/load/display. No SQLite/captured schema writes, harness changes, network sharing, auto-resolution or telemetry. Preview is invalidated when notes change; clipboard failure is explicit. Missing actions preserve the question and report unavailable; paged history resolves a target before opening it.

Replay does not expose the whole historical question list or permit note creation; return to normal history. Offline bundles remain immutable; their separate user notes never alter captured/exported content. Browser storage/profile loss is not durable cross-device recovery. A richer curated packet with selected artifact bytes, cross-recording repository identity, source-line pins and daemon-side note ownership remains separate scope; this increment exports reviewer questions/references only.

Local tests cover same-anchor update/status, redaction/corrupt and duplicate entries, exact identity bounds and refusal at capacity. Browser acceptance covers save/reload, exact action return, explicit resolve/reopen, handoff preview and narrow dialog visibility. Final results follow in STATUS. No hosted CI.
