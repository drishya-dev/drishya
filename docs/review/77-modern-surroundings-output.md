# 77 — Modern surroundings and structured output

15 October 2026 · Yash with Codex · branch `codex/modern-reading-craft`, PR #65.

## Builder direction

Continue the Legacy-backed Modern foundation from 76, keeping its visualization and working native/evidence system. The builder specifically requests a properly designed Settings space, a different UI font, the earlier compact Modern composer, a content-sized vertically centered right rail, a distinct utility menu, more informative syntax colors, and one sessions library rather than separate recordings/discovery sections. The reported escaped-newline issue must be investigated without damaging source text or line addressing.

## Design review

Applied installed `emil-design-eng` and `animate` guidance. Existing native dialog/details primitives retain focus, Escape, outside dismissal and permission handling; no new UI dependency. Pointer feedback remains finite and keyboard actions immediate.

| Before | After | Why |
| --- | --- | --- |
| Settings sections flush against dialog edges | Allocated category navigator and padded independent content scroller | Fix the wrapper/padding regression and make controls findable |
| One long General page | Appearance, Reading, Playback, Privacy, Keyboard, UI versions | Reduce scanning while retaining every setting |
| Rounded Outfit throughout Modern | Native Segoe UI Variable/Segoe UI UI stack | Calmer developer-tool typography without external font requests |
| Large composer with always-visible consent setup | Compact target/prompt/actions; setup inside Connection & permissions | Restore the earlier Modern presentation while retaining exact native consent |
| Literal three-dot menu | Panel utility SVG with the same accessible native disclosure | Distinct Modern control, complete existing utilities |
| Full-height right rail regardless of contents | Intrinsic-height centered rail, bounded scroll when long | Balance empty space without losing tool origins or inventories |
| Separate imported Recordings and Sessions lists | One workspace/date-grouped sessions list | Imported IDs deduplicate discovery; open and multi-session actions remain |
| Muted syntax roles | Distinct dark/light keyword, function, string, number, type, property and comment colors | Improve code reading while preserving every character |
| JSON tool envelopes shown with literal escape sequences | Recognized envelopes render decoded tool text, with explicit raw toggle | Restore newlines only where JSON establishes their meaning |

Only UI text typography and syntax colors intentionally differ within the existing visualization. Card content, layout/widths, hover enlargement, arrivals, connectors and 3D map implementation remain shared with Legacy. Canvas and Legacy keep their own surrounding presentation. Shared structured-output readability applies to Legacy readers too.

## Newline and indexing finding

Actual Drishya Codex DOM inspection found shell previews containing MCP/native tool envelopes and dozens of literal `\n` sequences. These are JSON-encoded strings from the captured tool wrapper, not missing CSS whitespace. A truncated preview can start mid-envelope and cannot safely be decoded.

`lib/tool-output.ts` recognizes complete native execution results (`output` with execution metadata), fulfilled wrapper values, and text-only MCP results carrying an explicit error flag. It uses JSON decoding only, bounded to 2 MiB and depth four. Arbitrary JSON data, literal source strings, Windows paths, partial JSON and non-text MCP content remain untouched. Terminal previews may fetch a bounded first artifact page when their tail preview contains encoded escapes; only a complete recognized envelope is promoted to formatted text. This does not unlock missing material.

`ToolOutput` labels the derived decoding and offers Show raw. More than 500 decoded lines page explicitly to bound DOM work. Raw capture, stored artifacts, source-line ranges, search indexes, reader paging, copying and evidence addresses remain unchanged. Decoded display lines are not source lines. No blanket `replace(/\\n/g, ...)`, reducer migration, journal mutation or inferred content.

## Verification

- Both typechecks and production build pass; 380 unit tests pass, including three envelope/source-preservation regressions.
- 34 distinct browser journeys across Modern/Canvas/Classic/Studio: prior combined 26, four new settings/library/composer/raw-output checks, three long-diff hover cases, one whole-material hover switching case. Focused final settings keyboard rerun also passes.
- New settings test covers padding, alternate font, keyboard category navigation, reasoning dropdown and Escape. Other new tests cover sessions-only/deduped discovery, compact consent/menu sizing, no short-input scrollbar, decoded newline rendering and exact raw recovery.
- Actual local Codex and Claude sessions inspected; Codex now renders recognized structured outputs as multiline tool text. Rootless older Claude remains explicitly read-only for native continuation/current files. No native prompt submitted.
- No hosted CI; user package-manager/artwork edits excluded. Human ten-minute, physical/platform and real-account native acceptance remain release gates.

## Continue

Modern active entry is `modern/entry.tsx` importing the shared product plus `surroundings.css`, `settings.css`, `workspace-chrome.css`. Settings behaviors are shared in `UIVersions`/`ProductShell`; one library composition lives in `ModernSessions`, and shared `PromptComposer` owns all native submission/attachment/approval handling. Do not resume the retired Fresh stage. Continue user assessment and integrated polish on real sessions.
