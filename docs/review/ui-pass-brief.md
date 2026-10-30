# The whole-product UI pass: brief

Written 30 October 2026 from the builder's direction (Yash). This is the brief for AUDIT-1, UI-8 (which now absorbs UI-3, UI-4b and UI-7) and the motion passes. It is written so that a session starting cold, possibly on a different model, can pick the work up from this file, [VISION §8](../VISION.md), TASKS "How the UI and motion passes are run" and the AUDIT-1 entry, with nothing else.

## 1. What the builder asked for (30 October)

- The main visualization looks good and can be done better. Many other components, and how they are presented, do not look premium: they read as text written in a box with the common buttons needed for the function. They have not been taken through front-end depth, user experience, positioning and the management of the windows that open.
- A whole UI audit of **every component, page and section that comes up**, then **one** professional UI pass over all of it. UI-3, UI-4b, UI-7 and UI-8 are merged into that single pass (UI-8).
- The theme stays developer friendly, with the feel of a product worth $10,000.
- Every component is dealt with in presentation, animation and placement, **thought from the concept**. Example in the builder's words: a surface that shows a file's contents and its history needs a decision on what goes where, how much room each part gets, how the individual parts look, one section or several, and what borders. This goes down to that depth everywhere.
- The builder is not a UI expert and expects the agent to do the advanced thinking. The audit, the UI pass and probably the motion pass may be run on Opus.
- What one phase finds that belongs to another (an audit finding that is really a motion idea, a UI decision that changes the backend) is kept in the docs, and each phase thinks the whole of it through. See section 5.

## 2. Worked example: the Workspace file-work view (builder screenshot, 30 October)

A Codex session of the `drishya` workspace, window about 2000 x 1160. The screenshot is not in the repository; these are the defects read from it. They show the kind of thing the pass must find everywhere. They are examples and not the list: the audit must find what the builder did not name.

1. **Identity.** The headline is the raw absolute path as a 24 px title ("Work on C:\Users\...\CONTINUITY.md"). The file name is the identity; the folder is secondary and dim; "Work on" adds nothing.
2. **Chrome before content.** Three stacked rows of controls (back and forward with "13 recorded actions · Recorded"; Compare with a "..." button; Previous change, "1 of 13", Next change), then a full-width select that repeats the title, then a fourth row (Changes, Side by side, wrap, Find in patch, up and down). Roughly 40 percent of the height is chrome before the first line of the diff.
3. **List rows that cannot be told apart.** The left list has 13 rows that all read "Edit worktree-f9092e32fe/docs/CONTINUITY.md", with the name broken mid-word ("CONTINUITY.m / d") and an "Open in history" link on each. What differs between the rows (when, which turn, how many lines added and removed, whether it was the one that failed a test) is not shown; what is constant (the file name) fills the row.
4. **Prose as one block.** Long markdown paragraphs are one very wide wrapped line each; the added block is a solid full-width fill with no measure. A prose file wants a readable line length and a quieter diff.
5. **Sentences that say nothing, and jargon.** "Test runs after this change · 673 runs" beside "A test run was recorded after this change" contradict each other at a glance, and the latest run is a raw PowerShell command that runs off the edge. "Recorded order · coverage not established" is our vocabulary, not the user's.
6. **Repetition.** "Later changes to this file:" lists four identical lines.
7. **Window management.** A panel that fills almost the whole window with its own header, a title row of three unlabelled icons (move, refresh, close), and a dim composer underneath. How it relates to the main history behind it, what the user returns to, and why it is a window and not a section are not answered by the layout.
8. **Proportion.** A 270 px list beside a content area that is mostly one wide column; neither is sized from what it holds.

**A second example (builder screenshots, 30 October): a web search.** The hover card lists five results and then "11 more results" with no way to open them; the expanded view is the harness's raw `Links: [{...}]` text as one block with the agent's paragraph below it, and an Evidence tab whose "4" does not say what it counts. The short form hides what was recorded and the expanded form does not say more than it, in a shape nobody can read. Every surface with a short and an expanded form is checked for this: all recorded material reachable, the expanded form richer and structured, counts that say what they count (CONTENT-13, then the audit's findings).

## 3. How to think about a surface: concept first

For every surface, write the answers in the audit file **before** touching any CSS.

1. **Purpose.** One sentence, in the user's words: what is this for?
2. **What the developer must decide or understand here**, in order of importance. The first item is what the screen leads with.
3. **Objects and identity.** What are the things (a file, a change, a run, a session, a commit) and what identifies each? Rows show what **differs** between siblings, not what they share.
4. **Layout.** One section or several; the primary reading column and its measure; what is secondary and where it lives (side, drawer, popover, hover); relative sizes decided from content (the content gets the room, chrome gets the least it needs).
5. **Edges.** A border or divider only where two things must be separated; otherwise spacing. One hairline weight, one radius scale, no boxes inside boxes, no labelled boxes (AGENTS doctrine 6).
6. **Controls.** At most three primary actions visible; toggles as icon buttons with tooltips; rare actions in one menu; each control next to what it acts on; no control repeated in two places.
7. **States.** Empty, loading, partial, failed, huge, a one-letter name, a very long name, non-Latin text, thousands of items, zero items (`break-ui`).
8. **Windows.** How a panel opens (modal, side panel, split, popover), its size and position, its relation to the view behind it, how it closes, and what the user returns to.
9. **Motion, as a note.** What relationship, arrival or change would motion express here (origin, relationship, change; otherwise none). Written down for the motion pass, not built in this one.
10. **Language.** Labels say what they are in the product's words; numbers carry units and say what they count; no internal jargon.

## 4. The merged pass

1. **Inventory and audit first** (AUDIT-1): every surface, grouped into families (readers, dialogs, lists, menus, header and edge panels, composer, Home, Settings, history cards by action type, the map, and what the inventory finds).
2. **Foundations before surfaces.** One token sheet for Modern (the old UI-4b: move Modern off `classic.css` and `studio.css`, delete dead overrides), the spacing, type, radius and border scales, and the anatomy of a list row, a toolbar, a panel and a section header. Surfaces are then built on these, so nothing is restyled twice.
3. **Palettes are checked per surface as it is finished** (the old UI-7): the existing `palette-contrast` spec is extended to each surface; the human judgement of light-theme balance on Paper is taken at the end.
4. **Component libraries** (the old UI-3) only to replace a specific component the audit found weak. Copy the markup and CSS, add no dependency, check the licence, attribute.
5. **Surface order:** the high-traffic surfaces first (the Workspace file view and Files, history cards, Changes and Git review, header and menus, composer, Home), then the rest.
6. **Tools** in the order given by TASKS "How the UI and motion passes are run" (HIG skill as reviewer, `break-ui`, `emil-design-eng`, `apple-design`), filtered through the doctrine.
7. **Each surface is verified** at 600 and 1440 px on real sessions of both harnesses, with before and after screenshots kept in `.local/`, and committed as its own coherent increment.

## 5. Cross-phase ledger

Append at the end of every phase and read at the start of every phase; do not rewrite earlier rows. Anything that needs work becomes a TASKS item, and the row records where it went.

| Date | Found by | Surface | Note | For | Where it went |
|---|---|---|---|---|---|
| 30 Oct | Builder screenshot | Workspace file view | Row anatomy: lead with what differs (time, turn, lines added and removed, test outcome), drop the constant file name, never break a name mid-word. | UI | UI-8 |
| 30 Oct | Builder screenshot | Workspace file view | Title: file name large, folder dim, no "Work on". One toolbar row at most above the content. | UI | UI-8 |
| 30 Oct | Builder screenshot | Test-runs block | What does "673 runs" count (every run after the change, over the whole session)? The sentence and the number contradict. | Backend, content | AUDIT-1 |
| 30 Oct | Builder screenshot | Test-runs block, change list | "Recorded order · coverage not established" and similar phrases are our vocabulary. | Content | AUDIT-1, UI-8 |
| 30 Oct | Builder screenshot | Workspace panel | Window management: the panel's relation to the history behind it and what the user returns to are not answered by the layout. | UI | UI-8 |
| 30 Oct | UI thinking, for later | Files to Workspace | Opening a file from a Files row could carry the row into the Workspace tab (Lift: origin is the Files row). | Motion | MOTION-1 |
| 30 Oct | Builder screenshots | Web search card and Inspector | Short form hides 11 of 16 results; expanded form is raw JSON text plus prose in one box; Evidence count unlabelled. Check every short/expanded pair for the same. | Content, UI, audit | CONTENT-13, AUDIT-1 |
| 30 Oct | Builder request | Tools dock | The list shows only observed tools and a selected tool only dims the rest. Wanted: every available tool listed, and previous/next through a chosen tool's uses. | UI, data | TOOLS-1 |
| 30 Oct | Builder screenshot | Plan strip | A plan shows "Revision 1 · 0 of 5 done" collapsed behind Expand. Content a reader wants is shown by default, bounded when large, never hidden; applies to every collapsed-by-default surface. | UI, content | UI-17, TOOLS-1 |
| 30 Oct | Builder note (Instagram reel) | Coloured themes | Palette concept: dominant hue, neutral and one contrasting accent spent on one thing at a time; section 7. | UI | UI-8 |

## 6. Who runs it

The builder may switch to Opus for AUDIT-1, UI-8 and the motion passes: they need judgement more than speed. A change of model in the middle of a pass is fine: finish the current surface, append the ledger, say what is next. The authority order is [VISION](../VISION.md) §8 and the doctrine in AGENTS.md first, then this brief, then TASKS.

## 7. Colour reference for the coloured themes (builder note, 30 October; for later)

The builder asked that, when the coloured themes are done (the seven palettes, UI-8 and its palette checks), these palettes are looked at and that **the concept is taken, not just the three palettes**. Source: an Instagram reel by niki.aroca (https://www.instagram.com/reel/DfGEE7DIvjU/), whose caption begins "The secret to a memorable UI? One accent color ..." (the rest is not visible). Only the three frames the builder attached were read; the reel itself was not opened.

| Dominant | Neutral | Accent | Hero it was shown on |
|---|---|---|---|
| Deep blue #09318D | Pure white #FFFFFF | Bubblegum pink #FD91CC | Enterprise security page: blue gradient hero, light cards, one pink gauge and button |
| Midnight black #02070A | Electric blue #0297DE | Cantaloupe orange #FC734D | Video-editing page: near-black hero with a blue-to-orange glow, orange for the primary action and the data pop |
| Sky blue #0593C6 | White #FCFFFF | Hot pink #D83995 | Health page: blue hero blurring into pink, frosted light cards, one pink action |

**The concept to carry over (read from the frames, not from the author's words):**

1. **Three colours, no more:** one dominant hue that carries the whole surface, one clean neutral for text and cards, and **one accent** that sits opposite the dominant hue in temperature (cool blue with warm pink or orange). The single accent is what makes it memorable.
2. **The accent is spent on one thing at a time:** the primary action, the key figure, the selected or active item. Everything else stays in the dominant hue and the neutral. A screen with the accent in five places has no accent.
3. **The accent is chosen against the dominant hue, not alone:** the same pink would fail on a different base. Each coloured theme picks its accent as a deliberate pair with its base and checks the pair for contrast.
4. **Light cards on a saturated field, or the reverse, give depth without borders:** the surface colour does the separating that a border would do.

**How it meets our doctrine (the doctrine wins where they differ):** colour carries meaning (agent identity, pass, fail, edited), so a theme's accent must never collide with the pass, fail and edited colours and must stay readable beside them; no glow pools and no gradients as decoration (AGENTS doctrine 6), so the hero gradients and glows in the frames are not to be copied unless the builder asks; the flat, hairline, graphite-based developer-tool theme stays the default. What is taken is the discipline: base, neutral, one accent, spent sparingly, chosen as a pair. Check each theme with the extended `palette-contrast` spec on all surfaces.

