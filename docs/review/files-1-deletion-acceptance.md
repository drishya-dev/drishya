# FILES-1 — explicit deletion and full evidence acceptance

25 October2026, PR221. Completes the remaining FILES-1 acceptance on the existing implementation. **No production source change.** The20 October report remains a dated account of the earlier A/E/read/Touched increment; its DATA-1 deletion dependency is now satisfied.

## Scope and evidence rule

A/E/D, captured read-call counts, open-call now, distinct folder activity counts and Touched use recorded evidence. D requires an explicit typed FileChange delete or retained Delete File patch; failed/running writes do not become completed changes, an empty replacement remains E, and missing current files/Git status do not imply deletion. A later recorded creation replaces D with A. Claude shell rm remains unmarked when its harness records no explicit file-deletion fact.

Repository-tree membership matches Changes **for eligible repository-relative locations**, across the whole result set. Absolute/outside/unresolved paths remain in recorded work but are not relocated into the tree. Changes pages are capped at50 files; compare all pages or the full digest, never only the first page. A new120-file plus outside-path unit guards this scope.

## Local verification

- Eight scene units: retained read/folder/now/change/Review membership cases plus failed/pending/empty deletion safety and all-page Review parity. Existing unit already covers recorded D and delete/recreate precedence.
- Four browser cases with the optional real-store case enabled (zero skips):
  - Typed add/update/delete/failure/recreate data drives the existing tree live without reload. A file absent on current disk stays discoverable; emptied file remains E; failed deletion keeps prior A and does not add D to a new path.
  - File-evidence replay queries retain A before deletion, D at deletion, and D for that past step even after the current file is recreated. Folder counts, Touched, phone320/390 and unchanged row bounds checked.
  - A simulated legacy adapter omits typed-item observations from an actual-shaped journal. Normal sync adds nothing; explicit authenticated rescan enriches the same recording with its two missing facts, yields D, leaves old observations unchanged and adds nothing on repeat rescan.
  - Existing current-tree consent/navigation/read/open-call/result checks and actual dense-store desktop/phone matrix pass.
- Fresh isolated actual Codex import:2284 observations,59 recorded file paths and52 eligible changed files. Its explicit deletion was followed by a later write, so final D count is correctly zero; the captured deletion boundary returns D. Final file evidence matches the complete eligible Changes set.
- Actual Drishya Claude import:1138 observations,84 file paths and80 eligible changed files. Recorded reads/changes match full eligible Changes membership; no deletion invented.
- Nine extra actual UI frames: Codex current and deletion replay, plus Claude current, at1440/390/320px. Correct badge/read counts, no row overflow and no page errors. The390px Codex replay frame was inspected; real journals/frames stay local and uncommitted.
- The earlier564MB original journal is no longer at its recorded native path. No result is attributed to a fresh run of it; the available explicit typed-delete journal above replaces it for this acceptance. This does not silently restore or rewrite native journals.

797 whole units, both project TypeScript checks and production UI build pass. No hosted CI, capture/schema/runtime/dependency change or native controller turn. Physical phones and broad platform/human acceptance remain REL-2/REL-3.

## Completion and unrelated gate

FILES-1's supported captured-evidence scope is complete; its old DATA-1-dependent checkbox can close. No location, deletion or successful action is inferred beyond the recorded evidence. Legacy enrichment is verified with a deliberately simulated older adapter, not falsely described as an original unmodified old installation.

The separate TEST-2 reading-position defect is still open and the builder left History/PERF-2 paused. No source or assertion in that area changed. This verification PR is ready for review; it does not certify a passing whole-browser/release gate or authorize auto-merge through it.
