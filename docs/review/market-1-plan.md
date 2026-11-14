# MARKET-1: the launch plan (videos, posts, platforms, timing, design)

Drafted by Fable, 15 Nov 2026, for Yash and Harsh to agree. Everything is decided here except the video production itself. The videos are recorded and edited on 16 and 17 Nov from the scripts below. The posts are final drafts: change the wording freely, but keep the facts. Every claim must be true of the shipped build.

**Rule (REL-4):** agents draft and design. Only Yash and Harsh publish, post, message or submit anything.

---

## 1. Audience and message

**Who:** developers who code with agents (Claude Code, Codex, Antigravity) and want to understand what the agent did. They are not "vibe coders" who never read the diff, and not sceptics who refuse agents. They are the large middle: they prompt, look away, come back to a wall of text, and either trust it blindly or spend twenty minutes reconstructing what happened.

**The pain, in their words:** "the agent knows the change, I don't."

**The promise:** Drishya shows you the agent's real work as it happens, beside your repository: what it read, ran, saw fail and edited, as the real material. So you understand the change, and your codebase, instead of trusting a summary.

**Proof points:** every one is true of Release 1. Re-check each against the shipped build before posting.

1. Real captured content, never a summary. The source it read, the output it got, the diff it wrote.
2. Live: steps appear as the agent takes them, within about a quarter of a second on ordinary sessions (LIVE-7/7b p95).
3. Three harnesses in one place: Claude Code and Codex (live, replay, and the composer for sessions Drishya drives), plus Antigravity sessions, read-only.
4. Developer tools around it: the Files tree and a peek with each file's earlier changes, Workspace, Git review, Compare for branches and PRs, the Git graph, search, and questions answered in place.
5. Local and private: everything stays on your machine. No telemetry, not even opt-out. It listens on loopback only, and secrets are redacted before anything is stored. A 582-test security suite backs this up.
6. Fast on huge sessions: a 959 MB session shows its latest work in about a second, the rest loading quietly (PERF-4: first data in 0.76 s, first paint 1.1 to 2 s).
7. Free and open source (Apache-2.0).

**What we never say:**
- "reads the agent's mind" or "shows its reasoning": harnesses mostly don't record it;
- any comparison number we haven't measured;
- "works with every agent";
- anything about features in the next release (the embed, more Antigravity).

**One line:** *See what your coding agent actually did, while it does it.*

**Product Hunt tagline (60 characters max):** *Watch your coding agent's real work, live, beside your repo* (58)

---

## 2. The story every video follows

1. **The familiar moment** (2 to 5 s): a terminal fills with agent text; the developer scrolls, lost.
2. **The turn:** "What did it actually do?" Drishya opens on the same session.
3. **The proof:** real material arrives live: a file read, a test run that fails, the edit, the re-run that passes, each where it happened on the repository's map.
4. **The tools:** jump to a file and see who changed it and why, review the Git change, search the session.
5. **The trust line:** local, private, no telemetry, open source.
6. **The ask:** one command to try it, and the GitHub link.

---

## 3. The videos

All are made from genuine captures on a throwaway public demo repository. No generated or mock UI, ever (doctrine: the *truth* test).

| # | Video | Length and format | Where | Purpose |
|---|---|---|---|---|
| V1 | **Hook** | 30 to 40 s; 9:16 and 1:1 cuts | X, LinkedIn native, Reddit, YouTube Shorts | Stop the scroll: the agent text wall, then Drishya, live |
| V2 | **Launch film** | 90 to 120 s; 16:9, with a 1:1 cut | LinkedIn company and personal accounts, Product Hunt, README, the site | The whole story (section 2), with a voiceover |
| V3 | **Walkthrough** | 6 to 10 min; 16:9 with chapters | YouTube, linked from HN, dev.to and the PH comment | One real task end to end, for people who want depth |
| V4 | **Side by side** | 45 to 60 s; 16:9 split screen | X, LinkedIn, Reddit | The same agent task: terminal only versus Drishya |
| V5–V10 | **Feature shorts** | 15 to 30 s each; 1:1 | One every two days after launch | Files peek and history, Git review and Compare, search, questions, the live speed, three harnesses |

### Scripts (voiceover in the builders' own voices; captions always burned in)

**V1, Hook (35 s)**
- 0–4 s: the terminal scrolling agent text. Caption: "Your agent just changed 14 files."
- 4–7 s: caption: "Do you know what it did?"
- 7–25 s: Drishya live on the same session: read → run → fail (red) → edit → pass, with prose rising underneath. Tight zooms.
- 25–32 s: the Files peek on an edited file, showing its earlier changes. Caption: "Every read, run and edit. Real, live, local."
- 32–35 s: the logo, "Drishya, open source", the link.

**V2, Launch film (110 s)**
1. 0–8 s: the familiar moment.
2. 8–20 s: Yash or Harsh: "We use coding agents all day. The agent knows the change; we didn't. So we built Drishya."
3. 20–55 s: the proof (section 2, beat 3) on a live Claude Code session.
4. 55–75 s: a Codex session, then an Antigravity session on Home: "the same view for Claude Code, Codex and Antigravity".
5. 75–95 s: the tools: Files peek, Git review, Compare, search, a question answered in place.
6. 95–105 s: "Everything stays on your machine. No telemetry. Open source."
7. 105–110 s: the install command and the GitHub link.

**V3, Walkthrough (8 min, chapters)**
1. Why (0:00).
2. Install (0:40).
3. A real task live: fix a failing test and add a small feature (1:20).
4. Reading it back: Work and Conversation (3:30).
5. Files, peek and history (4:30).
6. Git review, Compare and the graph (5:30).
7. Search and questions (6:30).
8. Privacy and how it works locally (7:15).
9. Try it (7:45).

Unscripted narration over a real run; cut dead time only.

**V4, Side by side (50 s):** the same prompt run twice, split screen. Left: the terminal only. Right: Drishya. No voice, just captions on the right ("read `auth.ts`", "test failed", "edited 3 lines") and a final card. Don't claim the agent is faster or better; the point is visibility.

**V5–V10:** one feature each, 20 s, the same caption style, ending on the link.

---

## 4. Tools and skills for making the videos

Decided for quality, truth and privacy (real sessions must not leak). Two to five people, no budget assumed.

| Job | Tool | Why |
|---|---|---|
| Capture the Drishya UI | **Our own Playwright-driven capture** of the real running app, the same method SITE-2 used (native pointer receipts, deterministic cursor), at 2560×1440 60 fps | Repeatable takes, exact cursor paths, zoom headroom; nothing third-party sees the screen |
| Capture the terminal and harness apps | **OBS Studio** (free; Windows and Mac) or **Cap** (open source, with auto zoom) at 2560×1440 60 fps | The terminal-only half of V4 and the harness windows in V2 |
| Compose the short and mid videos (V1, V2, V4, V5–V10) | **Remotion**, through its official Claude Code agent skills (`remotion-dev/skills`) | Videos as React code: captions, title cards, split screen and zoom tracks that Claude, Codex or Antigravity can write and re-render when copy changes. Check Remotion's licence (free for very small companies) before use |
| Edit the long walkthrough (V3) | **DaVinci Resolve** (free) | A manual cut, chapters, audio clean-up and voice isolation |
| Voice | The builders' own voices, with a decent USB mic, cleaned in Resolve | Developer audiences trust a real maker's voice over text-to-speech |
| Captions | **whisper.cpp** locally → SRT → Remotion or Resolve | Local transcription keeps the narration private; most people watch muted |
| Music | Quiet, royalty-free (YouTube Audio Library) | Under the voice, never over it |
| Thumbnails and post images | HTML templates with the approved SITE-2 product frames, rendered to PNG with Playwright and designed with the installed **taste-skill**, **impeccable** and **emil-design-eng** skills | One consistent look and real frames, re-rendered per size |

**Not used:**
- generative video (Veo, Sora, Higgsfield): fake UI breaks the truth rule;
- storyboard-to-MP4 and text-to-speech demo MCPs (aidemo, AIOProductOS Studio, Agent Opus): they would replace our own capture and voice and run on someone else's service;
- "brag": no MCP or skill by that name could be found on 15 Nov. If Yash has a link, Fable evaluates it against this table.

**Who does what:**
- The builders record their voices and press record.
- An agent writes the Remotion compositions, captions, crops and thumbnail templates.
- The builders review every frame.

### Recordings to capture before the edit (do these on 16 Nov)

**Set-up:**
- A throwaway public demo repository (a small, real-looking app with a failing test). Keep it at a neutral path such as `C:\demo\…`, never under a personal folder.
- A **scratch Drishya home** that contains only the demo sessions, so Home shows nothing private.
- A browser profile with no personal tabs or bookmarks; system notifications off; the clock hidden or neutral.

**Shot list:**
1. Claude Code live: read → run → fail → edit → pass. Takes at 1440 and 2560 wide.
2. Codex live: a different small task on the same repository.
3. An Antigravity session (read-only) shown on Home and opened.
4. Work ↔ Conversation switching mid-session.
5. The map with an edited file lit, and the Files peek with its earlier changes.
6. Git review, Compare (branch versus main) and the Git graph.
7. Search across the session; a question card answered in place.
8. A very large session opening at once (use a synthetic large fixture, not a real private session).
9. The same prompt run in a terminal only, for V4.
10. The install command on a clean terminal.

---

## 5. Accounts and posts

### Accounts

- **Company page "Drishya"** (LinkedIn, X, YouTube, Product Hunt maker profile). Create the LinkedIn page and the YouTube channel before D0, with the logo, the one line, the GitHub link and the site.
- **Yash and Harsh personal accounts:** each posts in their own voice on D0, tags the other and the company page. LinkedIn has no true co-authored post, so we use two personal posts on different angles, a company post that both reshare with a line of their own, and comments under each other's posts within the first hour.
- **LinkedIn Premium:** one Premium Business on Yash's account for launch month (InMail outreach, profile and post analytics). Harsh joins only if outreach volume needs it. Skip Sales Navigator and the paid company page at launch.

### Post drafts

Install line is a placeholder: use SHIP-9's exact command.

**LinkedIn: company page (D0, with V2)**
> Coding agents do the work. You get a wall of text.
>
> Drishya shows you what your agent actually did, while it does it: every file it read, every command it ran, the test that failed and the edit that fixed it. Real material, live, on a map of your own repository.
>
> • Claude Code and Codex, live and replayed; Antigravity sessions too
> • Files, Git review, Compare, search, beside the agent's work
> • Local only. No telemetry. Open source (Apache-2.0)
>
> Try it: `<install command>` · github.com/drishya-dev/drishya

**LinkedIn: Yash (D0, personal story, with V2 or V1)**
> I've spent the last months building with coding agents every day, and one thing kept bothering me: after a long session, the agent "knew" the change and I didn't. I'd either trust it or spend twenty minutes reconstructing what happened.
>
> So Harsh and I built Drishya. It plays the agent's real work (what it read, ran, saw fail and edited) live, beside your repository. Not a summary: the actual material.
>
> It's free, open source and runs entirely on your machine. We'd love your honest feedback.
> `<install command>` · github.com/drishya-dev/drishya · with @Harsh

**LinkedIn: Harsh (D0, the builder's angle, with V4)**
> Same agent, same task, two views. On the left, what you normally see. On the right, Drishya: every read, run and edit as it happens.
>
> We built it to read local Claude Code, Codex and Antigravity sessions without touching them, store nothing outside your machine, and stay fast on sessions of almost a gigabyte. Open source, Apache-2.0. Feedback very welcome. With @Yash

**X: launch thread (D0, from the company account; the builders quote it)**
1. Your coding agent just changed 14 files. Do you know what it did? Drishya shows you, live. [V1]
2. Every file it read, command it ran, test that failed and edit that fixed it: the real material, on a map of your repo.
3. Claude Code and Codex live and replayed; Antigravity sessions too. Files, Git review, Compare and search beside it.
4. 100% local. No telemetry. Open source. `<install command>` · github.com/drishya-dev/drishya

**Show HN (D0, 08:30 ET; post from Yash's account)**
- **Title:** `Show HN: Drishya – see what your coding agent did, live, beside your repo`
- **Link:** the GitHub repository.
- **First comment** (posted immediately, plain, no marketing words):
  - who we are, and why we built it (the "agent knows the change, I don't" moment);
  - what it reads (local journals, opened read-only) and how it works (a zero-dependency Node daemon on loopback, redaction before storing, no telemetry);
  - what it does not do yet (the embed, deeper Antigravity, Linux and macOS tested less);
  - what feedback we want.
  - Stay in the thread for the first three hours and answer everything.

**Product Hunt (D+1, 00:01 PT)**
- **Tagline:** *Watch your coding agent's real work, live, beside your repo*
- **Description (260 characters max):** *Drishya plays what Claude Code, Codex and Antigravity actually did (files read, commands run, failures, edits) live on a map of your repository, with Files, Git review and search beside it. Local only, no telemetry, open source.*
- **Gallery:**
  1. V2 as the video;
  2. 5 frames from SITE-2's approved set (live work, Files peek, Git review, Compare, three harnesses), each with a 4-word headline.
- **Maker comment:** a shorter version of the Show HN comment, plus a thank-you line.
- **Topics:** Developer Tools, Open Source, Artificial Intelligence.

**Reddit (D+2, one community at a time, a few hours apart, posted by a builder as a person, each text written for that community):**

| Community | Angle | Check first |
|---|---|---|
| r/ClaudeAI | "Built a live view of what Claude Code actually does in a session." V1 plus the text | The weekly self-promotion rule or flair |
| r/ChatGPTCoding | "See what Codex and Claude Code did: a local, open-source viewer." V4 | Self-promotion rules |
| r/opensource | The open source, local, no-telemetry design | Must be OSS: it is |
| r/SideProject | The builders' story | None special |
| r/webdev | Only on **Showoff Saturday** | Its Saturday-only rule |
| r/coolgithubprojects | The GitHub link | None special |

Skip r/programming: launch posts are usually removed there. Every post answers comments for the first two hours. Never cross-post the same text, never ask for upvotes, and never use alternate accounts.

**dev.to (D+2)** carries two articles.
1. "Why we built Drishya: understanding the agent's work while it happens." This is the story, with V3 embedded.
2. "Reading three coding-agent journals live, read-only, with a zero-dependency Node daemon." A technical piece on tailing and folding, the redaction-first store, loopback security and the speed numbers. It is the one most likely to be shared.

**YouTube.** Upload V3 on D0 and V1 as a Short. Titles:
- *Drishya: see what your coding agent did, live (full walkthrough)*
- *Your agent changed 14 files. Here's what it did.*

The descriptions carry chapters, the install line, the GitHub link and a privacy line.

**Newsletters and lists, from D+1.** These submissions are the builders' to send, never an agent's:
- Console.dev (dev tools);
- TLDR's submission form;
- Changelog News;
- a PR to the awesome-claude-code style lists, following each list's rules.

**Outreach (Premium InMail, D+1 to D+7).** A short personal note, never a template blast, to:
- 20 to 30 developers who post about Claude Code and Codex workflows;
- a few dev-tool newsletter writers.

---

## 6. When to post

The audience is global and US-heavy: 08:30 ET is 19:00 IST.

**D0 = Wednesday 18 Nov 2026 (Yash, 15 Nov).** So: Show HN and the LinkedIn and X posts at 08:30 ET (19:00 IST) on 18 Nov, Product Hunt on 19 Nov, and Reddit and dev.to on 20 Nov. It needs SEC-5, SEC-4, SHIP-9, REPO-1, PUBLIC-1 and SHIP-10 done by the evening of 17 Nov. If any slips, D0 moves to Tue 24 Nov. Never launch on an unfinished build.

Original rule:
- If shipping finishes on 17 Nov: **Wed 18 Nov 2026**.
- If not, **Tue 24 Nov** (avoid the US Thanksgiving week's Thursday and Friday).

| When | What |
|---|---|
| D-2 | The company pages are live; the repository is public (PUBLIC-1); the README carries V1 as a GIF and the install line works from a clean machine |
| D0 08:30 ET | Show HN; GitHub public; the LinkedIn company post with V2; Yash's and Harsh's posts within 30 minutes; the X thread; YouTube V3 and V1 |
| D0 +1 to 3 h | Builders answer HN and LinkedIn comments; reshare each other's posts with their own line |
| D+1 00:01 PT | Product Hunt; LinkedIn and X posts pointing to it; newsletters submitted |
| D+2 | Reddit, one community every few hours; the two dev.to articles |
| D+3 to D+14 | One feature short (V5–V10) every two days on LinkedIn and X; replies to every issue and comment |
| D+7 | A "week one" post: what people asked for, what we fixed, real numbers (stars, installs) only if they are flattering *and* true |

Don't launch HN and Product Hunt on the same day: both need the builders in the comments.

---

## 7. Design of posts and thumbnails

- **One system,** taken from the product:
  - a graphite or black ground, one sans and one mono typeface;
  - colour only for meaning (pass, fail, edited, each harness's colour);
  - the logo;
  - **real product frames only** (SITE-2's approved set plus the 16 Nov captures).
- **The headline** is 3 to 6 words, set large, over or beside one frame, never a collage. For example: "What did your agent do?", "Every read, run and edit", "Live. Local. Open source."
- **Sizes,** one template rendered per size:

  | Use | Size |
  |---|---|
  | LinkedIn image | 1080×1350 |
  | LinkedIn link | 1200×627 |
  | X | 1600×900 |
  | Product Hunt gallery | 1270×760 |
  | YouTube thumbnail | 1280×720 |
  | Square video | 1080×1080 |
  | Vertical video | 1080×1920 |

- **Captions** on every video: the sans typeface, white on a 60% black band, at most two lines, never covering the material that is the point of the shot.
- **Accessibility:** alt text on every image post, and captions on every video.

---

## 8. What is decided and what Yash and Harsh choose

- **Decided (Fable):**
  - the audience and message;
  - the story;
  - the six video types and their lengths;
  - the tool stack;
  - the shot list;
  - the platforms and order;
  - the design system.
- **For Yash and Harsh:**
  1. ~~D0: 18 or 24 Nov.~~ **18 Nov** (Yash, 15 Nov).
  2. Who posts Show HN (proposed: Yash).
  3. The voice of V2: one builder or both.
  4. Final wording of each post.
  5. Whether to buy Premium now or at D-2.
- **Left for 16 and 17 Nov:** recording (section 4's shot list) and the edit. VIDEO-1 is that work; SHIP-11 is publishing section 5 on section 6's schedule.
