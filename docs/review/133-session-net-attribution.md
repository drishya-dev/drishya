# READ-5 — captured session net diffs

The Changes reader now offers an optional net diff under each changed file. It composes the recording's positioned patches; a boundary-scoped Changes reader composes only edits after that boundary. It does not read today's working tree. Every surviving addition and net removal links to the exact captured edit, its same-agent prompt turn when captured, and the first subsequent recorded test or command in that turn. The check is recorded order, never proof of coverage or causality.

## Evidence and limits

The scene helper retains symbolic identities for uncaptured unchanged lines. It learns their text only from captured patch context/removals. Applying a later hunk requires its known material to match. Reverting text removes it from the net diff; reintroducing a transient addition retains the latest writer. Returning original text restores original position identity, so removing it again is attributed to the later removing edit.

No net assertion is made for missing positions, incomplete/missing successful patches, conflicting patch contents, overlapping edit intervals/hunks, inconsistent new-side coordinates, intervening capture gaps or unpositioned replacement writes. These cases keep an explicit reason and the existing individual edit evidence. Declined/failed attempts are not applied. Unknown outcomes are not promoted to success. A completed shell wrapper without a numeric exit code shows an unknown command outcome, not a passed check.

“Captured net diff” means consistent captured patch material, including reconstructed proposals where that is what the harness recorded. It does not independently verify disk state. Final-newline differences are explicitly excluded because the current material model does not preserve them consistently; standard no-final-newline metadata does not suppress otherwise readable lines.

Composition is bounded to 100,000 symbolic lines and 20,000 captured material lines per file. A review page carries at most 10,000 net changed lines and 1,000,000 net text characters. Exceeding a limit displays an explicit unavailable message; it never presents a silently truncated patch as the complete net diff. Individual operations remain available. No event schema, reducer, adapter, History component, API route or worker-routing changes.

## Interface review

Applied the installed `emil-design-eng` skill after inspecting the existing Changes reader in the running app.

| Before | After | Why |
| --- | --- | --- |
| Only per-file totals and per-edit receipts | Optional per-file captured net diff | Read the surviving change without adding resident main-canvas chrome |
| Turn attribution only at edit level | Changed-line links to the exact operation and turn | Answers where a surviving line came from without model attribution |
| Only a later test link | Later captured test or command, with an honest unknown outcome | Includes lint and other shell checks without pretending every command is a test |
| No net-state boundary | Explicit unavailable reason for discontinuous evidence | Missing capture cannot become a fabricated file state |

No animation was added to this frequent reading interaction. Existing reader motion remains unchanged. Net rows wrap long material, retain selection and scroll inside the optional reading area.

## Verification

- 29 focused scene tests pass, covering sequential replacements, offsets, reversions, latest removal attribution, reinsertion, context mismatch, missing/invalid positions, capture gaps, bounds, boundary scope, next-command linkage, agent/turn limits, missing exit codes and newline metadata.
- Both TypeScript projects pass; production UI build passes.
- Existing Changes edit-turn browser acceptance passes on Edge. New net-diff browser acceptance passes at 600 and 1440 px, checking line counts, edit navigation and zero horizontal overflow. Initial new test failures were selector collisions with existing hidden/repeated Changes controls; the final selectors deliberately target the visible Changes entry and the exact changed-file container.
- Root's independent deterministic composition probe passed 300 seeded chains of 25 insert/delete/replace operations, including repeated text, comparing the reconstructed net result with final synthetic bytes.
- Real Codex `4b5ca5b1`: 1,530 observations, 542 operations, 69 changed files across both review pages; 66 consistent net diffs, 2,909 changed lines, three explicit discontinuity fallbacks. One actual five-line diff was opened in the browser, with zero horizontal overflow.
- Real Claude Code `024517cd`: 2,112 observations, 426 operations, 16 changed files; 12 consistent net diffs, 840 changed lines, four explicit capture-gap fallbacks. One actual 20-line diff was opened in the browser, with zero horizontal overflow.
- Real captures were read from an ignored private copy of an already-redacted local store. Actual screenshots remain ignored under `.local/`; no real contents, paths or titles are committed. No fresh native model calls or project-file writes were made. The actual Codex recording's old native source path was no longer present; stored redacted evidence remained readable. The native segment endpoint's missing-source error was unrelated to the net-diff reader and is not claimed fixed here.
