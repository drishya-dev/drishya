# Changelog

All notable changes to Drishya are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/) once 1.0 is released; until then, minor versions may change behaviour.

The development before 0.1.0 happened in a private repository. Its task-by-task record is the [Product Work History](docs/PRODUCT_WORK_HISTORY.md).

## [Unreleased]

## [0.1.0] - unreleased

The first public release.

### Added

- **Live view and replay** of Claude Code, Codex and Antigravity sessions on one Home: every read, search, command, test and edit shown as the real captured content, in order, beside the repository's files. Read-only capture; secrets are redacted before anything is stored.
- **Reading tools:** the file the agent is on beside its work with that file's earlier changes, a Workspace for reading and drafting, Changes for comparing branches and pull requests with the session that edited each file, the Git graph, and search across all sessions.
- **Conversation and Work views** of the same session, and a repository map.
- **Opt-in controller** for Claude Code and Codex: after per-checkout consent, send the next prompt, answer questions and exact approvals, and interrupt the turn, through each harness's supported protocol. Capture never depends on it.
- **Three palettes** (Jet Black, Daylight, Midnight) and paired open and close motion for every surface, with reduced-motion and low-resource modes.
- **Security:** loopback-only daemon with a launch token and session cookie, Host and Origin checks, default-deny Git calls, a threat model and an automated suite (`pnpm test:security`), and no telemetry of any kind. See [SECURITY.md](SECURITY.md).
- **Packaging:** an installable CLI (`drishya serve`, `sources`, `import`, `list`, `export`, `forget`, `storage`) with no runtime dependencies, on Node.js 24.

### Known limits

- Built and tested on Windows 11. Linux and macOS are not verified yet.
- Antigravity sessions are read after the fact; live following is planned (see the [roadmap](ROADMAP.md)).
- Agent journals are not a stable, documented format, so unknown records are shown as unknown rather than guessed.

[Unreleased]: https://github.com/drishya-dev/drishya/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/drishya-dev/drishya/releases/tag/v0.1.0
