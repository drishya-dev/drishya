# Drishya in your agent workspace

Open the session you are in, live, beside your work.

## Default: Zero-token quick open (No model calls, no rate limits)

These routes run locally with **0 tokens, 0 subscription cost, and 0 latency**. They never hit model limits or API rate caps:

### 1. In-harness shell escape: `!drishya open`
Type `!drishya open` directly into your agent's prompt line:
- **Claude Code** (terminal or desktop app): type `!drishya open`. The `!` runs the command locally and returns immediately to your chat.
- **Codex**: type `!drishya open` where your version has shell escape; otherwise run `drishya open` in an adjacent terminal.
- **Antigravity** and anything else: run `drishya open` in its terminal.

### 2. Zero-token `/drishya` hook (Type `/drishya` without calling the model)
If you prefer typing `/drishya` naturally without spending model quota, configure a `UserPromptSubmit` hook. The hook catches `/drishya` before it ever reaches the LLM, executes `drishya open`, and blocks the prompt:

In `~/.claude/settings.json` (or `.claude/settings.json`):
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/drishya-hook.mjs"
          }
        ]
      }
    ]
  }
}
```
Copy [`drishya-hook.mjs`](drishya-hook.mjs) to your `~/.claude/` directory. When you submit `/drishya`, it launches your browser instantly with 0 tokens.

---

`drishya open` picks this folder's newest session across Claude Code, Codex, and Antigravity, starts a small background process if needed, opens the view and prints one line. Options: `--session <id>` for one exact session, `--harness claude-code|codex|antigravity` to prefer one agent, `--print` to print a one-time 60-second clickable link.

Requires Drishya 0.1.2 or later and Node 24 (`npm install -g drishya`).

## Which window it opens in

`drishya open` opens your **system browser**. It has no way to inject a page into a separate desktop app's internal split pane. To get it into an app's pane without asking the agent, run `drishya open --print` and click the link it prints (it is valid once, for 60 seconds); an app that opens clicked loopback links in its own pane will show it there.

---

## When you need an in-app split pane: Let the agent open it

Only use this if you specifically want the visualizer docked *inside* the desktop app's native split pane (e.g. Claude desktop app's browser pane) rather than an external browser window. **Note: this costs a short model turn each time.**

When the agent opens it, it goes to, in order:

1. **Claude desktop app** (Code tab): its built-in browser pane.
2. **Codex app**: its browser pane, where the agent can drive one.
3. **Antigravity**: its attached browser.
4. **Any other app with an agent-driven browser or webview** (for example a T3 Code preview).
5. **Anywhere else**: the system browser.

Everything stays on your computer. The pane is a page served by a small Drishya process on `127.0.0.1`; nothing is sent anywhere. Opening a pane only observes the session: it does not send prompts, approve anything or give Drishya access to your files.

## Agent route: turn it on (opt-in, per harness)

Drishya never edits your harness settings. You add two things yourself, and remove them the same way.

### 1. The tool: `drishya.open_view`

A local MCP server the agent calls to get a link for the current session.

**Claude Code** (also used by the Claude desktop app's Code tab):

```sh
claude mcp add --scope user drishya -- drishya embed-mcp
```

On Windows: `claude mcp add --scope user drishya -- cmd /c drishya embed-mcp`.

**Codex** (CLI and app):

```sh
codex mcp add drishya -- drishya embed-mcp
```

Or in `~/.codex/config.toml`:

```toml
[mcp_servers.drishya]
command = "drishya"
args = ["embed-mcp"]
```

On Windows use `command = "cmd"` and `args = ["/c", "drishya", "embed-mcp"]`.

**Antigravity and other MCP clients**: add a stdio server named `drishya` that runs `drishya embed-mcp`.

### 2. The command: `/drishya`

A skill that tells the agent how to find the current session and where to open the link. Copy [`drishya-skill/SKILL.md`](drishya-skill/SKILL.md) to:

- **Claude Code**: `~/.claude/skills/drishya/SKILL.md` (every project) or `.claude/skills/drishya/SKILL.md` (one project). Type `/drishya`.
- **Codex**: your Codex skills folder, `~/.codex/skills/drishya/SKILL.md` or a project's `.agents/skills/drishya/SKILL.md`, as your Codex version supports. Invoke it as `/drishya` or `$drishya`.

The skill also works without the tool: the agent then runs `drishya embed …` in its shell, which prints one line and returns at once.

### Turn it off

`claude mcp remove drishya` or `codex mcp remove drishya`, and delete the `drishya` skill folder you created. Nothing else was changed.

## How it finds "this session"

- **Claude Code** gives the skill its session ID (`${CLAUDE_SESSION_ID}`), so the pane shows exactly this conversation.
- **Codex** sets `CODEX_THREAD_ID` in the agent's shell, so the same holds.
- Anywhere else, the newest session in the current checkout is used (`--latest --cwd`). It never picks a session from another checkout.

## The link

The agent receives a link like `http://127.0.0.1:<port>/?embed=1&recording=<id>#launch=<code>`. The code signs in **once**, for **that one session**, within **60 seconds**. The page removes it from the address bar before anything else runs and swaps it for the ordinary private session cookie. Because the link passes through the agent's conversation, Drishya also strips launch codes from every journal it records. If the agent opens the link late, or you reload a fresh pane, the page says the link was used: type `/drishya` again.

When the agent cannot drive a pane, it asks the tool to open the system browser instead (`systemBrowser: true`, or `drishya embed --open`); the link then never reaches the agent at all.

## How long it runs

- Through the tool, the view lives as long as the agent session's MCP server.
- Through `drishya embed`, it runs in the background and stops by itself ten minutes after the last pane closed.
- It never touches a `drishya serve` you already run, and the two can be open at once.

## Narrow panes

The pane opens on Conversation, the narrowest complete way to read a session, and works from 360 px wide. Work, Files and the rest of the session view are the same as in the full app; there is no session library in a pane.

## Commands

```sh
drishya open [--session <id>] [--harness H] [--print] [--json]   # no agent, no model call
drishya embed --session <harness-session-id> [--cwd DIR]   # this exact session
drishya embed --latest --cwd DIR                            # newest session in this checkout
drishya embed <rec_…>                                       # an imported Drishya recording
  --open     open the system browser instead of printing the link
  --attach   keep the view tied to this process (for a host app that owns it)
drishya embed-mcp                                           # the MCP server above
```

Details for host apps and the security contract: [embed-launcher.md](embed-launcher.md) and [the EMBED contract](../review/embed-1-in-app.md).
