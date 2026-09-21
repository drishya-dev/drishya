# Contributing to Drishya

Drishya is early: the design is settled enough to build, and the application is just beginning. Thank you for looking.

## Start here

1. **[`docs/VISION.md`](docs/VISION.md)** — what Drishya should look, move and feel like.
2. **[`AGENTS.md`](AGENTS.md)** — the non-negotiable constraints and how work flows. It is written for coding agents, and it applies to people just the same.
3. **[`docs/README.md`](docs/README.md)** — every document, and which one wins where they overlap.

## How work flows

- Branch from `main` as `<handle>/<topic>`, open a pull request, and ask for review. Squash-merge.
- The pull request template is the checklist. Every item traces to a constraint in `AGENTS.md`.
- Changes to the event schema need agreement from both maintainers, because it is the seam between capture and rendering.
- Claim larger work in [`docs/STATUS.md`](docs/STATUS.md) first, so two people never build the same thing.

## Never commit a real recording

Session transcripts and rollout files hold source code, file paths, commands and sometimes secrets. `.gitignore` refuses `*.jsonl` everywhere except `fixtures/redacted/`. Only synthetic or genuinely redacted fixtures belong in this repository.

## Licence

Drishya is [Apache-2.0](LICENSE). By contributing, you agree that your contribution is licensed under the same terms.
