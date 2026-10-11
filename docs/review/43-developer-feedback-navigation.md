# Developer feedback: useful navigation and repository focus

11 October 2026. Follows [42](42-evidence-reading-design.md) and the independent reviews in [40](40-independent-product-review.md). This is a bounded R1/R2/R3 continuation, not completion of every future capability in [41](41-developer-angles-and-reading-plan.md).

## Design decisions

Emil's installed design-engineering guidance is loaded and applied: useful defaults, predictable interaction, meaningful hierarchy and immediate frequent controls. Builder/evidence rules still take precedence. Current UI is preserved for the separately requested redesign.

| Before | After | Why |
|---|---|---|
| Recording search mixes navigation questions and briefly reports no results while loading | Explicit Captured work / Indexed files scope; loading/error feedback; current-index qualification | Developers know what they are searching and whether the request completed |
| Failed shell previews show log beginnings/endings while burying an error | Bounded excerpt of actual recognizable error lines, with original output offsets and expandable captured preview | Investigate the failure without reading boilerplate; no invented diagnosis |
| Reading a file does not directly lead into its import context | Optional import disclosure with directions, paging, neighbor reading and Focus on map | Connect source comprehension to repository navigation without another permanent panel |
| A selected file remains surrounded by the whole graph | Optional bounded direct neighborhood, actual coordinates, fitting with room for controls/labels, and return to full map | Answer what connects to this file without navigating the whole repository |

## Evidence and resource boundaries

Captured search continues to use the existing global service; daemon results remain bounded to fifty per recording. Search errors no longer look like empty successful results. Sequence replay filters results by the actual observation step before rendering snippets. Indexed files are names in the loaded index, not whole-file source search. Current/stale/partial qualifiers remain explicit, and a selected indexed file opens recorded work rather than pretending its name implies captured contents.

Failed-output selection recognizes literal error/failure/exception markers within the existing redacted preview, retains one preceding and up to four following lines, and labels the excerpt with preview-relative output coordinates. Unrecognized failures keep the existing folded preview. It does not fetch hidden output, infer root cause or alter stored evidence. Expand preserves the original captured preview; full output stays in the bounded operation reader.

Import context appears only for a current static index. It labels static relationships, stale/partial scope and the distinction from historical execution. Eight neighbors render per page. Current-file entry navigates current disk files only through the already approved daemon reader; historical entry navigates captured file work. No silent switch between modes. Source permissions, protected-path rules and backend redaction remain unchanged.

Focused maps retain indexed file coordinates and only deterministic static-import edges directly incident to the chosen file. At most sixty-four connections plus the selected file render; the actual resolved degree is reported. Missing files and files-only maps do not acquire invented edges. The main map/search still reaches the full index, and All files/Show full map restores the wider view. Framing reserves room for existing controls and labels. This is navigation, not a new graph engine, inferred architecture or execution animation.

## Validation

313 units, typechecks, UI build and isolated offline package install/import/authenticated API/restart passed. All 38 affected browser journeys passed together; a final targeted search/replay assertion also passed. New journeys cover current-neighbor reading, bounded map focus/full-map return, separated search scopes and buried error previews. Existing native attachments, controls, current/historical identity, long paths/MCP fields, narrow layout, replay cutoffs and hover/scroll pass. The settled focused map screenshot was inspected after correcting initial framing to leave room for side controls.

Local testing only. No GitHub Actions dispatched, no real user journals committed, no backend/schema/dependency change. Unrelated package-manager changes remain local.

## Remaining scope and the next design

The direct reviewer findings for evidence entry, relevant patch/failure previews, search discovery, source reading and bounded map focus now have implemented improvements. This is not human adoption validation. Genuine native account/version/platform acceptance, approved-root read-only Git status/base/head/diff, reviewed-hunk progress, privacy-reviewed handoff, symbols and genuine multi-agent workflows remain the explicit R4–R6/release backlog. They must not be recorded as done because a mock transport or a theme works.

The builder now authorizes a separate redesign from scratch using the loaded skills, preserving backend and product concepts and keeping the current interface as a backup. That means a coherent new visual composition, typography, materials, reader/tool/composer treatment and meaningful motion—not just changing palette tokens. Keep the continuous work world, file/tool origins, real source/diffs/outcomes, selectable unboxed prose, independent capture and clear native boundaries. Preserve the existing experience behind an explicit switch; use a separate major-change branch and compare real working journeys, including long/narrow/keyboard/reduced-motion cases. Do not create more disposable standalone HTML studies or couple capture to the new renderer. Color/theme variations can follow once the new design is coherent.
