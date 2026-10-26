# CONTENT-1 — current-image recovery and genuine typed references

26 October 2026, PR #240. Independent current-file image correctness; not the captured-byte reader repair in #214. Parent CONTENT-1 remains open for its broader source/current-reference and physical acceptance.

| Before | After | Why |
| --- | --- | --- |
| A denied current-file image read replaced the only action with an error. Even after workspace approval the card required a reload. | The same card exposes an explicit Retry current file action after refusal. | Recovery should remain available without discarding the developer's reading position. |
| The access probe could succeed, then the separate image request could fail or return invalid bytes without explanation. | Load/decode failure removes the broken image, announces an explicit unavailable state and allows deliberate retry. | A successful access check does not prove later image delivery succeeded. |
| Async completion and image errors had no explicit owner/request qualification. | Local owner includes source, recording, operation and path; responses and image callbacks are ignored after ownership/request changes. | An older response must not change a newer selected recording/file. |

## Reproduction and checks

- Built baseline fails consent recovery: after 403 and later approval, no retry action exists. The prior test reloaded the page to recover; the new regression deliberately does not reload.
- A second built-baseline reproduction passes the access probe, then returns 404 for the image GET: no explanatory status exists. Corrupt image bytes exercise the same missing decode-failure boundary.
- Four new browser cases pass: consent/refusal recovery without reload; later image 404; corrupt successful image response; and a delayed old-recording refusal after a different recording image loads. Missing/corrupt cases prove no automatic retry requests occur, and that the **same current URL** recovers to valid pixels after an explicit click. The current endpoint's no-store behavior suffices; no retry query, blob URL or new network capability is introduced.
- **18 focused image browser checks pass**: four new cases plus 14 retained captured/path reader checks. They retain lazy captured thumbnails, fit/actual-size two-axis reading, focus return, 320/390/landscape containment, explicit captured-byte retry and zero remote fetch behavior. UI TypeScript and the worktree's production build pass. Root runs combined full-unit/type/build verification once; no duplicate full suite or hosted CI started here.
- No CSS or motion change. Existing flat text action treatment is reused; no new resident toolbar. Installed emil-design-eng guidance informs recoverability and explicit state feedback.

## Genuine Codex ImageView evidence

A read-only scan of the four currently present local Codex journals parsed **30,927 records** and found **596 actual `event_msg:item_completed` items whose `item.type` is `ImageView`**, distributed 183 /253 /70 /90. These are parsed event items, not mentions inside instructions or tool definitions. Item keys in the sampled records are `type`, `id`, `path`.

The first sampled path in each file is a **file: URL**. URI-aware native-path conversion confirms those four files currently exist. An initial `existsSync(rawURI)` diagnostic was invalid for filesystem availability and was corrected; it must not be reported as a missing-file finding. The tested first reference points into `.local`, whose material remains protected/unavailable through the current-file route; no permission or path policy was changed to make it load.

A clearly labelled **two-record real-source excerpt** (original metadata plus original typed item, redacted before scratch persistence/import) was ingested into an isolated local store and checked at **1440 and 390 px**. It renders a genuine typed metadata-only image operation, keeps `image bytes not captured`, explains the initial consent refusal, offers retry without reload and continues to refuse the protected/unsupported original reference after approval. No img is fabricated or remotely loaded; zero page errors or external requests. The phone card was inspected. This verifies genuine typed-reference presentation/refusal, **not captured-image bytes, successful native-path recovery, full large-journal performance or full-session ImageView acceptance**. No native turn, harness config, original project/journal write or shared store mutation occurred. Sources, excerpt, counts and screenshots remain ignored local files.

## Handoff

Only `OpImages.tsx`, the dedicated browser regression and this report changed. Parent integrates TASKS/STATUS centrally to avoid parallel docs collisions. No History/common/SessionWorkspace, capture/schema/adapter/projection/DATA-3, controller, backend, shared/Modern CSS or other claimed surface changed. PERF-2/3 remain deferred. Root may mark this bounded correctness/typed-reference acceptance checked; successful allowed current-image recovery from a genuine typed file URL, all remaining source permutations and physical-phone acceptance remain separate open scope.
