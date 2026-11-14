# Security policy

Drishya runs on your machine, next to your repositories and your agents' journals, so a flaw in it can expose real source code and prompts. We want to hear about problems, and we will treat each report as private until it is fixed.

## Reporting a problem

**Please do not open a public issue for a security problem.** Use GitHub's private report instead:

1. Open the repository's **Security** tab on [drishya-dev/drishya](https://github.com/drishya-dev/drishya/security).
2. Choose **Report a vulnerability**.

Include what you did, what you expected, what happened, the Drishya version (the installed package version, or the commit you built), your operating system and Node version. A short proof of concept helps; **do not attach real journals, real source or real credentials** (use invented content, like the test suite does).

What to expect: an acknowledgement within a few days, a fix or a written explanation after we have reproduced it, and credit in the release notes if you want it. Drishya is built by two people, so please allow time; we will tell you if a fix needs longer.

## Supported versions

| Version | Supported |
|---|---|
| The latest `0.1.x` release | Yes |
| Anything older, and unreleased commits | No: update to the latest release |

Drishya needs **Node.js 24** (`>=24 <25`). Run a Node 24 release that still receives security fixes.

## What is in scope

- **The local daemon and its web page**: authentication (launch token, session cookie), the Host, Origin and content-type checks, anything reachable by a web page you visit or by another program or user on the same machine or network.
- **Reading and writing files**: the daemon reading anything outside the journals and repositories you granted, or writing anything other than its own store, your native agent's normal journal (when you resume it) and files you saved from the page.
- **Command execution**: any way a journal, a repository, a branch name or a captured value can make Drishya run a program or an option you did not choose (`git`, `gh`, a native agent).
- **Secrets**: a secret the redaction rules should catch reaching the store, a preview, the search index, an export or the screen; the launch token or session leaking to disk, logs or a URL.
- **Captured content turning into code**: script injection, a remote request, or a link that does something when a hostile prompt, tool output, file name, image or Markdown is displayed.
- **The published package**: unexpected files in the npm tarball, an install script, a dependency, or a build that does not match its provenance.
- **Denial of service** against the daemon from a request or a file, when it lasts longer than the request.

[`docs/review/sec-3-threat-model.md`](docs/review/sec-3-threat-model.md) lists what is protected, who is assumed to attack, and what has already been tested (`pnpm test:security`). A report that shows a gap in it is exactly what we want.

## What is out of scope

- **A program already running as your operating-system account.** It can already read your journals, repositories, browser profile and Drishya's store directly.
- **Exposing the port yourself**: a reverse proxy, a tunnel, a forwarded port (VS Code, SSH, WSL or Docker), or `--host` on a non-loopback address. Drishya refuses a non-loopback bind and a foreign `Host`, and warns against these in the README. See *Privacy and control*.
- **A compromised browser, Node.js, Git, `gh` or operating system**, and the agents themselves (what Claude Code and Codex do is their own sandbox's job).
- **Secrets the harness cut off before writing them** or that no redaction rule describes. Redaction is best effort; please tell us about a missing *pattern* (that is a useful report) but it is not a vulnerability by itself.
- Findings that need the victim to paste attacker-controlled text into a terminal or to disable protections, social engineering, and automated scanner output with no demonstrated impact.

## Known and accepted

These are written down so you do not need to rediscover them: the session cookie has no port scope, so another web server on `127.0.0.1` that you visit in the same browser receives it (SEC-6 in `docs/TASKS.md`; a replaying server must itself be a program on your machine); the launch link, which contains the token in its fragment, is printed in your terminal and is visible in the process list of the browser launcher. Details are in the threat model, §5 and §7.

## Safe harbour

Good-faith research on your own machine, within this scope, is welcome. Please do not test against other people's machines or accounts, and do not access, keep or share anyone's data.
