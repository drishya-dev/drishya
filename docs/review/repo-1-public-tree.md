# REPO-1: the public tree

**Status (16 November 2026): the tree is ready to publish.** This note records what was done to get the private repository's `main` into a tree a stranger can read, the audit and scanner results, how to create the public repository from it with a fresh history, and what the maintainers must still do by hand. It merges REPO-1 (the cleanup) and PUBLIC-1's content audit, as Yash asked on 16 November. Harsh drafted the direction and the first inventory; Yash with Claude Sonnet 5.5 finished it (taken over in PR #509).

The rule that decided every choice: *the main open tasks stay visible to contributors, every task entry and its dated log is kept so earlier related work can be found, and everything in the repository is what a public project needs, in its proper place, including the logo and brand.*

## What changed

| Area | Result |
|---|---|
| Task tracking | The priority list is gone. `docs/TASKS.md` became [`docs/PRODUCT_WORK_HISTORY.md`](../PRODUCT_WORK_HISTORY.md) with every entry and dated log kept (329 entries), a "how to use this record" note and an index by area and ID with anchors. `docs/STATUS.md`, `docs/CONTINUITY.md`, `scripts/claims.ts` and `scripts/sync-tasks.ts` are retired. |
| Decisions | The STATUS decisions log (66 entries and the older dated table), each with its reason, is [`docs/decisions/log.md`](../decisions/log.md), linked from [`docs/decisions/README.md`](../decisions/README.md). The claim table and the session blocks are not carried; the private archive keeps them. |
| Roadmap and issues | [`ROADMAP.md`](../../ROADMAP.md) (finish 0.1.0, next release, harnesses being explored) and [`repo-1-seed-issues.md`](repo-1-seed-issues.md): 31 issues to open from the open next-release and later items, with labels. |
| Open-source files | `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, reports through the private route in `SECURITY.md`, no personal email), `CHANGELOG.md` (0.1.0 unreleased), `TRADEMARKS.md` (code is Apache-2.0; the name and logo are not licensed for other products; also stated in the README licence section), a `harness-integration.yml` issue template, a security link in the issue chooser, and an updated pull request template. `CONTRIBUTING.md` now covers running it, the checks, the real-session rule written for contributors (scratch home, no personal recordings) and how to add a harness. `AGENTS.md` and `docs/README.md` were rewritten for the issue and PR workflow. |
| Brand | [`assets/brand/`](../../assets/brand/README.md): the mark SVGs, the app icon, the adaptive tab mark, the 2048 px logo, a 1280 × 640 social preview (`social-preview.png`, built from `social-preview.html`) and a usage README. The README, `docs/VISION.md` and the UI source point at it. A unit test keeps the copies served by the app and the site identical to the canonical files. |
| Planning and review documents | `docs/review` went from 320 files to 51 (the engineering plan, research ledger, security, performance, release and harness notes, and the notes the code and public docs still cite). The other 269, `docs/superpowers`, the early planning documents and the evidence pack are summarised, one entry each, in [`docs/PRODUCT_WORK_HISTORY_REVIEW_NOTES.md`](../PRODUCT_WORK_HISTORY_REVIEW_NOTES.md), and about 380 links to them were re-pointed. The summaries are the opening lines of each note, made mechanically; a maintainer can refine them. |
| Tree size | 1,638 tracked files before, 1,363 after. |

### Removed, archived and kept

| Path | Disposition |
|---|---|
| `docs/BLUEPRINT.md`, `docs/Vantage_Base_Prompt.md`, `docs/IMPLEMENTATION_ROADMAP.md`, `docs/PRODUCT_DELIVERY.md`, `docs/PRODUCT_DIRECTION.md`, `docs/reference/01-evidence-pack.md` | Removed from the tree; summarised in the review notes; the private archive keeps the originals. |
| `docs/review/**` (269 notes), `docs/review/finish/**`, `docs/superpowers/**` | Removed from the tree; summarised in the review notes. |
| `docs/Logo (1).png`, `docs/Logo (2).png`, `docs/images/readme-demo.png`, the two `docs/images/site-3-dots-*.png` | Deleted. An exact-name search of tracked text found no reference (the SITE-3 note that cited the two comparison images is itself archived). |
| `docs/Logo.png` (5 MB) | Moved to `assets/brand/logo.png`. |
| `docs/readme/mark-on-dark.svg`, `mark-on-light.svg` | Moved to `assets/brand/`. |
| `scripts/Rename-Project.ps1`, `scripts/rename-project.sh` | Deleted: they migrated Claude Code session history for a folder rename and named a personal path. |
| `.claude/launch.json` | Removed from the tree and `.claude/` is ignored: SEC-5's scanner treats any `.claude/` content as forbidden and the file held a fixed development token. A copy is in the shared notes folder for Yash. |
| An empty file with an unprintable name at the repository root (added by #505) | Deleted. |
| `docs/prototype/` | Kept: the interactive design reference cited by VISION; synthetic data only, checked for paths and ids. |
| `packages/adapter-antigravity/README.md` | Rewritten: it was a claim-era working log naming real session prefixes. The source-and-truth rules it held are kept. |

## Audit

- **Personal paths, account names, emails.** Every tracked file was scanned for Windows, macOS and Linux home paths, the local account name, personal and organisation email addresses, and the maintainers' names. What remains: the maintainers' public GitHub handles in `CODEOWNERS` and their names in the README and history (public by choice), and synthetic example paths and `@example.invalid` addresses in tests. Fixed: one test string that named the local account (`apps/ui/test/markdown-links.test.ts`), the Rename scripts, and the archived notes that carried `C:\Users\<name>` paths.
- **Real session ids.** The names of the 1,431 session files under the local Claude Code, Codex and Antigravity folders were collected (names only) and every full UUID in them was searched for in the tree: **0 hits**. Eight-character prefixes appear in the notes by design.
- **Real journal content.** No `*.jsonl` or `*.ndjson` outside `fixtures/synthetic`; `scripts/real-cases/**` holds code only, with no ids, paths or text from real sessions; `scripts/scan-history.ts` found no transcript-shaped blob outside the synthetic locations.
- **`apps/site/public/footage/**` (16 frames) and `docs/readme/*.png` (3).** Each was looked at. The three README frames and the site frames show Drishya's own public repository and the maintainers' public names. Four of the site frames also showed things that should not ship, and were redacted by blurring or covering only those regions: `prompt.jpg` (a local path with the account name, a full desktop-session id in two places, and the filename of a private document), `history-a.jpg`, `history-b.jpg` and `tool.jpg` (a partial session id in a notice at the top). **Yash:** these are patched, not re-captured; if you re-capture the site footage, do it from a clean demo repository.
- **`apps/ui/public/demo`, `fixtures/synthetic`, `tests/**`.** Synthetic by rule; every UUID, email and path pattern in them is invented.
- **Links.** All 1,000 relative links, images and anchors across the 79 Markdown files resolve (a custom check; the one item it reports is a quoted example inside a bug description, not a link). Links to private pull requests and issues became plain `#number` text, with a note in the Work History and decisions log that the numbers belong to the archive.

### Scanners, run on a fresh single-commit repository made from this tree

| Tool | Version | Result |
|---|---|---|
| `scripts/scan-history.ts` (SEC-2's own rules) | this tree | 1 commit, 1,355 blobs. 32 `REVIEW` lines, all in the classes SEC-5 already judged: 17 code identifiers and fixed development constants (`token`, `secret` in source and scripts), 1 development bearer constant (`scripts/site-footage-real.ts`) and 14 server tokens inside test files that do not look invented. Everything else is in the synthetic locations. Nothing real. |
| gitleaks | 8.30.1 (release checksum verified) | 38 findings: 37 in tests and synthetic fixtures (invented secrets) and 1 false positive (`apps/ui/src/lib/experience.ts`, a storage-key name). |
| trufflehog | 3.99.9 (release checksum verified), `--no-verification` so no value left the machine | 7 unverified findings, all in `tests/security/lib/secrets.ts` and three UI and privacy test files, all invented. 0 verified. |

The report files were deleted afterwards (trufflehog's holds the found values). Follow-up from SEC-5 still open: the fixed development tokens in `scripts/` could be generated at run time; a stranger reading them will ask, but they are not credentials.

## Verification

Run in this worktree with its own frozen install, on the branch tip:

| Check | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm test` (277 files) | 1,795 passed, 1 skipped, **5 timed out at the 5 s limit** (compaction, file-roots, git-compare, git-compare-service and images, all in `apps/daemon`) while the machine was busy downloading; the same five files pass alone (24/24 with the new brand test). A TEST-2-style load flake, not caused by this change, which touches no code those tests run. |
| `pnpm ui:build` and `pnpm --filter drishya-site build` | Pass |
| `pnpm package:verify` (builds, checks the package allowlist, installs the tarball, runs the server, runs `test:security`) | Pass; `test:security` 675 passed, 2 skipped |
| Markdown link check | 0 broken (see above) |
| Browser: `site-finished-product.spec.ts` (the site and its 16 footage frames), Edge, 2 workers | 8 passed. The rest of the browser suite was not run: no UI behaviour changed. The full gate belongs to the final whole test. |

## Decisions still open for the maintainers

1. **History: a fresh history, as recommended.** SEC-5 found personal paths, account names, recording ids and earlier footage in the old history ([report](sec-5-history-scan.md)). Confirm it, and say where the private archive lives (below). Harsh and Yash both agreed with the direction; this is the formal yes.
2. **Licence: Apache-2.0**, recorded in the decisions log on 11 November with "Harsh to confirm".
3. **Continuous integration in the public repository.** [`CI_POLICY.md`](../CI_POLICY.md) says CI runs only when started by hand, a policy made for a limited private-Actions allowance. Public repositories run Actions free. SHIP-16 (three-system CI) is the next step; decide then whether pull requests run it automatically, and update the policy.
4. **Trademark.** `TRADEMARKS.md` states the intent; no clearance search or registration exists yet (decisions log, "open decisions").
5. **Two-factor authentication for the GitHub organisation** was off when last checked (11 November). Enable it before publishing; it removes members without 2FA, so Harsh confirms his first.
6. **Where the code of conduct goes.** Reports use GitHub's private route in `SECURITY.md`. Add a shared maintainer address later if you want one; none is published.
7. **The review-note summaries are mechanical.** Refine any that matter to you.

## Yash must add by hand (not committed)

- **Your newer local logo files** (`docs/Logo.svg`, `docs/Logo1.png`, and your edited `docs/Logo.png`) are untracked or modified in your checkout and are not in this PR. When this PR merges, git will refuse to remove or replace `docs/Logo.png` if it has local edits: copy your edited version to `assets/brand/logo.png` first, put `Logo.svg` and `Logo1.png` where you want them under `assets/brand/` (and say how they relate to `mark-on-dark.svg`), then commit. `docs/PROJECT_MASTER_DESCRIPTION.md` was not touched.
- **`.claude/launch.json`** disappears from your checkout when you pull this. Restore it locally from the copy in the shared notes folder; `.claude/` is ignored from now on.

## Create the fresh-history public repository

Nothing here has been done. Do it from a clean checkout of the final commit of this branch (after #509 is merged into private `main`).

```bash
# 1. Archive the private repository under a new name first (GitHub redirects the old name until a new repository takes it).
#    Settings > General > Rename: drishya-dev/drishya -> drishya-dev/drishya-private. Keep it private; it is the archive.

# 2. Export the tree with no history.
git clone --branch main git@github.com:drishya-dev/drishya-private.git drishya-export
cd drishya-export
git rev-parse HEAD                       # write this down as the source commit
mkdir ../drishya && git archive HEAD | tar -x -C ../drishya
cd ../drishya

# 3. One commit. Use the noreply address GitHub shows under Settings > Emails, never a personal address.
git init -b main
git add -A
git status --short | head                # all "A"; nothing unexpected
git -c user.name="<name>" -c user.email="<id>+<handle>@users.noreply.github.com" commit -m "Drishya 0.1.0"

# 4. Check the export before it leaves the machine.
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck && corepack pnpm test && corepack pnpm package:verify
node scripts/scan-history.ts
gitleaks git . --redact=100 --report-format json --report-path ../gitleaks.json
trufflehog git file://. --no-verification --no-update --json > ../trufflehog.json   # contains found values: never open it, delete it after
```

Read the findings by class as in the table above; anything real means stop, rotate, and tell both maintainers. The tools are single binaries from `gitleaks/gitleaks` and `trufflesecurity/trufflehog` releases (this run used 8.30.1 and 3.99.9, with the release checksums checked): keep them outside the repository.

```bash
# 5. Create the empty repository drishya-dev/drishya on GitHub: no README, no licence, no .gitignore. Create it private,
#    push, set everything below, then flip it to public.
git remote add origin git@github.com:drishya-dev/drishya.git
git push -u origin main
```

The release itself is a separate step: tag `v0.1.0` and run `release.yml` as described in [`../release-checklist.md`](../release-checklist.md) (the npm trusted publisher must name the new repository). Because history restarts, the pull request and issue numbers in the Work History and decisions log point at the archive, which the notes say.

## GitHub settings to set by hand

On `drishya-dev/drishya`, before making it public:

- **Private vulnerability reporting:** Settings > Code security > Private vulnerability reporting, on. `SECURITY.md` and the code of conduct both send people there.
- **Protect `main`:** Settings > Rules (or Branches): require a pull request, **1 approving review** (CODEOWNERS reviews), the CI checks to pass, linear history, no force pushes, no deletion. Allow squash merging only; delete branches on merge.
- **Discussions:** on (Settings > General > Features). Create a Q&A and an Ideas category.
- **Dependabot:** alerts and security updates on; add `.github/dependabot.yml` if you want version updates (not committed: pick the cadence).
- **CodeQL:** Settings > Code security > Code scanning > set up CodeQL (default setup, JavaScript/TypeScript). Free on a public repository.
- **Actions:** workflow permissions read-only; fork pull requests need approval; no repository secrets (`release.yml` uses npm trusted publishing). Create the `npm-release` environment the checklist names.
- **Social preview:** Settings > General > Social preview > upload `assets/brand/social-preview.png` (1280 × 640).
- **Topics and description:** description "See what your coding agent does, as it does it. A local live view and replay for Claude Code, Codex and Antigravity." Topics: `coding-agents`, `claude-code`, `codex`, `ai-agents`, `developer-tools`, `agent-observability`, `visualization`, `local-first`, `typescript`.
- **Labels and issues:** create the labels listed in [`repo-1-seed-issues.md`](repo-1-seed-issues.md), open the 31 issues, and pin a "Start here" issue or Discussion.
- **Organisation:** two-factor authentication required (see above); both maintainers as owners.

## Original inventory and rationale (Harsh, 15 November)

The first inventory covered 1,620 tracked files at private `main` `41814da2` and proposed the dispositions that this change carried out, with these differences: the retired tracking files were not zipped (the private repository stays as the archive and has every version), `docs/prototype/` was kept, and `docs/review/**` was reduced to the notes still cited rather than all archived. The public contributor workflow is in [`AGENTS.md`](../../AGENTS.md) and [`CONTRIBUTING.md`](../../CONTRIBUTING.md): an issue for substantive work, a focused pull request that records the checks and acceptance evidence, maintainer review, squash merge, and durable decisions recorded in the decisions log.
