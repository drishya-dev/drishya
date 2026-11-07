# FILES-12 — referenced files open in preview

## Agreed behavior

The builder clarified on 7 November: references in an agent's reply should **open the file preview and show the file**. This resolves the original draft's destination question. File references preserve FILES-2's preview destination; no second action button or Workspace navigation was added. A directory represented in Files still expands and selects that folder.

The look is left to FINISH-3. Existing file icons, inline link classes, file readers, image readers and consent controls are reused. No Clarity, History, animation or stylesheet changes.

## Diagnosis

The old Markdown parser recognized links, whole inline-code tokens and native citations, but not bare names. Its lexical path helper rejected folders and outside-root absolute paths and did not consult real tree/evidence identities. The existing Files reveal action filtered search rather than expanding/selecting a row.

The initial baseline checked genuine Codex rec_13949e17 (368600 bytes, 27 observations) and Claude Code rec_69977fa0 (354075 bytes, 25 observations) at 600/1440 px: each existing prose link opened a reading dialog, not a selected Files row. The existing FILES-2 browser contract also passed. That baseline led to the builder's clarification, not to a change of the existing preview default.

## Implementation and evidence boundary

- One conversation-wide index uses the same paged/as-of projection as the viewer, the existing repository tree and recorded root metadata. No per-word filesystem probes or new API.
- Exact paths win; shortened names resolve only when unique. Current-tree and captured primary-worktree aliases are deduplicated while preserving the captured reader's exact identity. Unknown/ambiguous names and unsupported/traversing/remote path forms stay literal.
- Markdown links, inline-code file references, bare file-shaped names and native file citations get the existing file icon and preview action. Whole commands and fenced code are not scanned as prose. Document reading retains its old Markdown behavior.
- Captured text opens the existing file reader, with captured contents by default. A current-tree-only file opens current peek only with existing workspace consent, clearly labelled as current; it does not enter Workspace. Missing captured contents remain honest.
- An image with recorded bytes bound to its own operation opens the existing image reader. A path-only image opens the existing path-image controls. Current image bytes require existing workspace or exact-file consent and remain labelled current. Images on a surrounding script are **not** assigned to its child calls by order or proximity.
- Directory references represented in Files expand ancestors, select and scroll to the actual row. The retained expansion set stays bounded. No outside directory access is inferred.
- The index bounds are 20,000 unique identities, 200,000 aliases, 2,000 characters per candidate and 64 folder/suffix levels; additional text stays readable and literal. Captured identities take priority over the current tree.
- Image preview ownership is scoped to the source, session and available replay evidence. Escape in a nested image reader closes that reader, preserving its parent preview.

## Genuine native acceptance

The real Claude Code and Codex harnesses created these captures in a throwaway repository. Each was imported into a scratch Drishya home. Checks used the actual app at **600 and 1440 px**, with no native journal content printed. Screenshots/private scripts/counts remain under `.local/`.

| Harness / case | Recording prefix | Bytes | Observations | File links per width | Markdown / inline / bare | Contents opened per width | Outside-file contents per width |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: |
| Codex, inside/outside image references | rec_ccf2bc81 | 359006 | 27 | 6 | 2 / 2 / 2 | 6 | 3 |
| Codex, current-tree-only text | rec_5752b823 | 343031 | 43 | 3 | 1 / 1 / 1 | 3 | 0 |
| Claude Code, captured inside/outside text | rec_24d0498e | 358487 | 45 | 7 | 2 / 2 / 3 | 7 | 3 |

**32 file openings showed actual contents across six viewport journeys.** Both harnesses also checked a genuine inline directory reference selecting its folder; unmatched names stayed non-clickable. The folder mention and latest file reply are separate native prose entries in the Claude session.

Claude's first outside Read was refused, correctly leaving no captured contents. A genuine resumed turn then used Drishya's native one-time approval flow: one exact Read approval, no saved-policy change, with the requested synthetic file checked before approval. Its successful Read supplied the captured outside-file contents.

Codex's image bytes were recorded on a surrounding script, without an exact byte-to-child-file association. The preview therefore used the explicitly labelled current-image path and its existing exact-file consent, rather than guessing which image belonged to a path. Its separate text case also proved current-tree-only preview and that an unverified outside path stays plain.

`pnpm check:real -- prose-file-references` scanned both harnesses into scratch storage: 116 Claude sessions / 1145 qualifying prose rows and 16 Codex sessions / 71 rows under 90 MB. Selected Claude rec_c8e5c9c8 (83.7 MB) presented 1852 prose entries and 2679 evidence-backed reference occurrences / 148 identities; Codex rec_7cb1cda1 (15 MB) presented 385 prose entries and 59 occurrences / 16 identities. These inventory counts supplement the actual native UI checks above.

## Regression checks

- Five resolver/render units cover exact and unique names, ambiguity, Windows/file URLs and line suffixes, outside captured identities, worktree aliases/deduplication, icons, unknown names, commands, fences and unchanged document behavior. The existing Markdown suites also pass.
- `prose-reference-preview.spec.ts` at 600/1440 covers captured contents, outside references, no automatic disk I/O, explicit current-tree consent and preview, directory reveal, image preview and nested Escape, and no Workspace entry.
- FILES-2's original prose-preview browser contract remains green. The table fixture now provides a captured patch for its sample file; the link assertion was preserved, rather than allowing an unverified filename to become clickable.
- Affected checks: both typechecks, 43 related units and 114 browser passes / 15 existing skips, Edge, three configured workers and zero retries. The targeted native-reference check also passes at both widths after separating the exact caption assertion from its decorative icon assertion.
- The first isolated full run passed 1,229 units / one existing skip, types/build/package, 655 parallel plus 33 serial browsers / 28 existing skips, and failed three browser cases. Two native-caption checks were repaired: the caption still asserts the exact filename and range, the new icon is asserted separately, and inert native-citation styling was preserved. The third failure was toolbox-window.spec.ts:111 reading a missing animation's pause method.
- Clean-main baseline 04830c90, its own frozen install/build, Edge, three workers, zero retries: an initial four planned repetitions had one pass / three failures; a further 20 planned reproduction probes had 2 passes / 18 failures, including 6 of the exact missing-animation pause error. A standalone one-worker check then passed. No toolbox source or test was changed; this is recorded for the toolbox/TEST-2 owner, not attributed to FILES-12. Logs stay in the baseline worktree's .local/baseline/.
- Final isolated full gate on 83fe05bc (the corrected reference revision, equivalent to branch 9434be21): both typechecks, UI build, package verification, 1,229 unit passes / one existing skip, **658 parallel + 33 serial = 691 browser passes / 28 existing skips / zero failures or retries**. Units used three workers; Edge browsers used three parallel workers then one serial worker. First-run failures and baseline probes remain recorded above, not discarded.
- A subsequent small Legacy compatibility correction routes current-tree-only references through its existing reader instead of Modern's preview event. The five focused preview/native-caption checks passed, including a new Legacy regression. A genuine Codex rec_5752b823 check at 1440 confirmed zero readers before activation, an opened Legacy reader and actual contents after activation. Final typechecks, all 1,229 units / one existing skip, UI build and package verification passed again. The full browser suite was not repeated after this Legacy-only fallback; Modern's route and captured-reference behavior did not change.
