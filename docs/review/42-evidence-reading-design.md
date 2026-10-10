# Evidence entry and source reading — 10 October 2026

First bounded R1/R2 implementation from [41](41-developer-angles-and-reading-plan.md), responding to the independent developer reviews in [40](40-independent-product-review.md). This improves the questions developers can answer from evidence; it does not certify an IDE/native-chat replacement.

## Skills and precedence

All fourteen skills from [Emil Kowalski's repository](https://github.com/emilkowalski/skills) were installed with Codex's skill-installer into `~/.codex/skills`: animate-expo, animate, animation-vocabulary, apple-design, ask-sonner, break-ui, emil-design-eng, find-animation-opportunities, improve-animations, mobile-native, pick-ui-library, prototype, review-animations and write-swift. Reload Codex to expose them in its catalog. This installation is local to Yash's machine; Harsh needs his own installation. No skills/dependencies were added to the product.

Applied design engineering, desktop hierarchy, animation review and UI stress guidance. Swift/Expo/library-selection guidance is installed but not applicable to this existing React workspace. Builder direction and AGENTS remain authoritative: neutral surfaces, rich semantic source colors, true origins, unboxed prose and independent capture. Generic rules do not justify fake typing, arbitrary fast reading motion, more dashboards or a framework replacement.

## Design review

| Before | After | Why |
|---|---|---|
| Useful return-to-work evidence depends on discovering the reading-mark workflow | Visible **Review work** entry with changes, failures, checks, in-progress work and gaps | First-time users can find evidence without a previous mark |
| Long patches begin with unrelated context | Preview/full diff start near the first actual changed line, with earlier context still reachable | Make the change visible without inventing a summary |
| Current-file reading has thinner controls | Shared find behavior, real line navigation, wrapping, bounded copying and adjustable width | Practical code reading with clear current/historical identity |
| New entry crowds the narrow header | Compact accessible utility icons; Review remains visible | Preserve useful navigation without another toolbar |
| Settling allocation restores on mouse-down | Restore on click capture instead | Avoid shifting Expand's hit area before mouse-up; keyboard interruption stays immediate |

## Implementation boundaries

Review uses the existing whole-recording `since` service at boundary -1 for daemon recordings, not the resident projection window. Bundles use their supplied full projection. Existing bounds remain fifty file paths/twenty entries per outcome group, with actual totals and explicit remaining-count copy. No automatic reading mark, generated explanation, test-coverage inference or Git status claim. Combined daemon views are unavailable in this single-recording entry. Replay disables complete-recording review, preserving future-evidence boundaries.

Selecting a changed file prefers the first available captured change on the loaded trail page. A file with many earlier reads may still require trail paging; this is not a global first-change locator. Patches retain proposed/reconstructed qualifications and checks describe recorded order, not coverage. Previews retain original hunks/line coordinates and three preceding context lines when available. Full diff pages stay bounded to 120 captured lines; earlier context remains reachable.

Current files remain **On disk**, with refresh and a link to recorded work. Find is explicitly loaded-page-only. Go to line requests the correct 200-line page; range copying accepts only that page. Width resizing supports pointer and keyboard, clamped on narrow screens. No whole-file search, symbols, editing, unbounded file load or new backend endpoint. Historical readers reuse find behavior and typography while keeping captured range/provenance/as-of restrictions.

Frequent reading controls respond immediately. Existing meaningful real-material arrival/hover transforms remain; no copied evidence or animated characters. Neutral chrome leaves syntax/diff colors carrying meaning. Desktop/390-pixel screenshots were inspected, including selected changes with later checks and source with an active line.

## Validation and next work

Scoped stress checks cover long paths/MCP fields, bounded source pages, narrow forms, attachments and replay cutoffs. This is not a claim to exercise every break-ui catalog case. Browser setup now honors persisted workspace consent and waits for the actual enabled attachment picker after consent refresh. Broader testing exposed an Expand click during settling: restoring allocation on pointer-down could shift the target before pointer-up. It now interrupts on click capture, after the target is determined.

Final local checks: 309 units, typechecks, UI build, isolated offline package installation/import/authenticated API/restart, and all 35 affected browser journeys pass. The source navigation and interrupted Expand cases also passed two repeated runs. Hosted CI remains manual/publishing-only. Unrelated root package-manager edits are excluded.

R1/R2 remain incremental: failure-centric search previews, richer linked source/comparison context, repository-wide navigation and symbols need further work. R3 improves map navigation utility rather than replacing its renderer. R4 exercises real account-specific Claude/Codex turns, attachments, approvals, reconnect and native settings. R5 adds approved-root read-only Git evidence, separate from historical captures. R6 covers evidence handoff/wider developer utility. Preserve [41](41-developer-angles-and-reading-plan.md) and the native/release ledger in 36/37/39.

Later neutral reviews should test evidence trust, readability, navigation, native integration, review workflow, map utility, accessibility, motion and sustained performance separately. Agent ratings and attractive animation do not establish human adoption.
