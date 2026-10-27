# CONTENT-1 — full source review and remaining image-only turn dependency

26 October 2026. PR #249. Desktop scope is 600 px and wider; phone acceptance is superseded by the builder's desktop-only decision. This completes the owned image-reader, current-reference, adapter-alias and exact script-result work. **CONTENT-1 remains open for one actual Claude image-only prompt that the reducer and History do not present.** Those files remain with Claude/DATA-3; the coordinated handoff is below.

| Before | After | Why |
| --- | --- | --- |
| A genuine Codex `ImageView.path` containing a local `file:` URL was refused even after approval, although the file existed inside the captured workspace. | Decode a local file URL exactly once before the existing approved workspace reader. Spaces and `#` filenames recover correctly. | Native harness references must work without relaxing approval, root, protected-path, signature, size or symlink checks. |
| Current files stopped at a small preview. | The preview opens the existing fit/actual-size reader, with keyboard focus return, two-axis scrolling and a visible current-file warning. | Full-size reading is useful only when today's file remains clearly distinguished from captured pixels. |
| Actual `Extension.kind = image_gen.generation` items became unknown observations; only the older `image.generation` spelling was accepted. | Both spellings retain the existing generated-image metadata and consented current-file fallback. | Six real generated references were being silently lost; no captured bytes are invented from their paths. |
| Remote Codex `input_image` URLs disappeared completely. | Retain an omission-only image marker saying it is a remote reference and is never fetched automatically. | The absent image should be explained; neither its URL/query credentials nor bytes need to be persisted or fetched. |
| Captured images attached to a `functions.exec` script disappeared from the reading surface when typed child operations replaced that script in passages. | The existing child → Script disclosure renders all of the exact parent's images alongside its original material. | The result belongs to the parent script. A child relationship does not identify which individual image belongs to which nested call. |
| Protected, outside-workspace and network references could read as a generic failure. | Explain protected/outside refusals; render remote path references inertly; refuse UNC references before asking `realpath` to contact a share. | Refusal must be truthful and must not initiate network reads. |

## Full original-source acceptance

All four journals were imported whole through normal redaction into an isolated private Drishya store. Original journals were opened read-only. Scratch sources, stores, scripts and screenshots remain under ignored `.local/`. Source content and screenshots are not committed. Per-worktree dependencies were installed in isolation after discovering that the initial dependency junctions resolved adapters to the original checkout; the final imports and checks below use this branch's own source.

| Actual source prefix | Journal size | Observations | Operations | Captured tool image references | Persisted prompt image references | Distinct image blobs served |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Codex `01a11620` | 57,913,276 bytes | 2,284 | 757 | 94 across 43 operations | 3 | 93 / 93 |
| Codex `01a14f2e` | 44,016,822 bytes | 1,530 | 542 | 72 across 27 operations | 0 | 69 / 69 |
| Claude `cf751266` | about 83 MB | 10,466 | 2,215 | 99 across 99 operations | 13; **12 presented** | 108 / 108 |
| Claude `b230c16b` | about 20 MB | 2,822 | 698 | 31 across 29 operations | 0 | 31 / 31 |

- **301 distinct blobs** were fetched from their recording-owned image endpoint with `nosniff`; all were available. Repeated images deduplicate, so blob totals are not attachment totals. The single orphan Claude prompt blob is among the served blobs; serving does not establish presentation.
- **Eight captured-image reader journeys** (one representative tool result per source at 600 and 1440 px) verify fit/actual size, containment and focus return. Both Codex journeys follow an actual child → expanded Script → exact parent images. Before this repair all 43 image-bearing parents in the 58 MB source were absent from passages; 24 of 27 were absent in the 44 MB source. Their captured image arrays are now reachable under the existing Script relationship, without copying them onto children.
- **Four prompt-image journeys** verify the actual Codex and Claude attachments at both desktop widths. The actual-source count discrepancy below is explicitly excluded from that presentation claim.
- **Two genuine allowed current-image journeys** use the real 44 MB Codex `ImageView` reference at both widths. Baseline production UI reproduced an approved failure; the fixed UI loads the actual file and reader, preserves `image bytes not captured`, and labels the current file as potentially different from the agent's view. Existing files and references were used unchanged.
- All **90 and 70 typed ImageView references** in those Codex sources project as metadata. An actually missing in-workspace reference from the 44 MB source produces the explicit missing-file state in the running UI.
- The alias fix retains **four and two actual generated-image references**. All six current-file reads return 403 because their saved paths are outside their respective captured roots, even after successful workspace approval. A representative from each source displays the explicit refusal in the running app. They are metadata/current references, **not recovered captured image bytes**. An invented in-root generation fixture proves the allowed fallback independently.
- Claude actual Read/tool-result and shell-returned image paths are covered by the two full-source imports. No relationship between a shell-written file and another image is inferred from timing or filename proximity.
- Zero external browser requests in the complete four-source reader matrix. Remote, corrupt-byte, expired-byte and later-network-failure cases are synthetic fault injections; no actual remote-image or expired-blob source is claimed. Actual missing-file and generated outside-root refusals are independently checked above.

## Checks

- Both TypeScript projects and the production UI build pass using isolated dependencies.
- Eight focused units pass: daemon image persistence/serving, current-file/path security, generated aliases and retained adapter typed-item fixtures.
- Twelve focused desktop browser checks pass: ten in `image-sources-desktop.spec.ts`, plus the retained captured-image and path-only-image cases. They cover 600/1440 fit and actual-size scrolling; focus return; generated fallback; mixed exact text and images; remote omissions and no external fetch; all parent images across two different children; expired/404, corrupt and network failure with deliberate retry; and disappearance between current-file probe and image GET.
- URL security units cover approval before recovery, outside/protected paths, malformed encoded separators, credentials/remote hosts, query/fragment refusal, one-time decoding, raw UNC refusal and canonical `localhost` file URLs (which still pass all local workspace checks). Existing symlink refusal remains unchanged.
- Remote URL/query markers are absent from persisted observations and exported bundles; the honest `remote` omission survives export. Image bytes remain excluded from bundles by the existing export policy.
- No hosted CI or broad browser gate was started. Root performs the combined source gate. No schema/contracts, projection/reducer, History, Reader or Workspace changes are included.

Reproduce the committed focused gate with `pnpm typecheck`, `pnpm ui:build`, `pnpm exec vitest run apps/daemon/test/images.test.ts apps/daemon/test/path-images.test.ts packages/adapter-codex/test/items.test.ts`, then `pnpm exec playwright test tests/browser/image-sources-desktop.spec.ts tests/browser/captured-images.spec.ts tests/browser/path-images.spec.ts` using the locally available browser channel.

## Remaining coordinated dependency: image-only prompts

**Actual discrepancy:** `cf751266` contains 13 persisted `message.user` image parts. One record has an image and **no text part at all**; only 12 images appear on timeline turns. This is a presentation/projection gap, not missing bytes. The other 12 retain their prompt pairing. CONTENT-1 must remain unchecked until this is repaired and verified.

Insertion points for Claude, who owns the held files:

1. `packages/projection/src/reduce.ts`, `case 'message.user'` (currently around lines 436–460): empty-text image parts enter `pendingTurnImages`, then `if (!t.trim()) break` prevents a turn forever when the same record never supplies text. Preserve one image-only main-agent turn at its own captured position, while still coalescing image-first/text-first parts of the same record into one turn. Do not give image-only records invented captured prose or a misleading session title. Keep subagent prompts excluded and preserve deterministic append/paging behavior.
2. `apps/ui/src/components/History.tsx`, `PassageView` (currently around line 722): the `ps.turnPrompt && <TurnBlock ...>` guard suppresses an image-only turn even if the reducer retains it. Accept captured `turnImages` without requiring prose; pass an empty string rather than inventing captured prompt text. Scene already carries `turnImages` independently.
3. Add image-first, text-first, no-text, multiple-image and subagent unit cases, the existing composer goldens/reducer-version handling, and a 600/1440 real-source check showing **13 / 13** Claude prompt images. Verify live append and a text-bearing prompt still produce one turn each. Review any broader turn-ledger interaction with DATA-3.

No parallel queue or competing patch was created. This is the precise remaining CONTENT-1 integration dependency, coordinated with the builder and root; it is not claimed fixed by this PR.

## Existing recordings need deliberate re-import

A rescan rewinds the same source generation. Observation identity is based on source/generation/offset/part, and stored observations are immutable/deduplicated. An older unsupported generated item already occupies the future supported item's observation ID as `unknown`; old prompt/result observations likewise already lack remote omissions. **A reducer rebuild or ordinary rescan cannot replace those observations.**

To recover the newly supported generated aliases/remote markers, forget the old recording in Drishya and import the original read-only journal again, or import it into a fresh Drishya data directory. This removes/recreates Drishya's recording only; never edit or rewrite the native harness journal. Reconfirm current workspace access when reading today's files. No automatic backfill or historical image-byte reconstruction is claimed.

Parent's combined source gate on image source `47495b7` plus the independent reader/browser-owned changes also passes: **852 units / 149 files, both TypeScript projects, production build and 17 new image/reader browser checks**. Seven browser-integration checks are explicitly skipped pending the separate Claude History integration; they are not passes. Independent source review reported no actionable finding. Shared TASKS/STATUS completion state remains centrally managed, with CONTENT-1 open for the image-only turn dependency above.
