# CONTENT-18 — person-only prompt counts

## Cause and scope

Claude Code journals some background-task notices, slash-command echoes, command output, interruptions and reminders in the user role. Existing History presentation recognises them, but the prompt rail and overview counted every turn anyway. Codex typed collaboration messages already become assistant prose; spawned-agent delegation prompts are already excluded by the reducer. Neither needs to become a new prompt.

One shared `isPersonPrompt` predicate now builds on the existing exact-leading-shape classifier in contracts; UI imports retain their old entrypoint. Unknown shapes, ordinary mentions, literal routing text and image-only prompts remain prompts. No journal, projection turn or passage is removed, moved or renamed. No event schema or visual design changes. Look remains FINISH-3.

The rail, overview/export totals, replay prompt markers, previous/next-prompt navigation, Home's current-prompt facts, Changes and Git prompt attribution use the shared predicate. Usage and Home's native runtime statistics are captured harness facts, not recomputed prompt counts. Search preserves native turn numbers when the harness records them; its fallback prompt numbers exclude notices and count multipart image-only records once.

The real paged session exposed an additional bug: off-screen turn previews are clipped before reaching History. Their distinguishing fields can be beyond that prefix. Scene composition now derives `personPrompt: false` before clipping and the worker retains it. Default golden scenes are unchanged. Existing passage, folding, ledger, scrolling and motion boundaries remain intact.

## Acceptance so far

- Genuine Claude Code `rec_c8e5c9c8`: selected file 83,716,730 bytes; two evidence-linked journal files in the joined view; 13,075 observations, 373 retained turn entries, 293 person prompts, 80 notices (10 background tasks, 33 slash-command echoes). An independent role/shape count over the journal lineage also finds 293 person prompts. Rail last ordinal, `Prompt 293 of 293`, and overview count all agree at 600 and 1440 px. A background notice still renders at its captured position at both widths.
- Genuine Codex `rec_7afaca02`: 11,984,727 bytes, 593 observations, four agents, six native sub-agent deliveries, one person prompt. Independent raw role/shape count, rail `Prompt 1 of 1` and overview agree at 600 and 1440 px. Collaboration does not add prompt ticks.
- Sources imported into the task's ignored `.local/real-home`, never the real Drishya home. Private source manifests, screenshots and browser diagnostics remain in `.local/` only. No journal text is quoted here.
- `pnpm check:real -- person-prompts` imports a matching case for each harness into its own temporary home and checks canonical prompt and marker totals.
- Synthetic regressions cover known versus unknown wrappers, text merely quoting a wrapper, image-only and multipart image prompts, retained passage contents, search fallback numbering, overview counts, marker/navigation destinations and classification retained after worker-style clipping. Existing notice rendering assertions remain; browser regression additionally checks two person ticks and `Prompt 2 of 2` at both widths.

## Check record

Initial focused checks: both typechecks; 179 relevant units; four named browser checks passed (Edge, three workers, zero retries).

Initial affected run: related units had three 5-second daemon timeouts under concurrent real-session import and two genuine regressions from replacing native turn numbers with prompt numbers in search. The native-turn behaviour was restored, retaining only person-prompt filtering for the fallback. Both regressions and the new count tests passed the focused follow-up. The initial failed log is retained; the timeouts are not claimed fixed.

Final frozen-revision verification (`c844a060`, own `.local/wt-content18-gate` checkout and frozen install): `pnpm check:affected` passed both typechecks, 630 related units / one existing skip, UI build, 659 parallel plus 33 serial browser checks (692 passed; 28 existing skips), Edge three parallel workers / one serial worker, zero retries. Package verification passed its isolated offline install, both imports, authenticated API and persisted restart. All-unit run of the same source revision passed 1,230 tests / one existing skip.

Main gained FILES-12 / #357 during this run. Merging it into this branch required resolving only the check-real registry; both case registrations were kept. On combined revision `ef0afe74`, both types, all 1,235 units / one existing skip, UI build, all eight named notice/table/citation/file-preview browser checks (Edge three workers, zero retries), package verification and all four genuine 600/1440 viewport journeys passed again. The full browser gate was not repeated after that integration; the conflict resolution changes the case list only, and the actual incoming file-preview integration was tested. No full-gate result is claimed for an untested combined revision.

CONTENT-18 acceptance is complete; PR #361 is ready for other-builder review, not merged. The initial red affected command and its stopped obsolete browser continuation remain recorded in `.local/affected.log`; final isolated evidence remains in the gate checkout's `.local/`.
