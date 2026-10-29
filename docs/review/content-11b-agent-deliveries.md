# CONTENT-11b — native collaboration deliveries

29 October 2026. Depends on CONTENT-5b PR #276; merge that first. This PR is based on its branch so its source and acceptance files are not part of this task's diff. No harness journals, settings or project files were modified. All real imports and screenshots are private scratch artifacts under `.local/`.

## Source traced

The builder's report is persisted by Codex, rather than being solely host UI. Read-only inspection found native `response_item:agent_message` records whose `author` and `recipient` exactly match the outer routing header. The visible text is a routing envelope; a second `encrypted_content` part often holds the unavailable payload. The adapter previously copied the entire visible envelope into a non-main assistant observation. The reducer then copied it into child prose, and History faithfully rendered that prose. Empty-looking envelopes therefore became visible routing shells. The two builder-reported senders account for 48 captured deliveries in the fresh selected parent: 35 encrypted-visible-empty and 13 plaintext final summaries. No journal content was printed.

The adapter now unwraps only that typed native shape with exact author/recipient matches. It preserves the actual payload verbatim, including nested or adjacent quoted envelopes. User messages, code quotations and older plain child replies retain their existing behavior. Captured delivery metadata records the native message identity and complete/partial/encrypted/empty state; ciphertext is never persisted. An identical native identity plus identical sanitized payload/state is deduplicated; a different identity with the same words, or changed content under the same identity, is retained. Restart priming also handles externalized text blobs. A child `FINAL_ANSWER` never becomes a parent completion event.

Plaintext keeps its existing child prose, source observations, replay beat and full artifact reader. The delegation thread reads that same projected message once, rather than creating a second delivery step for it. Exact-source/generation/address-matched textless deliveries add quiet availability steps. Unknown children retain their plaintext as child prose even when no exact delegation exists; no spawn, lifecycle or causal relationship is invented.

## Existing captures

Rescanning does not replace sealed observations with the same ID. Reducer r23 therefore also normalizes legacy Codex child-message previews. This is gated by the old adapter's proven mapping: it emitted a non-main assistant observation only for typed `agent_message`; normal messages always used the main identity, and ingest did not override it. The guard checks the recorded native address mapping and rejects a conflicting full captured child address. It never applies to main/user messages or Claude prose.

Legacy previews contain the exact captured payload substring. Their existing full-reader affordance opens the original captured message, including its routing wrapper, with an explanatory artifact note. Sealed observations remain unchanged. Historical empty envelopes cannot reveal whether their original native payload was encrypted: that fact was discarded by the old adapter. Their thread label says the payload is not present in captured text, rather than guessing encryption. New captures preserve the distinction.

## Whole acceptance

| Acceptance | Evidence |
| --- | --- |
| Trace native journal → adapter → projection → History | Typed native author/recipient proof above; fresh import and legacy reproject below. |
| Real Codex at 600 and 1440 px | Fresh `rec_32f628ee`, approximately 506 MB, 30,295 observations: selected exact thread has 14 steps, 8 messages, including 7 encrypted-unavailable entries and 1 plaintext message. Both widths read all 14 steps; zero raw routing wrappers in child prose, page errors or document overflow. |
| Previously imported Codex at 600 and 1440 px | A read-only backup of the prior scratch capture `rec_32f628ee`, 29,620 observations, contained 244 sealed child routing wrappers. r23 exposes 41 plaintext child messages; none retains an outer routing wrapper in its preview. Selected thread has 14 steps / 8 messages / 7 unavailable entries at both widths. The original captured artifact opens, and the 244 stored wrappers remain unchanged. |
| Real Claude equivalent at 600 and 1440 px | `rec_024517cd`, 6,516,417 bytes / 2,112 observations: exact native parent result plus companion child content; all 33 thread steps / 12 child messages read at both widths, zero page errors or overflow. No Codex routing wrappers were found in 91 scanned Claude journals. Claude's equivalent delivery is a typed tool result and companion transcript, so no fabricated Claude envelope or unsupported native capability is claimed. |
| Nested/quoted, adjacent, multiline, long, empty, duplicate and unknown-sender cases | Adapter regressions preserve nested/adjacent captured payloads and exact leading user quotations. Native-ID duplicates, conflicting-ID content, distinct repeated messages, empty/encrypted/partial states, unknown senders and restart/blob priming pass. Daemon regressions read a complete long-message artifact and preserve unresolved child findings. |
| Child ownership, no parent final answer or fabricated lifecycle | Fresh fixture has one actual user turn, child-owned prose and no child-completion step or parent outcome inferred from `FINAL_ANSWER`. Thread plaintext is not appended again by the availability helper. |
| Already stored captures upgrade without destructive reimport | Regression reopens an r22 cached projection under r23, checks normalized child text, untouched leading user quotation, exact original sealed observation bytes and original full artifact. |

`pnpm check:real -- agent-delivery` is the reusable default-size scan/import/count check. The default 90 MB ceiling omits the large parent. The expanded run, `node scripts/check-real.ts agent-delivery --max-mb 600 --pick 3`, checked three genuine Codex parents: `rec_32f628ee` (about 506 MB / 8,177 operations), `rec_428a053a` (7.3 MB / 424 operations) and `rec_0de01fe5` (9.1 MB / 401 operations). Their 306 native child deliveries include 44 readable plaintext messages; all 44 reach child prose without outer routing wrappers. The other two parents contain 18 and 11 unavailable-visible deliveries. Source journals were live and grew during the scan; sizes/counts are snapshots, not fixed fixtures.

## Checks and boundaries

- `pnpm check:affected`: both typechecks, UI build and 336 related unit tests passed (1 skipped). The initial browser attempt could not start because the default downloaded Chromium executable was absent.
- Final focused pass after the legacy helper: both typechecks and 108 adapter/projection/delegation tests in 17 files passed.
- Nine targeted browser checks pass using the installed Edge channel, including the two new 600/1440 cases, delegation thread/result and agent inventory. A concurrent packaging rebuild initially removed `dist/index.html` during a browser navigation; the corrected sequential run passes. The new test also tolerates an already-restored expanded card.
- `pnpm package:verify` passed for the adapter/thread changes: isolated offline install, both-harness imports, authenticated API and persisted restart. The final integrated batch gate, including the r23 projection change, belongs to the root's isolated batch worktree and must be recorded separately.
- Actual fresh and legacy Codex plus Claude viewport checks pass. Screenshots were inspected locally and remain uncommitted. No synthetic fixture is counted as native acceptance.

Textless deliveries do not invent replay beats; their availability follows the existing captured source-rank cutoff and is visible in live history. The original pre-upgrade capture cannot recover discarded encrypted payload metadata or native delivery IDs. Sealed legacy raw evidence remains available through the intentional full captured-message reader; it is not displayed as ordinary conversation. No schema, turn ledger, History component, store migration, observer policy or native-controller change was made.
