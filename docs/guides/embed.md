# Drishya in your agent workspace

Open the session you are in, live, beside your work.

## Default: Zero-token quick open (No model calls, no rate limits)

These routes open the view locally without a model call or model quota. Startup and importing a large session can take time.

### 1. In-harness shell escape
`!drishya open` explicitly opens the newest recording in the current checkout. Pass `--session <native-id> --harness <harness>` to open an exact session:
- **Claude Code** (terminal or desktop app): type `!drishya open`. The `!` runs the command locally and returns when the local launcher finishes.
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
            "command": "node /absolute/path/to/drishya-hook.mjs",
            "timeout": 65
          }
        ]
      }
    ]
  }
}
```
Copy [`drishya-hook.mjs`](drishya-hook.mjs) to your `~/.claude/` directory. Replace the command with the absolute path to your copy (quote paths containing spaces, including on Windows). The hook uses Claude Code's exact `session_id` and `cwd`; if either is missing or invalid it reports an error instead of opening another session. It waits up to 60 seconds for the launcher; a large initial import can need a terminal retry. The 65-second hook timeout lets that error reach Claude Code. On Windows the hook requires a global npm installation on an absolute PATH entry outside the checkout and runs its Node entry directly, avoiding checkout-local `.cmd` files. This hook opens the system browser and consumes the prompt without a model call.

---

`drishya open` picks this folder's newest session across Claude Code, Codex, and Antigravity, starts a small background process if needed, opens the view and prints one line. Options: `--session <id>` for one exact session, `--harness claude-code|codex|antigravity` to prefer one agent, `--print` to print a one-time 60-second clickable link.

Requires a Drishya build with embed support and Node 24 or newer. The restoration is still under review.

## Which window it opens in

`drishya open` requests the **system browser**. A split pane requires a desktop host that implements a private launch handoff.

---

## Using an in-app split pane

A compatible desktop host opens the view in its private top-level guest. Hosts without private handoff can request an ordinary system browser window. Host-specific acceptance is pending. The view runs on `127.0.0.1`. Opening it does not send prompts, approve requests or grant workspace access.

## Agent route: turn it on (opt-in, per harness)

Drishya never edits your harness settings. You add two things yourself, and remove them the same way.

### 1. The tool: `drishya.open_view`

A local MCP server the agent calls with the exact session ID to request a private pane or a system browser.

**Claude Code** (also used by the Claude desktop app's Code tab):

```sh
claude mcp add --scope user drishya -- drishya embed-mcp
```

On Windows, pass the absolute Node executable and the installed package's absolute CLI path as separate arguments.

```powershell
claude mcp add --scope user drishya -- 'C:\Program Files\nodejs\node.exe' '<global npm root>\drishya\apps\daemon\src\cli.mjs' embed-mcp
```

Use the paths from `(Get-Command node).Source` and `npm root -g` on your machine.

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

On Windows, set `command` to the absolute Node executable and `args` to the absolute package CLI path followed by `embed-mcp`. Use single-quoted TOML strings for Windows paths.

**Antigravity and other MCP clients**: add a stdio server named `drishya` that runs `drishya embed-mcp`.

### 2. The command: `/drishya`

A skill that tells the agent how to find the current session and where to open the link. Copy [`drishya-skill/SKILL.md`](drishya-skill/SKILL.md) to:

- **Claude Code**: `~/.claude/skills/drishya/SKILL.md` (every project) or `.claude/skills/drishya/SKILL.md` (one project). Type `/drishya`.
- **Codex**: your Codex skills folder, `~/.codex/skills/drishya/SKILL.md` or a project's `.agents/skills/drishya/SKILL.md`, as your Codex version supports. Invoke it as `/drishya` or `$drishya`.

The skill also works without the tool. It uses `drishya embed … --open` to hand the exact session to the system browser.

### Turn it off

`claude mcp remove drishya` or `codex mcp remove drishya`, and delete the `drishya` skill folder you created. Nothing else was changed.

## How it finds "this session"

- **Claude Code** gives the skill its session ID (`${CLAUDE_SESSION_ID}`), so the pane shows exactly this conversation.
- **Codex** sets `CODEX_THREAD_ID` in the agent's shell, so the same holds.
- When the current session ID is unavailable, select the recording in Drishya. The separate terminal option `--latest` explicitly requests the newest recording.

## The link

A compatible desktop host receives the launch link through a private handoff. Its one-use code selects the recording and expires after **60 seconds**. The page removes the code from the address bar before exchanging it for the ordinary HttpOnly session cookie. To reopen a signed-out pane, start a fresh launch for the same session.

For hosts without private handoff, use the system browser (`systemBrowser: true` in the tool or `drishya embed --open` in a terminal). The tool returns a cleaned route. Host support requires a private guest that keeps the launch away from its model and browser tools.

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
