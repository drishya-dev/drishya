# SEC-3 · Threat model and the automated security suite

Written 14 Nov 2026 for release 1 (Windows tested here; Linux and macOS not run, see the end). Suite: `tests/security/` run by `pnpm test:security`, plus `tests/browser/security-injected.spec.ts`. Defence inventory with proof that each test fails without its defence: `pnpm test:security:mutations` (table at the end).

Nothing in the suite prints a secret or real journal content: every secret is an invented canary, every journal is written by the suite into a temporary folder, the person's home and Git configuration are redirected for the life of each test file, and the daemon under test listens on an ephemeral loopback port with no native harness it could start.

## 1. What is protected (assets)

| Asset | Where it lives | Why it matters |
|---|---|---|
| Prompts, source, command output, diffs, images | Drishya's store (SQLite, blobs, previews, search index) under the data directory | The product's whole content: a developer's private work |
| The agent's journals | Claude Code, Codex and Antigravity folders under the person's home | Read-only inputs; must never be written, and never read outside their roots |
| The person's repositories | Granted checkouts | Read through `git`; must never be written, and never run code of the repository's choosing |
| The launch token | The CLI's printed link (`/#token=…`), memory | Exchanges for a session; the key to everything above |
| The session cookie | `drishya_session` (HttpOnly, SameSite=Strict) in the person's browser | Same power as the token for as long as it lives |
| The person's `git` / `gh` sign-ins | Their own Git and GitHub configuration | Must not be used for anything the person did not ask for |
| The opt-in controller | A native `claude` or `codex` process started on a person's click | Can edit the person's project; only the person may start it |
| Screenshots and exports | Local files the person saves | Must not carry secrets or this machine's paths |

## 2. Who attacks, and from where

1. **A web page the person visits** while Drishya runs: requests to `127.0.0.1:<port>`, DNS rebinding, framing, form posts.
2. **Content inside what Drishya shows**: a prompt, tool output, a file name, a branch name, a commit message, an image, an MCP result, a repository's own Git configuration. This is the largest surface: every journal line is attacker-influenced when an agent reads a hostile page or repository.
3. **Another program or user on the same machine**: the port, the cookie, the store on disk, the launch link.
4. **A device on the same network.**
5. **The package and its dependencies** (daemon: none at runtime).

Out of scope for release 1, said plainly: a program running as the same operating-system account (it can read the store, the journals and the browser profile directly), a compromised browser, a compromised Node or Git, and the agents themselves (what they do is their sandbox's job).

## 3. Entry points

- **HTTP**: 95 routes (read from the server's own source by `tests/security/lib/routes.ts`, so a new route is in every route-wide test the day it is added; the gate test fails when the extracted list and the server disagree), static UI files, the change stream (`/v1/changes`, Server-Sent Events) and image routes.
- **Command line and environment**: `drishya` flags (`--host`, `--port`, `--no-open`), `DRISHYA_TOKEN`, the harness-home variables, `PATH`.
- **Journals and repositories**: every adapter's real ingest path, and every `git`/`gh` invocation.
- **The controller**: prompt, interrupt and approval endpoints, which can start a native program.
- **The page itself**: what it keeps in the browser, what it renders from captured data.

## 4. Defences and their tests

Numbers follow the Do-list in `docs/TASKS.md` (SEC-3). A file is `tests/security/<name>.test.ts`.

### 1 · Network exposure (`01-network`)
Loopback only, one listener, no wildcard or IPv6 any-address; the listening address is read back from the operating system. The machine's LAN address refuses a connection. `--host` with a non-loopback value is refused with a message; `localhost`, `127.0.0.1` and `::1` are accepted. *Defences:* bind-host allow-list; no wildcard listen.

### 2 · The request gate, for every route (`02-request-gate`)
For each route and method in the extracted list: no credential gives 401; a wrong `Host` gives 421; a foreign `Origin` gives 403; no response carries any `Access-Control-Allow-*`; a preflight from a foreign origin is refused; a write as `text/plain`, a form or multipart is 415; the event stream and image routes need the same session. Sessions: the token is compared in constant time; the cookie is `HttpOnly; SameSite=Strict; Path=/` with a maximum age; sign-out ends the session; the token never appears in a query string, a log line, a `Referer` or the store. Response headers (`nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, CSP with no remote source, `no-store` on API data). *Defences:* Host check, Origin check, auth check, content-type check, constant-time compare, no CORS, security headers.

### 3 · File access (`03-file-access`)
Every route that takes a path, ref or id is tried with `..`, absolute and drive-letter paths, UNC, URL-encoded and double-encoded forms, a null byte, symlinks and junctions out of the checkout, NTFS alternate streams and device names. Only granted checkouts are readable; protected files (`.env`, keys, credentials) stay out of Files, search, diffs and exports; the static route cannot leave the UI directory; no route writes into a project, a harness directory or a journal (a before/after hash of the fixtures). *Defences:* workspace grant, path containment, protected-file list, read-only journals.

### 4 · Injected content (`04-injected-content`, `tests/browser/security-injected.spec.ts`)
A hostile scenario (script tags, handlers, `javascript:`/`file:`/`data:` links, SVG with script, HTML in Markdown and in MCP results, ANSI and bidi controls, very long tokens, a remote image URL) is written as each adapter's real journal (**Claude Code, Codex and Antigravity**, one writer per adapter, listed by the ingest package so a new adapter without a writer fails) and imported through that adapter's real ingest path. Every GET route is read with the result checked as data (JSON, correct type, `nosniff`). The browser spec then walks the recordings in Edge at 600 and 1440 px, through History, Files, Changes, the Git graph, search, notes and exports: no script runs, no request leaves loopback, no link has a scheme other than `http`/`https`, external links carry `rel="noopener noreferrer"`, a CSP violation listener records none, and a control proves the detector detects. Only real raster images are served, with their real type, `nosniff` and `no-store`; an SVG a journal calls a PNG is not stored. *Defences:* no raw-HTML sink, link scheme allow-list, image sniffing, CSP.

### 5 · Command execution (`05-command-execution`)
Every place a program is started (found by scanning the source, so a new one is in the test) uses an argument list and no shell; captured values follow `--` and a ref or path beginning with `-` cannot become an option; the executable cannot come from the repository (a planted `git.exe`, a planted `PATH` entry relative to the working directory); Git runs with hooks, fsmonitor, external diff, textconv, filters, pager, replace objects, optional locks and credential prompts off, and `GIT_TRACE` shows that no Git command touches the network. *Defences:* `readGit` flags, `gitDiffFlags`, filter-driver overrides, absolute-only `PATH` search for native harnesses.

### 6 · Outbound traffic (`06-outbound-traffic`)
With default settings a full walk (Home, a session, Files, Changes, the Git graph, search, Settings, an export) makes no request outside loopback (the daemon's `fetch`, `http`, `https`, `net` and `dns` are recorded, and a sink listener proves a remote URL in captured data is never fetched). Each opt-in (`gh`, the GitHub link) is listed with exactly what it sends, and when it is off it sends nothing. The built page loads no font, script or image from another host, and there is no update check. *Defences:* no network client in the daemon by default, opt-in switches.

### 7 · Secrets and private data (`07-secrets`)
One canary per redaction rule (28 canaries: every rule, plus the launch link `…/#token=…` that the CLI prints) is placed in a prompt, a command, an output, a read, an edit and an MCP argument of each adapter's journal and imported. The store files, blobs, previews, search index, exports (through the API and the command line), the offline bundle, logs and crash output are searched for the raw values and for fragments of them: none. The launch token and session id are not written to disk. Exports mask this machine's paths. The committed demo bundle holds no secret-shaped value. *Defences:* every rule in `packages/privacy`, redaction of error bodies, nested-text redaction (below).

### 8 · Limits (`08-limits`)
Oversized bodies, headers, URLs and queries, slow requests, deep and odd JSON, 120 concurrent connections and many open event streams (capped at 64, then 429), one enormous journal line, and an image bomb (a few kilobytes declaring 30000 × 30000 pixels) are each refused or bounded, and the daemon answers afterwards. Every redaction rule is run against adversarial input under a time limit. *Defences:* body limit, stream cap, image byte and pixel caps, journal line cap, rule time bound.

### 9 · What the page keeps (`09-browser-keeps`, browser spec)
No service worker, Cache API, IndexedDB or web SQL; every `localStorage` and `sessionStorage` key is in the `drishya` namespace; nothing writes the token, a prompt or a tool result into storage, a cookie or the address bar; API responses with captured content are `no-store`; the page never sends the token in a URL. The browser spec lists what the running page actually keeps. *Defences:* storage namespace, `no-store`, fragment token.

### 10 · Sending prompts, the opt-in controller (`10-controller`)
A prompt, interrupt or approval is tried from another origin, with no consent state, with the wrong run id, and replayed: each is refused. An approval answers one exact request once, naming its run. An accepted prompt starts exactly one harness with a fixed argument list, no shell, the prompt on standard input, and a validated session id. The suite replaces the launcher, so it never starts a real harness. *Defences:* workspace consent, idle-other-clients acknowledgement, approval single-use, run binding, argument list.

## 5. The five "to verify first" items

| # | Suspicion | Outcome | Evidence |
|---|---|---|---|
| 1 | `git`/`gh` started by bare name with the repository as working directory, so a planted `git.exe` could run | **Not exploitable.** Node 24 on Windows does not prefer the working directory over `PATH` (a copy of `node.exe` named `git.exe` in the repository is not run). Engine pinned to `>=24 <25`. A related real gap was found and fixed: the native-harness lookup accepted relative `PATH` entries, so a relative entry could resolve inside a repository; it now uses absolute entries only | `00-verify-first` item 1; `05` "the executable cannot come from the repository" |
| 2 | The session cookie is not scoped to a port, so other local servers on `127.0.0.1` receive it | **Real, accepted for release 1, tracked as SEC-6.** RFC 6265 ignores ports. A replayer must itself be a local program, and the Host check refuses everything else; a local program running as the same account can already read the store. A page-held second secret would close it but cannot cover `<img>` and `EventSource` requests, and breaks the specs that call the API with the page's cookie jar | `00-verify-first` item 2 pins the facts |
| 3 | CSP allows `style-src 'unsafe-inline'` | **Not exploitable.** Captured content is rendered as text nodes; there is no `innerHTML`, `dangerouslySetInnerHTML` or `insertAdjacentHTML` in `apps/ui` (a source scan). Even an injected style could load nothing: no remote source for styles, images, fonts or connections. `unsafe-inline` stays because CodeMirror inserts `<style>` | `00-verify-first` item 3; browser spec |
| 4 | `packages/explain` makes outbound requests when a key is set | **Gone** (CLEAN-2). The test fails if the package, the endpoint or the key variable returns | `00-verify-first` item 4; `06` |
| 5 | A repository's Git configuration can make `git` run programs | **Real, fixed.** A repository naming a marker program for every extension point was imported and every Git surface read: `core.fsmonitor`, pager, hooks, `diff.external`, textconv and `ext::` were already off, but (a) `git status` run for history evaluated `filter.process` / clean-smudge drivers, and (b) a submodule's own configuration ran through `--ignore-submodules=none`. Fixed in `git-review.ts` (default-deny: object-only subcommands, filter-driver overrides, `--ignore-submodules=dirty`) | `00-verify-first` item 5 (with a control that proves the markers fire without our flags); `05` |

## 6. Other findings fixed while building the suite

- **Nested-text redaction bypass (privacy policy p4 → p5).** Antigravity records MCP arguments as JSON text inside a string, where a newline is the two characters `\n`; a token after it was glued to the letter `n`, defeating every word-boundary rule, and the secret reached the store. `redactText` now parses a string that looks like a JSON object or array (bounded: depth 8, 4 MiB, no change when nothing is found), redacts inside, and re-serialises. Existing stores re-scrub on open because the policy version changed (the history cache key includes it).
- **Image decompression bomb.** Images were limited by bytes only; a small PNG could declare billions of pixels. Now also capped at 64 megapixels in `captureImage` and in the two places that read image files (`images.ts`, `workspace.ts`).
- **Unbounded change streams.** Any signed-in page could hold unlimited `/v1/changes` connections. Capped at 64 (429).
- **Images were cacheable.** Image responses are now `no-store` like other captured content.
- **`DRISHYA_TOKEN`** from the environment is validated (16–128 URL-safe characters) because it ends up in a link passed to `cmd /c start`, `open` or `xdg-open`.

## 7. Accepted and open

- **Cookie not port-scoped** (item 2 above) → SEC-6.
- **Permission mode and similar settings by API.** A signed-in page can change the controller's settings; starting a native harness still needs workspace consent and a person's prompt. Recorded, not changed.
- **The CLI prints the launch link** (the token in its fragment) by design. It is in the person's terminal and scrollback; redaction covers it if an agent reads that terminal. The link is also in `argv` of the browser launcher on the machine (SEC-4 #5).
- **Secrets cut by the harness.** Redaction works on what the harness recorded; a secret the harness itself truncated before writing may not match a rule.
- **`application/jsonx`** passes the JSON content-type prefix check; harmless, because the body is parsed as JSON and the other gates still apply.
- **CI.** `.github/workflows` runs only on manual dispatch, so nothing runs this suite on push. `pnpm test:security` is inside `package:verify` (SHIP-9) and is documented as the pre-release gate; the Linux and macOS runs are made by whoever runs `package:verify` there.

## 8. Embed (EMBED-1/2, later)

Not built and not tested here; the embed has moved to the next release (14 Nov: Yash and Fable, after EMBED-1 merged). Its contract is [embed-1-in-app.md](embed-1-in-app.md) §8, which lists ten `embed-*` cases for the builders of EMBED-2a/2b to add under `tests/security/` once this suite is on main; nothing here weakens or pre-empts them. When the embed is built it changes the threat model in these ways, and these tests must be extended **in the same change**:

- **Framing for declared hosts.** The EMBED-1 contract embeds Drishya as a top-level guest and never an iframe, so no framing is relaxed. If framing for declared hosts is ever offered (the contract keeps a flag for it, refused by default), then today every response carries `X-Frame-Options: DENY` and `frame-ancestors 'none'`. An embed needs `frame-ancestors` to name the declared host applications, on the embed route only (`X-Frame-Options` cannot express an allow-list, so it must be omitted there and `frame-ancestors` is the only control). *Extend:* `02` response headers (only the embed route is relaxed, every other route stays `DENY`, an undeclared host is refused); the browser spec (framed by a declared host works, by an undeclared host is blocked).
- **A launch URL handed to another application's pane.** The `SameSite=Strict` cookie is not sent in a third-party frame, so the sign-in model changes, and the launch URL or a derived credential travels through the host application. It must be single-use, short-lived and scoped to the embed route, and **the next-release path passes a single-use launch URL (a 60-second fragment code) through the agent's transcript, so redaction must strip launch codes** (EMBED-1's `embed-host-secret` case): the shape of that URL (it is not the `/#token=` fragment the CLI prints today) must be added as a canary to `lib/secrets.ts` before it ships, so `07-secrets` fails until `packages/privacy` redacts it (a probe on 14 Nov showed that query-string and path-segment codes such as `?launch=…`, `#code=…` and `/launch/…` are **not** redacted by the current rules). *Extend:* `02` sessions (single use, expiry, replay refused); `07` (the new shape in every sink); `09` (storage in an embedded context).
- **A narrow webview.** Layouts at the embedded width must pass the same injected-content walk. *Extend:* the browser spec walk at the embed's width, inside the embed route and framed.
- **postMessage and window relationships.** Any message channel with the host must check origins both ways; `COOP`/`CORP` may need to change on the embed route. *Extend:* `04`/browser spec (a message from an undeclared origin is ignored), `06` (the embed loads nothing external).
- **Listener.** The embed must not add a second port or address. *Extend:* `01` (still exactly one loopback listener); `10` (prompts still follow only a person's action in Drishya's own page, not a framed host's message).

## 9. Defence inventory: remove the defence, the test fails

`pnpm test:security:mutations` removes each defence in turn (an exact text edit of the source), runs the named test file, restores the file's bytes, and reports whether the suite noticed. Result on 14 Nov 2026 (Windows 11, Node 24):

| Defence removed | Test file | Tests that fail |
|---|---|---|
| network: bind-host allowlist | 01-network | 8 |
| network: listen on the wildcard address | 01-network | 2 |
| gate: token required | 02-request-gate | 105 |
| gate: Host check (DNS rebinding) | 02-request-gate | 98 |
| gate: Origin check (cross-site) | 02-request-gate | 90 |
| gate: JSON content type on writes (CSRF form) | 02-request-gate | 26 |
| gate: no CORS allowance | 02-request-gate | 381 |
| gate: constant-time token compare | 02-request-gate | 1 |
| gate: the token is not accepted in a query string | 02-request-gate | 2 |
| gate: sign-out ends the session | 02-request-gate | 1 |
| gate: session expiry | 02-request-gate | 1 |
| headers: X-Frame-Options | 02-request-gate | 1 |
| headers: Referrer-Policy | 02-request-gate | 1 |
| headers: CSP script-src | 02-request-gate | 1 |
| files: static server stays inside the UI directory | 03-file-access | 1 |
| files: workspace grant required | 03-file-access | 23 |
| files: path containment (`..`, protected names, root check and index membership together) | 03-file-access | 13 |
| content: image bytes must carry a raster signature | 04-injected-content | 3 |
| content: images are not cacheable by the browser | 04-injected-content | 3 |
| exec: Git content filters off for worktree commands | 00-verify-first | 2 |
| exec: Git fsmonitor off | 00-verify-first | 3 |
| exec: submodule work trees are not scanned | 00-verify-first | 1 |
| exec: the harness is never started through a shell | 05-command-execution, 10-controller | 3 |
| exec: relative PATH entries are ignored | 05-command-execution | 1 |
| exec: a launch token must be URL-safe | 05-command-execution | 1 |
| outbound: no network client in the daemon | 06-outbound-traffic | 2 |
| secrets: a redaction rule (github-token) | 07-secrets | 6 |
| secrets: text encoded inside a string is redacted (Antigravity MCP arguments) | 07-secrets | 4 |
| secrets: error bodies are redacted | 07-secrets | 1 |
| limits: request body size | 08-limits | 1 |
| limits: open change streams | 08-limits | 1 |
| limits: image pixels (decompression bomb) | 08-limits | 3 |
| controller: idle-clients acknowledgement | 10-controller | 5 |
| controller: an approval answers once | 10-controller | 1 |
| controller: an approval names its run | 10-controller | 1 |
| controller: an interrupt names its run | 10-controller | 1 |

**36 of 36** defences are caught. Each row is also a defence in section 4; the list is the inventory, and a defence without a row has no proof.

## 10. What could not be run

- **Linux and macOS.** Not available here. The suite is written to be portable (junctions on Windows, symlinks elsewhere; a link that cannot be created is recorded and skipped, not failed; the built-page check is skipped when `ui:build` has not run), but it has not been run on either.
- **Real sessions.** The suite builds its own journals; it does not read the person's. No real-session check applies to this item.
- **A live check of the controller against a real `claude`/`codex`.** Deliberately never done: the suite replaces the launcher so it can never start a native harness.
