# SHIP-3 — A working Home opening

Yash with Codex, 11 November. Whole Home hero item; no session discovery, filtering, import, list virtualization or native behaviour changes. Existing Inter, tight heading tracking and palette roles echo LAND-1 without importing its marketing animation or taking over Home.

| Before | After | Why |
| --- | --- | --- |
| Product sentence hidden for returning users behind About | One always-visible sentence describing reads, commands and changes beside the code | Explain the visualization without a marketing page |
| Resume can be a separate full-width block; first action depends on prior saved state | One compact first action for a genuinely writing journal, otherwise the latest session | Start with the user's own work |
| Refresh and About compete in the opening | Refresh joins the existing Home utility actions | Content and the real session stay primary |

The writing label uses existing journal-evidence logic, never process-liveness inference. Existing Running now still exposes the other writing sessions. The hero ignores library filters and sub-agent rows; those remain available in the list. No demo or fabricated activity. Native acceptance and checks are recorded below when complete. Screenshots stay in `.local/ship-3/`.

## Checkpoint — deferred at Yash’s request

Draft [#411](https://github.com/drishya-dev/drishya/pull/411) is separate and not merged. Yash said to leave landing-page work for later and move to the next part; no landing source was edited. Home implementation is retained, with no further design work now.

Eight focused hero checks pass, including zero/one/80 synthetic rows, both widths, query isolation and writing-first priority. The first mixed run exposed shared scratch-store query state between tests; test setup now isolates working-location reads rather than weakening the assertions. The other thirteen existing Home checks passed in that run. Both types/build pass.

Genuine acceptance: 36 private frames across zero, one and many-session inventories, both harnesses, three palettes and 600/1440. All first actions, first list rows and running strips are in the viewport; zero horizontal overflow/page errors. Twelve frames have genuine recent-writing evidence. Both genuine one-session actions open the exact stored recording. Metadata follows (no journal text):

| Harness | Prefix | Bytes | Operations |
| --- | --- | ---: | ---: |
| claude-code | `rec_6f4e5cf3` | 212,057 | 0 |
| claude-code | `rec_be806b25` | 8,627,732 | 452 |
| claude-code | `rec_5ee6b391` | 8,454,917 | 344 |
| claude-code | `rec_8865b754` | 4,442,172 | 292 |
| codex | `rec_7f1936ab` | 7,653,286 | 50 |
| codex | `rec_0fae4f71` | 248,478 | 2 |
| codex | `rec_60715088` | 186,271 | 0 |
| codex | `rec_aca34202` | 325,664 | 11 |

The recent Claude writing case was created with the real native harness on an isolated throwaway repository, no tools and no policy changes. Native session prefix `8171c2de`; its captured recording is `rec_6f4e5cf3`. The Home matrix includes actual discovery metadata; the current very large Codex journal was not fully imported for Home presentation checks. Existing real captures supply the list. `check:affected` selected the whole browser suite because any Modern CSS is classified wide; it is running once in the background, log `.local/affected.log`. This checkpoint does not claim a completed broad gate or completed SHIP-3. Screenshots remain `.local/ship-3/`.

## Deferred broad-check result

The background `check:affected` completed: both types/build and related units pass; Edge two workers **752 parallel passed /27 skipped /7 failed**, then one worker **28 serial passed /1 skipped /4 failed**. No clean-main comparison was run. Besides the previously reported inventory/tooltip/reading-position and serial failures, the Home draft needs follow-up on `fresh-workspace:391`, `fresh-workspace:1178` and `home-floor-typography:83`. These stay visible for the later Home pass; no tests or presentation were changed after Yash deferred it. Draft #411 is not ready to merge, and SHIP-3 remains open.
