# CONTENT-7 — exact numeric evidence in JSON reading

25 October 2026, PR #228. Correctness of the existing structured reader; parent CONTENT-7 remains open for broader source/document acceptance.

| Before | After | Why |
| --- | --- | --- |
| A captured ID `9007199254740993` displayed/copied as `9007199254740992`. | The original number token is retained for tree, table, search, selection and copying. | A rounded ID is different evidence. |
| Overflow displayed as null, underflow as zero; decimal/exponent spelling and negative zero changed. | Noncanonical numeric source text stays literal, including `1e400`, `1e-400`, `1.2300` and `-0`. | The reader must not replace supplied values with native-number artifacts. |
| Copying a containing object reserialized rounded numbers. | Bounded selected-value serialization emits retained number tokens as numbers, preserving quoted strings as strings. | Exactness must survive copying a row/object, not only a single cell. |
| A parser without primitive source context could silently round before the UI saw the value. | Numeric structured inspection refuses that path and retains exact Original with an explicit lossless-support requirement. | Unavailable is more truthful than manufactured precision. |

The implementation uses the primitive source text supplied to a JSON.parse reviver, as specified by [ECMAScript JSON.parse](https://tc39.es/ecma262/multipage/structured-data.html#sec-json.parse). An internal symbol-branded token is a non-container numeric leaf; it cannot be manufactured by an ordinary JSON object. Native canonical number values remain unchanged. Only the explicit ephemeral reader uses the token model: no captured observation, artifact, transport, persistence or schema changes.

Copy original remains byte-for-byte the supplied text. Copy value serializes the selected JSON value (not original whitespace or duplicate-key syntax) while retaining numeric spellings. This cannot recover precision already lost by a harness before capture. No eval, generated code, regex number guessing, remote loads or new dependencies.

## Verification

- Eight added guards failed on unchanged helper behavior: large ID, six numeric spelling/overflow/underflow cases and missing source context. Final model suite has 16 units, adding quoted-string and nested row/object copy coverage while retaining bounded depth/bytes/count/search and literal key safety.
- The original compiled UI reproduced the rounded large ID in a phone table before rebuilding the fix.
- Six browser cases pass: native/MCP resource handoffs; retained bounded late-row JSON reading; native/MCP numeric table/tree/search/selected-row copy/Original at phone width; and simulated context-less parser fallback. Clipboard assertions check exact numeric tokens, quoted sibling values and original text.
- Four actual-session journeys pass: existing Codex and Drishya Claude JSON outputs at 1440/390 px; exact selected numeric copy, exact Original and dialog containment. Sample has 11 visible Codex numeric-result operations and one Claude operation; **none contains a noncanonical numeric token**, so the precision edge cases are established by synthetic regressions, not misrepresented as recovered real IDs. Phone frame inspected; real bytes/screenshots stay local.
- Typed wrapper parents intentionally hidden by the UI were excluded through the existing materialOperations selector before choosing actual visible samples. No projection/correlation or visibility code changed.
- After integrating main's Workspace fixes (#226): **847 whole units**, both TypeScript projects, production UI build and all six focused browser cases pass. Local checks only; no hosted CI. No source, assertions or camera behavior in the paused History/PERF-2 area changed.

Compatibility is checked with installed Edge and Node 24 plus a deliberately context-less parser. Physical/browser-version/human ten-minute acceptance remains REL-2/REL-3. No broad release or whole CONTENT-7 completion claim.
