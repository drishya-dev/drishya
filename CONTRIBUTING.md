# Contributing to Drishya

Thank you for looking. Drishya shows what a coding agent does, as the real files, output and diffs, beside your repository, while it happens. Contributions of code, bug reports, fixtures, documentation and support for more agents are welcome.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report a security problem privately, never in an issue: see [SECURITY.md](SECURITY.md).

## Start here

1. **[`docs/VISION.md`](docs/VISION.md)**: what Drishya should look, move and feel like. Read it before any interface work.
2. **[`AGENTS.md`](AGENTS.md)**: the non-negotiable constraints (passive capture, redaction before storage, no telemetry, provenance). It is written for coding agents and applies to people just the same.
3. **[`docs/README.md`](docs/README.md)**: every document, and which one wins where they overlap.
4. **[`docs/CODEBASE.md`](docs/CODEBASE.md)**: the packages and the data flow.
5. **[`ROADMAP.md`](ROADMAP.md)** and the [open issues](https://github.com/drishya-dev/drishya/issues): what is wanted. Issues labelled `good first issue` are the gentlest way in; `harness integration` is for new agents.

Before starting, search the [Product Work History](docs/PRODUCT_WORK_HISTORY.md) and the [decisions log](docs/decisions/log.md) for the area. Several things that look wrong are deliberate (the history explains why), and some ideas were tried and dropped.

## Run it

You need **Node.js 24 or newer** (`>=24`), Git, and a desktop browser at least 600 px wide. Drishya was built and tested on Windows 11; Linux and macOS reports are welcome.

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm ui:build
corepack pnpm serve            # opens Drishya; add ?demo to the URL for a sample session
```

For development, `corepack pnpm ui:dev` serves the UI with hot reload and `corepack pnpm dev` runs the daemon in development mode. Use a separate install in every checkout or worktree; never share `node_modules` between them.

## Check your change

| Command | What it checks |
|---|---|
| `corepack pnpm check:affected` | Typecheck, related unit tests and the browser specs that name your changed files. Run it as often as you like. |
| `corepack pnpm check` | Typecheck and all unit tests |
| `corepack pnpm test:security` | The security suite (see the [threat model](docs/review/sec-3-threat-model.md)); run it when you touch the daemon, capture, redaction, Git or file access |
| `corepack pnpm test:browser` | The full browser suite; it builds the UI and the site first |
| `corepack pnpm package:verify` | Builds the installable package and verifies it; run it when you touch ingest, the store or packaging |

CI is described in [`docs/CI_POLICY.md`](docs/CI_POLICY.md). A change that adds or alters behaviour needs a test that fails without it. The event schema is the seam between capture and rendering: changes to it need agreement from both maintainers and the `schema` label.

## Real sessions: the rule for anything that shows captured content

The demo and the synthetic fixtures are regression guards, not acceptance. If your change affects what a card, reader, header, list or projection shows, check it on real sessions of the harnesses involved (Claude Code, Codex, Antigravity) that actually contain the case, as well as the fixtures:

- Use a **scratch Drishya home**, never your own. `corepack pnpm check:real -- --list` shows the cases, and `corepack pnpm check:real -- <case>` scans your local sessions, imports the best match into a temporary home, prints counts and short id prefixes, and deletes the home. It never prints journal content. If your feature needs a case that is not there, add one in `scripts/real-cases/`.
- If no session of yours contains the case, **make one**: run the real agent on a throwaway repository until it records the case, then check that.
- Look at the result at 600 px and at 1440 px.
- In your pull request, say which cases you checked and which you could not, with session id prefixes and sizes only. A change checked only on the demo is "demo-checked", not done.

**Never commit a personal recording, and never paste real journal content into an issue or pull request.** Session transcripts and rollout files hold source code, file paths, commands and sometimes secrets. `.gitignore` refuses `*.jsonl` everywhere except `fixtures/redacted/` and `fixtures/synthetic/`. Only synthetic fixtures (invented content in a real harness format) or genuinely redacted ones belong in this repository. Keep screenshots of real sessions in an ignored folder such as `.local/`.

## Add support for another agent

An adapter reads one agent's own session recordings, read-only, and maps them to Drishya's events; the rest of the product works unchanged. The steps, the interface and what to record honestly (unknown records stay unknown, encrypted reasoning is never surfaced) are in [`docs/CODEBASE.md`](docs/CODEBASE.md#adapters--how-to-add-a-harness). Open a **Harness integration** issue first to say what the agent records and where; synthetic fixtures in the real format and parser tests are part of the change.

## How work flows

1. Check the [open issues](https://github.com/drishya-dev/drishya/issues), related pull requests and the [Product Work History](docs/PRODUCT_WORK_HISTORY.md). For anything beyond a small fix, open or comment on an issue to agree the problem, the scope and what a reviewer should be able to verify. Say in the issue that you are taking it.
2. Branch from `main` as `<handle>/<topic>`. Open a focused pull request, link the issue, and keep unrelated changes in separate pull requests. A draft pull request is a good way to share work in progress.
3. Fill in the pull request template: what changed, how you checked each acceptance criterion, which checks are pending. A maintainer reviews it before a squash merge, titled `area: what changed`. Labels name the area; the event schema uses `schema`.
4. Record anything durable: a decision and its reason in [`docs/decisions/log.md`](docs/decisions/log.md), an experiment's finding in the Product Work History when it could stop someone repeating it.

## Licence

Drishya is [Apache-2.0](LICENSE). By contributing, you agree that your contribution is licensed under the same terms. The Drishya name and logo are not covered by that licence: see [TRADEMARKS.md](TRADEMARKS.md).
