# CI usage policy — 6 October 2026

The builder requested **local checks during development and hosted checks only for an explicitly selected final candidate** after the organization reached 90% of its included Actions allowance. This supersedes the earlier automatic push/PR policy. Do not restore automatic triggers without discussing the quota impact with the builder.

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

When the builder asks for **final verification**, dispatch once on the selected branch after local checks pass:

```powershell
gh workflow run ci.yml --ref <candidate-branch>
gh run list --workflow ci.yml --branch <candidate-branch> --limit 1
gh run watch <run-id> --exit-status
```

The GitHub Actions page also offers **Run workflow** with branch selection. Verify the run's `headSha` matches the candidate commit. Do not rerun everything automatically after a failure: reproduce/fix locally, then request the failed jobs only (`gh run rerun <run-id> --failed`) if the code has not changed, or dispatch a new candidate when final verification is requested again. Never treat an old passing run as evidence for newer code. Avoid a second identical full run after squash merge unless integration changes justify it or the builder requests it.

All seven existing platform jobs remain available: checks and browser journeys on Linux/Windows, packaging on Linux/Windows/macOS. Local Windows results do not certify Linux/macOS. Until a candidate receives the manual platform run, describe it as locally verified; public-release platform/physical acceptance remains open. Branch-protection required automatic checks were unavailable on the current private Free organization repository; if protections are enabled later, align them with this manual policy rather than leaving undispatched required checks permanently pending.

## Billing facts and limits

Actions usage is charged to the **repository owner**, `drishya-dev`, regardless of which builder or agent pushes. Personal account allowances do not transfer to an organization-owned repository. The alert reported 1,800/2,000 included minutes and a 1 November 2026 reset. The billing API read on 6 October reported zero net charges for the listed usage; it did not establish payment-method or budget settings. Beyond quota, execution may stop or incur charges depending on those settings. No billing budget, payment method, repository visibility or plan was changed.

Deleting runs does not refund consumed compute. Manual-only execution can continue development without Actions consumption, but cannot recover the allowance already used. Current official references: [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing). Prices and entitlement presentation can change; do not estimate remaining capacity simply by summing raw minutes across operating systems.
