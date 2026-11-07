# CONNECT-3 — screenshot paste and file pick

Behaviour only; presentation is left to FINISH-4. Existing composer classes, attachment strip, preview and native consent are retained. No schema, native policy or Clarity changes.

## Diagnosis

The running app on a real Codex recording accepted a normal PNG selected through the file input and an actual clipboard PNG pasted with Ctrl+V. Those paths were already connected. The same valid PNG labelled `application/octet-stream` was rejected: `promptFiles` classified images solely by four exact MIME strings and tried to decode everything else as UTF-8 text. Blank and provider-specific MIME values have the same code-path problem (a file chooser can infer MIME from its extension, so unit tests cover a genuinely blank File type).

The original report did not include the clipboard format, bytes or file size, so this does not establish the exact cause of that historical attempt. It establishes and fixes a reproducible screenshot failure rather than attributing an unobserved format to the builder.

A second gap was silent rejection of files pasted while a native turn was active. Those files still cannot be added during that turn, consistently with the disabled file picker, but now the UI says why. The clipboard handler now takes its file collection when present, falling back to file items, without attaching the same screenshot twice or swallowing ordinary text pastes.

## Behaviour and limits

Supported image signatures determine PNG, JPEG, WebP and GIF MIME, independently of filename or provider MIME. Unsupported image formats and invalid image-labelled files explain what is supported. Existing limits remain: 32 attachments, 4 MiB per image, 6 MiB combined and 512 KiB combined text. The daemon's independent validation is unchanged.

## Genuine connected acceptance

A scratch Drishya home imported two native sessions from an isolated throwaway repository. Each turn was submitted through the real composer: a screenshot was written through the browser Clipboard API and pasted with Ctrl+V; the second image was selected through the attachment button and native file-chooser event. Workspace consent and the idle-other-clients acknowledgement were both exercised. The real native processes resumed under their existing policies; no shell-interpolated prompt, native configuration edit or permission weakening was used.

| Harness | Recording prefix | Journal bytes after turn | Observations | Sent / distinct images | Captured multi-image turns | Agent identified both numbers and shapes |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Codex | rec_13949e17 | 368600 | 27 | 2 / 2 | 1 | yes |
| Claude Code | rec_69977fa0 | 354075 | 25 | 2 / 2 | 1 | yes |

Prepared previews were checked at 600 and 1440 px for both sessions. Reading the scratch store back confirmed two captured image blobs in each genuine turn. Images were synthetic browser screenshots; native journal content was not printed. Screenshots and private acceptance scripts/counts remain under `.local/`.

`pnpm check:real -- multi-image-prompts` also scanned both harnesses into a scratch home: 15 Claude sessions with 29 qualifying prompts, one Codex session with one. Selected Claude rec_64d5c199 (13.2 MB) presented all five qualifying prompts and 15 captured images; selected Codex rec_13949e17 (0.4 MB) presented one prompt and two captured images. The genuine connected Claude session above was checked separately so the scanner's highest-hit selection is not substituted for connected acceptance.

## Checks

- Eight prompt-files unit cases: all supported signatures, blank/generic/provider MIME, unsupported/disguised/oversized files, binary and aggregate/count limits, clipboard collection/fallback/deduplication and ordinary text.
- `composer-screenshots.spec.ts`: 600 and 1440 px, actual clipboard paste, file chooser with generic MIME, decoded image previews, preview dialog, explicit errors, preserved draft, consent and exact image delivery to a synthetic protocol regression guard.
- `pnpm check:affected`: both typechecks, 35 related unit passes / one existing skip, 26 browser passes. Edge; three configured browser workers, zero retries.
- Named connected-workspace/composer-access checks: 21 passed on Edge, three configured workers, zero retries.
- Isolated full gate on source eb9c61cd: both typechecks, build, package verification, 1,209 unit passes / one existing skip (three workers), 632 parallel plus 33 serial browser passes / 28 existing skips / zero failures or retries (Edge; parallel three workers, serial one). Logs remain in the isolated gate worktree’s `.local/gate/`. Subsequent changes are documentation only.
