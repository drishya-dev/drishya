# Current Git review and local handoff

11 October 2026 · Developer feedback continuation

Open **Git review**, approve the current workspace if needed, then separately approve Git. Refresh explicitly; no polling or repository writes. The daemon uses fixed argv without a shell, disables optional locks/fsmonitor/external diff/textconv/lazy fetch, removes ambient repository/config redirects, and requires the selected root to be Git's top level. Each process has a ten-second / 2 MiB bound; responses contain at most 50 files / 1 MiB redacted patches. Protected paths are excluded before requesting patches. Staged and unstaged patches remain separate; NUL-delimited rename paths are supported. Untracked content uses the existing on-disk reader. Binary/metadata-only changes have explicit unavailable text; submodule details are not inspected. No event-schema/backend-dependency change.

Review marks and labeled, redacted notes live in this browser, bounded to 100 paths per recording. Marks apply to the exact displayed patch fingerprint and HEAD; refresh invalidates changed content. Untracked files cannot be marked reviewed without a sampled patch. This is sampled inspection, not an atomic filesystem snapshot: status/HEAD comparison catches many races but cannot prove no concurrent edit. Refresh before a handoff; reviewing displayed evidence does not certify current disk state.

**Preview handoff** includes only explicitly reviewed, still-matching patches/notes. Review the redacted text, then save locally. Nothing is sent externally. No automatic agent attribution or test coverage claim. Full recording export stays separate.

| Before | After | Why |
| --- | --- | --- |
| Captured patch was the only review context | Separate current branch/HEAD/staged/worktree inspection | Answer today's review question without rewriting history |
| No durable per-content review progress | Explicit patch marks; changed content returns to unreviewed | Reopening must not silently approve new work |
| Full bundle was the only handoff | Selected reviewed patches/notes and privacy preview | Focus the review question with explicit sharing |

Local validation: four temporary-repository units and one browser journey pass, including helper execution canaries, protected paths/redaction, staged/unstaged/untracked handling, rename parsing, consent, persisted marks and content-change invalidation. Typechecks/build pass. Hosted CI remains publishing-only.

This completes bounded current-Git/progress/local-packet work. Actual account-specific native-turn/platform acceptance (R4), semantic symbols/diagnostic links, curated historical packets and multi-agent overlap journeys (wider R6) remain explicit independent scope. Next: distinct working redesign retaining Classic, then fresh diverse firsthand comparison and fixes.
