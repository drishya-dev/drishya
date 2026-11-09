# SHIP-12 — open plan evidence and scoped acceptance

9 November 2026. [PR #373](https://github.com/drishya-dev/drishya/pull/373). Tested product source: `d84f8cb797f8fb5ee52217811f0652cb08a7d478` (after `cd4d1c40`, incorporating main). **Implementation and scoped checks pass; the full task acceptance remains open for the native capture gaps below.** Shared TASKS/STATUS completion belongs to the release coordinator.

`PlanChecklist.tsx` renders every available item of each captured checklist revision without a plan disclosure or item-limit disclosure. Saved collapsed preferences no longer participate. Existing comparisons, captured statuses/identities, omitted-evidence labels, document/artifact access and replay cutoffs stay in their existing owners. Changes and removed items appear inline. Lists, removed-item evidence and documents retain the 360 px reading bound. The focused specs cover thirteen revisions, duplicate and unknown statuses, long lists/removals, document proposals, persisted preferences, keyboard revision navigation, replay boundaries and passage geometry.

The final navigation correction is limited to History's existing target-positioning effect. Its first stage scrolled to the requested passage and returned unconditionally. When the target was already mounted in the first passage and the scroll position was already zero, that write changed no viewport state; no further render positioned the selected action. Fully open earlier lists made the latest checklist fall below the viewport. The numeric diagnostic recorded only one scroll write, `[0]`, with the target in slot zero; its top stayed at 1086.89 px at width 600 and 967.89 px at width 1440, against a 960 px viewport. The requested and focused operation IDs matched. Removing that return positions an already mounted target immediately; the existing missing-node return still waits for an unmounted virtual passage. Cancellation, paging, reading anchors and motion code are unchanged.

## Scoped verification

All browser commands used three workers, zero retries and retained failure traces. The UI was rebuilt first. Windows TEMP/TMP were normalized with `realpathSync.native(tmpdir())` in the local runners.

| Check | Observed result | Private local evidence |
| --- | --- | --- |
| Initial five plan/passage specs | 31 passed, 2 failed: unchanged `Go to checklist` viewport assertions at 600/1440 | `.local/ship-12/phase2-20261108-browser-1/` |
| Navigation diagnostic before fix | Both viewport assertions failed; exact target and zero-scroll cause recorded | `.local/ship-12/nav-diagnostic-1/`, `nav-diagnostic-2/` |
| Same two assertions after fix | 2 passed | `.local/ship-12/nav-fixed-1/` |
| UI typecheck | Exit 0 | `.local/ship-12/phase2-nav-fix-20261109/ui-types.log` |
| Four related scene/projection/capture unit files | 38 passed, zero failures | Same directory, `plan-units.log` |
| UI production build | Exit 0 | Same directory, `ui-build.log` |
| Eight named plan/navigation browser specs | 42 passed, 1 existing skip, zero failures/retries; 47.5 seconds | `.local/ship-12/phase2-nav-fix-20261109-browser2/` |

The eight specs are `plan-checklist`, `plan-living-acceptance`, `plan-mode`, `plan-label-identity`, `passage-layout`, `reading-keys`, `tools-trail` and `turn-fold`. The existing skip is the opt-in real-store reading-key test, whose explicit store/recording inputs were not supplied. Temporary numeric diagnostics were removed; no assertion, timeout, retry or skip was changed to make these runs pass.

A preceding broader-run invocation failed before executing tests because its shell runner split an absolute artifact path containing spaces (`EPERM`/`EEXIST`). That run remains in `phase2-nav-fix-20261109/`; the corrected invocation uses a relative output path. It is a runner failure, not a claimed product flake.

The integrated full gate was not run under this task's scoped/real token. The coordinator owns that separate release-batch gate; these results do not certify the complete browser suite or package verification.

## Genuine local acceptance

Sources were opened read-only and imported through the normal redacting ingest into scratch Drishya homes. Real journal text, source paths and screenshots remain private under `.local/`; none is committed. Screens were inspected at 600 and 1440 px. Each source was checked at two completed revision boundaries and in ordinary History, without a Show/Open plan click. Checks compared mounted items/statuses and inline change counts with the captured projection, checked the reading bound and measured horizontal overflow.

| Genuine source | Bytes | Projected material | Measured cases at both widths |
| --- | ---: | --- | --- |
| Claude `6a246dc5` / recording `rec_cd1c02bf` | 1,016,053 | 57 operations; 2 controller `mcp__ccd_turn__update_plan` revisions | Both 4-item revisions open; 2 inline changes on the update; ordinary History open; list height 109 px; zero horizontal overflow |
| Claude `ecdd7477` / recording `rec_bbff36ac` | 24,459,453 | 248 operations; 47 native task list revisions | Last two 19-item snapshots sampled; 1 inline change on the update; ordinary History open; 360 px list height with 522 px scroll extent; zero horizontal overflow |
| Codex `01a1be54` / recording `rec_d3817675` | 255,749 | 2 captured proposal documents | Genuine native proposal and resumed revision: 12 then 13 Markdown items; ordinary History open; 360 px document height; zero horizontal overflow; no checklist completion inferred |

Final evidence is in `.local/ship-12/real-claude-history2-20261109/` and `real-codex-20261109/`: numeric manifests plus 18 private screenshots. The two sampled native task snapshots do not claim a visual walk of all 47 revisions.

The Codex proposal was generated by the installed native CLI in a throwaway directory, using its normal read-only sandbox and normal persisted journal, then resumed for the revision. Both native commands exited zero. No native policy, configuration or credential changed; no journal was fabricated from stdout. The initial probe's response also explained that native `update_plan` was unavailable; the genuine proposal is evidence for documents only.

Two earlier local real-screen probe failures are preserved. One addressed a proposal at its operation start before its captured result existed; the corrected probe addresses the completed result boundary. Another waited for a virtualized offscreen plan card before navigation; the corrected probe waits for mounted History and uses its normal reading-navigation event. Neither required a product change or a longer timeout. Their local evidence remains in `real-acceptance-20261109/` and `real-claude-history-20261109/`.

## Acceptance still blocked or unmeasured

- The real scan found 27 Claude sessions and 741 relevant calls: 694 controller plan calls and 47 native task calls. A tool-name audit found **zero native `TodoWrite` calls and zero Claude plan-mode/file documents**. These captures cannot be relabelled as native TodoWrite or plan-mode acceptance. The Claude CLI is absent in this environment; account-dependent genuine captures remain delegated to Yash under the release task instructions.
- The existing `check:real -- plan-material` selected recording `rec_a7e9af7d`, 28.3 MB, with 87 projected list revisions from 168 calls and zero documents; it found no Codex plan-tool case. That scanner counts tool calls, so the separately generated genuine Codex proposal acceptance above is recorded independently.
- No genuine native Codex `update_plan` capture was available. The installed native CLI reported that tool unavailable. Proposal documents do not prove its checklist/update path. Synthetic native `update_plan`, TodoWrite and plan-mode regressions pass, but remain regression guards.
- A full batch gate and the human freeze/truth/ten-minute acceptance are not certified here. Do not tick SHIP-12 complete from this report alone.
