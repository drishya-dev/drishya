# SHIP-16a — canonical checkout identity and platform CI

Yash with Codex, 11 November. Original three-platform run: 42967305423, `fc4c1925`. The independent browser repairs are split first as SHIP-16b under Yash's explicit instruction; this report classifies them without changing UI or motion in a checkout-security patch. No merges by Codex.

## Confirmed causes and correction

- `checkoutIdentity` compared `realpath(requested)` with the supplied spelling and rejected any difference. This rejects a legitimate junction/symlink, macOS `/var` aliases and Windows 8.3 temp paths, not just a moved checkout. Identity now records the canonical root and its directory/Git identities. Grant keys use that same canonical path, so approving, restoring or revoking through another spelling addresses one grant. The exact approval spelling is also saved, solely to find and revoke a receipt when that spelling disappears or is retargeted. It never proves access: restore still requires the complete current identity to match. A moved/replaced root or retargeted alias cannot inherit an unrelated grant.
- Git worktree administration pointers can also spell an aliased ancestor. Canonicalise those paths, but still reject a final symlinked metadata directory and retain inode/birthtime checks. The `.git` marker's symlink, file identity and bounded-read guards stay unchanged. Home/drive-root refusal uses canonical home too.
- Image race/path fixtures used noncanonical temp paths even though exact-image permission intentionally refuses linked file paths. Canonicalise **synthetic fixture directories**, not product image permission. All link/protected/outside/changed-file/revoke assertions stay.
- `repository-root` already canonicalised its temp directory, then compared it to an uncanonicalised cleanup bound. The cleanup guard now compares canonical temp bounds; no broader deletion is allowed.
- APFS can refer to one disk file through NFC and NFD spellings. The draft test incorrectly asserted two distinct inodes. It now checks its actual promise: exact inert draft spellings round-trip and disk bytes remain unchanged. No draft restore, overwrite or Unicode policy changed.

## Targeted proof

Final local portability units: **41 passed / one existing case-sensitive-Windows opt-in skip in five files**. The physical Windows **8.3 test ran and passed**, not skipped. It obtains the short path using a fixed read-only command, proves the canonical path and grant key match, restores through both spellings and rejects a move, disappearance and return. Directory-alias tests use an actual Windows junction (POSIX symlink on the other platforms), prove cross-session restore/read/revoke, reject retargeting, and reproduce the missing aliased-parent case. Existing missing/replaced/redirected-root and Git-administration replacement tests remain.

An initial new test tried to overwrite Git's hidden Windows `.git` pointer with `w`, which Windows refuses. The synthetic-only test now opens the existing hidden file with `r+`, truncates it and writes the pointer; no native journal or user repository is involved.

The first branch CI (42996154096, `2e219ca8`) passed Linux's check but caught one remaining missing-grant test on macOS and Windows: once `/var` or a short-name ancestor could not resolve, a hash of its unresolved spelling failed to find the old canonical receipt, which could reappear when the directory returned. The new bounded, exact-spelling fallback revokes that receipt on failed identity proof; a subsequent explicit approval removes an older receipt for that same spelling. This is private Drishya metadata (`version:1`, one optional backwards-compatible `requestedRoot`), not an event-schema or native-file change. That failed run's remaining jobs were cancelled, not called green. The next consent-boundary probe then reproduced a retarget to a separately approved checkout borrowing that target's grant. Final runtime `7a3e8f0f` keeps an opaque spelling-hash → grant-id binding, so an observed alias cannot silently change checkout even across repeated requests. A failed binding remains a denial until explicit new approval; resetting all remembered grants clears alias history. Bindings are bounded at 4,096, contain no journal text and confer no access by themselves. Saved identity keys use the immutable approved spelling, not today's redirected filesystem target. The added test proves both repeated denials and that the independent target's original grant still works.

### Genuine session acceptance

| Native capture | Size / observations | Widths | Checks |
| --- | --- | --- | --- |
| Claude Code `rec_be806b25` | 8,627,732 bytes / 2,747 | 600, 1440 | Explicit remembered approval, same canonical identity/key through a real scratch junction, one grant, reload, daemon restart, exact revoke, zero page errors |
| Codex `rec_73cbf2eb` | 246,794 bytes / 55 | 600, 1440 | Same complete journey, zero page errors |

These are genuine existing native journals, imported read-only into a fresh scratch home for each width. The alias is created only in that scratch directory; no journal cwd or user checkout is rewritten. The actual native-journal path remains recorded truth. The canonical-alias proof uses that same current checkout's grant; synthetic units supply the moved/replaced/retargeted-directory mutations. Eight private frames and the numeric receipt remain in `.local/ship-16a/`. No prompt, native policy, configuration, credentials or user project file changed.

`pnpm check:real -- workspace-files --max-mb 15 --pick 1` also imports genuine Claude `rec_39af3c94` (14.5 MB, 747 operations, 46 file references) and Codex `rec_275b92f0` (6 MB, 83 operations, two file references) into its own scratch home. This structural guard supplements, not replaces, the explicit approval/restart/revoke journeys above.

### Local checks

- Both final typechecks and UI build pass. The first `check:affected` typecheck found an unsupported type option on `execFileSync`; the short-path probe now uses typed `spawnSync`, and the final typecheck is green. No cast or ignored compiler error.
- The related run passed **231 units / one skip in 26 files** before the missing-alias correction. The corrected final portability run is **41 passes / one skip**; the complete hosted unit runs below cover the final runtime.
- Final targeted Edge browsers: **21 passed**, two workers, no retries: checkout connection, connected workspace, path images and draft recovery conflicts. All four genuine acceptance journeys above pass on the corrected runtime.
- `check:affected` remains red due six already clean-main-confirmed browser cases: **331 parallel pass / 21 skip / three failures**, then **23 serial pass / one skip / three failures**. These are agent-inventory (3/300), product-workspace:627, material-motion:132, p1-pacing:40/:266. No new checkout/connection/image/draft browser failed. No clean-main comparison was run here.
- Final `package:verify` passes: isolated offline installation, Claude/Codex import, authenticated API and persisted restart. It ran separately from browsers, so no build could invalidate a running browser's assets.

## CI boundaries

The branch's browser job explicitly uses two workers, with its existing one-worker serial pass. Local browser checks use Edge; hosted CI retains the workflow's installed Playwright Chromium. Windows/Linux/macOS hosted checks are CI coverage, not a human platform acceptance or WSL/Mac native-live claim.

The requested **main** dispatch runs the current main commit; branch-only fixes cannot be claimed present until Opus reviews and merges. A separate branch dispatch verifies these corrections before that merge. Main and branch outcomes will be listed independently, with actual SHAs, worker counts and each remaining failure. The stale demo bundle was already regenerated on main, not changed here. No test retries, relaxed assertion or longer timeout.

| Run / commit | Windows check | Linux check | macOS check |
| --- | --- | --- | --- |
| Requested main 42996185261 / `89bd4531` | Red: 16 unit failures, 1,356 pass / one skip | Green | Red: 17 unit failures plus repository-root cleanup suite, 1,353 pass / three skip |
| Corrected candidate 42997086199 / `7123521e` | **Green:** 226 files, 1,378 units / one existing skip | **Green:** 226 files, 1,375 units / four existing skips | **Green:** 226 files, 1,375 units / four existing skips |

All three corrected check jobs include typechecks, package verification and a zero-diff committed-demo check. Main's Windows/macOS failures are the old checkout rejection, exact-image temp fixture assumptions and, on Mac, the cleanup-bound/NFC-NFD assumptions described above. The corrected branch removes every one. Main's code has not been merged by Codex; final green main confirmation depends on Opus's merge.

## Final outcome and acceptance

**Ready for review, not merged and not release clearance.** Final targeted platform run [43000818778](https://github.com/drishya-dev/drishya/actions/runs/43000818778), runtime `7a3e8f0f`, is green on all three **check** jobs: Windows 1,379 passes / one existing skip; Linux and macOS each 1,376 passes / four existing skips, 226 files on each. Typechecks, package verification and demo drift check pass everywhere. Its explicitly labelled `checks_only=true` input skips browsers; the default remains both full matrices. This final targeted run is not called a full green gate.

The full candidate run 42997086199 (`7123521e`) completed Linux with 739 parallel passes / 28 skips / 13 failures, then 28 serial passes / one skip / four failures. Mac: 712 parallel passes / 28 skips / 40 failures, then 27 serial passes / one skip / five failures. Windows browser was superseded/cancelled by the final targeted dispatch; it is not claimed passing or fully measured. No runtime layout, typography or motion changed in the final alias-binding correction. Final corrected-source local target checks pass again (21 Edge browsers, two workers/no retries, 35.0 s), and the four genuine approval/reload/restart/revoke journeys pass again with zero page errors.

The requested main run completed all six jobs, at `89bd4531`: Linux check green, Windows/Mac checks red as tabulated above. Browser counts: Windows 668+28 passes / 28 skips / 89 failures; Linux 734+28 passes / 29 skips / 22 failures; Mac 664+27 passes / 29 skips / 93 failures. Main used its then-default four parallel workers; the corrected workflow uses two. No performance comparison is claimed. [Per-case corrected-browser inventory, main totals, known seven-case diagnosis and release-blocking dispositions](ship-16a-browser-classification.md). SHIP-16b owns those browser repairs; none is silently waived. The original un-split Release-1 CI goal is not closed until that work and a post-merge full main run pass or each residual has explicit release assessment.

| Accept line (after the authorised split) | Proof / remaining external dependency |
| --- | --- |
| Canonical symlink/junction and short-name access; reject moved/replaced/retargeted roots | Physical junction and Windows 8.3 tests pass, including missing/return and independently-approved retarget cases; POSIX symlink tests pass in Linux/Mac CI |
| Both real harnesses at 600/1440, scratch home | Four complete native-capture journeys above, repeated on final source, zero page errors; only prefixes/sizes/counts are public |
| Dispatch main and classify every OS | Main run 42996185261 completed, explicit check/browser results above and linked inventory; no local clean-main comparison |
| Correct the platform causes | Final run 43000818778: all three platform check jobs green, all former alias/image-fixture/Unicode/cleanup unit failures removed |
| Finish browser reliability and green full main | Separate whole SHIP-16b under Yash's approved split; currently release-blocking, not claimed done. Final main run after this fix depends on Opus reviewing/merging; Codex never merges. |

## Integration

At most 12 changed paths including workflow and four documentation files plus this failure appendix. No product UI, layout, motion, palette, controller/native policy, event schema, user file or protected spec edited. Source work is confined to checkout grants; test-fixture canonicalisation preserves existing link/image/refusal checks. The sole current-main integration (`89bd4531`) adds PERF-4 documentation. Preserve SHIP-16b and all other claims/phase ordering in the completion-doc merge. FILES-15 already merged as #412 / `8ef82f71`; FILES-16 follows the browser work, then LAYOUT-1c and MOTION-4, then LIVE-7. SHIP-3 stays deferred.
