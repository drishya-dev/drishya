# CI usage policy — 6 October 2026

> **Current, 18 November 2026 (CI-2).** The repository is public, so hosted minutes are free on standard runners, and `ci.yml` runs on every pull request, every push to `main`, nightly and on dispatch. What runs on each, and why, is the "CI runs by event" entry in [the decisions log](decisions/log.md). In short: pull requests run `check` on all three systems, the whole browser suite on Linux in four shards, and affected specs plus a smoke list on Windows and macOS; `main` and nightly run the whole suite on all three. The rest of this page is the earlier private-repository history and no longer describes the triggers.

> **Update, 16 November 2026 (SHIP-16).** `ci.yml` now also lists `push` and `pull_request` to `main`, but each job starts with `if: github.event_name == 'workflow_dispatch' || github.event.repository.private == false`. While the repository is **private**, a push or pull request starts a run whose jobs are all skipped: a skipped job gets no runner and uses no minutes, so the rules below still hold and only a builder's manual dispatch spends any. The day the repository is **public**, the same file runs on every push and pull request with no edit, free of charge on standard runners. Nothing else in this policy changes until then. The matrix is Windows, Ubuntu and macOS on Node 24 with a frozen install: `pnpm typecheck`, `pnpm test`, `pnpm ui:build`, the site build, `pnpm test:security`, `pnpm package:verify` and the demo-bundle drift check; then the browser suite on all three (Chromium, two workers plus the serial pass). Once public, make the `check` jobs required checks on `main`; keep `browser` required on Linux and watch Windows and macOS for a few runs before requiring them.

The builder requested **local checks and commits during development; hosted checks only at the completed-product publishing stage or immediately before it** after the organization reached 90% of its included Actions allowance. This supersedes the earlier automatic push/PR policy and the initial intermediate-final-candidate wording. Do not dispatch hosted CI for each completed feature or restore automatic triggers without the builder's direction.

## Development and final verification

Commits, PR creation, PR updates and merges no longer trigger `.github/workflows/ci.yml`. Its only trigger is `workflow_dispatch`. This saves all automatic hosted runner usage; it does not eliminate local testing or the need to keep main working. No scheduled or automatic fallback is configured.

Run applicable checks locally before committing and merging. For a complete code candidate, from the repository root on Node 24:

```powershell
corepack pnpm check
corepack pnpm test:browser
corepack pnpm package:verify
corepack pnpm demo:bundle
git diff --exit-code -- apps/ui/public/demo/bundle.json
```

Install Chromium once if needed: `corepack pnpm exec playwright install chromium`. The normal browser suite uses synthetic data; private real-session and ten-minute probes remain opt-in and local. Do not enable real imports merely for CI verification. If dependencies change, first install using the repository's tracked package-manager/lock configuration; exclude unrelated local package-manager edits from commits.

For substantial live-history/motion/reading changes, run the ten-minute synthetic check locally too (not on each documentation commit):

```powershell
$env:DRISHYA_P1_SOAK = '1'
try {
  corepack pnpm exec playwright test tests/browser/p1-pacing.spec.ts --grep 'sustained live reading'
} finally {
  Remove-Item Env:DRISHYA_P1_SOAK
}
```

It now retains one historical source reference while repeatedly appending captured work, holding the reader and returning to latest. Report its measured rounds/DOM results, not merely that the process launched. Core local checks require no GitHub Actions allowance.

When the builder asks for **pre-publication verification of the finished product**, dispatch once on the selected branch after local checks pass:

```powershell
gh workflow run ci.yml --ref <candidate-branch>
gh run list --workflow ci.yml --branch <candidate-branch> --limit 1
gh run watch <run-id> --exit-status
```

The GitHub Actions page also offers **Run workflow** with branch selection. Verify the run's `headSha` matches the candidate commit. Do not rerun everything automatically after a failure: reproduce/fix locally, then request the failed jobs only (`gh run rerun <run-id> --failed`) if the code has not changed, or dispatch a new candidate when final verification is requested again. Never treat an old passing run as evidence for newer code. Avoid a second identical full run after squash merge unless integration changes justify it or the builder requests it.

The manual workflow runs checks and browser journeys on Linux, Windows and macOS. Each check job verifies the installed package, which also builds the UI. Local Windows results do not certify Linux/macOS. Until a candidate receives the manual platform run, describe it as locally verified; public-release platform/physical acceptance remains open. Branch-protection required automatic checks were unavailable on the current private Free organization repository; if protections are enabled later, align them with this manual policy rather than leaving undispatched required checks permanently pending.

## Billing facts and limits

Actions usage is charged to the **repository owner**, `drishya-dev`, regardless of which builder or agent pushes. Personal account allowances do not transfer to an organization-owned repository. The alert reported 1,800/2,000 included minutes and a 1 November 2026 reset. The billing API read on 6 October reported zero net charges for the listed usage; it did not establish payment-method or budget settings. Beyond quota, execution may stop or incur charges depending on those settings. No billing budget, payment method, repository visibility or plan was changed.

Deleting runs does not refund consumed compute. Manual-only execution can continue development without Actions consumption, but cannot recover the allowance already used. Current official references: [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing). Prices and entitlement presentation can change; do not estimate remaining capacity simply by summing raw minutes across operating systems.
