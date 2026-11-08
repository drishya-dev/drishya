# Release 1 — review and scope (8 to 18 November)

Yash with Claude (Opus), 8 November. This decides what ships in the first packaged version and what waits. It answers Yash's questions directly: will a developer keep Drishya open as a second window, does it feel good, does the visualization create the pull we wanted, and how useful are Files, Workspace and Git. Inputs:
- the two COMP-1 reports by ChatGPT ([developer adoption](comp-1-developer-product-review.md) and [presentation](comp-1-premium-ui-review.md), PR #367);
- my AUDIT-1 and finishing-pass walks of the running app (5 to 7 November);
- Yash's notes of 8 November.

I did not repeat a live walk for this document, to save the weekly limit. Section 4 has a prompt for a fresh reviewer to run on the release candidate instead.

## 1. My review: will a developer use it?

**The short answer:** they will open it for the visualization. They will keep it open if it answers three questions faster than their harness:
- what is happening now;
- what happened while I was away;
- does anything need me.

Today it answers the first one well and the other two only after exploring. Release 1 has to close that gap. It does not need new features.

**Where I agree with ChatGPT.** Both reports reach the same verdict, and it matches what I saw.
- **The durable value is evidence:** the exact source the agent read, kept separate from today's file, and the command and its real outcome, with a jump back into the same work.
- **The weak point is orientation.** A busy session offers five plausible focal points at once: the map, history, Files, the Toolbox, and the menus. Returning after a break makes you choose among five navigation routes.
- **The cost of learning.** A quick question is still cheaper in the native chat.

**Where I differ.** ChatGPT treats the map and motion as optional atmosphere. For a first release they are the acquisition hook. The first thing a developer sees is the agent's real material arriving from its true origin in their own repository, which a terminal never shows them. That is the pull we set out to create, and it is what the videos sell. A developer doesn't adopt Drishya because of the map, though. They adopt it once they have looked away for ten minutes, come back, and understood the run in thirty seconds.

So Release 1 keeps the visualization at full strength and makes it calmer under text: no lines through prose, legible labels. It spends the remaining effort on re-entry and on "needs you".

**Second window: yes, under conditions.**
- **Long runs, unfamiliar repositories, reviewing work you didn't watch:** yes. Peek beside the live history is the best moment in the product.
- **Quick edits and rapid back-and-forth:** no, and Release 1 should not pretend otherwise. The marketing should say "for the runs you don't want to babysit".

**Does it feel good?**
- **Motion:** the arrival motion is good since MOTION-1. Closes are inconsistent, because some surfaces open with motion and vanish on close (MOTION-4).
- **Palettes:** the light palette looks finished. The dark palettes read muddy: low-chroma text inside cards, grey on grey. In a dark-first developer product, that is the first impression.
- **Clutter:** it is calm only when Files and the Toolbox are not both resident around a narrow reading lane.

**Files and Workspace.**
- **Peek** is the strongest daily tool, and it now places paths truthfully after FILES-13.
- **Workspace** is useful for a small draft or comparison, but it is a mode switch. Returning collapses the read you had open, which breaks the thread. That is a Release 1 fix; redesigning Workspace is not.

**Git.**
- **Review of the current patch** is useful and honest about recorded versus current changes.
- **The graph** spends most of its space on a two-commit history. For Release 1, keep both as they are, fix the overlaps, and don't add scope.

**The rest** (Notes, review packets, findings, Screen): keep them, and don't promote them in Release 1. One exception is Screen's black held frame. It shows confident provenance over a missing picture, which breaks trust, so it is fixed.

**The UI version switch:** remove it from the product. Clarity is unfinished (FINISH-0a is a stalled draft), and a choice between "Modern", "Legacy" and an unfinished rebuild tells a new user that the product is unsettled.

## 2. Decisions for Release 1

1. **Release 1 ships Modern only.** The UI-version tab and Clarity are not reachable in the packaged product (SHIP-1). Clarity's code stays in the repository for later.
2. **Polish lands in Modern for Release 1.** This reverses the 6 November rule "Modern is frozen, presentation work lands in Clarity" until the release ships, because there is no time to finish Clarity. The FINISH pass (FINISH-0a to 13) is paused, not cancelled. After the release it resumes in whichever UI ships.
3. **Feature freeze on 13 November.** After that, only fixes found by the release-candidate review (SHIP-10) and the gate. No new items join Release 1 after today without Yash's say-so.
4. **Scope is the P0 list in TASKS.** Everything else waits, including:
   - CONNECT-4b (CONNECT-4a's Remember-by-default already removes most repeat prompts);
   - LAYOUT-1, UI-26, REVIEW-4, PERF-3;
   - the IDEAs and ADAPT-1.
   - **USAGE-1 (#344)** ships only if both builders agree its schema and it merges by 12 November.
5. **Platforms:** Windows is verified. MAC-1 runs if a Mac is available before 16 November. Otherwise the release notes state that macOS and Linux are untested.

## 3. The Release 1 list

All of these are P0 in [TASKS](../TASKS.md), each with Do and Accept lines. The usual rules hold: claim first, one whole item per PR, accept on real sessions of both harnesses at 600 and 1440 px.

| Order | ID | What | Builder | Why it ships |
|---|---|---|---|---|
| 1 | TOOLS-3 | Toolbox stays in the right dock, centred vertically by its own height, groups expand in place, no centred window (#359) | Harsh; Yash records one few-tool Claude session | The centred popup is the most visible wrong behaviour on main today |
| 2 | SHIP-1 | Modern only: remove the UI-version chooser and Clarity from the package | Sol | Yash's direction; no unfinished choices for users |
| 3 | SHIP-7 | Trust bugs: search result that doesn't move the reading position; Screen black held frame; return from Workspace collapses the open read | Sol | Each breaks the "I understand enough to act" promise |
| 4 | SHIP-2 | Palettes and rich colour: every palette as finished as the light one; vivid semantic colour inside cards; type checked | Opus specs and approves, Sonnet builds | First impression; Yash's top visual concern |
| 5 | SHIP-4 | "Since you left": a compact re-entry line in a session, linking to new actions, changed files, failures and any waiting request | Sol | Both reviews' top adoption item; the retention reason |
| 6 | SHIP-5 | "Needs you": one active decision surface, distinct words for answer / approve / working / stopped by you, model list without a manual settings read; native question options are clickable and answer the harness whenever Drishya can answer them, and honestly say where to answer when it can't (a session started in the CLI or app) | Sol | Second adoption item; makes the second window safe to ignore. Yash, 8 Nov: options looked clickable, but it wasn't clear an answer was sent |
| 6b | SHIP-12 | Plans, plan updates and task lists are shown open by default; no Show plan / collapse toggle | Sonnet | Yash, 8 Nov: a plan hidden behind a button is the thing you came to read |
| 7 | SHIP-3 | Home hero above the session list, in LAND-1's visual language, saying what Drishya does | Sonnet, after LAND-1 is agreed | The first screen of the package and of every video |
| 8 | SHIP-8 | Map: a quiet zone under reading material and labels that don't collide | Opus specs, Sonnet builds | Keeps the hook beautiful under text |
| 9 | MOTION-4 | Every open has its matching close; a little slower and smoother | Sonnet | Yash's direction; "feels good" |
| 10 | SHIP-6 | Reading and overlap defects from the presentation review (P01, P03–P05, P09, P11, P13, P17, P18, P20, P23) | Sonnet or Sol | Small, visible, cheap; premium bar |
| 11 | SEC-1 | Close after Dependabot rescans main | Harsh | Already merged (#365) |
| 12 | SHIP-9 | Package the release candidate: version, install guide, fresh-machine install, release notes, full gate | Sol, then Harsh on a second machine | The thing users install |
| 13 | SHIP-10 | Release-candidate review (prompt below) and Yash's human ten-minute pass | Fresh agent plus Yash | Last fixes come from here, not from new ideas |
| 14 | LAND-2, VIDEO-1, SHIP-11 | Landing page, product videos on the release candidate, launch posts written and scheduled | Harsh and Yash | Launch |

**Schedule:**
- 8–9 November: items 1–3, and the SHIP-2 spec.
- 10–13 November: items 4–10. Feature freeze at the end of 13 November.
- 14–15 November: SHIP-10 and its fixes, the full gate, SHIP-9.
- 16–18 November: videos on the release-candidate build, landing page, posts scheduled, release.

**Avoid collisions.** SHIP-4, SHIP-5 and SHIP-7 all touch `History.tsx` and `SessionWorkspace.tsx`. One builder at a time per file, and each claim names its sections. SHIP-2, SHIP-8 and MOTION-4 are style and motion work; they share stylesheets, so they run one after another, not in parallel.

## 4. Release-candidate review prompt (SHIP-10)

Give this to a fresh agent (ChatGPT or Claude) on the release-candidate build, with real local sessions available. It replaces another long COMP-style audit.

> You are an experienced developer who uses Claude Code and Codex every day. You have never used Drishya. Install it from the release candidate the way a user would, following only the README. Then use it for one real task in a throwaway repository: start or resume a native session, give it a multi-file task, and keep Drishya open beside it.
>
> Answer in this order, briefly and concretely, with the screen state you saw for each answer. Real session content stays on this machine: no quotes from journals, and screenshots stay in `.local/`.
> 1. **The first five minutes.** What did you understand without help? What confused you? Where did you look first?
> 2. **Second window.** While the agent worked, did you keep Drishya in view instead of the harness? When did you switch back, and why?
> 3. **Look away and return.** Leave for ten minutes of agent work. Return and say, within thirty seconds, what happened, what changed and whether anything needs you. How long did it take, and what got you there?
> 4. **Pull.** Did the visualization make you want to watch, or to show someone? Did it ever get in the way of reading?
> 5. **Feel.** Does it look and move like a premium product? Note every open without a matching close, dull or illegible colour, overlap, clipped text or misalignment, with the surface and the width (600 and 1440 px).
> 6. **Tools.** Did you use Files peek, Workspace and Git review? Which one saved you a trip to your editor or terminal, and which one cost you more than it gave?
> 7. **Verdict.** Would you keep it open tomorrow? For which tasks? Name the single change that would most change your answer.
>
> Do not propose new features. Rank defects as **blocks release**, **fix before videos** or **after release**.

## 5. After Release 1

Resume in this order:
- the finishing pass on the shipped UI;
- CONNECT-4b;
- the joined review route (REVIEW-4);
- Workspace continuity;
- LAYOUT-1;
- USAGE-1, if it did not ship;
- the rest of P2.

Re-read both COMP-1 reports' P1 directions before choosing.
