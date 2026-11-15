# SEC-5 · Scan of the whole Git history

Run 15 Nov 2026 (Windows 11, Node 24.14.0, git 2.53.0) on the SEC-5 branch cut from `main` at `3b1f7c67`. **Counts, rules, file paths and commit prefixes only.** No matched value, no journal content and no secret appears in this file or was written anywhere outside the scratch folder of the session that ran it. Reproduce with `docs/release-checklist.md` §4. Figures come from the run before this report was committed; every later commit that touches a note adds a version to its count.

## Verdict

**No real credential and no real journal content was found.** Every secret-pattern match is an invented value in a test, fixture or generator, a code identifier that happens to look like `token = …`, or a fixed development constant for a throwaway loopback server. Nothing needs rotating. Nothing was rewritten or force-pushed.

Three things need a builder decision before the repository is public; none is a credential. They all point the same way as REPO-1's recommendation (publish a fresh history; keep this repository as the private archive):

1. **Personal paths and local account names** are in the history of documents (details below): 1,719 blob versions of 13 documents contain a Windows user path (two local account names between them) and 1,219 versions of 4 documents a macOS/Linux-style home path. Deleting the documents later does not remove them from history.
2. **Recording and session identifiers** of the builders' own sessions are in 7 documents (212 versions).
3. **Screenshots built from real sessions** are in history: the landing-page footage has 64 image versions in 8 commits, of which 16 are the current set. Images cannot be pattern-scanned, so the 48 earlier versions (older iterations and alternatives) are unchecked content.

## What was scanned

| | |
|---|---|
| Refs | 1,546: local branches, 567 remote-tracking refs (including ones whose branch was deleted on GitHub), tags, and **all 500 `refs/pull/*/head` commits** fetched from GitHub. Squash-merging leaves each PR's original commits only there, and a public repository would show them. |
| Commits | 3,280 reachable from those refs (gitleaks, which skips merge commits: 2,694) |
| Blobs | 10,643 (10,555 text, 88 binary, none over 8 MiB) at 1,891 distinct paths |
| Not scanned | GitHub-side text that becomes visible on the same day: PR descriptions and comments (500 PRs), issues, Actions logs and artifacts. Git's stash and unreachable objects (never pushed). Binary files' contents. |

Tools (portable binaries in a scratch folder, never committed): **gitleaks 8.30.1** (`git`, `--redact=100`, branches, remotes, tags and the PR refs); **trufflehog 3.99.9** (`git file://.`, **`--no-verification`**, so no found value was sent to any service); **`scripts/scan-history.ts`**, new in SEC-5, which runs SEC-2's own redaction rules (`@drishya/privacy`, policy p5) over every blob, plus path rules, private-text rules and a transcript-shape check.

## Result by tool

### gitleaks: 82 findings in 17 files

| Rule | Where | Count | Verdict |
|---|---|---|---|
| `generic-api-key` | `tests/security/lib/secrets.ts` (the invented canaries) | 26 | invented |
| `generic-api-key` | 12 other test files and `scripts/fixtures/make-synthetic.ts` | 34 | invented values and test tokens |
| `generic-api-key` | `apps/ui/src/lib/experience.ts` | 6 | false positive: the name of a browser-storage key (`drishya-experience-vN`) |
| `github-pat` | `fixtures/synthetic/antigravity/corpus.ndjson`, `scripts/fixtures/make-synthetic.ts`, two tests | 10 | invented (the fixture generator writes them so redaction has something to catch) |
| `jwt`, `private-key`, `twilio-api-key` | `tests/security/lib/secrets.ts` | 6 | invented canaries |

### trufflehog: 15 findings, 0 verified (verification was off), all in test files

AWS ×2, Postgres ×2, Twilio ×2 (`tests/security/lib/secrets.ts`, two commits each); GitHub ×1 (`packages/privacy/test/nested-json.test.ts`); URI with credentials ×8 (three `apps/ui/test/*.test.ts`, invented `user:password@host` strings). All are invented values.

### SEC-2's redaction rules over every blob

| Result | Blobs |
|---|---|
| Rule hits in test, fixture or generator paths (aws-access-key 10, azure-storage-key 2, bearer 6, discord-token 2, github-token 6, jwt 2, openai-key 162, private-key 4, slack-token 2, twilio-key 2, url-credentials 17, secret-assignment 851) | 1,066 |
| Same, but in a test file where the value does not *look* invented (no canary word, run or known canary) | 53 blobs in 14 files: read by a person on 15 Nov: development tokens that are readable words, code identifiers such as `tokens: Record<…>`, a `'a'.repeat()` stress string. **Invented.** |
| `secret-assignment` outside tests | 63 blobs in 18 files: **code identifiers** (`const token = …`, `tokens: …`) in `apps/ui`, `packages/{scene,capture-core,projection}` and fixed **development tokens** in 8 benchmark and guard scripts (`scripts/bench-*.ts`, `clarity-guard.ts`, `ui-26-guard.ts`, `verify-ui-fallbacks.ts`, `site-footage*.ts`), each a readable word string for a throwaway daemon on an ephemeral loopback port |
| `bearer` outside tests | 2 blobs in `scripts/site-footage-real.ts`: the same kind of development constant |
| `.claude/launch.json` | 4 versions, 3 with `secret-assignment`: the committed preview configuration holds a fixed development token for the local preview server (a readable word string). Not a credential; REPO-1 decides whether the file stays. |

## Journal content and private material

| Check | Result |
|---|---|
| `*.jsonl` / `*.ndjson` outside `fixtures/synthetic` and `fixtures/redacted` | **0** blobs |
| A transcript-shaped blob (≥20 JSON lines with journal keys) outside synthetic locations | **0**; 1 inside `fixtures/synthetic`, invented |
| A path into a real harness folder (`.claude/projects/<account>/…`, a Codex `rollout-…` path) | **0** outside tests; 1 blob in a test, with invented content |
| Environment files, keys, databases, `.local/` folders | **0** |
| Windows user path with a local account name | 1,719 versions: `docs/STATUS.md` (1,196), `docs/TASKS.md` (465), 10 others under `docs/review/`, `docs/superpowers/plans/` and `scripts/Rename-Project.ps1` (58). Two distinct account names. |
| macOS/Linux home path | 1,219 versions: `docs/STATUS.md` (1,196), `docs/review/audit-1-product-audit.md`, `96-responsive-workspace-files.md`, `comp-1-premium-ui-review.md` |
| E-mail address | 1 document, 2 versions (`docs/review/antigravity-builder-prompts.md`): an address at a third party's company domain, not a builder's |
| Recording or session identifier | 7 documents (`docs/STATUS.md` 174 versions, `docs/TASKS.md` 31, five more with 1–2): ids of recordings imported from the builders' own sessions. Notes are meant to hold prefixes only. |
| Binary files (88): fonts, favicon, brand and `docs/` images | no finding; `apps/site/public/footage/*.jpg` is the 64-version set above; `docs/images/*.png` (3), `docs/*.png` (3, the logo drafts), `docs/review/perf-2-diagnostics-visuals/*.png` (2) have not been looked at by an agent and need a person's eye before PUBLIC-1 |

## What this means for the decisions ahead

- **Keeping the history (REPO-1 option a)** would publish 1,719 + 1,219 versions of working notes with local account names and home paths, 212 versions with recording ids, and 48 older screenshots from real sessions, plus 500 PRs' descriptions and comments that this scan could not read. None of that is a credential, but "no scan can prove all clean" (REPO-1's reasoning) holds: the scan finds patterns, not the sentence a builder pasted into a note in October.
- **A fresh history (option b)** makes this scan moot for the old commits. **Re-run `scripts/scan-history.ts`, gitleaks and trufflehog on the new history before the flip**; that run replaces this one, and PUBLIC-1's gate points at it.
- **Either way:** the 16 current footage images, the three `docs/` PNG drafts and the performance screenshots need a person to confirm they show only synthetic or approved content. Recording ids and local paths in the notes that survive REPO-1's curation should be removed in that curation.
- `.claude/launch.json` (a preview configuration with a development token) and the development tokens in `scripts/` are not secrets, but a stranger who sees `DRISHYA_TOKEN` in a committed file will ask. Moving the tokens to a value generated at run time is a small follow-up, not a blocker.

## Limits of this scan

Pattern scanners find secrets that look like secrets. They cannot find a prompt pasted into a note, an image of a real screen, or a name. The "invented" verdicts above rest on the value's shape and on a person reading the surrounding line with the value masked; no value was ever printed. The scan covers history as of 15 Nov 2026; a later commit is not covered until it is re-run.
