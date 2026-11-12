# COMP-1 — independent developer adoption review

Read the verdict, eight developer jobs, adoption table and product directions for the product review. The appendices preserve method, detailed observations and capability coverage; they are secondary evidence, not a recommended reading path for deciding whether the product is useful.

## Would I keep Drishya open?

**Yes as a companion when supervising substantial agent work; conditionally as my main place to converse; not yet as the only development window.** Its lasting value is the ability to move from an agent's account to the actual captured material, then to the current file, and back into the same work. That is useful after the novelty of the map wears off. Its weakest proposition is that a spatial presentation by itself makes the work easier to understand. In the sessions I used, explicit Read/command navigation, Files, Changes and readable prose did more for understanding than the background graph.

I would keep it open for a long investigation, a change touching several files, or reviewing work I did not watch continuously. For a brief question, a tiny edit I already understand, or rapid back-and-forth prompting, I would often stay in my familiar harness interface. Drishya currently asks me to learn another set of places and controls before its advantages become obvious. The ability to send a prompt is necessary for continuity, but does not itself make the new surface preferable.

This is one experienced-developer perspective produced by an agent doing hands-on product use, **not human user research**. I exercised genuine local Codex and Claude recordings and real disposable native follow-ups. I did not conduct a contemporary side-by-side audit of every native interface. Native tools already expose tool activity, diffs, approvals and file links in various forms. The comparison below is therefore about observed Drishya journeys versus an ordinary familiar harness workflow, not a claim that native chat lacks those basics. Where a native baseline is an expectation rather than a measured comparison, it is stated as such.

The review's primary question is: **does this arrangement improve understanding enough to earn the extra window and attention?** Feature presence and test counts are secondary. The detailed technical evidence is retained in the appendices so it does not become the product verdict.

## The jobs that determine adoption

### 1. Prompt the agent, then follow its work

**Ordinary harness workflow:** stay where the prompt was written, watch progress and tool activity, interrupt or answer there, and inspect details when needed. Familiarity and the absence of a workflow switch are real advantages. Drishya must beat that continuity, not merely reproduce a Send button.

**Observed Drishya workflow:** a small Ask affordance expands into a composer. After enabling the disposable checkout and acknowledging that other clients were idle, I sent an actual Codex read/test request and a Claude request. The work arrived in the same history: source material, commands, outcomes and replies. A genuine Claude command approval and a native question could be handled without leaving. This makes Drishya a functioning working surface rather than a replay-only gallery.

**Added value:** the actual source and result are given room as materials, beside ordinary agent prose. When I care what the agent read rather than only whether it is busy, that presentation earns attention. The one-place connection between reading and a follow-up is more important than the map animation.

**Added effort:** setup is hidden behind Connection & permissions, the model area initially looks like a label, and an explicit Read native settings action is needed before supported model choices appear. Tool inventories and counts compete with the question “what is it doing now?” There are several different notions of activity: native turn, passive journal following, queued-input receipts and Follow latest. I learned them, but a daily tool should not require that learning on the critical path.

**Preference:** familiar native interface for a quick conversational task; Drishya for sustained work where I want to read evidence as it arrives. **Score: 3/5.** The real controller journey works, but the product has not yet made entry and orientation effortless enough to replace habit. The adoption-changing improvement is one clear session state and next action, with setup/model-loading offered at the relevant point and technical inventory secondary.

**Still needs another app:** an editor for normal development work and the native client for policy changes or operations the supported connection cannot perform. That is a boundary to explain, not a reason to weaken native controls.

### 2. Return after looking away and find out what happened

**Ordinary harness workflow:** read the latest answer, expand relevant tool calls, find where the previous prompt ended and inspect changes in the editor/Git view. Native interfaces can make portions of this easy, but a long transcript still demands that the developer decide what matters.

**Observed Drishya workflow:** long genuine sessions opened near their latest material. A prompt rail, turn counts, toolbox categories, Changes and command navigation offered different routes back into the work. Changes brought changed files, edit counts and failed operations together; Commands could jump to an exact invocation. A Read first-step jump placed the captured source next to the preceding searches and subsequent prose. These were more useful return routes than scrolling indiscriminately.

**Added value:** this is Drishya's strongest job. It can let me resume understanding from a concrete file, failed operation or prompt rather than from a wall of conversation. The accumulated work feels like a record I can inspect, not a transient status feed.

**Added effort:** I must choose among several navigation systems. The faint prompt rail is powerful but not self-explanatory. The general session-search result route failed to move my reading position in both long harness samples, although Commands navigation worked. A count of failures tells me where to look; it does not tell me which remain relevant or unresolved. The background graph does not answer those questions.

**Preference:** Drishya for returning to a substantial session. **Score: 4/5 for the return-and-inspect job, reduced to 3/5 if my first route is general search.** The product direction should be a quiet “since you last read” landing point: the last prompt, new changed files, recorded checks and the exact latest outcome, each opening evidence. This need not invent a narrative or claim why a change happened. It should reduce the number of navigation decisions before the developer regains context.

**Still needs another app:** the actual app being built, and sometimes the editor or terminal to establish present behavior. Captured evidence explains what was recorded, not what remains true now.

### 3. Understand a failure, a read or a change instead of trusting the final answer

**Ordinary harness workflow:** expand the relevant tool output or diff, inspect the target file, and decide whether the result supports the agent's statement. This is already possible in native tools. The difference that matters is how quickly a person can find and compare the right evidence.

**Observed Drishya workflow:** a real historical read had a path, line range, selectable syntax-highlighted excerpt and a full historical artifact. Opening the same file in Workspace showed a different current version. The distinction was explicit. A failed browser screenshot showed the actual native failure, and a later PNG Read displayed the real image. Web content preserved a bot-challenge result even though the fetch metadata reported HTTP success. Commands stated that a successful tool return did not prove every nested command passed.

**Added value:** these are trustworthy moments. The product helps answer “what material was available at that moment?” and “am I reading capture or today's disk?” The evidence is often more useful than a polished agent summary. That is a durable reason to use Drishya, especially during code review and unfamiliar-repository work.

**Added effort:** truncated previews can demand another expansion, and generic tool envelopes sometimes make me decode structure. A Shell result containing source is not the same thing as a dedicated Read snapshot; the file-evidence reader's wording made that distinction harder than necessary. More broadly, tool counts are not semantic certainty: the same real test invocation appeared as Test in Codex and Shell in Claude. A developer needs a view of verification that does not quietly depend on one category label.

**Preference:** Drishya for inspecting captured reads/results and checking a claim against evidence; no clear advantage for an already familiar one-line diff. **Score: 4/5.** Keep the provenance and full material. Improve the first visible excerpt around the user's question—what changed, what returned, what failed—rather than making raw tool arguments the main thing. Keep raw material one step away, never silently substitute a derived explanation for it.

**Still needs another app:** executing a present-day check and examining runtime behavior. Drishya should make that handoff precise rather than imply that recorded green output proves current correctness.

### 4. Inspect code beside ongoing agent work, and make a small correction

**Ordinary harness workflow:** use the editor beside the harness, follow file links, compare a diff and type the desired correction. A mature editor already has excellent navigation and editing. Drishya earns a place only if its file work stays connected to captured agent evidence.

**Observed Drishya workflow:** Files peek kept a current file beside the agent. Workspace provided larger reading, tabs, source/document modes, a local editor, comparison and split views. I created a comment-only draft, compared it with its base, exported an encrypted recovery snapshot, reloaded, restored the draft and verified disk remained unchanged. A native edit handoff prepared an attachment and request; the actual native session checked the base and correctly refused to apply under its read-only policy.

**Added value:** a reviewer can go from “the agent saw this” to “what is here now?” and form a precise correction without leaving the context. Peek is particularly good for a small check. Local drafts and explicit native application preserve a useful review boundary.

**Added effort:** Workspace is a separate mode with a substantial switch in composition. Returning to the agent collapsed a previously expanded captured read. Split view needed me to focus the receiving pane before selecting a file; the empty-pane instruction did not make that extra step obvious. Recovery lives under Layout even though its purpose is saving work. The edit handoff exposed hash/protocol instructions in the main prompt, and native edit capability was only learned decisively after submission. Those are cognitive costs an ordinary editor does not impose on this job.

**Preference:** Drishya peek for quick evidence-connected inspection; my editor for sustained implementation, broad refactoring or debugging. Workspace is a viable small review/draft tool. **Score: 3/5 overall; peek is 4/5, replacing an editor is 2/5.** Preserve the two modes, but make the return path restore my exact reading state. Put draft persistence next to the draft warning. Present a native edit as a concise, reviewable patch request with policy capability visible; keep protocol details expandable.

**Still needs another app:** normal IDE features, terminal workflows and effective policy management. Building an entire IDE here would dilute the evidence advantage. Strengthen the captured/current/draft bridge instead.

### 5. Ask a follow-up with files, a screenshot or a folder

**Ordinary harness workflow:** continue the same conversation and add context through the native interface's supported attachments or file references. Drishya's question is whether it avoids a return trip to that client while preserving confidence about what was submitted.

**Observed Drishya workflow:** text-file and actual image-file attachments reached the real Codex session and produced correct bounded replies. A synthetic screenshot pasted through the actual browser clipboard became a thumbnail attachment and was answered correctly. Folder entries retained relative paths and reached the native agent in the ingestion check; native directory-picker automation itself was inconclusive. A pasted image without any text could not be sent. The history subsequently showed image prompts as visible images, which was useful when returning to the conversation.

**Added value:** ordinary screenshot-and-follow-up work can stay in the evidence workspace. The attachment count/size and removable chips give useful submission feedback. This is a stronger retention mechanism than adding more decorative visualization.

**Added effort:** the composer starts small, exposes its capabilities progressively, and does not let an image stand alone in an existing conversation. Text attachments become part of a collapsed captured prompt envelope, so reviewing exactly what went in is less immediate than the image path. Model/effort choices require the settings-read discovery described above.

**Preference:** viable in Drishya when I am already reading there; insufficient reason by itself to switch from native chat. **Score: 3/5.** Improve context preview, support a deliberate image-only continuation, and make supported model/effort selection directly discoverable. Do not overfill the composer with metadata; prioritize the thing I am submitting and its intended target.

### 6. Answer a question or approve the exact action that is waiting

**Ordinary harness workflow:** respond in the native client's established permission/question surface. This is a baseline capability, not a differentiator on its own.

**Observed Drishya workflow:** Claude's exact Bash request had Allow once, Decline and Original. Allow once resumed the harmless command and its real output arrived. A structured question offered two choices and free text; selecting a choice and sending the answer resumed the agent and produced a read/result. No other terminal was needed for these supported cases.

**Added value:** I can keep watching and understanding in one place. Drishya no longer forces a return to native chat precisely when attention is needed. This removes a reason to abandon the window mid-task.

**Added effort:** the question was repeated in a captured card and a second full answer surface, and one status called it an approval. That makes a simple decision occupy much more attention than it needs. An archive of queue receipts also looked like a current backlog until opened.

**Preference:** Drishya when already supervising there, with little reason to switch back for the exact supported question/approval. **Score: 4/5 for the exercised path.** Use one clear active decision surface, then settle it into compact historical evidence. Distinguish “needs an answer,” “needs permission,” “running” and historical receipts in ordinary language. Global/full-access policy decisions stay native; this review does not certify unsupported approval types.

### 7. Review the work before accepting it

**Ordinary harness workflow:** examine the final response, review the working tree/commits, inspect tests and read affected code. Existing native and editor tools already support pieces of that. Drishya's opportunity is to bring the recorded work and the current review together without claiming more than the evidence proves.

**Observed Drishya workflow:** Changes gathered touched files and failures; Git review showed a real current patch with local review state and a note; Git graph opened a second branch and its commit without changing checkout. Review findings exposed capture gaps. A review-packet preview explicitly excluded current disk/Git/drafts and labelled the recorded evidence. Notes could be attached to a step and found again.

**Added value:** this is a promising occasional audit tool and a good place to ask “what have I actually checked?” The strongest review surface is the link from a file/change back into actual agent work. Read-only Git with explicit local notes is appropriate for building confidence before acceptance.

**Added effort:** review is split among Changes, Git, Notes, findings, commands and packets. I had to learn which question each answered. A current Git patch and a captured agent edit are different things, but the navigation sometimes takes more effort than that conceptual distinction should require. The default floating Git window made even a small side-by-side patch cramped. A two-commit graph spent far more space on the plot than on understandable change information.

**Preference:** Drishya as a companion for evidence-rich review; editor/Git tool for the final current-code review and acceptance action. **Score: 4/5 for audit, 3/5 for an integrated pre-acceptance workflow.** Make the review route answer four concrete questions in order: what changed; what recorded checks support it; what is missing; what do I still want to ask? Bring the existing tools together around those questions rather than add another review dashboard. Clearly state the source of each view.

### 8. Resume a project tomorrow, or hand understanding to someone else

**Ordinary harness workflow:** reopen the project/session and recover context from its conversation, saved changes and Git history. The exact ease depends on the native client and editor; no claim here that they cannot do this.

**Observed Drishya workflow:** Home grouped local workspaces, offered harness/recency filters, showed running activity and a last-workspace resume strip. Library search could search imported conversations. Notes and review packets supplied local handoff material. A genuine captured Screen run could be scrubbed independently of prose, useful for understanding a visual workflow after the fact.

**Added value:** the cross-harness repository-centered entry is useful for a developer who alternates between Claude and Codex. It reduces the need to remember where a piece of work happened. Exact captured evidence can make a handoff less dependent on trusting the original agent's concluding paragraph. Screen is a credible differentiator for visual-agent work when real frames exist.

**Added effort:** first-prompt titles can collide; Home's strong browsing model does not yet make the next day's most relevant task obvious. Local notes are browser-bound, and exported packets require matching evidence to be useful. The Screen entry needed assistance to discover, and one particular held-frame transition visibly lost the main picture while saying it was showing an earlier frame. Those limitations weaken continuity and confidence; they are not reasons to claim the entire capture is missing.

**Preference:** Drishya for repository-centered cross-harness history and occasional handoff. **Score: 4/5 for finding/reopening, 3/5 for handing off complete understanding.** Give sessions a memorable task identity, retain reading position, make local-note durability clear, and provide a joined evidence packet with an understandable recipient view. A handoff should not require the recipient to learn the producer's navigation habits.

## Adoption verdict by developer and task

Scores are judgments of job fit, not a measured average: **1** = would avoid; **2** = limited occasional value; **3** = useful but extra work affects preference; **4** = would usually choose it for this supported job; **5** = an effortless default with no material workflow detour. No 5 is awarded from this limited review.

| Developer / situation | Keep open daily? | Replace native chat? | Occasional audit value | Reason |
|---|---|---|---|---|
| Experienced developer supervising substantial multi-file agent work | Yes, alongside editor: 4 | Conditional: 3 | 4 | Captured/current reading and review pay for the extra surface; orientation still costs attention. |
| Developer doing quick, familiar edits and short questions | Usually no: 2 | No: 2 | 3 | Familiar native flow is the lower-effort choice; visualization adds little to a change already understood. |
| Maintainer returning after a long unattended run | Yes during the run/review: 4 | Conditional: 3 | 4 | Files, commands, failures and evidence give useful entry points after looking away. |
| Developer switching between Claude and Codex | Yes if projects are shared: 4 | Conditional: 3 | 4 | One repository-centered history is meaningful; category inconsistencies and native exceptions remain. |
| Reviewer inheriting work they did not prompt | During review: 4 | Not the main question | 4 | Provenance and capture gaps are valuable; still needs current code/runtime verification. |
| Beginner learning an unfamiliar repository | Conditional: 3 | Conditional: 3 | 3 | Seeing real material can teach; raw tool inventory and several modes can also overwhelm. Do not sell the map as an explanation by itself. |
| Visual/browser-agent developer | Conditional: 3 | Not established | 4 potential, 3 observed | Recorded frames/actions can tell a useful story; the sampled held-frame defect and discoverability reduce confidence. |
| Developer seeking a full IDE/Git client replacement | No: 2 | No: 2 | 3 | The small draft/review loop is useful; expanding toward a generic IDE would obscure the unique captured-evidence role. |

**Separate overall verdicts:** keep as an active companion **4/5 for substantial agent work**; replace the normal harness conversation **3/5 for supported tasks**; use as an occasional historical audit/review tool **4/5**. These are separate value propositions. Success at replay or audit does not automatically imply daily active use.

## What survives without the animation?

The exact historical read, the distinction from current disk, command/result navigation, changed-file review, local notes and a follow-up that reaches the same native session all remain worth using. The interface could lose every arrival animation and those jobs would still have value. Purposeful motion can make origins and transitions easier to understand; it should make those relationships easier to learn, not become the reason to keep the window open.

For a **five-minute familiar task**, I would usually stay in the harness I already opened. Drishya wins only if it is already connected and immediately lets me read the material I care about with less effort. A second setup, another menu vocabulary and an always-present dock can cost more than the task gains.

For a **long change in an unfamiliar repository**, the advantage is clearer: I can return through a changed file, a captured read or an exact command; establish what the agent actually had available; distinguish that from current code; and ask a precise next question. The review demonstrated those ingredients. It did not establish that the spatial map itself gave me a better conceptual model of the repository, or that more visible operations necessarily produced more understanding.

The minimum daily-use loop to make excellent is: **open the right session → know what is happening → look away safely → return to the relevant new work → inspect one decisive piece of evidence → answer/approve or ask a follow-up → keep my reading context.** Make that loop feel easier than the familiar native/editor combination before adding more developer tools. Files, Git and review features should support that loop; they should not become separate destinations the developer must manage.

## Product changes most likely to change that verdict

Effort is relative product scope, not an engineering estimate: Small = a focused interaction/composition; Medium = a joined journey across existing surfaces; Large = a new durable workflow or evidence contract. Priority reflects adoption impact, not the severity of an isolated visual defect.

| Priority | Product direction | Keep / simplify / redesign | Effort | Expected benefit and evidence |
|---|---|---|---|---|
| P1 | Make returning to work a first-class journey: last read point, new material, changed files/checks and latest outcome, all linked to capture. | Join existing navigation; do not add another parallel dashboard. | Medium | Gives unattended work a daily reason to stay open. Existing Changes/Commands/Read navigation proved useful; choosing among them cost attention. |
| P1 | Make one clear active agent state and one next action. Separate answer, approval, native work, passive watching and archival receipts. | Simplify status and active-decision composition. | Medium | Reduces hesitation during the actual work loop. Real approval/question paths worked but duplicate surfaces and queue wording distracted. |
| P1 | Make evidence navigation dependable and easy to reverse. Preserve expanded source and internal reading position through Files/Workspace/review. | Redesign continuity around the reading task. | Medium | Protects the core advantage over familiar tools. Search destination failures and collapsed returns break the mental thread. |
| P1 | Make the first view of an operation answer a developer's question: material read, change made, meaningful result, exact missing evidence. | Keep full material/provenance; simplify raw envelopes and count-led chrome. | Medium | Improves comprehension rather than adding features. Actual source/current distinction was valuable; serialized snippets and categories demanded decoding. |
| P1 | Create one coherent pre-acceptance review route across changes, recorded checks, gaps and open questions. | Join Changes/Git/Commands/Notes/findings/packet; retain distinct evidence sources. | Medium | Converts excellent ingredients into a practical habit. Current review was powerful but scattered. |
| P2 | Put connection setup/model loading/edit capability in the user's path at the right moment. Keep native policy authoritative. | Simplify onboarding and capability language. | Small–Medium | Removes first-use friction and prevents an edit draft from looking immediately applicable when the native session is read-only. |
| P2 | Make quick context submission excellent: visible attachment preview, deliberate image-only follow-up, directly discoverable supported model/effort controls. | Keep composer compact; improve its contents and decisions. | Medium | Screenshot/file follow-ups successfully kept work inside Drishya; these are common retention moments. |
| P2 | Make Files peek and Workspace feel like one reversible reading loop. Expose draft recovery near drafts, show receiving split clearly, give concise handoff review. | Keep peek and Workspace; simplify transitions. | Medium | Gives a reason to inspect beside the agent without competing with an IDE. Recovery and comparison actually worked. |
| P2 | Treat the map and tool dock as supporting context, not permanent homework. Show relevant recorded categories; put exhaustive tool inventories behind disclosure. | Keep map optional/aesthetic; simplify resting chrome. | Small–Medium | Restores attention to actual work. In this review, explicit evidence routes delivered more understanding than the graph. |
| P2 | Give sessions memorable identity and a reliable next-day return. Explain note/recovery durability and the recipient experience of exports. | Keep cross-harness Home; improve continuity. | Medium–Large | Makes cross-harness history a continuing workspace rather than a library opened only after trouble. |
| P2 | Make Screen confidently readable: clear historical/latest language, dependable held-frame boundaries, a visible route from visual operations, useful enlargement. | Keep; refine before promoting as a key differentiator. | Medium | Genuine screen frames and action trail were useful; a specific held-frame transition contradicted its caption. |
| P3 | Match review/editor window size to the material and reduce unnecessary mode/menu choices. | Simplify; do not add general IDE scope. | Small–Medium | A small two-column diff and two-commit graph should be easy to read without window management. |

Do not remove captured evidence, current-file access, native follow-up, precise approval, or the ability to leave the visualization and read. Those are the reasons to return. De-emphasize exhaustive tool availability/counts and the map when they do not answer the current task. Keep replay as an optional investigation/presentation mode; it is not the default way a working developer should consume a long history. Keep alternate interface experiments out of the main adoption promise until their status is clear.

The product should earn the sentence **“I understand enough to act here.”** At present, it earns that sentence in several concrete reading and approval journeys. It does not earn it merely by showing more of the harness's vocabulary or by putting the repository behind the conversation.

---

## Appendix A — independent first use and evidence boundaries

This is one agent's critical product-use review, not human user research. The reviewer began with the running product and repository safety instructions, before implementation, feature inventory, VISION or prior review documents. The runtime and genuine recordings were supplied in a separate scratch home. Existing active user sessions were not resumed; only the explicitly provisioned disposable sessions were continued. Private recording content is not reproduced here; evidence identifies session prefixes, counts and anonymized interactions. Screenshots remain under `.local/`.

### Blind notes — recorded before inventory reconciliation

- Home reads as a local session browser immediately: repository grouping, harness filters, recency and a Running now strip provide useful orientation without explaining the architecture.
- The empty black outer frame and restrained surfaces feel calm; the list makes this seem more like a practical developer tool than a visualization demo.
- Session identity depends heavily on the first prompt. Several genuine local captures have near-identical acceptance-test prompts, so recognition is difficult even with workspace and recency. A person returning to one task needs more than a prompt fragment.
- A repository list alongside all sessions is an understandable starting point. Its value will depend on reliably moving from a session into actual evidence and back without losing position.

These blind notes are preserved separately from the later assisted reconciliation and product judgment above.

## Appendix B — scope and evidence ledger

The frozen product runtime is main `344d59b9`; the review checkout began at `bc97467e`. Unmerged finishing work is outside this judgment. Main experience: Modern, initially 1440 × 1000 on Windows Edge. The first session routes were supplied by the coordinator after Home exploration; that is assisted entry, not proof those imported recordings were easy to find on Home. A feature-family checklist and an operation metadata index were supplied after the initial Home/session/search/read impressions. They are used for completeness, not as evidence a capability works.

| Genuine recording prefix | Initial bytes / operations | Hands-on use |
|---|---:|---|
| Codex `rec_fa9e37da` | 783,186 / initially 30 | Initial action-history view; passive source still evolves |
| Codex `rec_7cb1cda1` | 15,023,432 / 1,115 | Long prose, usage/context, search, Changes, toolbox |
| Claude `rec_39af3c94` | 14,545,573 / 747 | Long history, read focus/jump, historical source, Workspace/current source, Files peek/document |
| Claude `rec_e091722b` | 25,988,480 / 315 | Captured plan, read/search/edit/validation materials |
| Codex `rec_aca34202` | 208,187 initially | Disposable genuine native follow-ups, text attachment, Files/Workspace draft, Git |
| Claude `rec_20bd7d66` | 260,937 initially | Disposable genuine native follow-up, exact one-time approval and test result |
| Claude `rec_ab475ed8` | 39,915,978; 41 computer steps / 15 frames | Assisted historical Screen entry, scrub/play/step, full-window and operation jump |

Initial sizes/counts are supplied scan metadata. Native follow-ups and passive observation add content; later UI counts need not equal this initial snapshot. Scratch Git topology is deliberately synthetic; the harness work recorded against it is genuine. No claims about a broad population of developers follow from these samples.

## Appendix C — secondary interaction evidence

### Evidence reading and comprehension

The strongest interaction so far is selecting Read in the Claude toolbox and using its first-result arrow. It jumps to a real read with a file title, line range, syntax-highlighted captured excerpt and adjacent preceding searches. Expand opens the historical artifact, and the provenance tooltip explicitly says the disk file may differ. Opening the same file in Workspace showed a different current version, labelled Current disk. This is substantive value over a conversation that only says the agent read a file: I can check the material and then inspect today's file without guessing which version I am reading.

The long Codex and Claude prose remains readable and selectable, with ordinary headings, lists, tables and file links. The Codex missing-reasoning notice is honest; an older Claude capture exposes recorded Thinking separately. Do not equate a missing reasoning record with a rendering defect. The table in the disposable session was practical: file names were actionable and each row described its role. Task-list syntax remained literal `[x]` in the prose, a polish issue rather than missing evidence.

Preview fades and compact excerpts keep history manageable, but ordinary inspection often requires Expand before the actual outcome is visible. A small command result is comprehensible; a long source/result excerpt can end in faded content and an omitted-line count. Keep the preview boundary explicit and preserve full-result navigation. The correct next question is whether the visible material supports the conclusion, not whether the green check exists.

### Search and finding the right step

In Codex `rec_7cb1cda1`, session search for a generic testing term produced result snippets containing escaped serialization (`\\r\\n`-style material and envelope text). Result labels distinguished Call and Result, but the snippets demanded decoding rather than reading. Clicking the first result closed search; the final-turn reading position remained unchanged after a further 2.5 seconds. The symptom was subsequently repeated with a Prompt result in the rich Claude capture; Commands navigation worked. This is a scoped search-destination finding, not a claim every search result fails.

Toolbox Read focus worked better: selecting the group exposed first/previous/next/last arrows and the first arrow navigated to a selected read. The group selection itself did not jump, leaving a dash for its current index. That is defensible for preserving reading position, but the second required action is easy to miss. A primary “first matching step” action and an explicit “117 reads in this session” would be easier to learn.

### Usage and session identity

The Codex Usage section is useful: limit window and reset, last-request context numerator/denominator and timestamp, then session input/output/cache/reasoning token rows. The note correctly distinguishes cumulative spending from context fill and avoids inferring subscription billing. This belongs in a daily monitoring tool. It is presently behind the generic top-right workspace-options icon; clicking the session title did not reveal it. The menu can become a tall scrollable column once Session details and Usage are both expanded. A small persistent context/limit affordance would improve access without making the whole ledger resident.

Session details usefully state harness, workspace, recording identity and that journal observation is independent of agent status. Home's first-prompt titles are insufficient when multiple real local acceptance captures have similar prompts; this is a sample-specific collision, not a statement that every real session has a bad title. Rich historical sessions had more recognizable titles. A short user rename, task label or date+branch identity would improve return visits.

### Genuine native follow-up, attachments and approval

Codex `rec_aca34202`: the composer expanded from a small Ask affordance. A typed read/test prompt could not send until the disposable checkout was enabled through Connection & permissions; the disabled Send explained this in its tooltip. Enabling the checkout also enabled workspace reading. The first send then required an explicit “idle in other clients” acknowledgement. After that, a real native turn read source, ran the specified test command, showed two passing cases and a final answer. Status moved through waiting/running/replied and Stop was present during the run. The reviewer did not weaken native permissions.

A README **text file**, 149 bytes, attached as a removable filename chip with a byte budget. A follow-up asking only for its heading returned the correct heading. Submission remained at Sending for multiple seconds before the captured prompt/reply arrived; this pass cannot separate native startup latency from product latency. The draft was retained while sending, which is reassuring. The historical prompt rendered a collapsed text envelope rather than a first-class attachment card. Actual image and pasted-screenshot journeys were completed separately and are recorded below.

The model area initially displayed the native model name; clicking that name did not expose a chooser, and the underlying selectors initially offered only Use native default. **Assisted reconciliation corrected the initial interpretation:** Connection & permissions → Read native settings, followed by about two seconds of loading, populated six Claude model options including native default, and nine Codex model / seven effort options including defaults. The composer then exposed model/effort selectors. Claude effort remained native default only. This is a discovery/loading issue, not evidence of unsupported model choice. Put “Load native models” beside the model affordance, show loading, and explain that an explicit read is needed. Alternate-model submission itself was not tested.

Claude `rec_20bd7d66`: a real read/test follow-up produced a specific Bash approval card containing the exact harmless test command, Decline, Allow once and Original. Allow once resumed the command; both tests passed and the final reply arrived. This is a strong replacement-chat capability: I did not need another terminal to answer that native request. The same command was classified as **Test** for Codex but **Shell** for Claude, with no Test group in the latter's toolbox and no test-run count in its turn summary. The result itself was visible and accurate; the cross-harness categorization/counting is the problem. A developer must not mistake the summary's test count for a complete inventory of verification.

### Files, Workspace and native edit handoff

Files peek opens alongside the agent, with tabs and Document/Source modes. In a real Markdown README containing raw HTML badges/layout, Document showed several literal HTML code blocks before the readable prose. That is safe, but a document mode full of source-like preamble is a poor default reading experience. Explain unsupported markup and provide a cleaned safe rendering without fetching arbitrary remote content. Current-disk identity was clear at the peek footer; put version identity near the title as well so it survives scrolling and a small viewport.

Workspace is a distinct full file-work mode, with an obvious Back to agent exit. It offers file tabs, find, line navigation, wrap, current source and edit. Current source loaded after an initial Reading state. In the disposable checkout, Edit file opened a real local draft with a conspicuous warning that disk was unchanged and the draft is lost on reload unless saved as recovery. A comment-only local change compared correctly against the base and showed +1/−0. This is a trustworthy basis for a review/edit loop, not a direct disk editor.

Review edit with harness returned to the composer with a draft attachment and a generated prompt requiring an unchanged base SHA-256 and native permissions. That is a real handoff, but it surfaces protocol instructions to the person instead of a concise edit-review request. Keep the exact protocol available under details and show the requested file, patch and expected conflict behavior in ordinary language. The comment-only draft was submitted only against the disposable repository. The real native agent checked the base hash and then explicitly declined application because its filesystem policy was read-only. No file changed and no resulting diff or tests were claimed. This correctly preserved native policy; it also proves that a workspace enabled for prompting is not necessarily enabled for applying an edit. Show the last known effective edit capability before offering the handoff, with the caveat that the harness validates it. No user project files were edited.

Back to agent preserved the approximate read location but collapsed the previously expanded historical read. This creates friction in the common “inspect now, return to evidence” loop. Preserve the selected/expanded artifact and internal reading position across Workspace transitions.

### Changes, Git review and branches

Changes on the rich Codex history showed changed files, per-file edit counts, line deltas, turn references and a failure list with exit/error excerpts. It is immediately more useful for audit than scrolling the whole transcript. Its 21 changed files / 35 failures / 1 test run describes this capture's recognized categories; it should not be read as exhaustive verification. Commands, Notes, findings and packet journeys were subsequently sampled as described below; the final capability table gives their limits.

Git review in the disposable checkout asked separately for read-only Git consent, accurately explained that it would read branches/tags/commits/current changes, and showed the real uncommitted README patch. A reviewed checkbox and a local note worked. Changes and Side by side modes were available; the after column was horizontally clipped in the default floating window at 1440 px. A patch with one short extra line should not require managing a window or sideways scrolling before it is understandable. Prefer a roomier default or responsive stacked diff below the useful two-column width.

Git graph read two local branches and two synthetic commits without checking out anything. Selecting the feature branch correctly exposed ahead/behind information and a commit; opening that commit showed its parent comparison and source patch. The graph is tiny while its black plot consumes most of the large modal, and the bottom commit list is spatially distant. More commits may justify the space, but a short history needs a content-shaped layout. The line “Current · main: ahead 1 · behind 0” while reading the feature branch has an ambiguous direction; say “feature/review is 1 commit ahead of main” explicitly.

The commit's Agent work route opened a file-evidence surface listing two shell reads, with “No source or patch was recorded for these actions.” The shell outputs visibly contained source, but there was no formal Read artifact. This is a provenance/model limitation that should be explained as “No dedicated source snapshot; shell output is available,” with an obvious open-output action. Do not suggest the recorded source characters were absent. No causal commit attribution was established by this synthetic Git exercise.

### Later hands-on checks

- **Structured questions:** Claude's real AskUserQuestion produced a captured Question card and a separate live Answer requested surface with choices, optional free text and Send answer. Selecting the README choice resumed the native agent and returned a captured read and response. This worked. The question appeared twice at full length, and the intermediate status said “Waiting for your approval” even though the task was an answer. Keep one active answer surface, a compact historical reference, and precise question/approval status words.
- **Queued inputs:** after completed Claude turns, “Queued inputs · 3” remained visible. Its dialog correctly described three recorded enqueue receipts with outcome unknown, not three outstanding prompts. This is honest archival data with an alarming current-state label. Rename it “Input receipts” or visibly qualify the unknown/past state; do not let a completed task look backlogged.
- **Actual image attachment:** a newly rendered synthetic 360 × 200 red image with white words was attached through the Codex file picker. The real native reply correctly described its color and words. No private session screenshot was sent to a model. Later clipboard and folder-ingestion results are recorded under Final bounded evidence additions; they are distinct from this file-picker check.
- **Captured image reader:** in the rich Claude history, scrolling from a failed browser screenshot to a subsequent PNG Read showed the genuine captured image. Clicking it opened a fitted lightbox with dimensions, byte size, Actual size and Close. This is a useful, comprehensible visual result. The earlier failed browser screenshot was explicitly rendered as a failed screenshot with the recorded timeout; missing pixels were not invented.
- **Web and MCP:** the toolbox's Web first-step jump opened a real fetch with URL, response metadata and available page text. Its returned text described a bot challenge despite a 200 response; the UI preserved that mismatch rather than treating HTTP success as useful content. Expand exposed the full text. The MCP drawer grouped the browser server's preview, navigation and computer tools and let the reviewer step through them. ToolSearch and generic structured-result cards still exposed raw arguments/technical envelopes; these are useful escape hatches but weak first-read summaries.
- **Plan:** after metadata identified which genuine Claude session contained a plan, ordinary scrolling to that session's beginning revealed Update plan. Show plan exposed eight items, revision number and captured status, with no claim that the task was complete merely because the call succeeded. This was assisted choice of session followed by normal navigation, not unassisted plan discovery.
- **Replay:** Replay this session began explicit playback with a transport, speed selector, event rail and count. Space paused; stepping and Next failure moved to an actual failed edit. Exit replay returned to the live-history endpoint. An existing Read focus remained applied during failure navigation and dimmed the non-read failure; show active scope prominently or clear irrelevant focus when the person explicitly seeks a failure. The current file peek also remained open over replay until closed, so its Current disk footer is essential. An unavailable earlier segment was labelled explicitly.
- **Session search repeat:** the first testing-term result in the rich Claude session was a Prompt result. Clicking it closed the result surface but left the final conversation position in view after three seconds. This repeats the Codex symptom across harnesses. By contrast, **Commands → Open activity successfully jumped to and expanded a specific shell command**. Treat this as a session-search destination problem, not a blanket claim that all navigation is broken.
- **Commands:** command search filtered captured commands, exposed outcome and timestamps, and stated that a tool return does not prove nested commands passed. The full captured command was readable, with copy and Open activity. This is useful for finding the actual verification invocation and has a stronger truth boundary than a generic “tests passed” badge. Search is explicitly preview-scoped. Do not present it as an exhaustive terminal-output search.
- **Notes and review tools:** a note was added to a real step, saved locally, and found again through Notes with its step reference. The browser-local storage boundary was explicit. Review findings grouped unavailable change material and compaction gaps with computed labels. Prepare review packet generated a local preview with captured-only scope and exclusion of current Git/disk/drafts. Nothing was externally sent or exported. These are valuable audit/handoff tools but difficult to discover until Ctrl/Cmd K or the otherwise unobvious utility menu is learned.
- **Home return and import:** Home's search plus harness filter narrowed the workspace list and session rows. A discovered disposable native source opened into a recording after a short delay; no active session was resumed. The last-workspace resume strip improved recovery. No import-error or interrupted-import path has been exercised yet.
- **Settings:** all seven Modern palettes were selected and captured locally (Jet Black, Midnight, Daylight, Orchid, Royal, Emerald, Ember), then Jet Black restored. The light appearance changed both reading surface and chrome rather than only accent color. Reading exposes low-resource mode, map/3D/orbit, recorded-reasoning display, relationship motion, document limits, hover focus and opt-in hidden-tab notifications. Privacy explains local redaction and native-write ownership; Keyboard gives useful shortcuts; UI versions labels Clarity In progress. These controls were inspected, not each certified for persistence, OS notifications or physical resource performance. Playback initially presents only a collapsed Sequence diagnostics disclosure, an unhelpful first impression for someone looking for ordinary replay settings.
- **Map:** X/Repository entered an actual map in the disposable repository, showing three files and one import. Fit and file search worked; the two matching math files appeared in the search list. The plot remained mostly empty with tiny labels widely separated. This is a visible aesthetic layer, but the Files list was faster for this task; the map did not yet earn a daily-workspace role from this example. No execution or causal relation should be inferred from its import line.
- **600 / 1024 px desktop:** the genuine Claude conversation/composer at 600 px and the genuine disposable Codex conversation/composer at 1024 px remained readable. Side tools collapsed at the narrower size; ordinary prose used the available width. These are supported-window spot checks, not acceptance of every modal at each size. A keyboard browser-zoom attempt did not change the page's effective viewport and therefore does not count as true zoom testing. No phone sizes were used.

### Final bounded evidence additions

**Screen:** the coordinator supplied a separate genuine frame-bearing Claude capture, `rec_ab475ed8`, after the initial pass found only failed screenshots. Its menu exposed Screen · 15 frames. The viewer had 41 computer steps, thumbnails, step navigation, Play/Pause, Full window and Open operation. A meaningful earlier screenshot was readable; opening its operation returned into the recorded workflow. This was assisted discovery, not a claim I naturally found Screen in the original session. Full window increased surrounding space but kept the sampled 800 × 453 image at its available pixel size. I did not find a separate Actual size/Fit control in Screen; the ordinary image lightbox had Actual size.

The specific transition **step 35 → step 36** was checked twice: step 35 displayed a real frame; step 36 said “No new frame recorded · showing step 35,” but the large image area appeared black while its earlier thumbnail remained. The retained image element was loaded with a nonzero rectangle. This is a narrow observed rendering inconsistency, not evidence that the original screenshot is missing or that every held frame fails. After the independent passes, the coordinator asked the UI reviewer to repeat this exact sequence; that reviewer corroborated it and also found a different held-frame sequence working. The corroboration is coordinated follow-up, not independent blind discovery. Red-outlined failed steps and real white/empty captured frames elsewhere in the strip were not automatically treated as product bugs.

**Clipboard/folder:** the actual browser clipboard received only a newly rendered synthetic red image, then Ctrl+V created an image thumbnail chip. With an explicit short prompt it reached Codex and was correctly described. With only that image attached, Send remained disabled with “Write a prompt to send”; this is a current product capability limitation and a suggested workflow improvement. A two-file synthetic directory was attempted through the native directory input; automation timed out, which may reflect input clearing rather than failed selection. That picker outcome is inconclusive and is not logged as a product defect. A synthetic FileList/change then exercised folder ingestion, produced two relative-path chips, and an actual native reply correctly identified both files and their synthetic text. It proves ingestion/submission, not the OS picker.

**Encrypted draft recovery:** a 696-byte encrypted snapshot containing only the disposable comment draft was downloaded locally. After page reload, it was selected, unlocked and restored to memory through the product. The restored editor contained the draft comment; the scratch source file on disk did not. The UI warned that bases may be stale, existing drafts are not overwritten and recovery does not write project files. The passphrase was cleared after download/unlock, requiring re-entry to restore. That is reasonable but should be made apparent next to a disabled Unlock action. Recovery was eventually found under Layout, while Local drafts only offered open/discard; a developer worried about losing a draft should not have to guess that placement.

**Workspace:** Split view worked after clicking the target pane before selecting a file. The first file selection replaced the current pane while the empty pane continued to invite a file, so the focus rule needs a stronger cue. A new-file draft could be created without creating the file on disk. Creation/apply conflict paths were not exercised because native read-only policy was preserved.

**Local export:** the disposable recording's Export recording action downloaded a 55,737-byte JSON file under `.local/`. No real project recording was shared or externally uploaded. The export's subsequent offline import/recipient journey was not exercised; the report does not certify it.

## Appendix D — capability usefulness and coverage reconciliation

This table is an inventory of product value and honest coverage, not another priority queue. Ratings use the main rubric; **N/A** means the meaningful behavior was not exercised enough to rate. “Partial” does not mean broken. The named omissions are review limits, not claims that the feature is absent.

| Capability / developer purpose | What was actually used | Value / judgment | Keep, simplify or improve |
|---|---|---|---|
| Home local discovery and opening/import | Browsed real local sources; opened a discovered disposable source into a recording | 4 — useful single entry across harnesses | Keep; show clear opening/import progress when it takes time. Import interruption/error recovery untested. |
| Workspace grouping, harness filter, Home search, recency filters | Grouping/search/harness filter used; time selector inspected | 4 for finding work | Keep; improve task identity when prompt fragments collide. Time-filter correctness not separately certified. |
| Running now and last-workspace recovery | Running strip and resume strip observed; returned through Home | 4 — valuable re-entry | Make observation, running and idle language clear. No stale/failed-source recovery induced. |
| Session identity/details | Harness, repository, branch/model truncation, recording/observation details inspected | 3 | Put human task identity first; technical references secondary. |
| Live arrival, Follow and reading position | Real Codex/Claude follow-ups arrived; scrolled away and returned to latest | 4 for continuity, 3 for clarity | Keep independent capture; make detachment/return obvious. No physical low-resource performance claim. |
| Prompt rail/overview, fold/turn summaries | Rail seen/hovered; turn counts and plan link used | 3 — useful long-history scaffolding | Make the navigation model easier to learn; counts are not understanding. Full prompt-overview pagination untested. |
| Explicit replay, pause/step, failure jump | Genuine long Claude replay, Space, step and Next failure used | 3 — useful investigation, seldom a daily default | Keep optional; make active filters visible. Speed extremes/seek precision not certified. |
| Agent prose, headings/lists/tables/code/file links | Long real prose and scratch tables, code, task lists and file links read | 4 | Keep readable prose; refine literal task-list/unsupported-markup presentation. |
| Captured reasoning / missing-reasoning distinction | Older recorded Thinking and explicit not-recorded notices inspected | 4 for honesty | Keep provenance; no hidden reasoning or causal explanation claimed. |
| Read cards and complete historical artifacts | Claude captured source, Expand, stored source and current-file transition used | 4 — a core reason to adopt | Preserve exact capture and make source identity visible throughout reading. |
| Write/edit cards, patch preview, missing after-state | Genuine edit previews and a failed edit reached in replay | 3 for sampled evidence | Keep; improve completeness cues. Full Write after-source and every unavailable-state variant untested. |
| Shell/result reader and copyable commands | Full real command/result expanded; Commands search/jump worked | 4 | Keep; prioritize outcome and meaningful result over raw envelope. Clipboard copying a private command was deliberately not used. |
| Test results and verification understanding | Real two-case native runs in both harnesses; long recorded validation output | 3 — result readable, summary uneven | Do not let Test category totals imply exhaustive verification; connect checks to actual output. |
| Web fetch/search material | Real fetch metadata, returned challenge text and full web result read | 3 | Keep exact result; distinguish transport success from useful content. Separate search-provider variants not exhaustively sampled. |
| Browser operations and failures | Real browser preview/navigation/screenshot failures navigated; later frame-bearing Screen sampled | 3 | Keep honest native outcomes and improve a joined visual-work route. |
| Generic/structured tool results | ToolSearch arguments and browser structured output read | 2 for first-read ease, 4 as raw evidence escape hatch | Keep raw; provide a more legible first view when the captured structure is known. |
| MCP drawers and native/runtime inventory | Browser MCP drawer, its tools and occurrence navigation used; runtime inventory observed after native connection | 3 | Keep grouping/navigation; collapse exhaustive availability lists during ordinary work. No external MCP service was newly invoked. |
| Agents/sub-agent focus and delegation detail | Agents count/drawer affordance observed in genuine multi-agent-capable history | N/A for delegated-task comprehension | No full child-session journey was exercised; do not infer it works from counts. Keep evidence-backed identity, avoid visual causality claims. |
| Captured images, prompt images and lightbox | Genuine PNG Read, synthetic native image/file/pasted-image prompts, lightbox inspected | 4 | Keep as actual visual material. Actual-size control seen; large/unsupported image variants not all exercised. |
| Captured plans and revision status | Genuine eight-item plan opened with Show plan | 4 for explicit captured plan | Keep plan facts separate from inferred progress; multi-revision comparison not exercised. |
| Exact native approvals | Real Claude Bash Allow once resumed the exact scratch command | 4 | Keep; simplify active waiting state. Decline and every request class not separately exercised. |
| Native structured question/answer | Actual two-choice question answered and native work continued | 4 | Keep; remove duplicate full-length active presentation and use answer-specific language. |
| Files tree, current-file consent and search/filter affordances | Real tree navigation, current reading approval and current sources used; filter menu observed | 4 for code access | Keep; explain current/captured status near title. Every filter, unplaced-path case and huge tree not separately verified. |
| File peek tabs and Document/Source | Real README peek opened beside history; tab/format controls and raw HTML document preamble observed | 4 for quick reading, 3 for document polish | Keep two-mode relationship; improve safe unsupported-markup reading. Drag/resize/window-restore paths not certified. |
| File history/Inspector and compare-steps route | Commit Agent work opened recorded file actions and an explicit no-dedicated-source state | 3 | Explain dedicated snapshots vs shell text accurately. Multi-step comparison not exercised. |
| Workspace source/editor/find/line/wrap | Real current source and local CodeMirror edit used; reading controls inspected | 3 as a focused review tool | Keep bounded scope; current editor is not evaluated as an IDE replacement. Each search/line edge case untested. |
| Workspace split, tabs and new-file draft | Split/focus behavior, retained draft/tab and new-file draft exercised | 3 | Make receiving pane explicit. Maximum tabs, layout persistence and native creation conflict untested. |
| Draft comparison and native edit handoff | Comment-only local diff prepared; native base check refused under read-only policy | 3 | Keep explicit review and native ownership; show capability and simplify handoff prompt. Successful disk application not claimed. |
| Draft download, encrypted recovery export/import/unlock | Exported, reloaded, unlocked and restored synthetic draft; disk unchanged | 4 for deliberate recovery | Move recovery next to draft state. Wrong-passphrase/corrupt-file/stale-base variants untested. |
| Workspace command request and new activity bridge | Command-request disclosure/new-activity affordances observed; native commands separately sent from composer | N/A for this separate route | Keep only if it preserves the same clear review/submit boundary; do not imply this specific route was completed. |
| Changes: files, failures, recorded checks | Genuine long Codex summary and per-file/failure evidence inspected | 4 | Keep; connect overview directly to current review and exact evidence. |
| Git current review, unified/side-by-side, review notes | Scratch unstaged patch, both diff modes, local note and reviewed flag used | 4 for audit, 3 for composition | Roomier material-aware default. Staged/untracked/rename/delete/binary variants not all sampled. |
| Git history/graph/branches/ahead-behind/commit comparison | Two-branch/two-commit scratch topology, branch selection, parent patch and Agent work route used | 3 | Keep true topology; reduce empty space and make comparison direction explicit. Dense genuine graph/merge-parent cases untested. |
| Commit provenance | Synthetic commit plus recorded file reads inspected | N/A for causal attribution | Never turn nearby activity into authorship or reason. No genuine linked native commit was established in this pass. |
| Session search and indexed-file tab | Genuine cross-harness text searches used; first-result jump failed; Indexed files tab observed | 2 for the sampled destination route | Fix the broken reading journey and serialized snippets. Indexed-file result navigation not certified. |
| Library search | Cross-import search opened and populated | 3 for finding prior evidence | Keep; result-to-session jump/pagination not fully exercised. No claim that unimported full journals are searched. |
| Command palette / keyboard discovery | Ctrl/Cmd K used to reach Commands, Notes, findings and packet; keyboard guide inspected | 4 for practiced use, 2 for unassisted discovery | Keep; make high-value routes visible before the user learns shortcuts. Assistive-tech acceptance untested. |
| Notes / follow-up questions | Local step note saved and found again; browser-local boundary inspected | 4 | Keep durable evidence references. Cross-browser migration and submitting a note-derived native question untested. |
| Review findings and capture gaps | Genuine unavailable material and compaction-gap groups opened | 4 for audit | Keep derived labels and exact inspection routes; avoid turning gaps into conclusions about work quality. |
| Review packet and local recording export | Captured-only preview generated; only disposable recording JSON downloaded locally | 4 for preparation, recipient experience N/A | Keep preview/choice; clarify what another person needs. Offline bundle import/recipient journey untested. |
| Usage, context and rate-limit information | Real Codex limit/reset/context/token ledger and native model inventories inspected | 4 — valuable ongoing context | Make the useful gauge easy to reach. No unsupported cost/billing inference; Claude context-fill variants not certified. |
| Session segments, observation health, rescan | Explicit unavailable earlier segment, observer details and rescan affordance inspected | 3 for truthful limits | Keep legible health boundaries. Rescan/missing-journal recovery was not triggered against user data. |
| Composer ordinary prompting and attachments | Actual text, text file, image file, clipboard image and synthetic folder ingestion sent | 3 | Keep the loop; improve preview, image-only support and model discovery. OS directory-picker outcome inconclusive. |
| Composer model/effort / Stop | Inventories populated through Read native settings; Stop seen during real native work | 3 for selection discovery; interruption N/A | Alternate-model submission and successful interruption were not established. A final read-only attempt was settled; do not infer Stop behavior from presence. |
| Settings palettes | All seven Modern selections visited and returned to Jet Black | 3 as practical preference | Keep choice, but palette variety is not an adoption advantage. No full per-surface contrast certification. |
| Reading/resource/motion/map/reasoning/document/notification settings | Controls and explanations inspected | 3 for thoughtful control | Keep conservative defaults and reduce jargon. Persistence, OS notifications, reduced-motion/resource behavior not independently certified. |
| Repository map, 3D/orbit, search/fit/imports | Three-file map, one real import relation, Fit and file search used; orbit/3D settings inspected | 2 as a work tool in this sample | Keep optional aesthetic context; foreground explicit useful relationships. Do not claim it taught repository architecture here. |
| Screen timeline/frame/step/play/full-window/operation link | Genuine 41-step/15-frame session used; narrow held-frame inconsistency reproduced | 3 — valuable differentiated job with a confidence break | Keep/refine; distinguish historical latest from active live and preserve held pictures. No broad computer-use harness certification. |
| Modern / Clarity interface switching | Modern used throughout; Clarity explicitly labelled In progress in picker | N/A for Clarity | In-progress interface was not used to strengthen or weaken the Modern adoption verdict. |
| Desktop sizes, zoom and sustained calm | Real 600/1024/1440-window reading during a long review | 3 for sampled readability | No phone work; true browser zoom, every modal combination, physical low-resource performance and a human ten-minute study remain untested. |

### Limits that matter to the adoption verdict

There was no external human participant, no randomized comparison and no measurement that visualization caused better code understanding. The reviewer read and navigated many materials over a sustained session, but that is not human freeze/truth/ten-minute acceptance. There was no current exhaustive feature audit of Claude/Codex desktop/terminal interfaces. Successful native checks were on disposable sessions with unchanged policy; a native read-only denial is a legitimate limit, not a product failure to be bypassed. Doable journeys stopped when the user redirected the review toward product value; unexercised capabilities above remain explicitly unverified.

No product source was changed, no native configuration/credentials were changed, no active user session was resumed, and no private recording content was included in the report or exported externally. All real-session images stay in `.local/`; only synthetic attachments were submitted to native providers.
