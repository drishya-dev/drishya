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

## 3. The video: one film, and cuts from it

**Revised 15 Nov (Yash: "shouldnt it be less or one video that gives the whole impression of the product?").** Agreed: one film, not five productions.
- A launch is judged by one strong video, and two builders on a tight date should make one excellent film rather than four average ones.
- Every other piece is a cut of the same edit, so it costs no new production.
- The long walkthrough is dropped for launch. The README, the site and the comment threads answer "how does it work". Make it after week one only if people ask.
- The side-by-side becomes the film's opening.

| Piece | Length and format | Where | Made from |
|---|---|---|---|
| **The film** | 75 to 90 s; 16:9, with 1:1 and 9:16 versions | README, the site, Product Hunt, LinkedIn (company and both personal accounts), YouTube | The whole story (section 2) |
| **The 30 s cut** | 30 s; 9:16 and 1:1 | X, Reddit, YouTube Shorts, the README GIF (silent) | The film's opening and its proof section |
| **The side-by-side cut** | 20 s; 16:9 | Harsh's LinkedIn post, X, r/ChatGPTCoding | The film's opening, terminal versus Drishya |
| **The feature cuts** | 15 to 20 s each, four or five of them; 1:1 | One every two days after launch | The film's tools section, slightly longer per feature |

### The film's script (80 s; no narration, captions plus quiet product sound)

1. **0–10 s, split screen.** Left: the same agent task in a terminal, text scrolling. Right: Drishya. Caption: "Your agent just changed 14 files. Do you know what it did?"
2. **10–40 s, Drishya full frame, a live Claude Code session.** It reads a file, runs the tests, a test fails (red), it edits, the tests pass, and its prose rises beneath, each step on the repository map. Captions name each step in 2 to 4 words.
3. **40–52 s, three harnesses.** A Codex session live, then Home with Claude Code, Codex and Antigravity sessions. Caption: "Claude Code, Codex and Antigravity."
4. **52–70 s, the tools.** The Files peek on the edited file and its earlier changes, Git review, Compare, search, then a question answered in place. One caption each.
5. **70–76 s.** Caption: "Everything stays on your machine. No telemetry. Open source."
6. **76–80 s.** The logo, the install command and the GitHub link.

### Voice: no AI voice, and no narration in the film (decided 15 Nov)

- **Not an AI voice.** The audience is developers wary of AI-generated content, and the product's whole claim is *real, not generated*. A synthetic voice is detectable, and it undercuts that claim in the first seconds. Product Hunt and HN comments also call it out.
- **No narration in the film at all.** Most LinkedIn and X video is watched muted. Captions plus the product's own quiet sounds carry the story at any volume. It also needs no recording booth, no retakes and no accent worries, and the same cut works everywhere.
- **The builders' real voices** go where a voice adds trust: a 10 to 20 s face-to-camera or voice note at the top of Yash's LinkedIn post (optional), the Show HN and Product Hunt comments in their own words, and the walkthrough if it is made later.

## 4. Tools and skills for making the videos

Decided for quality, truth and privacy (real sessions must not leak). Two to five people, no budget assumed.

| Job | Tool | Why |
|---|---|---|
| Capture the Drishya UI | **Our own Playwright-driven capture** of the real running app, the same method SITE-2 used (native pointer receipts, deterministic cursor), at 2560×1440 60 fps | Repeatable takes, exact cursor paths, zoom headroom; nothing third-party sees the screen |
| Capture the terminal and harness apps | **OBS Studio** (free; Windows and Mac) or **Cap** (open source, with auto zoom) at 2560×1440 60 fps | The terminal half of the film's opening and the harness windows in the film |
| Compose the film and every cut | **Remotion**, through its official Claude Code agent skills (`remotion-dev/skills`) | Videos as React code: captions, title cards, split screen and zoom tracks that Claude, Codex or Antigravity can write and re-render when copy changes. Check Remotion's licence (free for very small companies) before use |
| Final colour, sound mix and export (and a later walkthrough, if made) | **DaVinci Resolve** (free) | Fine timing, product-sound levels and the export per format |
| Voice | None in the film; no AI voice anywhere (see section 3). The builders' own voices only for the optional LinkedIn intro and a later walkthrough | Captions carry the film muted; a synthetic voice undercuts "real, not generated" |
| Captions | Written by hand from the script, set in Remotion | No narration to transcribe; whisper.cpp only if a voiced piece is made later |
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
9. The same prompt run in a terminal only, for the side-by-side cut.
10. The install command on a clean terminal.

---

## 5. Accounts and posts

### Accounts

- **Company page "Drishya"** (LinkedIn, X, YouTube, Product Hunt maker profile). Create the LinkedIn page and the YouTube channel before D0, with the logo, the one line, the GitHub link and the site.
- **Yash and Harsh personal accounts:** each posts in their own voice on D0, tags the other and the company page. LinkedIn has no true co-authored post, so we use two personal posts on different angles, a company post that both reshare with a line of their own, and comments under each other's posts within the first hour.
- **LinkedIn Premium:** one Premium Business on Yash's account for launch month (InMail outreach, profile and post analytics). Harsh joins only if outreach volume needs it. Skip Sales Navigator and the paid company page at launch.

### Post drafts

Install line is a placeholder: use SHIP-9's exact command.

**LinkedIn: company page (D0, with the film)**
> Coding agents do the work. You get a wall of text.
>
> Drishya shows you what your agent actually did, while it does it: every file it read, every command it ran, the test that failed and the edit that fixed it. Real material, live, on a map of your own repository.
>
> • Claude Code and Codex, live and replayed; Antigravity sessions too
> • Files, Git review, Compare, search, beside the agent's work
> • Local only. No telemetry. Open source (Apache-2.0)
>
> Try it: `<install command>` · github.com/drishya-dev/drishya

**LinkedIn: Yash (D0, personal story, with the film or the 30 s cut)**
> I've spent the last months building with coding agents every day, and one thing kept bothering me: after a long session, the agent "knew" the change and I didn't. I'd either trust it or spend twenty minutes reconstructing what happened.
>
> So Harsh and I built Drishya. It plays the agent's real work (what it read, ran, saw fail and edited) live, beside your repository. Not a summary: the actual material.
>
> It's free, open source and runs entirely on your machine. We'd love your honest feedback.
> `<install command>` · github.com/drishya-dev/drishya · with @Harsh

**LinkedIn: Harsh (D0, the builder's angle, with the side-by-side cut)**
> Same agent, same task, two views. On the left, what you normally see. On the right, Drishya: every read, run and edit as it happens.
>
> We built it to read local Claude Code, Codex and Antigravity sessions without touching them, store nothing outside your machine, and stay fast on sessions of almost a gigabyte. Open source, Apache-2.0. Feedback very welcome. With @Yash

**X: launch thread (D0, from the company account; the builders quote it)**
1. Your coding agent just changed 14 files. Do you know what it did? Drishya shows you, live. [the 30 s cut]
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
  1. the film as the video;
  2. 5 frames from SITE-2's approved set (live work, Files peek, Git review, Compare, three harnesses), each with a 4-word headline.
- **Maker comment:** a shorter version of the Show HN comment, plus a thank-you line.
- **Topics:** Developer Tools, Open Source, Artificial Intelligence.

**Reddit (D+2, one community at a time, a few hours apart, posted by a builder as a person, each text written for that community):**

| Community | Angle | Check first |
|---|---|---|
| r/ClaudeAI | "Built a live view of what Claude Code actually does in a session." the 30 s cut plus the text | The weekly self-promotion rule or flair |
| r/ChatGPTCoding | "See what Codex and Claude Code did: a local, open-source viewer." the side-by-side cut | Self-promotion rules |
| r/opensource | The open source, local, no-telemetry design | Must be OSS: it is |
| r/SideProject | The builders' story | None special |
| r/webdev | Only on **Showoff Saturday** | Its Saturday-only rule |
| r/coolgithubprojects | The GitHub link | None special |

Skip r/programming: launch posts are usually removed there. Every post answers comments for the first two hours. Never cross-post the same text, never ask for upvotes, and never use alternate accounts.

**dev.to (D+2)** carries two articles.
1. "Why we built Drishya: understanding the agent's work while it happens." This is the story, with the film embedded.
2. "Reading three coding-agent journals live, read-only, with a zero-dependency Node daemon." A technical piece on tailing and folding, the redaction-first store, loopback security and the speed numbers. It is the one most likely to be shared.

**YouTube.** Upload the film on D0 and the 30 s cut as a Short. Titles:
- *Drishya: see what your coding agent did, live*
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
| D-2 | The company pages are live; the repository is public (PUBLIC-1); the README carries the 30 s cut as a GIF and the install line works from a clean machine |
| D0 08:30 ET | Show HN; GitHub public; the LinkedIn company post with the film; Yash's and Harsh's posts within 30 minutes; the X thread; YouTube: the film and the Short |
| D0 +1 to 3 h | Builders answer HN and LinkedIn comments; reshare each other's posts with their own line |
| D+1 00:01 PT | Product Hunt; LinkedIn and X posts pointing to it; newsletters submitted |
| D+2 | Reddit, one community every few hours; the two dev.to articles |
| D+3 to D+14 | One feature cut every two days on LinkedIn and X; replies to every issue and comment |
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
  3. ~~The voice of the film.~~ Decided: no narration and no AI voice (section 3). Only whether Yash adds the optional 15 s intro.
  4. Final wording of each post.
  5. Whether to buy Premium now or at D-2.
- **Left for 16 and 17 Nov:** recording (section 4's shot list) and the edit. VIDEO-1 is that work; SHIP-11 is publishing section 5 on section 6's schedule.
