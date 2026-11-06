# TOOLS-2 — centred floating Toolbox (draft)

Source handoff, 6 November 2026. Claim `895fde2`; branch `codex/tools-2`; draft PR [349](https://github.com/drishya-dev/drishya/pull/349). **Acceptance is in progress. TOOLS-2 remains open.** Harsh explicitly owns all tests, typechecks, builds, scripts, native-harness calls and acceptance. No such commands were run by the implementation agent.

The existing synthetic demo was inspected **before** source changes at 1440 × 900; its private frame is `.local/tools-2-before-1440.png`. It showed the right-edge tall Toolbox with dock instruments, closed MCP/Agents groups and recorded tools below. It had no runtime inventory. That observation is a baseline only. No post-edit demo/fixture/native screen has been observed, and no post-edit screenshot, animation, clipping, count, focus or performance result is claimed.

> Execution update, 6 November: Harsh subsequently authorized agents to run checks ("run urself and complete it"). The original user-run-only instructions below are historical. UI-26 is paused with Yash; TOOLS-2 acceptance continues independently.
>
> Current measured checks before main integration: own frozen install, both project typechecks, 6 geometry units, UI build, 25 named browser cases at 3 workers, and 3 affected Workspace cases at 1 worker passed, retries 0. Private results: `.local/tools-2/named-final-check.json` and `fresh-final-check.json`. Genuine-session acceptance and the finished-task full gate remain pending; TOOLS-2 stays open.
>
> Earlier failed executions are retained: the first run observed 8 passes/7 failures before interruption because normalized synthetic calls omitted intent; after fixing that fixture, a header-empty-space click exposed its intentional pointer passthrough, then a pre-mount visibility probe tried the narrow Tools button on a wide window. The corrected fixture/input/readiness checks preserve all content and geometry assertions. The next diagnostic run had 4 passes/1 failure/12 unrun: responsive dock hiding incorrectly dismissed the reader. Owner availability now distinguishes viewport hiding from Workspace/map navigation. The unchanged resize test and four Workspace dismissal cases passed together (5/5), followed by the complete 25+3 named checks. No retries, larger timeouts, new skips or relaxed assertions.
## Implementation and ownership

The dock keeps its native instruments and true source attributes. Its heading opens grouped content in a content-sized, modeless native-popover window. MCP servers, Agents, Run tools and the recorded inventory open their own existing material from the exact clicked summary. Expanding the minimized Toolbox also restores the dock instruments. Closing returns material and focus; the dock preference remains reversible.

Stable portal target elements reparent between each part's home and the reader. React still owns one instance of each inventory and its query/filter state; no captured text clone or parallel inventory API was introduced. The browser top-layer frame stays **inside the connected viewer DOM** to retain that viewer's inert/visibility/evidence boundary. Session change, removed origins and unavailable viewers or owning docks dismiss it. Keyboard entry into Workspace returns the material immediately without taking focus from the newly selected control; nested origins inside moved material do not define dock availability. Resize, changing header/composer layout, resource/motion changes and hidden-page transitions settle or cancel in-flight motion.

Allocation is centred within the visible viewer, below its header and above the composer's layout bounds. Raised native turn details, queue receipts, send confirmation and native options reserve their offset-parent layout extent too; temporary compositor scale is excluded. Layout-present hover-quiet receipts reserve their room in advance so revealing them cannot cover their controls. Local resize/mutation observers track arriving/removing boundaries. Long tool names wrap inside bounded local scrollers. Pointer motion uses only transform and opacity, reads MOTION-1's shared `--ease-out`, and lasts 160 ms in / 120 ms out; reversals sample the current visual frame. Keyboard actions are immediate; reduced motion and low resource use immediate/opacity-only presentation according to the existing motion preference.

`ToolList` keeps its legacy defaults. Modern labels distinguish **Run tools**, **Available tools · recorded** and **Tools used · recorded**. Recorded-list absence, unused-tool explanations, provenance, filters, replay boundaries and first/previous/next/last trail data still belong to the existing shared owners.

The task touches 13 tracked paths including its plan and this report: three existing UI components; new owner, geometry helper and dedicated component CSS; new geometry unit and browser spec; three affected existing browser specs; plan/report. Coordinator-owned STATUS/TASKS would make 15. `tools-trail.spec.ts` is unchanged. No History, Viewer, SessionWorkspace, shared cascade, schema, daemon, native controller, dependency or persistent-body changes.

## Emil review

Applied the official installed [Emil skill](C:/Users/Harsh%20Jain/.codex/skills/emil-design-eng/SKILL.md), pinned at `c8a79627b59d72d764d6ab6f2c87c09a48169833`. This is source review, not a rendered after-state claim.

| Before | After | Why |
| --- | --- | --- |
| Expanded groups compete with history at the dock edge | A content-sized central reader with history around it | Give the actual material readable space without resident chrome |
| A group expands in its narrow dock allocation | The same portal host moves from the actual summary to its final allocation | Explain origin and preserve one selectable material |
| Runtime and recorded inventories both say Available tools | Run tools and a separately labelled recorded inventory | State which source supplied each list |
| Long MCP names inherit one-line truncation | Reader names wrap within bounded local scrolling | Keep the whole name readable at 600 px |
| Reader clearance could count only the composer box | Raised native controls reserve their untransformed layout extent | Keep connected-turn controls available through composer motion |
| A transition could restart from stale trigger bounds | Reversals sample the current visual rectangle | Opening and closing remain interruptible |
| Dock disclosure owns in-place keyboard focus | Close, Escape and outside interaction have explicit focus handling | Return keyboard reading to its true origin without stealing an outside control's focus |
| General page observers would also see other workspaces | Observer targets stay inside the connected viewer | Keep presentation lifecycle scoped to its evidence owner |
| Keyboard Workspace activation hides the dock while its sibling top-layer reader remains | Viewer/dock availability and class changes dismiss immediately without focus restoration | Follow the actual presentation owner and leave the first Escape for Workspace |

## Authored guards — all UNRUN

The new browser spec covers synthetic Claude/Codex-shaped recordings at 600/1440, 300 MCP/runtime tools (including long names), nested agents, recorded counts, one material, safe centring/scrolling, trail navigation by mouse and keyboard, retained query/filter, close/Escape/outside/focus, minimized restoration, paused-frame origin/reversal identity, resize/session change, keyboard/reduced/low-resource behavior, closed-state restoration, origin removal, viewer inertness, keyboard Workspace dismissal with focus/material identity/first-Escape checks for whole and nested readers, hidden-page settling, and raised composer controls under scale. Synthetic boundary insertion checks presentation geometry; it is not native-harness acceptance. The pure geometry unit covers desktop centring, short space, stage offset and current-visual transforms. Existing inventory/agent assertions retain cardinality, typography, scroll and filtering checks while following the new reader owner.

## Harsh-run commands

Run in this task worktree, with its own installed dependencies. These commands are instructions only; none has been executed by the agent. Use a dedicated long-path worktree-local TEMP/TMP before any scratch/session command and prefer installed Edge; resolving the inherited TEMP alone can retain its Windows 8.3 alias.

```powershell
Set-Location -LiteralPath 'C:\Users\Harsh Jain\.codex\worktrees\live5-ui17-gate\drishya'
$tools2Temp = Join-Path (Get-Location).Path '.local\gate-tmp'
New-Item -ItemType Directory -Path $tools2Temp -Force | Out-Null
$env:TEMP = $tools2Temp
$env:TMP = $tools2Temp
$env:DRISHYA_BROWSER_CHANNEL = 'msedge'
pnpm exec tsc -p tsconfig.json --noEmit
pnpm --filter @drishya/ui typecheck
pnpm exec vitest run apps/ui/test/toolbox-window.test.ts
pnpm ui:build
pnpm exec playwright test toolbox-window.spec.ts tool-inventories.spec.ts agent-inventory.spec.ts tools-trail.spec.ts --project=parallel --workers=1
pnpm exec playwright test fresh-workspace.spec.ts --project=parallel --workers=1 --grep 'toolbox minimizes|recovered Modern toolbox|Modern seven palettes'
pnpm check:real -- tools-available --pick 2
```

The real-case command scans/imports/counts in its own temporary home and removes it; it does **not** establish browser geometry, MCP/agent coverage or a connected run's runtime section. For actual visual acceptance, select genuine journals containing MCP calls, sub-agents and long recorded lists for **both** harnesses. Import into another temporary Drishya home, never your actual home. Keep all import stdout/stderr in private scratch files: the CLI's `Imported` line includes the full recording ID, so filtering that line is not a safe reporting step. Use the earlier `check:real` command for reportable counts, and report only session-ID prefixes, byte sizes and counts. Do not echo import logs, journal content or recording titles:

```powershell
$tools2Scratch = Join-Path $tools2Temp ('drishya-tools2-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tools2Scratch | Out-Null
$env:DRISHYA_HOME = $tools2Scratch
$tools2ClaudeJournal = Read-Host 'Full path of the chosen genuine Claude Code journal'
$tools2CodexJournal = Read-Host 'Full path of the chosen genuine Codex journal'
pnpm drishya import $tools2ClaudeJournal *> (Join-Path $tools2Scratch 'claude-import.private.log')
if ($LASTEXITCODE -ne 0) { throw 'Claude import failed; inspect its private log locally.' }
pnpm drishya import $tools2CodexJournal *> (Join-Path $tools2Scratch 'codex-import.private.log')
if ($LASTEXITCODE -ne 0) { throw 'Codex import failed; inspect its private log locally.' }
pnpm drishya serve --no-open --port 7882
```

Use the launch URL printed by that temporary server. At 600 and 1440, inspect the whole window and each real nested group, long-name scrolling, header/composer/raised-control clearance, close/reverse/origin motion, keyboard focus and all four trail buttons; verify real available/used/unused counts and runtime-versus-recorded names during an explicitly authorized connected turn. Exercise live/history/replay and a bundle where applicable. Save real frames only under `.local/` and report only session-prefix, byte-size and count receipts. Stop the temporary server and remove the temporary `DRISHYA_HOME` override afterward; retain the scratch directory privately until review is finished. Do not use title/content output or share native frames.

If a genuine case is absent, have Harsh create a throwaway repository under canonical TEMP and run the relevant real harness there, asking it to call installed read-only MCP tools and delegate a read-only sub-agent; use its actual tool registry to obtain a long recorded list. Do not fabricate journal rows, alter harness settings or guess a native protocol invocation. A missing harness, signed-in session or installed MCP setup is an explicit acceptance limitation. No such case was created or inspected in this handoff.

MOTION-3 must include the final Toolbox in its actual live/replay ten-minute evaluation. The coordinator owns the single finished-batch full gate after task acceptance, then any ready/merge/claim state. This draft has no acceptance receipts and is not ready for that state change.


## 6 November scoped source re-review

The independent reviewer confirms the original Workspace/dock lifecycle issue is corrected in source, with no confirmed important product-source regression in that fix wave. It identified one authored-regression mismatch: at 600 px the existing Workspace layout hides its own trigger, while the new test required that hidden trigger to remain focused. The coordinator corrected that expectation in 150e087: keep exact trigger identity including when hidden, require hidden/not-focused at 600 and focused at 1440, and retain pressed-state, window dismissal, material identity, first-Escape and reopen assertions at both widths. No timeout, retry, skip, geometry bound or content assertion was relaxed. The report's legacy Windows encoding is normalized to UTF-8. All checks and post-edit acceptance remain UNRUN; this is a user-validation candidate only.
