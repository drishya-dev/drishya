# 97 — More readable sessions in less Home chrome

18 October 2026. A separate component-audit increment from84/85 after responsive Files merged as PR81 (`f4301a5`). Uses the installed Emil design-engineering skill. This is a refinement of the working session library, not a new dashboard or replacement visualization.

| Before | After | Why |
|---|---|---|
|100px desktop rows with10px metadata |80px desktop rows with14px titles and12px metadata | Scan more sessions while making the useful text easier to read |
| Intro, resume and header consume substantial vertical space | Smaller measured chrome, shorter resume and short-window rules | Give session history more of the screen |
| Phone inherits tiny titles/metadata |14px titles,12px metadata and104px row allocation | Allow two title/metadata lines without squeezing desktop density into a narrow screen |
| Virtual spacers assume100px regardless of CSS | One React row allocation also supplies CSS variables and every spacer/window calculation | A visual density change must not create gaps or skip history |
| Resizing changes row height beneath the saved scroll pixel | Preserve the session and fractional row offset at the responsive boundary | Keep the developer's place while resizing within the current window |
| Refresh label competes with the phone heading | Compact icon control retaining its accessible name | Keep the heading and refresh action distinct |
| Small input and repeated controls on touch |16px coarse-pointer search text and44px utility targets | Retain browser zoom and improve touch access |

The complete merged imported/discovered inventory, workspace/time/harness filters, native picker semantics, journal-update hints, resume and metadata-only location recovery are retained. No new native action, telemetry, source-body persistence, endpoint or dependency. Existing restrained hover/color feedback and reduced-motion behavior remain; list navigation does not get a decorative transition. Jet Black and all saved palette choices remain unchanged.

[Uiverse](https://uiverse.io/) was revisited as requested for component references. No catalog element code or package was copied into this increment: retain the existing controls and fix hierarchy, dimensions and scanning behavior. The broader all-component reference/palette pass in84 remains open; browsing the catalog alone is not completion of it.

## Local validation

- Both typechecks, production build and445 unit tests across76 files pass.
- Seven selected Edge journeys pass together: filters/menu keyboard behavior,160-session reachability/resize, both harness session/Home/settings/reload journeys, one-list deduplication, actual-library responsive Home and actual-library evidence-search navigation.
- Final density/touch journeys pass after the scoped coarse-pointer styles. The160-session case waits for virtual rows to mount before sampling the resize anchor, rather than treating an empty intermediate test sample as a session identity.
- The existing opted-in private library was checked after discovery completed, with597 sessions across317 workspaces in that local snapshot. Desktop1440×960, phone390×844 and short1440×640 frames inspected; no committed titles/paths/journals/screenshots. Long multilingual test titles and all160 fixture rows remain reachable. Narrow390×640 list retains useful scrolling space.
- No hosted CI or native submission. Physical-phone, platform, assistive-technology and sustained human-use acceptance remain open; emulation does not certify those.

Next:84's untouched readers/dialogs/menus/palette review, refreshed-source versus retained-base comparisons and the joined evidence→native correction→recorded-check workflow.92 keeps optional review tools out of the main canvas. This increment does not finish the whole queue.
