# Release security checklist

Run at **every release**, on a clean checkout of the exact commit being released, by a builder (an agent may run the commands and fill the table; a builder signs it). Copy the table at the end into `docs/review/release-<version>-security.md` (counts, versions and verdicts only: never a secret, a found value or journal content). SEC-5 is a **gate** for [PUBLIC-1](TASKS.md) and [SHIP-9](TASKS.md): neither is done until this list has been run once end to end and signed.

Never publish from an agent (REL-4). Never rewrite or force-push history except as REPO-1 decides.

## 0. Start clean

```bash
git status --short            # empty
corepack pnpm install --frozen-lockfile   # fails if the lockfile and package.json disagree
```

Write down the commit (`git rev-parse HEAD`) and the tool versions in the table below.

## 1. The security suite

```bash
pnpm test:security            # tests/security/**, ~600 tests; also runs inside package:verify
pnpm test:security:mutations  # optional, slow: removes each defence in turn and checks the suite notices
```

Pass: zero failures. Run it on **each** system you release for (Windows, Linux, macOS); `docs/review/sec-3-threat-model.md` §7 records which have been run.

## 2. The package: allowlist, zero dependencies, offline install

```bash
pnpm package:verify           # builds, checks, installs the tarball offline, runs the server, then the security suite
```

`package:verify` fails if any of these is false (see `scripts/lib/package-contents.ts`, `tests/security/11-package.test.ts`):

- every file `npm pack` would publish is on the allowlist: no `.env`, `.local`, journals outside `fixtures/synthetic`, real fixtures, screenshots, store files, keys or editor settings;
- no file carries an absolute local path, this machine's user or home name, or a match of any SEC-2 redaction rule (the invented secrets in the fixtures are listed by exact rule and count);
- source maps (none are shipped today) list only relative sources, and no `sourceMappingURL` points outside the package;
- the package has **no scripts** (so no install script), no `dependencies` of any kind, and no `@drishya/*` or `workspace:` entry; the bundled daemon imports only `node:` built-ins;
- `publishConfig.provenance` is `true` and `repository` is set;
- **the outbound-traffic walk**: the packed, installed server runs with `scripts/lib/net-recorder.mjs` preloaded through two start-ups, and every TCP connection, DNS lookup and UDP send it (and its worker threads) attempts is loopback. The log line `Packed CLI network walk: N attempt(s), all loopback` is the evidence.

Also read the list once by eye, because an allowlist only knows what was thought of:

```bash
cd dist/package && npm pack --dry-run
```

Then the manual half of the walk, which a script cannot do: start the **installed** package (`node <install>/node_modules/@drishya-dev/cli/apps/daemon/src/cli.mjs serve`), open the link, visit Home, a session, Files, Changes, Git, Search, Settings and the demo with the browser's Network panel open, and confirm every request goes to `127.0.0.1`. Confirm one listener: `netstat -ano | findstr LISTENING` (Windows) or `ss -ltnp` (Linux) shows the daemon on `127.0.0.1` only.

## 3. Dependencies

```bash
pnpm audit                    # "No known vulnerabilities found", or each advisory explained in the table
gh api "repos/drishya-dev/drishya/dependabot/alerts?state=open" --jq length   # 0, or each alert explained
git diff --exit-code pnpm-lock.yaml       # the lockfile did not change during the run
```

- CI installs with `--frozen-lockfile` (`ci.yml`, `release.yml`).
- The daemon has zero runtime dependencies: asserted by `tests/security/11-package.test.ts` and `package:verify`. A new runtime dependency needs both builders' agreement first.
- Pin check: `release.yml` uses full commit SHAs for every action. Update them on purpose, never by a floating tag.

## 4. History scan

Before the repository is made public, and again for each release candidate (it is quick):

```bash
git fetch origin '+refs/heads/*:refs/remotes/origin/*' '+refs/pull/*/head:refs/pull/*'   # squash-merged PRs keep their commits only here, and a public repository shows them
node scripts/scan-history.ts > scan.txt      # SEC-2's rules on every blob of every branch, tag and PR head; counts, rules, paths and commit prefixes only
gitleaks git . --redact=100 --report-format json --report-path gitleaks.json --log-opts="--branches --remotes --tags --glob=refs/pull/*"
trufflehog git file://. --no-verification --no-update --json > trufflehog.json   # --no-verification: a found value is never sent to a service to test it
```

The tools are single portable binaries (gitleaks from `gitleaks/gitleaks` releases, trufflehog from `trufflesecurity/trufflehog` releases): put them in a scratch folder outside the repository, never commit them, and write their versions in the table.

- Every `REVIEW` line from `scan-history.ts`, and every gitleaks or trufflehog finding outside the invented-secret locations (`tests/`, `fixtures/synthetic/`, `scripts/fixtures/`, `packages/*/test/`), gets a verdict in the report: *false positive*, *invented value*, *fixed development constant* or **real**.
- **Anything real**: stop. Rotate the credential first, then tell both builders. Removal from history is the builders' decision, coordinated with REPO-1 (fresh history). Never rewrite or force-push as part of the scan.
- Read the JSON reports only as counts per rule and path (a short script, not a pager). **`trufflehog.json` contains the found values themselves** (`Raw`): never open it in a terminal, never paste it; delete it, and `gitleaks.json`, afterwards or keep them outside the repository.
- GitHub-side text is not in Git and is not scanned by these tools: skim the titles and descriptions of open and recent PRs and issues for pasted paths, ids and prompts before the flip.
- Real journal content: no `*.jsonl` / `*.ndjson` outside `fixtures/synthetic` and `fixtures/redacted`, no transcript-shaped blob, no image of a real session that the builders did not approve (binary files are listed by folder and extension; look at new ones).

## 5. Repository and publishing

- [ ] `SECURITY.md` is at the repository root and GitHub's **Private vulnerability reporting** is enabled (Settings → Code security), so the report link in it works.
- [ ] Dependabot alerts and security updates are on; open alerts: 0.
- [ ] Branch protection on `main`; Actions workflow permissions read-only; fork pull requests need approval; no repository secrets (`release.yml` uses npm trusted publishing, which needs none).
- [ ] The npm trusted publisher for `@drishya-dev/cli` is set (repository `drishya-dev/drishya`, workflow `release.yml`, environment `npm-release`).
- [ ] Run `release.yml` first **without** `publish` and read its log; then, a builder starts it with `publish` ticked. Never run `npm publish` from a laptop: it carries no provenance.
- [ ] After publishing: `npm view @drishya-dev/cli dist.attestations` shows a provenance attestation, and `npm audit signatures` in a scratch project that installs the package passes.
- [ ] The README's *Privacy* section still matches the code: re-read it against `tests/security/06-outbound-traffic.test.ts` and the list of opt-ins.

## 6. Record

| Item | Value |
|---|---|
| Release / commit | |
| Date and who ran it | |
| Operating systems run | |
| Node / pnpm / npm | |
| git / gh | |
| gitleaks / trufflehog | |
| Playwright + Chromium (browser checks) | |
| `pnpm test:security` | passed / total, per system |
| `pnpm package:verify` | pass; network walk attempts |
| `npm pack --dry-run` | files / size |
| `pnpm audit` | |
| Dependabot open alerts | |
| History scan: blobs, `REVIEW` lines, verdicts | |
| gitleaks: findings, verdicts | |
| trufflehog: findings, verdicts | |
| Anything accepted, with the reason and both builders' names | |

First run: [sec-5-history-scan.md](review/sec-5-history-scan.md) (history) and the SEC-5 pull request.
