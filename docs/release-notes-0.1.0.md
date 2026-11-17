# Drishya 0.1.0 release notes

Draft for the first release.

Drishya runs locally and shows what a coding agent read, ran, and changed alongside your repository. Open a captured session to follow new activity or read past work at your own pace.

- **Sessions.** Claude Code and Codex recordings support live observation and replay. Antigravity recordings can be imported for read-only inspection.
- **Repository tools.** Browse files, inspect Changes and Git history, compare work, and search captured history. Reading current workspace files requires a grant for that checkout.
- **Connected sessions.** Send a prompt to a supported local Claude Code or Codex session from the app after granting workspace access and confirming the session is idle in other clients. The harness applies its own permissions.
- **Usage.** The Usage menu shows recorded token counts and available context and limit data. Coverage depends on what the harness records, including Codex rate-limit windows when present.

The CLI package is `@drishya-dev/cli` and requires Node.js 24. It opens a desktop browser and supports window widths of 600 px and above. Session data stays on your machine and the server listens on loopback. The [README](../README.md) covers installation, first run, privacy, and uninstall.

## Platform verification

- The frozen candidate at `1dcc3e1e30d7fc8d1cdc1b4aa3736664da27d801` passed all six hosted build, test, package and browser jobs on Windows, Ubuntu and macOS. [Candidate CI](https://github.com/drishya-dev/drishya/actions/runs/44046338310)
- Its SHA-256 is `d9b7a72d9758aa9dd7ec72764b8c465dae260060671e25dc6298c18af19e21d6`. Windows 11 x64 with Node 24.11.1 passed the frozen offline install and package verifier.
- The same tarball was installed offline on Ubuntu 24.04.5 LTS under WSL2 with Node 24.22.3. A genuine Codex session was imported and resumed through the installed app. The live reply rendered at 600 and 1440 px, with zero page errors and no non-loopback browser requests. [Candidate evidence](https://github.com/drishya-dev/drishya/pull/508)
- A second clean Windows machine walkthrough, physical Mac acceptance, SHIP-10's fresh user review and ten-minute pass, and the final SEC-4b and SEC-5 sign-off remain pending.
- These results identify the candidate tested. If security or packaging changes replace it, record the replacement commit and digest and rerun the affected acceptance checks.

## Publication package

PR #523 proposes the plain package name `drishya`. The candidate documented above is still `@drishya-dev/cli`. Confirm the final package name in its packed manifest and update the install instructions before publishing.
