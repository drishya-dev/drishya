# SHIP-16: the first real Linux run, and the three-system workflow

16 November 2026, Claude Sonnet 5.5 for Yash. Counts and process facts only: no real session content was read or printed, and no real journal was imported (there is none in the Linux home, see "What was not run").

## Where it ran

| | |
|---|---|
| System | Ubuntu 26.04 LTS under WSL2 (kernel 6.6.87.2-microsoft-standard-WSL2), 32 logical CPUs, 15 GB |
| Node | 24.22.3, the official tarball, SHA-256 checked against `SHASUMS256.txt` |
| pnpm | 10.34.5 through corepack |
| Checkout | its own `git clone` on the Linux filesystem (`~/drishya`), its own `pnpm install --frozen-lockfile`. Nothing is shared with the Windows `node_modules` |
| Browser | Playwright's bundled Chromium headless shell 153. Its system libraries (`libnspr4`, `libnss3`, `libasound2t64`) were unpacked from `apt-get download` into a user folder, because `sudo` needs a password here. A hosted `ubuntu-latest` runner has them already |

## Result, by step (final commit of the PR)

| Step | Linux |
|---|---|
| `pnpm install --frozen-lockfile` | pass |
| `pnpm typecheck` | pass |
| `pnpm test` | **1796 passed, 4 skipped** (278 files). Three of the 4 skips are the Windows-only draft cases. Also run pinned to 2 CPUs (`taskset -c 0,1`, like a small hosted runner): 1792 passed, 4 skipped at the earlier commit, 79 s |
| `pnpm ui:build`, site build | pass |
| `pnpm test:security` | **680 passed** (15 files). Before the changes below the same suite passed 677 |
| `pnpm package:verify` | pass: package contents match the allowlist, isolated offline install of the tarball, Claude and Codex fixture import, demo bundle, authenticated API, persisted restart, and the packed server's network walk (2 attempts, all loopback) |
| `pnpm test:security:mutations` | 47 of 47 reachable defences caught; 1 skipped as unreachable on POSIX (below) |
| `demo:bundle` drift check | failed on every system, not only Linux: see finding 7 |
| `pnpm test:browser` (Linux, 4 workers) | **1003 passed, 14 failed, 29 skipped** at the last full run. Details below |

## The installed package (`npm install -g` into a scratch prefix, scratch `DRISHYA_HOME`)

Tarball `drishya-dev-cli-0.1.0-alpha.0.tgz`, 1,658,863 bytes, SHA-256 starts `6f41a7a89667b08a`.

- `drishya serve` (without `--no-open`, so the opener runs) stays up and listens on `127.0.0.1` only. A request to the machine's LAN address is refused. A foreign `Host` header gets 421.
- `GET /` is 200 `text/html`; Chromium loads the launch link and the Home screen renders with no page errors.
- Under `umask 022`, the data folder, `blobs/`, `drishya.db`, `-wal` and `-shm` are all owner-only (`700` and `600`); `find -perm /077` over the store lists nothing.

## What the run found, and what changed

1. **`drishya serve` crashed on a machine with no `xdg-open`** (a server, a container, minimal WSL): `spawn` reports a missing program as an asynchronous `error` event, nothing listened, so Node threw `Error: spawn xdg-open ENOENT` right after printing the link. `openBrowser` now swallows the event (`apps/daemon/src/commands.ts`); `apps/daemon/test/open-browser.test.ts` fails without the fix.
2. **The store's files were created under the process umask** (`drishya.db`, `-wal`, `-shm` 0644, `blobs/` 0755). The 0700 data folder kept other users out, but a data folder that is copied, restored or re-mounted loses that. Everything the store creates is now owner-only whatever the umask, and an existing database is tightened when opened (`packages/store/src/index.ts`). `tests/security/14-ship16-store-modes.test.ts` covers a new store, a loose existing one and the read-only case, with a mutation entry that removes the fix.
3. **The browser suite depended on the developer's installed CLIs.** With no `claude` or `codex` on PATH (every hosted runner) the composer shows its setup row, 176 px taller, and Tools and the history reserve that space. 12 specs failed on that alone (agent-inventory, card-content 600, fresh-workspace, git-history-cache 1440, investigation-finishing, ship-2f, ship-6g and others). `tests/browser/native-cli-stubs.ts` puts ready stand-in `claude` and `codex` scripts first on PATH for Linux and macOS (`globalSetup`); they answer only the two readiness probes and exit 1 for anything else. `apps/daemon/test/native-cli-stubs.test.ts` proves the real readiness code accepts them. **Windows has no equivalent yet:** the daemon finds `claude.exe` and `codex.exe` by file name, and a script cannot stand in, so a hosted Windows run will still see those 12 fail (SHIP-16c).
4. A Vitest case (`ask-question.test.ts`, native Antigravity question card) imports the card, the store and React's server renderer cold and passed the 5 s default only on a quiet machine. It has a 60 s timeout now.
5. The mutation runner could not read Vitest's coloured summary on Linux and printed "failing tests: file error"; it strips the colour codes.
6. One mutation ("static server stays inside the UI directory") is **unreachable on POSIX**: `normalize` clamps `..` at the root and a backslash is an ordinary character, so no request path reaches that check from outside the directory. It is now marked Windows-only and skipped elsewhere rather than counted missed. The guard stays in the code.
7. **The committed demo bundle was stale on every system**: `privacyPolicyVersion` `p4` against the generator's `p5`. `pnpm demo:bundle` produces byte-identical output on Windows and Linux (same SHA-256), so the bundle is refreshed in this PR; without it the CI drift step fails on all three.

## Linux browser failures that remain

Each was reproduced alone at low parallelism; none is explained as "slow machine". Not fixed here: they are layout and interaction differences between Chromium on Linux and the Edge channel the team uses on Windows, in files other builders own, and one hosted run on the public repo will say which of them also fail on hosted Windows and macOS. Recorded as **SHIP-16c** in TASKS.

| Spec | What fails on Linux | First reading |
|---|---|---|
| `approval-clearance:82` (600 and 1440) | clicking the composer's Expand button is intercepted by the "Read queued inputs" button of the receipts that sit above it | the receipts overlap the composer on Linux |
| `composer-grows:73` (600) | opening the composer moves the Files catalog toggle (y 851.9 against 697.9 collapsed) | a surface moves when the composer opens |
| `conversation-chat:15` | the prompt capsule is 715.75 px wide against a limit of 676 | layout width |
| `git-history-cache:28` (600; 1440 once) | Shift+Tab does not land inside the Git graph dialog | focus order |
| `jet-language:159` | a field's outline does not return after a programmatic `focus()` | `:focus-visible` after script focus |
| `live-captured-text:78` (600 and 1440) | the "Copied" state of "Copy complete input" appears about 16 s after the click on Linux, 2 s on Windows; the chunk requests finish in about 50 ms and `writeText` takes 3 ms, so the delay is in the page | a late state change in `QueuedInputs.tsx` |
| `stored-tool-result:51` | failed in 2 of 3 Linux runs | not examined |
| `material-motion:71`, `p1-pacing:722` (serial pass) | timing-sensitive, failed on Linux | not examined |

Failed once in a full run and passed alone, so load-sensitive rather than platform: `compaction:36` (2), `conversation-switch:212`, `landing-opening:46`, `nested-checkouts:39`, `ship-2f-history:81`, `ship-6g-layers:122`, `toolbox-window:85`, `fresh-workspace` (4 cases).

Sequence of Linux browser runs, for the record: 8 workers, no stubs: 24 failed (22 parallel, 2 serial); the same 22 alone: 22 failed; with the stubs: 10 then 13 failed on the same list; full run at 4 workers with the stubs: 14 failed (12 parallel, 2 serial).

**Not established:** whether these also fail with Playwright's bundled Chromium on Windows. The team runs Windows with the `msedge` channel and the bundled build is not installed on this machine, so the hosted Windows job is the first place that will show it.

## macOS: what Linux says about it

The macOS job is the Linux job on the other POSIX system. What Linux changed that macOS also gets: the CLI stubs (macOS runners have no CLIs either), owner-only store files, the opener fix (`open` exists there, so it never failed), the refreshed demo bundle. What Linux cannot tell: macOS's case-insensitive volume, the `/var` to `/private/var` temp alias (already handled by SHIP-16a's canonical-path rule, hosted green on 11 Nov), arm64, Safari-family font metrics (the browser suite is Chromium only), and a 3-core runner's effect on the timing-sensitive serial specs. Only a hosted run, and MAC-1 by a person on a Mac, can prove those.

## What was not run

- No Claude Code or Codex is installed in the WSL home, so there is no real session in the Linux home to import and no live turn to send. The packaged install imported the synthetic Claude Code and Codex fixtures (`package:verify`). "Import a real session and run one live turn" stays open.
- No hosted run: the repository is private and the policy forbids dispatch. The workflow was not executed by GitHub; it was read through carefully and its steps were run by hand in WSL.
- No macOS machine.
