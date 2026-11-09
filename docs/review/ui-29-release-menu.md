# UI-29 — Release 1 session menu contents

8 November 2026 · [PR #376](https://github.com/drishya-dev/drishya/pull/376) · runtime freeze `6be31354`.

The 8 November TASKS note defines the menu contents. This change implements those contents in Modern, using the existing components, classes and tokens. SHIP-2c still owns visual finishing. It does not change the Usage schema or resolve #344's pending agreement.

## Kept, moved and removed

| Before | After | Why |
| --- | --- | --- |
| Session details, Usage, Notes, Navigate history and Export recording | Retained with their existing handlers | These are the named product actions in the builder's note. |
| Screen | Retained only when captured frames exist | An unavailable screen is not a useful menu action; the existing evidence-based guard remains unchanged. |
| Replay this session in the normal menu | Developer mode only | Replay is a developer tool; normal history already shows the work. The playback engine and explicit replay links remain available. |
| Use this session as local preview / Open local preview | Developer mode only | These select a local development preview, rather than advance the user's session work. No reference or captured content is deleted. |
| Rescan original journal under Share | Inside Session details | Rescanning maintains the source recording; it is not an export/share action. Availability, errors, busy state and completion feedback are retained. |
| A since-last-view mark among Modern navigation actions | Removed from this menu | Release 1's explicit menu list excludes it; SHIP-4's re-entry direction was withdrawn. Other history and Follow controls remain unchanged. |
| Token and work/cost rows always expanded in Usage | Under the initially closed Token details disclosure | Limits and Context lead. Detailed accounting remains available rather than competing with context capacity. Explicit disclosure choices persist through the existing owner. |
| Native runtime · last model request / connected turn, and its token/cost/context rows | Removed from this surface | This is the specific secondary accounting block the builder found unhelpful. Recorded Limits, Context and token details retain their source boundaries; native execution and its receipts are untouched. |

The removed native-runtime block's exact field labels were **Input tokens**, **Output tokens**, **Cached input**, **Cost · harness estimate**, **Context input**, **Context window**, **Thread tokens so far** and **Reasoning output tokens**. This removes the duplicate runtime display, not the controller's receipt or the separately sourced recorded token/cost values available in Token details.

The existing contextual Back to reading / Review new activity / End investigation actions and evidence-backed newer-session links remain unchanged. They are conditional workflow state, not new permanent rows; the November note did not authorize deleting their existing journeys.

Developer tools require `?devtools=1` or `localStorage['drishya-dev-tools']='1'`. This switch does **not** restore a UI-version chooser or Clarity. Ordinary product URLs, `?demo`, `?demo=local`, `?versions` and saved preview references do not themselves enable these menu entries. A unit covers this distinction.

## Acceptance on real sessions

Imports used scratch Drishya homes and normal redacting ingest. Native journals were not changed. Screenshots are private in `.local/`, and no journal content is included here.

| Harness | Recording prefix | Source bytes | Observations | Widths | Recorded Usage bars |
| --- | --- | ---: | ---: | --- | ---: |
| Claude Code | `rec_da884068` | 7,230 | 6 | 600 / 1440 | 7 |
| Codex | `rec_f696d8c1` | 176,796 | 15 | 600 / 1440 | 2 |

At all four widths/views: default replay/preview entries are absent; Notes and export remain reachable; the menu fits at rest; Limits and Context are visible before Token details; the native-runtime block is absent; Token details opens; Rescan is available only inside Session details and completes through the genuine source route; Navigate history opens; outside click closes the menu; there is zero document overflow and no runtime error. Claude's genuine `/context` report remains seven bars, and Codex's recorded primary-window/context values remain distinct. Secondary-window integration still belongs to #344.

The initial private real-session script matched both an empty copy-status span and the rescan status. Its strict locator was corrected to select the rescan completion, without a product change. The final genuine checks pass.

## Verification

- Own worktree, own frozen install; both typechecks and production build pass.
- 24 targeted browsers pass / one existing opt-in store-copy skip, using Edge with three workers and no retries. This includes the product menu, recorded usage, explicit developer replay, replay/composer isolation, paged history, cross-mode file reading and adaptive content.
- All 1,271 units pass / one existing skip with three workers.
- `package:verify` passes before browser work starts: offline install, both-harness import, authenticated API and persisted restart.
- `pnpm check:real -- turn-details` passes its existing genuine accounting/turn checks: Claude `rec_c8e5c9c8` (83.7 MB, 2,695 operations, 20 accounting records) and Codex `rec_7cb1cda1` (15 MB, 1,115 operations, 20 captured turn endings). The four UI acceptances above use the smaller genuine Usage-specific sessions.
- `check:affected`: both typechecks and the related unit pass; production UI is rebuilt before the browser run. Parallel: 663 passed / 27 existing skips / two Usage-selector failures. Serial: 29 passed / one existing skip / three pre-existing motion failures. Edge, three parallel workers and one serial worker, no retries. The command is honestly recorded as red, not a clean whole-product gate.
- The two selector failures are corrected with the single direct-summary selector below; both width cases pass in a focused rerun. No product source changed after the frozen run.
- All three motion failures reproduce on independently installed/rebuilt clean main `ea555312`: `material-motion:132` (expected hover containment true, actual false), `p1-pacing:40` (expected zero pending-request animations, actual three), and `p1-pacing:266` (expected one map tether, actual zero). These match SHIP-1's recorded findings. No motion, scroll or assertion fix is bundled into this contents item; preserve the failures for MOTION-3/TEST-2.

Private evidence is in `.local/real-menu-final.log`, `menu-regressions.log`, `all-units.log`, `package-verify.log`, `affected.log`, `plan-menu-rerun.log` and `isolated-motion.log`. Clean-main comparison: the separate main worktree's `.local/ui29-baseline-motion.log`. Neither run uses retries or amended assertions for those motion checks.

## Merge boundaries

`Viewer.tsx` changes only the Crown menu choices and SessionIdentity's rescan placement. It does not touch FINISH-0c loading, compose/query or MOTION-3 history work. `RecordedUsage.tsx` changes presentation contents and rescan's comment only; no adapter, schema, usage parsing, request or limit calculation changes. Workbench/local-preview changes are confined to the explicit developer gate.

The broad run found two strict-selector failures in `plan-living-acceptance.spec.ts`: the old `.usage-peek summary` now also matches Token details. The only change to that shared plan spec is **one selector**, `.usage-peek > summary`, for the existing Usage click. Both width cases pass unchanged after that correction. Preserve all of Harsh's SHIP-12 plan assertions and edits when merging; none of its plan behaviour is changed here.

Yash approved up to 20 paths on 8 November to update all affected checks. Eleven existing browser files need either explicit developer access or a selector/content update for the changed menu. Each affected developer journey opts in immediately before opening that menu. No global browser fixture enables developer mode, and the default-menu checks explicitly verify those entries are absent. No playback, scrolling, consent or attachment assertion is weakened. The claim, TASKS tick and continuity record close in this same PR; no merge is authorized here.
