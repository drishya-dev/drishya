# Corrected embed restoration — 21 November 2026

Scope: issue #562, restoring the embed functionality from reverted #549 onto `3d35036d`. The unrelated expanded-card, toolbox/hover and branch-facts polish from #549 is excluded. The existing shared main layout remains the basis of the embed view.

## Corrections and evidence

The final #549 head `41c0dfc0` already fixed Claude hook JSON nesting, passed the hook session identifier, resolved domain-relative SDDL aliases, and restored horizontal expanded-card scrolling. Those earlier findings are not reported as new defects here. The generic card rules are outside this focused restoration.

Two residual hook problems were reproduced before fixing: invalid/missing session IDs fell back to newest-session selection, and Windows command lookup executed a checkout-local `drishya.cmd`. The reference hook now requires the exact native ID and absolute checkout; Windows runs the actual global npm package Node entry from absolute PATH entries outside that checkout, without a shell. Invalid checkout/session input blocks with a fixed explanation. Installation and timeout errors are explicit. Setup uses an absolute hook path and a 65-second outer timeout for its 60-second child bound. The guide no longer promises zero latency.

Windows embed tests also failed with `DISCOVERY_UNSAFE (icacls remove: exit 1332)` for orphaned account trustees inherited into scratch folders. Numeric `icacls /remove` still attempted account resolution. A fixed, encoded System32 PowerShell script calls the .NET directory ACL API to replace the protected DACL with the current-user allow entry. The path travels through an environment value; no captured value enters script text. The existing independent SDDL verification still fails closed. A deterministic orphaned-account regression supplements the original explicit-foreign-trustee test. No real Drishya home ACL was changed.

## Verification

- Fresh worktree with its own frozen-lockfile install; no shared node_modules.
- Typecheck and UI production build passed.
- Four focused embed unit files: 26 passed, including hook selection/shadowing, orphaned Windows trustees, worker lifecycle, MCP and slow imports.
- Embed view/security browser specs: 15 passed, Chrome, two workers, at the agreed embed-only 360 minimum plus 600 and 1440.
- `package:verify`: packed isolated offline install, loopback-only network walk, Claude/Codex fixture imports, authenticated API and restart passed; security 712 passed, five existing skips.
- Real `content-parity` acceptance in scratch storage: Claude `rec_6b23303f`, 59.6 MB, 3256 operations; Codex `rec_0f40bebd`, 48.6 MB, 3214 operations.
- Real scratch embed panes at 600 and 1440: Claude `rec_b4eb42b6`, 108711 bytes; Codex `rec_dffd9ae1`, 213184 bytes. Both reached Session work with the pinned-view status, no Home brand button and no document horizontal overflow. Private screenshots remain under `.local/embed-evidence/` and are not committed.
- Focused independent code review of the hook and ACL corrections: no actionable findings.

## Remaining acceptance limits

This is a draft restoration, not a merge authorization or full-gate claim. The full batch gate was not run here. Genuine existing recordings were read-only imported and displayed; no fresh signed-in native `/drishya` hook/MCP invocation or actual desktop-host pane integration was performed. Claude's native executable is unavailable on this machine. The import and browser evidence must not be described as proof of those native integrations. Maintainer review and hosted cross-platform CI remain before merge.

## Hosted Windows follow-up

The initial Windows check (run 44873373918) passed 1923 tests but timed out the iframe-refusal test at 5312 ms against Vitest's 5000 ms default. That test serially starts six cold CLI processes; it is not a runtime refusal failure. It now has a 30-second test bound and each child a five-second bound. Local focused coverage was rerun before pushing this adjustment.

## Exact selection and private handoff, 25 November 2026

Updated the draft against main `4d87d40d`. A native ID now follows recorded identity when present, and multiple matches require an exact Drishya recording ID. The MCP tool accepts exact selection only. An ordinary MCP host receives no launch credential and starts no worker. A host that declares the private capability gets the credential only through the private handoff, or can request the system browser without receiving a credential. The latter reports an OS launch request, so a returned result does not imply the browser opened. Explicit `--latest` remains a separate terminal option.

Channel loss now asks the owned worker to close without waiting on a pending launch first. A completed request cannot subsequently open a browser after its client closes. Windows invokes System32's opener with startup commands disabled. The Windows MCP setup shows the absolute Node and package paths as separate arguments. Launch codes remain one-use, recording-bound for the exchange and expire after 60 seconds. The ordinary session cookie retains the existing daemon API, workspace consent and controller boundaries.

- Defect regressions reproduced contradictory/ambiguous identity, model-visible fallback, the delayed channel-close race and Windows opener resolution before the fixes. Both typechecks, the rebuilt UI, 31 focused units across five files with two unit workers, and 15 Edge embed browser checks with two workers passed. The 360 px cases were limited to desktop embed. There were no focused browser retries or skips.
- Genuine display in scratch storage passed at 600 and 1440 px for Claude `rec_b4eb42b6` (108,711 bytes) and Codex `rec_f1c7bb44` (174,722 bytes), four checks per recording.
- An ephemeral signed-in Codex 0.171.0-alpha.13 run issued one actual MCP tool call and got the expected private-handoff refusal. It used an exact synthetic recording ID and did not launch a browser. This proves the genuine runtime can reach the refusal path.
- Independent review checked credential handling, exact identity, pending-close ownership, documentation and Windows invocation. The final re-review found no actionable issues in those changes.

The Claude desktop app is signed out and a standalone Claude Code CLI was unavailable. A fresh native hook launch and successful OS browser navigation remain unverified. Keep the PR draft until a supported desktop host demonstrates private handoff, credential exclusion from host/model tools and persistence, and navigation, popup and guest close/reopen behaviour. The browser guest suite and display checks do not establish those outcomes.
