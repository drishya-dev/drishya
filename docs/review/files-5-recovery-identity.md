# FILES-5 — recovery identity and dialog correctness

25 October 2026, PR #229. A bounded repair of existing opt-in encrypted recovery; parent FILES-5 remains open for filesystem/platform acceptance.

| Before | After | Why |
| --- | --- | --- |
| A differently cased Windows path bypassed a newer live-draft conflict and added another slot for the same file. | Drive/UNC aliases are checked before any real store change; every conflicting alias rejects the whole restore. Identical aliases reuse their slot. | An older recovery must never compete with newer unsaved work. |
| Snapshot validation rejected distinct case-only POSIX paths; draft equality depended on property order. | POSIX path spellings remain distinct; equality compares the draft fields and normalizes optional false creation metadata. | Path policy and serialization details must not invent conflicts. |
| Recovery form content touched dialog edges and its close control scrolled away on phones. | Scoped 16 px body padding, wrapping/input constraints and a sticky header keep the form contained and its exit reachable. | Long content must remain readable and escapable. |
| Reopening the dialog retained a previous download-success message. | Close clears old status while retaining the live status region. | A new visit must not imply that current edits were downloaded. |

## Verification

- Three initial unit guards fail on the original implementation; thirteen recovery units now pass. Coverage includes atomic refusal, every existing alias, drive/UNC identity, case-distinct POSIX paths, recording isolation, identical drafts at the eight-slot limit, encryption/tamper/password/privacy and existing size limits.
- A Windows browser regression reproduces the original alias failure. The finished journey checks preview/passphrase clearing, whole-restore refusal, newer draft preservation, unchanged disk, no plaintext/passphrase browser persistence, encrypted download bytes, 390 px spacing, reachable close after scrolling and cleared status on reopen. The status assertion separately reproduced stale success against the old compiled UI.
- The existing encrypted reload/unlock/exact restore journey also passes. Final focused browser result: **2 passed**, zero skips on this Windows machine. The Windows-specific reproduction is explicitly skipped elsewhere; portable identity units remain available.
- Actual local Claude Drishya session, **1,138 observations**, at 1440 and 390 px: current README plus synthetic older encrypted recovery and newer in-memory draft; conflict refused, one newer draft retained, disk bytes unchanged, zero page errors. Phone frame inspected. Actual source/screenshots stay ignored locally; synthetic drafts disappear with the browser context. No native turn submitted.
- After integrating main #230: **852 units / 151 files**, both TypeScript projects, production UI build and the two focused browser journeys pass. The earlier 855 total includes the three Canvas tests subsequently retired by #230. Local checks only; no hosted CI.

## Boundaries and remaining acceptance

No encryption algorithm/format, key storage, autosave, capture/schema, native permission, project write or History/PERF-2 change. This is not cryptographic certification or a recovery guarantee for unsaved volatile drafts. The only CSS change is scoped to this recovery dialog; installed emil-design-eng composition guidance informed spacing and containment, with no new motion.

Drive/UNC paths use the existing Windows case-insensitive identity policy. Nonstandard case-sensitive Windows directories and case-insensitive POSIX volumes need actual filesystem metadata/policy acceptance rather than browser guesses. Unicode filesystem identity and physical/macOS/Linux/human acceptance remain FILES-5 / REL-2 / REL-3 follow-ups. The broad parent stays unchecked. Paused History/PERF-2 remains untouched; #229 is ready for builder review, not automatic merge through the separate known TEST-2 failures.
