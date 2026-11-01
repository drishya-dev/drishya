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
| H1 | 31 of 59 Codex rows read "Untitled session". 30 of them were sub-agent threads, listed as sessions of their own, and the row said nothing of what they were. | High | Fixed: discovery reads `parent_thread_id` and `agent_nickname`; a thread whose parent is known nests under it (`30 sub-agents` on the parent row), an orphan reads `Sub-agent <name>`. All 30 matched a parent. |
| H2 | 105 of 212 sessions sat in 96 temporary folders, so the workspace rail was mostly scratch directories and real projects were buried. | High | Fixed: one `Temporary folders` group at the end of the rail (51 workspaces instead of 146). Nothing hidden from All sessions. |
| H3 | Rail paths showed `C:\Users\ASUS\Desktop\CS\P…`: the part every row shares, cut before the part that differs. | Medium | Fixed: the parent folder, from `~`. Full path stays in the tooltip. |
| H4 | "Reading locations saved locally" sat resident at the top of the list: our own bookkeeping, in our own vocabulary. | Medium | Fixed: only a failure is shown, in plain words. |
| H5 | The session count appeared four times on one screen (rail, header of the list, rail header, footer). | Low | Fixed: footer count removed. |
| H6 | `543 events` and `completed` on rows: an internal unit, and the normal state stated as news. Only imported rows had them, so the right edge looked random. | Medium | Fixed: removed; an unusual last outcome still shows. |
| H7 | A separator between agent and workspace, none between workspace and time. | Low | Fixed: one separator rhythm. |
| H8 | Rows were 80 px for one line of title, showing six sessions in a 900 px window. | Medium | Fixed: 64 px, one line, ten sessions; 84 px at half width with one metadata line (was 104). |
| H9 | An arrow on every row at rest read as twelve identical external links. | Low | Fixed: shown on hover and focus. The whole row already opens. |
| H10 | Refresh was the loudest control on the page. | Low | Fixed: quiet hairline. |
| H11 | The half-width workspace chevron was a text glyph sitting below the line. | Low | Fixed: drawn. |
| H12 | "Search evidence" beside "Search sessions or workspaces…": two searches, and "evidence" is our word. | Medium | Waiting on TEST-2, which holds the spec that names it. Rename to "Search inside sessions". |
| H13 | New sessions do not appear until Refresh: the live subscription refreshes recordings, not discovered journals. | Medium | To TASKS. |
