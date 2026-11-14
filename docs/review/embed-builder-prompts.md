# EMBED-1 and EMBED-2: prompts for Codex (ChatGPT) and Antigravity

Written by Fable, 14 Nov 2026, for Harsh (Yash: "give proper prompts and instructions for chatgpt to do embed 1 and 2, efficiently ... also have antigravity"). Claude's remaining usage is kept for security (SEC-3/4/5) and shipping, so these two builders do the embed.

## Split and order

| Step | Builder | Item | Touches | Can run in parallel with |
|---|---|---|---|---|
| 1 | Codex | **EMBED-1** contract (a short doc, about an hour) | `docs/review/embed-1-in-app.md`, TASKS | nothing; it goes first |
| 2a | Codex | **EMBED-2a** daemon and launcher: embed auth handoff, framing policy, `drishya embed` command, MCP/slash launcher for Claude Code and Codex | `apps/daemon/`, `packages/cli*` (or wherever the CLI lives), `apps/daemon/test/` | 2b |
| 2b | Antigravity | **EMBED-2b** embed view in the UI, the example host, the integration guide | `apps/ui/`, `examples/embed-host/`, `docs/guides/embed.md`, `tests/browser/embed-*.spec.ts` | 2a |

Files are disjoint, so 2a and 2b run at the same time once step 1 is agreed. In its EMBED-1 claim commit, Codex splits EMBED-2 in `docs/TASKS.md` into **EMBED-2a** and **EMBED-2b** using the table above. Each is a whole item with its own Accept; the original EMBED-2 Accept is divided between them.

**Decision needed from Yash and Harsh before step 2: the embed's minimum width.** Side panes are often 320 to 480 px, and the desktop-only rule (26 Oct) says 600. Fable proposes **360 px for the embed only**: one column, the map hidden below 600, Conversation as the default mode, and the composer only where the controller already allows it. The rest of the app stays at 600. Codex writes this into EMBED-1 as the proposal, and the builders confirm or change it.

---

## Shared preamble: paste this first into every prompt

```
You are working in the Drishya repository (drishya-dev/drishya). Drishya is a local, cross-harness replay and live view for coding agents (Claude Code, Codex, Antigravity): a zero-runtime-dependency Node 24 daemon (TypeScript run directly, erasable syntax only) on a loopback port, serving a React 19 + Vite UI.

Read before anything else: AGENTS.md (the rules, the north star, the definition of done), docs/CODEBASE.md, and your item in docs/TASKS.md (search "**EMBED-1 ·" and "**EMBED-2 ·"), plus docs/review/embed-1-in-app.md once it exists.

Rules that are not negotiable:
- Claim first: run `node scripts/claims.ts`, then add your row to the Claimed table in docs/STATUS.md (keyed by the TASKS ID, with your files) in a docs-only commit on main, and push it. Never touch files another claim lists. Open a draft PR after your first real commit. In the PR that finishes the item: delete your row, tick the item in TASKS, run `node scripts/sync-tasks.ts`.
- Whole items only: open the PR as ready only when every Accept line is met, or a line is blocked by something outside the task and the PR says exactly what.
- Verify on real sessions of Claude Code and Codex (Antigravity too, if PR #490 has merged), imported into a SCRATCH Drishya home. Report only session id prefixes, sizes and counts. Never print real journal content. Screenshots of real sessions stay in `.local/` and are never committed.
- Never use or kill ports 7878 or 5180 (the user's own Drishya and the site dev server). Use your own scratch port.
- Never `git reset --hard`. Never touch tests/browser/workspace-shared-draft.spec.ts, docs/PROJECT_MASTER_DESCRIPTION.md or docs/Logo*. Never share node_modules between worktrees: run `corepack pnpm install --frozen-lockfile` in yours.
- Security cannot regress: the daemon binds to loopback only; it has a per-launch token exchanged for an HttpOnly cookie; Host and Origin are checked on every request; writes require application/json; the CSP is `default-src 'self'` with `frame-ancestors 'none'` and `X-Frame-Options: DENY`. No telemetry. No new runtime dependency in the daemon. Any relaxation is the narrowest one the contract allows, with a test proving that everything else is still refused. SEC-3's suite (`pnpm test:security`, being built now in tests/security/) must pass against the embed. If it has merged, run it; if not, add your cases there when it lands.
- No test or log prints a token.
- Desktop UI quality bar: minimal and calm; no labelled boxes; visualization first; every open has a matching close animation; respect reduced motion. Read docs/VISION.md before any UI work.
- Checks while working: typecheck of the touched projects, units of the touched packages, the named browser specs (`DRISHYA_BROWSER_CHANNEL=msedge node scripts/test-browser.ts <specs> --retries=0`). When done: `package:verify` if the daemon, CLI or packaging changed. Don't run the full browser gate. Fable runs it before merging.
- Commits end with a Co-Authored-By trailer naming you (Codex or Antigravity). The PR title is `area: what changed (EMBED-x)`.
```

---

## Prompt 1: Codex, EMBED-1 (the contract)

```
[shared preamble]

Task: EMBED-1, the design and contract for showing Drishya inside a harness app's side window (browser or artifact pane), with one click, a full-screen control, and free to integrate. First reference: T3 Code (open source, with desktop, web, iOS and Android apps). Read the item's six points in TASKS.

Claim EMBED-1. In the same commit, split EMBED-2 into EMBED-2a (daemon and launcher) and EMBED-2b (UI embed view, example host, guide) as docs/review/embed-builder-prompts.md describes.

Write docs/review/embed-1-in-app.md. It must decide each point concretely enough for two builders to work from it in parallel.

1. What the app opens. The URL shape for one session. Proposal: the existing session URL plus `embed=1` (no Home, one session); keep the token in the fragment as today. How the app starts Drishya (`drishya embed <session|--latest> [--cwd]`, which prints the URL as JSON on stdout) or finds it already running (a discovery file in the Drishya home that holds the port, never the token).

2. The auth problem, decided. The session cookie is SameSite=Strict. Inside a cross-site <iframe> it is NOT sent, and third-party cookies are often blocked anyway. So:
   a. Preferred: the host shows Drishya as the TOP-LEVEL document of its pane (an Electron BrowserView, WebContentsView or webview, or a separate window). The cookie and every defence work unchanged, and framing stays `none`.
   b. Only if a host can only iframe: an opt-in mode, off by default and enabled by `drishya embed --frame-ancestor <origin>`, that sets `frame-ancestors` to exactly that origin (never `*`) and authenticates without a third-party cookie (for example a short-lived, single-use launch code exchanged through a same-origin request from inside the frame, then held in memory). Say exactly what is accepted and refused, and why each defence still holds.
   Read apps/daemon/src/server.ts (the CSP at about line 109, the cookie at about line 207) before writing this.

3. The click. A button the host adds, or the model itself through a launcher: an MCP tool `drishya.open_view` and slash commands `/drishya` for Claude Code and Codex that start or find Drishya and return the URL for the pane. Read-only by default; the composer appears only where Drishya's controller already allows it for that harness.

4. Size. Propose a 360 px minimum for the embed only (one column, the map hidden below 600, Conversation as the default mode). Yash and Harsh confirm. Mobile apps are not in Release 1.

5. Free and supported. Apache-2.0 (PUBLIC-1), the guide, the example, the community channel.

6. T3 Code. Read its public source and docs (read only) to see how it shows web content in a pane, and write the integration steps for it. The builders contact its maintainers; you never post, open issues or PRs on other repositories, or contact anyone.

Also list exactly which SEC-3 tests the embed adds or changes: framing per declared origin, the launch code being single-use and expiring, the discovery file holding no token, and the embed refused when the flag is off.

Accept: the doc answers all six points plus the auth decision and the SEC-3 list; TASKS has EMBED-2a and 2b; the PR is ready for Yash and Harsh to agree. Docs-only change, no code. Keep it under about 250 lines.
```

---

## Prompt 2a: Codex, EMBED-2a (daemon and launcher)

```
[shared preamble]

Task: EMBED-2a, the daemon and launcher side of the embed, exactly as docs/review/embed-1-in-app.md decides. Build only after both builders have agreed that doc. Antigravity is building EMBED-2b (the UI embed view, the example host and the guide) in parallel. Don't touch apps/ui/, examples/ or docs/guides/; agree any API shape with that builder through the contract doc.

Do:
1. `drishya embed`: start Drishya or reuse a running one, and print `{ "url": ..., "port": ... }` as JSON. The discovery file in the Drishya home holds the port and pid, never the token, and is written with user-only permissions.
2. The top-level mode needs no relaxation: prove it with a test.
3. If the contract keeps the iframe mode: `--frame-ancestor <origin>` sets frame-ancestors to exactly that origin, plus the launch code (single use, expires in about 60 s, constant-time compare, never logged and never in a query string a page could read). With no flag, everything is byte-for-byte today's headers: test it.
4. The launcher: an MCP tool and slash commands for Claude Code and Codex that return the URL. Write their config snippets into the guide's appendix file `docs/guides/embed-launcher.md` (yours; the main guide is EMBED-2b's). Never edit a user's harness configuration automatically: the guide tells the user what to add.
5. Units in apps/daemon/test/ for each piece, and the SEC-3 cases the contract lists. If tests/security/ has not merged yet, put them in apps/daemon/test/embed-security.test.ts and note the move for later.

Accept: the units and the security cases green; `package:verify` green; with no embed flag, the response headers equal main's (asserted); `drishya embed` works on a clean checkout on Windows (say which systems you could not run); the PR lists every relaxed header and the test that bounds it.
```

---

## Prompt 2b: Antigravity, EMBED-2b (the UI, example host and guide)

```
[shared preamble]

Task: EMBED-2b, the embed view, a working example host, and the integration guide, as docs/review/embed-1-in-app.md decides. Build only after both builders have agreed that doc. Codex builds EMBED-2a (the daemon, `drishya embed`, the launcher) in parallel. Don't touch apps/daemon/ or docs/guides/embed-launcher.md.

You are a builder here, held to the same rules as any agent in AGENTS.md. Note: Antigravity's own harness files are read-only to Drishya, and you never read or write mcp_config.json, hub tokens, the browser profile, installation_id, machineid or %APPDATA%\Antigravity.

Do:
1. The embed view in apps/ui, entered by the contract's URL (proposed: `embed=1`): one session, no Home or session list, a full-screen toggle (the browser Fullscreen API on the document, with a matching enter and exit animation), and the narrow layout down to the agreed minimum (proposed 360 px: one column, the map hidden below 600, Conversation as the default mode, and the header and footer chrome as narrow as UI-49 made them). Above 600 px it is the normal session view without Home. Live and replay both work. The composer shows only where the controller already allows it.
2. Reuse the existing components. Don't fork History or Conversation for the embed; branch on one `embed` flag in state. Pixels and motion of the normal app must not change: run the existing specs for History, Conversation, the header and live (b2-live, b4-history, conversation-switch, live-sync) and keep them green.
3. examples/embed-host/: the smallest working host that shows Drishya as a top-level pane beside a fake "app" panel, with a button that runs `drishya embed` and opens the URL, plus a full-screen control. Plain Node + an Electron-free approach if possible (for example a tiny static page that opens the URL in a sized window, with a note on how an Electron app uses a WebContentsView). If an Electron example is the clear choice, keep it outside the workspace's install (its own package.json, not in the pnpm workspace) so the product gains no dependency. If the contract kept the iframe mode, show it too.
4. docs/guides/embed.md: the integration guide, followed from scratch on a clean checkout and checked to work: install, `drishya embed`, open the URL in your pane, full screen, read-only by default, the security model in plain words (what stays local, what the host may and may not do), and a T3 Code section from the contract.
5. tests/browser/embed-*.spec.ts: the embed view at the minimum width, 600 and 1440; full-screen enter and exit; no Home; live steps arriving; reduced motion.

Accept: real Claude Code and Codex sessions (Antigravity too if #490 has merged) shown in the example host at the narrow and full-screen sizes, live and replayed (id prefixes and counts only in the PR); the guide followed from scratch works; the new specs and the existing History, Conversation and live specs are green; screenshots kept in .local/ only.
```

---

## For Harsh

- Run Prompt 1 first. Agree the doc with Yash, especially the minimum width and whether to keep the iframe mode at all. Fable recommends the top-level pane only for Release 1, if T3 Code's pane allows it, because it relaxes nothing.
- Then run 2a (Codex) and 2b (Antigravity) at the same time.
- When both PRs are ready, Fable reviews them, runs the full gate and the security suite, and merges 2a first.
