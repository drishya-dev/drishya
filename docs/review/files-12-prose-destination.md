# FILES-12 — diagnosis and destination decision

Status: claimed, implementation not started. The existing presentation is left to FINISH-3. No source, style, motion, native policy or schema change is proposed in this draft.

## Why names stay plain today

- `markdown.tsx` only parses Markdown links, inline code and explicit Codex citations. Ordinary bare filenames are never passed to a path resolver.
- `prose-path.ts` requires a file-shaped final component for prose. A folder such as `research/unvibecode_results` has no file extension and is deliberately rejected.
- Absolute paths outside the recorded workspace are rejected. There is no evidence/tree lookup in this parser to establish an outside path's identity.
- The parser uses lexical shape, not an exact match against the session tree or captured evidence. FILES-12 requires that match before adding navigation, so this needs an evidence-aware resolver rather than widening the regex.
- Files rail reveal currently sets the search query; it does not expand ancestors and select the actual row. The rail's normal path list also filters absolute outside-root paths. Both need explicit handling after the destination decision below.

## Product decision required before implementation

FILES-2 says **any path in prose**, card headers, search hits and test output opens in tabbed peek. `tests/browser/prose-file-links.spec.ts` explicitly asserts that each of its three prose links opens the captured file reader, without current-file I/O. `History.tsx` sends Markdown navigation to `openCapturedFile`, which selects `filePanel`.

FILES-12 now says a prose file/folder link reveals and selects the Files rail, not Workspace, and also says FILES-2's existing peek links must keep working. The same prose link cannot have both primary destinations. Per the builder's instruction to write a product/design question in the PR rather than decide, choose one:

1. **Make prose text links reveal Files.** Intentionally replace FILES-2's prose-click contract and update that test on purpose. Keep captured peek for card headers, search/test hits and other existing evidence controls. Confirm separately whether explicit Codex file citations keep peek or also reveal Files.
2. **Keep existing prose text links opening peek, with a separate file/folder icon action revealing Files.** This preserves the current click contract but introduces two adjacent destinations, so FINISH-3 must approve that presentation before implementation.

No choice has been implemented. Unresolved and ambiguous paths will remain literal in either case; no guessed location, workspace opening or outside-root disk access is proposed.

## Running-app baseline, real sessions

A scratch Drishya home imported genuine local sessions of both harnesses. At 600 and 1440 px, the existing prose link opened a reading dialog; it did not reveal/select a tree row. No journal content was printed or uploaded. Screenshots and private scripts/counts stay in `.local/`.

| Harness | Recording prefix | Journal bytes | Observations | Widths | Existing prose links | Reader opened | Selected tree rows |
| --- | --- | ---: | ---: | --- | ---: | --- | ---: |
| Codex | rec_13949e17 | 368600 | 27 | 600, 1440 | 1 | yes | 0 |
| Claude Code | rec_69977fa0 | 354075 | 25 | 600, 1440 | 1 | yes | 0 |

These are baseline checks of the existing destination, not FILES-12 acceptance. No completion checkbox is ticked. Full acceptance still needs every requested form (Markdown, inline, bare; files/folders; inside/outside), both native harnesses, correct icons, exact reveal/selection, unmatched literals and the agreed peek regression contract.

Each worktree has its own frozen install. The current UI was built locally for this baseline. The existing `local prose links open exact source` browser regression passed on Edge, three configured workers (one spec worker), zero retries. No full gate is run for this docs-only decision draft.
