# CONTENT-14: MCP and other expanded readers reach the full stored result (31 October 2026)

Found during CONTENT-13: an MCP result kept 47,962 characters and an output artifact, but the card and the Inspector showed only the 4,000-character preview. Built by Codex, finished and merged by Yash with Claude. Real session content stays out of this file: ids are prefixes, everything else is counts.

## What was built

- **One reader for short and expanded views** (`StoredToolResult`): the card's "more" control and the Inspector open the same bounded reader over the sealed result. It prefers the recorded output artifact and falls back to the result on the sealed observation (Claude keeps complete text there without a projection artifact). A result whose preview is shorter than the 4,000-character limit shows no control: nothing more is stored.
- **Bounded UTF-8 continuation** (`packages/store`, `GET /v1/recordings/:id/artifacts/:artifact?byteStart=N`): each portion is at most 256 KiB and ends on a character boundary, so an oversized single line or malformed text keeps every byte reachable. The earlier line reader truncated an oversized line permanently. A negative start is clamped to zero like every other integer query on the server; a non-integer start is refused; the route needs the session token.
- **Mixed siblings:** a result with both text and a structured field offers a "Captured result field" choice. The structured field is shown as formatted JSON and labelled derived formatting (its rule is in the provenance); values that are no longer stored are named explicitly.
- **Honest states:** "Opening stored result", "no longer stored" with Retry and the labelled available preview, "No preview text", "Stored byte portion a-b of n; reading choices cover this portion only", and a reader that retries unresolved references on rescan but never replaces bytes already resolved.
- **Replay:** a future result is never mounted before its recorded boundary (the fetcher is not created for a result with no end sequence at that step).

## Verification

- Both typechecks pass; 29 store units (bounded continuation, UTF-8 boundaries); `stored-tool-result.spec.ts` 9 of 9: mixed final sibling and original for both harnesses at 600 and 1440 px, an oversized malformed single line read back byte for byte in portions, missing and failed reads with retry, Claude structured-only and mixed siblings, replay before the result, and the reader invalidating on source swap and rescan. One assertion in this spec was wrong and was corrected: it expected a negative `byteStart` to be refused, while the server clamps negatives for every integer query (the test now asserts the clamp).
- **Real sessions (counts only):** Codex `rec_58787f2c` (28.4 MB, 253 operations): 7 MCP results whose preview is at the 4,000-character limit; the two largest read in full through the API (65,536 and 7,301 stored bytes, every byte read, counts equal to what the server reports); the running app shows the stored reader for the largest at 600 and 1440 px, no overflow, zero page errors. Claude `rec_ab475ed8` (39.9 MB, 1,131 operations): one MCP result over the limit (4,379 stored bytes, read in full through the API; opened in the running app through the toolbox trail at 600 and 1440 px, stored reader shown, no overflow, zero page errors). Across four Claude sessions with MCP tools (`rec_45b046b2`, `rec_ab475ed8`, `rec_cc002c1f`, `rec_061e5f2d`) and 16 candidate journals, real Claude MCP results rarely exceed 4,000 characters.

## Not verified

- An observed live append on a real session was not run; the live revision behaviour is covered by the spec's rescan and append case.
- No real Claude result with a large structured sibling was found, so mixed siblings are checked on constructed sessions only.
