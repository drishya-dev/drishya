# STATUS — where we are

**Read [`BLUEPRINT.md`](BLUEPRINT.md) first for *what* we are building. This file is *where we are*.**

Two builders, shared ownership, mutual review. No fixed track split — take the next thing from the queue, and **claim it here before you start** so we never edit the same file at once.

> **Rule: update this file when you stop working, not when you start.** Thirty seconds at the end of a session saves the other person twenty minutes at the start of theirs.
>
> **The chat is not the memory. This file and the blueprint are.** Session history does not survive folder renames, account switches or the 30-day retention sweep. If losing a conversation would lose real context, that context belongs in these files. (Blueprint App. A2)

---

## Right now

| | |
|---|---|
| **Milestone** | **M0 — Foundations and the go/no-go** (blueprint §20) |
| **Repo** | [`drishya-dev/drishya`](https://github.com/drishya-dev/drishya) — **private**, Apache-2.0, `main` |
| **Blocked on** | nothing |
| **Next gate** | Evidence-linked replay slice: captured read → edit → test → inspect/rewind in the continuous canvas, with retained action passages, open prose, historical gaps and reduced motion. See [review](review/01-product-review.md). The ten-repo benchmark becomes a later indexer gate. |

### Claimed

*Add a line before you start. Delete it when you are done or when you stop.*

| Who | What | Files |
|---|---|---|

---

## Last session

*Each person overwrites their own block. Keep it to what the other person needs in order to not redo or undo your work.*

### @yash
- **When:** 2026-09-20
- **Did:** Blueprint v1.2. Named the project Drishya. Created the `drishya-dev` org, initialised the repo and pushed the docs. Renamed the project folder from `vantage` and migrated Claude Code session history across.
- **Left half-done:** nothing
- **Watch out for:** repo is **private** — flip to public when there is something worth showing. `.gitignore` refuses `*.jsonl` by default, so recorded fixtures need an explicit, redacted path (`fixtures/redacted/`) before they can be committed.

### @partner
- **When:** —
- **Did:** —
- **Left half-done:** —
- **Watch out for:** —

### Codex review
- **When:** 2026-09-21
- **Did:** Reviewed blueprint, motion catalog and schema against the original vision; researched current primary harness/product docs; inspected Agent Flow source. Added four review documents and a synthetic interactive storyboard under `docs/review/`. Linked review precedence into the blueprint, README, agent guidance and references. Refined the default composition following user feedback: added `docs/reference/04-continuous-canvas.md`, updated the experience and engineering specs, and rebuilt the storyboard around accumulating action passages, unboxed prose, top agents, right-hand tool/MCP origins and an interactive background map.
- **Key findings:** Competitors already render content; HTTP hooks do not satisfy a nonblocking promise; Codex/Cursor/OpenCode have documented surfaces missing from the old plan; historical artifact versions and typed evidence links are essential; burst pacing needs separate capture and presentation guarantees.
- **Validation:** Revised storyboard JavaScript syntax and DOM references checked; browser preview inspected at desktop and 390px width; exercised retained history, MCP emphasis, action expansion, map exploration/return and complete reduced-motion playback. Documentation relative links and whitespace checked. No real capture integration, production performance test or user study was performed.
- **Left half-done:** No requested review work. Application implementation is still pending. Schema amendments are proposals for builder agreement, not a frozen contract.
- **Watch out for:** Original v1.2 body remains for traceability; its review notice and linked amendments override conflicting claims. The latest continuous-canvas reference supersedes single swapping-panel defaults. The storyboard is synthetic and must not be marketed as a working integration; production virtualization, adaptive pacing and live streaming remain implementation work.

---

## Next up

**Revised first sequence (21 September review):**

1. Agree observation identity, historical artifact availability, typed links and capability semantics before schema freeze.
2. Build the small replay interaction against synthetic fixtures, then implement redaction before importing any real recording.
3. Add a real Claude fixture and a small Codex fixture to test the shared model; implement the file/import map alongside the review loop.
4. Validate understanding and interruption behavior before expanding static analysis and live integrations.

The older capture/scene checklist below is a backlog, not the current priority order. The replacement sequence and gates are in [engineering plan §12](review/03-engineering-plan.md#12-build-sequence-and-tests).

Ordered by dependency, not by owner. Take from the top of either column. Tick when merged, not when written.

### Capture side — indexer, adapters, daemon

- [ ] Repo skeleton: TS monorepo, lint/typecheck/test, CI skeleton
- [ ] SQLite schema + content-addressed blob store (event schema §4)
- [ ] **Capture 5 fixture sessions** (blueprint §17.3) — *unblocks all rendering work, do this first*
- [ ] Tree-sitter parse → symbol table, Python + TypeScript, via `web-tree-sitter` (§10.6 stages 1–2)
- [ ] **Import resolution** (§10.6 stage 3) — the hard part; budget for it
- [ ] Measure cold index on a 5k-file repo against the 30 s budget (§14.5)
- [ ] **M0 GATE:** index 10 OSS repos, hand-check a sample of resolved edges

### Scene side — renderer, motion, pacing

- [ ] Design tokens: color, type, timing (§7.4)
- [ ] Three-layer render shell — Pixi canvas / DOM / backdrop surfaces (§14.3)
- [ ] Static placeholder graph rendering in Pixi
- [ ] **Lift prototype against a fake graph** (catalog §0.6) — *the signature move; get this right before anything else*
- [ ] Scene composer skeleton **as a pure function** + first golden test (§9.6)

### Both, at M0

- [ ] Freeze v1 of the event schema — it is the seam, and it is the one thing that needs agreement
- [ ] Agree the graph API surface the renderer consumes

---

## Decisions made

*Append only. Never delete a row — supersede it with a new one.*

| Date | Decision | Why | Where |
|---|---|---|---|
| 2026-09-21 | Continuous canvas is the default: retained left-to-right action passages, unboxed emitted prose beneath, top agents, right tool/MCP origins and a background map | Explicit user refinement: the composition must accumulate and remain navigable; reading focus must not replace the surrounding work | `docs/reference/04-continuous-canvas.md`, experience spec §2 |
| 2026-09-21 | Review amendments supersede conflicting v1.2 planning claims; schema changes remain proposals | Primary-source research and design review found overstated completeness, causality, competitive and pacing claims | `docs/review/01-product-review.md`, blueprint review notice |
| 2026-09-21 | First gate is the evidence-linked replay interaction; graph benchmark follows | Prove useful comprehension and visual craft before investing in a comprehensive indexer | Review §8–9, engineering §12 |
| 2026-09-21 | Privacy precedes the first real import; historical artifacts need explicit availability | Prevent irreversible sensitive persistence and misleading replay | Engineering §4, §10 |
| 2026-09-20 | Named **Drishya** (दृश्य, "the visible / a scene") | Vantage is occupied in devtools; npm `drishya` verified free | §App. A |
| 2026-09-20 | **Nothing is reused.** Graph engine from scratch, Python + TS only | Existing engines target retrieval, not a timeline with stable layout | §10.6 |
| 2026-09-20 | **TypeScript everywhere**, incl. daemon | One language for a duo; the schema stops being duplicated | §14.5 |
| 2026-09-20 | **`web-tree-sitter` (WASM)**, not native | A failed `npx` on Windows costs a user permanently; slow cold index costs seconds once | §14.5 |
| 2026-09-20 | **No ownership split.** Shared code, mutual review, claim work here | Small codebase; both understanding the whole system beats parallelism | §20 |
| 2026-09-20 | Localhost web app + daemon; Tauri later; never Electron | GPU access, zero packaging, `npx` install | §14.1 |
| 2026-09-20 | PixiJS v8 WebGL2; WebGPU behind a flag | Pixi itself recommends WebGL for production | §14.2 |
| 2026-09-20 | CodeMirror 6, not Monaco | Many small views + one Reader; Monaco is heavy per instance | §14.4 |
| 2026-09-20 | Apache-2.0 + trademark policy | Local-first, no SaaS to protect; AGPL costs adoption | §19.1 |
| 2026-09-20 | **Observe-only.** Drishya never launches or steers an agent | Control makes it a harness, and it loses that fight | §5.4 |
| 2026-09-20 | Replay before live | Replay is the durable job; live is what sells it | §3.1, §20 |
| 2026-09-20 | **Lift** is the signature mechanic — content is lifted out of the map, never faded in | It is the moat made visible in one second | §7.4 |
| 2026-09-20 | GitHub org **`drishya-dev`**, not `drishya-ai` | `drishya` was taken; `-ai` collides with Drishya AI Labs and contradicts the captured-not-generated positioning | §12 |
| 2026-09-20 | Org owned by a **personal account**, both builders as **Owners**, 2FA required | No legal entity; either builder must be able to administer | — |
| 2026-09-20 | Repo starts **private** | Nothing worth showing yet; flip to public at the M1 demo | §18.5 |

---

## Open decisions

| # | Question | Blocks | Blueprint |
|---|---|---|---|
| 1 | Complete Agent Flow/native-tools task comparison. Source inspection already confirms edit/write snippets and tool results | Workflow differentiation claims; no longer an open question whether any content is shown | `review/04-research-ledger.md` |
| 2 | Trademark clearance for "Drishya", class 9/42 | Commercial use only | §App. A |
| 3 | When do we flip the repo public? Proposed: at the M1 hosted demo | Launch timing | §18.5 |

---

## How to update this file

**For humans and agents alike:**

1. **Claim before you start.** One row in *Claimed*. Delete it when you stop. This is the whole concurrency protocol and it is enough for two people.
2. **Overwrite your own "Last session" block.** It is a snapshot, not a diary.
3. **Tick "Next up" only when merged.** A ticked box means the other person can build on it.
4. **Append to "Decisions made" whenever something is settled** that a future agent would otherwise re-litigate. One line, with the why. This is the highest-value part of the file.
5. **If a decision contradicts the blueprint, update the blueprint too** and say so in the decisions row. The blueprint is the source of truth, so it must not go stale — a stale source of truth is worse than none.
