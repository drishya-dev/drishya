# REL-4 release preparation — 30 October 2026

Publishing preparation was explicitly requested with the remaining P2 work. Final release acceptance is **NOT VERIFIED**; nothing is published or uploaded.

## Verified repository entry points

package.json requires Node 24 and pins pnpm 10.34.5. Existing commands are `pnpm typecheck`, `pnpm test`, `pnpm ui:build`, `pnpm test:browser`, `pnpm package:verify` and `pnpm check:real -- <case>`.

.github/workflows/ci.yml is manual workflow_dispatch only. It checks types/units/build/demo and browsers on Windows/Ubuntu, and package verification on Windows/Ubuntu/macOS. Its hosted macOS package job does not certify physical/native Mac acceptance. No workflow was triggered by this preparation.

## Final-candidate sequence

After the feature batch is finished, create an isolated checkout with its own frozen install. Rebuild UI first, then run the full local types, units, full browser command and package verification once. For failures compare the unchanged test alone on clean main and candidate; do not weaken assertions or infer a main failure merely from a rerun passing. Preserve the real-session acceptance matrix and exact incomplete device/human gates.

Review the packed CLI's install/setup and privacy boundaries, fallback assets and persisted restart. Select the exact reviewed candidate and manual hosted CI run only after the local gate. No normal commit should spend hosted CI minutes. Actual release publication/upload remains a separate explicit action after a concrete reviewable candidate.

The feature branches and shared-file handoff are still in progress, so final package/CI/release results are deliberately not claimed here.
