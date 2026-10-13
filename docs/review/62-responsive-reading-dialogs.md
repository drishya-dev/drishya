# Reading dialogs survive responsive layout changes

13 October 2026. Installed `emil-design-eng` review uncovered a real narrow-layout defect while inspecting Git reading: a native dialog mounted inside the desktop evidence rail disappeared when that ancestor became `display:none` at mobile widths. The earlier narrow screenshot showed the canvas instead of the supposedly open reader.

| Before | After | Why |
| --- | --- | --- |
| Native reading dialogs inherit a disappearing sidebar's DOM visibility | Render the same dialog through a React portal into `document.body` | A reading task stays open through resize; responsive chrome cannot hide its content |
| Geometry-only narrow test passes with an invisible dialog | Assert the open Git dialog remains visible after desktop-to-mobile resize | Test the user's actual reading task, not only document overflow |

React navigation/source context is preserved through the portal; dialog text is not duplicated. Existing native modal/modeless behavior, Escape, focus restoration, content bounds, root theme tokens and modeless map positioning remain unchanged. No new motion, reading delay or capture/backend/schema change. Classic/Studio/current/captured/native reader regressions are exercised together with the Git tools increment. No hosted CI.
