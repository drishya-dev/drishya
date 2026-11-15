# Repository ownership

This file is a coordination map, not an access-control file. The canonical
workflow remains [`AGENTS.md`](AGENTS.md), [`docs/STATUS.md`](docs/STATUS.md),
and [`docs/TASKS.md`](docs/TASKS.md).

## Builders

| Area | Primary working owner | Required reviewer / decision owner |
|---|---|---|
| Product direction, release scope, acceptance decisions | Yash | Harsh reviews implementation and evidence |
| Application implementation, fixes, tests, and release tooling | Harsh / Codex | Yash reviews before merge |
| UI composition and polish | The builder who claims the task | The other builder; use `emil-design-eng` for UI work |
| Native Claude Code or Codex sessions | The builder who has the signed-in harness | The other builder reviews recorded evidence |
| Release/security/publication decisions | Yash | Harsh confirms the candidate and evidence |

“Primary” here means the normal coordinator for that area, not exclusive
file ownership. Either builder may work anywhere after claiming a whole task
and agreeing any shared-file scope.

## Ownership rules

1. Before editing, run `node scripts/claims.ts` and claim one complete ID from
   `docs/TASKS.md` in `docs/STATUS.md`.
2. Never edit a path listed in another active claim. If two tasks need the same
   path, coordinate a handoff or split the task before coding.
3. Open a draft PR after the first commit. Keep one whole TASKS item per PR;
   record any approved scope expansion in the claim and PR.
4. The other builder reviews the PR before merge. A green check is not a
   substitute for that review.
5. A task is not complete until its Accept list, targeted checks, and required
   real-session evidence are recorded. Synthetic fixtures alone are not
   acceptance.
6. Remove the claim and tick the task only in the finishing PR, then run
   `node scripts/sync-tasks.ts`.

## File-area guide

This guide helps route questions; it does not reserve files or replace a
claim's exact Files column.

| Area | Typical paths |
|---|---|
| UI shell, stage, history, reading surfaces | `apps/ui/src/components/`, `apps/ui/src/*.css` |
| UI contracts and palette tokens | `apps/ui/src/tokens.css`, `apps/ui/src/modern/`, `apps/ui/test/` |
| Daemon, storage, API, capture | `apps/daemon/src/` |
| Browser acceptance | `tests/browser/` |
| Unit and package checks | `apps/*/test/`, `packages/*/test/`, `scripts/` |
| Product truth and execution state | `docs/TASKS.md`, `docs/STATUS.md`, `docs/CONTINUITY.md` |
| Review evidence | `docs/review/` and uncommitted `.local/` evidence |
| Public landing site | `apps/landing/`, `scripts/build-landing.ts`, and the site assets used by the claimed task |

## What this file does not decide

- It does not create exclusive CODEOWNERS boundaries; the repository's two
  builders work anywhere.
- It does not override a current claim, task dependency, freeze, or release
  decision in `AGENTS.md`, `STATUS.md`, or `TASKS.md`.
- It does not assign a task implicitly. A task is owned only when its claim is
  present in `docs/STATUS.md`.

When this file and the canonical documents disagree, follow the canonical
documents and update this guide as a separate documentation change.
