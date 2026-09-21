# Drishya — Vision & Creative Direction

**The north star for how Drishya looks, moves and feels.** Read this before any UI, graphics, motion or layout work. It is authoritative for the *experience*; the [engineering plan](review/03-engineering-plan.md) is authoritative for the *system*, and [the precedence map](README.md) resolves anything in between.

If you are an agent and read one design document, read this one.

---

## 0. The builder's vision, in their words

This section is the source. Everything below it is interpretation and must serve it.

> Show the whole repo graph or pipeline and connections. Then from those graphs, bring that file in a cool way, as well as meaning to those graphs. Show what the agent is looking at one by one as it proceeds — tools and results visually, connected — what it is thinking and going through, then changes, properly. A whole visual of its working.

> Not boxes of `model thinking:`, `tool call:`, `output:`, `code edit:`. **Visualization is the main.**

> All the things coming up part by part as the agent works, and **they remain on screen with some part overlapped**. From **left to right** when the agent is not thinking — it keeps going. When it thinks, **the thinking is shown in text below, not in a box**. Then tools again.

> Agents at the top. Repo graph in the background, **interactable**. Everything the agent does in the middle, scrolling down. **MCP tools to the right** — main tools, then the many MCPs by name. A small section **comes out of that MCP**, takes the required space, and shows the tool call.

> Set places for things, with animations, like a **$1M product** that looks clean. Something unique, not just boxes. **Clean and advanced animations for every single little thing.**

> Like Jarvis — full of visualization, putting up its own working. The difference between a **$10 video edit and a $1,000 one**: the smoothness with which things come up and interact with you.

> People prompt and leave, read the final text, and don't know the code, the decisions, the edits, the rules. That is what makes vibe coding a threat. Show them the agent's work turning from raw text into actual visuals — so they understand it, and never want to go back.

---

## 1. The doctrine: quiet at rest, articulate in motion

Two forces must both win:

- **Truth.** Drishya shows *captured evidence*. It never fakes activity, never implies causality it cannot prove, never types out text that was already recorded, never invents a location. (Engineering constraints 4 and 5; [review §3](review/01-product-review.md#3-findings-that-change-the-plan).)
- **Craft.** It must feel like a $1,000 edit, not a $10 one. Every arrival, connection, settle and selection is choreographed.

These do not conflict, and the reconciliation is the core creative idea:

> **Motion is spent on *relationships and arrivals*, never on *simulating the reading task*.**

A file does not type itself out. But it *emerges from its own place on the map*, carrying a hairline back to where it lives. A diff does not fake keystrokes — but the removed line genuinely *lifts away* and the added line *settles into its slot*, because both states were captured. The richness lives in space, material, light and connection. The content always arrives whole, selectable, immediately.

**At rest, the screen is calm and readable.** Nothing loops, pulses or drifts for attention. **In motion, everything is precise and meaningful.** A viewer should be able to pause any frame and read it — and watch any transition and understand *why* it moved.

The test for every animation: **if you removed it, would the user lose information about where something came from, what it connects to, or what changed?** If not, it is decoration — cut it or make it earn its place.

---

## 2. The world has places

The screen is not a panel grid. It is a **world with stable places**, so the eye learns where things come from.

```
 ┌────────────────────────────────────────────────────────────────────┐
 │  ◉ Claude · reading       ◎ Codex · idle            ⟐ LIVE  ▸     │  AGENT CROWN
 │                                                                     │
 │     ·  ·   ✦ checkout ── pricing ·                        TOOLS    │
 │   ·      ╲        ╱   ·    ·   (the living map — behind all)       │
 │                                                          ▪ Read    │
 │   ▸ READ ───────────▸ SEARCH ─────────▸ ◇ CONTEXT7 ◂━━━━━ ▪ Search │
 │   create-order.ts     "zero total"      query-docs        ▪ Edit   │
 │   ▏18 if (!total)     ● checkout:42     keep zero …       ▪ Shell  │
 │   ▏19   throw …       ● pricing:18                                  │
 │        ↘ earlier surfaces settle, overlapped at their margins      │
 │                                                          MCP       │
 │   The check treats a zero total as missing. I'll narrow   ◇ Context7│
 │   it to null or undefined and keep the order path.        ◇ GitHub │
 │                                                                     │
 │   ▸ EDIT ────────────▸ TEST                                         │
 │   ⁻ if (!total)        ▮▮▮▮▮▮▮▮▮▮▮▮▮▯  13 ✓ · 1 ✗                   │
 │   ⁺ if (total == null)                                              │
 │                         ⌄ history continues downward                │
 │  ◂◂  ▶  ▸▸   ▕▁▂▁▃▅▂▁▁▇▁▂▁▁▃▁│▁▁▂▁▁▁▁▕   04:12 / 18:40     1×     │  FILMSTRIP
 └────────────────────────────────────────────────────────────────────┘
```

| Place | What lives there | Its character |
|---|---|---|
| **Crown** (top) | Active agents, each a luminous presence with name and state | Calm. A presence *breathes* only while its agent has a tool actually in flight |
| **Map** (behind everything) | The repository as a living field of files and relationships | Deep, quiet, interactive. Light pools where work happens and slowly cools |
| **Canvas** (centre) | Action passages left→right, prose beneath, history downward | The stage. Dominant, readable, accumulating |
| **Dock** (right) | Native tools, then MCP servers by name | Instruments on a shelf. Each is a real origin point |
| **Filmstrip** (bottom) | Transport plus a minimap of the whole run | Always discoverable, never a dashboard |

**Every visual element has exactly one home, and moves from its home for a reason.** A file comes *from the map*. A tool call comes *from the dock*. A thought comes *from the agent*. That is the entire spatial grammar, and it is what makes the screen legible without labels.

---

## 3. The signature moves

Five moves carry the product. Each is specified in detail in the [continuous canvas](reference/04-continuous-canvas.md) and [experience spec](review/02-experience-spec.md); this is their creative intent.

### 3.1 Lift — content comes out of the map

The file's node on the map brightens and **draws a hairline filament** toward the canvas. Along it, a surface **unfolds from the node's side** — the frame grows, the content fades in *at final size* as it settles. A 1 px tether stays, curving back to the node. Hover the surface and the tether and node brighten together; hover the node and every surface from that file, across the whole history, glows in answer.

*This is the moat made visible.* A tool with no repository model has nowhere for content to come *from*. One second of motion shows the difference without a word.

### 3.2 Emit — a tool call leaves its instrument

The tool's mark in the right dock ignites. For an MCP call, **the named server opens like a drawer**, revealing the specific tool, and a thin light ribbon **unfurls inward** to the surface's allocated place in the passage. The surface starts as a narrow shell holding the arguments; when the result returns, **the same surface grows** to its measured reading size. No second card flies in from nowhere. The ribbon fades to a faint filament that stays linked to its server.

### 3.3 Settle — work accumulates like pages on a desk

When the next operation arrives, the previous one doesn't vanish. It **eases back** — a touch smaller, a little dimmer, sliding to overlap the new surface only at its *margin*, with its title and a meaningful excerpt still readable. After a passage, the whole row settles together into a retained, gently fanned stack. Select any settled surface and it rises to the front, and playback holds for you.

### 3.4 Surface — prose rises beneath the work

When the agent speaks, the finished passage settles and the agent's actual words appear beneath it, **unboxed** — plain readable text in the UI sans, no bubble, no card, with a single agent-coloured rule at the left edge and the agent's name above. The paragraph arrives complete and **resolves into focus**, a subtle blur-to-sharp like a camera pulling focus, so it is readable instantly and never typewritten. Then the next passage opens below. This vertical rhythm — *action, action, action · words · action, action* — is the product's heartbeat.

### 3.5 Resolve — the outcome lands once

A test run is a fine row of tick marks, one per test, filled at their true counts. A failure is a **single sharp red notch** — and the assertion opens directly from that notch: expected, actual, the line. A passing rerun resolves the notch back to a quiet tick. An edit's removed line **lifts and dissolves** while the added line **settles into its slot**, alignment preserved. Every outcome changes once, precisely, and then holds still.

---

## 4. Each action has its own shape

The rule from your vision — *not boxes* — means **no generic card template**. Each kind of work has a distinct composition, so a glance tells you what happened.

| Action | Its shape | What makes it feel alive |
|---|---|---|
| **Read** | A slice cut from the file: the read lines bright, with **abstract ghost shapes above and below** fading out — you *see* it is a window into a larger file. The ghosts are blurred bars, **never real text**: bytes outside the captured range were not captured, so showing them would invent content | Lifts from its map node; the ghosts convey "excerpt" without a label |
| **Search** | The query on a fine luminous line; results **hang from it like beads**, each an excerpt with its path | Each bead is linked to its map location by a hairline; hover a bead, its file lights up |
| **Edit** | A diff with line alignment preserved: removed lines struck and dimmed, added lines warm | The removed line **lifts away**, the new line **settles into place**, using the real captured before and after |
| **Shell** | The command on a baseline like a prompt; output falls beneath it in a monospace field | Output arrives at real captured chunk boundaries live; exit status resolves as one mark |
| **Test** | A row of fine ticks: passes quiet, failures as red notches | The failing assertion opens from its notch |
| **MCP** | Server and tool as a quiet attribution, arguments, then the result in its natural shape | Emerges from its named server in the dock and stays tethered to it |
| **Prose** | Editorial text directly on the darkened world | Focus-pull reveal; agent glyph at the margin |
| **Subagent** | A smaller presence **splits from its parent** in the crown | A lane opens in history; the parent keeps its place |
| **Approval** | The request with where to respond | Only *that agent's* lane holds; the rest of the world keeps moving |
| **Gap / unknown** | What is known, what is missing, stated plainly | A neutral, dignified state — missing evidence is shown, never papered over |

---

## 5. Theme: a clean developer tool

*Revised 21 Sep after review of the first prototype: the functionality and what it shows were right; the look was too busy. Glow pools, blur, grain, a serif voice and five accents read as messy. The standard is now the tools developers already trust — Linear, Vercel, GitHub.*

**Neutral, flat, precise.** A graphite base, flat surfaces with a 1 px hairline border and a small radius, and a solid app frame — crown, dock and filmstrip — separated by hairlines. No glow pools, no frosted blur, no grain, no vignettes. Precision in alignment and spacing does the work that effects used to.

**"No boxes" means no *labelled* boxes.** What the builder rejected is the `model thinking:` / `tool call:` / `output:` stack. A clean, content-shaped surface for a file read or a diff is the right developer idiom. The agent's prose stays unboxed: plain text with a single agent-coloured rule at its left edge.

**Colour only where it means something.** Neutral greys for everything structural. Colour is reserved for:

| Meaning | Colour |
|---|---|
| Agent identity | Claude `#E0896A` · Codex `#6FC3B3` · one hue per agent |
| Pass / added | `#4FC38A`, with a `rgba(46,160,67,.14)` line wash |
| Fail / removed | `#F2706A`, with a `rgba(248,81,73,.13)` line wash |
| Edited file | `#E6B98A` |
| Interactive focus, MCP | `#8B9BFF` |

Base `#0A0A0C`, surfaces `#111216` / `#16171C`, borders `rgba(255,255,255,.07–.18)`, text `#EDEDEF` / `#A1A1AA` / `#71717A` / `#52525B`. Syntax colours follow GitHub Dark (keywords `#FF7B72`, strings `#A5D6FF`, functions `#D2A8FF`, numbers `#79C0FF`, comments `#8B949E`). Colour never carries meaning alone; shape and label always back it up.

**Type** — one sans (Inter / Geist, system fallback) for UI and prose, one mono (Geist Mono / JetBrains Mono / Cascadia) for code and paths. No serif, no italics, no letter-spaced uppercase labels. Sentence case everywhere.

**The map is quiet.** The run's files form a spine in the left gutter; the rest of the repository fades out from behind the reading column so no line ever crosses text. Heat is a small, tight glow and a ring for edited files — information, never atmosphere.

**Motion is unchanged** — Lift, Emit, Settle, Surface, Resolve — but the travelling shell now looks like the surface itself arriving, and nothing blooms. Depth comes from opacity and a single shadow, not from scale.

## 6. Micro-interactions — "every single little thing"

The $1,000 feel lives in the details people only notice unconsciously. Every one of these must be precise, brief and *reversible*.

- **Hover a line of code** → its file's map node brightens; the tether lights.
- **Hover a map node** → every surface from that file across the history glows faintly in answer.
- **Hover a diff line** → a peek of the other state (before/after).
- **Hover a settled surface** → it lifts a hair and its full title comes into focus.
- **Near-cursor parallax** → a surface tilts one or two degrees toward the pointer, like a physical sheet. Off under reduced motion.
- **Select** → the surface rises a plane, gains a soft light bloom beneath, playback holds, a small "Held · resume" appears.
- **Copy** → a brief shimmer across the copied lines confirms it.
- **Dock item fires** → a short ignition, a ribbon, then quiet.
- **Agent tool in flight** → its crown presence rotates a thin orbital ring; stops the instant the call resolves.
- **Scrub** → the whole world rewinds together: surfaces un-settle, the map's heat recedes to that moment.
- **Focus with keyboard** → an elegant focus ring that matches the material, never the browser default.

**Interruptibility is part of the craft.** Deliberate intent — selecting, scrolling, reading, focusing a control — stops automatic advancement instantly. Merely moving the pointer does not. Nobody ever waits for an animation to finish.

---

## 7. The anti-list

These make a product look cheap or dishonest. They are banned.

- Equal-sized rounded cards in a grid. Borders around every event. Window title bars. Chat bubbles.
- `model thinking:` / `tool call:` / `output:` labels as the primary presentation.
- Typewriter effects on text that was already captured. Counting-up numbers. Fake scanning lines.
- Glow on everything, neon everywhere, perpetual particles, animated wallpaper, "holographic" machinery.
- A camera that chases the agent while the user is trying to read.
- Any motion implying a cause, a runtime path or a location the evidence does not support.
- Shrinking source text to fit more on screen.

---

## 8. The standard

Before any visual work ships, it passes three tests:

1. **The freeze test** — pause on any frame. Is every piece of text readable and every element's origin clear?
2. **The truth test** — does any motion imply something the captured evidence does not support? If so, it goes.
3. **The ten-minute test** — after ten minutes of real reading, interrupting and scrubbing, does it still feel calm, or is it tiring? The opening animation is not the product; the tenth minute is.

And one aspiration that sits above all three: **someone watching over your shoulder should stop and ask what that is.**
