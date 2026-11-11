# GIT-8 · Compare replaces Changes

Yash, 11 Nov: the header's **Changes** said nothing useful (a bare turn number per file). It is now **Compare**, a focused working window
like Workspace: two sides, the files each side changed from their merge-base, and under every file the agents of this session that wrote it.

## What it is

- **Header.** The Modern header's Changes button is Compare, in the same place. The whole-session view it used to open (failures,
  recorded checks, gaps, each file's captured edits, the turn column included) is not deleted: **Review changes and checks** in the command
  palette (Ctrl/Cmd K) still opens it. Classic and Studio headers are unchanged.
- **Window.** `CompareWindow.tsx` docks exactly where the Workspace does (it shares `.developer-workspace` for geometry and the 200 ms MOTION-1
  arrival; it leaves in 120 ms, immediately on Escape). The stage stays mounted and hidden, so closing returns to the exact reading place;
  the preset, both sides and the selected file are remembered per session (`useWorkspaceState`). No graph.
- **One quiet line** at the top: `base ← compare · N ahead · M behind · K commits`. The two sides are searchable lists of local branches,
  remote-tracking branches and tags, newest first. Commits opens a short list; a commit whose hash the session printed carries "this session"
  (the GIT-2 rule: printed, not proof of authorship).
- **File list.** *Changed on both* first (a merge can conflict there), then *Only on <compare>*, then *Only on <base>*, each file `+N −M`.
  The diff is the shared `GitPatchReader` / `DiffReader` (no new reader). For a file both sides changed, a two-button switch reads each side's
  change from the merge-base.
- **Agent evidence.** Under each file, one line: the agents of this session that wrote it (captured `edit`/`write` operations that succeeded or
  are unknown; never failed or declined ones), each a jump to that agent's latest edit in History. A file with no captured edit says so
  plainly in the diff header. The turn number is gone.
- **Presets.** *Uncommitted* (the working tree, as Git review shows it), *This session* (the branch the journal recorded, else the checked-out
  branch, else detached HEAD, against the default branch, listing the files the session edited with "Show all N"), *Branch* (two sides of
  your choice, `main` by default) and *Pull request*.

## Read-only, and where GitHub comes in

The daemon (`git-compare.ts`) runs only `for-each-ref`, `rev-parse`, `merge-base`, `rev-list`, `diff` (the same `--no-ext-diff
--no-textconv --no-renames` flags as History and Git review), `log` and `cat-file`, through `readGit`, behind the existing Git consent (GIT-7).
A side is either a ref name checked against `for-each-ref` or a commit id that must already be a commit object here; nothing a client sends
reaches Git as an option. Nothing fetches, checks out, merges, rebases or moves a ref (`git for-each-ref`, `HEAD`, status and stash are compared
before and after in the daemon unit and the browser spec).

Pull requests use the person's own `gh`, only after the existing opt-in under Settings (LINK-1): `gh api repos/<repo>/pulls` (REST, so it
does not draw on the small GraphQL budget) lists open PRs; a PR whose head commit is here is compared locally against the local base ref; one
whose head is not here is read with `gh api repos/<repo>/compare/<base>...<head>` (GET, one file/commit page), which only knows the compare
side's changes, so those files are all "Only on <compare>" and the line says "from GitHub". Signed out, missing or offline, the window says so
in words (and for a PR it says the branch is not on this machine). With lookups off it offers **Allow GitHub lookups**, the same switch as
Settings.

## Limits, recorded

- Evidence is the session being read. Other sessions that edited the same file are reachable through Search all sessions; reading their
  projections for every file in a Compare would load many large sessions into the history worker.
- An offline copy or the bundled demo has no repository: Compare opens and says so.
- At most 400 files and 30 commits are listed; larger counts say how many are not shown.
