# 96 — Reachable Files navigation in a narrow Workspace

17 October 2026. A focused component-audit increment from84/85, following local draft comparison in95. Apply the installed Emil design-engineering and mobile-native skills; preserve the shared visualization, current-source consent and native execution boundaries.

| Before | After | Why |
|---|---|---|
| Expanded Files can cover Workspace header controls on a narrow screen | Measure the actual header and place the chooser beneath it; add a local Files trigger | Keep Back to agent, Split and New file reachable without reserving another canvas row |
| Files pressed state samples the viewport only when another render happens | A shared responsive subscription matches the820px layout boundary | Resizing updates the default and its accessible state; an explicit user preference survives resizing |
| Choosing a file leaves the overlay in front of the document | Close the narrow chooser and focus the selected document | Continue reading immediately, without losing the active pane |
| Closing can require finding the original toggle | Visible close control, outside click/focus dismissal and scoped Escape | Escape closes Files and returns focus, without closing Workspace or swallowing a native dialog's Escape |
| Inner search focus gets the old blue rectangle | One neutral focus outline around the field container | Preserve visible keyboard focus without nested chrome |
| Desktop-sized close target and small search input on touch |44px dismissal/Files targets and16px search text on coarse pointers | Improve touch access without disabling browser zoom |

The folder tree retains its virtual scroll restoration when hidden and reopened. Enabling current-source reading restores search focus if its consent button disappeared, but does not steal focus already inside the chooser. Valid file selection preserves the existing eight-tab limit and source isolation. Rejected selections retain the chooser and error; no new grant, source body persistence, native turn, direct file write, endpoint or dependency.

Frequent file navigation is immediate; there is no new decorative animation. Touch-only hover styling is gated by capability, and tree overscroll is contained locally. The desktop arrangement and Legacy visualization remain shared.

## Local validation

- Both typechecks, production build and445 unit tests across76 files pass. UI typecheck also rerun after the final focus dependency fix.
- Ten selected Edge journeys pass together: responsive Files selection/dismissal, responsive preference recovery, touch-emulated controls, multi-file drafts/comparison, large comparison, six-width Modern navigation, Git review, new-file/native preparation, Markdown and whole-file Find.
- The three new responsive journeys pass again after the final neutral focus/focus-restoration refinement.390px chooser and selected-file frames inspected locally; no header overlap. No native submission, hosted CI or private content committed.
- The installed [mobile-native skill](C:/Users/ASUS/.codex/skills/mobile-native/SKILL.md) explicitly says **“Test on hardware before calling it done.”** Browser and touch emulation do not certify physical-phone keyboard, Safari, rubber-banding or safe-area behavior. Physical-device acceptance remains a release check; this increment fixes the reproduced browser layout/navigation case.

Continue84's remaining whole-interface/Uiverse/palette audit and95's refreshed-source/joined workflow gaps. This is not completion of the product-wide queue.
