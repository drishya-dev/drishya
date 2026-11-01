# AUDIT-1: the whole product, walked as a developer using it

Started 1 November 2026, Yash with Claude Opus 5.5. Companion to the [UI pass brief](ui-pass-brief.md).

**Method (Yash, 1 Nov).** The product is walked one surface at a time on the real local library (182 sessions of both harnesses, read into a scratch home), at 1440 and 600 px. A bounded presentation or data fix is made on the spot rather than written down for later, because a recorded defect loses what it felt like at the time. Everything found is recorded here either way. Anything that is a feature of its own becomes a TASKS item. Real content is never quoted here: session id prefixes, sizes and counts only. Screenshots stay in `.local/`.

Each surface answers the brief's questions in short, then lists what was found. `Fixed` means fixed in this pass; an ID means it went to TASKS.

## Home

**Purpose.** Get back to my work.
**What I need, in order.** What is running now; what I was last in; which session is which.
**Identity.** A session is what it was about. Everything else (agent, workspace, age, size) is secondary. Rows show what differs.
**Layout.** One list, one rail of workspaces, filters above. The content gets the height.
**Edges.** One card for the library, one hairline for the rail. Rows are separated by a hairline.
**Controls.** Find, two filters. Refresh and About are quiet.
**Motion note.** A session opening should carry its row into the workspace header; nothing else moves here.

| # | Found | Severity | State |
|---|---|---|---|
| H1 | 31 of 59 Codex rows read "Untitled session". 30 of them were sub-agent threads, listed as sessions of their own, and the row said nothing of what they were. | High | Fixed: discovery reads `parent_thread_id` and `agent_nickname`; a thread whose parent is known nests under it (`30 sub-agents` on the parent row) and keeps its whole journal one click away in a `Sub-agents` group; an orphan reads `Sub-agent <name>`. All 30 matched a parent. |
| H2 | 105 of 212 sessions sat in 96 temporary folders, so the workspace rail was mostly scratch directories and real projects were buried. | High | Fixed: one `Temporary folders` group at the end of the rail (51 workspaces instead of 146). Nothing hidden from All sessions. |
| H3 | Rail paths showed `C:\Users\ASUS\Desktop\CS\P…`: the part every row shares, cut before the part that differs. | Medium | Fixed: the parent folder, from `~`. Full path stays in the tooltip. |
| H4 | "Reading locations saved locally" sat resident at the top of the list: our own bookkeeping, in our own vocabulary. | Medium | Fixed: only a failure is shown, in plain words. |
| H5 | The session count appeared four times on one screen (rail, header of the list, rail header, footer). | Low | Fixed: footer count removed. |
| H6 | `543 events` and `completed` on rows: an internal unit, and the normal state stated as news. Only imported rows had them, so the right edge looked random. | Medium | Fixed: removed; an unusual last outcome still shows. |
| H7 | A separator between agent and workspace, none between workspace and time. | Low | Fixed: one separator rhythm. |
| H8 | Rows were 80 px for one line of title, showing six sessions in a 900 px window. | Medium | Fixed: 64 px, one line, eight sessions; 84 px at half width with one metadata line (was 104). |
| H9 | An arrow on every row at rest read as twelve identical external links. | Low | Fixed: shown on hover and focus. The whole row already opens. |
| H10 | Refresh was the loudest control on the page. | Low | Fixed: quiet hairline. |
| H11 | The half-width workspace chevron was a text glyph sitting below the line. | Low | Fixed: drawn. |
| H12 | "Search evidence" beside "Search sessions or workspaces…": two searches, and "evidence" is our word. | Medium | UI-21; waits on TEST-2, which holds the spec that names it. |
| H13 | New sessions do not appear until Refresh: the live subscription refreshes recordings, not discovered journals. | Medium | HOME-2. |

**Interactions checked:** click a row, a workspace, Temporary folders, both filters, search, Clear filters, arrow keys and End, hover, half width. Nothing dead. H14: opening a session that has not been imported dims the whole list and shows a small `Opening…`, for many seconds on a large journal, with no way to do anything else (HOME-2). H15: Git worktrees of one repository are separate workspaces of the same name; they belong under the repository (HOME-2).

## History: the cards

**Purpose.** See what the agent did, in order, without reading a transcript.
**What I need, in order.** What this step was; which file or command; did it work; the material itself.
**Identity.** A file card is its file. A command is what the agent said it was doing, else the command. A server tool is the tool. Everything else is secondary.
**Layout.** Title and one quiet line; material below, bounded. Passages wrap (deliberate).
**Edges.** One card edge, a red contour only on failure. The command box inside a card is the one box-in-box left, because it is code.
**Controls.** Expand on hover. Copy on the code. Nothing resident except the outcome mark.
**Motion note.** Expand is the one reflow worth carrying from the card's own edge; the fade at the end of a bounded preview must not animate.

| # | Found | Severity | State |
|---|---|---|---|
| C1 | Titles were the path cut at the end, the only part that differs (`C:/Users/ASUS/AppData/Local/Temp...`), with `Read · Read`, `Edit · Edit`, `Write · Write`, `Shell · Bash`, `Test · CommandExecution` under them. | High | Fixed: title is the file name; the line beneath is the action, read range and folder. |
| C2 | Claude records a one-line description with every shell command, and the product threw it away. Every shell card repeated its own command as a title. | High | Fixed: `detail.description`, reducer r32. The card is named in the agent's words; the command stays in the body. Codex records none and keeps the command. |
| C3 | A server tool read `Claude_Browser · javascript_tool`, then `Claude_Browser · mcp__Claude_Browser__…`, then the tool again in the body. | Medium | Fixed: tool as title, server beneath. Body repeat remains (C13). |
| C4 | `Other · AskUserQuestion`. | Medium | Fixed: `Asked you` · `Question`. |
| C5 | Every bounded preview ended in half a line of text. | High | Fixed: a fade that exists only while there is more to scroll, driven by the scroller itself, no script. |
| C6 | `Expand` on every card at rest. | Medium | Fixed: on hover and focus. |
| C7 | `Vitest · captured output 1 · tests`, `5 captured result rows · select to inspect`, `Derived · grouped counts, not execution order`, `13 captured lines between · show preview`, `Captured input preview · expand for full text`. | High | Fixed: `Vitest`, `5 results · hover to read, click to open`, `13 more lines`, `Shortened · Expand to read all of it`. The basis moved to the tooltip on the counts, so provenance is still stated. |
| C8 | A run with one failed suite read as green `5 passed` with `Suite summary: 1 failed` in grey. | High | Fixed: `Suites: 1 failed…` reads red. The card's own ✓ still comes from the exit code (CONTENT-15). |
| C9 | `Queue receipts · 145` sat over the text while reading back. | Medium | Fixed: past receipts show at the end of the session only; a waiting input always shows. |
| C10 | The jump-to-latest button overlapped the corner of the toolbox in accent purple. | Medium | Fixed: neutral, beside Follow. |
| C11 | `get_worktree_creati/on_status` broke mid-word in the toolbox. | Medium | Fixed: one line, ellipsis. |
| C12 | Duplicate React keys under the viewer on every session. | Low | Fixed. |
| C13 | `.tex` was not prose, so a long line ran off a wide diff; a new file shows `@@ -0,0 +1,31 @@`; a search title repeats in the body; an MCP body repeats the tool. | Low | `.tex` fixed. The rest to UI-8. |
| C14 | Follow live on a session that ended hours ago. | Low | To UI-8: the word should change when nothing is live. |

**Checked, nothing found:** read images, edit and write diffs, search, web fetch, question, shell, failed test, MCP, passage arrows, date markers, on Claude `c8e5c9c8` (2,695 operations) and Codex `32f628ee` (with 30 sub-agents).

## Inspector

**Purpose.** Everything known about one step.
**What I need.** The same material, plus what happened after it. It overlaps Expand heavily (I6).
**Layout.** One column on the right, in the toolbox's place, with a readable history beside it.

| # | Found | Severity | State |
|---|---|---|---|
| I1 | The panel started below the toolbox's top, so a stub of the toolbox stuck out above it. | High | Fixed. |
| I2 | History slid under the file rail, cutting cards and prose; the panel took 760 px of 1440. | High | Fixed: fits beside the rail; resizing the panel now moves the history, which it never did because the width was set below the element that read it. |
| I3 | Connector lines ran across the panel. | Medium | Fixed. |
| I4 | `Edit Edit docs/…`, a `Captured` pill on everything, `Evidence · 2 relationships`. | Medium | Fixed: one title, the pill only for what is not captured, `Links · 2`. |
| I5 | `A test run was recorded after this change` beside `· 673 runs`, and `Recorded order · coverage not established`; `Later changes` listed identical lines. | High | Fixed: the sentence is gone, the caveat is the heading's tooltip, later changes are numbered links. |
| I6 | Expand and Inspector show the same diff in two places. Expand has the file actions and the read-before facts; Inspector has the test runs, links and notes. Nobody can guess which holds what. | High | UI-20. A decision for Yash. |

## File work

The brief's worked example, and the most changed surface.

**Purpose.** See what the agent did to this file, in order, and read each step.
**Objects.** A file, and steps on it. The file is constant, so rows show what differs: `lines 1–70`, `+3 −4`, the query.
**Layout.** Step list on the left, content on the right, one toolbar row between title and content.
**Language.** The title is the file, the folder is dim, "Work on" is gone from the screen and kept for assistive technology.

| # | Found | Severity | State |
|---|---|---|---|
| W1 | 390 of 810 px was chrome before the first line. | High | Fixed: one row. Content starts 145 px higher. |
| W2 | Rows all read `Read README.md`, `Edit README.md`, each with `Open in history ↗` and `ok`. | High | Fixed: 51 px rows that differ; 13 fit where 5 did; the link is on hover; only a failure is stated. |
| W3 | `Work on C:\Users\…` as the title. | Medium | Fixed. |
| W4 | `58 recorded actions · Recorded` in a row of its own; `Captured` pill; `Captured page · lines 1–70 · loaded page only`; a mono sentence of provenance at the foot. | Medium | Fixed: the count is the filter's placeholder, `Lines 1–70`. |
| W5 | `Read on disk`, `Compare`, `Compare with disk` side by side. | Medium | To UI-8. |
| W6 | The step select repeats the selected row. | Low | Quietened to a title. Remove when the trail is showing, in UI-8. |

## Workspace

**Purpose.** Read and edit the current files beside the agent.
**Layout.** Tabs, one row of view and actions, then the document.

| # | Found | Severity | State |
|---|---|---|---|
| D1 | Four stacked rows above a document; the file named twice. | Medium | Fixed: three, with the view beside Edit. |
| D2 | Prose ran the full 1,085 px. | High | Fixed: 80 characters. |
| D3 | HTML in a README rendered as long grey paragraphs. | Medium | Fixed: quiet source lines. It is still never interpreted. |
| D4 | `Open in Workspace` before consent lands on a generic empty state that forgets the file. It does open the file after approval. | Low | To UI-8: name the file. |
| D5 | Two menus called Actions, one row apart. | Low | To UI-8. |
| D6 | `Ask harness to run a command`. | Low | Waiting on TEST-2's spec. |

## Changes

| # | Found | Severity | State |
|---|---|---|---|
| R1 | `Start with the change. Follow the evidence.`, a paging bar, and a bounds sentence all above the counts. | High | Fixed: counts first, paging after the lists. |
| R2 | `144 files with change inputs`, `90 failed operations`. | Medium | Fixed: `144 files changed`, `90 failed`. |
| R3 | `18 entries lack captured observation positions…`, flush against the dialog edge, shown even where it could not matter. | Medium | Fixed: plain, aligned, only when it applies. |
| R4 | 144 files are paged 50 at a time. | Medium | REVIEW-6. |
| R5 | A failure row is its title and nothing about why it failed. | High | CONTENT-15. |

## Command palette

| # | Found | Severity | State |
|---|---|---|---|
| P1 | Ctrl+K opened with focus on the close button, so typing went nowhere. The reader that takes every other action in the product. | High | Fixed: dialogs can declare a focus target. |
| P2 | Title bar, no placeholder, 57 px rows with an arrow each. | Medium | Fixed: an input and a list, 36 px rows. |
| P3 | `Recorded file work · available captured evidence only` on every file. | Medium | In the language pass (L1). |

## Git review and Git history

| # | Found | Severity | State |
|---|---|---|---|
| G1 | Three separate consents to read one repository: workspace, Git review, Git history. | Medium | GIT-7. A privacy decision, not a polish item. |
| G2 | `No visible changes.` in a box in a box. | Low | To UI-8. |
| G3 | Git history: `Read branch` select beside the same refs in the rail; `Open a commit…` above the same commits; `ahead 0 · behind 0` stated twice when nothing differs. | Medium | Held: TEST-2 owns `GitHistory.tsx`. To UI-8. |
| G4 | With a commit open the subject column is seven characters wide. | Medium | Held, same reason. |

**Checked, nothing found:** the graph itself, zoom, the commit reader, the Git menu.

## Search

Four searches exist: Home's list filter, `Search evidence`, the header search, and the palette. Each is right for its job and none says which it is. Header search labels (`Captured work`, `Indexed files`) are in the language pass.

## Settings

Clean. The theme grid clips its last card at 900 px by design of the scroller. `Workspace settings` is a large title for a small dialog (UI-8).

## Language (L1)

493 distinct interface strings say `captured`, `evidence`, `recorded` or `derived`. The doctrine that captured differs from derived is about what the product may claim; it was never a rule that the word must appear on screen. Everything in the product is captured, so the word carries nothing, and a screen full of it reads like a legal notice. This pass fixed the strings seen at rest on the main path. The whole sweep touches most specs, and is its own item (UI-21).

## Foundations

Measured on one History screen: 11 font sizes including `9.17`, `11.67` and `12.5`; 11 corner radii; 20 button heights. These are the UI-4b overrides stacked up (`atelier`, `ink`, `polish`, `product`, `stage`, `studio`, `classic`). This pass added to that pile, on purpose, so it could move fast; the token sheet comes first in UI-8 and absorbs these rules.

## Backend

| # | Found | Severity | State |
|---|---|---|---|
| B2 | Reading position saves fail with 409 while two tabs of one session are open: found by having two tabs open during this walk. | Low | DATA-13. |
| B3 | A failed suite does not change a command's outcome, because the outcome is the exit code. | Medium | CONTENT-15. |

## Composer, map, replay, half width

| # | Found | Severity | State |
|---|---|---|---|
| Z1 | The composer is clean at rest and open. Opening it shortens the file rail, which ends in half a line. | Low | UI-8. |
| Z2 | Repository map: several clusters are all called `Mixed files`, and the `All files` chip wraps to two lines. The map stays aesthetic by decision. | Low | UI-8, MAP-1. |
| Z3 | Replay: the transport is clear and complete. At step 1 the toolbox states `Tools used 0`, a harness note and `No tool matches`: three lines for nothing yet. | Low | UI-8. |
| Z4 | Narrowing to 600 px with the file rail open leaves the rail over the text. | Medium | UI-8. |
| Z5 | An agent named by its model id wraps mid-name in the toolbox (`claude-sonnet-5-` / `5`). | Low | UI-8. |

## File peek and the session panel

| # | Found | Severity | State |
|---|---|---|---|
| K1 | A Markdown file over the limit opened to an apology and a link: `docs/STATUS.md` (1,565 lines) showed no content at all. | High | Fixed: it opens as source with a one-line note. The Workspace view has the same message and one more click (UI-8). |
| K2 | `Actions` wrapped under its own icon in the peek's title bar. | Low | Fixed. |
| K3 | The session panel is complete and readable; `Harness`, `Recording`, `Observation` and the usage notes are our vocabulary. | Low | UI-21. |

## Review tools

| # | Found | Severity | State |
|---|---|---|---|
| V1 | Prompt overview is the best summary in the product: every prompt with what it led to. It is buried in the palette, paged 7 times, and its counts include `0 change calls · 0 checks · 0 failed outcomes`. | Medium | UI-8: hide zeros, one list, a real way in. |
| V2 | Review findings: 44 findings, led by `Same captured command · 3 runs` for harmless commands like `git status`. Repetition alone says nothing, as the dialog itself admits. | Medium | UI-22: does this earn its place? Rank by what failed, or cut. |
| V3 | `through observation 39156` on every review dialog. | Low | Fixed. |
| V4 | Review packet: each checkbox sat on its own line above its label. | Low | Fixed. |
| V5 | The packet reports `6462 capture gaps` on one Codex session. A number that large either means something is wrong or that the word does not mean what a reader thinks. | Medium | UI-22: find out what they are before anyone is shown that number. |

## Live

Two genuine Claude Code runs on a throwaway repository (`live-repo`, haiku, about 90 seconds each, with deliberately slow commands), watched from Home to finish at 1440 px.

| # | Found | Severity | State |
|---|---|---|---|
| L1 | A new session needs Refresh, and a running session does not appear in `Running now` until it has been opened. | High | HOME-2. |
| L2 | Once open, following held across arrivals; wheel up detached it; the new-step count and return to latest both worked. Opening took 0.8 s. | | Checked, nothing found. |
| L3 | Toolbox said `active` on every finished session, including sessions weeks old, because the last agent counts as active. | High | Fixed: `active` needs a followed session or an open call. |
| L4 | Command previews led with `cd "C:/Users/…long path" &&` and faded out before the command. | High | Fixed: `cd workspace &&` in the preview when the path is the session's own folder. Copy and Expand stay exact. |
| L5 | A running command's time sat at the end of the pill, where it was always cut off. | Medium | Fixed: time first, and the agent's description instead of the command. |
| L6 | A short command gave a narrow card that cut the agent's description. | Medium | Fixed: the card is as wide as its title needs. |
| L7 | `Queued inputs · 1` stayed above the composer with nothing queued. | Medium | Fixed: past receipts show on composer hover or focus; a waiting input always shows. |
| L8 | The toolbox was vertically centred, so it moved every time a tool appeared. | Medium | Fixed: fixed top edge. |
| L9 | `16 new steps` existed only for screen readers. | Low | Fixed: the count shows beside the arrow. |
| L10 | Notices sat 6 px left of the prose. | Low | Fixed. |

## Review questions, Saved moments, compare, themes, Codex at half width

| # | Found | Severity | State |
|---|---|---|---|
| M1 | Saved moments ran flush against the dialog edge. | Medium | Fixed. |
| M2 | `Captured action · observation 10832`; a two-clause scope sentence on Review questions. | Low | Fixed: `Step 10832`, one plain sentence. |
| M3 | Saved moments and Review questions are two notes on one step, with different lists. | Medium | With UI-20: Expand gets one note. |
| M4 | The Source versions toolbar sat flush against the dialog edge. | Low | Fixed. |
| M5 | Comparing a read with disk matches by line position, so a shifted file reads as all changed. The dialog says so; a real line diff would be better. | Medium | UI-23. |
| M7 | Light theme (Porcelain): Home, History, file view, palette and Changes read well. The detector's only new rule, `cream-palette`, is fashion, and rejected. | | Checked, nothing found. |
| M8 | Codex `32f628ee` at 600 px: no horizontal overflow, no card past the edge, failure and pass cards read correctly. | | Checked, nothing found. |

## Interaction inventory (A2)

What each component does for each kind of input, for UI-8 and the motion pass to preserve. `tested` means driven in the walk on a real session; `code` means read from the source and not driven. Right click is the browser's own menu everywhere (tested on cards and file rows): there is no product menu anywhere, which is UI-24.

| Component | Pointer | Keyboard | Scroll and drag | Live and replay | Loading, empty, failing | Basis |
|---|---|---|---|---|---|---|
| Home row | Click opens; hover shows the arrow | Arrows, Home, End, PageUp, PageDown move; Enter opens | Virtual list; position remembered | Running strip when followed | Dim list while importing; empty and no-match states; error with Retry | tested |
| Home rail | Click filters; title shows the full path | Tab, Enter; Esc closes at half width | Virtual list | None | Unknown remembered workspace falls back to All | tested |
| History scroll | Wheel detaches following | `j k` step, `n p` edit, `f` failure, `t T` turn, `g G` ends, `e` expand, `o` open file, `y` copy, `c C` fold, `?` guide, Esc clears focus | Native scroll; prompts rail ticks jump | Keys only in history; replay has transport | Skeletons, gaps as notices | tested (j k n p e o ?), code (rest) |
| Card | Click head opens details; click twice closes; click body never does; hover zooms reading | Enter opens details; Tab reaches it | Bounded preview scrolls without detaching | State mark settles once | Running: `Waiting for output`; red contour on failure | tested |
| Expand | Click toggles | Enter on the button; `e` | Inner scroll | Same in replay, future hidden | Honest absent states | tested |
| Inspector | Click card; close button | Esc closes | Resize by handle; history follows | Follows selection | Skeletons | tested |
| Toolbox tool | Hover draws its connector; click dims others and offers Clear focus; click again clears | Tab, Enter; Esc does not clear focus | Long lists scroll locally | Counts rise live | `Tools used 0` before the first call | tested |
| Toolbox panel | `−` minimises | Tab, Enter | Scrolls when tall | Grows downward, top edge fixed | | tested |
| File rail | Click opens file; double click pins it; collapse button | `Find files…` filters | Handle resizes 220 to the limit; double click resets | Marks update live | Consent prompt; empty filter state | tested |
| File peek | Tabs, Document and Source | Esc closes, focus returns | Local scroll | Disabled in replay | Over the limit: source with a note | tested |
| File work | Step rows; hover shows Open in history | Previous and Next change; focus kept at the ends | Trail resize; window move and reset | Replay shows steps up to now | Filter empty state; restored evidence states | tested |
| Workspace | Tabs, Edit, Actions | Ctrl+K reaches files | Split view | Off in replay | Consent state | tested |
| Palette | Click a row | Ctrl+K opens, typing filters, arrows, Enter, Esc | List scroll | History only | No-match line | tested |
| Changes | Rows open a file or an edit | Tab, Esc | Dialog scroll; paged | History only | Retry; `None recorded` | tested |
| Git menu, review, history | Click; commit rows; ref rail | `B` focuses a branch, Esc clears it | Wheel pans, zoom buttons, Fit | History only | Three consents; loading line | tested |
| Search | Click a result | Enter, Esc | Local scroll | Replay limits to the step | Empty state | tested |
| Composer | Click opens; hover shows past receipts | Ctrl+Shift+Enter sends | Height follows content | Pill states live; hidden in replay | Unsupported requests fail explicitly | tested at rest, not sending |
| Follow | Toggle; `↓` returns with the count | Tab, Space | Wheel detaches it | Hidden with the Inspector | | tested |
| Repository map | Drag orbits, Shift drag pans, buttons zoom and Fit | Find a file | Wheel zooms | Replay follows | `Map the whole repository` | code, one screen tested |
| Replay transport | Scrub, play, step, speed, leave | Space and arrows | | Stops on leave | | code, one screen tested |
| Dialogs | Close button; move and reset where offered | Esc closes the top one; focus returns to the opener | Local scroll; resize where offered | | | tested |

**Not driven:** the composer's send and approval paths, and replay's keyboard. Both need a session of their own.

## Impeccable's detector

Run 1 November with Yash's yes to the download: `impeccable` 4.8.0, Apache-2.0, installed outside the repository with install scripts off. Nothing was written to the project, no hook or skill was installed, and the only network path in its launcher (fetching the engine) was not needed. It attached to a browser showing the real app through its `--cdp` mode, so panels could be scanned open on real sessions. Results stayed in `.local/`, and only rule names, selectors and counts were read.

15 scans (Home, History at rest and among cards, an expanded card, Inspector, file work, palette, Changes, Settings, Prompt overview, Findings and Git history at 1440 px; Home, History and the palette at 600 px) gave 196 findings under 11 rules.

| Rule | Found | Verdict |
|---|---|---|
| `undersized-ui-text` | 49, nearly all Git history's turn labels at 10 px | Fixed. All text below the 11 px floor is gone. |
| `line-length` | 21, History prose at about 83 characters | Fixed: 540 px. Prompt overview 560 px. |
| `straggler` | 17, paragraphs ending on one word | Fixed: `text-wrap: pretty` on prose. |
| `low-contrast` | 12, line numbers on tinted diff rows and the reasoning note | Fixed. Our own lint missed these because it reads the wrong background. |
| `tight-leading` | 8, Home titles at 1.29 | Fixed. Home now scans clean at both widths. |
| `tiny-text` | 66, metadata at 11 px | Kept. 11 px is the house floor for metadata (UI-2). The rule wants 12 and up for body text; this is not body text. |
| `overused-font` | 12, Geist | Rejected. The face is a decision, and the rule judges fashion, not reading. |
| `text-occlusion` | 7 | Real at half width only: floating Tools and Follow controls over scrolling text. Sent to UI-8. |
| `flat-type-hierarchy` | 2 | Recorded for the UI-8 type scale. |
| `cramped-padding` | 1, rising to 3 | Rejected: diff rows are meant to be dense. |
| `em-dash-overuse` | 1 | Rejected: that was captured agent text. |

A scan of `apps/ui/src` gave four `side-tab` hits, all deliberate (blockquotes, the agent line on prose, a pinned reference).

**Verdict:** worth running. It found real defects our own lint and eye had missed, in minutes, and five of its eleven rules were right. Use it as a check after each UI-8 surface. Its fixed type and font opinions do not outrank the doctrine. Do not install its hook or skills into this repository.

## Tools

ECC was read at Yash's request (1 Nov): a general agent system of 314 skills, hooks and rules, not a design tool. It adds nothing to this pass, its hooks and rules would compete with AGENTS.md, and its motion skills target `motion/react`, which Drishya does not use. Not installed. Its `click-path-audit` skill is a useful method to read when tracing a state bug, and `frontend-a11y` and `accessibility` are worth reading for REL-3, as references. Strix is for security testing before release and `claude-seo` for the launch page; neither helps this pass. Impeccable's detector is covered above.
