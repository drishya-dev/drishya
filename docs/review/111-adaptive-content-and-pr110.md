# Adaptive visual content and PR110 review

18 October 2026. Read-only investigation of the current code and three locally imported/redacted Drishya/Skeletongraph Codex and Claude histories. This is supporting evidence; **TASKS.md is the only active checklist**. Binary capture/schema/policy proposals below are not implemented contracts.

## What the actual sessions establish

The sampled histories contain1,094 and1,154 Codex calls and2,215 Claude calls. Codex's dominant top-level tool is `exec` (1,001/1,149); browser work also arrives through `js`. Claude records Bash, PowerShell, Read, Write, Edit, Grep, WebFetch, WebSearch, SendUserFile, browser MCP and question tools directly. Therefore an exact-name dispatcher alone will miss valuable visual material, especially nested Codex tool calls and MCP results.

A metadata/content-signature scan finds image-related mentions in47/82/181 calls, browser-related mentions in79/5/6 and structured-data mentions in137/203/426. These are **candidate mentions**, overlapping categories, not counts of captured images, actual outputs or supported previews. For example a test may mention `.png` without ever producing one. No source text, screenshot or raw journal is committed from this audit. The three stores are finite samples, not every command supported by either harness.

### Existing seams and gaps

- `adapter-codex/src/index.ts`: native `view_image` maps to a read path. Text extraction does not preserve a corresponding image artifact; wrapper calls may retain only literal source mentioning the nested operation.
- `adapter-claude/src/index.ts`: Read/structured tool results can carry useful text; direct image blocks emit metadata-only `capture.gap` with image omitted by privacy policy.
- `privacy/src/index.ts`: images/base64 payloads are deliberately dropped. Text redaction cannot certify pixels. Keeping screenshot bytes automatically would violate the current policy rather than repair rendering.
- `contracts/src/index.ts`: artifacts currently cover excerpt/snapshot/patch/output, with text blobs and line-addressed readers. There is no agreed image/media artifact contract.
- `ToolOutput` and `tool-output.ts` decode recognized complete text envelopes, with original/raw access. `ToolInput` provides paged structured fields. Mixed image/text results, resource links and general structured-content views still need explicit handling; never discard unknown siblings while decoding.
- Existing tests, diffs, Markdown, native questions and real delegation already have specialized owners. Extend those instead of mounting duplicate dashboards.

## Content-first presentation map

| Captured evidence or explicitly requested current content | Useful presentation | Evidence/adaptation boundary |
| --- | --- | --- |
| Raster image, screenshot, generated image, diagram bitmap | Contained thumbnail preserving aspect ratio; accessible enlarged reader, fit/zoom/pan, dimensions and exact operation | Verified MIME/magic bytes plus explicit image opt-in. Path alone means unavailable captured content. Current disk is a separate freshly approved sample. No remote auto-fetch. |
| Browser navigation, page text, accessibility tree, screenshot | Compact page identity and captured DOM/text/screenshot modes with exact capture time | Only link modes from the same explicit operation/result IDs. No invented video, successful navigation claim or live-site embed. Partial accessibility snapshots remain partial. |
| JSON objects, arrays, MCP structuredContent | Collapsible typed tree; rectangular record arrays may offer a bounded table, field navigation/filter and exact raw copy | Validate complete structure and preserve null/missing/nested/mixed fields. Do not turn arbitrary log text into a guessed JSON object or silently omit non-text siblings. |
| CSV/TSV or captured database rows | Opt-in bounded data grid, row/column counts and raw source; optional chart only for explicitly selected numeric columns | Require complete recognized input/delimiter metadata or explicit user choice. Quoted multiline cells, huge columns, nulls and truncated pages remain truthful; no inferred database schema or units. |
| Source read, creation, patch, search hit | Existing source/diff reader, syntax and exact line/hunk references; compact search-hit groups | Reuse captured ranges and current-file consent. Shell source reaches a reader only with reliable evidence of path/range; do not reconstruct a whole file from a few lines. |
| Test/check results across runners | Existing discrete outcomes plus runner-specific cases, assertion detail and raw output | Runner adapters or complete structured reports. Index/order only when captured, summary counts remain grouped and not execution order. Wrapper receipt is not nested success. |
| Web search/fetch results, citations | Compact result cards with title, safe URL, captured excerpt and source access | Only captured title/URL/snippet. User-triggered external navigation; no remote thumbnails, fabricated favicon/download or auto execution of fetched HTML. |
| Markdown/plain-text/HTML/PDF document artifact, user-file handoff | Markdown Document/Source; explicit file-artifact card; bounded document reader/download when captured bytes are supported | SendUserFile/path is a reference, not proof bytes were captured. Never execute HTML/SVG/scripts. PDF support requires bounded decoding/worker, privacy review and separate acceptance. |
| Explicit plans, subagent messages, questions/approvals | Captured checklist and native interaction forms; expandable agent relationships with exact IDs | Reuse existing native owners. No animated fake thinking, speculative agent chain, guessed percentage or answering by sending a substituted prompt. |
| Process progress, terminal streaming, build output | Incremental captured output with stable reading position, process ID/status and exact reported progress | No fake terminal emulator, ANSI/OSC execution or progress inferred from elapsed time. Unknown end state stays unknown; same material component in live/replay. |
| Git history/import relationships | Existing Branch atlas and typed map neighborhood with exact commit-parent/import directions | Real Git parents and static imports are different edge types and stay distinct from tool-order/agent causality. No auto checkout/fetch/run. |
| Audio/video, model/3D artifacts or arbitrary binaries | Later explicit media/artifact reader if genuinely captured and useful | Low priority until image transport/privacy works. Codec/resource limits and export choices; no loading arbitrary executable formats or remote URL by default. |

## Adaptive architecture, not a command-name catalogue

Use a pure, versioned, bounded presentation selector over **sealed** observations/artifacts. Prefer authoritative content-block type/MIME, structured result fields and artifact provenance; use known native tool intent only as additional context. A matching command string or extension may suggest an explicit open action, never manufacture an artifact or prove its result type. Unknown/truncated/malformed data stays readable in the current raw/text fallback.

Normalize useful MCP content blocks, resource links and structured fields without dropping siblings. Preserve the original block order and operation identity. Nested orchestration gets conservative complete-envelope decoding; recognize nested literal requests only if parsing proves their structure. Never eval tool source, execute a command to regenerate its output, blindly regex-unescape text or infer image bytes from `image(path)` in a script.

Keep the execution card compact: a bounded content-shaped preview and one reader/zoom destination, under the shared hover/motion/scroll rules. Long text remains selectable and all stored detail reachable. Use the same selection and material path for native tools, MCP, live history, replay, unknown-tool fallback and optional Canvas. DOM renders text; media/map geometry never substitutes for source characters.

For image capture, both builders must agree the event/artifact seam and explicit policy/version before changing ingestion. Individual local viewing/export opt-ins, retention/deletion, safe MIME/size/pixel caps, memory budgets and missing/expired content belong in that design. No OCR claim of successful redaction; no images in export by default. Do not persist media bytes in working-location/navigation metadata. An approved current-workspace image reader can be a separate capability but must be labelled current, not historical.

Acceptance corpus: both harnesses and MCP; direct/wrapped/multiple calls; mixed text/image/resource blocks; omitted/missing/expired/remote/protected paths; huge dimensions/decompression bombs, malformed MIME/base64/SVG/HTML; empty/truncated/partial objects and tables; burst/late live outputs; replay/hover/internal scroll; keyboard/copy/zoom, phone, reduced motion/resources, offline bundles and export. Measure memory/decode cost; no new capability is complete after a path/icon test.

## PR110 disposition

Reviewed PR110 `workspace: add bounded review and source-version workflows` at `d071ff3409a0960c6b667b82896656edd1c3b84c` against main `ffef565` and the then-uncommitted Git atlas (now PR111). **Left open and unmerged.** The API reports merge conflicts. Its local verification describes its branch, not the combined current product; do not treat that as integration acceptance.

| PR area | Current main / decision |
| --- | --- |
| Commands, findings, repetitions, prompt summaries and worker APIs | Existing Commands/ReviewInsights/Prompt overview/finding-members already supply these jobs. PR introduces a second ReviewTools component/API/index instead of extending the current owners. Do not merge duplicate menus/readers. Explicit keyword findings and selected-command copying are distinct ideas, not required replacement features. |
| Disk/base/draft comparison and follow-up preparation | Existing `useCurrentSource`, `SourceVersions.tsx`, draft comparison, native return metadata and post-turn review cover most of this. PR replaces the same `lib/source-versions.ts` seam with incompatible exports/class semantics; current imports need observeSource/acceptSource, while PR callers need sourceVersions. Blindly accepting either conflict side breaks the other workflows. |
| Captured range versus separately approved disk sample | Useful distinct addition, not currently the same as retained-current vs latest/draft. Selectively implement on the current reader with exact ranges, source/request identity, explicit consent and positional/moved-code disclaimer. |
| Full-repository map approval, Files return and import arrows | Useful regression case and explicit direction. Current main also has newer navigation/occlusion fixes; reproduce with its actual owner before porting the narrow fix/test. Do not replace the renderer or all labels wholesale. |
| True-black Jet and old palette swatches | PR is based on an earlier palette revision. Current six alternatives were rebuilt later. Do not restore stale tokens or treat unrelated palette edits as part of source workflow integration. |

No PR comment or message was sent to the other builder. The builder requested no merge for redundant work. Preserve useful selective candidates in TASKS, not a second implementation or a blanket claim the whole PR is useless.
