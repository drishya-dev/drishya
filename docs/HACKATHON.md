# Nebius × NVIDIA Global AI Hackathon — fit assessment

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

## Sources

- [Official rules — Devpost](https://nebiusglobalaihackathon.devpost.com/rules)
- [NVIDIA Nemotron 3 Super on Nebius Token Factory](https://nebius.com/blog/posts/nemotron3-super-now-available) — 120B hybrid MoE, 12B active, up to 1M context, OpenAI-compatible API
- [Nemotron and Token Factory](https://nebius.com/services/token-factory/nemotron) — Nano, Super and Ultra tiers
