# FILES-1 — captured evidence in the existing file tree

20 October 2026 · `codex/files-1-evidence-tree` · PR #139

**READY FOR CLAUDE REVIEW / MERGE.** This is the supported-evidence increment; FILES-1 remains unchecked for explicit deletion evidence after DATA-1. Claims were pushed on main before implementation, then clarified before adding the small read-only history query. Integrated main through cefb2ca; no manual conflicts with READ-9 or UI-1. Final changes stay within 14 files and four branch commits including the integration merge.

## Design and behavior

Applied installed `emil-design-eng`; verified the actual running tree before editing. Shared Legacy-backed Modern uses FolderExplorer, not the retired standalone ModernFiles component. No new panel, toolbar row or capture path.

| Before | After | Why |
| --- | --- | --- |
| File names alone | A small eye/count, recorded A/E and an open-call hint | Connect repository browsing to captured agent work |
| Folder gives no activity context | Dot and distinct touched-file count | Find the active part of a large tree without opening every folder |
| Find only matches names | Existing field contains a compact All files / Touched menu | Offer evidence filtering without resident canvas clutter |
| Current index replaces missing captured paths | Current paths union captured relative paths | Keep captured work discoverable when a file no longer exists on disk |
| Loaded pages cannot yield whole-session counts | Worker indexes all recorded operations; API returns requested visible rows | Scrolling through old passages cannot silently change the totals |

The input and filenames retain their allocation, virtualization and keyboard names. Change marks use the existing edited/pass palette tokens, including the light theme. Evidence is separately described for assistive technology. No new motion curve: reuse existing interruptible details-menu opacity/scale and dismissal; counts do not pulse or count up, and tree rows do not animate layout. The first browser run exposed a class-name collision with an older `.file-filter` input; the new filter now has a unique scoped name. Menus can extend outside a short tree without clipping and stay bounded to the viewport.

## Evidence semantics

- Eye count means **captured read calls**, including failed attempts; it does not claim the agent successfully read those bytes. Duplicate references within a call count once.
- A requires the adapter's recorded `created` field. Later edits retain the session's creation mark. E describes captured edit/write operations. Failed or still-running writes are not marked as completed changes. Unknown outcomes are qualified in title/accessible description, matching Review work membership.
- `now` means an **open captured tool call** in live history; it is not a claim about OS process liveness. It disappears when that call receives its result and is hidden in replay/offline history.
- Folder counts and Touched use full path/role metadata retained across history pages. Counts are distinct files, not operation totals. Mentions alone do not count as activity; read/write/search-hit/test evidence does.
- No D yet: current edit detail records creation but no explicit deletion discriminator. Empty text, missing current files and Git status are insufficient. DATA-1 owns richer changes; TASKS retains this dependency explicitly.

## Data boundary

New derived scene helper is independent of the event schema. Its WeakMap index follows immutable projection identity/revision in the existing history worker; a new capture invalidates the index naturally. The authenticated `file-evidence` read query requires 1–100 paths of at most 1024 characters and accepts the existing bounded replay step parameter. Only requested compact rows cross the API. UI batches/debounces visible rows; it never downloads the full projection or issues a query per file. Offline bundles reduce their already-resident projection locally. No new dependencies, journals, native settings, permissions, disk writes or Git reads.

## Local validation

- Full unit suite: **615 tests / 113 files passed** before the final additional Review-work membership assertion. The final focused reducer/server run passed **45/45**, including that new assertion.
- Both TypeScript projects and production build passed after integrating main.
- **20 browser journeys passed**: the existing connected-workspace suite plus the new live tree and actual-session matrix. The final two-case browser rerun passed with narrow-menu boundary checks at 320px alongside 390px and desktop1440.
- Synthetic live journey checks consent/current tree, Touched excluding an untouched file, folder count, opening a real current reader, Escape/outside dismissal, appended open Read and its later result without refresh.
- Actual local redacted data: Drishya Codex shows captured E; Skeletongraph Claude README shows **10 read calls and E**. Skeletongraph Codex's older import has no supported read/change path evidence: verifies honest absence, not fabricated marks. Original missing native journal emits the existing session-segments ENOENT warning; imported data remains usable. No new page errors.
- Screenshots inspected locally; never commit private session images. Phone checks are viewport emulation, not physical-device/assistive-technology certification. No hosted CI.
