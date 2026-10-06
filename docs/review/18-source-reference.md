# One temporary historical source reference

6 October 2026 · W1 continuation · integrated app, not another prototype

## Reader behavior

The code reader's **Range** controls select a contiguous interval from the already loaded source page. Blank start/end mean the page's first/last displayed coordinates. Validation requires safe integers in increasing order within that page and the artifact's supported range. It does not fetch another page, stitch excerpts together, or read the current workspace. Existing go-to-line and 200-line paging remain the route to a different stored range.

**Copy range** copies selected source text without display line numbers or invented context. Line separators are preserved between selected lines; it is a source-line extraction, not a byte-identical whole-file export. Clipboard failure has an explicit select-to-copy fallback. No repository/harness files are written.

**Pin range** replaces the previous reference with one temporary snapshot, retaining at most 200 lines and 64 KiB of decoded UTF-16 source text (`text.length * 2`). Oversized ranges are rejected rather than silently shortened. The snapshot also retains the returned artifact descriptor, real path/range, provenance and redaction badge. A response-size cut affecting its final line is labelled. The text budget excludes the small descriptor/React overhead; it is not a claim that total browser RSS grows by only 64 KiB.

The compact reference lives above the footer/return-to-latest controls. Activating it opens a local reading surface; minimizing or Escape restores focus to the reference toggle. It is not a modal, a second entire file, or a permanent inspector. All text remains DOM-rendered and selectable. The body scrolls locally; reduced motion and map-off do not remove information. Narrow screens keep the surface within the viewport. Opening/pinning, pointer selection, wheel reading and keyboard interaction hold presentation; capture and history continue independently. Reading the reference again after returning to latest also holds the camera. Pointer movement alone does not.

The snapshot survives unrelated live append, reader close and history virtualization. It clears on data-source/session change, reopening/loading a recording, entering/leaving replay, any replay-cutoff change, leaving the viewer, removal, or replacement. Render-time scope checks prevent a stale reference from flashing before effect cleanup. Historical metadata is frozen at pin time and labelled as a temporary historical range, never current workspace content. It is not persisted in localStorage, SQLite, exports, bookmarks or the material cache. It owns no artifact fetch and never loads future evidence itself.

## Implementation seams

- `ArtifactReader.tsx`: page-local range inputs, validation/copy and one bounded pin request. Loaded coordinates come from returned artifact range and existing slice totals, not just the operation label.
- `ReadingReference.tsx`: viewer-scoped provider and temporary snapshot UI. Snapshot provenance comes from `structuredClone` of the returned descriptor. Scope identity uses source object, exact recording ID, history/replay mode, replay step and loaded-projection availability. Normal history step growth is deliberately excluded.
- `Viewer.tsx`: provider wraps the integrated workspace so unmounting a passage cannot drop its deliberate reading reference. Leaving the viewer releases it.
- `p1.css`: existing theme tokens, readable source edge, bounded local scrolling, one hairline surface. The mobile return-to-latest collision reproduced in a real browser is fixed by keeping the reference above that control.

No observation schema, daemon API, capture/store, dependency, graph or composer changes. This does not implement multiple pins, durable bookmarks, whole-file tabs, folder navigation or approved current-file reads. Those require their own bounded designs.

## Acceptance and continuation

Local tests verify exact copied lines 201–203, pin survival across unrelated live append and expanded-reader close, keyboard minimize, non-1-start range validation, replacement of one reference, a final blank line retaining its coordinate, mobile width, oversized rejection, derived provenance, session exit and replay reset. The enhanced ten-minute reader keeps the same reference while testing append/held anchors/return-to-latest and bounded DOM. STATUS carries final measured results; failed setup/layout probes are not acceptance.

Next: polish the source-reading controls and reference placement through actual developer use, then bounded W2 path quick-open/folder navigation sharing the existing file/evidence selection. Preserve current-file consent separation. Multiple retained tabs, drag-resizing and persisted notes remain proposals; do not add them by accumulating unlimited payloads.

Local acceptance: typechecks/245 units, 34 ordinary browser cases (two opt-in skips), offline packaging and reproducible demo bundle pass. The retained-reference soak passed 600,682 ms / 114 rounds / peak 722 DOM nodes; final header/focus polish was checked separately through the complete final local browser suite. Hosted/platform verification is intentionally deferred to pre-publication under CI_POLICY.
