# GIT-2 — complete native commit and working-edit acceptance

29 October 2026. Completes the native acceptance left open after PR #269; PR #285. No Git graph, history pagination, checkout or theme redesign.

## Genuine cases, not fabricated journals

The builder explicitly approved temporary Workspace write only inside one new synthetic scratch repository, with Codex approval on-request, network off and saved settings unchanged. Its native journal records actual apply_patch changes and literal commit commands. The first commit attempt was refused by the native Git-metadata sandbox; that failure is retained. A supported one-time approval subsequently allowed only the exact commit command in that repository, without an exec-policy amendment. Native source files were never edited by Drishya.

Claude Code then ran the same bounded synthetic experiment with manual permissions and a supported stdio permission callback. The host allowed exactly two Edit calls for the synthetic file and one exact Bash commit command. No other file or command was allowed, and no saved permission rule was added. Both harnesses committed real changes and left a later genuine captured edit uncommitted. Their working-tree checks were made sequentially, before the next harness changed that same synthetic file; they are point-in-time matches, not claims that both distinct drafts remain current simultaneously.

| Capture | Source bytes | Observations | Actual acceptance |
| --- | ---: | ---: | --- |
| Codex `rec_e6190705` | 307,270 | 100 | One strict commit-time/path link and one current changed-line match, both navigated at 600/1440 |
| Claude Code `rec_4d155238` | 199,810 | 31 | One strict commit-time/path link and one current changed-line match, both navigated at 600/1440 |

All four journeys opened the exact captured command through “Command matches turn …” and the matching file through “Working tree · this session”. Derived-association wording remains visible; neither route claims authorship. No page JavaScript error or viewport overflow occurred. Claude's commit patch was also allowed to finish loading before the final screenshot. Private screenshots, raw native output and scratch paths stay in ignored `.local/`.

## Native failures reproduced and repaired

| Before | After | Why |
| --- | --- | --- |
| Codex CommandExecution cwd is a local file URL; the reducer treats it as a second workspace and namespaces every file | Decode explicit local absolute file URLs at the adapter boundary with a shared filesystem-free helper | The native URL identifies the same captured local directory; no root is guessed or filesystem opened |
| A standalone CommandExecution has actual cwd, exit code and elapsed time but no tool-call/start observation, so strict links reject it | Use its actual captured cwd; derive an interval from recorded completion time minus recorded elapsed milliseconds | Preserve the strict path set and ambiguity refusals without inventing a native start event |

Remote/ambiguous file URLs, query/fragment/NUL/encoded separators and relative URL spellings are refused by the decoding helper. Existing ordinary paths retain their spelling. Current-file identity checks and mismatch refusals are unchanged. Missing, non-finite or negative elapsed time does not supply a derived interval. Explicit native execution cwd takes precedence over an opaque code wrapper's directory assumption. Commit links retain the existing `commit-time-paths` derived-association label.

The original sealed import with file-URL cwd is preserved privately as failing evidence. Acceptance imports the genuine journal afresh through the corrected adapter into a separate scratch home; existing observation IDs are not overwritten. This task does not claim that a rescan rewrites old stored cwd metadata. FILES-6 separately retains exact historical namespace prefixes while decoding recorded directory URLs for display.

## Checks and remaining boundaries

Thirteen focused capture/adapter/Git units and both TypeScript projects pass; production UI build passes. The existing Git evidence browser regression remains part of the shared batch gate. The reusable `literal-commit` real case now scans both harnesses, including standalone native Codex command records. All new behavior was first demonstrated by the genuine capture above, with synthetic regression guards afterward. No event-schema, projection, History, native-controller or Git mutation endpoint was added.

The completed batch's full gate is recorded separately before review readiness. GIT-2 has no remaining native acceptance blocker after these checks. This is not NATIVE-1/2 connected-controller certification or platform release acceptance.

A separate native-controller finding is handed to CONTENT-3/NATIVE-2: on this installed Claude CLI, manual/host without the explicit stdio permission callback produced denied Edit results and zero host requests; adding the supported callback produced the three exact permission requests and successful genuine actions above. The current controller invocation needs its own coordinated acceptance; this PR does not change it or silently describe that connected path as verified.

## Final integrated gate

Source-equivalent batch `ef541e4`: UI build, both typechecks, 1001 units (one skip) and package verification pass. Browsers: 481 passed, 26 skipped, one b2-live:139 wheel-end failure. That named test passes alone on unchanged integrated code and clean main; baseline failure is unproven. This is feature-complete and review-ready, with the shared merge-gate qualification retained rather than claimed green.
