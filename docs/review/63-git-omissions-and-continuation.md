# Git file continuation and honest omissions

13 October 2026. Current-Git DTO/API extension, separate from captured event/store contracts. Complements review 60 consistency and review 61 reading.

| Before | After | Why |
| --- | --- | --- |
| First oversized patch ends collection of later useful files | Skip that patch and continue within the current 50-path batch | One large change cannot hide all subsequent small changes |
| All omissions share one vague message | Separate protected count and per-path response/process content limits | Explain precisely what is unavailable without revealing protected filenames |
| Paths beyond the first fifty have no continuation | Explicit authenticated `start` parameter and bounded Previous/Next file batches | Every eligible status path is reachable; controls do not silently widen each response |
| Open reader disappears when the dock hides on resize | Portal fix in review 62, with actual visibility assertion | Narrow layout retains the reading task |

Each batch retains review 60's second patch pass, scoped index/worktree markers, branch/status/HEAD checks, and independent consent. Page offsets are validated and clamp to the last available batch when status shrinks. No arbitrary pathname reader added. Git stdout-limit errors are identified explicitly; only this per-file content error can be skipped. Timeouts, Git errors and consistency conflicts still fail the request. Every started batch reader settles before releasing the lock. Response patches remain capped at 1 MiB, each command at 2 MiB/ten seconds, up to four readers and fifty candidates per request.

Protected paths are counted without names; only eligible omitted names are shown after redaction. Exceeding either content limit does not imply an inspectable complete patch. The UI offers the existing separately scoped current-file reader as an alternative, which keeps its own text/index/privacy limits; it never claims current source is the missing Git diff. A future bounded large-patch slice service is separate work. Untracked content remains a placeholder; binary/metadata and submodule limitations remain explicit in the raw patch.

Local regressions cover oversize-first/later-small behavior, all eligible file batches, invalid/clamped offsets, protected counts, process limits versus ordinary errors, and authenticated browser navigation beyond fifty. Shared patch reading, notes and responsive reader tests remain in the same branch's final validation. No hosted CI, event-schema/runtime dependency or repository writes.
