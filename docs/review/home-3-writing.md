# HOME-3 — discovered journals being written

The existing Running now strip includes discovered, unopened journals whose file modification time is less than one minute old. Its explanation says **Writing now**, based on the journal's change time; it makes no claim about the agent process. Newer writes lead the existing bounded strip. Clicking one imports or refreshes that source with passive live observation enabled.

**Review fix (6 Nov, Harsh):** the strip is the union of two kinds of evidence, `writingSince()` in `home-import.ts`: the discovered parent journal's write time, and a followed recording's captured change time (`health.state === 'following'` with `lastChangeAt` under a minute old). Claude ingest also reads companion and sub-agent files, so the parent's mtime alone would drop a session that is still changing, and an imported recording outside the discovery roots has no discovered journal at all; such a row opens through its recording. Both kinds keep the one-minute expiry.

Home advances its freshness clock on every visible discovery tick, including when the source list and file sizes have not changed. Old writes expire without requiring another write, Refresh or an opened session. Invalid and future timestamps do not establish writing. Sub-agent nesting and the ordinary library remain unchanged. The strip is available at the supported 600 px minimum as well as 1440 px.

## Genuine acceptance, 5 November

Only a throwaway Git repository and scratch Drishya home under `.local/` were used. Both real native CLIs read a synthetic file and ran a slow Node command. No harness journals or saved policies were edited.

| Harness | Recording prefix | Bytes | Observations | 600 and 1440 px |
|---|---|---:|---:|---|
| Claude Code | `rec_73399b45` | 241,754 | 23 | Appeared before opening; opened live; left the strip 69.3–70.1 seconds after the last write |
| Codex | `rec_2be6ea63` | 229,580 | 48 | Appeared before opening; opened live; left the strip 64.1–64.6 seconds after the last write |

Measured time from native journal creation to appearance was 11.1 seconds for Claude Code and 6.2 seconds for Codex, including initial native journal preparation and discovery. The regression explicitly verifies one discovery tick for entry and expiry with an unchanged source response at both widths. Raw captures and private runner evidence remain in `.local/`.

Focused checks: one timestamp-boundary unit; ten Home browser journeys (including both new expiry checks). Full finished-batch gate results are recorded in the PR description before marking it ready.

## Finished-batch gate

Both tasks' frozen source changes were checked together in an isolated worktree with its own frozen install, rebuilt UI and Edge. Both typechecks, build and package verification passed. Units: **1,201 passed, one skipped, 200 files** with four workers; the initial unrestricted run hit 16 existing five-second timeouts under concurrent work, without assertion changes. Browser suite: **623 parallel + 33 serial passed, 28 skipped, one failed**. The failure, `product-workspace.spec.ts:344`, is the unchanged Pin range timeout: it also failed **3/8** clean-main repetitions; the isolated validation-branch rerun passed **1/1**. This is a recorded TEST-2 baseline flake, not a clean full gate or a fix to TEST-2. Its source and test were left untouched.

The initial HOME-3 `check:affected` browser launch lacked the Edge environment and could not find bundled Chromium. The focused Edge checks and subsequent isolated full Edge run are the browser evidence; the failed launcher is not reported as a passing check.
