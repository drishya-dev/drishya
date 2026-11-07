# FILES-13 — repository tree placement

7 November 2026 · investigation in progress

## Confirmed code findings

`FolderExplorer` unions every indexed graph path with every projected captured file path. `worktreeFileRows` then places every path without a recognized recorded-root prefix directly at the repository root. A captured path is not an inventory check. Approving the workspace replaces the graph with its indexed inventory, but the union keeps captured-only entries as well.

Other working directories are labelled only by the last segment of their path, so distinct recorded worktrees ending in the repository name receive identical labels. The full path already exists for the hover title. Recorded-root metadata is loaded asynchronously and refreshed as the recording changes; paths are rendered before that metadata is available.

These are current code findings, not yet a claim that the exact four reported root filenames have been reproduced after a fresh import. No source code has changed. Investigation uses scratch homes only; source manifests and screenshots remain in `.local/`, with only session prefixes, sizes and counts reported.

## Acceptance still to complete

- Trace the reported Claude repository filenames to their genuine captured evidence, without guessing their original directory.
- Check a genuine Codex multi-agent/worktree case and stable, distinct root labels.
- Use existing presentation/classes; keep every file's exact evidence identity and FILES-12 peek / Workspace destinations.
- Real 600/1440 checks, focused units/browser checks and the final gate before readiness.
