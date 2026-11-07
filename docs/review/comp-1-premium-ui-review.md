# COMP-1 · Premium product and presentation review

**Verdict: Drishya has a compelling evidence-reading experience, but its default composition does not yet make agent work easier to understand at a glance than native chat. Overall observed product-presentation score: 6.5/10.** It is most valuable when a developer asks “what changed here, and what material supports that?” It is less convincing when they simply want to keep an agent running nearby and return occasionally. Too much of the interface asks for attention before explaining which thing matters now.

Native Claude/Codex chat is a capable baseline: it already contains tools, diffs, approvals and file references. Drishya must earn the extra window through persistent relevant material, useful side-by-side inspection, clearer relationships and easier re-entry. Merely distributing chat across a visual world does not earn that attention.

This review concerns working **Modern**, runtime `344d59b9`, in the isolated COMP-1 checkout `bc97467e`. It combines independent design assessment A, independent browser assessment B and separate principal-reviewer interaction. Initial impressions preceded source/inventory reconciliation and detector attempts. No implementation was performed. Clarity remains unfinished and is not certified. These are expert judgments from real local sessions, not a user study or whole-product human acceptance.

## What would make someone keep it open?

The strongest moment was moving between a captured action, the source the agent actually saw, and current file/Git context. The distinction between historical evidence, current disk and a local draft is useful and unusually important. Changes and command outcomes can help a developer review work by material rather than by rereading a long conversation. The unboxed prose also gives the product a recognizable, calmer voice than a stack of generic tool-call cards.

The weaker moment was reopening a busy session. A repository world, semantic tools, named tools, sidebars, history, floating controls and several reading surfaces all compete to explain the same work. Their individual purposes become understandable through exploration, but the composition does not immediately answer “where did we get to?” The visual world currently provides more atmosphere and navigable inventory than a consistently clear account of the work.

A developer would keep Drishya open if a glance reliably revealed what the agent is doing, whether anything needs them, and the material most worth inspecting next. They would return to native chat when the task is primarily conversation, or when finding the relevant operation requires more navigation than scrolling chat. They may abandon it after novelty if map motion, overlapping readers and duplicate catalogs remain a recurring cost rather than a route to understanding.

## Scores by developer job

Scores refer to observed states: 9–10 exceptional; 7–8 strong with bounded friction; 5–6 useful but repeatedly demanding; 3–4 significant interference; 1–2 task prevention. Unobserved states are not scored.

| Developer job | Score / 10 | Experience-based judgment |
| --- | ---: | --- |
| Understand agent work at a glance | 5.5 | Material types and outcomes are recognizable. The default hierarchy gives the map and instrument inventory substantial weight without making the current meaningful action equally unmistakable. |
| Follow progress without babysitting | 6.5 | Accumulating history and explicit follow/replay are promising. Persistent chrome, visually similar activity and scattered waiting/outcome cues still require interpretation. |
| Inspect code while the agent works | 8 | Captured source, file peek and Workspace give genuine persistent context. This is the clearest advantage over a conversation-first workflow; competing readers reduce it. |
| Return after looking away | 5.5 | Prompt overview, commands, review findings and Changes provide useful entry points, but the user must decide among them. A short evidence-backed orientation is missing from the presentation. |
| Notice what needs me | 6.5 | Genuine approval and question flows were usable. Generic waiting language and duplicated question presentation weaken the distinction between “read this,” “answer this,” and “approve this.” |
| Trust and understand changes | 8 | Historical/current/local-draft boundaries and read-only consent are strong. Git and evidence comparison help establish what actually happened; comparison choices need better identity. |
| Navigate without losing context | 6 | Peek, Workspace, search and direct activity links are useful. Overlapping reader ownership and repeated identity make it too easy to lose the original inspection thread. |
| Feel calm during prolonged reading | 6 | Prose and restrained flat surfaces work well. Background geometry through text, resident catalogs and small dense evidence undermine calm. Physical long-session performance was not certified. |

| Presentation dimension | Score / 10 | What the score means for those jobs |
| --- | ---: | --- |
| Hierarchy | 5.5 | The next useful thing is not consistently more prominent than the available instruments. |
| Readability | 7 | Expanded evidence is generally clear; the combined composition is harder to read than its individual surfaces. |
| Information sequencing | 5.5 | Too much inventory precedes orientation; source and provenance sometimes repeat before the actual material. |
| Focus and use of space | 5.5 | Persistent relevant context is valuable, but peripheral panels and stacked chrome consume the space it needs. |
| Interaction feel | 7 | Reversible reading controls, direct links and small contextual menus feel considered; foreground ownership is inconsistent. |
| Distinctive identity | 8 | Spatial repository, unboxed prose and content-shaped materials are memorable. Their identity must support understanding rather than demand continual attention. |

## Coherent product direction

Make **the evidence being understood** the center of the product. The world supplies orientation and origin; the dock supplies access to instruments; neither should compete with selected reading material. Preserve the aesthetic spatial map without implying execution relationships the evidence does not establish. Show a focused repository neighborhood when it is useful, and let the rest recede.

Make **re-entry** a first-class presentation moment. On returning to a live session, first expose a compact captured account of what advanced since the reader's position: action counts/outcomes, affected files and any pending request, each linked to its actual evidence. Do not manufacture the agent's intention or an uncited narrative. Existing Changes, commands and prompt overview can supply this orientation rather than creating another permanent dashboard.

Make **inspection a continuous thread**. The selected operation, its file and its current comparison should feel like one investigation across peek, Workspace and Git. Keep the origin, selected action and return route stable. A new reader should visibly own the foreground. Use progressive disclosure for complete catalogs, provenance details and export machinery; retain the truthful captured/current/local labels where they affect interpretation.

## Main recommendations — product value first

These recommendations come from rendered states and interaction, not source-only taste rules. “Before” describes observed experience; “After” is proposed direction. Priority indicates product benefit before finishing polish. Effort is relative S/M/L.

| Priority · benefit / effort | Before | After | Why |
| --- | --- | --- | --- |
| 1 · very high / L | A busy session presents several plausible focal points: world, history, Files, semantic tools and recorded inventory. | Give the current meaningful material one clear visual priority; make the selected file/tool origin legible and let unrelated instruments recede. | A glance should explain the work before the user learns the interface. This is the central reason to choose Drishya over chat. |
| 2 · very high / M | Returning means choosing among prompt overview, commands, review findings, Changes and history. | Lead with a compact “since your reading position” orientation drawn from captured operations, outcomes, files and pending requests, with direct evidence links. | Users need to look away confidently and recover without rereading the whole conversation. |
| 3 · very high / L | Peek, Git and Workspace can compete for the same space; a newly requested file can sit beneath another reader. | Establish one foreground investigation with a stable origin and return route; promote newly requested material and retain useful side-by-side context. | Persistent context is Drishya's strongest differentiator. It should reduce navigation, not create another window-management task. |
| 4 · high / M | Files and Toolbox remain substantial around a narrow reading lane; expanded evidence also carries repeated control rows. | Spend space on selected evidence first. Keep compact file context, disclose full catalogs on demand and combine repeated identity/provenance. | Code, errors and changes should be easier to read here than in chat, including a half-width laptop window. |
| 5 · high / M | Questions, approval requests and generic waiting language overlap in the history/composer presentation. | Give “answer needed,” “approval needed,” “working” and “stopped by you” distinct, concise states, with one obvious action owner. | A peripheral live view becomes useful when the developer can immediately tell whether it needs them. |
| 6 · high / L | Map labels collide and generic aggregates repeat; background relationships cross prose. | Keep a calm world at rest, collision-manage useful labels and emphasize only the focused evidence-backed neighborhood while reading. | Preserve the signature identity while making spatial information help orientation instead of adding visual decoding. |
| 7 · high / M | Evidence comparisons can ask users to choose among almost identical reads/edits with minute-level labels. | Carry file/action identity, scope and sequence into comparison choices; keep the selected historical/current distinction clear. | Comparison earns trust only when the reader knows exactly which two materials are being compared. |
| 8 · high / M | A genuine Screen transition promises a retained prior frame while showing black; other retained-frame transitions work. | Make the image and provenance promise agree, and retain an obvious route to the last visible frame. | Visualization must faithfully show evidence. A black view with confident provenance damages trust more than a visibly unavailable capture. See narrowly scoped appendix evidence. |
| 9 · medium-high / M | Home titles and finding rows require serial inspection; search results give limited differentiation. | Use consistent captured identity, time/harness/file scope and distinguishing excerpts; support recovery in empty searches and visible search matches. | Finding the right work should take less effort than locating it in native history. Never invent session titles or inferred intent. |
| 10 · medium / M | Structured data, browser failures and short outputs can occupy large readers with more machinery than evidence. | Shape each reader around its actual material; keep a compact source/control row, readable primary content and optional technical limits. | The product feels premium when the form explains the content, rather than making every content type look like a subsystem. |
| 11 · medium / M | Draft recovery is truthful but minimum requirements and some error recoveries appear only after friction. | State requirements before input, keep errors local and preserve the user's investigation/draft context through recovery. | A powerful local workflow should feel dependable without becoming a collection of forms the user must understand. |
| 12 · medium / S | Small labels, mixed icon treatment and implementation-oriented version copy add friction after the main task is understood. | Finish the shared reading/type/control system and use user-visible descriptions for modes; keep Clarity explicitly unfinished. | Polish matters, but it should follow the hierarchy and use-case decisions above rather than substitute for them. |

## Per-surface use-case feedback

| Surface family | What is useful enough to preserve | What should change for the developer's job |
| --- | --- | --- |
| Home, workspace chooser, filters and global session search | Workspace/harness separation and real source discovery suit a local cross-harness product. Home's unmatched state has a useful Clear filters action. | Help distinguish neighboring recordings before opening them. Put session identity and re-entry above generic introduction; use search highlighting and meaningful metadata rather than longer truncated prose. |
| Header, utility menu, Usage and mode choice | A small persistent identity and qualified usage information are appropriate. | Keep identity readable without covering evidence. Explain modes by the experience users receive, not implementation history. |
| Prose and action passage | Unboxed prose, distinct source/command/change materials and honest outcomes make history less monotonous than generic cards. | Make the currently important material dominant; remove duplicate chrome before shrinking content. A paused frame should explain itself. |
| Plans, questions and approvals | Captured plans and exact one-time native interactions can connect understanding to action. | Present one actionable request, with clear request type and resolved answer. Avoid making a question look like a generic approval or requiring users to read the same question twice. |
| Files tree, peek and historical file work | Persistent captured source beside the agent is a strong reason to keep Drishya open. Pin/transient tabs preserve context. | Preserve the originating operation across navigation; use the available reading height and make next/previous labels describe actions, including reads. |
| Workspace, split, draft comparison and recovery | Large reading allocation, explicit in-memory draft and historical/current comparison are valuable. | Reduce stacked context rows, keep comparisons identifiable and make pane ownership obvious. Recovery should protect work without making users learn an export subsystem first. |
| Changes, Git review, graph and commit details | This is one of the most useful evidence-synthesis areas: actual changes, topology and patches help judge work. | Give patch/evidence priority over sparse graph space; keep the recorded/current distinction and read-only consent. Do not expand into a generic Git client at the expense of agent evidence. |
| Search, command palette, commands and prompt history | Direct activity links and filters can outperform scrolling conversation. | Organize entry points around “find a failure,” “return to a prompt,” and “inspect this file”; make the empty/recovery path obvious. |
| Notes, review insights and packets | Local notes and cited evidence can help a developer turn inspection into a review. | Bring these tools into the inspection context when needed; avoid a competing resident workflow. Empty Notes should return to the selected evidence, and packet selection should be an uncomplicated form. |
| Toolbox, native tools, MCP and agents | Visible origins and server/agent drawers can clarify who did what. | Distinguish recorded inventory from runtime capability and give the dock one simple purpose. Full named inventory is useful on demand, not as a second permanent taxonomy. |
| Images, web, browser, structured and delimited output | Real material and explicit format choices make evidence inspectable beyond prose. | Preserve exact source and truthful absence. Use content-shaped controls and concise fallback reasons; avoid technical walls around small results. |
| Screen and filmstrip | A genuine frame sequence can show what a computer-use agent saw, rather than merely telling the reader. | Keep frame/held-frame provenance faithful, show selected position clearly and offer a route to inspect dense frames. It is evidence, not a decorative replay. |
| Composer, model/effort, attachments and stop | Genuine native continuation, permissions and stop make understanding actionable without pretending offline bundles are live. | Make readiness/loading and native inventory discovery clear. Keep controls near their action and avoid duplicated model controls competing with the reader. |
| Replay, map motion, Settings and palettes | Optional replay, explicit follow, seven coherent palettes and reduced-motion support can serve different reading preferences. | Default to calm comprehension. Use motion to explain arrival/origin and selection, not to imply hidden reasoning or simulate reading. Long-use calm deserves a real user pilot beyond this review. |

## What to preserve and what to validate next

Preserve whole selectable captured material, unboxed prose, semantic syntax/outcomes, read-only access consent, explicit historical/current/local boundaries, optional sequence replay and direct evidence links. The map can remain beautiful: its aesthetic role is a legitimate builder choice. Its value should be judged by whether it supports a quiet, distinctive working environment and useful orientation, without obstructing reading or implying unsupported causality.

The next product validation should ask developers to use Drishya during a real task, look away, return and explain what changed and what needs them. Compare that effort fairly against their native chat workflow. Measure successful orientation, evidence inspection and context retention, not time spent watching animation. The strongest reason to return is “I understand the work more easily here,” not “the visualization is impressive.”

The appendix preserves granular observations for later refinement. Its measurements are supporting evidence, not the proposed product direction.

---

# Secondary appendix · observed component details and coverage

## Detailed review method and component scorecard

Method: independent design assessment A (`premium_ui_review/assessment_a`) followed by independent browser assessment B (`premium_ui_review/assessment_b`), plus the principal reviewer's separate interactive exploration and synthesis. Coverage is finalized below; partial and unavailable states are explicitly identified.

This is a review of working **Modern**, runtime `344d59b9`, in the COMP-1 isolated checkout `bc97467e`. It is not implementation, a certification of Clarity, or whole-product human acceptance. The scratch daemon/home and each assessment's browser context were separate from the normal Drishya home. Native continuation was exercised only by the principal reviewer on explicitly provisioned disposable sessions; the other assessments remained read-only.

The lenses were `emil-design-eng` (installed local skill, unversioned), `impeccable` 4.8.0 (critique, audit and Operate guidance), `design-taste-frontend` 2.5.0 (consistency, equal edges, real material and plain copy), and `review-animations`. These are local skill sources, not repository deliverables. Drishya's evidence doctrine and desktop scope supersede generic marketing-page rules: no hero, photography, decorative loops, or phone tests are proposed.

Impeccable context loading was attempted once. Its required launcher and entire `scripts` directory were absent at the supplied user-level installation. Assessment B separately attempted the detector and confirmed the same missing-entrypoint exception. **Deterministic findings are unavailable, not zero.** No package was downloaded, design artifacts initialized/repaired, hooks installed, or overlay injected. Existing repository context supplied the product brief.

## Verdict and scoring

Drishya has a product-specific visual idea worth preserving: real captured source, commands and changes arranged in continuous history, with prose directly on the world. Changes, historical source and the local-draft boundary can materially improve understanding. The premium deficit is chiefly **allocation and coordination**: each surface is reasonably composed alone, but their combined chrome competes with evidence, multiple readers occupy the same lane without a clear foreground owner, and nested tools repeat identity and provenance across too many rows.

The biggest opportunity is to make one relationship—the current material and its actual repository/tool origin—unmistakable before presenting the complete instrument inventory. The repository map may remain aesthetic and spatial; it should not have to become an inferred execution diagram to earn its place.

Scores are anchored to the observed state: **9–10** exceptional with no material observed friction; **7–8** strong with bounded improvements; **5–6** usable with repeated reading/navigation friction; **3–4** significant interference; **1–2** observed task prevention. An unexercised state receives **not assessed**, not an invented score. These are expert judgments, not measured user-study results.

| Surface / component | Score / 10 | Observed basis |
| --- | ---: | --- |
| Home composition / library | 7 | Clear workspace-to-session split and useful density; short metadata and similar truncated opening prompts make neighboring sessions hard to distinguish. |
| Home workspace rail / session rows | 6.5 | Coherent grouping; the narrow rail and repeated long titles require serial inspection. |
| Main session identity / utility header | 6 | Compact and calm in isolation; identity truncates at 1440 and captured prose passes behind fixed islands. |
| Session utility menu / Usage | 7 | Clear groups and honest usage qualifications; expanded Usage stretches the menu almost to the bottom at 900px height. |
| Continuous prose / Markdown | 7 | Good line spacing and unboxed reading; persistent dot/edge geometry crosses the reading column. A file-link icon separated from its path in a genuine table row. |
| Read preview / expanded captured source | 8 | Exact captured badge, line scope, search and syntax make evidence readable; surrounding repeated navigation rows still cost space. |
| Edit / Write preview | 7 | Semantically vivid hunks and bounded cards; narrow excerpts and fades require expansion for modest changes. |
| Shell / test material | 7 | Command/output separation and outcomes are useful; executor wrappers can dominate titles and obscure the underlying command. |
| Plan checklist | 8 | Compact revision/count summary expands to a readable checklist with a distinct current item. |
| Historical question | 7.5 | Past-tense heading and selected answer are distinguishable; answer selection relies heavily on dot color and lacks an explicit answer label. |
| Browser failure material | 7 | Faithful failed screenshot result, clear red contour, readable compact preview; expanded controls outgrow the amount of actual error evidence. |
| Captured images / image viewer | 8 | Useful thumbnail, fitted view, actual-size toggle and dimensions; clear escape back to history. |
| Files tree / access consent | 7 | Familiar folder hierarchy and file icons; unchecked/checked consent treatment looks unrelated to the adjacent button. |
| Beside-agent file peek | 7 | Preserves work context, tabs and provenance; competes with Git in the same right lane. |
| Workspace reading | 7 | Large useful content area and explicit return; file identity repeats in tab and inner header. |
| Workspace draft editing / comparison | 5 | Truthful local/disk boundary; comparison search input measured only **18×32px**, including after text entry. |
| Workspace split / layout menu | 7 | Predictable two-pane structure and small contextual menu; split empty state asks to show Files even when Files is already visible. |
| Git access / working-tree review | 7.5 | Clear read-only consent, compact patch review and distinct current/recorded source; floating history return button intrudes over the reader at 600. |
| Git graph / commit details | 6.5 | Actual branches, parent comparison, patch and current-file/agent-work links are valuable; graph/list/detail compete for width and sparse histories expose a large unused field. |
| Search popover | 6.5 | Scope choices and input focus work; empty search gives little recovery guidance and popover covers a reader's header. |
| Command palette | 8 | Fast, explanatory destinations, keyboard focus and good dismissal; first view exposes a long mixed list rather than a few task groups. |
| Commands catalog | 7.5 | Whole-session count, outcome filter and direct activity links make failures findable; long command previews dominate without a concise executable-first cue. |
| Review findings / members | 6.5 | Useful computed limits/gaps, direct members and pages; member title/path repeat and identical rows require reading observation metadata. |
| Prompt overview | 7 | Prompt ordinal/time and direct opening are useful; large prose excerpts yield few prompts per screen. |
| Notes empty state | 6.5 | Clearly local and separate from captured evidence; tells the reader to open a step without helping them return to one. |
| Review packet builder / preview | 5.5 | Honest content selection and preview before export; checkbox/label alignment is visibly broken into separate lines. |
| Native composer / send / stop | 8 | Explicit target, access boundary, idle acknowledgement, pending/running/stop/resolution all visible on a disposable real Codex continuation. |
| Settings navigation / Appearance | 8 | Clear categories, legible palette samples and shared selection treatment; seventh sample is below the initial fold. |
| Settings Reading / Privacy / Keyboard | 8 | Explains what controls change and what they cannot promise; long resource page can be better grouped. |
| Settings Playback / UI versions | 6.5 | Playback initially shows nearly an empty panel behind one disclosure; version descriptions expose implementation history. |
| Repository explorer | 5.5 | Distinctive spatial idea; real aggregate labels overlap and multiple clusters share generic names. |
| Toolbox semantic instruments / inventory | 5.5 | Useful origin/filter affordances; duplicate semantic and named-tool catalogs compete continuously. |
| Replay transport | 7.5 | Explicit optional mode, range position and compact controls; fixed transport obscures lower material during reading. |

Assessment A's Nielsen scores were **25/40**: status 3, match 3, control 3, consistency 2, error prevention 3, recognition 2, efficiency 3, minimalism 2, recovery 2, help 2. Assessment B reported **zero confirmed functional/accessibility defects in its sampled controls**, not a complete accessibility pass. This does not cancel the visual/allocation findings above or the principal reviewer's subsequently observed draft-input and stacking defects.

## Secondary refinement recommendations

Severity: **P1** major task/reading difficulty; **P2** material friction with a workaround; **P3** finishing detail. Benefit is understanding/efficiency; effort is relative **S/M/L**, not an implementation estimate. Each row distinguishes an observed condition from the proposed design.

| ID · severity · benefit / effort | Before | After | Why |
| --- | --- | --- | --- |
| P01 · P1 · high / M | In Workspace local draft comparison at 1440, Find in patch is **18px wide**; typing a query leaves only a clear glyph visible. | Give the search field an explicit minimum readable width, allow toolbar wrapping before shrinking it, and keep the query visible while focused. | A core inspection action currently becomes effectively invisible despite ample panel width. Verified by DOM measurement and interaction, not a screenshot guess. |
| P02 · P1 · high / L | At 1024, full Files and Toolbox remain resident around a roughly 480px reading column. | Collapse peripheral inventory first; retain a compact selected-file context and a deliberate way to reopen either side. | Reading is the primary job; forcing long evidence through a narrow middle spends space on controls. |
| P03 · P2 · high / M | At 600, floating top controls sit over captured prose; latest-position entry also begins beneath header islands at 1440. | Define one shared reading exclusion region for all fixed chrome and scroll-to-selection destinations. | A paused frame must remain readable without mentally reconstructing covered words. Do not solve this by removing deliberate floating controls wholesale. |
| P04 · P2 · high / M | Git review remains above a newly opened file peek; the peek's Open in Workspace control is physically covered by Git. | Promote the newly requested reader or offer an explicit adjacent/tabbed foreground switch; maintain one active reader owner per occupied lane. | A click should reveal the thing requested, with a visible route back. Current overlap requires closing another tool first. |
| P05 · P2 · medium / S | Back to latest is visible over the 600px Git reader and over Workspace. | Bound history-only overlays to the history layer; hide or relocate them while another surface owns those pixels. | A global return control should not masquerade as part of the patch/editor being read. |
| P06 · P2 · high / M | Background lines visibly traverse prose; dot grid continues at full local density around text. | Apply a bounded quiet zone beneath actual DOM reading allocations; sharpen only the selected origin relationship. | Preserve the map and spatial identity while making captured evidence the visual foreground. |
| P07 · P1 · high / L | Repository clusters overlap labels in a real 1440 view; several are generically named Mixed files. | Collision-manage labels, reveal a focused neighborhood and disclose exact cluster members; keep aggregate identity stable. | A beautiful graph that cannot identify its visible nodes does not improve repository understanding. |
| P08 · P2 · high / M | Toolbox shows semantic Read/Search/Edit/Shell rows, MCP/Agents, then Available tools, another search field and a named native-tool list. | Keep the semantic dock at rest; put recorded named inventory and runtime inventory in clearly distinguished drawers. | Two taxonomies make users translate the same activity twice and consume reading height. |
| P09 · P2 · medium / S | Review-packet checkboxes sit on their own lines above their text labels at 1440. | Use one aligned checkbox/label row with wrapped text in the label column and a single consistent row gap. | This is a visible form-layout defect, not deliberate density. |
| P10 · P2 · medium / M | Opening-prompt titles in Home truncate into nearly identical rows; identity in the main capsule also truncates early. | Keep a stable full-title reading affordance and consistent time/branch/harness disambiguators. Allow identity to use available width before truncating. | Session choice should not require opening every neighboring recording. Do not invent generated titles. |
| P11 · P2 · medium / S | Search's unmatched state is only No matches under a scope/cap note. | State which corpus was searched, provide Clear search and one short refinement hint. | An empty result should help the user recover without switching search modes by trial. |
| P12 · P2 · medium / M | Expanded result material includes result-field selector, captured status, stored-result note, Original and Copy controls around a short browser error. | Keep one compact provenance/control row; reveal secondary format/source controls contextually. | The evidence should outweigh the controls even for a one-sentence failure. |
| P13 · P2 · medium / S | Browser material says No URL in input. | Say No page URL captured when that is the evidenced condition. | Describes the user's available evidence instead of an adapter field. |
| P14 · P2 · high / M | Executor wrapper syntax owns the title and first preview in a live Codex shell action; the underlying command arrives as a separate related material. | Prefer the evidenced executable/command as the scanning cue, with the wrapper identified as its captured execution context. Preserve the exact original. | Most readers need to know what ran before understanding the orchestration code. Never collapse distinct recorded calls into invented causality. |
| P15 · P2 · medium / M | A deliberately stopped command resolves with a red exit −1 card, while interruption is explained elsewhere. | Where captured/controller evidence supports it, place Stopped by you beside the outcome while preserving exit status. | Users should distinguish an intentional stop from an unexpected command failure at a glance. |
| P16 · P2 · medium / S | Finding-member rows repeat the same full path as title and again as mono path; similar rows differ chiefly by observation number. | Show the operation identity once, then useful time/sequence/outcome and a bounded distinguishing excerpt. | Improves scanning and fits more useful evidence without shrinking type. |
| P17 · P2 · medium / S | Notes says Open a step and add one, with no immediate route. | Offer Return to selected step, or a direct keyboard hint when a step is selected; preserve the empty state explanation. | Guidance should make the next action available, not merely describe it. |
| P18 · P2 · medium / M | A genuine prose table put a file icon on a separate line from its code path. | Treat the icon and path label as one inline wrapping unit; wrap at meaningful path boundaries where possible. | File identity should remain recognizable inside dense tables. |
| P19 · P2 · medium / M | Workspace draft view stacks workspace header, new-activity row, tabs, file header, draft warning, comparison context and patch toolbar before content. | Combine identity/context where possible; keep the local-draft warning concise and persistent, and put secondary actions in File/Layout. | Truth and safety remain visible while the actual draft gets more vertical space. |
| P20 · P3 · medium / S | Split empty pane says Show files while Files is already visible. | Tell the reader to choose a file for this pane and visibly mark the receiving pane; use Show files only when hidden. | The empty state should reflect the current layout and remove uncertainty about where the next file will go. |
| P21 · P2 · medium / M | Sparse Git history occupies a large graph field; selecting a commit adds a third column and truncates list subjects. | Allocate a compact useful graph height for small histories; let the selected patch take priority, with graph/list proportions adjustable. | Preserve genuine topology without turning a two-commit inspection into mostly empty space. Dense histories still need their larger field. |
| P22 · P3 · medium / S | UI versions use identical thumbnails and descriptions referring to Legacy, rebuilding and backup. | Describe the user-visible mode and clearly mark Clarity's unfinished status with a concrete limitation. | Product choices should communicate what the developer receives, not the implementation genealogy. |
| P23 · P3 · low / S | Playback settings opens a near-empty content panel with only Sequence diagnostics collapsed. | Put the short explanation and Replay sequence action in the first view, or make Playback a direct secondary section. | An entire navigator category should not appear unfinished before its only disclosure is opened. |
| P24 · P2 · high / M | Many actual evidence/error snippets use the same 11–12px scale as metadata. | Keep compact metadata, but give selected evidence and error explanation a 14px reading floor where it is prose. Use expansion rather than scaling text down. | Passing contrast and a technical type floor do not guarantee comfortable ten-minute reading. |

## Browser evidence and false positives

Assessment B inspected genuine Codex and Claude recordings at **600×900, 1024×900, 1440×900** in its own installed-Chrome context. It found no document-wide horizontal overflow, console errors or uncaught page errors in that sample. Settings was inspected in all seven palettes at 600px; sampled computed text/background pairs passed 4.5:1 after correctly parsing CSS `color(srgb …)` values. This was not a pixel-based complete syntax/overlay contrast audit.

Search opened with input focus and Escape restored the trigger. Sampled controls showed 2px focus outlines. Settings used a correctly named native modal dialog. Escape worked in sampled Settings, Search, Workspace, Git consent, review and command-navigation states; Ctrl+K focused the query. Reduced-motion Settings opening had no running animation.

The 26px clipped result-view handle is **intentional**: hover/focus expands it to approximately 141px and reveals the reading controls. It is not a clipping defect. Native `<dialog>` semantics do not require an extra `role=dialog`. Initial light-palette contrast failures from an inadequate color parser were discarded. None of these false positives should become work items.

Measured compact controls—20×20 About this step, 28×22 Files minimize, 64×18 Toolbox open—are observations, not automatic WCAG failures. Desktop spacing exceptions matter. A real keyboard/screen-reader and motor-accessibility assessment remains necessary before making compliance claims.

## Evidence ledger and limits

Initial imported seeds: Codex `rec_fa9e37da` **788,296B / 31 operations / 1 file**; Codex `rec_7cb1cda1` **15,023,432B / 1,115 operations / 25 files**; Claude `rec_39af3c94` **14,545,573B / 747 operations / 46 files**; Claude `rec_e091722b` **25,988,480B / 315 operations / 135 files**. Passive captures can grow; these are seed counts, not frozen final counts. Home initially discovered **194 sources / 41 workspaces**.

Additional genuine disposable captures used for native/Workspace/Git inspection: Claude `rec_ab67986c` **261,198B initially** and Codex `rec_2dcde4d9` **205,691B initially**. Both were resumed only for explicitly bounded synthetic read/test/reply interactions during this review. A short exact reply completed, then a harmless 20-second delayed output command was explicitly stopped through Drishya. Workspace edits remained a local in-memory draft; no project file was saved/applied. The disposable Git repository supplied **2 local branches / 2 commits / 1 unstaged file**; no remote/upstream case was inferred.

Real cases located by a metadata-only case index: Claude `rec_39af3c94` **6 image operations / 15 image prompts / 5 browser operations / 16 web operations / 2 questions / 3 Screen steps**; Claude `rec_e091722b` **1 plan-mode operation / 43 image operations**; Codex `rec_7cb1cda1` **17 web operations / 2 questions / 3 image prompts**. Counts locate available cases; they do not mean every case was visually checked. Observed: Claude plan/checklist update, historical question with selected answer, read-result images and fitted/actual-size viewer, browser navigation and failed screenshot capture.

Real screenshots remain in `.local/` and are not embedded, quoted or published here. Private prompts, prose, titles and native paths are deliberately absent. This report records product labels, generic structure, counts and session prefixes only.



## Additional observed details retained for refinement

These observations were gathered before the product-direction steering. They remain useful evidence for later finishing work. Priorities describe local impact; they do not supersede the main product recommendations.

| ID · severity · benefit / effort | Before | After | Why |
| --- | --- | --- | --- |
| P25 · P1 · high / M | In a genuine Screen case, step 35 visibly renders; advancing to 36 shows a black main view while the caption promises the retained image from 35. Reproduced twice after 500–700ms in the principal reviewer's installed-Chrome context at 1440×900. | Ensure the held image and provenance agree; if rendering fails, disclose that and link to the last visible frame. | Functional evidence fidelity, separate from visual taste. The image was loaded at 800×453 with a nonzero rectangle and opacity 1; this does not establish a CSS or capture root cause. |
| P26 · P2 · medium / M | Screen offers frame navigation and window/full-window modes but no Fit/Actual size inspection route; dense captured UI is reduced at 600. | Offer an explicit frame inspection route using the established image-viewer pattern. | Developers sometimes need to read the actual screenshot, not only follow its sequence. Enlarging cannot create missing captured detail. |
| P27 · P2 · medium / S | At 600 after resizing Screen, the selected later action was outside the immediately visible filmstrip; its earlier neighbors remained visible. | Keep the selected action visible after layout changes without discarding deliberate user scrolling. | Filmstrip position should support orientation. This is a scoped resize observation, not a claim that navigation always fails. |
| P28 · P2 · medium / S | Historical Screen uses “following live” while following the latest imported position. | Use “Following latest capture” when that is the evidenced mode. | Following a recorded position should not imply an agent is currently running. |
| P29 · P2 · high / M | A genuine native question is repeated in history and an answer form, while a generic history status says approval and the composer says answer requested. | Give the request one clear action owner and distinguish answer from approval throughout. | Reduces uncertainty about what the developer must do next. Answer submission and resolved-answer display did work. |
| P30 · P2 · medium / S | Recovery disables actions with a short passphrase without explaining the 12-character minimum in the visible form. | State the minimum beside the field before input. | Prevents an avoidable dead end while retaining the encrypted local workflow. |
| P31 · P2 · medium / M | A line-number validation message squeezes the adjacent current-source Find field to roughly 46px and wraps navigation controls. | Give validation its own row and preserve a usable search allocation. | Related to P01: secondary feedback should not disable the primary reading tool. |
| P32 · P2 · medium / S | Historical file navigation calls controls Next/Previous change although they traverse reads as well as edits. | Name them Next/Previous action, or identify the actual next material. | The label should describe the inspection sequence rather than imply every step changed code. |
| P33 · P2 · high / M | Captured comparison selectors contain many visually identical reads/edits from the same minute and generic excerpt descriptions. | Include sequence and source scope/hunk identity, retaining the exact historical source. | Users must know which evidence is selected before trusting a comparison. |
| P34 · P1 · high / M | The First step native popup in installed Chrome/JetBlack renders a white popup with nearly white unselected choices. | Use a consistently readable selector presentation and verify the actual native popup in supported browser/theme combinations. | This is a directly observed popup exception, not a failure of every palette. B's narrower Settings-only computed contrast pass did not inspect this popup. No CSS root cause is asserted. |
| P35 · P2 · medium / M | A large historical source reader shows about 19 of 70 lines before a helper strip, leaving considerable unused lower area. | Let the expanded reader use available reading height; keep bounded previews compact. | Expansion should buy reading space rather than only a larger container. |
| P36 · P2 · medium / S | Escape from file history opened through Agent work on file leaves keyboard focus on the document body after the origin control disappears. | Restore focus to a stable file/material origin or an explicit fallback. | Keyboard inspection should preserve the investigation context. |
| P37 · P2 · medium / M | Native model controls initially resemble inert default labels until Connection & permissions → Read native settings obtains inventory. Inventory then exposes 8 models and 7 effort choices. | Make readiness and the inventory-loading action discoverable; show one authoritative control location. | This is a discovery/loading issue, not proof of missing native capability. Model controls also repeat in the composer and popover. |
| P38 · P2 · medium / M | Attachment validation can appear behind an open file peek; model popover content can also be covered. | Coordinate foreground/error ownership with the active reader and composer. | Same shared surface-coordination problem as P04, not a reason for separate ad hoc layers. |
| P39 · P2 · medium / S | Structured-data fallback leads with a dense list of JSON constraints and technical limits. | Give the specific reason first, retain Original and disclose detailed limits secondarily. | Honest fallback can be understandable without making the developer parse implementation limits. |
| P40 · P2 · medium / S | Data readers use a generic Data title; Table/Tree and CSV/TSV selection differences are subtle. | Carry the source operation into the title and strengthen the selected mode affordance. | The developer should retain ownership and format context while inspecting data. |
| P41 · P2 · medium / M | Global session search gives similar untitled rows and no visible match highlighting in the observed results. | Highlight actual matches and prioritize distinguishing captured metadata/excerpts. | Search should explain why a result is relevant before the user opens it. |
| P42 · P3 · low / S | Singular states include “1 drafts,” “1 test runs” and “1 columns”; icon treatment mixes line icons with copy/reset glyphs. | Finish singular copy and shared optical/control treatment. | Small credibility gains after the product hierarchy is resolved; not a primary product direction. |
| P43 · P2 · medium / S | Compare with disk honestly reports that a historical file is outside the indexed workspace, but the inserted message shifts only one comparison header downward. | Align pane identity independently of local errors and offer a relevant recovery route. | The error is legitimate; the comparison should remain understandable while it is shown. |

### Screen evidence scope

The genuine frame-bearing case was `rec_ab475ed8`, **39,915,978B / 41 computer steps / 15 frames**, historical only. Its case navigation was coordinator-assisted. Initial principal exploration independently observed a **passing** retained-frame transition: failed action 33 correctly displayed frame 24, dimmed with explicit provenance. Step 34 also visibly rendered. After those independent observations, the coordinator requested a targeted check of **35→36**; P25 is therefore **coordinator-directed corroboration**, not a blind A/B discovery. It reproduced twice while 35 itself rendered normally. Do not generalize it to all held frames or infer a root cause. Local evidence names: `.local/premium-review/screen-frame35.png` and `.local/premium-review/screen-held-step36.png`. These real-session images remain local and are not published here.

The earlier `rec_39af3c94` case had three computer steps but zero captured frames; the absence of a Screen entry there was correct. A missing capture and a rendered held-frame failure are distinct conditions.

## Final nested-surface coverage ledger

**Tested** means actually opened/interacted with in the rendered UI; it does not certify every permutation. **Partial** names the unexercised part. No additional QA was performed after the product-direction steering.

| Surface / nested interactions | Status | Observed coverage and remaining limit |
| --- | --- | --- |
| Home composition, rows, About, workspace chooser | Tested | Desktop layout, scrollable chooser, discovery transition and intro toggle. About's inverse “Less introduction” copy is awkward but minor. |
| Home harness/time filters and empty search | Tested | Three harness choices, four time choices, unmatched results and working Clear filters. No first-install completely empty home was provisioned. |
| Home import and discovery failures | Partial | Existing genuine sources were discovered and imported by the provisioned scratch setup. Principal did not manually import another source or induce transport/discovery failure. |
| Global session search | Tested | Query, workspace/harness/date filters, results and dismissal; no visible match emphasis. No exhaustive date-boundary test. |
| Header, product/utility menu, Usage | Tested | Open/close, usage expansion and limited-width allocation. Not every external destination was activated. |
| Prose, Markdown, file references and passage | Tested | Real Codex/Claude material, source links, wrapped tables and selection/expansion. No fabricated pathological text corpus. |
| Read, edit, write, shell, test, error material | Tested | Real source/patch/command/output and genuine node:test pass; intentional command stop. Not every harness envelope variant. |
| Plan and historical question | Tested | Genuine expanded checklist and selected historical answer. |
| Active native question and approval | Tested / partial | Claude answer choice/submission/resolution, one-time approval and genuine test execution. Original approval-payload disclosure was not successfully exercised; decline/error/reconnect variants untested. |
| Captured images and viewer | Tested / partial | Genuine image result, open/close, Fit/Actual size and dimensions. Not every missing/encrypted/image-only prompt variant; no private screenshot submitted to a provider. |
| Web/browser output | Tested / partial | Genuine Codex web result, browser navigation and failed screenshot material, reading expansion and source controls. Not every result type or successful interactive browser session. |
| Structured JSON and delimited text | Tested / partial | Genuine synthetic JSON table/tree, expansion/search and exact Original fallback; CSV/TSV/header/search, including 600px. Scalar-copy and huge/nested-resource stress not exercised. |
| MCP resource-specific reader | Unavailable in exercised cases | No genuine matching resource-envelope reader was established; no fake state was injected. |
| Files tree, current source and consent | Tested | Read-only grant, tree search/selection, current source Find/line validation and source toolbar. Pointer resizing of every Files allocation was not exercised. |
| Peek tabs, movement and resize | Tested / partial | Pinned/transient tabs, keyboard move and resize/reset. Pointer resize not exercised. |
| Historical file work / compare evidence | Tested | Action trail, next/previous, captured-source selection, two-step comparison, disk-unavailable state, 600px stacked comparison and Escape focus loss. |
| Workspace reading, tabs and split/layout | Tested | Open/return, split menu, keyboard divider adjustment, pointer clamp and Reset layout. Empty receiving pane observed. |
| Local draft, comparison and recovery | Tested / partial | In-memory synthetic draft, patch comparison, encrypted download, invalid-format error, unlock preview and restore. No disk save/apply, stale/conflicting disk recovery or native handoff was attempted. |
| Changes / current Git consent and review | Tested | Working-tree patch and evidence links on disposable repository; read-only consent. No fetch/push/commit operation. |
| Git history graph / commit details | Tested / partial | Genuine disposable two-branch/two-commit history, parent patch and file/action links. Remote/upstream/ahead-behind, merge-heavy graph and huge commit history untested. |
| Toolbox / native inventory / MCP / agent drawers | Tested / partial | Window open/close, server drawer, one-agent drawer, recorded-tool search and persistence through resize. Multi-agent active hierarchy and every trail jump were not exercised. |
| Prompt overview / rail / replay | Tested / partial | Prompt opening, replay enter/seek/step/pause, follow/return to latest and reading interference. Every interruption timing and long replay run untested. |
| Search / palette / Commands | Tested | Scope, input focus, empty result, direct links, outcome filter, Ctrl+K and sampled Escape/outside dismissal. |
| Notes / review insights / packets | Tested / partial | Empty Notes, finding members/pagination, packet selection and preview. File export delivery and a substantial authored note workflow were not exercised. |
| Screen window / filmstrip | Tested | Genuine frames/failures, next/previous, retained source, window/full-window, close/reopen and 600px allocation. Passing and failing held-frame cases recorded separately above. |
| Native composer / send / waiting / stop | Tested | Only UI-owned disposable Codex/Claude sessions resumed; exact short reply, harmless delay/stop, question, read-only output and node:test. Native defaults preserved; no active turn remains. |
| Attachments | Tested / partial | Synthetic text attachment pick/preview/remove and whole-batch 33-file rejection; no attachment submitted. Paste/folder/image/6MiB-boundary variants untested. |
| Model / effort / connection menus | Tested / partial | Explicit Read native settings, arriving inventory, model/effort popup observation and permissions. No model-switch execution or policy change. |
| Settings categories / seven palettes | Tested | Appearance, Reading, Privacy, Keyboard, Playback, map/resource/motion/notification settings observed; principal visually checked seven palettes with genuine material at 1440. Not every setting was changed. |
| Clarity variation | Partial | Route and shared main/Appearance surfaces inspected, then returned to Modern. Unfinished variation not certified. |
| Keyboard / focus / dismissal | Partial | B's sampled focus/Escape/Ctrl+K plus principal keyboard resizers; file-history focus exception retained. No screen-reader or exhaustive tab-order audit. |
| Width / zoom / performance | Partial | 600, 1024, 1440 and 1920 desktop widths; principal 1920×1080. CSS zoom 125% proxy checked, **not actual browser zoom/DPI**. No phone tests, physical low-resource machine, frame-budget trace or human ten-minute acceptance study. |

## Method, palettes and completion limits

Skill identifiers: **emil-design-eng** (installed local, unversioned); **Impeccable 4.8.0**, including critique/audit/Operate references; **Taste 2.5.0**; **review-animations** (installed local, unversioned). Source files were the explicitly supplied user-level `SKILL.md` installations. The Impeccable launcher/detector absence described above remains an actual exception; no automated detector report was fabricated.

The principal reviewer visually inspected JetBlack, Midnight, Daylight, Orchid, Royal, Emerald and Ember with genuine expanded material and prose. Layout/semantic treatment remained coherent in that sample. Assessment B's all-palette Settings contrast sample is narrower than a whole-product contrast claim; P34's native popup observation remains separate. B's resolved false positives and limited clean functional checks are preserved above rather than converted into a blanket accessibility pass.

Supporting local screenshots include `assessment-a-*`, `theme-{palette}.png`, the two Screen images and `captured-step-select-native-popup.png`. They are not embedded because they contain real local-session material. No private prompts/titles/path excerpts, journals, credentials or screenshot bytes are published in this report.

The final deliverable contains **33 detailed component score rows**, **8 developer-job scores**, **6 presentation-dimension scores**, **12 coherent product recommendations**, **43 retained granular refinement recommendations**, **14 use-case surface families**, and **32 nested coverage rows**. These counts describe documentation coverage, not exhaustive state certification. The principal browser is closed; both UI-owned native continuations were completed/stopped, with no turn left running. This is a completed review deliverable, with the limitations above, not a declaration that the product meets the premium bar.
