# FILES-5 — whole feasible local acceptance

28 October 2026. Follow-up to [recovery identity/dialog correctness](files-5-recovery-identity.md), PR #273. This is acceptance evidence, not a new persistence feature or a claim that the remaining platform/human gate is complete.

## Outcome

The available Windows filesystem and browser checks found no silent draft replacement, automatic draft persistence or project-file writes. Existing opt-in encrypted download, unlock preview and explicit memory restore remain unchanged. No product source, crypto format, native permission, adapter, reducer or History code changes are necessary from these results.

| Before this acceptance | After | Why |
| --- | --- | --- |
| Windows identity mostly tested with path strings | Real file identities checked using device/inode pairs | A lowercase string is not proof of filesystem identity |
| Nonstandard Windows case-sensitive folders unverified | Available temporary folder tested; distinct files are safely refused together | Do not call conservative refusal full support |
| One real Claude recovery journey | Real Codex and Claude recovery at 1440 and 600 px | Exercise the actual session surfaces rather than only the minimal fixture |
| Recovery limits listed without reproducible environment gates | Dedicated filesystem tests and an opt-in case-sensitivity probe | Ordinary gates do not unexpectedly change a filesystem directory policy |

## Automated acceptance matrix

All filesystem writes below create synthetic material in a new OS temporary directory. Cleanup verifies the absolute target remains inside that temporary parent. Only the opt-in test invokes `fsutil`, against its newly created empty child directory; no existing repository, volume-wide policy or native harness data is changed.

| Case | Observed result on this Windows machine | Scope |
| --- | --- | --- |
| ASCII, accented Latin and Greek uppercase/lowercase aliases | Same device/inode; an older snapshot cannot bypass a newer live draft; refusal is atomic and no addition survives | Supported ordinary Windows alias protection |
| NFC/NFD names differing only by Unicode normalization, Japanese and emoji filenames | Exact spellings round-trip through encryption and restore; NFC/NFD files have distinct device/inode identities here; disk bytes unchanged | This filesystem, not a universal Unicode volume policy |
| Case-sensitive Windows directory | Enabling the flag succeeds; `readme.ts` and `README.ts` have distinct identities. Recovery refuses their combined drive-root snapshot as a duplicate; both original drafts and both files remain intact | **Conservative limitation:** distinct case-only Windows paths are not supported together |
| Unicode lowercase collision | Capital dotted-I and lowercase-i plus combining dot are distinct files here. JavaScript lowercase collides, so export refuses the combined snapshot without changing either draft | **Conservative limitation:** not filesystem-aware Unicode identity |
| Directory junction into the same workspace | Same target identity; recovered path stays an inert memory draft, and approved current-byte reading refuses the linked component | Does not grant a link-following or write capability |
| File symlink creation | OS refuses creation with `EPERM` | File-symlink positive acceptance unavailable here; junction positive covers the available linked-directory case |
| Encryption/privacy/conflicts/limits | Existing 13 units pass: exact text/base round-trip, fresh randomness, wrong password/tamper refusal, protected paths/secret patterns, size bounds, recording/root separation, field equality, eight-slot limit and all aliases checked before restore | Existing crypto behavior regression coverage, not cryptographic certification |
| Reload and explicit restore | Existing browser fixture downloads encrypted bytes, reloads, unlocks and restores exact existing-file text without persisting that draft in browser storage or changing disk | One fixture browser journey passes |

### Reproduce

Ordinary focused gate (one intentional environmental skip on this machine):

```powershell
node node_modules/vitest/vitest.mjs run apps/ui/test/draft-recovery.test.ts apps/ui/test/draft-recovery-filesystem.test.ts
```

Explicit Windows case-sensitive temporary-directory probe:

```powershell
$env:DRISHYA_TEST_CASE_SENSITIVE_WINDOWS = '1'
node node_modules/vitest/vitest.mjs run apps/ui/test/draft-recovery.test.ts apps/ui/test/draft-recovery-filesystem.test.ts
Remove-Item Env:DRISHYA_TEST_CASE_SENSITIVE_WINDOWS
```

If the OS does not permit setting the temporary directory flag, that environmental test skips. Record the skip; do not infer support. This machine completed the explicit probe with **18 tests passed, zero skipped**. Both TypeScript projects and the UI production build pass. The existing `investigation-finishing` encrypted-recovery browser journey passes **1/1**. Local checks only; no hosted CI or native model call.

## Real local session acceptance

Read-only redacted Store copies, with synthetic new-file drafts held only in memory. Screenshots stay ignored in `.local/`; no real source, draft text, native journal content or private file names are reproduced here.

| Harness / prefix | Source bytes | Observations | Viewports |
| --- | ---: | ---: | --- |
| Codex `rec_4b5ca5b1` | 44,016,822 | 1,530 | 1440 × 950 and 600 × 950 |
| Claude Code `rec_024517cd` | 6,516,417 | 2,112 | 1440 × 950 and 600 × 950 |

Each of the four browser journeys:

- opens the real session and Workspace, with explicit workspace-reading approval;
- refuses a wrong passphrase, unlocks the one-draft preview and clears the passphrase input;
- deliberately restores a synthetic new-file draft to memory and downloads it again;
- decrypts that downloaded snapshot locally and verifies the exact draft text;
- refuses a conflicting snapshot without replacing the retained draft;
- confirms no synthetic file was created in the actual project;
- observes zero draft/passphrase matches in localStorage, sessionStorage or outgoing request bodies, zero native prompt submissions, zero page JavaScript errors and zero viewport overflow.

The actual Codex Store samples have recording-level workspace roots but no projection-level roots, and their fallback graph paths do not resolve to current relative files. One original native journal has moved, so its segment lookup reports unavailable. These are pre-existing source/metadata limitations outside FILES-5; they are not hidden by rewriting captured roots. The real recovery check therefore uses synthetic **new-file** drafts. Existing-file editing/reload and case-alias conflicts are verified by the separate fixture/filesystem tests, not claimed as native existing-file positives here.

## Remaining blockers and honest completion boundary

1. **macOS/Linux and case-insensitive POSIX volumes:** no such filesystem/device is available in this environment. POSIX string tests are not volume acceptance.
2. **Nonstandard filesystem identity support:** recovery still uses conservative Windows path folding. Case-sensitive Windows and Unicode lowercase collisions refuse some genuinely distinct files. Supporting those combinations needs an agreed filesystem-aware identity capability across daemon, snapshot and browser boundaries; this acceptance task does not introduce a guessed browser policy or silently weaken conflict checks.
3. **File symlinks:** local privilege prevents a genuine file-symlink positive. The available junction is verified; that is not certification for every link type or platform.
4. **Physical/human recovery acceptance:** automated page reload and browser-context checks do not certify a real power loss, OS crash, manual downloaded-file retention, passphrase usability or human ten-minute/freeze/truth preference. Those require the builder/device checks under REL-2/REL-3.

FILES-5 must remain open for those named gates. Normal unsaved drafts are still volatile; an encrypted snapshot is explicit, user-owned and not automatically refreshed. No key/passphrase is retained, no password reset exists, and restore never applies changes to project files.
