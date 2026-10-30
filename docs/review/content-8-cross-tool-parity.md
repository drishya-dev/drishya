# CONTENT-8 — cross-tool parity acceptance

30 October 2026, PR #257. This extends the existing parity corpus after the question, plan, image, browser and delegation readers were integrated. It changes tests and the real-case inventory, not production readers, capture, contracts, dimensions or motion. The 27 October dependency audit is superseded by the evidence below. NATIVE-3 remains its own end-to-end task.

## Acceptance boundaries

The supported widths are **600 and 1440 px**, following the desktop-only builder decision; the older task's phone wording does not extend product scope. Genuine captures are imported through the existing redaction path into private scratch homes. Native journals and the source acceptance stores remain read-only. The browser test uses the real projection, paged history, artifact, delegation and image APIs and suppresses additional automatic watching requests. This is archive History/replay acceptance, not a claim that a host-only progress event was journaled.

Every journey requires a dedicated family view, a nonzero captured reading after ancestor clipping, no document overflow, no external request and no browser page error. Private captured strings are compared in browser memory; failures and screenshots stay in ignored `.local/`. Public reports contain only prefixes, sizes, counts and booleans.

## What is checked

| Material | Genuine acceptance | Regression boundaries |
| --- | --- | --- |
| Source and changes | Claude historical source, genuine changes in both harnesses, exact stored-page copying, captured patch material. | 620-line source and 160-hunk patch with bounded paging. Codex shell reads stay shell reads; this corpus does not invent typed Read calls. |
| Search | Claude zero-hit query and a 61-hit capture; expanded preview agrees with its first 50 paths and Inspector exposes all 61 supplied paths. | 123-hit fixture declares the remaining count. Native Codex shell searches retain their recorded command/output presentation. |
| Tests | Genuine Codex and Claude test operations retain the command and captured output; available stored pages copy exactly. | Captured failure is not a successful wrapper acknowledgement. |
| Plans | Native plan captures in both harnesses: every displayed item and status agrees with the historical revision. | 80-item fixture and known states; no later plan revision is substituted into an earlier replay step. |
| Questions | Both older Codex acceptance-only captures and genuine answered Codex/Claude captures use the dedicated question reader. Offered labels, chosen flags and captured question text are compared individually. | No-answer and accepted-only states remain explicit. No answer is submitted during acceptance. |
| Delegation | Both harnesses use the dedicated reader. Exact child facts, every supplied thread page, step kinds and labels agree with the bounded DTO; an imported Codex child link is followed. The Claude identity-linked case has 33 steps and 19 child actions. | An acknowledgement is not the child's answer; a heuristic identity is not promoted to a captured identity. NATIVE-3's complete native lifecycle is separate. |
| Process results | Genuine shell/process receipts retain captured output and missing exit information. Returned tool wrappers are not promoted into evidence of a successful child process. | Both harness fixtures exercise pending → mixed result through ingest/SSE and preserve an open reader through later prose. Replay hides the result before its recorded arrival. |
| Unknown / mixed MCP | Genuine structured siblings remain selectable; Whole captured result exposes the exact original and copies it without losing siblings. Native/MCP large-input and large-output controls share the property corpus. | 95-field inputs, 1,200-record outputs, bounded table DOM, final record retrieval, original/copy, explicit reading choices, empty and failure cases. |
| Incomplete / missing output | Genuine incomplete JSON-like originals and absent result text in both harnesses retain literal text or explicit absence. Available result pages copy exactly. | Incomplete syntax is not proof of the cause of truncation. Fixtures cover explicit truncated and missing evidence without inventing completion or bytes. |
| Orchestration | A genuine Codex `functions.exec` result contains both fulfilled and rejected siblings. The captured script and exact outer result preview remain reachable; copying preserves both statuses. | The deliberately rejected Promise is an outer result sibling, not a fabricated native child call or child-agent failure. Literal arrays in other sessions are not called settled orchestration. |
| Browser, web and images | Genuine web/browser views, a decoded captured Claude image and a Codex path-only image with explicit current-file/consent state. Browser-step selection uses its real scrubber. Captured image reader opens, decodes, changes size and closes by keyboard. | No remote image/resource is fetched. Current file bytes are never labelled as the captured image. These checks complement the owning image/browser tasks. |

The corpus includes large, mixed, incomplete and absent results from both harnesses. A family is checked only where that native shape exists in the selected sources. In particular, shell source reads/searches are not renamed into Claude-style typed calls.

## Native live evidence limit

Two genuine read-only Codex command probes completed on throwaway repositories. Their host JSON stream each exposed one in-progress command event. The journal observer did not expose a pending operation during either bounded observation; the final imports contained no pending operations. The UI checks those captured final operations without synthesizing the missing pending state. No earlier source snapshot was retained, so no exact before-byte count is claimed.

| Prefix | Bytes | Observations | Operations | Host in-progress events | Pending operations in final projection |
| --- | ---: | ---: | ---: | ---: | ---: |
| `cda4046a` | 193,727 | 40 | 5 | 1 | 0 |
| `245f935e` | 194,148 | 40 | 5 | 1 | 0 |
| `d58461d2` (Claude Code) | 143,454 | 9 | 1 | 0 | 0 |

The Claude probe returned a genuine blocked tool result. Its policy was preserved and no replacement permission or bypass was requested. This is a precise harness-evidence limitation on these probes, not an untested claim of native pending success. Supported interactive controller journeys remain the separately recorded CONTENT-3 evidence. Synthetic controlled append is the regression proof for live arrival in both journal formats.

## Verification

The fixture and live-arrival suites pass **44 browser checks**, including both supported widths. The scanner has **6 focused unit checks** for native Codex function/custom/local-shell calls, cheap-prefilter eligibility, Claude tool blocks and quoted/output false positives. Root and UI typecheck pass. No production runtime changed, so this test/scanner/report increment does not repeat the full gate or package verification; the current main/UI-16 integration batch owns that gate.

**156 unique genuine acceptance journeys pass: 78 at 600 px and 78 at 1440 px, covering 39 selected cases in both History and replay.** This combines the broad matrix with targeted reruns after correcting driver selectors, large-source bootstrap waiting and asynchronous child-link metadata waiting. Every planned tuple is present in the private final count matrix; none is credited from a generic fallback in place of its dedicated question, plan, browser, image or delegation reader. All accepted journeys report zero external requests and zero page errors. Representative actual question, plan and child-thread screenshots were inspected locally.

All 39 selected operations have a recorded `op-end` boundary. The driver now fails explicitly if one is absent, always enters replay with `at`, and checks its Timeline value; History cannot be credited as replay. A counts-only independent boundary audit and eight focused guarded journeys pass.

After merging `origin/main` at `9c50bdf7`, both types/build, six scanner units, all 44 parity/live-arrival guards and 20 affected genuine browser/web/image journeys pass again. The registered `check:real -- content-parity --max-mb 20 --pick 1` scan finds 99 Claude sessions / 7,103 native calls and 34 Codex sessions / 2,491 native calls (nine/four journals above 20 MB skipped). Its scratch imports are `81c22a35` (17.3 MB, 535 operations) and `0de01fe5` (9.1 MB, 401 operations). Native-call and projected-operation counts are not assumed one-to-one.

The shared isolated runtime batch at `8e44bcdc` passes types/build/package, 1,058 units / one skip and 528 browser checks / 26 skips / zero failures. This tests-only PR uses that batch gate and its focused checks rather than duplicating the full gate.

The native-live evidence limit above remains explicit. The accepted archive rendering and regression coverage do not close NATIVE-3 or broader release acceptance.

## Genuine source matrix

This is final stored-source accounting. The inherited `32f628ee` scratch stores received additional source material during earlier diagnostic runs: accepted spawn journeys used 34,872 and 34,958 observations, and image-path journeys used 32,207 and 34,838. Their final accounting is shown separately below; no earlier byte size or immutable-snapshot count is invented. All other selected source observation counts match the individual accepted journeys. The selected historical operation identities and exact captured text comparisons remained stable.

| Prefix | Harness | Bytes | Observations | Operations | Selected material |
| --- | --- | ---: | ---: | ---: | --- |
| `4b5ca5b1` | codex | 44,016,822 | 1,530 | 542 | edit, mcp, question, missing, error, large, mixed, incomplete |
| `4d842553` | codex | 57,913,276 | 2,284 | 757 | process |
| `c8e5c9c8` | claude-code | 82,859,509 | 10,466 | 2,215 | read, edit, search, test, mcp, question, browser, incomplete, error, missing, large, process, search-hits |
| `cc002c1f` | claude-code | 24,039,894 | 3,311 | 732 | unknown-mcp |
| `08d31045` | codex | 27,919,575 | 1,870 | 547 | test |
| `7d8b3224` | codex | 12,542,301 | 462 | 130 | spawn |
| `024517cd` | claude-code | 6,516,417 | 2,112 | 426 | spawn |
| `0dc85036` | claude-code | 70,768 | 14 | 3 | plan |
| `13fd690b` | codex | 230,155 | 71 | 13 | plan |
| `93fd344c` | codex | 1,797,760 | 452 | 127 | orchestration |
| `a012336b` | codex | 8,291,460 | 1,466 | 386 | web |
| `64d5c199` | claude-code | 13,211,006 | 2,288 | 520 | browser, web |
| `71a376d0` | codex | 375,432 | 80 | 4 | question |
| `1a691710` | claude-code | 210,641 | 36 | 4 | question |
| `32f628ee` | codex | 567,838,838 | 34,975 | 9,282 | spawn |
| `32f628ee` | codex | 552,592,139 | 34,872 | 9,254 | image-path |
| `061e5f2d` | claude-code | 7,150,502 | 1,138 | 292 | image |
| `cda4046a` | codex | 193,727 | 40 | 5 | native-returned |
| `d58461d2` | claude-code | 143,454 | 9 | 1 | error |
