# Revalidated current Git handoff

14 October 2026 · Harsh with Codex · `codex/git-handoff-revalidation`

This follow-up starts from integrated main `0ec6caf`, preserving reviews 60–69: four-reader race checks, scoped index/file markers, paged Git patches, previous-note continuity and the integrated reading UI. The first local draft started before those merges; it was saved and the branch moved onto current main before continuing. This increment adds the remaining handoff/filter/deadline safeguards.

## Behavior

Preview handoff and Save handoff each request a fresh, separately consented Git sample for the currently inspected file page. The sample fingerprint includes raw branch identity as well as HEAD, status and included raw-content fingerprints. A mismatch replaces the displayed sample, clears the packet and asks for inspection before a new handoff. Per-file review marks still belong to exact patch content; switching branches at the same commit invalidates an existing packet without unnecessarily discarding identical per-file marks.

Preview uses the daemon's completed sampling timestamp. Save rechecks content and downloads the exact text the user previewed; it does not silently regenerate that text. The packet describes its current-page scope and omitted paths, and states that this is optimistic sampling rather than an atomic filesystem snapshot, agent attribution or proof of test coverage. Review-note/mark edits invalidate a preview. Only explicitly reviewed patches on this page are included.

During revalidation, selection, review edits, paging and competing refresh/export controls are disabled. Reading, patch navigation and closing remain available. A failed check removes the packet while retaining the prior reading context and offering retry. Closing or switching the recording/data source suppresses late updates and downloads. No background Git polling, new motion, telemetry, dependencies or event-schema changes.

## Backend bounds and helper suppression

All Git subprocesses share a 30-second abort deadline per inspection; existing per-process ten-second / 2 MiB limits, four concurrent readers, 50-path pages and 1 MiB redacted response budget remain. Started reader batches settle before the request lock is released. Native filesystem metadata calls are not cancellable, so the shared subprocess deadline is not a hard bound for a stalled filesystem. Large patches still disclose omissions and other pages remain explicitly navigable.

Git status and diff can invoke clean/process filters despite disabled external diff/textconv. Inspection reads configuration **key names only**, finds up to 64 configured drivers and overrides their clean/smudge/process/required settings for each subsequent command. It never changes Git configuration. It also rechecks the key catalog and workspace/Git consent before returning a sample. Existing fixed argv, optional-lock, fsmonitor, lazy-fetch, ambient-redirect and redaction protections remain. Colon-bearing paths are excluded to avoid drive/alternate-stream resolution on Windows.

This does not lock Git configuration or the worktree. Concurrent/adversarial configuration changes, writes after the last check, metadata-preserving changes and filesystem timestamp limitations remain outside an atomic guarantee. Untracked, binary and submodule limitations remain explicit. Raw comparison digests stay in memory; only redacted patches reach the UI/export.

## Craft review

Applied the installed `emil-design-eng` guidance, preserving the repository doctrine. No motion changed.

| Before | After | Why |
| --- | --- | --- |
| Preview/save used the previously fetched sample | Fresh sample before both operations; visible checking status | Avoid exporting stale reviewed content |
| Note edits left an earlier packet available | Any review edit clears the preview | Export must match the review text the user saw |
| Inspection failure cleared reading space | Retain the prior sample, show failure, clear export | Preserve reading context while requiring another check |
| A closed reader could finish saving later | Recording/source/lifetime guards suppress late download | Closing is an effective interruption |
| Timestamp represented packet-generation time | Completed daemon sample timestamp | Label the evidence's actual sampled time |
| Git filters and many serial process limits were unchecked | Invocation-only filter overrides and shared subprocess deadline | Bound helper execution and inspection wait |

## Local validation

Final Windows candidate: frozen lock, both TypeScript checks and **364 full-suite units** pass. The complete Chromium suite passes **110 tests / two opt-in skips**, with six focused Git journeys also passing. Build, isolated offline packed CLI installation, synthetic Claude/Codex imports, authenticated API and persisted restart pass; demo regeneration is unchanged and whitespace is clean. No hosted CI. Coverage includes existing unchanged-status/HEAD races, index-only drift, different secrets with the same redaction, branch changes, bounded reader ordering/pages/omissions; plus identical-byte replacement, mid-read consent revocation, stable-HEAD branch packet identity and filter execution/configuration canaries. Classic/Studio browser journeys cover fresh preview/save drift rejection, successful download, note-preview invalidation, check failure/retry, disabled competing controls and closing during a gated save.

An isolated synthetic 50-file probe completed in **4,921 ms**, returning all 50 files, zero omissions and 9,800 patch bytes. This is one Windows reference-machine sample alongside browser testing, not a low-resource/platform benchmark or a guarantee for large patches. The temporary repository/store was removed; the probe script stays ignored/local.

The first full browser run exposed a pre-existing reading-baseline race (109 passes, one failure, two opt-in skips). The unchanged test passed three isolated repetitions. Its two-frame starting-position wait now observes settled visible passage bounds/scroll position before recording the baseline; every three-pixel filter/view/theme preservation assertion remains. Five repetitions pass with this setup. Git test canaries now recognize argv containing invocation-only filter overrides; request interception includes the Git page query string, and tests wait for refresh completion when retained content already matches.

No hosted CI dispatched. Synthetic fixtures only for this increment; no real account prompts, new real recording imports or release/platform/resource certification. Native-account lifecycle and physical/platform/accessibility/human acceptance remain separate next gates.
