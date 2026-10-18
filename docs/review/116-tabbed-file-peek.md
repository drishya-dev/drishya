# 116 — Tabbed file peek beside the agent

18 October 2026. Builder correction and bounded Modern continuation; installed `emil-design-eng`, `animate` and `review-animations` applied. Core captured-material arrival/hover and graph art are unchanged.

| Before | After | Why |
| --- | --- | --- |
| Current-file reading blocks the agent and other Files clicks | Modeless adjacent file peek; one replaceable preview and up to eight kept path tabs | Read alongside the agent; explicit Workspace still owns multi-pane editing |
| A separate width grip recentres a reader while its left edge is dragged | One rectangle owns all four edges; the opposite edge remains fixed | Direct manipulation matches the pointer |
| Only a move icon drags the reader | Non-interactive title/tab-bar area also drags; buttons and tabs retain their actions | Familiar window interaction without accidental tab drags |
| File re-selection starts a fresh reading visit | Copy the latest retained current-file visit’s metadata into the new visit | Restore query/scroll/wrap within the existing bounded history without sharing mutable visits or caching source |
| Workspace competes horizontally with Git controls and reader toolbar rows dominate | Workspace below Git review/graph; peek top measured from right controls; compact file actions in title bar and current-source truth in footer | Keep separate owners from overlapping and spend file-window height on source |
| Central session-name capsule takes visual space | Modern capsule omitted; Home/search/settings/menu and reconnect status remain | Latest explicit builder comparison request |
| History end reserves composer height plus70px and passage margins | Composer height retained once as end padding, with8px extra and a smaller final passage margin | Smaller end gap with final material above the prompt; full-height scrolling still passes beneath the translucent edge |

## Bounds and truth

Only approved current files use the new tabbed owner. Captured historical source/map readers remain distinct. Single Files click replaces a preview, double Files/tab click keeps it; tabs support close, arrows/Home/End/Delete, shortest parent labels and overflow scrolling. Limits are explicit. Only the active file body is mounted. Existing eight-visit reading metadata can expire; tab path references are separately retained. Reload rechecks workspace consent before source requests; no grant/body/draft is stored.

Normal desktop peek docks right below measured right navigation and above the measured composer and history uses the larger free side. It does not scale the agent DOM or modify graph geometry. Phone sheets keep some visualization visible and can yield to Files choosing. Desktop manipulation is immediate and bounded; geometry is not a native capability. Files keeps its independent left-side top clearance; Toolbox yields to full Workspace. Full Workspace still prepares memory-only drafts for explicit harness submission.

## Local evidence

- Both TypeScript projects and production build pass;527unit tests in95files pass.
- Geometry units cover every edge, opposite-edge anchoring, minimum/viewport bounds, persisted width and path metadata sanitization. File-peek units cover preview/pin/close/limits/recovery. Current-file revisit test preserves metadata without leaking it into captured visits.
- Browser checks cover actual Files single/double clicks, preview replacement/pinning, keyboard tabs, state across close/reopen/reload, fresh-consent/no-document-fetch recovery, four pointer edges, whole-title drag, phone containment and existing Git window move/resize/reset/recovery.
- Expanded/minimized prompt at1440/390px: last captured material stays above the prompt with a bounded gap. Desktop/phone frames inspected locally. Workspace/Git navigation remains reachable above the full Workspace; Files uses its own left-edge clearance.
- Actual Drishya Codex, Skeletongraph Codex and Skeletongraph Claude: three long-history upward-scroll/multi-file editor journeys pass. A separate journey verifies adjacent tabs and prompt clearance in all three plus phone containment. Real frames stay ignored in `.local`.

## Motion verdict

**Approve this bounded change.** File/tab navigation and dragging are frequent direct actions, so they have no delayed entrance, fake content, timed width animation or easing behind the pointer. One geometry owner freezes dimensions while moving and anchors resize edges. Pointer cancellation and viewport changes release manipulation state; keyboard geometry and phone fallback remain available. Existing shared modal200ms arrival/140ms exit is preserved for occasional modal readers; modeless peeks navigate immediately. This is not whole-product animation/native/device/human-preference acceptance. No hosted CI, telemetry, direct project writes, native config writes or new runtime dependency.
