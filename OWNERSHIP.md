# Repository ownership

See [AGENTS.md](AGENTS.md) for the canonical contribution workflow and
[CODEOWNERS](.github/CODEOWNERS) for review routing.

| Area | Maintainer contact |
|---|---|
| Product direction, release scope, acceptance decisions | Yash |
| Application implementation, fixes, tests, and release tooling | Harsh |
| Native session verification | A maintainer with the relevant signed-in harness |

Contributors coordinate shared files and scope in the linked GitHub issue or PR.
A maintainer checks the acceptance evidence before merge.

## File-area guide

Use this guide to route questions and find the right code.

| Area | Typical paths |
|---|---|
| UI shell, stage, history, reading surfaces | `apps/ui/src/components/`, `apps/ui/src/*.css` |
| UI contracts and palette tokens | `apps/ui/src/tokens.css`, `apps/ui/src/modern/`, `apps/ui/test/` |
| Daemon, storage, API, capture | `apps/daemon/src/` |
| Browser acceptance | `tests/browser/` |
| Unit and package checks | `apps/*/test/`, `packages/*/test/`, `scripts/` |
| Product truth and execution state | GitHub Issues and `docs/PRODUCT_WORK_HISTORY.md` |
| Review evidence | `docs/review/` and uncommitted `.local/` evidence |
| Public landing site | `apps/landing/`, `scripts/build-landing.ts`, and the related site assets |
