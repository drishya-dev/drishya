# SHIP-15 — complete recorded agent prose

8 November 2026 · [PR #375](https://github.com/drishya-dev/drishya/pull/375) · source freeze `7102778d`.

## Behaviour and merge coordination

History now automatically reads the stored body when the projection carries a bounded prose preview. It renders that body as the same selectable Markdown in the same history position and reading width. There is no second reader or “Preview · read full text” action. Untruncated messages make no additional request. Reasoning visibility preferences remain intact.

The projection and virtual history stay bounded. Full bodies travel in existing UTF-8 byte chunks, avoiding the line-slice response limit for a single very long line. The existing material cache limits retained decoded bodies and simultaneous requests; content above the cache budget remains readable without being retained in that cache. Missing or expired bodies say why and offer Retry. A failed load does not silently claim the preview is complete.

Yash approved the isolated shared-file work on 8 November and asked for these merge notes:

- `History.tsx`: one import and the `ProseView` material-rendering branch; remove its full-reader toggle state. Preserve Claude's MOTION-3 arrival effect, hover, scrolling and plan mounting.
- `history-worker.ts`: only `artifactChunk`'s eligibility guard, allowing an excerpt backed by a recorded prose item. Preserve Harsh's SHIP-14 queue sections. This does not add an endpoint, schema field, file reader or policy grant.
- The pure legacy delivery-envelope parser is shared with the existing projection guard. A full legacy artifact omits its routing wrapper only when the projection's existing provenance note attests that transformation. Ordinary prose that merely resembles a wrapper stays literal. The reducer, owned by FILES-14, is unchanged.
- No stylesheet, token, Clarity, composer, Files reader or Workspace changes. UI-27 retains ownership of the forthcoming reading-width presentation.

## Acceptance on genuine local sessions

Native journals were read without modification and imported through the normal redacting ingest into disposable Drishya homes. Reports contain prefixes, sizes and counts only. Private screenshots and scripts stay in `.local/`.

The local scan covered 178 eligible Claude journals and 21 eligible Codex journals up to 90 MB; larger journals were explicitly excluded from this bounded scan. The longest assistant message in each selected source was mounted at both supported widths:

| Harness | Recording prefix | Source bytes | Full recorded characters | Widths | Rendered characters |
| --- | --- | ---: | ---: | --- | ---: |
| Claude Code | `rec_fbfa5286` | 3,563,631 | 17,443 | 600 / 1440 | 16,648 |
| Codex | `rec_45333698` | 5,418,932 | 11,746 | 600 / 1440 | 11,372 |

The separate paged-history checks exercise automatic body loading beyond the worker's 4,096-character preview:

| Harness | Recording prefix | Source bytes | Full recorded characters | Widths | Rendered characters | Body requests per view |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| Claude Code | `rec_0ae1d6bd` | 42,786,143 | 16,065 | 600 / 1440 | 15,353 | 1 |
| Codex | `rec_fa9e37da` | 39,239,090 | 11,746 | 600 / 1440 | 11,372 | 1 |

Rendered counts differ because Markdown markers and link targets are not displayed as prose. All eight views had zero document overflow, zero runtime errors and no preview-reader button. Their full messages remain in the normal scrolling history, rather than a nested material reader.

`pnpm check:real -- full-prose` also found 26 Claude sessions / 276 long-message cases and three Codex sessions / five cases. The imported scan selections were `rec_c8e5c9c8` (83.7 MB, 2,695 operations, 69 long messages) and `rec_7cb1cda1` (15 MB, 1,115 operations, three long messages); all had complete text or complete recorded artifacts. This scanner is now listed by `check:real --list`.

## Regression checks

- Baseline browser regression: a 100,026-character synthetic message was cut at both 600 and 1440. The same checks now pass, comparing the complete rendered text rather than only its last paragraph.
- Byte loading: unit checks cover a line over 2 MiB, non-ASCII boundaries, multiline completion, missing bodies, stalled responses, changing bodies, incomplete responses, capped line-only sources and qualified versus literal routing wrappers.
- Both typechecks and 518 related units / one existing skip pass through `check:affected`.
- `package:verify` passes the isolated offline install, both-harness import, authenticated API and persisted restart.
- All 1,281 units pass with three workers; one existing skip.
- Frozen-source `check:affected`: 676 parallel browsers passed / 27 existing skips / one B4 setup failure; 33 serial passed / one existing skip (three parallel workers, one serial worker, zero retries). The command exited red, and is not reported as a clean full gate.
- Current main was merged as `d7a63e76` (including SHIP-1 and UI-28b); own frozen install, both typechecks and package verification pass again. All eight genuine width checks were repeated successfully. The longest-case Codex selection is now `rec_fa9e37da` (39,239,090 bytes), with the same 11,746 recorded / 11,372 rendered characters as the earlier selection.
- After that integration, eight targeted browsers pass: full prose at both widths, both typed delivery cases, Markdown reading, tables at both widths, and B4 paged history. A further 49 focused units pass.
- Post-integration B2/live-sync checks: four pass, one selection check fails once; that exact B2 check then passes four consecutive unchanged isolated runs. See the unresolved check below. Main-history mounting, capture while Follow is off, and B4 pagination pass.

Initial unrestricted unit runs had five-second timeouts in image, checkout-grant and file-root tests under concurrent load; the three files pass unchanged when isolated (23 tests), and all units subsequently pass with three workers. No assertion or timeout was changed. The early B4 failure was an absent `dist/index.html` while package verification rebuilt the UI in the same checkout. Its isolated post-build/integration check passes; this was a verification scheduling mistake, not a product defect.

## Unresolved check for Claude / TEST-2

`b2-live.spec.ts:63` failed once after current-main integration at its existing line-78 assertion: triple-clicking captured Read text unexpectedly left one Operation detail region open (expected zero). All four unchanged branch reruns passed. Clean main `f40ace47`, rebuilt with its own install, passed 3/3 and then 8/8 unchanged runs. **Baseline reproduction is unproven.** Do not describe this as a proven clean-main flake or a fully green integrated gate. Preserve these records for Claude's investigation; no hover/click/selection code, test assertion, timeout or retry policy was changed for SHIP-15.

Private logs: `.local/affected-edge.log`, `history-integrated.log`, `branch-b2-repeats.log`, `post-main-browser.log`, `real-final.log`, `real-paged-final.log`, `all-units-three-workers.log`, `units-integrated.log`, `package-integrated.log`. Clean-main comparison logs are in the separate main worktree's `.local/ship15-baseline-b2*.log`.
