# FILES-5 remaining external acceptance — 30 October 2026

The implementation and available Windows acceptance are already documented in [whole acceptance](files-5-whole-acceptance.md) and [identity correctness](files-5-recovery-identity.md). This handoff does not reopen that completed source scope or mark the parent done.

The remaining task needs actual macOS/Linux, a case-insensitive POSIX volume, permitted positive file-symlink behavior and physical/human recovery. No such external result was produced in this Windows-only preflight. Current Windows host inventory is 14 physical cores / 23.71 GiB RAM; that does not fill the platform gaps. Harsh confirmed on 30 October that only this Windows host is available, and a human tester can run the walkthrough after a final candidate is ready.

Use [MAC-1's commands](mac-1-acceptance.md), [REL-2's device matrix](rel-2-physical-acceptance.md) and [REL-3's human packet](rel-3-human-acceptance.md). Test encrypted existing-file recovery, aliases/Unicode round-trip, stale/newer live-draft and atomic conflict refusals, download/reload/unlock/restore, wrong password/tamper, protected-path refusal, and permitted link cases. Record actual filesystem case sensitivity and outcomes; a junction is not a file-symlink pass, and string comparisons are not volume acceptance.

No new native model call is required for these existing recovery cases. Keep native sources read-only, ordinary drafts volatile, keys/passphrases unretained and restoration in memory. Record source prefixes/bytes/counts only. Parent FILES-5 stays unchecked until the external results are supplied.
