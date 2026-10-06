# Stored source navigation — 6 October 2026

Continues [16](16-captured-range-reader.md) and the partial W1 source workspace. This increment adds navigation inside actual stored evidence, not an editor or current-file service.

## Reading behavior

- Find still searches only the loaded page. **Next match / Previous match** cycle matching source lines, wrapping within that page. Enter / Shift+Enter work from the find field. Only deliberate activation moves the reading viewport; typing changes highlights without scrolling.
- A selected line has a quiet source-coloured edge and `aria-current="location"`. Characters remain stationary/selectable. Match navigation does not claim a cross-page search or highlight individual substring occurrences.
- **Go to stored source line** validates a positive safe integer against the returned stored line count and any known artifact range end. Invalid input shows the supported source range without fetching another page. Valid navigation reuses the current page when possible or requests a bounded 200-line slice beginning at that source offset.
- Paging retains at most 64 visited offsets, not 64 payloads. After a direct jump or the oldest retained page, Previous requests up to 200 preceding lines. Text remains under the existing byte-limited material cache; there is no whole-file browser copy or new index.
- Reader controls stay mounted during page loading; source content is explicitly loading, never a stale page presented under new coordinates. Go-to-line keeps keyboard focus through a cross-page request. Errors/unavailable content retain explicit states.

## Live reading fix

A failing-first daemon browser test demonstrated that unrelated live append changed the artifact cache key, replaced a loaded reader with a skeleton and dropped find focus. `common.useArtifact` now keys blob-backed material by the complete projection artifact descriptor, source identity, recording, artifact ID, scope and requested slice. The blob is immutable; unrelated recording revision increments do not change its reader identity. Descriptor changes (including blob, range, provenance or availability) invalidate it. Unlisted/non-blob artifacts remain revision-keyed so late captured results can become available. Do not reduce this to blob-only identity or remove source/recording isolation.

`ArtifactView.totalLines` carries the already returned slice count; no API or observation-schema amendment. `CodeView` exposes source-line attributes and the current location. `ArtifactReader` owns query, active line, source-line input and bounded offset navigation. The composer, capture/store and daemon dependencies are unchanged.

## Verification and shared continuation

The B3 daemon journey checks preserved find focus/query/page/inner scroll across live append, literal match cycling/wrap, Enter/Shift+Enter, out-of-range rejection, cross-page line opening and backward navigation. The non-1-start offline fixture checks source lines 81–94 and rejects 95; narrow layout and pending replay masking remain tested. Typechecks/245 units, build and 33 ordinary browser cases pass (two opt-in skips). Fresh ten-minute reading passed: 604,905 ms, 115 rounds, peak 664 DOM nodes. PR #35 merged as 2c23b76 after all seven exact-head CI checks (run 37452694698).

Next bounded W1 slice: range copying and one pinned historical reference, with an explicit retention budget and shared session/cutoff reset rules. First review the current navigation in the integrated app; any pin must distinguish captured excerpt, derived content and current workspace. W2 folders/semantic zoom, W3 approved current files, W4 symbols and W6 handoff remain staged in DEVELOPER_WORKSPACE. Human comprehension/preference and physical/platform release gates remain open.
