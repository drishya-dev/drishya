# UI-26 — stylesheet inventory and guard

Status, **6 November 2026**: UI-26 execution is stopped at the builder's direction while FINISH-12 / Clarity becomes the active UI and Modern stays a frozen backup. No stylesheet, component, import routing, palette, asset, contrast assertion or typography assertion has changed. UI-26 is not completed; PR #350 stays draft and the claim stays held for the coordinator's disposition. No pixel baseline or control result exists.

The builder briefly authorized agent execution ("run urself and complete it"), superseding the earlier user-only runtime restriction. The later instruction ("Leave that to yash and continue other task") stops further UI-26 execution. Earlier user-run and UNRUN sections below record their original handoffs; the executed evidence and remaining limits are recorded here.

## Paused execution handoff

On clean source `8befb2ae4d71d4c97213e0a6733221e5a8b42a19`, this worktree's own frozen dependency installation, actual typecheck and `ui:build` passed. Initial sandbox Corepack DNS failures occurred before checks ran; scoped escalation allowed the actual checks. No browser capture, palette/typography browser suite, 96-image freeze, positive control, negative control, candidate comparison or stylesheet migration ran.

Genuine scratch-imported inputs were prepared, with native content and paths retained only in ignored `.local/ui26`:

| Native prefix | Bytes | Observations / operations | Cases found |
| --- | ---: | ---: | --- |
| Claude `43745e02` | 1,854,455 | 379 / 86 | 47 edits, one MCP operation, one agent, a single recorded root, readable captured current source and four tracked changed files in its existing stopped audit worktree |
| Codex `01a1b0f9` | 234,720 | 47 / 10 | Eight shell operations, one actual read-only MCP call, one native edit, one agent, a single recorded root and a tracked uncommitted patch |

The Codex case was recorded by the genuine native harness against an explicitly synthetic throwaway checkout target, using its workspace sandbox and automatic approval review. No observations were fabricated. The MCP target was local and read-only; configuration was per invocation. Native journals, saved policies, credentials and the existing Claude workspace were not edited. The official Claude CLI was installed only under ignored `.local`; its existing-account status was logged out. A suitable existing Claude recording was subsequently found, so this task did not require login.

Input preparation succeeded, but a pre-baseline identity check rejected an early change in the Claude workspace digest. Both native copies and the Codex workspace stayed unchanged. Later separated head/ref/status/file-content hashes stayed identical for 80 seconds, with no source files modified within an hour; the linked Git store had recent ref activity. The initial failure and detailed snapshots are preserved. Do not treat this as a frozen input, ignore ref changes or run against a changing workspace. No immutable baseline was created or reset.

The private handoff contains prepared both-harness inputs, unchanged native copies, workspace/ref/content hashes, exact failures and three longer stopped Claude MCP/agent candidates useful for TOOLS-2, whose capture does not require current Git/source capability. Any resumption first needs a current builder decision on whether UI-26 remains useful, stable genuine inputs and all original fixed-tolerance controls. No wider stylesheet scope or shared-owner migration was approved.

Claim: `895fde2` on main. Implementation source before this draft: `1fb2a737fa9fed924c83ff61d53048aeb71b7fcf`. UI design authority is the installed Emil skill at upstream `c8a79627b59d72d764d6ab6f2c87c09a48169833`, plus VISION and the repo contracts. This increment is guard/inventory only, so it makes no visual design or motion change.

## Ownership and bounded files

This increment changes exactly four tracked paths: `scripts/ui-26-guard.ts`, `scripts/ui-26-capture.ts`, `scripts/ui-26-inputs.ts`, and this document. The ignored SDD ledger records progress. The coordinator alone edits STATUS/TASKS.

Before a later migration, name its complete target list and resolve owners first. Candidate routing owners are `modern/entry.tsx`, `classic-entry.tsx` and a new canonical Modern sheet; none is changed now. TOOLS-2 owns its Modern tool components and dedicated component sheet. CONNECT-2 owns `stage.css`/`modern/hud.css`; HOME-3 owns `home-active.css`/Home sources; MOTION-3 owns History motion/source/CSS; LIVE-6/FLOW-1 own the relevant scene/Viewer/connector sources; AUDIT-1 has a broad active UI claim. This independent ownership gate remains even if the pixel guard passes.

## Real import graph

`main.tsx` selects a dynamic entry. Modern loads `modern/entry.tsx`, which statically imports `App` from `classic-entry.tsx`. The fallback imports `classic-entry.tsx` directly. Evaluation is not simply alphabetical CSS files:

1. `classic-entry.tsx` visits its first twelve side-effect CSS dependencies in the order below.
2. Its `export { App } from './App.tsx'` traverses App's component dependency graph. Component sheets are evaluated here. Shared dependencies are evaluated once at their first visit; lazy DraftEditor owns another later sheet.
3. `developer-workspace.css`, then `workflow-finishing.css` follow that App traversal.
4. Modern then visits its eleven side-effect overrides in the listed order. `motion.css` is deliberately last.

`components/` contains 51 CSS files (presence count, not a claim all 51 load initially). The graph also loads explicit Modern component sheets: `session-home.css`, `home-active.css`, `tool-inventories.css`, `github-star-link.css`. Component owners stay explicit, including TOOLS-2's forthcoming sheet. Before moving any CSS, use the built browser stylesheet order to confirm the effective bundler order; this is a source trace, not executed browser proof.

| Order | Global sheet | Bytes at inventory | @media | @supports | @keyframes |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | tokens.css | 973 | 0 | 0 | 0 |
| 2 | styles.css | 38,350 | 4 | 0 | 9 |
| 3 | p1.css | 11,871 | 3 | 0 | 0 |
| 4 | product.css | 21,393 | 5 | 0 | 0 |
| 5 | polish.css | 16,485 | 3 | 0 | 0 |
| 6 | ink.css | 28,083 | 12 | 0 | 2 |
| 7 | stage.css | 65,529 | 26 | 0 | 1 |
| 8 | studio.css | 14,448 | 4 | 0 | 0 |
| 9 | workbench.css | 18,093 | 4 | 0 | 0 |
| 10 | classic.css | 42,076 | 11 | 2 | 0 |
| 11 | atelier.css | 29,580 | 5 | 0 | 0 |
| 12 | reliability.css | 2,462 | 0 | 0 | 0 |
| App component graph | Explicit component sheets | — | — | — | — |
| 13 | developer-workspace.css | 26,322 | 15 | 0 | 0 |
| 14 | workflow-finishing.css | 3,268 | 0 | 0 | 0 |
| 15 | modern/surroundings.css | 11,799 | 2 | 0 | 0 |
| 16 | modern/settings.css | 7,456 | 2 | 1 | 0 |
| 17 | modern/workspace-chrome.css | 11,912 | 5 | 0 | 0 |
| 18 | modern/recovered-surfaces.css | 21,890 | 5 | 1 | 1 |
| 19 | modern/theme-presets.css | 9,939 | 0 | 0 | 0 |
| 20 | modern/hud.css | 15,913 | 7 | 2 | 0 |
| 21 | modern/quiet-scrollbars.css | 1,157 | 1 | 0 | 0 |
| 22 | modern/interaction-polish.css | 5,018 | 4 | 0 | 0 |
| 23 | modern/reading-windows.css | 16,631 | 11 | 0 | 0 |
| 24 | modern/finishing.css | 3,534 | 4 | 0 | 0 |
| 25 | modern/motion.css | 3,240 | 1 | 0 | 2 |

Byte counts include this checkout's line endings and are inventory only. Root globals contain unscoped base rules as well as experience/palette selectors. Modern overrides generally use `:root[data-ui-version=modern]`; inherited custom properties and `!important` rules remain significant. Shared token definitions exist in the base/theme sheets, so reducing duplicate declarations is outside a byte-preserving move. `theme-presets.css` owns the seven palette presets; syntax/semantic colors also inherit earlier sheets. Existing seven-palette contrast and typography specs must keep all their current coverage.

The only CSS `url()` found in the global sheets is `atelier.css`'s root-absolute `/fonts/Outfit-Variable.woff2`; its URL meaning must survive a move. Font fallback stacks and `/public/fonts` assets stay fixed. Preserve media/supports blocks verbatim, including reduced motion, hover, desktop-width breakpoints, discrete transitions, backdrop fallback, base-select and scroll-timeline support. Preserve named keyframe definitions and their source order. There is no proposed @layer conversion, selector rewrite, token redesign or declaration deduplication.

## Canonical-owner decision, after controls

A naive concatenation of all 25 globals into one file would move one side of the App component sheets. A runtime @import chain would retain the problem under a new filename. Neither is an accepted implementation.

The eventual Modern entry must stop importing `classic-entry.tsx` for CSS and render the shared App directly, while Classic/Canvas retain their existing entry and original sheets. One candidate is one Modern-owned sheet with component sheets retained as explicit owners, moving only demonstrated independent global groups and proving every resulting order boundary. Another is to move conflicting global declarations into their true component owner before consolidating the remaining global sheet; that requires explicit component-owner coordination and may exceed the current file cap. Exact preservation of every existing interleaved position cannot be claimed for either candidate before the conflicts are resolved. The coordinator must settle that boundary with the owners before source edits; the immutable baseline cannot be reset to forgive an ordering change.

## Fixed comparison contract

The three source cases are demo, genuine Claude Code and genuine Codex. Each gets 8 surfaces × 2 widths (600/1440) × 2 palettes (Jet/Paper), at 900 px height: **96 images** total. Named surfaces: Home, expanded History material, Files peek, Workspace, Changes, Git review, Toolbox with MCP/agents disclosures, Settings. Home uses the normal daemon library containing just the two explicitly imported captures; it is repeated in the case matrix so the whole journey remains independently replayable.

The offline demo truthfully disables Workspace and Git. Those eight images are explicitly `unavailable` states showing the real disabled controls and their explanation attributes. No current-file/Git API is mocked into a bundle. The other **88 images require populated material**, including populated current source and an actual Git patch on each genuine daemon case. Missing cases fail; they are never skipped. Choose real sessions with edits, MCP tools and agents, a readable existing file and a meaningful expandable operation still resident at the end. If either harness lacks such a genuine capture, record it on a throwaway repository; there is no fixture fallback for native acceptance.

Demo Files searches for the bundle's explicit `src/checkout/guard.ts`, which has captured read excerpts and an edit after-snapshot, then requires nonempty captured code in the file reader. It never selects an arbitrary first tree leaf. Expanded History opens the selected operation only if its real `aria-expanded` state is false and requires material in that operation's own article.

Each matrix entry resets only scratch-daemon navigation metadata through the supported authenticated `DELETE /v1/working-locations` endpoint, then reads it back to require an empty result. After capture, deliberate navigation to a blank document and completion of the app's pagehide keepalive checkpoint precede the next reset. No captured/native response is replaced. This prevents Workspace, selection, expansion and reader layout from leaking through the daemon between fresh browser contexts. The genuine projection root must be a nonempty string before path resolution, both in preparation and capture validation.

The supported `drishya.theme` preference is set before app boot: `dark` for Jet and `light` for Paper. Both actual `data-theme` and `data-palette` are asserted after boot and surface preparation; Settings must show exactly one selected real theme option (`theme-dark` or `theme-light`). The guard no longer writes palette DOM attributes independently of application state. Keyboard activation waits for both visibility and enabled state, including workspace consent while its root status is pending, using the existing 10-second readiness budget.

Network failure classification is narrow: only `net::ERR_ABORTED` on the exact same-origin GET `/v1/changes` streams already open at a deliberate navigation is expected. Only same-origin, query-free GET 404s on the selected genuine recording's exact `/read-before/:operation`, `/fix-chain/:operation` and `/verification/:operation` endpoints are nullable, matching `api.ts`. Other HTTP errors, aborted material/assets, unexpected stream failures and page errors remain fatal, and errors are retained across navigations. Required code, artifacts and patches still have material assertions. All native failure details and images remain private.

The frozen metric is normalized maximum RGBA-channel distance `> 0.1`, allowing at most `0.0005` of pixels to differ. This is a declared channel metric, not pixelmatch's perceptual threshold. There are **no masks**. Playwright captures the full viewport with transient animations disabled and caret hidden. Supported motion/map-orbit preferences stop automatic movement, and Playwright's fixed browser clock keeps time labels stable. Fonts must finish loading, visible images must decode, material/API requests must finish, busy/error surfaces must be absent, and real DOM bounds must settle. A surface that cannot load is a failed run, never a matching blank screen.

The frozen manifest records full source ref, relevant source hash, stylesheet hash, guard-driver hash, lockfile hash, newly built asset/font hashes, native journal hashes/sizes, workspace hashes, captured projection hash/counts, machine/browser/environment identity, contract and each PNG hash. Comparison requires a distinct committed candidate source and explicitly named passed positive/negative controls. It never builds/captures from an independently supplied stale dist. `positive` requires unchanged product source; `negative` requires the same source and adds only a synthetic 24 px magenta outline to the expanded demo History card. The negative control passes only when that one image is rejected above the locked tolerance. Diff PNGs are private.

A baseline path is created exclusively and becomes usable only when all 96 images finish. Compare/controls read it and validate its manifest/PNG hashes before and after capture. They cannot refresh it. Every run has a unique new output directory. All screenshots, source paths, manifests, error details, diffs, imports and logs stay in ignored `.local`; stdout contains only counts and native recording prefixes/sizes. Never attach native images/manifests to a PR or paste their text into chat.

## User-run setup and Gate A

No command below has been run by an agent. Execute only in the dedicated UI-26 checkout. Use its own install; do not share node_modules. No app is listening on the inspected standard 5173/5174/7878 ports, and no baseline browser inspection has been performed. Before any later stylesheet edit, Harsh can launch `corepack pnpm ui:dev` plus `corepack pnpm dev` and inspect the current app manually; that is separate from guard acceptance.

Create `.local/ui26-seed.json` locally with these keys (replace every example path with a real, stopped native capture and its captured throwaway Git workspace):

```json
{
  "cases": [
    { "id": "claude", "harness": "claude-code", "genuine": true, "journal": "C:/private/claude/session.jsonl", "workspace": "C:/private/frozen-claude-repo", "file": "src/example.ts" },
    { "id": "codex", "harness": "codex", "genuine": true, "journal": "C:/private/codex/session.jsonl", "workspace": "C:/private/frozen-codex-repo", "file": "src/example.ts" }
  ]
}
```

The repositories need an actual tracked, uncommitted patch for Git review. Keep their bytes, refs and native journals unchanged throughout every comparison; concurrent edits are rejected. Imports use scratch Drishya homes, never the real home. The input helper selects a meaningful recent operation and writes its candidates only to a private review file. If a chosen operation is not resident or a file is unsuitable, fix the input before the first baseline and rerun preparation to a new input filename; never invent a native operation.

```powershell
Set-Location 'C:\Users\Harsh Jain\.codex\worktrees\ui-26\drishya'
corepack pnpm install --frozen-lockfile
$env:DRISHYA_BROWSER_CHANNEL = 'msedge'
node scripts/ui-26-inputs.ts --seed .local/ui26-seed.json --out .local/ui26-inputs.json
$ui26Baseline = (git rev-parse HEAD).Trim()
node scripts/ui-26-guard.ts freeze --config .local/ui26-inputs.json --ref $ui26Baseline
node scripts/ui-26-guard.ts positive --config .local/ui26-inputs.json --ref $ui26Baseline --baseline $ui26Baseline --run unchanged
node scripts/ui-26-guard.ts negative --config .local/ui26-inputs.json --ref $ui26Baseline --baseline $ui26Baseline --run magenta
```

On this Windows machine, the commands prefer the known installed Microsoft Edge through `DRISHYA_BROWSER_CHANNEL=msedge`; no Chromium download is needed for that channel. On another machine, bundled Chromium is optional: install it with `corepack pnpm exec playwright install chromium` and leave `DRISHYA_BROWSER_CHANNEL` unset. Keep the exact same browser/channel for freeze, both controls and every comparison; environment identity rejects changes.

Freeze must report 96 images, positive must report 96 with zero outside tolerance, and negative must report one rejected image and PASS. A missing journal, missing MCP/patch/source, readiness failure or selector failure is not acceptance. Retain failed private outputs; do not loosen the tolerance, add masks, omit surfaces or change timeouts to get green. Return only the guard's count/status lines and the source ref. The coordinator records actual prefixes/sizes/counts separately when genuine cases are checked.

After returned green Gate A, actual app inspection and ownership resolution, a single proposed layer may be edited and committed. Harsh compares that distinct commit against the same immutable baseline:

```powershell
$ui26Candidate = (git rev-parse HEAD).Trim()
node scripts/ui-26-guard.ts compare --config .local/ui26-inputs.json --ref $ui26Candidate --baseline $ui26Baseline --positive unchanged --negative magenta --run layer-1
```

No next layer before that result returns green. If TOOLS-2 is accepted and integrated first, explicitly record a new accepted product baseline and rerun both unchanged-source controls on it; never compare different Toolbox implementations or exclude Toolbox.

## Final acceptance, still pending

After every final layer comparison passes, Harsh runs the existing area checks without removing assertions:

```powershell
corepack pnpm check:affected
corepack pnpm exec playwright test tests/browser/palette-contrast.spec.ts tests/browser/settings-typography.spec.ts tests/browser/session-typography.spec.ts tests/browser/home-typography.spec.ts tests/browser/home-floor-typography.spec.ts tests/browser/composer-typography.spec.ts tests/browser/dialog-typography.spec.ts tests/browser/git-typography.spec.ts
```

The full task/batch gate belongs to the coordinator and Harsh after whole-item acceptance. No typecheck, test, build, proof script, automated screenshot, harness call or acceptance gate was executed for this increment. Baseline, controls, genuine sessions, screen inspection, CSS migration and palette/typography acceptance all remain pending. No real session prefixes/sizes/counts are claimed because none was imported or checked.

| Before | After | Why |
| --- | --- | --- |
| Modern relies on shared globals, App component sheets and Modern overrides | Same product source and styles; a draft independent pixel guard has been prepared | Preserve all current UI details until evidence supports a mechanical move |
| No frozen source/content identity for the planned CSS merge | Immutable source, build, capture, workspace and PNG identities in the guard contract | A comparison must compare the intended product and real material |
| Whole task acceptance unrun | Still unrun; draft and claim retained | Prepared code is not executed evidence |

## Consolidated static fix wave — 6 November, all runtime checks UNRUN

| Before | After | Why |
| --- | --- | --- |
| Demo Files opened the first graph leaf without captured source | Supported search selects `src/checkout/guard.ts` and retains the captured-code assertion | A populated reader must show actual bundle material |
| Every 404 and failed request was fatal, including nullable evidence and navigation-cancelled SSE | Exact nullable GET routes and tracked deliberate SSE navigation aborts are classified; every other failure and page error stays fatal | Match supported API outcomes without concealing missing required material |
| Fresh browser contexts reused daemon reading locations; expansion always toggled | Supported metadata reset/readback per entry, unload checkpoint completion, and idempotent expansion of the chosen article | Workspace and expanded state cannot silently select a different matrix surface |
| Palette-only DOM assignment produced a hybrid theme and stale Settings selection | Preboot saved dark/light preference, actual scheme/palette checks and the selected Settings option | Capture the real Jet/Paper application state |
| Visible workspace consent could still be disabled while its root loaded | Activation requires enabled readiness within the same timeout | Keyboard Enter must wait for usable consent |
| Optional projection root reached path resolution; Windows setup required a Chromium download | Root narrowed first; Windows uses installed Edge by explicit channel, bundled Chromium remains optional elsewhere | Fail explicitly on missing genuine inputs and avoid unnecessary browser setup |

Source/diff inspection is the only review performed in this wave. Guard, positive/negative controls, typechecks, tests, builds, proof/check scripts, servers, browsers, real harness calls and screenshots are **UNRUN**. The matrix remains **96 = 88 material + 8 unavailable**, thresholds remain **0.1 / 0.0005**, no masks or new skips exist, and source/workspace/build/driver identities and baseline immutability remain enforced. Gate A still needs genuine stopped Claude Code and Codex journals, matching frozen throwaway Git repositories with a tracked uncommitted patch, readable selected source, edits, MCP/agent evidence and resident meaningful operations; no such inputs or returned results are claimed here. The coordinator's single scoped rereview is pending.


## 6 November: scoped source re-review

Independent static re-review accepts all five setup corrections: explicit readable demo source, exact nullable API/navigation outcomes, isolated daemon reading state with idempotent expansion, actual theme state, and enabled consent readiness. No new blocking source regression was confirmed. Preference initialization is additionally restricted to the application origin, so the final blank document never accesses app storage; application page errors remain fatal. This is a user-validation candidate, not an executed positive/negative control or completed UI-26 acceptance. No stylesheet migration has occurred.
