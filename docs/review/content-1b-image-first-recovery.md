# CONTENT-1b — image-first material and exact current-file consent

Completed locally on 29 October 2026, PR #293. The parent runs one shared finished-P1 batch gate; no per-increment full gate or merge was performed.

| Before | After | Why |
| --- | --- | --- |
| A viewed/generated image card spent most space on argument JSON or reference metadata | The image is the primary material, with bounded 220–420 px fit surfaces; original request/result remains reachable | Image-reading should use the card for the image |
| Current reading correctly refused an image in another worktree/generated folder, leaving no recovery path | Explicit **Allow this image only**, naming the already-recorded file; ordinary workspace consent is still required | Consent to one known image must not grant its parent folder |
| 72 px image previews hid useful visual detail | Captured action images use the wider material allocation and retain Fit/Actual reading | Screenshots and generated material become readable |

Captured bytes still load by recording-owned hash and are labelled captured. Recovered disk bytes are always labelled **Current file — it may differ from what the agent saw**. They are never stored as captured history. Mixed browser/MCP text stays visible alongside the image, in collapsed and expanded reading. Omission-only markers, remote references and original material remain accessible.

## Capability and privacy boundary

The POST accepts only an operation ID. The server resolves its image path from that recording's actual observation; clients cannot supply a path or directory. The separate exact-file consent is volatile, bounded to 64 entries, and keyed by recording/operation, canonical path and file identity/size/times. It grants no text read, sibling access, directory scan or permission to run anything. A changed file requires fresh exact consent. Workspace revocation/reapproval cannot revive an old image grant, including during asynchronous final validation.

Local `file:` URLs are decoded once by the existing recorded-path owner. Remote/UNC paths, protected names, symlink/junction components and non-file/over-limit inputs remain refused. Reads allocate at most the inspected 4 MiB bound, recheck file/access/grant identity after reading, sniff actual PNG/JPEG/GIF/WebP bytes, and send no-store/nosniff responses. Authentication and same-origin request protections remain the existing server owners. No event schema, runtime dependency, harness config or native journal write was introduced.

The `.local` exclusion remains unchanged for general workspace reading. An explicitly chosen, recorded image there may be read only through this exact-image capability, subject to all the protected-name/link/signature/size checks. This is an explicit separate consent, not an implicit generated-folder grant.

## Genuine acceptance

The three builder-reported actions were found in the real current Codex parent capture `32f628ee`: 531,975,924 source bytes, 32,057 imported observations. They are a viewed PNG in another managed worktree, a viewed JPEG beneath that worktree's `.local`, and an image-generation result beneath the native generated-images directory. Original native journal and disk images were not modified.

At both 600 and 1440 px, all three first retained ordinary root refusal, then displayed their real bytes after explicit exact-image consent. Each used a 342 px preview, opened the current-image reader, and passed Fit/Actual/close reading. Six journeys, zero page errors. The previous refusal is no longer the final product outcome.

Claude `061e5f2d` (1,138 observations, 12 captured images) was checked at both widths. Its genuine captured screenshot rendered in a 304 px material and passed captured Fit/Actual reading. It never needed disk fallback or gained a current label. Real screenshots and exact private operation IDs stay ignored under `.local/`; no captured content is committed here.

Claude `c8e5c9c8` (10,466 observations, 99 genuine Read operations with image bytes) additionally verifies the directly changed Read composition at both widths: captured image material, Fit/Actual/close and original evidence access; no current-file substitution.

## Regression checks

- 31 image browser checks pass, including the pre-existing captured, path-recovery, desktop-source, mixed text/image and reader suites.
- 17 focused image/workspace units pass, including two deterministic races that revoke and reapprove the same root while the final root check is suspended; neither grant nor read survives it.
- Both TypeScript projects and UI build pass.
- New endpoint/UI regressions cover explicit consent, operation-derived paths, rejection of client-supplied paths, unknown operations, absent workspace consent, protected files, junctions, missing/large/non-image files, changed-file reconsent, generated references, current labels and 600/1440 image-reader presentation.

Missing, remote, protected or expired image evidence remains explicitly unavailable. Existing captured image byte budgets and offline read-only behavior are unchanged. This task does not certify physical/platform release checks or add automatic image fetching.
