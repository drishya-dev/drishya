# Drishya 0.1.0 release notes

Draft for the first release. Platform coverage below describes the package preparation so far and will be updated from the frozen candidate's results.

Drishya runs locally and shows what a coding agent read, ran, and changed alongside your repository. Open a captured session to follow new activity or read past work at your own pace.

- **Sessions.** Claude Code and Codex recordings support live observation and replay. Antigravity recordings can be imported for read-only inspection.
- **Repository tools.** Browse files, inspect Changes and Git history, compare work, and search captured history. Reading current workspace files requires a grant for that checkout.
- **Connected sessions.** Send a prompt to a supported local Claude Code or Codex session from the app after granting workspace access and confirming the session is idle in other clients. The harness applies its own permissions.
- **Usage.** The Usage menu shows recorded token counts and available context and limit data. Coverage depends on what the harness records, including Codex rate-limit windows when present.

The CLI package is `@drishya-dev/cli` and requires Node.js 24. It opens a desktop browser and supports window widths of 600 px and above. Session data stays on your machine and the server listens on loopback. The [README](../README.md) covers installation, first run, privacy, and uninstall.

**Platform verification.** The preparation tarball built and installed offline on Windows 11 x64 with Node.js 24.11.1. The second-machine Windows walkthrough, frozen-candidate gate and SEC-5 signoff, and Linux and macOS candidate checks are pending.
