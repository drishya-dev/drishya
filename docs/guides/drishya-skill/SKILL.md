---
name: drishya
description: Open the current agent session in Drishya, a live view of what the agent read, ran and changed, in this app's own browser or artifact pane. Use when the user types /drishya or asks to see, watch or open this session in Drishya.
---

# Open this session in Drishya

Drishya shows this session as it happens: the files read, the commands run and their output, the diffs. Open it beside the conversation so the user never has to switch apps.

1. **Find this session.** Use the first that applies:
   - Claude Code: this session's ID is `${CLAUDE_SESSION_ID}`. If that text was not replaced by an ID, skip it.
   - Codex: the shell variable `CODEX_THREAD_ID`, when it is set.
   - If the host does not supply an exact session ID, ask the user to select the recording in Drishya.
   Always pass `cwd`: the absolute path of the checkout you are working in.

2. **Open the exact session.** Call `drishya.open_view` with its `nativeSessionId`, the `harness`, and the absolute `cwd`. A compatible host opens its private pane directly. The route in the tool's text is for a pane that is already signed in.

3. **No private pane?** Call the tool with `"systemBrowser": true`. If the tool is unavailable, run `drishya embed --session <id> --harness <harness> --cwd <checkout> --open`. Pass the checkout path as one argument, including when it contains spaces.

4. **Report the handoff in one line.** Opening the view does not send a prompt or grant workspace access.

If a call fails, say what the error's `message` says (for example, no session in this checkout yet) and stop. Never edit harness settings to make this work.
