# Evidence reading navigation

12 October 2026. Implements the first next task from [49](49-classic-disclosures-and-critical-review.md) and findings 2/4 of [50](50-comprehensive-developer-review.md). Classic stays active. Design work uses `emil-design-eng`; this increment deliberately uses immediate reading navigation, without new decorative animation or a movie transport. The builder's composer/menu/Home additions are planned separately in [52](52-composer-interactions-recordings-plan.md).

## Delivered behavior

| Before | After | Why |
| --- | --- | --- |
| Following another file replaces a source reader's local state | Back/Forward restores the prior reading visit | A dependency detour should not erase the code, patch or check being reviewed |
| Returning to a file starts at its first evidence/page | Retain selected evidence, comparison, action page/filter/width, source page/search/active line/wrap, patch page/layout and actual reader scroll | Restore the reading task rather than merely reopening the filename |
| A current-index import silently chooses historical availability | Explicit Captured work and Read current file actions | Dependency scope is clear before navigation; disk reading still requires consent |
| Closing the reader loses forward/back controls | Reading history remains in the right Evidence desk after a visit | Returning to the canvas does not make a saved reading location unreachable |
| Reopening a current file can show newly changed bytes without context | A changed native modification timestamp is labelled as changed since this reading visit | Current disk is reloaded; the feature does not pretend that it is an immutable historical snapshot |

Reading navigation spans historical file work, current disk readers and selected operation details. A captured patch → recorded later check → Back journey restores the same patch and change layout. Navigating explicitly holds viewport following; it does not stop capture or an explicitly playing replay clock. New destinations discard the abandoned forward branch, like normal navigation.

## Bounds and evidence safety

- Eight ephemeral visits per selected source/session and historical boundary. No browser storage, network history, telemetry or source exports are added.
- A visit holds at most 64 control/scroll slots. File reading retains at most two selected existing evidence references, including their captured patch metadata; it does not clone the session projection or cache fetched source/disk response bodies. Artifact data keeps its existing bounded page/cache lifecycle. Existing artifact page navigation retains at most 64 offsets.
- Source/session changes, entering/leaving replay and every replay cutoff change discard the trail before rendering. Saved future source selections cannot be recovered through Back after a rewind. Live capture updates do not erase independent reading visits.
- Restoring current disk reloads the approved file through the existing API. A changed modification timestamp is disclosed. It is not an atomic snapshot guarantee or a hash-based freshness claim; Git concurrent-content checks remain another task.
- Captured excerpts/patches retain their actual artifact/evidence identities. Unavailable source remains unavailable, even when navigation controls work. No missing file bytes or historical import relationship is inferred from current index proximity.
- Scroll restoration waits for actual bounded material allocation, and a wheel/pointer action cancels a pending restore. It never scrolls the main history on behalf of a source pane. Navigation is immediate for keyboard and pointer users; no reading task waits on motion.

Implementation: `lib/evidence-navigation.ts` provides the bounded pure trail; `EvidenceNavigation.tsx` scopes visits and reader control/scroll restoration. Existing ArtifactReader/DiffReader/FileHistory/CurrentDocument and Inspector remain the readers. ImportContext makes destinations explicit and guards asynchronous workspace approval against session/source switching. No daemon, event schema, contract, dependencies, native permission policy or capture behavior changed.

## Local verification

322 unit tests, both TypeScript checks and production build pass. 57 related browser journeys pass: all Classic refinements, connected workspace/native protocol simulations, product reading/history/replay/map/hover/aspect-ratio and both retained designs' current Git journeys. New regressions exercise an 800-line captured source detour with page/search/selected line/wrap/330 px scroll restoration and Forward, captured patch → test → Back with split layout, and approved current-file dependency Back/Forward. Unit checks cover branching, bounds and distinct current/captured/map destinations. Local screenshot: `.local/evidence-reading-navigation.png` (synthetic only, not committed). No hosted CI dispatched.

Remaining: composer professional layout/target/ownership/drafts, complete interaction/menu audit and Home workspace/time organization from 52; Git concurrent-content consistency; actual Claude Code/Codex account/permission/recovery/platform acceptance; richer diff/find/diagnostic/semantic and durable historical review utilities. This is an implemented reading increment, not closure of all 49 findings or certification that Drishya replaces every native/editor workflow.
