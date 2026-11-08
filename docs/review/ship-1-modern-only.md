# SHIP-1 — Modern-only Release 1 entry

Work in progress in PR #369, branch `codex/ship-1`. Yash approved up to32 paths and narrow overlap reservations on8 November. Original claim: b57bcd9f; footprint agreement: dc0ee80d; section reservation: ce546446. One whole item; no composer/Toolbox/design migration. FINISH is paused and UI-26 deferred by release-1-scope.md.

## Runtime acceptance already measured

- Main imports only Modern. Version resolvers ignore old query parameters, persisted choices and the old developer flag. Settings contains five ordinary categories; no version panel. Clarity's source remains archived, outside the product entry graph.
- Version resolver units:2 pass. Migration/browser artifact guards:4 pass. Built JS has no chooser strings. `package:verify` passes (isolated offline install, synthetic both-harness imports, API/restart).
- Genuine native scratch reviews: Claude Code `rec_ab67986c`,451820 bytes,9 operations/8 prose; Codex `rec_2dcde4d9`,248572 bytes,7 operations/6 prose. Both at600/1440: Modern, five Settings categories. They are genuine harness captures; no new native model call was needed for this presentation-only task.
- Frozen before/after history screenshots: all four same-sized pairs have **zero changed pixels** (600000 or1440000 pixels per frame). Screenshots stay in `.local/ship1-proof/`; no private content is published.
- Packaged CLI, not only checkout Vite:12 successful checks across fresh/existing scratch homes,600/1440, stored Classic/Clarity plus retired URL/developer flags. Existing homes include both genuine recordings above. Every case opens Modern and five Settings categories without chooser wording.
- `pnpm check:real -- person-prompts` also completed on scratch imports: Claude `rec_c8e5c9c8`,83.7MB/2695 operations; Codex `rec_fa9e37da`,39.2MB/459 operations. Count/rail checks pass. These complement, not replace, the actual packaged UI cases above.

## Test migration and boundaries

Old version-only cases are retired where their surface no longer exists: retained-version navigation/picker, Legacy crown/dock filter composition, Classic rail/palette composition, retained-UI never-fold, Legacy-only visible Copy chrome. Their Modern counterparts remain in modern-only, tools-trail, palette/typography, repository navigation, turn-fold and workspace-source-controls. Generic evidence/source/Git/notes/recovery journeys are retargeted to existing Modern names and action menus. No product behavior is changed to make those tests pass.

Yash reserved only the Legacy/Modern comparison in fresh-workspace and retired-version/Home/Files selectors in connected-workspace; UI-28 retains all composer behavior/assertions. That source file still contains Legacy composer expectations such as `.composer-target`, direct workspace-approval controls and the removed harness label. Those are **UI-28's external test migration dependency**, not permission to edit its composer behavior here. Do not claim an all-green full gate until the owner updates them.

Own remaining checks: finish independent selector migrations, run the named/affected checks, package once more after source freeze, update this report with actual results, then tick/remove the SHIP-1 claim. No release-candidate packaging before13 November; current package builds are SHIP-1 verification only. Never edit workspace-shared-draft.spec.ts or PROJECT_MASTER_DESCRIPTION.md.
