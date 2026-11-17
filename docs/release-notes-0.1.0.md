# Drishya 0.1.0 release notes

Draft for the first release.

Drishya runs locally and shows what a coding agent read, ran, and changed alongside your repository. Open a captured session to follow new activity or read past work at your own pace.

- **Sessions.** Claude Code and Codex recordings support live observation and replay. Antigravity recordings can be imported for read-only inspection.
- **Repository tools.** Browse files, inspect Changes and Git history, compare work, and search captured history. Reading current workspace files requires a grant for that checkout.
- **Connected sessions.** Send a prompt to a supported local Claude Code or Codex session from the app after granting workspace access and confirming the session is idle in other clients. The harness applies its own permissions.
- **Usage.** The Usage menu shows recorded token counts and available context and limit data. Coverage depends on what the harness records, including Codex rate-limit windows when present.

The CLI package is `@drishya-dev/cli` and requires Node.js 24. It opens a desktop browser and supports window widths of 600 px and above. Session data stays on your machine and the server listens on loopback. The [README](../README.md) covers installation, first run, privacy, and uninstall.

## Platform verification

- GitHub Actions passed the build, tests and package checks on Windows, Ubuntu and macOS at [main commit `ab4eb1d`](https://github.com/drishya-dev/drishya/actions/runs/44024026241).
- The first preparation tarball built and installed offline on Windows 11 x64 with Node.js 24.11.1. The packaged verifier imported synthetic Claude Code and Codex recordings and checked that the server used only loopback.
- The frozen-candidate gate and SEC-5 signoff are pending. So are the installed-package walkthroughs with a genuine live session on a second clean Windows machine, WSL2 Ubuntu and a physical Mac.
