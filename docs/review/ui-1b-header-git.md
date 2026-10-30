# UI-1b — recorded branch identity and one Git entry

Whole item in progress; not acceptance complete. Harsh confirmed both builders approved the exact `CapturedSessionBranch` / optional `Projection.recordedBranch` proposal and its 15-path scope on 30 October. Harsh also approved updating only the obsolete separate-Git-graph resident-button premise in `header-cluster.spec.ts`, preserving geometry and target assertions.

The branch is the last eligible sealed `session.meta.branch` for the selected recording's main agent and primary captured root. It carries its captured root and observation provenance. It is not current Git or a branch-at-step history. Partial `asOfProjection` drops it; the identity UI must additionally hide it in replay, combined sessions, root mismatches and outdated-privacy recordings. Missing metadata stays absent. Observation schema, adapters, database and native controller are unchanged.

Independent core validation: nine focused `session-branch.test.ts` tests pass, including both actual adapter record shapes, exact sanitized text/provenance, absent/malformed data, root/subagent/combined isolation, Windows normalization, incremental snapshot isolation, privacy sealing and partial replay. Backend typecheck passes. No browser or real-session acceptance claimed yet.

Shared-file hold: `Viewer.tsx` must wait for Yash's PR297/298 to merge; `SessionWorkspace.tsx` is excluded. CONTENT-12 coordinates its independent fields and reducer version (UI-1b r25, CONTENT-12 r26; root reconciles final merge). The proposal and raw-presence counts remain in ignored `.local/` in the original checkout; no real journal content is published.

Remaining whole-item work: inspect the running app before UI edits; consolidate Git triggers while preserving reader owners/consent/focus; integrate the recorded identity after the owner handoff; run affected targeted checks, real-session scratch imports and 600/1440 visual acceptance, named browser specs and package verification. The root runs the full gate once for the finished batch in an isolated checkout. UI-1b stays open until both halves are verified.
