# FINISH-0 · Foundations: the spec

Opus, 6 November 2026. Method: [finish-pass.md](../finish-pass.md). FINISH-0 is split into three whole items, because the change spans about 40 files:

| Part | Scope |
|---|---|
| FINISH-0a | Tokens, buttons, switches and inputs |
| FINISH-0b | Overlays: one popover, menu, select, tooltip and dialog system |
| FINISH-0c | Loading, empty and error states |

0a merges first. 0b and 0c build on its tokens and may run in parallel, because their files do not overlap. Every later FINISH item uses these and converts its own component's literals to them.

> **Lands in Clarity (6 Nov, later).** Every part below is built in the Clarity UI version ([clarity-1-version.md](clarity-1-version.md)), after CLARITY-1. Tokens go in `apps/ui/src/clarity/tokens.css` and the rules in `@layer clarity` scoped to `[data-ui-skin=clarity]`. Where this spec says to convert or delete rules in shared and modern sheets, read it as: Clarity's layer overrides them, and Modern's sheets stay untouched. New components (Switch, SearchField, Popover, Menu, Select, Tooltip, the states) render only under `useSkin() === 'clarity'`; Modern keeps its markup. **0a adds:** Inter (variable, OFL) bundled locally as Clarity's interface face, and Clarity's own palettes (Yash gave full freedom over themes and colour): one dark graphite default and one light default first, each with the full role set, every text and meaning colour at 4.5:1 or more on its canvas and both panel surfaces. The other palettes follow in FINISH-12. The token values from the closed #351 (`claude/finish-0a`, f2d4082c) may be reused.

## What the walk found (6 Nov, real sessions, 600 / 1440 / 2560 px)

Evidence: screenshots in `.local/wt-v2/.local/audit/shots/f0-*` and `f1-*`, the detector JSON in `.local/audit/impeccable/f-*`, and a code inventory.

1. **Three menu systems, and none of them is finished.**
   - `<details>` menus (`.workspace-menu`, `.desk-options`, `.permission-policy`, `.prompt-menu`, `.session-segments`, `.review-tools`, `.station-agent-menu`) animate open. Four of them close instantly.
   - `ProductMenu` (the right-click menu) has no motion at all and unmounts immediately.
   - The `popover` ones (`.git-entry-choices`, `.search`) differ again: `.search` has an enter and no exit.
   
   This is the root of Yash's "opens but does not close".
2. **28 native `<select>`s.** They are the Home filters, the composer's Model and Effort, replay speed, Git branch and graph pickers, readers and review tools. Each opens the operating system's own list, which ignores the palette, the type and the motion. These are what Yash called "too basic".
3. **Settings toggles are native checkboxes** (`ProductShell.tsx:137-145`). There are three switch looks across the product (`.mini-switch`, `.workspace-follow`, the checkboxes).
4. **296 native `title=` tooltips.** They come after the operating system's 1–2 s delay, in the operating system's style. Icon-only header buttons have nothing else to say what they are.
5. **No spacing scale.**
   - 54 distinct padding, margin and gap values; 5, 7, 9 and 14 px are common.
   - **No z-index scale:** about 25 literal values from 1 to 180.
   - **No duration tokens:** 20 durations, from 120 ms to `.2s`, and five or more easings, including CSS `ease` and `linear` on UI.
   - Two primary button styles fight: `styles.css:62` and `atelier.css:47`.
6. **Counts jump.** In the Toolbox's Available tools, numbers like 4,867 and 4,420 sit on different baselines, because the figures are neither tabular nor lining.
7. **No shared states.**
   - Opening a large session shows only "Loading history…" centred on black. The header, the panels and the import progress the app already knows are all missing.
   - There are ten empty-state classes and five error classes, each different.
8. **Settings window:** the last palette card's subtitle is cut by the window's bottom edge, because there is no bottom padding in the scroll area. The "Local preferences" note is 11 px sentence text, which the detector flags. It is below the floor for sentences.
9. **Composer chrome:** Connection & permissions is a text wall (UI-28 owns its content, and FINISH-4 owns the composer). Model and Effort are the native selects above.

**Lens results**
- **Impeccable detector:** effectively clean. It flagged the 11 px settings note and em dashes, which are captured agent prose and therefore a false positive. The problems are consistency and motion, which a rule scan cannot see.
- **Impeccable critique** (Operate mode, "earned familiarity": the same control vocabulary everywhere; every component has default, hover, focus, active, disabled, loading and error states; overlays escape their container): fails on consistency, standards and states.
- **Emil:** origin-aware popovers; exits faster than enters; never scale from 0; press scale 0.97; no motion on keyboard-initiated opens; transitions, not keyframes, for anything that can be interrupted.
- **Taste:** one button vocabulary, exactly one filled button per view, a 4-based spacing scale, sentence-case labels and never tracked capitals, focus rings that settle, nothing hovering slower than its token, no overshoot.

**Rejected from Taste:**
- "Never violet": the Jet palette's indigo accent was chosen by Yash on 3 Nov.
- "Nothing under 13 px": Drishya is a dense tool. 11 px stays the floor for marks and counts, 12 px is the floor for any sentence or label, and 13 px is the body.

## FINISH-0a · Tokens, buttons, switches, inputs

### Tokens (add to `apps/ui/src/tokens.css`)

**Spacing (4-based):**

| Token | Value |
|---|---|
| `--sp-0h` | 2px |
| `--sp-1` | 4px |
| `--sp-1h` | 6px |
| `--sp-2` | 8px |
| `--sp-3` | 12px |
| `--sp-4` | 16px |
| `--sp-5` | 20px |
| `--sp-6` | 24px |
| `--sp-8` | 32px |
| `--sp-10` | 40px |
| `--sp-12` | 48px |
| `--sp-16` | 64px |

`--sp-0h` and `--sp-1h` are only for control internals. 5, 7, 9, 10 and 14 px are retired as each component is finished.

**Layers:**

| Token | Value | Use |
|---|---|---|
| `--z-stage` | 1 | |
| `--z-raised` | 10 | Stage overlays, connectors |
| `--z-sticky` | 20 | Header, composer, rails |
| `--z-panel` | 30 | Files, Toolbox, floating windows |
| `--z-popover` | 40 | Menus, selects, popovers, tooltips |
| `--z-dialog` | 50 | |
| `--z-toast` | 60 | |

Map every literal in the shared and modern sheets to these. In component sheets, the owning FINISH item maps them.

**Elevation:**

| Token | Value |
|---|---|
| `--elev-pop` | `0 8px 24px rgb(0 0 0 / .36), 0 0 0 1px var(--line-2)` |
| `--elev-dialog` | `0 18px 48px rgb(0 0 0 / .48), 0 0 0 1px var(--line-2)` |

Light palettes (Paper, Daylight, Royal) use .12 and .18 alpha. Panels stay flat with a 1 px hairline: no shadow.

**Motion** (MOTION-4: a little slower and smoother than MOTION-1's 120–160 ms):

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.23,1,.32,1)` | Everything that enters or exits |
| `--ease-move` | `cubic-bezier(.65,0,.35,1)` | Something travelling on screen: an indicator, a reflow |
| `--dur-press` | 120ms | Press in; release 160 ms |
| `--dur-hover-in` / `--dur-hover-out` | 140ms / 200ms | Background, border, colour |
| `--dur-pop-in` / `--dur-pop-out` | 200ms / 150ms | Menus, selects, popovers |
| `--dur-tip-in` / `--dur-tip-out` | 140ms / 100ms | Tooltips |
| `--dur-dialog-in` / `--dur-dialog-out` | 240ms / 180ms | Dialogs, floating windows |
| `--dur-panel-in` / `--dur-panel-out` | 240ms / 180ms | Side panels, sheets, disclosure content |
| `--dur-move` | 280ms | Indicators sliding, list reflow |

Retire CSS `ease`, `linear` (except progress) and every literal duration in shared and modern sheets. The stage's five moves (Lift, Emit, Settle, Surface, Resolve) are FINISH-6's to retune; leave them alone here.

**Rules that every sheet follows from now on:**

1. **Every enter has its exit.** The exit animates the same properties in reverse, at the `-out` duration. An element that animates in is kept mounted until its exit finishes (`allow-discrete`, the `:popover-open` and `@starting-style` pair, or WAAPI with `requestClose`, as `ReadingDialog` already does).
2. **Keyboard-initiated opens and closes are instant, both ways.** Pointer opens animate both ways. The existing `data-ui-press` attribute is the switch.
3. **One gate, and it falls back softly.** Motion runs under `:root[data-ui-motion]:not([data-low-resource])` with `prefers-reduced-motion: no-preference`.
   - **Reduced motion:** opacity only, same durations, no transform.
   - **Low resource:** no animation.
4. **Transitions, not keyframes,** for anything that can be interrupted: menus, switches, hovers.

**Type additions:**
- `font-variant-numeric: tabular-nums lining-nums` on every count, duration, size and time. Apply it once in a shared `.num` class and on `:is(td, .count, [data-count], time)` in shared sheets.
- `--text-2xs` (11 px) only for marks and counts. Any sentence or label is at least `--text-xs` (12 px).
- Group labels are sentence case, 12 px, `--weight-medium`, `--t3`. No tracked capitals anywhere (Home's "WORKSPACES", "TODAY" and "YESTERDAY" become "Workspaces", "Today" and "Yesterday").

**Focus:**
- **Shape:** one ring everywhere, `outline: 2px solid var(--focus); outline-offset: 2px`, on `:focus-visible` only.
- **Motion:** pointer users never see it. Keyboard users see it settle from offset 4 px to 2 px over 140 ms.

### Buttons (one system; delete the competing rules at `styles.css:58-63` and `atelier.css:46-47`)

| Variant | Look | Use |
|---|---|---|
| `.btn.primary` | `--palette-active` fill, white text (Paper: `--t1` on the accent wash, contrast ≥ 4.5:1) | Exactly one per view, for the main action |
| `.btn` (secondary) | `--s2` fill, `--line-2` border, `--t1` text | Every other labelled action |
| `.btn.ghost` | Transparent, `--t2` text; hover `--s2` fill | Toolbar actions next to content |
| `.icon-btn` | 28 × 28 (24 in dense rows), transparent, `--t2`; hover `--s2` | Must carry a Tooltip (0b) and an `aria-label` |
| `.btn.danger` | Secondary with `--fail` text; hover `--fail` wash | Destructive actions only |
| `.link` | Text, `--source`; underline on hover | Inline navigation |

- **Heights:** `--control-sm` 24, `--control-md` 28 (default), `--control-lg` 32.
- **Padding:** `0 var(--sp-3)`, or `0 var(--sp-2)` for sm.
- **Radius:** `--round-sm`.
- **Label:** `--text-xs` medium. An icon plus a label has an `--sp-1h` gap and a 16 px icon.

States, all of them, on every variant:

| State | Look and motion |
|---|---|
| Hover | Fill and border at `--dur-hover-in`, back at `--dur-hover-out`. Fine pointer only (`@media (hover:hover)`). |
| Press | `scale(.97)`, pointer only, `--dur-press`. Release at 160 ms. |
| Focus-visible | The ring above. |
| Disabled | `opacity .45`, `cursor: not-allowed`, no hover. The reason goes in a Tooltip (0b), not `title`. |
| Loading | A 12 px spinner replaces the leading icon (or prefixes the label). The width is locked, so nothing jumps. `aria-busy`. |
| Selected (toggles, segmented) | `--s3` fill, `--t1` text, `--line-3` border. |

**Segmented control** (`.seg`, `.workspace-toggles`): one style.
- **Track:** `--s1`, 1 px `--line` border, 2 px inner padding.
- **Indicator:** an `--s3` pill that slides to the chosen option over `--dur-move` on `--ease-move`. The label changes colour, not weight, so nothing shifts.

### Switch (`components/Switch.tsx`, new)

- **Shape:** `role="switch"` button with `aria-checked`, a 28 × 16 track and a 12 px knob.
  - Off: `--s3` track, `--line-2` border.
  - On: `--palette-active` track.
- **Motion:** the knob travels 12 px over 160 ms on `--ease-out`, and the track colour follows. While pressed, the knob stretches to 14 px wide. Space toggles it.
- **Label:** on the left at 13 px `--t1`, with an optional description below at 12 px `--t3`. The whole row is the hit target.
- **Replaces:** the 7 Settings checkboxes, `.mini-switch`, the Follow switch's look (keep its role) and the switches in Home, Git review and the readers. A true multi-select checkbox in a list (Review packet builder) stays a checkbox, styled: 14 px, `--round-xs`, with a check that draws over 120 ms.

### Inputs

- **Text field:** heights 28 / 32, `--s1` fill, 1 px `--line-2` border, `--round-sm`.
  - Hover: `--line-3`.
  - Focus: `--focus` border plus a 3 px ring at `color-mix(in srgb, var(--focus) 25%, transparent)`, at `--dur-hover-in`.
  - Placeholder: `--t4`.
  - Text: `--text-sm`.
- **Search field:** a 14 px leading search icon. A clear button appears once there is text. Escape clears, then a second Escape blurs. One component, `SearchField`, used by Home, Files, Toolbox, search and readers.
- **Error:** `--fail` border and a 12 px `--fail` message under the field, which says what to do.

### FINISH-0a acceptance

- Token, button, switch and input tables in this spec are implemented. The competing button rules are deleted.
- Every shared and modern sheet uses the spacing, layer, elevation and motion tokens; `rg` finds no literal z-index or duration left in them. Component sheets are converted by their FINISH items.
- Counts are tabular. The Toolbox's Available tools column aligns.
- Every button, switch and field in at least Home, the header, Settings, the composer and Git review shows all of its states correctly. Check by keyboard and by pointer, at 600 and 1440 px, in Jet, Paper and Midnight.
- The common acceptance in [finish-pass.md](../finish-pass.md).

## FINISH-0b · Overlays: popover, menu, select, tooltip, dialog

### `Popover` (`components/overlay/Popover.tsx`, new): the base

- **Layer:** the native `popover` attribute. `auto` for menus and selects, `manual` for tooltips. It sits in the top layer, so no overflow ancestor clips it and no portal is needed.
- **Position:** anchored by measuring the trigger. Below by default; above when there is not enough room. Aligned to the trigger's start edge; 6 px gap; at least 8 px from the viewport. It repositions on scroll and resize while open.
- **Origin:** sets `--transform-origin` on the side it opened from: the trigger edge, or the pointer point for context menus.
- **Look:** `--s1` (Paper `--s1`), `--elev-pop`, `--round-md`, `--sp-1` padding, `--z-popover`. Minimum width = the trigger width; maximum 360 px; maximum height `min(60dvh, 420px)` with an internal scroll.
- **Motion:**

| | Opacity | Transform | Duration | Curve |
|---|---|---|---|---|
| Enter | 0 → 1 | `scale(.96) translateY(-4px)` → none (`+4px` when opening upward) | `--dur-pop-in` | `--ease-out` |
| Exit | 1 → 0 | none → the same start transform | `--dur-pop-out` | `--ease-out` |

  - It stays in the top layer until the exit ends: `:popover-open`, `@starting-style`, `overlay` and `display` with `allow-discrete`.
  - Keyboard open and close are instant. Reduced motion is opacity only. Low resource is none.
- **Behaviour:** light dismissal (outside click, Escape) returns focus to the trigger. Only one `auto` popover is open at a time (the platform does this).

### `Menu` (on Popover)

- **Roles:** `role="menu"`; items are `menuitem`, `menuitemradio` or `menuitemcheckbox`.
- **Item:** 28 px rows with `--sp-2` horizontal padding and `--round-sm`.
  - Contents: a 16 px leading icon (optional, but consistent within a menu), the label at 13 px `--t1`, then on the right a key hint at 12 px mono `--t4`, or a check for the selected radio.
  - Hover and active: `--s3` fill. There is no motion on item hover; the fill snaps, because people move through a menu quickly.
- **Groups:** separated by a 1 px `--line` with `--sp-1` margin. A group label is sentence case at 12 px medium `--t3`.
- **Keyboard:** Up and Down (wrapping), Home and End, typeahead, Enter and Space, and Escape (closes and returns focus). A submenu opens with Right and closes with Left. Only if a submenu is needed (none today).
- **Replaces:** every `<details>` menu (`.workspace-menu`, `.desk-options`, `.permission-policy`, `.prompt-menu`, `.session-segments`, `.review-tools`, `.station-agent-menu`, `RecordedWorkMenu`, `WorkspaceOptions`) and `ProductMenu` (the context menu, origin = pointer). Each keeps its items and actions exactly. This part changes the container, not the content; content belongs to each component's FINISH item. `lib/dismiss-menus.ts` is removed once nothing uses it.

### `Select` (on Menu)

- **Trigger:** a secondary button. It shows the current value, then a 12 px chevron that turns 180° over `--dur-pop-in` while open. Width = the widest option (measured once), so the trigger never jumps.
- **List:** `menuitemradio` items with a check on the current one. The list opens with the current item under the pointer, scrolled into view.
- **Keyboard:** on the closed trigger, Up and Down change the value without opening (as native selects do). Enter, Space and Alt+Down open it. Typeahead works in both states.
- **Replaces all 28 native `<select>`s:**
  - Home filters
  - Model and Effort
  - replay speed (×2)
  - Git branch, graph and history pickers
  - `CapturedResources`, `DelimitedDataReader`, `FileHistory`, `LibrarySearch`, `StoredToolResult`, `CapturedCommands`, `CapturedResultViews`, `DeveloperWorkspace`, `InvestigationActions`, `ReviewInsights`, `SessionHome`, `ProductShell`
  
  Values, labels and behaviour are unchanged. `rg "<select"` in `apps/ui/src` returns nothing.

### `Tooltip`

- **Content:** one line, or two at most, at 12 px `--t1` on `--s3` with a 1 px `--line-2` border, `--round-sm` and `--sp-1h --sp-2` padding, 280 px wide at most. A key hint follows in `--t4` mono (for example "Search  /").
- **Placement:** above the trigger, flipping below, centred, 6 px gap.
- **Timing:** opens after 500 ms of hover or immediately on keyboard focus. Within 400 ms of another tooltip closing, the next opens instantly with no animation (Emil).
- **Motion:** enter opacity plus `scale(.97)` → 1 over `--dur-tip-in`; exit reverse over `--dur-tip-out`.
- **Behaviour:** never interactive. It hides on pointer down. It is linked with `aria-describedby`; the `aria-label` stays the name.
- **Replaces:** `title=` on every icon-only button, and on disabled buttons (the reason). Covers the header actions, the panels' controls, the Toolbox, the composer icons, the rail, Git review and the readers. A `title` on truncated text stays until its component's FINISH item. Convert at least the shared chrome and all icon-only buttons; count before and after in the PR.

### Dialogs (`ReadingDialog`, already paired; retune only)

- **Motion:** enter over `--dur-dialog-in` (opacity plus `scale(.97)` from centre); exit over `--dur-dialog-out`. A modeless reader opens from its trigger's side (origin set as in Popover).
- **Backdrop:** fades over the same durations.
- **Settings window:** the content scroll area gets `padding-bottom: var(--sp-6)`, so the last card is never cut. The "Local preferences / Saved on this browser" note moves to 12 px.
- **Screen view and image reader:** use the same dialog motion and exit (`ScreenView` closes immediately today, and its `screen-out` is dead). The briefing `.sheet` (`Viewer.tsx:659`) gets an Escape handler and the panel motion.

### Disclosures (`<details>` that reveal content, not menus)

They keep native `<details>`. The content enters with opacity plus `translateY(-2px)` over `--dur-panel-in`. On close it leaves with the reverse over `--dur-panel-out`, via `::details-content` `allow-discrete` where supported, and immediately elsewhere. They never animate height.

### FINISH-0b acceptance

- No native `<select>` and no `<details>`-based menu remain. One Popover, Menu, Select and Tooltip implementation is used everywhere.
- Every overlay opens and closes with paired motion when opened by pointer, and instantly when opened by keyboard. Check each in slow motion (4×) at 600 and 1440 px. The PR lists every overlay checked, open and close.
- Positioning holds at the viewport edges: the right-edge header menus, bottom composer menus and a context menu at the corner flip or shift and are never clipped.
- Keyboard: full menu and select patterns, focus return, typeahead.
- Real sessions of both harnesses: Home filters, Model and Effort on a connected session, replay speed, Git pickers, the context menu on files and cards, the reader selects.
- The common acceptance.

## FINISH-0c · Loading, empty and error states

### `LoadingState`

- A skeleton in the shape of what is coming, never a centred word on black. Shimmer is a 1.6 s linear sweep, at most 6 % luminance; off under reduced motion and low resource.
- **Opening a session:** show the real header immediately (title, harness, repository and branch are known from Home), the panels' frames, and three prose-line skeletons in the reading column.
  - **Import progress:** when an import is running, show its progress under the header from the existing import-progress data: "Reading the journal · 42 %", tabular, updated in place. Never invent a percentage.
  - **Long load:** after 8 s with no progress, say what is happening ("Building the history for 18,400 steps").
- Lists (Home sessions, search results, Changes) use row skeletons at their real row height.

### `EmptyState`

- **Content:** a 20 px icon in `--t3`, a title at 13 px medium `--t1`, one sentence at 12 px `--t2` saying why it is empty and what fills it, and at most one action (a secondary button).
- **Layout:** centred in its region, at most 360 px wide.
- **Replaces:** the ten empty classes (`.home-empty`, `.desk-empty`, `.insights-empty`, `.atlas-empty`, `.commands-empty`, `.history-empty`, `.map-empty`, `.queue-empty`, `.screen-empty`, `.mh-empty`).
- **Copy:** the existing text is kept unless it fails "says what it is". Each changed line is listed in the PR.

### `ErrorState` and `Notice`

- **ErrorState:**
  - A thin `--fail` contour (1 px) around the region's content frame, which is the doctrine's error-only red contour.
  - The title says what failed ("Could not read this journal").
  - One sentence says why, from the captured cause.
  - An action (Retry, or Open settings).
  - Technical detail sits behind the shared Original toggle.
  
  Replaces the five error classes and the page-level `.center.notice`.
- **Notice:** an inline line for info, warning or failure with a 14 px icon. It enters with opacity over `--dur-panel-in` and leaves with the reverse over `--dur-panel-out`. `NoticeLine` and `DeclinedLine` keep their roles and take this look.

### FINISH-0c acceptance

- Opening the largest local Claude Code and Codex sessions (sizes and id prefixes in the PR) shows the header and skeleton within 100 ms of the click, then real import progress, then the history. There is no black screen.
- Every empty and error state listed is reached on a real or scratch session (for example a session with no files, or a journal deleted after discovery), and screenshotted in `.local/`.
- The common acceptance.

## Builder notes for the Sonnet session

- Build 0a, then 0b and 0c, each on its own branch from main: `claude/finish-0a`, `-0b` and `-0c`.
- Keep component content exactly as it is. These parts change containers, tokens and states only.
- Delete what you replace: the old menu CSS, the dead keyframes and `dismiss-menus.ts`.
- Run `pnpm check:affected` and the browser specs that name the files you touch. Many specs select by `select` or `details` and will need updating to the new roles. Update the selectors; never weaken an assertion.
- Do not change `tests/browser/workspace-shared-draft.spec.ts`.
