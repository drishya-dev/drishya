# Roadmap

What is planned for Drishya, in plain words. This is a direction, not a promise: dates are not committed, and the order can change as people use the release. Current work is tracked in [GitHub Issues](https://github.com/drishya-dev/drishya/issues); earlier work and the reasons behind it are in the [Product Work History](docs/PRODUCT_WORK_HISTORY.md).

## Now: finishing release 0.1.0

Drishya 0.1.0 is a desktop product, built and tested on Windows 11, for Claude Code, Codex and Antigravity. It observes sessions read-only, with an opt-in controller for sending prompts to Claude Code and Codex. Linux and macOS are not verified yet. The product is feature-complete. What remains is checking and packaging it:

- **The pentest on the installer that ships (SEC-4b).** The findings from the first pass are fixed and covered by tests. The second pass repeats it on the installed build with the OWASP ZAP scan, full CodeQL and Semgrep, a second device and a second operating-system account, and the three systems. The report is in [`docs/review/sec-4-pentest.md`](docs/review/sec-4-pentest.md).
- **Continuous integration on Windows, Linux and macOS (SHIP-16),** including the packaged install check, and the macOS acceptance run (MAC-1).
- **A final whole test** of the release candidate, then the packaged release with install guide and release notes (SHIP-9).
- **Documentation and the website:** the README, the website, how people give feedback without telemetry (FEEDBACK-1), and the launch posts.

## Next release

These were scoped during the first release and set aside on purpose. Each has a write-up in the Product Work History under its ID.

- **Live Antigravity (AG-3 and AG-6).** Antigravity sessions are read after the fact today. The next step follows a session live, including background commands and subagent conversations, and adds the details its local database records (exit codes, applied diffs, branch, model, token use, durations).
- **Drishya inside a harness (EMBED-2a and EMBED-2b).** An embed command and a view sized for a side pane, so a harness app can show Drishya beside the agent as a guest view. The design and security contract are settled in [`docs/review/embed-1-in-app.md`](docs/review/embed-1-in-app.md); the reference host is T3 Code.
- **Lit files on the map (MAP-3).** The file the agent is on is pulled forward on the repository map with its name and type, while the rest of the map stays a quiet field. See [`docs/review/map-3-lit-files.md`](docs/review/map-3-lit-files.md).
- **Storage management (STORE-1).** Settings shows what Drishya stores for each session and lets you clear chosen sessions' data. It never touches the harness's own journals.
- **One-click setup for a repository (CONNECT-4).** A repository's permissions are asked for once, in one sheet, before its session opens, and remembered per checkout. See [`docs/review/connect-4-repository-setup-proposal.md`](docs/review/connect-4-repository-setup-proposal.md).
- **More palettes (UI-40)** and a pass of motion evaluation on long live sessions (MOTION-3).
- **Real signed-in acceptance** of the native controller across harnesses, multi-agent sessions and desktop computer use, and the physical platform checks that only a person on the machine can do.

## Harnesses being explored

Claude Code, Codex and Antigravity are supported. These are being looked at, with no date and no promise:

- **T3 Code.** An open-source agent app with desktop, web and mobile clients. It is the first reference host for the embedded view above; we have only read its source, and nothing has been agreed with its maintainers.
- **Hermes Agent.** Being explored as another source of sessions; nothing is built yet.
- **Cursor.** Considered earlier from sessions on one machine, not started.

If you build or maintain a harness and want Drishya to read it, [open a harness integration issue](.github/ISSUE_TEMPLATE/harness-integration.yml). How an adapter is built is described in [`docs/CODEBASE.md`](docs/CODEBASE.md#adapters--how-to-add-a-harness).

## Ideas, not planned

Parked ideas are listed in the Product Work History under the `IDEA` entries: comparing two sessions, a symbol timeline, mission control across several repositories, Mermaid diagrams in agent prose, and model-written explanations (only ever labelled as generated, never as the agent's own words).

Issues the maintainers have prepared for contributors are listed in [`docs/review/repo-1-seed-issues.md`](docs/review/repo-1-seed-issues.md) until they exist on GitHub.
