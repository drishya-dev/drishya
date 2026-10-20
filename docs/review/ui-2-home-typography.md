# UI-2 — Home typography and contrast

20 October 2026 · PR #145. Home only; remaining UI-2 surfaces stay open.

| Before | After | Why |
|---|---|---|
| Workspace paths/counts, date groups and footer at10px; some phone metadata9px | At least11px for rendered metadata, including narrow/short-window rules | Readable supporting information without changing the compact row model |
| About and refresh labels11px; one phone rule10px | At least12px for these controls and filter labels | Match the control floor while preserving icon-only controls on phones |
| Fixed pale Claude icon tint | Existing `--edited` semantic token | The pale tint fails on Paper; theme tokens are already guarded across surfaces |

The established font pair, list allocation, fixed row/section measurements and virtualization are unchanged. CSS declarations were edited in place rather than adding a global override sheet. No motion, new library, external request or shared palette change.

## Local acceptance

- Running real redacted-store Home inspected before/after: Drishya and Skeletongraph, Codex and Claude rows. Actual small metadata now computes to11px; About/refresh compute12px. Screenshots inspected locally.
- Two new Edge checks: metadata/control floors and computed Claude mark contrast across Jet/Paper/Midnight/Mocha/Tokyo/Nord/Gruvbox;300-session long/multilingual-title fixture at1440/390/320px, no horizontal page overflow, footer reachable, Home/End reaches rows0/299 with fewer than50 mounted session rows.
- Two existing Home GitHub journeys run with `DRISHYA_REVIEW_STORE` pointing to the real redacted local copy: responsive placement, keyboard focus, motion/resource/forced-color fallbacks and no automatic external requests.
- Existing `palette-contrast.test.ts` passes all seven palettes, requiring at least4.5:1 for semantic/secondary text on the base and elevated surfaces. UI typecheck and production build pass. No hosted CI.

These viewport checks are emulation; they do not certify every screen, physical device, Home discovery path or full-product typography. Saved filters were cleared explicitly for real-session visual inspection. Other UI-2 surfaces remain on TASKS.
