# Antigravity adapter (AG-1)

AG-1 acceptance recorded below. PR #469 targets the isolated integration branch; it does not enable Antigravity in a released main build.

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

AG-1 precedes AG-2 product identity and AG-3 tailing. Those may run in parallel after the adapter interface stabilizes. The updated AG-4 decision in TASKS supersedes the early reference-only proposal: copy allowed same-conversation image bytes with signature/size checks, refuse outside paths, show artifacts as plans rather than repository writes, and label thinking with its recorded Antigravity name. AG-1 remains reference-only until AG-4 implements and accepts that decision. AG-5 supplies genuine missing cases; no synthetic fixture counts as real acceptance. AG-6 database enrichment is optional and out of this item's scope.

All item PRs target `codex/harness-antigravity`. Only a final reviewed integration PR targets main; no product code is pushed directly to main.

## Acceptance evidence (13 November)

- Own frozen install, both project typechecks, generated scene goldens unchanged (15 cases), 1,534 units passed / one existing skip (four workers), and package verification passed. Focused adapter/ingest tests: 32 passed. Home-current, Home-stats, Home-opening and library-search browser specs: 18 passed (Edge, two workers, zero retries).
- Scratch `check:real -- antigravity --pick 100` imported all 55 readable sessions: 16,455 distinct step indices (16,465 receipts including repeated steps), each recording's receipt count matched, every call paired or explicitly gapped, zero unknown records. The additional genuine canary accounts for the difference from the original 54-session survey.
- Cases found in the selected transcripts: 3,106 numbered reads, 163 directory lists, 474 background starts, 960 background-control calls, 194 failed edit results, 584 reported edit results, 108 explicitly created writes, 43 artifact-metadata writes, 75 checkpoints, five prompt media references, 38 readable children and 12 legacy encrypted conversations with readable transcripts. Example prefixes: `01c6c162`, `03ba53eb`, `19f50fd7`, `99ef88f8`. Counts describe the selected transcript variants, not both variants combined.
- Discovery reports nine encrypted-only primary conversations, four additional unique encrypted-only legacy-root conversations, and one empty transcript-unavailable UUID conversation. Directory-metadata inspection corrected the research's “two artifact-only” count: one entry is that empty conversation, the other an empty utility directory, not a conversation. No actual artifact-only conversation exists in this corpus; a synthetic artifact-only diagnostic is covered. Legacy duplicates are not counted twice.
- Largest `99ef88f8`: 43,659,730 bytes, 13,371 distinct steps, 7,670 operations. A local run measured 8,530 ms import, 6,755 ms full projection, RSS 377,540,608 bytes after import / 408,027,136 after projection. Cold selected-card screen readiness was 8,657 ms; subsequent selected-card readiness 575–950 ms. These are one-run measurements, not percentile or broad performance certification.
- Eight real-session frames (read, reported edit, failed edit, absent-exit command at 600/1440) remained inside the page and scrolled; zero page errors and zero external requests. Frames and numeric evidence remain in `.local/ag-1/`, never committed. The check is automated DOM/geometry acceptance, not a human visual review.
- Read-only observation: 99 allowed source/index files kept exactly the same sizes and modification times; no new WAL/SHM files. No conversation database, private configuration, upload, scratch file or browser profile was opened.
- Genuine existing-harness regression frames: Claude Code `rec_6f4e5cf3` (212,057 bytes, one prose passage) and Codex `rec_88f439d7` (194,590 bytes, one operation and one prose passage), each at 600/1440, zero page errors or horizontal page overflow. These are narrow rendering smoke checks, not new certification of every existing-harness capability.
- `check:affected` completed: parallel browsers 866 passed / 27 skipped / six failed; serial browsers 32 passed / one skipped / zero failed. All six failing cases reproduced on untouched source base `8ddc55e2`: approval-clearance:82 at 600 and 1440, fresh-workspace:1845, passage-layout:127 at 1440, product-workspace:691, reading-column-edges:50 at 2560. The first control run had four failures / five passes; repeated geometry controls had four failures / eleven passes, including the remaining two cases. Logs remain private in `.local/ag-1/` in this worktree and `ag1-main-control`. The broad browser command is not green; no unrelated geometry, queue-trigger or paint changes were made to hide failures.
- Synthetic canary is absent from stored observations, externalized blobs, search and replay export. Yash recorded genuine session `660a1ec4` (952 bytes / six observations); two redaction notes were retained and its invented marker was absent from observations, blobs, search and export. This short capture did not require any externalized blobs; the large-blob path is independently covered by the synthetic case. Native Antigravity exposes only window chrome to accessibility here, so additional native tests need accessible controls or Yash's runs. Existing captures contain one question and one permission call, but no browser/MCP calls; AG-5 must supply those genuine cases, with a light model where available.
- No native Antigravity controller was added. Identity/count/filter/composer product changes belong only to AG-2; live task logs and exact child links belong to AG-3; media/artifact presentation belongs to AG-4.

## Scope review before existing-file edits

The TASKS file list omits package registration (`packages/ingest/package.json` and `pnpm-lock.yaml`), real-case registration (`scripts/check-real.ts`), and the contract/reducer version files needed by its approved `call-order` addition. Exact paths and any further correctness requirements will be recorded in the draft PR before they are changed.

Yash approved up to 30 paths on 13 November. Additional existing sections reserved:

- `packages/capture-core/src/index.ts`: optional adapter diagnostics and source-read hooks; existing adapters keep their defaults.
- `packages/ingest/src/index.ts`: adapter registration, discovery diagnostics and stable Antigravity recording selection; `packages/ingest/package.json` and `pnpm-lock.yaml`: workspace dependency only.
- `packages/store/src/index.ts`: Antigravity repeated-step replacement and step ordering; `workspaceRoots()` also includes its explicitly recorded additional roots so existing replay export masks those local paths. Preserve existing harness insert/clock/root behavior. Regression units cover the defaults and mixed Codex/Antigravity ordering.
- `packages/contracts/src/index.ts`: approved `call-order` correlation and contract version; `packages/projection/src/reduce.ts`: reducer version, truthful positional-correlation description and Antigravity step ordering only. Generated scene goldens change for version fields only unless a documented new case requires more.
- `scripts/check-real.ts` and `scripts/real-cases/types.ts`: third-harness registration and scan routing, with old case behavior unchanged.
- `docs/reference/03-event-schema.md`: record the additive agreement; TASKS/STATUS completion and CODEBASE documentation.

Merge review must inspect these sections independently of concurrent work: do not replace complete shared files with this branch's copy. No Claude Code/Codex parser, fixture or real-case implementation is reserved or edited.
