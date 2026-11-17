# Drishya 0.1.0 release notes

The first public release.

Drishya runs locally and shows what a coding agent read, ran, and changed alongside your repository. Open a captured session to follow new activity or read past work at your own pace.

- **Sessions.** Claude Code and Codex recordings support live observation and replay. Antigravity recordings can be imported for read-only inspection.
- **Repository tools.** Browse files, inspect Changes and Git history, compare work, and search captured history. Reading current workspace files requires a grant for that checkout.
- **Connected sessions.** Send a prompt to a supported local Claude Code or Codex session from the app after granting workspace access and confirming the session is idle in other clients. The harness applies its own permissions.
- **Usage.** The Usage menu shows recorded token counts and available context and limit data. Coverage depends on what the harness records, including Codex rate-limit windows when present.

The CLI package is `drishya` and requires Node.js 24. It opens a desktop browser and supports window widths of 600 px and above. Session data stays on your machine and the server listens on loopback. The [README](../README.md) covers installation, first run, privacy, and uninstall.

## Platform verification

- Continuous integration runs the build, type checks, unit and security tests, package checks and the full browser suite on Windows, Ubuntu and macOS. The macOS browser job has known load-related flakes, which also fail on `main`.
- Hand-tested on Windows 11 and on Ubuntu under WSL2 (Node.js 24). The tarball installs offline and the packaged verifier imports synthetic Claude Code and Codex recordings and checks that the server uses only loopback.
- macOS is verified by CI only. There was no pass on a physical Mac for 0.1.0.
- The fixes from the pre-release security review are included (#526 to #530).
