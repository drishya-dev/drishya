# AG-4: images, native artifacts and recorded thinking

14 November 2026. PR #479 targets `codex/harness-antigravity`; no product PR was merged by Codex. Fable reviews. This task is stacked on AG-1 #469, AG-2 #472 and the frozen AG-3 implementation #474. Merge those dependencies first; their changes are not additional AG-4 scope. AG-3's genuine isolated native-process-interruption acceptance remains external and unticked.

## Behaviour and provenance

- Explicit image references in a conversation's allow-listed image locations are copied read-only, validated by signature and limited to 4 MiB each. Pre-seal candidates are bounded; the store still enforces its 256 MiB session image budget. Outside/private/linked locations are refused, never fetched. Missing or changing bytes carry an omission reason.
- A validated path is not sufficient: the open is read-only/no-follow where supported, and pre-open, opened-handle and revalidated-path inode/device identities must agree before bytes are read. Deterministic directory-swap regressions assert zero reads of the substituted file.
- Six native PDF references were found during acceptance. They remain references plus an explicit unsupported-content gap; their bytes are not read and they are not portrayed as images. PDF presentation is AG-5, not silently claimed here.
- Actual artifact-write calls keep their native operation and tool name. Captured input is a plan document; it is not a repository write or map location. Explicit resolved references normalize to their base artifact for association, retaining the recorded path.
- Additive normalized `artifact.plan` observations describe file evidence, not invented tool invocations. File versions associate only by the captured operation/path/name reference; the reader says this does not prove cause. Numeric versions retain numeric order, unknown dates stay unknown, and checklist statuses are derived from literal Markdown markers outside fences.
- Current files are not backdated into a journal import. Disk versions are observed after backlog catch-up and completion of the referenced native write. Replay keeps captured call input, native result and later file observations at their own boundaries. Numeric native ordering is retained in observation IDs; monotonic per-file transition identities preserve A-to-B-to-A changes within one step. Restart restores fingerprints/counters and avoids duplicates after unrelated steps.
- Each file-version poll reads at most eight bounded files, with a five-second polling interval. Paging eventually visits all versions; a rotating bounded check reports vanished known files. A file snapshot is not an atomic filesystem transaction: ordinary size/time changes are marked partial; simultaneous same-size writes with unchanged metadata cannot be certified atomic.
- Recorded plaintext thinking is labelled **Thinking recorded by Antigravity**. No generated thoughts, native control or new UI design.

## Agreement and shared merge seams

Yash confirmed Harsh's agreement in the integration instructions; subsequent scope approvals are recorded in STATUS and #479. Contract `0.2.2-draft` and reducer `r43` move together. The new omission value is `referenced-file`; the normalized observation is `artifact.plan`. Existing event meanings are unchanged. Existing-harness golden tests pass unchanged; no old adapter, fixture or golden scene was edited.

| Shared path | Isolated section and reason |
|---|---|
| `packages/contracts/src/index.ts` | Additive artifact observation/payload and plan version detail; synchronized contract version. |
| `packages/projection/src/reduce.ts` | Antigravity-only native plan input and artifact-version handling; replay result versions; reducer version. No generic tool-card formatting. |
| `packages/ingest/src/index.ts` | Add `artifact.plan` only to the Antigravity restart prime filter so fingerprints/counters survive restart. Existing harness branches unchanged. |
| `packages/privacy/src/image.ts` | Add the omission value and document the agreed Antigravity exception; no sanitizer bypass. |
| `History.tsx` | Only the Prose reasoning-label expression, preserving UI-46, motion and scrolling. |
| `PlanChecklist.tsx` | Only native-document/version controls using existing classes and readers. |
| `OpImages.tsx` | Only the missing-image reason label. |
| `scripts/check-real.ts` | Register the new counts-only media/artifact case. |

Adapter paths/index/live/tools, new media/artifact readers and tests are the other task-owned code. The final agreed footprint is at most 26 task paths, excluding documented stacked dependencies. No palette, layout, typography, motion, controller or native-policy change.

## Acceptance: genuine captures

All imports used scratch Drishya homes, native reads stayed read-only, and journal text was never printed. Prefixes, sizes and counts only:

| Case | Native prefix | Bytes | Evidence |
|---|---|---:|---|
| Newest top-level capture at check time | `660a1ec4` | 21,144 | Background-command conversation; 3 recorded-thinking passages. |
| Image prompt | `c452ce98` | 210,089 | One prompt with captured image bytes; 6 thinking passages. |
| Agent-read screenshots | `99ef88f8` | 43,659,730 | 347 action image references, 2 image-bearing prompts, 2,576 thinking passages. Existing limits/omissions remain honest. |
| All three artifact types | `a5933dad` | 55,251 | 4 native plan calls, 6 observed file versions, 3 thinking passages. Implementation plan, task and walkthrough each checked. |
| Claude regression | `rec_b8d08433` | 1,351,216 | 40 operations and 6 prose passages, both widths. |
| Codex regression | `rec_88f439d7` | 194,590 | 1 operation and 1 prose passage, both widths. |

- 24 genuine Antigravity frames: six material views at 600/1440, normal/reduced-motion and low-resource. Every frame has zero page errors and zero document horizontal overflow. Prompt image bytes load at both widths; the image reader loads the recorded action image; all three artifact documents and version controls work. Recorded-thinking attribution is visible at both widths in both resource modes.
- Four additional genuine Claude/Codex frames: no page errors/overflow.
- Outside-conversation refusal: canonical/sibling/junction and deterministic open-swap units, plus a controlled adversarial UI recording at both widths with a visible reason. No genuine native image URI in the surveyed corpus leaves its conversation; that negative case was synthetic, not misrepresented as a genuine capture. Native journals were not modified to fabricate one.
- Existing controls/DOM classes reused. Automated geometry and interaction checks are not a human design certification.

At Yash's explicit request, local screenshots of the real Antigravity-in-Drishya view were displayed for inspection. The preferred overview is the newest capture, with Antigravity visible in the header and Session details. Opening a historical screenshot that Antigravity had read can itself show another harness; that nested image is not the recording's identity.

## Checks and private evidence

- `pnpm check:real -- antigravity-media --pick 12`: 7 matching sessions, 385 image/plan hits including 34 artifact calls; zero unaccounted calls/unknown records; all checks pass. Six PDF references are intentionally excluded from image counts and have explicit gaps.
- Both project typechecks pass.
- All units: **1,575 passed, 1 existing skip**, 254 files, two workers. Focused Antigravity/artifact suite: **52 passed**.
- **36 targeted Edge browsers passed**, two workers, zero retries; serial selection had no matching tests. Specs: antigravity-live, antigravity-harness, captured-images, plan-checklist, plan-mode, reasoning-gap, home-current, home-stats, home-groups, home-opening, library-search and conversation-switch.
- `package:verify` passes: isolated offline install, old-harness imports, bundle, authenticated API and persisted restart. Daemon runtime dependencies remain zero.
- `check:affected --dry` selects the whole suite because this stack changes shared contracts/history/reducer. Per the integration instructions, the single combined full gate is deferred until AG-1 through AG-5 are accepted; no individual-draft full gate or hosted CI dispatch was run.
- Private evidence is under this worktree's `.local/ag-4/`: accepted units/types/real logs, final browser log, package log, model counts, 24 genuine frames, image-reader/card frames, old-harness frames and synthetic refusal frames. No real screenshots or conversation text are committed.

Not checked: AG-5 browser/MCP/question/approval/plan-review mappings, PDF viewing, native-process crash acceptance, a combined integration full gate, other operating systems, or a human visual review. These are not implied by this item's local acceptance.
