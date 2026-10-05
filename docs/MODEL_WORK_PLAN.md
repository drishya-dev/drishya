# Remaining work and Sol/Terra task routing

**Assessment: 5 October 2026, after merged PR #20 (`ca32a2a`).** This is a task-routing and handoff guide, not a new product specification. [VISION](VISION.md), [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md), [IMPLEMENTATION_ROADMAP](IMPLEMENTATION_ROADMAP.md) and [AGENTS](../AGENTS.md) retain their authority. Subphase labels below divide the existing roadmap for execution; they do not approve proposed features or schema changes.

## 1. Recommendation and current baseline

Keep **Sol for architecture, premium visual work, evidence correctness and difficult debugging**. Use **Terra for bounded implementation and maintenance after the relevant architecture and acceptance criteria exist**. Switch at a completed task/PR boundary, not midway through an unresolved migration. The goal is less rework and lower total effort, not simply the cheapest individual response.

Here, **Sol means the Sol version the builder selects**, and **Terra means GPT-5.6 Terra**. This document does not change app settings or silently replace either with another model. Reasoning-effort recommendations are starting points, not a guarantee of equal quality or speed.

Official OpenAI guidance describes Sol as suitable for complex technical work and connected visual deliverables, and recommends comparing models on actual tasks. Terra's official page describes it as balancing intelligence and cost. These sources do **not** establish how either performs on Drishya or guarantee that Terra will finish faster or use fewer account limits. The assignments below are engineering judgment based on coupling, ambiguity and consequences of errors. Validate Terra on a small representative task before assigning a larger batch. [Model selection](https://developers.openai.com/api/docs/guides/model-selection), [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

**Already built/accepted:** B0 privacy, B1 capture/recovery, B2 identity/historical evidence and B3 integrated live history. Claude Code and Codex local-journal adapters, sanitized persistence, local API/SSE, artifact paging, session choice, search/navigation, optional replay and a basic map work. PR #20 adds input-before-result presentation, in-place expansion for more tools, burst camera staging and corrected replay dwell. Its baseline passed 196 tests and seven synthetic browser tests; the real-session browser journey was not run in that slice.

**Still substantial:** the base visual system is not the intended final product. The map is Canvas 2D, syntax highlighting is rule-based, repository import extraction is rule-based, and the browser still consumes a full projection. B4 remains open: 100k live updates and valid 1 GiB imports failed the intended latency/memory expectations. Installation probes have passed, but do not certify a public release.

There are approximately **five substantial core workstreams** left: premium presentation/readers, repository mapping, review utility, long-session architecture, and storage/release hardening. Later integrations and sharing add separate work. This is not a percentage-complete estimate: the existing foundation removes much basic plumbing, but the remaining work contains the product's hardest experience and scaling decisions.

## 2. Phase map

| Subphase | Result | Sol's responsibility | Terra's suitable follow-up | Status/order |
|---|---|---|---|---|
| P1-A | Stable presentation/reader/data boundaries | Design composition, state and interruptible transition ownership | Explicitly specified controls, small fixtures, docs | Next |
| P1-B | Proper content-shaped input/output and source readers | Reader integration, diffs, streaming truth, focus/anchor behavior | Well-scoped renderer cases and reader controls | After P1-A |
| P1-C | Useful and accurate repository map | Extraction/resolution, working-set layout, DOM/GPU anchors | Compatibility fixtures and documented resolver cases | Alongside P1-B in small slices |
| P1-D | Premium motion that remains calm under bursts | Lift/Emit/Settle/Surface/Resolve and visual tuning | Test scenarios, settled copy, configuration wiring | After semantic layouts work |
| P2-A | Return-to-work and explicit reading progress | Stable boundaries, deterministic digest and revision handling | Bounded progress persistence and approved list UI | First utility slice; can precede full P1 polish |
| P2-B | File history and honest verification context | Identity/version lineage, freshness rules, evidence matching | Implement already-defined rules and fixtures | After core evidence decisions |
| B4-A | Bounded long-session capture and presentation | Paged projection, incremental/worker ownership, migration | Benchmark harness/reporting, bounded endpoints after contract approval | Deferred by builder; before broad release |
| B4-B | Understandable disk use and safe cleanup | Retention/ref-counting/concurrency and recovery semantics | Disk-usage UI, help, recovery probes | Before broad release |
| R1 | Accessible, tested, installable product candidate | Final trust/performance review and difficult defects | Release scripts, compatibility matrix, docs, pilot administration | After relevant gates |
| E1+ | More harnesses, selected packets and optional integrations | First adapter/security design, export lineage, new evidence semantics | Repeated adapter cases after one vertical slice | Later, by user demand |

Subphases are reviewable PR sequences, not one large rewrite. Keep B4 deferred as the builder requested. P1-A should preserve a replaceable data boundary now; implementing a worker/paging migration is a later distinct task.

## 3. P1-A — establish the product's presentation foundation

**User outcome:** the screen remains understandable at different widths and while reading old work. Every action has a stable home, and new arrivals do not destroy the user's place.

Define semantic states before animations: requested, running, resolved, failed, unavailable; current versus historical material; selected versus expanded; following versus reading. Preserve the composition: agents top, map behind, actions left to right, prose beneath unboxed, tools/MCP right, history down. The layout should measure actual content and available space rather than forcing every action into the same fixed-height card.

Separate captured state, reading state and transient visual state. A motion overlay may explain an arrival, but cannot reorder evidence, delay capture, own selection or control artifact availability. Components request material through the existing source boundary; avoid new dependencies on the complete projection being permanently resident. Specify the bounded views a future paged implementation will need without changing the event schema unilaterally.

Cover long prose, mixed agents, narrow windows, missing origins, errors and late results. Preserve selectable DOM text, keyboard focus, scroll anchors and reduced-motion meaning. PR #20 is the pacing baseline, not the finished choreography.

**Sol:** medium/high for implementation, high for interaction decisions. **Terra:** named controls or fixture cases after state rules are settled. **Exit:** static frames are readable, navigation interrupts presentation immediately, and the same composition works with map/motion disabled.

## 4. P1-B — content-shaped input/output and full reading

**User outcome:** see exactly what the agent supplied and received without reconstructing it from tool names or opening unrelated panels.

Build proper read slices, aligned edits, search hits, command/output fields, test outcomes and MCP argument/result compositions. The same operation retains its input while a captured result joins it. Real chunk boundaries may update output when supported; final-only capture resolves once. Missing content and protected content stay explicit. Distinguish an intended edit from successful execution and an available reconstructed after-state.

Integrate CodeMirror 6 where it improves bounded, read-only source/diff reading. Preserve existing artifact paging and byte-budgeted caches; do not load whole files merely to initialize a reader. Resolve horizontal scrolling, wrapping, line selections, copy with range context, resize, expandable material and reader state across live refreshes. Large JSON and shell outputs need appropriate reading modes rather than tiny clipped text.

**Sol:** initial readers/diff integration and all anchor/focus/replay interactions. **Terra:** a specific renderer branch, a known tool-result shape or a small control with a settled contract. **Exit:** actual input and captured output can be inspected together, pages/caches remain bounded, and reading survives live updates. Full MCP result retrieval beyond the current projection preview needs deliberate data-access design; do not relabel previews as full results.

## 5. P1-C — accurate map and repository relationships

**User outcome:** a file appears from a meaningful location, and connections help the user understand the relevant repository area.

Replace rule-based import extraction with a scoped tree-sitter extractor where justified. Preserve and validate resolution rules: TypeScript/JavaScript extensions, aliases and package boundaries; Python relative imports/packages; unresolved/dynamic cases. An AST alone does not resolve a dependency. Verify relationships against representative repositories and report uncertainty instead of inventing runtime or database flow.

Build a bounded working set around observed files, with clustering/expansion for large repositories. Keep positions stable while the reader inspects content. A current approved repository index must remain labelled current; it is not the repository as it existed at an old step. Respect approval, denied paths and explicit freshness refresh.

Introduce PixiJS if measured map requirements justify replacing Canvas 2D. GPU geometry, DOM labels and content-origin anchors must agree during pan/zoom/resize. Avoid idle rendering loops and unbounded nodes. The planned stack is a direction, not a requirement to add every library before proving value.

**Sol:** resolver semantics, graph layout/performance, coordinate-system integration. **Terra:** isolated import fixtures and already-defined resolution cases. **Exit:** inspected edges are accurate, unresolved references stay unresolved, file lifts have honest origins, and map-off keeps every reading task usable.

## 6. P1-D — the five signature moves and useful pacing

**User outcome:** polished movement communicates what happened and where it came from, while the settled scene remains calm.

Implement Lift from a file's actual node; Emit from the relevant tool or MCP drawer; Settle with readable earlier work; Surface for whole unboxed prose; Resolve for the actual returned result/outcome. Establish the final layout first, then bridge origin to destination with interruptible transforms/opacity. When the origin is offscreen or unknown, use an attributed edge indicator or unresolved state.

Craft selection, hover/focus, copy acknowledgment, expansion, tool filtering and return-to-latest. Coordinate shared anchors and prevent competing transitions. Burst handling must coalesce visual emphasis rather than queue a long movie; all evidence stays available. Optional replay uses reading dwell independently of animation duration. Low-resource/reduced-motion modes preserve meaning.

**Sol:** creative and interaction implementation throughout, matching the builder's preference. **Terra:** documented settings or test-matrix updates; visual/interaction changes return to Sol. **Exit:** freeze, truth and ten-minute reading checks; keyboard and reduced-motion parity; measured scroll/selection response under bursts. A beautiful short demo alone is insufficient.

## 7. P2-A — since the last visit and reading continuity

**User outcome:** return after an agent ran unattended and find the relevant new edits, outcomes, unfinished work and capture gaps quickly.

Store a local reading boundary using stable item identity and recording revision. Opening the app does not prove the user reviewed everything. Allow an explicit mark-through action and retain the previous boundary until acknowledged. New or late-arriving observations require deliberate rules so an array offset cannot silently skip them. Re-import/replacement and combined sessions need explicit boundary behavior.

Build a deterministic, evidence-linked return view alongside full history. No model is required for the first digest. Explain precisely what is new, not what is supposedly important or safe. Add explicit reviewed marks only if the builders accept proposal K; viewed and reviewed remain separate concepts.

**Sol:** boundary semantics, late-data behavior, deterministic selection of facts. **Terra:** implement persistence/list rendering after those contracts and failure cases are written. **Exit:** return navigation reaches the right evidence after restart/reconnect, new work is not silently acknowledged, and users find changes faster than in raw transcripts.

## 8. P2-B — file history, verification freshness and review evidence

**User outcome:** understand how a file changed and what verification actually happened around those changes.

Extend existing per-file navigation into available captured state history: as read, intended edit, successful edit, captured/reconstructed after-state and optional approved current state. Keep worktree identity and provenance visible. Some sessions cannot support complete reconstruction; that is a supported unavailable outcome.

Show test executions relative to edits with literal wording: a recorded run predates a later edit, a command failed, or test scope/revision is unknown. A later pass alone does not establish coverage. Link agent claims through explicit references and inspectable candidate relationships; do not convert temporal proximity into causality.

Proposals H–K (changed-line origin, git/PR links, review flags and explicit reviewed marks) remain proposals until accepted. If chosen, start with evidence-supported matching and literal rule flags. Read-only git association and uncertain line lineage are substantial engineering tasks, not routine metadata labels.

**Sol:** evidence model, lineage/matching, freshness semantics and ambiguous cases. **Terra:** concrete rules after the evidence contract exists, small evidence-linked lists and new synthetic regression cases. **Exit:** correct attribution across worktrees/late results, no false coverage or authorship claims, and a pilot shows improved review comprehension.

## 9. B4-A — long-session architecture, deferred until the chosen milestone

**User outcome:** lengthy sessions remain responsive without process memory growing with every retained artifact and timeline item.

The failure is not only initial load. Each live addition currently rebuilds/transfers a full projection and the browser composes it on its main thread. A valid 1 GiB journal approached 2 GiB RSS. Existing virtualized DOM and material caches do not fix this metadata/CPU path.

Design disk-backed history indexes and paged/windowed data access while retaining full-history search and stable evidence identity. Decide which reductions are incremental and which derived relationships need bounded recomputation. Define revisioned windows, stale responses, cancellation and reconnect reconciliation. Move heavy reduction/composition behind appropriate worker boundaries, with one explicit owner for SQLite writes, lifecycle, shutdown and recovery. Design migration/rebuild behavior for existing local stores before changing durable representations.

Implement in small vertical slices with the same reader and source boundary, preserving optional as-of replay and combined-session navigation. Schema changes still require both builders. Repeat valid-source, 100k live burst, peak-resource and interaction measurements on normal and low-resource hardware.

**Sol:** design and core implementation throughout; Terra should not own the migration. **Terra:** benchmark scripts/reports, platform checks and endpoints after approved semantics. **Exit:** measured gates in roadmap §7 pass without lost events, damaged history, unbounded memory or blocked reader interaction. Keep the present deferral; this guide is not an instruction to start B4 now.

## 10. B4-B and R1 — storage, release and the actual user experience

**Storage outcome:** the user can see disk use and remove chosen recordings safely. Define artifact/blob ownership, shared references, partial cleanup, concurrent live ingest, interrupted deletion and restart behavior. Decide retention policy explicitly; the proposed 10 GiB budget is not an implemented automatic-deletion contract. Sol handles lifecycle semantics; Terra can build usage/help surfaces and execute scoped recovery probes afterward.

**Release outcome:** a developer can install, choose their real local session, use the app offline, recover from errors, update and uninstall with clear data-retention behavior. Packed install checks already pass on three platforms; finish the supported real-harness/platform matrix and resource claims. Implement compatibility/capability reporting, accessible focus/contrast/navigation, useful error states and release/version/provenance procedures. Sol reviews trust, unexpected failures and cross-cutting accessibility defects. Terra is suitable for deterministic packaging/CI steps, docs, supported-version tables, small error/copy fixes and test execution/reporting.

**Pilot and marketing:** compare review tasks against raw transcripts using consented observations. Find what users misunderstand before adding effects/features. Terra can prepare tasks, anonymized result tables, install guides and factual landing-page copy. Sol should interpret conflicting findings, choose product changes and create the premium demo/visual direction. Pilot targets in PRODUCT_DIRECTION are hypotheses, not advertised evidence. Publication remains a separate authorized release action.

**Exit:** supported machines meet declared scope, privacy/recovery/performance checks pass, observed users correctly understand evidence, and release material describes only supported behavior. Release work can reveal difficult defects; “last phase” does not automatically mean light work.

## 11. E1+ — later integrations and optional features

For each new harness, verify its source/capability/privacy boundary, build a synthetic compatibility corpus, then one read→edit→test vertical journey. Sol designs the first integration; Terra can add repetitive, well-specified record cases afterward. Return to Sol for source lifecycle changes, unknown structures or gaps that affect identity/provenance.

Consumer ChatGPT/Claude sessions are separate research/import tracks; do not promise live repository actions from message-only data. Selected review packets need exact artifact closure, redaction and offline-reader semantics; Sol owns the trust design. Git/editor entry points need accepted scope and honest candidate matching. Optional remote explanation needs the existing exact-payload consent boundary and separate service validation. It is not necessary for the core product and not automatic permission to send real recordings. Theme variants follow the stable semantic system and usefulness evidence.

## 12. Practical switching rules

Use **Sol high** for cross-package design, source identity, privacy, migrations, race conditions, historical truth, graph resolution and unclear failures. Use **Sol medium/high** for normal feature implementation. Raise effort only when ambiguity warrants it; model strength does not replace concrete requirements or checking results.

Use **Terra medium** for clear, bounded tasks with existing patterns and inspectable outputs; **Terra high** for modest implementation that still has clear acceptance cases. If a task needs max reasoning merely to recover an unclear architecture, return it to Sol rather than assuming more effort removes all model differences.

A Terra task should state: the exact outcome; files/boundaries allowed to change; existing pattern to follow; evidence/privacy constraints; cases to handle; commands to verify; and the expected handoff. Example: “Add the agreed disk-usage display using the existing read-only usage API. Show loading/unavailable/empty states; retain keyboard focus. Do not change cleanup policy. Verify typecheck and the specific usage UI journey.” Designing the usage API and cleanup policy is a separate Sol task.

Return to Sol when the task requires a new schema, state ownership, migration, unverified causal/coverage inference, visual system change, unexplained nondeterminism, or repeated failed fixes without a supported cause. Do not let repeated patches accumulate into an accidental architecture rewrite.

Before a switch, finish the bounded task, record the implementation/decision/tests/limitations and next task in STATUS/CONTINUITY, remove the claim, and create a reviewable commit/PR under the repo rules. A model switch is safe with a clean handoff; changing models alone does not erase the project vision because these docs persist.

## 13. Recommended next allocation

Continue with Sol on **P1-A and the first P1-B vertical slice**: one real read→edit→test passage with content-shaped input/output, bounded reader expansion, stable origins and interrupted live follow. Then Sol establishes P1-C's verified graph/anchor behavior and P1-D's choreography. Bring forward the narrow P2-A return-to-work design if the builders choose to validate utility before all motion polish. Terra can handle fixture growth, specified controls, routine CI/docs and bounded implementation between those Sol tasks.

Keep **B4-A deferred**, but reserve Sol for it before broad release. Use Sol for the P2 evidence rules and B4-B cleanup semantics. Once these major boundaries are established, Terra can own a much larger share of routine implementation, regression maintenance and release preparation. There is no need to wait until the whole product is complete to use Terra, and there is no point at which every future integration becomes automatically light.
