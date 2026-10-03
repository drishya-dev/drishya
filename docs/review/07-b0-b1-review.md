# Review of B0/B1 changes — 3 October 2026

Reviewed `8cb801d..d94d96a` (PRs #3–#7) against the product constraints, baseline audit and current code. This is a source review with executed synthetic tests, not a certification of every possible harness record, real-session persistence or production scale.

## Verdict

The changes move the product in the intended direction. They keep capture passive, make failures visible, bind remote-model consent to the exact request, and let a disconnected viewer recover missed writes. None of these commits turns Drishya into a harness or changes the visual north star. H–L in `PRODUCT_DIRECTION.md` remain proposals, not approved features. The frontend is still the integrated base UI, not the continuous live-history design promised in `VISION.md`.

The privacy rules are best effort. `p3` closes the planted bypasses and protected-file cases represented by current tests; it does not prove that every possible secret or absolute path is absent from every export. Older recordings are flagged, not retroactively re-sanitized. Do not treat a green test suite as permission to publish a real recording without inspecting the exported bundle.

## Corrected in this review

| Area | Failure | Correction |
|---|---|---|
| Live recovery | After a daemon restart, the old browser cookie gets 401 on the SSE route; `EventSource` hides the status and the page could say “reconnecting…” forever. | On stream error, probe the authenticated revisions route. A 401 signs the tab out and closes the stream; a network failure leaves native reconnection running. Covered by UI tests. |
| SSE backpressure | The check compared the buffer only *before* writing, so one message could cross the stated 1 MiB cap. | Include the outgoing message's byte length in the check. |
| Privacy fidelity | A captured own key named `__proto__` disappeared when sanitation assigned it into a plain object. | Build sanitized objects with a null prototype; test serialized output and the resulting prototype. |
| Live summary race | A delayed health refresh could put a previous recording's summary into the currently open view. | Apply the response only for the active source, and choose the summary for the current open recording. |

## Still open, by design or evidence limit

- **B2 history correctness:** positional passage ids, worktree identity in combined sessions, and as-of result/artifact boundaries are not fixed by B0/B1. These are correctness gates before premium animation; see baseline audit A11–A13.
- **B3 live reading:** the base UI still couples the visible history to a playback step. Continuous accumulation and a stable scroll anchor remain to be built. A reconnect can recover data while the presentation is still transport-led.
- **Privacy/export:** the export masker covers known recording, source, map, captured workspace roots and home paths. It is not a general recognizer of arbitrary absolute paths embedded in captured prose or tool output. Do not describe it as such. Real-data export inspection and an explicit release policy are still needed.
- **Scale:** each live read is bounded, but a backlog can schedule successive reads and projection recomputation. The 100k-event, large-repo, capture-overhead and RAM gates have not been measured. No claim of production scale follows.
- **Contract governance:** `RecordingSummary.revision?`, capture-health types and SSE shapes are additive working-draft changes. Both builders must review them before declaring the event/schema contract frozen. This review does not freeze it.

## Checks run

On Windows with Node 24.14.0 after `corepack pnpm install --frozen-lockfile`: backend and UI typechecks; 160/160 Vitest tests; Vite production build; `node scripts/validate-baseline.ts` with the three synthetic privacy probes true, synthetic import/restart/API/live checks passing. No `--real-read-only` run, real journal import, model request or browser visual inspection was performed for this review.
