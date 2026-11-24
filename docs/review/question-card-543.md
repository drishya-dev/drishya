# Question cards — #543 acceptance and review

21 November 2026 · PR #560

A terminal-started question stays read-only: Drishya does not own that terminal's input request. The card now states where to answer, and the composer explains that questions in a turn submitted through Drishya can be answered here. Existing native consent, idle-client acknowledgement and exact request identity remain mandatory.

## Review corrections

- Native input accepts omitted option descriptions and string options, but Codex still needs its recorded question ID. Missing IDs are refused rather than replaced with the question text. Malformed question entries fail with a supported-input error.
- Both interactive presentations give their fieldset and choice group an accessible question name. The waiting indicator is static, with no pulse or glow. Whole-panel backdrop blur and hard-coded dark panel shadows were removed to retain the flat shared material and avoid unbounded GPU work.
- The fallback question form awaits the answer/stop acknowledgement and records its local receipt only after success. A rejected response leaves selections and text editable with an inline error. UI refresh is independent of that acknowledgement. Previously the composer discarded the callback promise and the form recorded a receipt before the request finished.
- The multi-select browser case uses the supported desktop minimum, 600 px, alongside 1440 px.

## Evidence

All imports used scratch Drishya homes. Native journals were read-only. Real screenshots remain under the isolated checkout's ignored .local directory; no journal bodies or captured text are committed here.

| Check | Result |
| --- | --- |
| Targeted units | 57 passed across native-input, controller, ask-question and question-card tests |
| Targeted browser specs | 15 passed, Chrome, two workers; question-card, native-question-combinations and codex-questions |
| Baseline real scan: Claude Code | 9 matching sessions; rec_638ceba6, 13.1 MB, 670 operations; 7 questions, 20 options, 7 literal answers |
| Baseline real scan: Codex | 9 matching sessions; rec_0f40bebd, 48.6 MB, 3214 operations; 14 questions, 26 options, 0 literal answers |
| Genuine captured question screens | Claude rec_17accc13, 2481316 bytes, 31 operations, one question; Codex rec_3a89ed51, 252392 bytes, one operation/question; 600 and 1440 px, no page overflow |
| Genuine Drishya-driven Codex | Installed Codex 0.171.0-alpha.13; session 01a1fcab, rec_3a89ed51, 252392 bytes; one native question, one browser answer, native turn completed; shown at 600 and 1440 px |

The genuine Codex seed was created by its native app-server in a throwaway repository with read-only policy and plan mode. After that client closed, Drishya approved the scratch workspace explicitly, resumed the same thread with the idle-client acknowledgement and submitted the question prompt through its controller. The browser selected an offered option and sent the answer through the actual daemon; no mocked answer route or fabricated journal events were used.

## External limit

Claude Code is not installed on this machine: neither PATH nor its known native install location supplies its executable. Genuine captured Claude questions were checked, and synthetic native-controller tests cover its answer wire format, but a fresh Drishya-driven Claude answer-and-continue run could not be performed. This acceptance item remains explicitly unverified; imported sessions and fixtures do not replace it.

The finished PR's hosted CI runs typecheck, all units, UI/site builds, security and package verification on Windows, Ubuntu and macOS, with the full Linux browser suite in four shards and affected/smoke browsers on Windows/macOS. Its final commit and results belong in the PR before merging.
