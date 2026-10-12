# Shared menu and control interactions

12 October 2026. Continues the next interaction increment from [52](52-composer-interactions-recordings-plan.md). New branch `codex/interaction-polish`; separate from merged PR #55 and the composer commit. Uses `emil-design-eng` and `animate`, including its button/popover recipes. This is shared utility behavior, not completion of the final line-by-line all-page audit requested in 54.

| Before | After | Why |
| --- | --- | --- |
| Escape closes every open utility disclosure and can leave focus hidden | Close the innermost active disclosure, return focus to its summary; a second Escape closes its parent | Nested Usage/history menus should behave predictably without losing keyboard position |
| Utility dismissal is wired only inside Viewer | Shared ProductShell hook handles pointer and focus dismissal | Home/session shells have one consistent utility policy |
| A short viewport can clip a native-settings or header menu | Measure available space above/below its actual trigger; bounded internal scrolling | Maintain reachable controls rather than expanding offscreen |
| Attachment Escape closes without restoring focus | Return focus to Add; focus leaving also dismisses | Keyboard users can continue where they opened the menu |
| Utility panels teleport in/out | Pointer-driven scale/opacity from the actual trigger corner, 160 ms, symmetric exit | Spatial consistency without a reading or capture delay |
| Generic buttons have weak press response | Pointer press scale .97, 130 ms | Immediate acknowledgment; keyboard actions remain instant |
| Summary-focused app shortcuts can interfere with native disclosures | Native summaries are excluded from global single-key actions | Space/menu keyboard use must not change replay/motion behind the menu |

## Motion and semantics

Native `details` semantics remain native; no duplicate labels/content, framework dependency or faux menu role is introduced. A shared `--ease-out` token is `cubic-bezier(.23, 1, .32, 1)`. Pointer menu opening/exiting uses the same real panel at scale .95→1 and opacity 0→1, from top right for header utilities and bottom left for composer controls. Modern CSS `@starting-style`, discrete visibility/display transitions and `::details-content` preserve finite exits without an artificial queue; unsupported engines fall back to immediate native disclosure. Closing panels cannot take pointer events during exit.

Keyboard opening/closing is immediate. Explicit Motion off, low-resource mode and reduced-motion preference disable the new transforms/transitions. Fine/touch pointer presses use actual active state; no mouse-tracking, hover drift, repeated pulses or content scanning. Capture/history/replay are independent of these utility menus. Agent families and file trees remain deliberate persistent disclosures, not outside-click utility popovers.

Attachment controls stay in their single real hidden panel through a finite pointer exit; HTML hidden semantics make closed controls unavailable. Outside click/focus closes without stealing the new target's focus; Escape focuses Add. Header/native menus and the attachment menu cap height to actual available viewport space and contain local overscroll.

## Local verification

324 unit tests, both TypeScript checks and production build pass. All 23 Classic/connected browser journeys pass in a full run; subsequent focused reruns cover updated attachment entry/exit/selection and keyboard/reduced-motion/focus/bounds behavior. Tests include nested Usage Escape focus, keyboard disclosure entry, pointer provenance, short 900×360 header bounds, outside Tab, reduced motion, attachment Escape return focus, native options and unchanged Follow, current source/evidence navigation, native protocol simulations and compact narrow composer. The settings test now waits for initial controller/workspace status before checking whether workspace consent is needed; the old immediate count raced async status and could leave consent ungranted. No approval requirement was removed or bypassed.

No hosted CI. Native account/platform/assistive-technology/touch-device and human motion acceptance remain release checks. The full UI component/CSS/motion sweep and adaptive test outcomes remain planned in 54; workspace/time Home grouping is the next feature increment. Local synthetic screenshot `.local/utility-menu-polish.png` is not committed.
