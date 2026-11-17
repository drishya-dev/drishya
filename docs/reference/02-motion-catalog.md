# Reference 02 — Presentation & Motion Catalog

> **Latest user-directed composition:** [Continuous canvas](04-continuous-canvas.md) governs retention and layout: left-to-right tool passages accumulate; emitted prose flows unboxed below; history continues downward. Agents are above, tool/MCP origins are on the right, and the repository map remains interactive behind. Do not use the per-event recipes below to create a single replacing panel or a uniform grid of cards.

> **21 September amendments:** The [experience specification](../PRODUCT_WORK_HISTORY_REVIEW_NOTES.md#02-experience-spec) supersedes conflicting choreography below. Show available text intact, preserve navigation, distinguish structural/access/temporal edges, and never infer causality from sequence. Critical bursts may group visibly while each event remains retrievable. Reading/selection pauses advancement; pointer movement alone does not. Approval holds are scoped to the affected agent. Historical source availability is explicit.

The deliverable requested in base prompt §2.7: for every action an observed agent can take, what it shows, how it appears, how it animates, what drill-down reveals, and how it degrades.

**One entry per action type.** Each entry is written so it can be built without further design input.

---

## 0. The shared grammar

Everything below is composed from these primitives. Learn these and each entry reads as a short recipe.

### 0.1 Timing tokens

| Token | ms | Used for |
|---|---|---|
| `instant` | 90 | Efficient-mode cross-fades, cancels |
| `quick` | 160 | Surface enters, small reveals |
| `base` | 260 | Standard transitions, demotions, dissolves |
| `considered` | 400 | Drill-down expansions, Reader summon |
| `cinematic` | 700 | Terrain camera only |

Easing: `enter` = `cubic-bezier(.16,1,.3,1)` (decelerate hard). `exit` = `cubic-bezier(.4,0,1,1)`. `move` = `cubic-bezier(.4,0,.2,1)`. **Nothing exceeds 700 ms. Everything exposes `cancel()`.**

### 0.2 Surface lifecycle

Every Stage surface follows the same four phases:

```
EMERGE   quick     opacity 0→1, scale .96→1, y +8→0, blur 4→0
HOLD     dwell     (computed by the pacing engine, blueprint §9.2)
DEMOTE   base      scale 1→.92, opacity 1→.5, blur 0→2, z −1
DISSOLVE base      opacity .5→0, blur 2→8      (→ remains on the Rail)
```

A surface never simply disappears. `DISSOLVE` is a transfer of the moment to the Rail, not a deletion — the base prompt's "dissolve rather than vanish, while remaining recoverable".

### 0.3 The four motion verbs

Every animation is one of four, and each means something specific:

| Verb | Motion | Means |
|---|---|---|
| **Lift** | Content unfolds out of its own Terrain node and rises to the Stage, tethered to its origin | *This came from there.* **The signature move** — §0.6 |
| **Trace** | A luminous head travels an existing Terrain edge, leaving a fading tail | Causality moved along a real structural relationship |
| **Bloom** | A node brightens from centre with a soft radial falloff, then settles to a raised resting state | Attention arrived here |
| **Fracture** | A short, sharp, asymmetric displacement with a hard edge | Something broke |

There is no fifth verb. If a new action type seems to need one, it is one of these four with different parameters.

### 0.6 Lift — the signature move, specified

Blueprint §7.4 makes the case for why this matters. This is how it is built.

**The rule: content never fades in at the centre of the screen. It comes out of the map.**

```
LIFT   considered 400ms, split into three overlapping stages

  0–120ms   ORIGIN    the source node Blooms; its silhouette elongates
                      toward the Stage anchor; everything else dims 12%
  80–320ms  UNFOLD    a surface grows from the node's screen position
                      toward the Stage anchor — scale .3→1 anchored at
                      the ORIGIN end, not the centre, so it reads as
                      unfolding rather than zooming.
                      Content cross-fades in over the last 140ms,
                      never stretched during the transform
 280–400ms  SETTLE    surface reaches the Stage anchor; a 1px tether
                      at 25% opacity remains, node↔surface, for the
                      surface's lifetime
```

**Return.** On dismiss the surface reverses into its node over `base` 260 ms. Content cross-fades out first so text is never seen distorting.

**Implementation notes that matter:**

- **Transform only.** Animate `transform` and `opacity`. Never animate width/height/top/left — that is layout thrash and it will cost the 60 fps budget.
- **Content is not scaled.** The surface's *frame* transforms; the content inside fades in at final size during `SETTLE`. Scaled text is the single fastest way to look cheap, and it is the difference the `$10`-versus-`$1,000` comparison is about.
- **The tether is one line, not a beam.** 1 px, 25% opacity, catenary curve. It is a fact, not an effect.
- **Off-screen origin:** when the source node is outside the viewport, Lift starts from the viewport edge nearest the node's true position, and a small directional mark on that edge indicates where it actually lives. Do not move the camera to make Lift work — a camera move on every read would be unbearable.
- **Unknown origin:** if the action cannot be resolved to a node above 0.6 confidence (event schema `terrain.confidence`), **do not fake an origin.** The surface uses a plain `EMERGE` from the Stage anchor, with no tether. An honest fade beats a lie about location (§17.2).

**Degradation**

| Tier | Behaviour |
|---|---|
| **Cinematic** | Full three-stage Lift with tether |
| **Balanced** | Two stages — UNFOLD and SETTLE merged, 260 ms. Tether kept |
| **Efficient** | Surface appears at the Stage anchor. **The origin node still highlights**, and a static tether is drawn. The information survives; the motion does not |
| **Reduced motion** | Identical to Efficient — the tether and node highlight carry the "this came from there" meaning with zero movement |
| **Screen reader** | Origin is spoken as part of the announcement: "Read `auth/session.py` — in cluster Authentication." |

That degradation table is the test of whether the mechanic is real: **if Lift only conveys its meaning when animated, it is decoration.** It conveys it through the tether and the node highlight too, which is why it survives reduced motion intact.

### 0.4 The agent presence

Each active agent is a small, calm luminous form on the Terrain at the centroid of its current cluster — not an avatar, not an icon, not a box. Its hue is the agent's identity color. Beats emanate from it and return to it.

- **Parallel Beat** (`PostToolBatch`): all Pulses fan out simultaneously, radially, from the presence.
- **Sequential Beats**: Pulses chain, each starting as the previous settles.

This distinction is available in the data (blueprint §8) and rendering it faithfully is what makes the visualization *true* rather than decorative.

### 0.5 Reading the degradation columns

Every entry specifies three fallbacks, because base prompt §2.7 requires them and because these are designed states, not broken ones:

- **Efficient** — Terrain static at L0, no blur (opaque scrims preserve the 4.5:1 contrast floor), transitions become `instant` cross-fades, Stage occupancy 1.
- **Reduced motion** — honours OS `prefers-reduced-motion`. No travel, no parallax, no particles. State changes are opacity and color only. **All information is preserved**; only movement is removed.
- **Screen reader** — the announcement string. The run is navigable as a list of landmarks.

---

## 1. File read

| | |
|---|---|
| **Shows** | The file's name and range as a header; the actual read region, syntax-highlighted, capped at 40 visible lines with a soft fade at the boundary |
| **Terrain** | A **Trace** runs from the agent presence to the file's node along the dependency edge, if one exists; otherwise a direct arc. The node then **Blooms** and becomes the Lift origin |
| **Enter** | **Lift** (§0.6) — the source rises out of its own node. Code lines then stagger in at 12 ms intervals, top to bottom, capped at 300 ms total — a *suggestion* of reading order, not a typewriter |
| **Drill-down** | Click expands to the full read range in place. `R` summons the **Reader** with the whole file, the agent's region highlighted and scrolled to. The rest of the file is dimmed to 60% so the read region stays the subject |
| **Coalescing** | ≥3 reads in one cluster → **Beat Stack**: `6 reads · src/auth · 340 lines`, rendered as a fanned stack of 3 card edges. Click fans fully; each card retains its own range and provenance |
| **Provenance** | Captured. Content from the transcript's `tool_result`, or from `tool-results/*.json` when spilled |
| **Efficient** | Static card, no stagger, no trace. Node color changes only |
| **Reduced motion** | Surface cross-fades. Node changes color. No trace |
| **Screen reader** | "Read `auth/session.py`, lines 40 to 90, 51 lines." |

**Why the fade rather than a scrollbar:** a scrollbar implies a container, and containers are boxes. The fade says "there is more" without building a permanent frame.

---

## 2. Search — text, file, and semantic

The base prompt specifies this one precisely (§2.2b): a small dynamic window, the query typing out, results appearing cleanly below, all text readable, results linking into the Reader.

| | |
|---|---|
| **Shows** | A narrow query bar; the query **types out at 28 ms/char, capped at 600 ms total** (long queries accelerate rather than overrun); then results as a list of `path:line` with one line of matched context each, match term highlighted |
| **Terrain** | Every cluster containing a hit receives a low-intensity **Bloom** — the "where in the system did this land" signal. Clusters with no hits dim by 15%, which reads as the search *narrowing* the world |
| **Enter** | Query bar `EMERGE` `quick`. Typing. 120 ms pause. Results stagger in at 20 ms intervals, capped at 8 visible with `+N more` |
| **Drill-down** | Click a result → **Reader** opens at that file and line, match highlighted. The result list stays on Stage so the user can walk results without losing their place — this is the difference between a search UI and a search *log* |
| **Semantic search** | Identical, plus a relevance bar per result. Where the harness or an MCP retrieval tool exposes a rank or a reason, show it — that is a captured "why did it look here" signal, and it is rare enough to be worth surfacing wherever it exists |
| **Coalescing** | Consecutive searches collapse to `3 searches` with queries listed; expanding replays each |
| **Efficient** | Query appears instantly, complete. Results as a plain static list |
| **Reduced motion** | **No typing animation** — query appears whole. Results fade in together |
| **Screen reader** | "Searched for 'session_expiry'. 7 results in 4 files." |

**On the typing animation:** it is doing real work, not decoration — it establishes that *the agent* formed this query, and it buys the eye ~600 ms to arrive before results land. It is also the first thing to remove under reduced motion, because that purpose is served by a static query too.

---

## 3. File edit / write

| | |
|---|---|
| **Shows** | The diff. Unified by default, with changed lines full-contrast and 3 lines of context at 55%. Additions warm, deletions desaturated-and-struck. The file path and hunk range as a header |
| **Terrain** | The node **Blooms** warm and **stays raised** — edits leave a persistent mark for the rest of the run. A **Trace** runs outward along every outgoing dependency edge, one hop, at 30% intensity: this is **blast radius**, and it is Moment 3 |
| **Enter** | **Lift** from the edited file's node, then added lines sweep in left-to-right over 200 ms while removed lines fade to 40% and compress vertically. The sweep direction encodes "this is new" without a label |
| **Drill-down** | Click → full hunk with expanded context. `R` → **Reader** with the whole file post-edit, changed regions marked in the gutter, **and a before/after toggle built from `file-history/*.snapshot.N`** `[V]` — real pre-edit bytes, not a reconstruction |
| **Coalescing** | **Edits never coalesce.** Every edit gets its own moment at every γ (blueprint §9.8 hard invariant) |
| **Provenance** | Captured. `tool_input` for intent, `file-history` snapshot for the true prior state, `FileChanged` hook for disk confirmation |
| **Efficient** | Static diff card. Node color change, no blast-radius trace |
| **Reduced motion** | Diff appears complete. No sweep. Node color only |
| **Screen reader** | "Edited `auth/session.py`, 1 hunk, 4 added, 1 removed." |

---

## 4. Bash command

| | |
|---|---|
| **Shows** | The command in mono on a single line, prefixed with a `$` glyph. Output streams below in a monospace block, capped at 20 visible lines, newest at the bottom. Exit status as a small trailing mark |
| **Terrain** | If the command maps to a known node (a test file, a build target, a script), that node **Blooms**. If not, the agent presence pulses once and Terrain stays quiet. **Do not invent a location** — a false light is worse than no light |
| **Enter** | Command types out at 18 ms/char, capped at 400 ms. Output lines append at natural arrival rate, or at 40 ms intervals when replayed faster than real time |
| **Exit** | `0` → a thin success rule sweeps under the block, `quick`. Non-zero → **Fracture** on the status mark, and the block border goes red. This is one of only two places saturated red appears |
| **Drill-down** | Click → expands to 60 lines. `R` → **Reader** with complete output, `tool-results/*.json` when the transcript truncated it `[V]` |
| **Long output** | Above 500 lines the Stage shows head 10 + `⋯ 1,240 lines ⋯` + tail 10. The middle is never silently dropped — the count is always stated |
| **Efficient** | Command and output appear complete, static |
| **Reduced motion** | No typing, no streaming. Complete block, fade in |
| **Screen reader** | "Ran `pytest tests/test_auth.py`. Exit code 1. 12 lines of output." |

---

## 5. Test run

A bash command with a schema on top of it, and it earns special treatment because tests are the verification loop the product exists to show closing.

| | |
|---|---|
| **Shows** | A compact result bar — `14 passed · 1 failed · 0 skipped` — with the failing test names and their assertion text. Passing tests are a count, never a list |
| **Terrain** | **Pass:** a **Trace** travels from the test node to the node under test and **closes a loop** — the verification loop visibly closing. **Fail:** a **Fracture** at the test node, then a Trace travels to the node under test and marks it, which persists |
| **Enter** | Result bar `EMERGE`. The pass/fail counts count up over 300 ms. Failures expand below after a 200 ms beat |
| **Drill-down** | Click a failure → assertion, expected vs actual, and the traceback. `R` → **Reader** at the failing test source **and** the implicated source, scrolled to the frame |
| **The important link** | A failure records a causal edge to the next edit that touches the implicated node. **This is what makes Moment 2 answerable** — clicking an edit can walk back to the failure that caused it |
| **Coalescing** | Never. Test results are salience 0.85 |
| **Efficient** | Static result bar, no counting, no traces |
| **Reduced motion** | Counts appear final. Node colors change, no travel |
| **Screen reader** | "Tests: 14 passed, 1 failed. Failing: `test_session_expiry_returns_none`." |

---

## 6. Git operation

| | |
|---|---|
| **Shows** | Operation and target — `commit 3 files`, `checkout feature/auth`, `stash`. For commits, the message and the file list. For branch changes, the branch names |
| **Terrain** | A **branch change is the only event allowed to move the camera** — a `cinematic` 700 ms ease to the new branch's activity centroid, because the world genuinely changed. Committed files get a brief unified **Bloom** |
| **Enter** | `EMERGE`. File list staggers at 30 ms |
| **Drill-down** | Click → full commit diff across files. `R` → Reader per file |
| **Status/diff reads** | Treated as a bash command (§4), not a git operation — they do not change the world |
| **Efficient** | Static, no camera move |
| **Reduced motion** | **No camera move** — the Terrain cuts, with a 400 ms label naming the new branch |
| **Screen reader** | "Committed 3 files to `feature/auth`: 'Fix session expiry handling'." |

---

## 7. Plan / to-do update

| | |
|---|---|
| **Shows** | The checklist. Completed items at 50% with a strike, the current item full-contrast and marked, pending at 70%. Only the current item and its two neighbours are shown unless expanded |
| **Terrain** | No Terrain change — a plan is about intent, not location. The **Rail** receives a distinct checkpoint glyph |
| **Enter** | The changed item transitions in place: `considered` 400 ms, with the completed item's mark drawing itself over 200 ms. Other items do not re-animate |
| **Drill-down** | Click → the full plan with timestamps per item. Clicking an item seeks the Rail to the moment it changed — **the plan becomes a navigation device**, which is the point |
| **Source** | `TaskCreated` / `TaskCompleted` hooks; `~/.claude/plans/<id>.md` `[V]` |
| **Efficient** | Static list |
| **Reduced motion** | Item changes color and strike appears complete |
| **Screen reader** | "Plan updated. Completed: 'Locate session expiry logic'. Now: 'Add null guard'." |

---

## 8. Thinking / reasoning text

Governed by the trust rule (blueprint §12). **Never fabricated, never inferred, never dramatised.**

| | |
|---|---|
| **Shows** | The captured `thinking` block as prose on a wider, quieter surface than action cards — larger line height, lower contrast, no mono, no border. It should read as a *different kind of thing* than a tool result |
| **Terrain** | Terrain **recedes**: global dim by 20% and blur +2 over 400 ms. Nothing lights. Attention is entirely on the text |
| **Enter** | `EMERGE` slower than standard — 400 ms — with a paragraph-level stagger at 80 ms. Never character-by-character: this is not a performance of thinking, it is a record of it |
| **Drill-down** | Click expands to full text if truncated. Long thinking scrolls in place; no Reader needed |
| **Provenance** | **Captured** — solid edge — only when the harness provides a real `thinking` block `[V]`. When the harness provides nothing, this entry does not render at all. **A derived "what it was probably thinking" surface is never shown here** — derived summaries appear only as Pulse titles, dashed, per §12 |
| **Row rule** | This event **terminates the Row** (blueprint §8). The preceding Beats visibly settle and dim as it enters — the visual statement that "those actions led to this thought" |
| **Efficient** | Static text, no Terrain dim |
| **Reduced motion** | Text appears whole. Terrain dims without blur |
| **Screen reader** | "Agent reasoning: [full text]." |

---

## 9. Assistant message

| | |
|---|---|
| **Shows** | The message text, rendered as prose with markdown honoured. Visually distinct from thinking: full contrast, tighter leading, the agent's identity hue on the left edge |
| **Terrain** | Unchanged. Messages are addressed to the user, not to the codebase |
| **Enter** | `EMERGE` `base`, paragraph stagger 60 ms |
| **Drill-down** | Click → the conversation view, **read-only** (base prompt §2.5 and §4): the observed session's messages, navigable turn-wise or conversation-wise. Drishya never offers an input |
| **Row rule** | Terminates the Row, as §8 |
| **Efficient / Reduced motion** | Static text |
| **Screen reader** | "Agent message: [text]." |

---

## 10. Web search / fetch

| | |
|---|---|
| **Shows** | The query or URL; results as title + domain + one line. Fetched pages show the title and an extracted summary of what was used |
| **Terrain** | **The agent presence moves to the Terrain's edge** and a faint outbound arc leaves the frame. This is the only "outside the system" gesture in the product, and it should feel like leaving |
| **Enter** | Query types out (§2 rules). Results stagger 20 ms |
| **Drill-down** | Click → the captured extract in the Reader. **The URL is shown but never auto-opened** — Drishya does not navigate on the user's behalf |
| **Privacy** | URLs pass the redaction pipeline; query strings are a common leak path (blueprint §13.1) |
| **Efficient / Reduced motion** | Static, no edge gesture |
| **Screen reader** | "Web search: 'fastapi dependency override'. 5 results." |

---

## 11. MCP / external tool call

| | |
|---|---|
| **Shows** | Server name and tool name as a qualified pair — `memory · search_nodes` — then the arguments as compact key-value pairs, then the result. Results that are structured render as a small table; text results render as text |
| **Terrain** | External tools have no place in the repository, so **a satellite form appears just outside the Terrain bounds**, connected to the agent presence by a thin dashed **Trace**. Dashed, because the relationship is not structural |
| **Enter** | Satellite fades in `quick`; trace draws; result surface `EMERGE` on return |
| **Drill-down** | Click → full arguments and full result, formatted by type. `R` → Reader for large payloads |
| **Unknown tools** | Render generically rather than failing. A tool Drishya has never seen still gets name, args, result, timing — **graceful degradation is the rule for the whole long tail** |
| **Efficient / Reduced motion** | Static card, no satellite |
| **Screen reader** | "MCP tool `memory.search_nodes`. Returned 4 results." |

---

## 12. Subagent start / handoff

| | |
|---|---|
| **Shows** | A new agent presence with its own hue, labelled with its `agent_type` `[V]`, and the task it was given |
| **Terrain** | The parent presence **emits** the child: the child separates from the parent over 400 ms and travels to the centroid of the cluster its first action touches. A persistent thin tether connects them for the subagent's lifetime |
| **Handoff back** | The child's accumulated evidence travels the tether to the parent as a compact bundle, then the child's presence fades over `base`. The parent briefly brightens on receipt |
| **Enter** | `considered` 400 ms for the separation; the child's first Beat follows |
| **Drill-down** | Click a subagent → its Rail branches as a parallel track beside the main Rail. Its full transcript is available from `subagents/<id>/*.jsonl` `[V]` |
| **Roster** | Inactive agents collapse into the top-right roster as small marks |
| **Source** | `SubagentStart` / `SubagentStop` with `agent_type` `[V]` |
| **Efficient** | Child appears at its position, no travel. Tether is a static line |
| **Reduced motion** | No separation animation. Child fades in at final position |
| **Screen reader** | "Subagent `Explore` started: 'Find all session expiry handling'." |

---

## 13. Permission / approval prompt

| | |
|---|---|
| **Shows** | What was requested — tool and arguments — and the outcome: allowed, denied, or pending. Pending shows an unresolved state honestly, because Drishya is read-only and **cannot** resolve it |
| **Terrain** | Everything **holds**: all motion pauses, Terrain dims 30%. The scene stops because the agent stopped. This is the most literal mapping in the catalog and it is worth the special case |
| **Enter** | `EMERGE` `quick` with a distinct chime-equivalent visual — a single ring expanding once from the surface edge |
| **Denied** | **Fracture**, and the denied action renders struck-through. `PermissionDenied` `[V]` |
| **Drill-down** | Click → full tool input, and the rule or mode that triggered the prompt (`permission_mode` is in every hook payload `[V]`) |
| **Read-only reminder** | Drishya **never** offers an approve button. If one appeared, Drishya would be a harness (blueprint §5.4). A one-line hint says where to respond: "respond in Claude Code" |
| **Efficient / Reduced motion** | Static card, Terrain dims without blur |
| **Screen reader** | "Permission requested for `Bash: rm -rf build/`. Denied." |

---

## 14. Error and retry

| | |
|---|---|
| **Shows** | The error text, the failing action, and the attempt count. On retry, attempts stack visibly — `attempt 2 of 3` — rather than replacing each other |
| **Terrain** | **Fracture** at the node where it broke, which **persists** until something succeeds there. The break is a fact about the world until it is fixed |
| **Enter** | `quick` 160 ms — errors arrive fast, they do not glide in |
| **Retry** | Each attempt appends to the same surface, indented, with its own status. A succeeding attempt clears the fracture with a `base` heal animation that is the Fracture reversed |
| **Drill-down** | Click → full error output and the complete attempt sequence with timings |
| **Coalescing** | **Never.** Salience 1.00 |
| **Source** | `PostToolUseFailure`, `StopFailure` (with error type: `rate_limit`, `overloaded`, `authentication_failed`, `server_error`) `[V]` |
| **Efficient** | Static, red border, no fracture |
| **Reduced motion** | No fracture displacement. Color change only |
| **Screen reader** | "Error on `Edit auth/session.py`: file changed on disk. Attempt 2 of 3." |

---

## 15. Context compaction

An event most tools ignore entirely, and one users find genuinely disorienting when it happens invisibly.

| | |
|---|---|
| **Shows** | A full-width, low-height band across the Stage: `Context compacted · 47 turns summarised`, with the trigger (`manual` or `auto`) `[V]` |
| **Terrain** | A slow horizontal sweep of dimming passes across the whole Terrain over 700 ms, left to right, and lifts. The world momentarily greys — the visual statement that *the agent's memory of this changed*, not the code |
| **Rail** | A permanent horizontal division. **Everything before it is still fully available** — Drishya's store is not compacted, only the agent's context is. This distinction is important and should be stated in a tooltip |
| **Enter** | Band `EMERGE` `base`, sweep runs, band dissolves after dwell |
| **Drill-down** | Click → what was summarised (turn range), and the summary itself when the harness exposes it |
| **Source** | `PreCompact` / `PostCompact` with `compaction_trigger` `[V]` |
| **Efficient** | Static band, no sweep |
| **Reduced motion** | Band appears, no sweep. Rail division still drawn |
| **Screen reader** | "Context compacted automatically. 47 turns summarised. Earlier history remains available." |

---

## 16. Screenshot / image

| | |
|---|---|
| **Shows** | The image itself, fit to the Stage surface with the natural aspect ratio preserved, captioned with its origin |
| **Terrain** | Unchanged unless the image is tied to a file |
| **Enter** | `EMERGE` with a 300 ms progressive reveal — a subtle vertical wipe, which reads as "this is being produced" |
| **Drill-down** | Click → full resolution in the Reader, zoomable and pannable |
| **Source** | `~/.claude/image-cache/<session-id>/<image-id>` `[V]` |
| **Memory** | Images are the heaviest blob type. Thumbnail in the warm cache, full resolution loaded only on Reader summon and disposed on close (blueprint §15) |
| **Efficient** | Thumbnail only until clicked |
| **Reduced motion** | No wipe. Image fades in |
| **Screen reader** | "Image: screenshot of the checkout page, 1440 by 900." Plus any alt text the harness supplied |

---

## 17. Cross-cutting rules

These override any individual entry.

1. **Every visual is a handle onto real bytes.** If a surface cannot be clicked into captured content, it should not exist (blueprint §2.5).
2. **Never invent a location.** If an action cannot be mapped to a Terrain node with confidence, the Terrain stays quiet. A wrong light destroys trust in every other light.
3. **Edits, failures and test results never coalesce and are never skipped**, at any γ (blueprint §9.8).
4. **Everything is interruptible.** Any pointer or key event cancels in-flight transitions synchronously (blueprint §9.7).
5. **Contrast floor of 4.5:1 holds in every quality tier.** Efficient mode trades blur for opacity, never legibility.
6. **Derived content is visually distinct everywhere** — dashed edge, desaturated, `∿` mark — and never appears in the thinking surface (§8).
7. **One Reader, ever.** Every "show me all of it" affordance leads to the same right-docked surface. Never a new window, never a new tab, never a modal.
8. **No permanent boxes.** Terrain, Rail and the Scrubber's hit area are the only persistent chrome.

---

## 18. Build order

The catalog is 16 entries; v0.1 needs four. Sequenced by how much each teaches about the system:

| Phase | Entries | Why these |
|---|---|---|
| **v0.1** | 1 Read · 2 Search · 3 Edit · 4 Bash | The four that cover ~90% of Pulses in a real session, and between them they exercise every primitive: Trace, Bloom, Fracture, typing, diff, streaming, Reader summon, coalescing |
| **v0.2** | 5 Test · 8 Thinking · 9 Message · 12 Subagent · 13 Permission · 14 Error | Completes the live experience and the row rule |
| **v0.4** | 6 Git · 7 Plan · 10 Web · 11 MCP · 15 Compaction · 16 Image | The long tail |

Building 1–4 well matters far more than building 16 adequately. A session that renders four action types beautifully and everything else as a competent generic card is a better product than one that renders sixteen types mediocrely — and the generic fallback (§11's "unknown tools" rule) makes that a safe position to ship from.
