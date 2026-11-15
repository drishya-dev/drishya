# Contributing to Drishya

Drishya is early: the design is settled enough to build, and the application is just beginning. Thank you for looking.

## Start here

1. **[`docs/VISION.md`](docs/VISION.md)** — what Drishya should look, move and feel like.
2. **[`AGENTS.md`](AGENTS.md)** — the non-negotiable constraints and how work flows. It is written for coding agents, and it applies to people just the same.
3. **[`docs/README.md`](docs/README.md)** — every document, and which one wins where they overlap.

## How work flows

1. Check [open issues](https://github.com/drishya-dev/drishya/issues), related PRs, and [Product Work History](docs/PRODUCT_WORK_HISTORY.md). For substantive work, use an issue to agree on the problem, scope, and what reviewers should be able to verify.
2. Branch from `main` as `<handle>/<topic>`. Open a focused PR and link the issue when one exists. A draft PR can share work in progress.
3. In the PR, state what changed, how you checked the acceptance criteria, and which checks are pending. A maintainer reviews before squash merge. Changes to the event schema require approval from both maintainers.

## Never commit a real recording

Session transcripts and rollout files hold source code, file paths, commands and sometimes secrets. `.gitignore` refuses `*.jsonl` everywhere except `fixtures/redacted/`. Only synthetic or genuinely redacted fixtures belong in this repository.

## Licence

Drishya is [Apache-2.0](LICENSE). By contributing, you agree that your contribution is licensed under the same terms.
