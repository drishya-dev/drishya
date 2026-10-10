# Native workspace completeness — 10 October 2026

## Builder direction and order of work

Finish the Claude Code and Codex connection as native clients: prompts and attachments must reach the selected native session, with real models, effort, approvals, tools and usage. Keep passive capture independent. Dismiss utility menus on outside click. Every prompt must remain reachable on the chapter rail; scrolling is preferable to sampling away chapters.

The additional same-turn report is a correctness issue: Codex file creation and editing appeared only as shell commands in Drishya. Verify the full observation → privacy → storage → projection → screen path, including prose, available reasoning, reads, writes, patches and MCP outcomes for both harnesses.

After these fixes, independently review the whole product with fresh agents, using real replay interaction. Preserve their adoption verdicts, ratings, limitations and feature requests. Improve concrete findings before adding more decorative animation. Large-repository spatial navigation and optional themes remain later work; the existing real 3D map is the baseline.

## Implemented in this branch

- Codex code mode wraps `tools.apply_patch` inside a captured `exec` script. The old adapter classified that entire invocation as shell work. A shared, bounded static reader now recognizes one direct awaited literal patch, including quoted and non-interpolated template strings. It never executes JavaScript. Dynamic arguments, deferred/conditional calls, interpolated templates, regular expressions, multiple invocations and oversized sources remain ordinary captured script content rather than fabricated edits.
- Native direct patch names, including `functions.apply_patch`, are recognized. Protected patch content is omitted before storage. Captured patch input is evidence of requested changes, not an independent observation of the final disk state; a wrapper result is not a separately exposed nested-tool result.
- Reducer `r3` also recognizes that patch in already stored shell-shaped Codex observations. Rebuilt projections restore create/edit cards without deleting recordings, modifying observations or rereading native journals. Protected paths are not promoted. The version change invalidates persisted projection caches and paged worker revisions.
- Codex prose and readable reasoning summaries continue through the existing adapter. Read-only inspection of this current journal found reasoning records with encrypted content and empty summaries. There is no readable thinking to recover from those records. Do not manufacture it or imply that a transcript-detail setting can unlock it. Claude's actually recorded thinking is retained as exposed full text.
- Claude regression coverage includes thinking, prose, Write, Edit, Read, MCP calls and correlated results. Codex coverage includes direct/wrapped patches, creation/update hunks, output correlation, protected paths, unsupported scripts and encrypted reasoning exclusion. A browser journey proves the wrapped create/edit cards and assistant prose reach the screen.
- Current native Codex transport uses `app-server --listen stdio://`; `--stdio` is not accepted by the installed CLI. Removed the no-longer-stable `excludeTurns` resume argument. Resume still uses conservative `untrusted` approval and `workspace-write` sandbox; it does not inherit full access or silently weaken policy.
- An explicit consented settings probe reads selected workspace configuration and native model capabilities. It sends no prompt, resumes no thread and writes no config. Only selected model/effort/policy fields and bounded catalogs leave the process; raw config and credentials are never returned. Codex reads `config/read` and paginated `model/list`; Claude uses its initialization model/command catalog. Concurrent probes and retained catalogs are bounded.
- Composer settings offer native defaults or discovered models/efforts. Explicit per-turn selections travel as Codex `turn/start` fields or Claude CLI arguments, never as instructions inserted into model text. Active session settings come from native resume/init responses. Full access and global settings remain native-client work. One-time approval handling, workspace consent and idle-other-client acknowledgement remain mandatory.
- Codex `/compact` invokes `thread/compact/start`, rather than asking the model to interpret it. Unsupported Codex slash commands fail explicitly. Compaction takes no attachments or turn overrides. Claude's own supported native slash commands remain native protocol input.
- Usage distinguishes Codex's **last model request** from Claude's connected turn. When Codex reports them, context input/capacity, cumulative thread usage and reasoning output are shown separately. Cumulative usage is not occupied context. Unknown costs and subscription billing remain unknown; no estimated bill is shown.
- Outside pointer clicks and Escape dismiss workspace, history, usage, native-settings and attachment menus. Clicks inside preserve the menu. Captured-content reading disclosures are excluded. Dismissal does not detach Follow.
- Every chapter occupies a 16 px position on a virtualized, independently scrollable rail. Nothing is sampled out. Only visible rows mount, and keyboard arrows, Page Up/Down and Home/End can reach the entire range. Current/near/normal marks retain 24/16/8 px lengths. Preview text remains bounded and is shown outside the scrolling clip. Older chapter selection still requests the appropriate history page and preserves the navigation boundary.

## Verification and limits

Final local checks: 307 unit tests, TypeScript checks, production UI build and isolated offline package installation/import/authenticated API/persisted restart pass. Affected browser checks pass across full and corrected targeted runs. Wrapped create/edit/prose display and authenticated demo return have dedicated browser coverage. Fresh whole-product feedback and the next ordered iteration are preserved in [40](40-independent-product-review.md).

Both installed CLIs completed a real prompt-free catalog probe on this machine: Codex returned seven models; Claude returned five models and fifty commands. This is capability discovery, not certification of a new real model turn, every account policy or every native version.

Local checks cover adapters, ingest privacy, rebuildable projection, controller transport/options/compaction, current-workspace reading, real API attachment transport, every-prompt navigation, utility dismissal and motion/hover behavior. Two old motion tests entered through the body; they now enter through the deliberate title-strip affordance. A history-menu journey now reopens the nested disclosure after outside dismissal. These are changes to match the requested interaction, not relaxation of the behavioral assertions.

Restart a running daemon to load adapter/controller/reducer changes, then reload the page. Existing captured wrappers are repaired by projection rebuild. No recording deletion is required. Browser hot reload alone cannot update a previously launched daemon's imported Node modules.

Hosted GitHub Actions stays disabled for this work. Run local checks and commit; hosted verification is reserved for the publishing gate, as the builder requested.

## Remaining acceptance and product work

1. Real native turns for both account environments, with text/image/folder-content attachments, cancellations, exact approvals, policy errors, effort/model changes, compaction and other-client contention. Catalog access alone does not prove these.
2. Every supported harness/version and platform: capture → store → paged projection → live/replay material for all tool families, including failed edits, multi-file patches, subagents, large output and compaction. Arbitrary JavaScript and shell file mutations cannot be inferred reliably from script text. If a harness does not expose their individual outcomes, preserve the script and identify the limit.
3. Native settings not exposed safely by the supported protocol remain native-client work. Do not add fake full-access controls or edit config files. Account rate-limit panels, richer context management and unsupported interactive requests need their own native API acceptance.
4. Full image/document support beyond the current text/code and bounded image types; reference-versus-folder-content distinctions; richer attachment affordances. Preserve payload limits, redaction and explicit consent. Image pixels require user review and are not claimed to be text-redacted.
5. Fresh reviewers' whole-product reports and recorded replay evidence, then bounded iterations. Do not market synthetic demo results as proof of native integration or comprehension.
6. Intelligent large-repository density/navigation refinement; graph search/focus and relationship animation grounded in captured locations and real imports. Keep DOM text, bounded GPU paint, low-resource/reduced-motion modes and measured performance gates.
7. Native multi-agent windows and identities; session switching and ownership; long-session/platform/physical low-resource acceptance and antivirus checks. Themes follow working behavior, rather than replacing it.

The product direction remains an actual native workspace with understandable captured work, not text repainted in boxes. Prioritize exact source/diff/result reading, trustworthy origins, stable scrolling and complete navigation over more motion.
