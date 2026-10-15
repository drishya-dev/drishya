# 80 — Modern breadcrumb header and shared panel material

15 October 2026 · Yash with Codex · implementation `5ec7578`, PR #65.

The builder requested Files use Toolbox’s gradient and asked for a distinctly different header. This changes only the surrounding Modern chrome; review 79 still governs Git review and Legacy remains the visualization owner.

Applied installed Emil design engineering guidance: clear hierarchy, compact actionable controls, bounded long content and immediate repeated navigation. No decorative arrival or text animation was added to the header.

| Before | After | Why |
| --- | --- | --- |
| Files fades to a differently tinted lower surface; Toolbox has another material | Both use the same shared graphite gradient token | Make the rails feel like parts of one workspace |
| Small centered project label above the session title | Single horizontal breadcrumb: Home, repository badge, session title | Give the title a readable line and establish workspace context |
| Unstructured right utility spacing | Bounded Search affordance, then Settings and workspace utilities | Keep regular navigation predictable |
| Inherited column/mobile header placement | Explicit row and grid ownership, title constrained before utilities | Prevent the project above/title below bug and mobile overlap |

Only captured workspace identity is shown. Unknown roots keep their existing truthful source-context label. At narrow widths the project badge and wordmark collapse while Home, session title and utilities stay reachable. Session title truncation preserves its full native title tooltip. The header retains bounded backdrop blur, existing low-resource/reduced-motion paths and shared menu/focus handling. No capture, permission, native prompt, stored content or Legacy card/graph logic changes.

Validation: both typechecks and production build pass. All 14 Modern browser journeys pass across the initial run and final responsive correction rerun; the added geometry checks assert the title stays inside the header and ends before the utility controls at 1920, 1280, 900 and 390 px. Existing local routes, Settings, attachments/consent, toolbox/MCP origins, patch reading and relocated review dialogs remain covered. Actual local Codex recording visually inspected; computed Files/Toolbox gradient equality confirmed. No real prompt/new real-workspace consent or hosted CI. Private screenshots stay ignored; user artwork/package-manager changes remain excluded. Visual preference remains the builder’s assessment.
