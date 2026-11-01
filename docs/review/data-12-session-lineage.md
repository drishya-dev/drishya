# DATA-12 — evidence-backed Claude session lineage

31 October 2026. **Proposal, not an approved contract or implemented feature.** The DATA-12 claim is on main. The older claim says “schema note agreed with Harsh in review”, but no concrete note/type or approval record was found; that sentence does not authorize these types. Both builders must agree before capture/store/projection/API integration.

## Native audit (read-only; counts and prefixes only)

The scan streamed 153 main Claude journals, 963,710,894 bytes, excluding subagent folders. Thirteen start with a compaction carrying a logical-parent UUID: five have exactly one local owner, five have multiple copied owners, three have no local owner. Ambiguous matches must remain ambiguous, never be resolved using time, folder, filename or the largest overlap.

The requested pair exists: `c757fa6a`, 234,531,888 bytes / 61,002 rows / 16 compactions; `dd136b25`, 30,473,646 bytes / 8,548 rows / four compactions at this scan. They share 397 native row UUIDs, including exactly 277 user/assistant UUIDs. All shared message content is identical. One shared assistant UUID has a different usage receipt: dropping whole raw rows would lose recorded accounting evidence. Native paths and UUID inventories remain only in ignored local metadata; journals were never written.

## Proposed contract — requires both-builder agreement

No new observation kind and no rewriting captured observations. Keep one immutable physical recording per journal. Add derived lineage metadata, with exact native reference proof:

```ts
interface SessionLineageLink {
  childRecordingId: string;
  parentRecordingId?: string;
  status: 'linked' | 'parent-missing' | 'ambiguous';
  basis: 'native-logical-parent';
  childSourceId: string;
  boundaryRecordId: string;
  logicalParentRecordId: string;
  candidateRecordingIds: string[];
  sharedMessageRecords: number;
}
interface SessionLineageView {
  kind: 'derived';
  rule: 'claude-native-parent-lineage-v1';
  currentRecordingId: string;
  recordingIds: string[]; // exact ancestor order, at most sixteen, cycle rejected
  links: SessionLineageLink[];
  duplicatePartsOmitted: number;
  differingReceiptPartsRetained: number;
}
```

Persist links in a new rebuildable `session_lineage` table, using validated UUID/source/recording references only. Metadata scanning is read-only and streaming; metadata indices can be reused only against exact source identity/size/generation. Missing/ambiguous parents remain explicit. Only an exact unique logical-parent owner joins automatically; shared UUID/content fingerprints corroborate and deduplicate, but overlap alone never chooses a direction between forks. A future shared-UUID-only direction needs a separately agreed proof rule.

The ordinary latest-file route remains the public selected recording, preserving its native controller, workspace consent, current Files and current Git root. A new internal `readingId` resolves evidence-backed ancestors into the existing bounded `+` history view. Only historical read endpoints resolve to that view: projection/history, artifacts, captured search/evidence. Native/controller/current-file/workspace-grant endpoints remain the latest physical recording. Their scope must be explicit in the lineage receipt; combined accounting is not fabricated. The earlier file is independently openable. A small derived marker at the first newly retained continuation material explains the source-file transition and links to earlier history; missing parent starts with an honest availability marker. No fake captured prose or synthetic journal row.

Full lineage counts, prompt rail and replay come from the deduplicated projection. Historical search filters exact duplicate native-record results using the same view owner. Current Git stays labelled current repository; recorded Git evidence uses the full view, or existing per-recording-only features state that scope. Single-file and arbitrary unrelated combined views keep their existing behavior.

### Why an ordinary combined recording is insufficient

Current `combinedProjection` source-time sorts independently namespaced recordings, keeps copied rows twice, treats each main agent as independent and omits some combined-accounting features. A lineage needs a proven ancestor order, shared-native-record deduplication, a single logical main-agent/call correlation namespace and explicit physical provenance. Preserve public operation/artifact/observation IDs and their physical owners; namespace normalization is only a reducer correlation lookup, never a persisted observation rewrite. The original rows and differing receipts stay reachable through their original file.

Deduplicate only exact equal sanitized observation parts sharing a validated native row UUID, kind and part number. Retain differing payload/usage parts and label their physical receipt scope. Cross-file tool results may complete the parent-file call only through an exact native operation ID inside the proven lineage; unrelated IDs never correlate. Store iteration and worker reduction use the same deterministic rule. No source clocks are invented, no native file is concatenated or edited, and the existing paged projection boundary remains.

## Exact proposed scope (15 production/test paths, approximately five commits)

1. `packages/adapter-claude/src/continuation.ts` — new isolated metadata scanner/resolver; no parser `index.ts` edits.
2. `packages/ingest/src/index.ts` — discovered-source lineage import/rescan and combined reducer options.
3. `packages/store/src/index.ts` — derived links, lineage membership/iteration and provenance-safe dedup owner.
4. `packages/contracts/src/index.ts` — optional derived lineage interfaces/projection metadata; no new observation kind.
5. `packages/projection/src/reduce.ts` — proven-lineage correlation namespace and derived boundary metadata only.
6. `apps/daemon/src/app.ts` — internal historical reading identity and paged threshold; physical control identity unchanged.
7. `apps/daemon/src/history-worker.ts` — same derived lineage iterator/cache identity, no PERF scheduling/allocation change.
8. `apps/daemon/src/server.ts` — historical-read routing and authenticated lineage metadata; current/native consent unchanged.
9. `apps/ui/src/components/SessionLineage.tsx` — new quiet derived transition/availability receipt and earlier-part link.
10. `apps/ui/src/components/History.tsx` — isolated continuation receipt insertion only; **needs root reservation alongside FILES-9**.
11. `apps/daemon/test/session-lineage.test.ts` — metadata/store/API/import/live/restart/security fixture acceptance.
12. `packages/projection/test/session-lineage.test.ts` — duplicate variants, ordering, cross-file calls, missing/ambiguous/unrelated/single-file and replay regression.
13. `tests/browser/session-lineage.spec.ts` — 600/1440 full history, rail/search, earlier-part navigation and live/replay guards.
14. `scripts/real-cases/session-lineage.ts` — genuine lineage counts/UUID-part comparison without printing content.
15. `scripts/check-real.ts` — isolated case registration.

Documentation: this report plus root-managed TASKS/STATUS/CONTINUITY. No UI state, parser `index.ts`, SessionWorkspace, DeveloperWorkspace, FileHistory, Inspector, EvidenceReview or GitReview edits. LIVE-5 owns both parsers; FILES-9 owns file entry surfaces. One whole DATA-12 PR, draft after the proposal commit; no acceptance tick before every non-external line is checked.

## Acceptance planned

Exact real-pair rows/unique message parts and source sizes; no invented or lost receipt variants. Both source files remain independent; native journal hashes unchanged. Additional real unique/ambiguous/missing-parent and ordinary single-file samples, then 600/1440 full lineage, rail/search/recorded Git scope, replay boundary and observed live append. Fixtures also cover missing parents, copied forks/cycles, conflicting UUID payloads, cross-file call/result, redaction, retention/deletion, restart and incremental rescan. Existing Codex/single-file behavior must remain unchanged. Browser/full gate waits for the root lease; no partial-task full gate.

## Completion — 1 November

Implemented as proposed (both builders approved the contract on 31 Oct). Real pair `c757fa6a` (234,531,888 bytes) + `dd136b25`: imported with the discovered sources, 2 physical parts, 1 `linked` link, 277 shared message records, 392 identical parts omitted, 1 differing usage receipt retained; the continuation transition is a prompt turn that no passage covers, so the receipt is anchored to the first passage at or after the boundary (found on the real pair; the synthetic fixture had placed it inside a passage). Receipt present at 600 and 1440 px with no horizontal overflow. `check:real session-lineage` on three single-file recordings with an unavailable parent reports one part and one unavailable link, no join. Not run: a real ambiguous-parent journal through the screen (the five ambiguous cases are covered by the fixture at both widths and by the scan counts above).
