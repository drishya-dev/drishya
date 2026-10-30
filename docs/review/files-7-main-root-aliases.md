# FILES-7 — current reading for exact recorded main-root aliases

Implementation and acceptance in progress. This report contains no native journal material.

## Cause and boundary

`apps/daemon/src/workspace.ts:137` admits an absent graph path only when the graph is truncated or stale. A complete captured multi-root graph contains namespaced historical file identities, so an exactly decoded main-relative current path is rejected.

`apps/ui/src/components/SessionWorkspace.tsx:275` suppresses that same action when its decoded path is absent from the graph. UI-16 owns that component; the minimal integration waits for its explicit handoff.

The fix must prove an exact recorded prefix belongs to the approved main workspace, then apply existing indexable, protected-path, consent, identity and symlink checks. Captured identities remain unchanged; another working root receives no current-file grant.

## Acceptance

Pending: before/after counts on pre-existing real multi-root recordings, genuine Codex and relevant Claude screen checks at 600/1440, new negative-path guards, plain/captured regression reading, affected checks and the named browser journey. Full batch verification belongs to the coordinating root lane.
