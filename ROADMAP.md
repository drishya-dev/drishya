# Roadmap

What is planned for Drishya, in plain words. This is a direction, not a promise: dates are not committed, and the order can change as people use the release. Current work is tracked in [GitHub Issues](https://github.com/drishya-dev/drishya/issues); earlier work and the reasons behind it are in the [Product Work History](docs/PRODUCT_WORK_HISTORY.md).

## Published release

[Drishya 0.1.1](https://github.com/drishya-dev/drishya/releases/tag/v0.1.1) is the latest published release. Run `npx drishya serve` with Node.js 24 or newer. It observes Claude Code, Codex and Antigravity sessions live and in replay, with an opt-in prompt controller for Claude Code and Codex. The [first release notes](docs/release-notes-0.1.0.md) record the original platform checks.

- **Platform acceptance.** The first release was hand-tested on Windows 11 and Ubuntu under WSL2. Physical Mac, lower-resource machines and broader hands-on coverage remain open. See [MAC-1](docs/review/mac-1-acceptance.md) and [REL-2](docs/review/rel-2-physical-acceptance.md).
- **Security follow-up.** The published release includes the fixes from the pre-release review. The [SEC-4b report](docs/review/sec-4-pentest.md) records what the installed-build testing and scans covered and which second-device, second-account and cross-platform checks remain.

## Work on main since 0.1.1

- **Antigravity live acceptance (AG-3).** Genuine runs covered live, background command completion, exact child navigation and restart. [Acceptance record](docs/review/antigravity-ag3-live.md)
- **Storage management (STORE-1).** Settings shows imported-session usage and clears selected imported data while preserving native journals. [Implementation and acceptance](docs/review/store-1-local-storage.md)
- **Native question cards.** Terminal-started questions tell the user where to answer. Drishya-driven Codex answers were verified end to end. A fresh signed-in Claude Code answer remains open. [Issue #543](https://github.com/drishya-dev/drishya/issues/543)

## Under review and in progress

- **Antigravity metadata.** Further local-database enrichment (AG-6) is planned. Prompt presentation and workspace evidence are tracked in [#541](https://github.com/drishya-dev/drishya/issues/541).
- **Drishya inside a harness.** The focused embed restoration needs fresh native invocation and genuine desktop-host pane acceptance. [Draft PR #563](https://github.com/drishya-dev/drishya/pull/563)
- **Lit files on the map (MAP-3).** The change highlights files backed by recorded activity. The local full gate still has unresolved failures. [PR #555](https://github.com/drishya-dev/drishya/pull/555)
- **Repository setup.** The open session should show Files and the map when its workspace is identified after first open. [Issue #542](https://github.com/drishya-dev/drishya/issues/542)
- **More palettes (UI-40).** The palette candidates are under review and need Yash’s selection. [Draft PR #559](https://github.com/drishya-dev/drishya/pull/559)
- **Additional acceptance.** Signed-in native controller journeys, desktop computer use, long-session motion and the physical platform checks remain separate acceptance work. Journals of 160 MB and above remain outside the documented performance range pending a new real-journal matrix. [Performance record](docs/PRODUCT_WORK_HISTORY.md#perf-3)

## Harnesses being explored

Claude Code, Codex and Antigravity are supported. These are being looked at, with no date and no promise:

- **T3 Code.** A potential desktop host for Drishya. Feasibility depends on exact native session mapping and a private guest handoff.
- **Hermes Agent.** A potential source of coding sessions. Feasibility starts with selected-session import and requires genuine export, visibility and size evidence before any live integration. [Reviewed proposal for both integrations](docs/review/hermes-t3-integration-proposal.md)
- **Cursor.** Considered earlier from sessions on one machine, not started.

If you build or maintain a harness and want Drishya to read it, [open a harness integration issue](.github/ISSUE_TEMPLATE/harness-integration.yml). How an adapter is built is described in [`docs/CODEBASE.md`](docs/CODEBASE.md#adapters--how-to-add-a-harness).

## Ideas, not planned

Parked ideas are listed in the Product Work History under the `IDEA` entries: comparing two sessions, a symbol timeline, mission control across several repositories, Mermaid diagrams in agent prose, and model-written explanations (only ever labelled as generated, never as the agent's own words).

Issues the maintainers have prepared for contributors are listed in [`docs/review/repo-1-seed-issues.md`](docs/review/repo-1-seed-issues.md) until they exist on GitHub.
