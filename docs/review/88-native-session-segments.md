# 88 — Evidence-backed native segment navigation

17 October. Follow-up to87 on `codex/native-segment-navigation`; one coherent commit/PR. PR68 is merged/pushed as45a09e7. Local tests only.

| Before | After | Why |
|---|---|---|
| An older Codex journal could stop growing while another journal held newer work | A header disclosure offers explicitly referenced newer segments | Show why a session appears stale without guessing from titles/folders/time. |
| Selecting a newer unimported segment required finding its duplicate title on Home | Import/open its discovered source explicitly, then use the existing bounded history catch-up | Preserve native ownership, original history and passive capture. No native turn, automatic watch or silent timeline merge. |
| Segments without an initial user prompt could yield an empty header | Recorded title or Untitled session fallback | A native history fragment need not contain the original prompt. |

## Evidence and bounds

`GET /v1/recordings/:id/segments` is authenticated and read-only. It inspects only Codex-discovered sources using the existing sanitized discovery path, never a caller-provided filesystem path. An item requires matching native session family/root, `history_mode:paginated`, an explicit `history_base.thread_id` matching the current journal's filename identity, safe ordinal/byte boundaries and a byte boundary within the parent file. Self references/unknown identities are excluded. Metadata is read from bounded256KiB heads; at most64 recently modified candidate journals are inspected. Incomplete/unreadable inspection is explicit. It is evidence of a native parent reference, not a claim that journals were merged or every parent byte is duplicated/absent.

The active visible history checks at opening, visible-tab return and30-second intervals, serialized per mounted view. Replay/offline/combined/non-Codex views do not start this lookup. Claude's existing source-set handling is unchanged. Discovery filtering avoids scanning Claude journals just to inspect Codex segments. No observation/event schema, native configuration or dependency changes.

The disclosure uses native details/summary and existing outside/Escape dismissal, immediate keyboard actions, bounded phone geometry and no looping attention motion. Opening is explicit; stale async imports cannot navigate away from Home or a different recording. Normal import validation/redaction and native permissions remain authoritative. A trusted parent reference is not permission to run a prompt.

## Validation

Four focused unit cases cover valid references, unrelated/malformed boundaries, self/unknown parents and incomplete bounded scans; the existing23 ingest tests pass. Two browser journeys cover authentication/read-only lookup, explicit import/navigation, no native prompt/watch, outside/Escape/focus,390px bounds and delayed-import navigation guards. A read-only check against the actual Drishya journal finds one native-linked newer segment with a bounded parent reference. No raw journals/private identifiers are committed. Full check/build results are in STATUS.

## Remaining work and builder correction

This provides forward navigation, **not duplicate-safe automatic segment stitching or hidden predecessor reconstruction**. The joined evidence→source→native correction→resulting check loop, wider UI/theme audit and native/human/platform acceptance remain from84/85/87.

Next separate one-commit PR: restore the prompt timeline's bottom anchoring, keep only its uppermost marker clear of Workspace, make it independently scrollable with complete history/time previews, and put the page scrollbar at the far-right viewport edge. The builder corrected87's top-anchoring interpretation on17 October; do not retain that interpretation.
