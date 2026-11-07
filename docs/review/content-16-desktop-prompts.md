# CONTENT-16 — desktop prompt envelope presentation

Behaviour only; FINISH-3 owns presentation. The original `message.user` prompt stays unchanged in capture, persistence, search and the projection. TurnBlock derives a display request and an attachment list from the exact recorded wrapper. No adapter/schema changes, native reads prompted by a path, or changes to motion/scrolling/layout owners.

The recognized form starts with the recorded Files heading (allowing the observed leading blank line), one or more file headings with their recorded paths, optional image markers, the exact fixed caution and My request heading. A trailing image-tag suffix is removed only if every tag matches a listed image path; the observed slash-direction difference is normalized for comparison only. Unknown metadata, partial wrappers, unmatched image paths and non-suffix markup stay literal. Plain CLI prompts keep their original text. No claim about the sending application is inferred beyond that recorded shape.

Attachment names, icons and recorded paths use existing attachment classes. Images with captured bytes use the existing hash-based viewer; a filename never authorizes loading a current native file or remote image. Image metadata is not guessed into a path-to-hash pairing. Where no image bytes were recorded, the path is shown honestly. The canonical wrapper is retained, not destructively removed from stored evidence.

## Genuine acceptance

The read-only scan examined 20 Codex journals under 100 MiB: six exact envelopes, five containing image bytes. All six originally included a leading blank line; their image tag paths used Windows backslashes while the heading used forward slashes. Parser verification checked those structural facts without printing source content. The reusable `pnpm check:real -- desktop-prompts` case found three sources / six matching records, with five image-bearing records, under its default 90 MB ceiling; the chosen source's canonical prompt/image references remained intact.

Selected sources were imported only into a scratch Drishya home. Both 600 and 1440 px were checked for request-only text, exact attachment count and successful decoding of captured images. Screenshots and native paths remain private in `.local/`.

| Native source | Prefix | Bytes | Observations | Case |
|---|---|---:|---:|---|
| Codex desktop | `rec_7cb1cda1` | 15,023,432 | 4,147 | Three image envelopes, each with one decoded captured image |
| Codex desktop | `rec_58787f2c` | 32,790,948 | 1,046 | One image envelope with one decoded captured image |
| Codex desktop | `rec_275b92f0` | 6,046,741 | 319 | Four file references, and a separate image envelope |
| Claude Code CLI | `rec_69977fa0` | 225,393 | 13 | Ordinary prompt unchanged, no derived attachment list |
| Codex CLI | `rec_13949e17` | 187,447 | 15 | Ordinary prompt unchanged, no derived attachment list |

All **16 real browser checks passed** (six desktop prompts × two widths, plus two ordinary-harness controls × two widths). Browser regressions at both widths also check a synthetic missing-image-byte reference: honest path and missing-byte explanation, no wrapper caution/headings/image tags in the displayed request, and no horizontal page overflow.

Four parser units cover the synthetic real shape, CRLF and request formatting, empty/image-only requests, plain CLI text, quoted/partial wrappers, malformed metadata and unmatched paths. `check:affected` passes both typechecks, five related units, 632 parallel and 33 serial browsers with 28 existing skips; configured three parallel workers plus one serial worker. Named desktop-prompt browsers pass 2/2 with `--workers=3 --retries=0`.

The final-source isolated worktree has its own frozen install and rebuilt UI: types/build/package verification passed, **1,210 units passed / one skipped / 201 files** at three unit workers; **632 parallel + 33 serial browsers passed = 665 passed / 28 existing skips / zero failures or retries**, three parallel workers plus one serial worker. Source snapshot `9049f59e`, isolated cherry-pick `c7a21692`; later commits document acceptance only. No merge is authorized.
