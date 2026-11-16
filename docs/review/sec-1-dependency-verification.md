# SEC-1 dependency verification

PR #365 was opened as a regular implementation PR at `71ea655` before testing. The fixture generator follow-up is included in the verified revision `3f2204c`. The existing React plugin 6.1.1 accepts Vite 8 and stayed on that version. The root dev dependency selects the same Vite for Vitest and the UI. The lockfile needs no overrides.

## Advisory coverage

| Original Dependabot alerts | Candidate resolution |
| --- | --- |
| 1–4 | Vitest and @vitest/mocker 4.1.12 in the workspace; the standalone shop declares ^4.1.12 and resolves 4.1.12. |
| 5–6 | Tinypool is absent from the workspace and standalone shop lockfiles. |
| 7 | PostCSS 8.5.32 resolves source-map-js 1.2.2. |
| 8–18 | Vite 8.3.6 is the only resolution, replacing 7.3.6 and 8.3.1. This covers the Windows launch-editor advisories bundled in Vite as well as its own advisories. |
| 19 | @vitest/mocker resolves 4.1.12. |

The workspace and independently resolved standalone synthetic shop each returned exit 0 and zero findings across all severities from `pnpm audit --json`. A scratch regeneration emitted the exact tracked shop manifest byte-for-byte. The packaged CLI declares zero runtime, optional or peer dependencies. The daemon's nine manifest dependencies are internal workspace packages.

GitHub's Dependabot count is still 19 open on main. Dependabot scans the default branch, so leave SEC-1 unchecked and verify alerts 1–19 after the PR lands. [GitHub alert lifecycle](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-alerts)

## Gate

Initial revision `71ea655`: frozen install and typecheck passed. The unit command reported 1,228 passes, one existing skip, four failures and one suite cleanup error. It inherited Windows' short TEMP/TMP path. A probe confirmed that the inherited path and the path returned by `realpath` name the same directory with different strings. That trips the file identity checks and cleanup guard. The race test timed out while waiting for a point the rejected image request never reached. This matches the known TEST-2 path setup failure. [TEST-2 Windows evidence](test-2-live-anchor.md)

On `3f2204c`, set process-local TEMP/TMP to the native canonical path. All nine tests in the three affected files passed, then the full gate completed with unchanged assertions, timeouts and skips.

| Stage | Result |
| --- | --- |
| Frozen install and typecheck | Passed |
| Full units, three workers | 1,232 passed, one existing skip across 205 files |
| UI build | Passed |
| Edge parallel, three workers | 662 passed, 27 existing skips |
| Edge serial, one worker | 33 passed, one existing skip |
| Package verification | Isolated offline install, both harness imports, demo bundle, authenticated API and persisted restart passed |

Zero browser retries. This is one SEC-1 gate on the tested revision. The unit path failures from the first run are retained in local evidence alongside the passing run.\n