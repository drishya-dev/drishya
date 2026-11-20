---
name: drishya
description: Open the current agent session in Drishya, a live view of what the agent read, ran and changed, in this app's own browser or artifact pane. Use when the user types /drishya or asks to see, watch or open this session in Drishya.
---

# Open this session in Drishya

Drishya shows this session as it happens: the files read, the commands run and their output, the diffs. Open it beside the conversation so the user never has to switch apps.

1. **Find this session.** Use the first that applies:
   - Claude Code: this session's ID is `${CLAUDE_SESSION_ID}`. If that text was not replaced by an ID, skip it.
   - Codex: the shell variable `CODEX_THREAD_ID`, when it is set.
   - Otherwise use the newest session in this checkout: `latest: true` with `cwd`.
   Always pass `cwd`: the absolute path of the checkout you are working in.

2. **Get a link.** Call the `drishya.open_view` tool (MCP server `drishya`) with `{ "nativeSessionId": "<id>", "cwd": "<checkout>" }`, or `{ "latest": true, "cwd": "<checkout>" }`.
   If that tool is not available, run one shell command instead; it prints one JSON line and returns at once:
   `drishya embed --session <id> --cwd <checkout>` or `drishya embed --latest --cwd <checkout>`.

3. **Open it in your pane at once.** Load the returned `url` in this app's browser or artifact pane (the built-in browser in the Claude desktop app, the Codex app's browser, Antigravity's browser, a T3 Code preview). The link signs in once and expires after 60 seconds: do not repeat it in your reply, write it to a file or open it anywhere else. If it has expired, ask for a new one.

4. **No pane?** Call the tool again with `"systemBrowser": true`, or run the command with `--open`. Drishya then opens the system browser itself and the link never reaches you.

5. **Report in one line** that the session is open in Drishya. Do not describe its contents, and do not imply Drishya can steer this session: it only observes.

If a call fails, say what the error's `message` says (for example, no session in this checkout yet) and stop. Never edit harness settings to make this work.
