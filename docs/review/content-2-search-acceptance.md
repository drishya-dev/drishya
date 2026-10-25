# CONTENT-2 — search result reading and offline links

25 October 2026, PR #224. Existing search-result correctness and acceptance only; CONTENT-2 remains open for browser-step grouping, missing-source states and remaining fetch/browser acceptance. The paused History/PERF-2 area is unchanged.

| Before | After | Why |
| --- | --- | --- |
| Expanded results retained the compact one-line title ellipsis. A 320 px runtime guard reproduced clipped text. | The expanded reader wraps the complete supplied title; compact previews retain their five-result summary. | Expanding must provide reading space for the actual supplied material. |
| The result component trusted offline bundle URLs as links. | Only parseable absolute HTTP(S) URLs become links. Other references keep their literal title and URL, without navigation. | Offline material has the same click-only boundary as native search results; nothing is fetched automatically. |

No new web browser, preview fetching, grouping, capture transformation, schema, dependency, History or shared stylesheet change. The bounded component stylesheet changes reading-mode title wrapping only. Native projection field limits remain: the UI cannot recover characters that were not supplied; the existing captured output remains separately accessible.

## Verification

- Five local browser checks: retained WebSearch list; long titles, all nine expanded results, exact supplied output, no list overflow and keyboard opening at 320/390/1440 px; inert JavaScript/data/file/relative/malformed URLs from a deliberately synthetic offline bundle. No external request before an explicit link activation; Enter opens exactly the captured HTTP(S) URL once.
- The title-clipping assertion failed on the unchanged implementation before this fix. The offline edge fixture is synthetic, not a claim that an actual journal carried those schemes.
- Six isolated actual-session UI journeys: an available Codex recording (13 web operations carrying result lists; selected longest title, three results) and Drishya Claude (one result-bearing WebSearch, nine results), each at 1440/390/320 px. Full supplied titles fit, no result-list overflow, zero automatic external requests and zero page errors. The 390 px Claude frame was visually inspected. Journals and screenshots stay local and uncommitted.
- 795 whole unit tests across 150 files, both TypeScript projects and production UI build pass. Existing search projection unit guards still cover bounded fields and complete result pairs. Local checks only; no hosted CI or signed-in native turn.

## Scope still open

The browser-MCP strip/step scrubber is new feature work and remains behind the performance gate. This change does not certify the global TEST-2 browser gate, physical hardware, broader native compatibility or the entire CONTENT-2 item. The builder explicitly left the reading-position/History/PERF-2 area paused. Ready for focused review; no automatic merge through that failure.
