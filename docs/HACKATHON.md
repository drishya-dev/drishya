# Nebius × NVIDIA Global AI Hackathon — fit assessment

> **19 October 2026: not being pursued.** The builder removed the hackathon from the active work list (TASKS, STATUS decisions log). This document is kept only as a reference for the fit analysis and the rules as checked on 19 Oct; nothing here is scheduled.

## 19 October 2026 refresh — read this first

Rechecked against the live [Devpost page](https://nebiusglobalaihackathon.devpost.com/). **Deadline 30 Oct 2026, 10:00 PT (22:30 IST): 11 days.** The requirements are unchanged:
- Token Factory or AI Cloud, plus at least one NVIDIA open model;
- a working demo URL (hosted app or test build);
- a public YouTube video under 3 minutes;
- a public repo with an OSI licence visible at the top;
- a README with setup;
- an explanation of what was significantly updated during the window;
- Token Factory feedback.

Prizes: $20k / $10k / $6k overall, a Jetson Orin Nano per track, $3k Best Use of Tavily, $500 city awards and $100 feedback awards. The four judging criteria are equally weighted. The judges are NVIDIA, Nebius and Tavily engineers and product people.

**What changed since September.** The [harness data audit](review/123-harness-data-audit.md) measured that current harnesses mostly do **not** record reasoning: Claude Code thinking blocks are empty (223/225), and Codex reasoning is encrypted with summaries on about 3%. That gives the model layer a real, non-obvious job:

> Nemotron explains what *another* coding agent is doing and why, in real time, **because the agent's own reasoning is no longer visible**. It is always labelled as generated and cited to the captured commands, reads and diffs.

That is load-bearing (the *why* is otherwise missing), and it fits Drishya's truth doctrine instead of fighting it.

**Track.** The Coding and Agentic Engineering brief opens with "build coding agents and **developer tools**". Drishya is a developer tool for exactly that audience. The track continues with "agents that write, run, and test code in Token Factory", which Drishya does not do, so judges may read it narrowly. Best Apps and Agents ("any app or agent someone would actually use", Nano/Super/Ultra tiers) fits without ambiguity and matches the tiered design below.

**Recommendation: Best Apps and Agents.** Cash is awarded overall regardless of track, and the four criteria matter more than the category. The builders decide (HACK-1).

**Honest odds.** I cannot know the field size, so I won't give a number.
- **Strengths:** *Design* (a complete, polished product, which most hackathon entries are not); *Impact* (a real, specific problem with a working demo on real sessions); *Idea* (the measured "reasoning is hidden" gap makes the model use non-obvious).
- **Main risk:** *Technological implementation*. The Nemotron layer has never run against the live API, and judges must see it doing real work in the video and the hosted demo.
- **Assessment:** with EXPLAIN-1/2/4 and HACK-1…3 done well, Drishya is a credible contender for a track win and has a plausible but uncertain shot at the top three overall. Without the live model layer it should not be submitted.

**Plan (TASKS P0):**

| By | Work |
|---|---|
| 21 Oct | BUG-1…4 fixed; Token Factory key; EXPLAIN-4 model ids, latency and cost measured |
| 24 Oct | HACK-1: decide, scan history for secrets, make the repo public. EXPLAIN-1 narrator labels live on real sessions |
| 27 Oct | EXPLAIN-2 turn summary and briefing; TURN-1 ledger; LIVE-1 Now line; DATA-1/2 if they fit (they strengthen the demo, but schema agreement comes first) |
| 29 Oct | HACK-2 hosted demo with precomputed, labelled outputs; HACK-3 video, README and submission text |
| 30 Oct, before 10:00 PT | Submit; don't leave it to the final hour |

Not a fit for **Best Use of Tavily**: Drishya has no natural web-search job, and adding one for a prize would be feature creep.

---

Assessed 21 September 2026 against the [official rules](https://nebiusglobalaihackathon.devpost.com/rules). **This records whether Drishya fits the track. Entering is an [open decision](STATUS.md#open-decisions).**

## The event

| | |
|---|---|
| Submission window | 26 Aug 2026 – **30 Oct 2026, 10:00 PT** |
| Judging · winners | 1–15 Dec 2026 · 11 Jan 2027 |
| Overall prizes | $20,000 · $10,000 · $6,000 (cash) |
| Track prize | One NVIDIA Jetson Orin Nano per track winner |
| Rule | A project wins **one overall award *or* one track award**, plus at most one bonus award |

## Verdict: it fits — conditionally

**Drishya fits the Best Apps and Agents track on problem, audience and design. It does *not* fit the required-technology rule as currently designed**, because Drishya today uses no model at all. It fits only if Nemotron on Nebius Token Factory does load-bearing work — and that work must obey Drishya's own rule that derived content is labeled and anchored to captured evidence.

### Against each criterion (all weighted equally)

| Criterion | Rule text, condensed | Drishya as designed | Condition for a strong score |
|---|---|---|---|
| **Technological implementation** | How well built; how effectively it uses Token Factory + an NVIDIA open model | ✗ No model in the design | Nemotron must be part of the core loop, not a bolt-on |
| **Design** | A complete, coherent product experience — not just a proof of concept | ✓✓ This is the product's entire reason to exist | The continuous canvas must actually work end to end in the demo |
| **Potential impact** | A credible, specific case for a real problem and audience, shown working | ✓ The supervision gap is real and specific: developers who cannot follow what their agents changed | Show it answering a real review question |
| **Quality of the idea** | A creative, *non-obvious* use of Token Factory + Nemotron; real understanding of the problem space | ~ "Summarize the session with an LLM" would be obvious | The model's use must be as distinctive as the interface |

### Hard requirements

| Requirement | Drishya today |
|---|---|
| Runs on Nebius Token Factory or AI Cloud **and** uses ≥1 NVIDIA open model | ✗ Must be added |
| Public repository, open-source licence (Apache-2.0 / MIT / MPL-2.0) | ~ Apache-2.0 ✓, but the repo is **private** — must be public before submitting |
| Demo video under 3 minutes, on YouTube, showing it working | ✓ The format suits Drishya unusually well |
| README with setup instructions | ~ README exists; setup instructions do not yet |
| New, or significantly updated during the submission window | ✓ Started 20 Sep 2026, inside the window |

## Why Nemotron fits Drishya's thesis rather than fighting it

Drishya's core principle is that **captured evidence and derived interpretation are always distinguishable**. A model is a derived-content generator, so the fit is honest only if its output inherits that discipline: every model-written sentence is marked derived and anchored to the specific captured observations it drew on. That constraint is not a compromise — it is what would make the model use *non-obvious*.

The track's own framing — Ultra for serious reasoning, Nano or Super for fast everyday calls — maps onto real Drishya jobs:

| Tier | Real job in Drishya | Why this tier |
|---|---|---|
| **Nano** | Short labels for passages and map clusters; titles for grouped bursts | Many small, fast calls; latency matters more than depth |
| **Super** | The return briefing: "while you were away" over an interval of captured work | Nebius documents up to 1M-token context, so a long session interval fits |
| **Ultra** | Explaining a selected diff hunk from its surrounding captured evidence, with each claim cited | The hardest reasoning: separating what the evidence supports from what it does not |

These are consequences of the existing design, not new product directions: the blueprint already reserved opt-in, batched, derived-labeled model summaries (§12), and the review's Change story and Return briefing (§6.1–6.2) are the features they would serve.

## Tensions to be honest about

- **Local-first versus a cloud model.** Sending captured source to Token Factory is a data transfer. It must be an explicit opt-in action, run only on redacted content, and say so. The core replay stays fully local and works without it.
- **The deadline.** About five and a half weeks from today. That is enough for a vertical slice — the evidence-linked replay, the continuous canvas and the model layer on a real session — not for the whole product.
- **Track choice.** The *Coding and Agentic Engineering* track sounds closer, but its brief is "agents that write, run, and test code in Token Factory Sandboxes". Drishya is observe-only and never writes or runs code, so **Best Apps and Agents is the correct track.** Since track prizes are hardware and cash is awarded overall, the four criteria above matter far more than the category.

## Where the build stands against it (25 Sep 2026)

| Requirement / condition | State |
|---|---|
| Nemotron on Token Factory, load-bearing | **Built, untested against the live API** (no key on this machine yet). `packages/explain`: *explain a change* (Ultra tier, falling back to Super), *return briefing* (Super), *passage labels* (Nano). Endpoint `https://api.tokenfactory.nebius.com/v1` (OpenAI-compatible, `NEBIUS_API_KEY`), per the [quickstart](https://docs.tokenfactory.nebius.com/quickstart). Model ids are configurable, and the Ultra id is unverified |
| Derived and labelled, anchored to evidence | Built. Evidence items are keyed `E1…En`, claims without a valid citation are dropped and counted, the output is badged "Generated by <model>", and citations jump to the step |
| Opt-in data transfer | Built. There are no automatic calls. Each call first previews the exact messages, endpoint and model; content is redacted at ingest and again before sending |
| Working product for the demo | Backend and base UI work end to end on real Claude Code and Codex sessions; the synthetic demo plays with no install |
| Public repo, README with setup | README has setup. **Repo still private** |
| Demo video < 3 min | Not started |

**To finish:** get a Token Factory key, confirm the exact Nano, Super and Ultra model ids with `GET /v1/models` (the daemon exposes `/v1/models`), run explain and briefing on a real session, tune the prompts, then decide on entering (open decision 4).

## Sources

- [Official rules — Devpost](https://nebiusglobalaihackathon.devpost.com/rules)
- [NVIDIA Nemotron 3 Super on Nebius Token Factory](https://nebius.com/blog/posts/nemotron3-super-now-available) — 120B hybrid MoE, 12B active, up to 1M context, OpenAI-compatible API
- [Nemotron and Token Factory](https://nebius.com/services/token-factory/nemotron) — Nano, Super and Ultra tiers
