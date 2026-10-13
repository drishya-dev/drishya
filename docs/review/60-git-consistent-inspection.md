# Git review consistency during concurrent changes

13 October 2026. Addresses review 50 item 24 on `codex/git-review-consistency`.

Previously a file could change while its status stayed `M` and HEAD stayed the same. Sequential staged/worktree patch reads could then return a mixture without a conflict. Inspection now compares each returned raw patch against a second read, checks scoped index blob identities and worktree identity/size/mode/nanosecond modification/change markers before and after, and rechecks branch/status/HEAD. A mismatch returns **409: Repository changed during inspection. Refresh before reviewing.** No partial result is returned; the existing reader clears its prior snapshot and offers Refresh. The request lock is released for retry.

Comparison is before redaction: two different credentials yielding the same redacted display still invalidate the result. Temporary comparison hashes stay in memory; only redacted patches and the existing content fingerprints leave the reader. Untracked files remain placeholders with content behind the separately approved disk reader. Protected paths are excluded before patch/index/metadata checks. No Git writes, shell, helper execution, native-policy/schema/API DTO changes, polling or dependency additions.

Both patch passes use at most four concurrent readers per inspection, consuming initial results in status order. All started readers settle before an error releases the request. Existing bounds remain: 50 paths, 1 MiB redacted response content, ten seconds and 2 MiB output per Git process. Four readers may temporarily retain up to four staged/worktree patch pairs; this is a deliberate bounded memory/latency tradeoff. Scoped index reads include only candidate paths and skip the empty set. Metadata checks include at most 100 unique current/previous paths.

This remains an optimistic current sample, not an atomic filesystem snapshot or a lock on the user's repository. Writes after the final checks can happen; metadata-preserving adversarial changes or filesystem timestamp limitations cannot be certified away. Refresh before sharing. Existing submodule, binary, omitted-path and read-only scope limitations remain; this increment does not add historical attribution or test coverage claims.

## Validation

Windows Node 24.14.0: 342 full-suite units, both TypeScript checks, final 11 Git regressions and two Classic/Studio Git browser journeys pass. Browser coverage includes a 409 response clearing stale patches/disabling handoff, then successful Refresh recovery. The isolated branch regression also passes after removing a test-only dependency on an earlier consent test. Backend source only; no frontend rendering change or hosted CI.

Seven regression cases supplement the original four Git tests: unchanged-status worktree mutation plus successful retry; staged-content mutation; different redacted credentials; late worktree edit after patch verification; same-HEAD branch switch; index-only blob replacement after verification; and deterministic 50-file ordering / four-reader bounds / protected-path omission. Races use the real fixed-argv Git reader with a deterministic internal test seam, not timing sleeps or an arbitrary product command endpoint.

Local full-suite/typecheck and Classic/Studio Git browser results are recorded in STATUS at completion. An ignored synthetic 50-file reference-machine probe returned all 50 files with no omissions: prior serial reader 7,136 ms, new checked/batched reader 7,375 ms. Earlier serial-first-pass implementation measured 12,801 ms and was replaced before commit. These are individual local samples, partly alongside other local tests, not a new broad performance/platform gate. No hosted Actions dispatched.

Next separate work: bounded Git patch reading/hunk/find affordances, stale-note retention and omission clarity from review 50; actual native-account and physical/platform/human release checks remain open.
