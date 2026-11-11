# SHIP-16a — canonical checkout identity and platform CI

Yash with Codex, 11 November. Original three-platform run: 42967305423, `fc4c1925`. The independent browser repairs are split first as SHIP-16b under Yash's explicit instruction; this report classifies them without changing UI or motion in a checkout-security patch. No merges by Codex.

## Confirmed causes and correction

- `checkoutIdentity` compared `realpath(requested)` with the supplied spelling and rejected any difference. This rejects a legitimate junction/symlink, macOS `/var` aliases and Windows 8.3 temp paths, not just a moved checkout. Identity now records the canonical root and its directory/Git identities. Grant keys use that same canonical path, so approving, restoring or revoking through another spelling addresses one grant. Missing paths retain their original key for removal. A moved/replaced root or retargeted alias cannot inherit an unrelated grant.
- Git worktree administration pointers can also spell an aliased ancestor. Canonicalise those paths, but still reject a final symlinked metadata directory and retain inode/birthtime checks. The `.git` marker's symlink, file identity and bounded-read guards stay unchanged. Home/drive-root refusal uses canonical home too.
- Image race/path fixtures used noncanonical temp paths even though exact-image permission intentionally refuses linked file paths. Canonicalise **synthetic fixture directories**, not product image permission. All link/protected/outside/changed-file/revoke assertions stay.
- `repository-root` already canonicalised its temp directory, then compared it to an uncanonicalised cleanup bound. The cleanup guard now compares canonical temp bounds; no broader deletion is allowed.
- APFS can refer to one disk file through NFC and NFD spellings. The draft test incorrectly asserted two distinct inodes. It now checks its actual promise: exact inert draft spellings round-trip and disk bytes remain unchanged. No draft restore, overwrite or Unicode policy changed.

## Targeted proof

Local portability units: 38 passed / one existing case-sensitive-Windows opt-in skip in five files. The physical Windows **8.3 test ran and passed**, not skipped. It obtains the short path using a fixed read-only command, proves the canonical path and grant key match, restores through both spellings and rejects a move. Directory-alias tests use an actual Windows junction (POSIX symlink on the other platforms), prove cross-session restore/read/revoke, and reject retargeting. Existing missing/replaced/redirected-root and Git-administration replacement tests remain.

An initial new test tried to overwrite Git's hidden Windows `.git` pointer with `w`, which Windows refuses. The synthetic-only test now opens the existing hidden file with `r+`, truncates it and writes the pointer; no native journal or user repository is involved.

Both-harness scratch-home/browser acceptance, affected checks, package verification and final hosted run evidence follow before readiness. Native sessions are read-only inputs; only prefixes/sizes/counts are recorded. Screenshots stay in `.local/`.

## CI boundaries

The branch's browser job explicitly uses two workers, with its existing one-worker serial pass. Local browser checks use Edge; hosted CI retains the workflow's installed Playwright Chromium. Windows/Linux/macOS hosted checks are CI coverage, not a human platform acceptance or WSL/Mac native-live claim.

The requested **main** dispatch runs the current main commit; branch-only fixes cannot be claimed present until Opus reviews and merges. A separate branch dispatch verifies these corrections before that merge. Main and branch outcomes will be listed independently, with actual SHAs, worker counts and each remaining failure. The stale demo bundle was already regenerated on main, not changed here. No test retries, relaxed assertion or longer timeout.
