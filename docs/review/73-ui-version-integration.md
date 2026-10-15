# Integrating Canvas, Modern and Legacy

15 October 2026 - Yash with Codex. Builder request: review and merge both open UI PRs, preserving both designs.

## Review and resolution

PR #63 supplies the independent Modern entry, materials and map. PR #64 supplies Harsh's observation Canvas, bounded DOM nodes, captured-order connections, agent lanes, paged evidence reader and licensed local fonts. It reuses the existing capture/history/API contracts. Its controller changes are test-only waits for independently arriving inventory; consent-test changes retain the actual revalidation assertions.

Modern was squash-merged first as `354bc64`. Main was then merged into the Canvas branch in an isolated worktree, preserving both implementations. No version's entire conflict side was selected over the other. Original package-manager/artwork edits in the primary checkout remain outside the integration.

| Before | After | Why |
| --- | --- | --- |
| Canvas offered Workbench plus a disabled Modern placeholder; Modern offered only Legacy/Modern | Settings offers Canvas, Legacy and enabled Modern | Keep both builders' presentations usable together |
| Competing saved-version implementations could drop Canvas or revive the retired Workbench | Canvas/Modern/Legacy persist; old fresh URLs and saved values map to Modern | Preserve navigation compatibility and existing sessions |
| Concurrent review-72 documentation made global precedence ambiguous | Each review owns its route; current integration direction preserves all three | Future agents must not erase one design while following the other |

Canvas is the new-install default from Harsh's PR. Existing saved selections and explicit links take priority. Legacy stays available, and older Studio/Legacy route aliases remain functional. Modern loads its independent entry and does not load the Classic/Canvas stylesheet cascade. Canvas remains an observation interface; native prompting remains available in the connected versions.

## Checks

Combined source: frozen-lock installation, both TypeScript projects, 374 unit tests across 58 files, production build and 24 focused Canvas/Modern browser journeys passed locally. The added integration journey opens an imported synthetic recording and switches Canvas -> Modern -> Legacy -> Canvas, preserving its recording hash and excluding the other shell. Saved-version and fresh-link migration checks also pass. The full local browser suite then passed: **134 passed, two opt-in skips** (5.2 minutes). This includes the previously tracked Classic source-range hover journey.

No hosted CI, real native prompt or new platform/ten-minute acceptance is claimed. Canvas and Modern keep their documented utility/3D/native acceptance gaps; this integration does not certify product-wide release readiness. Supplied font licenses remain bundled. Neither source recording nor private screenshot is committed.
