## What

<!-- One or two sentences: what this changes. -->

## Why

<!-- The problem it solves, or the decision it implements. Link the issue if there is one. -->

## How to check it

<!-- What the reviewer should run, open or look at. For UI work: which frame, interaction or state. -->

## Acceptance evidence

<!-- Link the issue when available. List the acceptance criteria, the relevant checks and their outcomes, and any remaining blockers. -->

## Checklist

The non-negotiables from [`AGENTS.md`](../AGENTS.md#non-negotiable-constraints). Tick what applies; say why for anything that does not.

- [ ] **Independent passive capture** — any native control is separately opted in, selected-session scoped, permission preserving and explicitly submitted
- [ ] **No direct harness file writes** — journals/configuration/credentials remain read-only to Drishya; a resumed native harness owns its normal writes
- [ ] **Redaction first** — anything persisted, indexed, exported or shown passes redaction before it lands
- [ ] **Provenance** — derived content is labelled; no location or causal link is drawn without evidence
- [ ] **Deterministic composer** — no wall-clock reads inside it; golden tests updated if choreography changed
- [ ] **No telemetry** added, in any form
- [ ] **UI only:** passes the freeze, truth and ten-minute tests in [`VISION.md`](../docs/VISION.md#8-the-standard), and still works with motion off and the map off
- [ ] **Schema:** touches the event schema? → labelled `schema` and agreed by both builders
- [ ] Durable decisions or experiment findings are recorded in the relevant docs when applicable.
