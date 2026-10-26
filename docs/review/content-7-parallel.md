# CONTENT-7 — focus follows explicit JSON exploration

26 October 2026, PR #238. Focused correctness of the existing bounded structured reader. Broader CONTENT-7 document/source acceptance remains open; no new table controls or data parser added.

| Before | After | Why |
| --- | --- | --- |
| “Explore in tree” revealed a selected container but keyboard focus stayed on the old action button. | The explicit handoff waits for the virtualized destination row to mount and focuses it without further scrolling. | A developer can immediately continue with arrow keys at the material they selected. |
| The delayed scroll callback did not own a destination-focus handoff. | A one-shot pointer ref and layout effect coordinate the existing tree window and selected row. | Focus follows this deliberate action only; search changes or background data do not steal it. |

## Evidence

- A new desktop regression fails on unchanged source: selected `/items/499/detail` is rendered at tree row 503 and marked selected, but is inactive after keyboard Enter on Explore in tree. The fixture has 500 records and a nested object only in its final record; it exercises the real virtualized table → tree transition rather than a small fully mounted tree.
- After the repair, desktop (1440 px) and phone (390 px) journeys focus that selected row, preserve fewer than 29 mounted tree rows, continue ArrowRight to the captured `label`, read the literal value and return focus to the original inspection trigger on Escape. Phone frame inspected.
- **12 focused browser checks pass:** those two regressions plus existing JSON late-row/raw handoffs, native/MCP resources, reader exit motion and delimited-reader regressions. No existing tests edited.
- **25 focused units pass:** structured-data and captured-resources suites. UI TypeScript check and own production UI build pass. Backend root TypeScript was attempted but the newly junctioned worktree resolves `Store` / `BlobStore` through both this checkout and the original checkout, producing unrelated nominal private-field identity errors in existing projection tests; no backend source touched. Root will run the combined type/unit/build check in its established workspace.
- **Four actual-source journeys pass** using a private local copy of the already redacted store: Codex and Claude at 1440/390 px, 13 and one eligible structured operation respectively, selected samples of 83 and 29 values. Search → selected container → Explore focuses the exact tree row, clears the search as before, retains bounded DOM and exact Original text, and returns focus on close. Zero remote requests and zero page errors. Actual journal/store content and screenshots remain ignored; the root's original store was never opened for mutation, and no native turn was submitted.

## Scope

Only `StructuredDataReader.tsx`, the new focused browser spec and this report change. No CSS, new controls, limits, captured data, numeric serialization, resource parsing, persistence, native controls, capture/contracts/projection/schema or daemon change. No History/common/worker or PERF-2/3 changes, and no source owned by the other parallel agents. Installed emil-design-eng guidance informed the explicit destination-focus repair; existing animations remain unchanged. No hosted CI or full browser gate.

The source fix and report are ready for root integration; shared TASKS/STATUS completion and claim release are intentionally left to the parent to avoid concurrent documentation edits. Parent CONTENT-7 remains unchecked for its broader acceptance scope. Physical/browser-version/assistive-technology acceptance remains REL-2/3.

## Parent integration result

All three independent content repairs were combined in the established parent worktree: **857 whole units /152 files, both TypeScript projects, production build and nine distinct new browser cases pass**. This resolves the new-worktree module-identity typecheck limitation above for the source increment. No source conflicts; temporary verification merge aborted. TASKS/STATUS finishing and own claim release included in this PR; broader CONTENT-7 remains open.
