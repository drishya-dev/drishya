# SHIP-11: every launch post, final text

Written by Fable, 16 Nov 2026, from [the MARKET-1 plan](market-1-plan.md). These are the texts to post, not samples. Yash and Harsh may change any wording, but every fact must stay true of the shipped build. **Only Yash and Harsh publish (REL-4).**

**Private launch material:** archived, never in the public tree.

## 0. Before posting: the facts to recheck

Recheck each fact on the frozen candidate the evening before D0 and change the text where a number moved.

| Fact used below | Source |
|---|---|
| Install: `npm install -g @drishya-dev/cli`, then `drishya` | SHIP-9; README *Install from npm* |
| Node 24; built and tested on Windows 11; Linux and macOS less tested | README *Requirements*; SHIP-16 may change this line |
| Claude Code and Codex: live, replay, and prompts to sessions Drishya drives; Antigravity: replay only | README *Agents* table |
| Live steps arrive in about a quarter of a second (p95) | LIVE-7/7b |
| A 959 MB session shows its latest work in about a second | PERF-4 |
| 673 security tests pass. A first penetration pass found 8 problems, 2 rated high, and each was fixed with a regression test | SEC-3, SEC-4a #505 |
| No telemetry; loopback only; secrets redacted before storing; Apache-2.0 | README *Privacy*, LICENSE |

Placeholders to fill on the day:
- `<film>`: the 90 s film;
- `<30s>`: the 30 s cut;
- `<sbs>`: the side-by-side cut;
- `<frame N>`: an approved product frame.

Links are always `github.com/drishya-dev/drishya` and the site.

---

## 1. The pre-release step (D-1 and earlier)

**Decision:**
- Do the free, no-risk pre-release steps now: the Product Hunt upcoming page and the company pages.
- Post **one** teaser, on LinkedIn only, from Yash, at 19:00 IST the day before D0. LinkedIn rewards a post whose network already engaged that week, and a teaser seeds the people who will comment in the launch post's first hour. That first hour is what decides LinkedIn reach.
- Do not tease on HN, Reddit or Product Hunt itself. HN and Reddit punish pre-announcement, and a Product Hunt launch is one day.
- Post the teaser only once the final whole test is green. If D0 is not certain by then, post it without a date ("this week").

**1a. Product Hunt upcoming page (create today).** It collects followers who are notified when the launch goes live.
- **Name:** Drishya
- **Tagline:** See what your coding agent is doing, and review it properly
- **Short description:** *A local, open-source view of what Claude Code and Codex actually do (every file read, command run, failure and edit), live, beside your repository. Launching soon.*
- **Image:** `<frame 1>` with the logo.

**1b. Company pages (create today).**
- **LinkedIn page "Drishya":**
  - Tagline: *See what your coding agent is doing, and review it like an engineer.*
  - About (one paragraph): *Drishya is a free, open-source app that shows what a coding agent read, ran, saw fail and changed, as it happens, beside your repository. It runs on your machine, records nothing for us, and works with Claude Code and Codex, with Antigravity sessions replayed.*
  - Website: the site; logo and cover from `assets/brand/`.
- **X @drishya** (or the closest free handle), with the same bio and a pinned post on D0.
- **YouTube channel "Drishya",** with the same bio.

**1c. LinkedIn teaser, Yash, D-1 19:00 IST.** Attach one short screen clip (10 to 15 s of a live session in Drishya) or `<frame 1>`.

> For the last few months I've been building with coding agents every day. The thing that bothered me most wasn't the code they wrote. It was that after a long session, the agent knew the change and I didn't.
>
> Tomorrow, Harsh Jain and I are releasing what we built to fix that: Drishya. It shows what your agent actually reads, runs and changes, live, beside your code, so you understand the work while it happens instead of reconstructing it afterwards.
>
> Free, open source, and it runs entirely on your machine.
>
> If you code with Claude Code or Codex, I'd really value you trying it tomorrow and telling us what's missing. Follow the Drishya page so you see it go live.

**Harsh's comment under it:** *Tomorrow at 7 pm IST. The live view on a real Codex session is the part I'm proudest of. We'll be in the comments all evening.*

---

## 2. D0: LinkedIn

**2a. Company page, 19:00 IST, with `<film>`**

> Coding agents now write a large share of the code. What you get back is a wall of text and "Done".
>
> Drishya shows you what your agent actually did, while it does it: every file it read, every command it ran, the test that failed and the edit that fixed it. Not a summary: the real material, beside your repository.
>
> Then it gives you the tools to review that work like an engineer:
> → Open the file the agent is reading, with that file's earlier changes and the session that made them
> → Review the change, compare branches and pull requests, follow the Git graph
> → Search every session, answer the agent's questions in place, and send the next prompt
>
> Claude Code and Codex, live and replayed. Antigravity sessions replayed.
>
> It runs on your machine, with no telemetry at all, and it is open source (Apache-2.0).
>
> npm install -g @drishya-dev/cli
> github.com/drishya-dev/drishya
>
> Built by Yash Doke and Harsh Jain. Tell us what you'd want it to show next.

Alt text for the film: *Drishya showing a live coding-agent session: the files it reads appear beside the repository, a test fails, the agent edits the code and the test passes, then the developer reviews the change.*

**2b. Yash, personal, 19:05 IST, with `<film>` or `<30s>`**

> Today Harsh and I are releasing Drishya, and I want to explain why it exists.
>
> I've built with Claude Code and Codex almost every day this year. After a long agent session I had two choices: trust the change, or spend twenty minutes reconstructing what happened from a terminal transcript. The agent knew the change. I didn't.
>
> That's a strange way to build software. Code review, debugging and owning a codebase all depend on understanding it. With agents, how the work was done (what the agent searched, opened, ran and saw fail) has become part of the evidence, the way a PR description is for a human's change.
>
> So Drishya shows it. You watch your agent work live, with the real material: the source it read, the output it got, the diff it wrote. Beside that is everything you need to reason about it: the file it's reading with its history, a Git review of the change, Compare for branches and PRs, the Git graph and search.
>
> It's free, open source (Apache-2.0), and everything stays on your machine. There is no telemetry, not even an opt-out, because there's nothing to opt out of.
>
> If you code with agents, try it and tell me honestly what's missing. Every comment gets a reply from one of us.
>
> npm install -g @drishya-dev/cli
> github.com/drishya-dev/drishya
>
> Built with Harsh Jain. Company page: Drishya

**2c. Harsh, personal, 19:15 IST, with `<sbs>`**

> Same agent, same task, two views.
>
> On the left is what you normally get: a terminal scrolling past. On the right is Drishya: every read, run and edit appearing as it happens, beside the repository, with the real file content and the real test output.
>
> A few things we cared about while building it:
> • It only reads. Drishya opens your agent's session files read-only and never edits them, your code or your settings.
> • It stays local. It listens on your own machine only, redacts secrets before anything is stored, and sends nothing anywhere.
> • It stays fast. A 959 MB session shows its latest work in about a second.
> • It's checked. 673 security tests pass, and a penetration pass before release found eight problems, which we fixed, each with a test so it can't come back.
>
> Claude Code and Codex live, Antigravity replayed. Open source, Apache-2.0.
>
> github.com/drishya-dev/drishya. Built with Yash Doke. Feedback very welcome, especially the critical kind.

**2d. Reshares (within the first hour):**
- **Yash reshares the company post:** *We built the tool we wanted for our own agent sessions. Here it is.*
- **Harsh reshares it:** *Two months of evenings, now open source. Try it on your next agent session.*
- **Each builder** comments on the other's post with one concrete detail (Yash: the file history beside the agent; Harsh: the read-only design). No "great post".

---

## 3. D0: X (company account, 19:00 IST; builders quote-post)

Thread, with `<30s>` on post 1:

1. Your coding agent just changed 14 files.

   Do you know what it did?

   Drishya shows you: live, beside your code. Open source.
2. Every file it read. Every command it ran. The test that failed and the edit that fixed it.

   The real material, not a summary.
3. Then review it like an engineer: the file it's reading with its history, the change in Git review, Compare for branches and PRs, the Git graph, search across sessions.
4. Claude Code and Codex, live and replayed. Antigravity sessions replayed.

   Everything stays on your machine. No telemetry. Apache-2.0.
5. Try it:

   npm install -g @drishya-dev/cli

   github.com/drishya-dev/drishya

**Yash's quote-post:** *After months of agent sessions where the agent knew the change and I didn't, we built this. Feedback welcome.*

**Harsh's quote-post:** *It opens your agent's session files read-only, runs only on your machine, and stays fast on sessions near a gigabyte. Here's what it looks like.*

---

## 4. D0: Show HN (Yash's account, 08:30 ET = 19:00 IST)

- **Title:** `Show HN: Drishya – see what your coding agent did, live, beside your repo`
- **URL:** `https://github.com/drishya-dev/drishya`
- **First comment** (post it immediately):

> Hi HN. Harsh and I built Drishya because after long Claude Code and Codex sessions we kept ending up in the same place: the agent "knew" the change and we didn't. We either trusted it or scrolled back through a terminal transcript.
>
> Drishya reads the session journals those tools already write on your machine, opened read-only, and plays the work back as real content: the file contents the agent read, the command output it got, the diffs it wrote, in order and live as they happen. Around that are the tools to check the work: the file it's reading with that file's earlier changes, a Git review of the change, branch and PR compare, a Git graph and search. For Claude Code and Codex sessions that you start from Drishya, you can also answer the agent's questions and send the next prompt. Antigravity sessions are replay-only for now.
>
> How it works: a Node 24 daemon with zero runtime dependencies tails the journals, folds them into a projection, and stores them in node:sqlite. Secrets are redacted on the way in, before anything touches SQLite, search or the screen. The UI is React and is served on 127.0.0.1 only. Every data request needs a launch token that is exchanged for an HttpOnly, SameSite=Strict cookie, wrong Host headers and foreign Origins are refused, and there are no CORS headers. There is no telemetry of any kind. Before release we wrote a security suite (673 tests), and a penetration pass found eight problems. Two were serious: a crafted `.git` file could point Drishya at a different repository, and the launch token was visible in the browser launcher's arguments. Both are fixed, with regression tests.
>
> Limits, honestly: it's built and tested on Windows 11. Linux and macOS should work (no native add-ons) but have had much less testing. Harnesses mostly no longer record the model's reasoning, so Drishya shows what the agent did, not what it "thought".
>
> We'd love to hear what you'd want to see in a session that it doesn't show yet, and which harness to support next.

- **Rules for the thread:**
  - Answer every comment for the first three hours, with technical answers and no marketing words.
  - Never ask for upvotes, and never share the link asking for votes.

---

## 5. D+1: Product Hunt (00:01 PT = 13:31 IST)

- **Name:** Drishya
- **Tagline (59 characters):** See what your coding agent is doing, and review it properly
- **Description (under 260 characters):** *Drishya plays what Claude Code and Codex actually did (files read, commands run, failures, edits) live, beside your code, with Files, Git review, Compare and search to review it. Antigravity replayed. Local only, no telemetry, open source.*
- **Topics:** Developer Tools, Open Source, Artificial Intelligence
- **Media:** `<film>` first, then five frames, each with a 4-word headline:
  - *Watch it work live*: the live session;
  - *Read what it read*: the file peek with history;
  - *Review like an engineer*: Git review;
  - *Compare branches and PRs*: Compare;
  - *Every agent, one place*: Home with three harnesses.
- **Maker comment (Yash):**

> Hi Product Hunt! I'm Yash, and I built Drishya with Harsh.
>
> Coding agents do a lot of work you never see: dozens of files read, commands run, tests failed and fixed. By the end, the agent knows the change and you don't. Drishya shows that work as it happens, with the real content beside your repository, plus the tools to review it: the file's history, Git review, branch and PR compare, the Git graph and search.
>
> It's free and open source, it runs entirely on your machine, and it has no telemetry.
>
> What would you want to see in your agent's sessions that it doesn't show yet? We're reading every comment today.

- **LinkedIn and X posts on D+1:**

> We're on Product Hunt today. If Drishya helped you understand an agent session this week, a comment there with what worked (or didn't) means a lot to us. [link]

---

## 6. D+2: Reddit (one community every few hours, posted by a builder as a person)

Read each community's rules the same day and use its flair. Answer comments for two hours. Never ask for upvotes.

**r/ClaudeAI.** Post as a video post with `<30s>`, or as text if video is not allowed.
- **Title:** I built a live view of what Claude Code actually does in a session (open source, runs locally)
- **Text:**

> After long Claude Code sessions I kept losing track of what it actually did: which files it read, what it ran, what failed before it fixed it. So my friend and I built Drishya. It reads the session journal Claude Code already writes on your machine (read-only) and plays the work back as real content: file contents, command output, diffs, in order, live as they happen.
>
> Beside that are tools for checking the work: the file it's reading with its earlier changes, a Git review of the change, branch and PR compare, and search across sessions. For sessions you start from Drishya you can answer its questions and send the next prompt.
>
> It's free, Apache-2.0, has no telemetry and stays on your machine. It's built on Windows 11; Linux and macOS have had less testing. Codex works too.
>
> `npm install -g @drishya-dev/cli` · github.com/drishya-dev/drishya
>
> Feedback very welcome, especially on what you'd want to see that it doesn't show.

**r/ChatGPTCoding,** with `<sbs>`.
- **Title:** Side by side: a Codex session in the terminal vs the same session in a local viewer we built
- **Text:**

> Left: the terminal. Right: Drishya, an open-source viewer we built that reads Codex and Claude Code session journals on your machine and shows every read, command and edit as it happens, beside the repository.
>
> It's for when you want to actually understand what the agent did before you accept it: open the file it was reading with that file's history, review the change in Git, compare against a branch or PR.
>
> Read-only on your journals, local only, no telemetry, Apache-2.0. github.com/drishya-dev/drishya
>
> Happy to answer anything about how it reads the journals.

**r/opensource**
- **Title:** Drishya: an open-source, local-only viewer for what coding agents do (Apache-2.0, no telemetry)
- **Text:**

> We just open-sourced Drishya. It reads the session journals that coding agents (Claude Code, Codex, Antigravity) already write on your machine and shows the agent's real work beside your repository: files read, commands run, failures and edits.
>
> Design choices we think this community will care about:
> - zero runtime dependencies in the daemon;
> - journals opened read-only;
> - secrets redacted before anything is stored;
> - loopback only;
> - no telemetry at all;
> - Apache-2.0.
>
> Contributions are very welcome, especially adapters for other harnesses. The codebase guide explains how to add one.
>
> github.com/drishya-dev/drishya

**r/SideProject**
- **Title:** Two of us spent two months building a way to see what our coding agents actually did
- **Text:**

> We code with agents every day, and we kept hitting the same wall: the agent knew the change and we didn't. So we built Drishya. It plays an agent session back as the real material (files read, commands, failures, edits), live, beside the repository, and adds the tools to review it.
>
> It's free and open source, it runs locally, and it has no telemetry. What we learned building it: people trust what they can see. Every piece on screen is captured, never a generated summary.
>
> github.com/drishya-dev/drishya. We'd love blunt feedback.

**r/webdev,** Showoff Saturday only: the r/SideProject text with the `<30s>` clip.

**r/coolgithubprojects**
- **Title:** Drishya: see what your coding agent did, live, beside your repo (TypeScript, Apache-2.0)
- **Body:** the GitHub link and the one-line description from the repository.

**Not r/programming:** launch posts are removed there.

---

## 7. D+2: dev.to

### Article 1: Why we built Drishya

- **Tags:** ai, opensource, productivity, devtools
- **Cover:** `<frame 1>` at 1000×420

> **The agent knew the change. I didn't.**
>
> This year most of my code was written by an agent. Claude Code or Codex would take a task, work for ten or twenty minutes, and come back with "Done" and a diff across a dozen files. The diff was usually fine. That wasn't the problem.
>
> The problem was that I no longer knew my own codebase. The agent had read thirty files to decide where the change belonged. It had run the tests, seen two fail, and fixed one thing I'd never have guessed. All of that understanding lived in a transcript that scrolled past while I was doing something else.
>
> I could trust it, or spend twenty minutes reconstructing what happened. Neither is how engineering is supposed to work. Code review, debugging and ownership all depend on understanding *why* the code looks the way it does. With agents, the process (what it searched, opened, ran and saw fail) has become part of the evidence, the way a good PR description used to be.
>
> **What we built**
>
> Drishya shows that process. It reads the session journals the harness already writes on your machine, opened read-only, and presents the agent's work as the real material, in order, as it happens: the source it read, the output it got, the diff it wrote. The agent's own words sit beneath its work, unboxed.
>
> Around that we put the tools you need to reason about it:
> - the file the agent is reading, opened beside its work, with that file's earlier changes and the session that made them;
> - a Git review of the change, Compare for branches and pull requests, and the Git graph;
> - search across every session;
> - for sessions you start from Drishya, answering the agent's questions in place and sending the next prompt.
>
> **What we refused to do**
>
> We never present a generated summary as if the agent said it. Harnesses mostly don't record the model's reasoning any more, so Drishya shows what the agent *did*, not what it "thought". Every string on screen is captured content or clearly labelled.
>
> And your code doesn't leave your machine to be understood. Drishya listens only on your own machine, redacts secrets before anything is stored, and has no telemetry, not even an opt-out.
>
> **Try it**
>
> `npm install -g @drishya-dev/cli`, then run `drishya`. It's open source under Apache-2.0: github.com/drishya-dev/drishya. Tell us what you'd want to see next, and which harness we should support after Claude Code, Codex and Antigravity.

### Article 2: Reading coding-agent journals live, read-only, with a zero-dependency Node daemon

- **Tags:** node, typescript, security, opensource

> Drishya shows a coding agent's work as it happens. Under the hood that means following an append-only journal another program is writing, never modifying it, making it safe to display, and doing all of it fast enough to feel live. Here is how it works.
>
> **1. Zero runtime dependencies**
>
> The daemon is TypeScript run directly on Node 24 (type stripping, no build step for the backend) and uses only what Node ships: `node:http` with Server-Sent Events for the live stream, and `node:sqlite` (WAL mode, FTS5 for search) for the store. A tool that reads your agent sessions should have as small a supply chain as possible, and a dependency-free daemon is easy to audit. A test asserts that it stays at zero.
>
> **2. Read-only by construction**
>
> Claude Code, Codex and Antigravity each write their own journal format. Drishya opens them read-only and copies what it needs into its own store. It never edits a journal, a config file or your code. Each read takes the file size, identity and contents from a single open handle, so a file swapped mid-read can't mix two files' data.
>
> **3. Redaction before persistence**
>
> Secrets are scrubbed in the ingest path, before SQLite, the blob store, search indexes, previews and the screen. They're never scrubbed afterwards, because "afterwards" is too late once a token is in a search index. The redaction suite plants 28 kinds of canary secrets and checks none of them survive into any of those places.
>
> **4. Live without polling the world**
>
> The tail is event-driven. A resident, versioned fold keeps the projection current, and only the new operations stream to the browser. On ordinary sessions a step appears in about a quarter of a second at p95. Large sessions open from their latest work first: a 959 MB session shows its newest activity in about a second, and the rest loads quietly behind it.
>
> **5. Loopback is not a security model, so we added one**
>
> The server listens on 127.0.0.1, but any web page you visit can also send requests to localhost. So:
> - every data request needs a launch token, which is exchanged once for an `HttpOnly`, `SameSite=Strict` cookie and is never accepted in a query string or written to disk;
> - a wrong `Host` header gets 421, which stops DNS rebinding;
> - a foreign `Origin` gets 403;
> - there are no CORS headers;
> - tokens are compared in constant time.
>
> We wrote 673 security tests, then ran a penetration pass against the product with a hostile page, real DNS rebinding, a fuzzer (about 28,000 requests), a hostile repository and static analysis. It found eight problems. The two serious ones were a crafted `.git` file that pointed Drishya at another repository, and the launch token appearing in the browser launcher's process arguments, where other programs could read it. That one is now a one-time code. Each fix has a regression test, and a mutation check confirms the tests fail if the fix is removed.
>
> **6. Captured is not derived**
>
> Every string the UI renders carries provenance. A heuristic grouping or an opt-in model summary is labelled as such and never shown as the agent's words. Locations Drishya can't resolve stay explicitly unresolved instead of being guessed.
>
> The code is Apache-2.0 at github.com/drishya-dev/drishya. Adapters for new harnesses are the most useful contribution, and the codebase guide shows how to add one.

---

## 8. YouTube (D0)

- **The film:**
  - Title: *Drishya: see what your coding agent did, live*
  - Description:

> Drishya shows what your coding agent actually read, ran and changed, live, beside your repository, with the tools to review it like an engineer. Claude Code and Codex live, Antigravity replayed. Local only, no telemetry, open source.
>
> 0:00 The problem · 0:12 Live and real · 0:38 Read along · 0:50 Steer it · 0:56 Review like an engineer · 1:14 Every agent, every session · 1:20 Private by design
>
> Install: npm install -g @drishya-dev/cli
> Code: https://github.com/drishya-dev/drishya

- **The Short:** *Your agent changed 14 files. Here's what it did.* #opensource #ai #coding

---

## 9. D+3 to D+14: the feature cuts

Post one every two days, on the company page and X, with a 15 to 20 s cut. Builders reshare each with their own line.

1. **Read what it read:**

   > Your agent opened this file before it changed it. Open it beside its work, along with the file's earlier changes and the session that made each one.

2. **Review like an engineer:**

   > The agent's change, reviewed the way you'd review a teammate's: the diff in Git review, then Compare against your branch or the PR.

3. **Every agent, one place:**

   > Claude Code, Codex and Antigravity sessions in one Home. Replay any of them, read it as Work or as Conversation, and search across all of them.

4. **Big sessions, instantly:**

   > A 959 MB agent session shows its latest work in about a second. The rest loads quietly behind it.

5. **Private by design:**

   > Drishya runs on your machine only, redacts secrets before storing anything, and has no telemetry, not even an opt-out. Here's how we tested that.

   Link it to dev.to article 2.

---

## 10. D+7: the week-one post (company page and both builders)

Use only true numbers, filled in on the day.

> One week of Drishya. Thank you to everyone who tried it.
>
> What you asked for most: [top 2 or 3 requests]. What we've already fixed: [fixes, with the release]. What's next: [roadmap items].
>
> [Stars and installs only if both flattering and true.]
>
> Keep the issues coming: github.com/drishya-dev/drishya/issues

---

## 11. Newsletters and lists (D+1; builders submit)

- **Console.dev, TLDR, Changelog News,** one paragraph:

  > *Drishya is a free, open-source, local-only app that shows what a coding agent (Claude Code, Codex, Antigravity) actually read, ran and changed, live, beside your repository, with Git review, branch and PR compare, and search to check its work. No telemetry; Apache-2.0.*

- **Awesome lists** (`awesome-claude-code` and similar): a PR adding one line, following each list's format, under tools or observability.

## 12. Outreach (LinkedIn Premium InMail, D+1 to D+7, one by one, never a blast)

Write each note to the person, mentioning something specific they posted. Template to adapt:

> Hi [name], your post on [their specific agent workflow] is exactly the problem we were trying to solve. We just open-sourced Drishya, which shows what Claude Code or Codex actually did in a session, live, beside the repo. If you try it on your next session, I'd really value one line on what's missing. No ask beyond that. [link]
