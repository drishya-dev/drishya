# COMP-1 — independent developer adoption review

## Method and blind first-use record

This is one agent's critical product-use review, not human user research. The reviewer began with the running product and repository safety instructions, before implementation, feature inventory, VISION or prior review documents. The runtime and genuine recordings were supplied in a separate scratch home. Native active sessions were not resumed. Private recording content is not reproduced here; evidence identifies session prefixes, counts and anonymized interactions. Screenshots remain under `.local/`.

### Blind notes — recorded before inventory reconciliation

- Home reads as a local session browser immediately: repository grouping, harness filters, recency and a Running now strip provide useful orientation without explaining the architecture.
- The empty black outer frame and restrained surfaces feel calm; the list makes this seem more like a practical developer tool than a visualization demo.
- Session identity depends heavily on the first prompt. Several genuine local captures have near-identical acceptance-test prompts, so recognition is difficult even with workspace and recency. A person returning to one task needs more than a prompt fragment.
- A repository list alongside all sessions is an understandable starting point. Its value will depend on reliably moving from a session into actual evidence and back without losing position.

Further findings and the post-blind capability reconciliation follow after hands-on exploration.

## Scope and evidence ledger (in progress)

The frozen product runtime is main `344d59b9`; the review checkout began at `bc97467e`. Unmerged finishing work is outside this judgment. Main experience: Modern, initially 1440 × 1000 on Windows Edge. The first session routes were supplied by the coordinator after Home exploration; that is assisted entry, not proof those imported recordings were easy to find on Home. A feature-family checklist and an operation metadata index were supplied after the initial Home/session/search/read impressions. They are used for completeness, not as evidence a capability works.

| Genuine recording prefix | Initial bytes / operations | Hands-on use |
|---|---:|---|
| Codex `rec_fa9e37da` | 783,186 / initially 30 | Initial action-history view; passive source still evolves |
| Codex `rec_7cb1cda1` | 15,023,432 / 1,115 | Long prose, usage/context, search, Changes, toolbox |
| Claude `rec_39af3c94` | 14,545,573 / 747 | Long history, read focus/jump, historical source, Workspace/current source, Files peek/document |
| Claude `rec_e091722b` | 25,988,480 / 315 | Reserved for additional material coverage |
| Codex `rec_aca34202` | 208,187 initially | Disposable genuine native follow-ups, text attachment, Files/Workspace draft, Git |
| Claude `rec_20bd7d66` | 260,937 initially | Disposable genuine native follow-up, exact one-time approval and test result |

Initial sizes/counts are supplied scan metadata. Native follow-ups and passive observation add content; later UI counts need not equal this initial snapshot. Scratch Git topology is deliberately synthetic; the harness work recorded against it is genuine. No claims about a broad population of developers follow from these samples.

## Findings recorded during use

### Evidence reading and comprehension

The strongest interaction so far is selecting Read in the Claude toolbox and using its first-result arrow. It jumps to a real read with a file title, line range, syntax-highlighted captured excerpt and adjacent preceding searches. Expand opens the historical artifact, and the provenance tooltip explicitly says the disk file may differ. Opening the same file in Workspace showed a different current version, labelled Current disk. This is substantive value over a conversation that only says the agent read a file: I can check the material and then inspect today's file without guessing which version I am reading.

The long Codex and Claude prose remains readable and selectable, with ordinary headings, lists, tables and file links. The Codex missing-reasoning notice is honest; an older Claude capture exposes recorded Thinking separately. Do not equate a missing reasoning record with a rendering defect. The table in the disposable session was practical: file names were actionable and each row described its role. Task-list syntax remained literal `[x]` in the prose, a polish issue rather than missing evidence.

Preview fades and compact excerpts keep history manageable, but ordinary inspection often requires Expand before the actual outcome is visible. A small command result is comprehensible; a long source/result excerpt can end in faded content and an omitted-line count. Keep the preview boundary explicit and preserve full-result navigation. The correct next question is whether the visible material supports the conclusion, not whether the green check exists.

### Search and finding the right step

In Codex `rec_7cb1cda1`, session search for a generic testing term produced result snippets containing escaped serialization (`\\r\\n`-style material and envelope text). Result labels distinguished Call and Result, but the snippets demanded decoding rather than reading. Clicking the first result closed search; the final-turn reading position remained unchanged after a further 2.5 seconds. This is an observed single-sample navigation failure, pending cross-harness repetition, not yet a claim every search result fails.

Toolbox Read focus worked better: selecting the group exposed first/previous/next/last arrows and the first arrow navigated to a selected read. The group selection itself did not jump, leaving a dash for its current index. That is defensible for preserving reading position, but the second required action is easy to miss. A primary “first matching step” action and an explicit “117 reads in this session” would be easier to learn.

### Usage and session identity

The Codex Usage section is useful: limit window and reset, last-request context numerator/denominator and timestamp, then session input/output/cache/reasoning token rows. The note correctly distinguishes cumulative spending from context fill and avoids inferring subscription billing. This belongs in a daily monitoring tool. It is presently behind the generic top-right workspace-options icon; clicking the session title did not reveal it. The menu can become a tall scrollable column once Session details and Usage are both expanded. A small persistent context/limit affordance would improve access without making the whole ledger resident.

Session details usefully state harness, workspace, recording identity and that journal observation is independent of agent status. Home's first-prompt titles are insufficient when multiple real local acceptance captures have similar prompts; this is a sample-specific collision, not a statement that every real session has a bad title. Rich historical sessions had more recognizable titles. A short user rename, task label or date+branch identity would improve return visits.

### Genuine native follow-up, attachments and approval

Codex `rec_aca34202`: the composer expanded from a small Ask affordance. A typed read/test prompt could not send until the disposable checkout was enabled through Connection & permissions; the disabled Send explained this in its tooltip. Enabling the checkout also enabled workspace reading. The first send then required an explicit “idle in other clients” acknowledgement. After that, a real native turn read source, ran the specified test command, showed two passing cases and a final answer. Status moved through waiting/running/replied and Stop was present during the run. The reviewer did not weaken native permissions.

A README **text file**, 149 bytes, attached as a removable filename chip with a byte budget. A follow-up asking only for its heading returned the correct heading. Submission remained at Sending for multiple seconds before the captured prompt/reply arrived; this pass cannot separate native startup latency from product latency. The draft was retained while sending, which is reassuring. The historical prompt rendered a collapsed text envelope rather than a first-class attachment card. An actual image/pasted screenshot is not yet covered by this successful text-attachment claim.

The model area displayed the native model name; the underlying model/effort selectors offered only Use native default in this environment. A model name that looks clickable but produces no menu is ambiguous. Call unsupported selection unavailable explicitly, and explain whether the choice follows the native session. Do not imply alternate models were verified.

Claude `rec_20bd7d66`: a real read/test follow-up produced a specific Bash approval card containing the exact harmless test command, Decline, Allow once and Original. Allow once resumed the command; both tests passed and the final reply arrived. This is a strong replacement-chat capability: I did not need another terminal to answer that native request. The same command was classified as **Test** for Codex but **Shell** for Claude, with no Test group in the latter's toolbox and no test-run count in its turn summary. The result itself was visible and accurate; the cross-harness categorization/counting is the problem. A developer must not mistake the summary's test count for a complete inventory of verification.

### Files, Workspace and native edit handoff

Files peek opens alongside the agent, with tabs and Document/Source modes. In a real Markdown README containing raw HTML badges/layout, Document showed several literal HTML code blocks before the readable prose. That is safe, but a document mode full of source-like preamble is a poor default reading experience. Explain unsupported markup and provide a cleaned safe rendering without fetching arbitrary remote content. Current-disk identity was clear at the peek footer; put version identity near the title as well so it survives scrolling and a small viewport.

Workspace is a distinct full file-work mode, with an obvious Back to agent exit. It offers file tabs, find, line navigation, wrap, current source and edit. Current source loaded after an initial Reading state. In the disposable checkout, Edit file opened a real local draft with a conspicuous warning that disk was unchanged and the draft is lost on reload unless saved as recovery. A comment-only local change compared correctly against the base and showed +1/−0. This is a trustworthy basis for a review/edit loop, not a direct disk editor.

Review edit with harness returned to the composer with a draft attachment and a generated prompt requiring an unchanged base SHA-256 and native permissions. That is a real handoff, but it surfaces protocol instructions to the person instead of a concise edit-review request. Keep the exact protocol available under details and show the requested file, patch and expected conflict behavior in ordinary language. The comment-only draft was submitted only against the disposable repository; completion is checked later below. No user project files were edited.

Back to agent preserved the approximate read location but collapsed the previously expanded historical read. This creates friction in the common “inspect now, return to evidence” loop. Preserve the selected/expanded artifact and internal reading position across Workspace transitions.

### Changes, Git review and branches

Changes on the rich Codex history showed changed files, per-file edit counts, line deltas, turn references and a failure list with exit/error excerpts. It is immediately more useful for audit than scrolling the whole transcript. Its 21 changed files / 35 failures / 1 test run describes this capture's recognized categories; it should not be read as exhaustive verification. This pass had not yet exercised every Review tools sub-action.

Git review in the disposable checkout asked separately for read-only Git consent, accurately explained that it would read branches/tags/commits/current changes, and showed the real uncommitted README patch. A reviewed checkbox and a local note worked. Changes and Side by side modes were available; the after column was horizontally clipped in the default floating window at 1440 px. A patch with one short extra line should not require managing a window or sideways scrolling before it is understandable. Prefer a roomier default or responsive stacked diff below the useful two-column width.

Git graph read two local branches and two synthetic commits without checking out anything. Selecting the feature branch correctly exposed ahead/behind information and a commit; opening that commit showed its parent comparison and source patch. The graph is tiny while its black plot consumes most of the large modal, and the bottom commit list is spatially distant. More commits may justify the space, but a short history needs a content-shaped layout. The line “Current · main: ahead 1 · behind 0” while reading the feature branch has an ambiguous direction; say “feature/review is 1 commit ahead of main” explicitly.

The commit's Agent work route opened a file-evidence surface listing two shell reads, with “No source or patch was recorded for these actions.” The shell outputs visibly contained source, but there was no formal Read artifact. This is a provenance/model limitation that should be explained as “No dedicated source snapshot; shell output is available,” with an obvious open-output action. Do not suggest the recorded source characters were absent. No causal commit attribution was established by this synthetic Git exercise.
