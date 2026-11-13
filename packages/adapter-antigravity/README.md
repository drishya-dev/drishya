# Antigravity adapter (AG-1)

Implementation in progress; no acceptance is claimed yet.

## Source and truth boundaries

- Adapter ID and harness: `antigravity`. Tested format survey: uninstall entry 2.31.2 and version file 44.9.1; neither is translated into an assumed model name.
- Readable inputs: transcripts and immutable summary index only in AG-1. Conversation databases, protobuf files, chunks, credential/config/browser directories, uploads and scratch files are never opened. `.pb` file names may be statted only to count encrypted-only sessions.
- `SYSTEM_MESSAGE`, `EPHEMERAL_MESSAGE` and `CONVERSATION_HISTORY` content is deliberately ignored: these are harness bookkeeping/context reinjection, not another human prompt or new model response. Each complete step still has a metadata-only receipt so import accounting remains auditable. Unrecognized record/tool types remain visible as unknown.
- Result pairing is positional within the immediately preceding planner's call group. An operation ID is derived from conversation, step and call position; it is never labelled a native ID. A missing result has a materialized gap, cleared when a recorded result is received. An orphan result stays generic with an explicit missing-call field.
- A tool-reported successful edit displays its requested diff without creating an after-state snapshot. A command without a recorded exit code is unknown; a RUNNING receipt is partial. Model-authored checkpoint summaries retain their source and are not presented as Drishya explanations.
- Repeated step receipts update the latest materialized step, removing stale parts and FTS entries; byte cursors and recording identity remain stable. Original native files are never changed. A different physical transcript variant explicitly resets the read cursor while preserving the recording's original identity.
- User/agent image references and artifact writes receive full treatment in AG-4. AG-1 does not copy image bytes, and artifact writes bearing ArtifactMetadata are kept off the repository map.

## Build and verification plan

1. Constrain all discovery reads to transcript journals and the immutable session index. Resolve real paths before opening files; reject escapes and credential-bearing locations. Never open conversation databases in AG-1.
2. Select the transcript with the greatest complete step index. Preserve an already imported source identity. Count encrypted-only and artifact-only conversations explicitly.
3. Decode argument values once; map captured calls and results to existing harness-neutral intents. Preserve step order and stable IDs. Pair only within a planner's call group, with explicit unmatched calls and unknown outcomes.
4. Pass every observation through the existing ingest seal before persistence. Test protected paths and canaries across stored/exported material.
5. Test synthetic records including duplicates, missing results, backwards times and partial lines. Then scan and import real Antigravity sessions into a scratch home, reporting prefixes, sizes and counts only.
6. Verify real screens at 600 and 1440, measure the largest import, and run types, units and the Home/search/filter/open regressions. Do not mark ready until the whole acceptance list has a result.

## Integration sequence

AG-1 precedes AG-2 product identity and AG-3 tailing. Those may run in parallel after the adapter interface stabilizes. AG-4 uses the builders' approved recommendations: referenced images by default, artifacts as plans rather than repository writes, and source-labelled recorded thinking. AG-5 supplies genuine missing cases; no synthetic fixture counts as real acceptance. AG-6 database enrichment is optional and out of this item's scope.

All item PRs target `codex/harness-antigravity`. Only a final reviewed integration PR targets main; no product code is pushed directly to main.

## Scope review before existing-file edits

The TASKS file list omits package registration (`packages/ingest/package.json` and `pnpm-lock.yaml`), real-case registration (`scripts/check-real.ts`), and the contract/reducer version files needed by its approved `call-order` addition. Exact paths and any further correctness requirements will be recorded in the draft PR before they are changed.

Yash approved up to 30 paths on 13 November. Additional existing sections reserved:

- `packages/capture-core/src/index.ts`: optional adapter diagnostics and source-read hooks; existing adapters keep their defaults.
- `packages/ingest/src/index.ts`: adapter registration, discovery diagnostics and stable Antigravity recording selection; `packages/ingest/package.json` and `pnpm-lock.yaml`: workspace dependency only.
- `packages/store/src/index.ts`: Antigravity repeated-step replacement and step ordering only; preserve existing harness insert/clock behavior. Regression units cover both defaults.
- `packages/contracts/src/index.ts`: approved `call-order` correlation and contract version; `packages/projection/src/reduce.ts`: reducer version, truthful positional-correlation description and Antigravity step ordering only. Generated scene goldens change for version fields only unless a documented new case requires more.
- `scripts/check-real.ts` and `scripts/real-cases/types.ts`: third-harness registration and scan routing, with old case behavior unchanged.
- `docs/reference/03-event-schema.md`: record the additive agreement; TASKS/STATUS completion and CODEBASE documentation.

Merge review must inspect these sections independently of concurrent work: do not replace complete shared files with this branch's copy. No Claude Code/Codex parser, fixture or real-case implementation is reserved or edited.
