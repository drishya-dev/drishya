# CONTENT-21 — continued sessions join their earlier journal

## Cause (genuine `dd136b25`, counts only)

`dd136b25` begins with a compact-boundary row whose `logicalParentUuid` exists in two local journals of the project folder: its real parent `c757fa6a` (235 MB) and a 155 MB journal that is a sibling copy of the same tail. `claudeContinuation` counted two matches and recorded `ambiguous`, so the history showed only the new journal (Prompt 1 on 29 Oct) instead of starting on 19 Oct. The same sibling situation also exists without any compact-boundary row (a continuation or fork that just copies the tail with the same entry uuids), which was not recognised at all.

## Fix (evidence: shared entry uuids only)

- **Direction is structural.** A candidate parent must not itself start with entries the child holds. In the real project folder the 155 MB sibling and `dd136b25` hold each other's first 400 messages, so the sibling is not shown to be earlier and drops out; `c757fa6a` does not start with any of the child's entries (277 of the child’s first 400 messages are in it). A chain's ancestors (the parent of another match) also drop out. Nothing uses time, title or overlap size.
- **Compact-boundary shape** keeps its native `logicalParentUuid` basis, now with that filtering when several journals hold the uuid.
- **Shared-uuid shape** (`basis: 'shared-entry-uuids'`, new value in `SessionLineageLink.basis`, derived-link provenance only, no event schema field): the child's first 400 user/assistant uuids, a read-only substring probe of eight of them across the same project folder's journals, then an exact count. More than half shared and the candidate not itself starting with the child's entries gives `linked`; two full copies (or a sibling copy) record no link, since a shared start does not show which is earlier.
- **Startup pass** `refreshClaudeLineages`: a recording imported before this has no link; each Claude recording is checked once (marker `claude-shared-lineage-v1:<id>`). An ancestor is imported like any other ancestor and never grants workspace access.
- The existing join already puts the earlier journal first and omits identical copied parts by uuid (`lineageObservations`), and paged loading is unchanged.

## Checked on genuine data (scratch home, counts only)

`dd136b25` (176 MB now) with `c757fa6a` (235 MB): linked, 277 shared leading messages, 410 identical parts omitted, two physical parts; joined view 344 person prompts (parent alone 207, child alone about 141, four copies counted once), first prompt 19 Oct (it was 29 Oct), no repeated (time, text) copies. Served from a scratch home: rail 344 at 1440 and at 600 px. `check:real -- session-lineage` now also reports joined prompt totals and repeated copies; 6 smaller genuine sessions pass.

Not found: a second genuine continued pair that was not already a compact-boundary join (the 14 sessions the case finds all use the compact-boundary shape, and their links are unchanged: exact link counts as before). The shared-uuid shape without a boundary row is covered by units only. Prompt 1's hover on the rail was not opened on screen (the rail windows to the reading position).
