# EMBED-1 — Drishya in a harness pane

14 November 2026 · Contract for EMBED-2a (Codex) and EMBED-2b (Antigravity).
Yash reports both builders agree to the direction below, including the 360 px embed-only minimum and top-level-only Release 1. This is a design contract, not evidence that an integration has shipped.

## 1. One session, one click

- Run locally on the computer holding the journals; never proxy the daemon to a remote client.
- Command: `drishya embed <recording-id> [--cwd <absolute-directory>]`, or `drishya embed --latest [--cwd <absolute-directory>]`. The two selectors are exclusive.
- An explicit ID means a Drishya recording ID, not an arbitrary journal/file path. If absent, return `SESSION_NOT_FOUND`. `--latest` discovers only existing allow-listed harness sources, selects the newest recorded modification within the exact canonical checkout when `--cwd` is supplied, imports through normal sealing, and opens that recording. Tie-break by stable source ID. Never silently choose another checkout.
- Without `--cwd`, latest means the newest supported local source across checkouts. Return its recording ID and harness so the host can identify the choice. No source means `NO_SESSION`; no demo fallback.
- Successful stdout is exactly one JSON line: `{ "url": "<private launch URL>", "port": 49152, "recordingId": "rec_<id>", "mode": "top-level" }`. Port is illustrative, never fixed. Diagnostics go to stderr without credentials, paths containing secrets or journal content. Errors: nonzero exit, JSON `{ "error": { "code": "...", "message": "..." } }`, no URL.
- Bootstrap URL: `http://127.0.0.1:<port>/?embed=1&recording=<encoded-id>#launch=<single-use-code>`. After exchange replace it with `/?embed=1#/r/<encoded-id>`, reusing the existing hash session route. The bootstrap query solves the existing collision between `#token=...` and `#/r/...`; do not append a second fragment.
- The ordinary `serve` URL and its `#token=` flow remain supported unchanged. Never put the long-lived launch token in the embed URL. The short-lived code is a credential too: only the trusted local host receives it; never transcript, persist, echo or screenshot the bootstrap URL.
- EMBED-2b accepts both bootstrap and cleaned session routes, validates the ID, and never falls back to Home on errors. Missing/forgotten session, signed-out and stopped-daemon states explain what happened and offer retry/close.

## 2. Start, discovery and safe reuse

- Start on loopback with an ephemeral port (`port: 0`), never probe, reuse or kill 7878 or 5180 in acceptance. The host owns its child and closes only that child when appropriate; capture remains independent of visible panes.
- Metadata lives at `<Drishya home>/embed-discovery/<instance-id>.json`: `{ "version": 1, "pid": <pid>, "port": <port>, "instanceId": "<random non-secret id>" }`. Atomic write, user-only directory/file access (POSIX 0700/0600; Windows current-user ACL), remove own entry on orderly shutdown. No token, code, credential, journal body or secret socket name in discovery.
- Discovery is a hint, never authority. A port/PID match or `/v1/health` response does not authenticate an existing daemon; PIDs/ports can be reused. Never send a token to a discovered listener or terminate it because metadata is stale.
- Reuse only an instance for which the launcher already holds a private inherited control channel. EMBED-2a adds an optional duplex extra stdio pipe between launcher/supervisor and its daemon; ordinary `serve` has no such listener. Pipe requests select a recording and mint a launch code; there is no public HTTP mint-code endpoint.
- The local host keeps this supervisor alive for subsequent button clicks; the MCP stdio process does likewise. A standalone CLI invocation without that channel starts its own daemon even if discovery finds another. This deliberate limitation avoids introducing a credential file, unauthenticated broker or platform-specific pipe ACL dependency merely to reuse a port. Do not implement broader reuse implicitly.
- Channel input: version 1 JSON lines, at most 8 KiB each, request ID, action `open`, and validated selector/cwd. Response has the same ID and the stdout JSON shape above. Reject unknown actions/versions and malformed/oversize messages. No generic command, file-read, origin-registration or native-control operation.
- Concurrent invocations create separate instances safely; the host deduplicates its own in-flight click. Never claim single-instance semantics. Parent/control-channel loss invalidates outstanding codes; document child lifetime and cleanup in the launcher appendix.

## 3. Authentication and framing — decided

**Release 1 uses a top-level guest document only.** Electron WebContentsView/webview, a dedicated browser tab, or a separate window are acceptable. They are not HTML iframes. Do not enable Node integration, disable web security, add a privileged preload bridge or relax the sandbox to make a pane work.

Current source checked: `apps/daemon/src/server.ts` `SECURITY_HEADERS`, `startServer`, `handleRequest`, `allowedHosts/allowedOrigins`, and `POST /v1/session`; `apps/ui/src/api.ts` `signIn`; `App.tsx` `params`. The cookie is `HttpOnly; SameSite=Strict; Path=/`, idle 12 h, maximum 7 days, memory-only, bounded to 32 sessions. Current headers refuse all framing. The current launch token is reusable for the server lifetime: do not confuse it with the new one-time code.

A cross-site iframe does not send a Strict cookie; changing it to None is not a reliable solution when third-party cookies are blocked. [Cookie semantics](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie). A top-level pane lets Drishya's own requests use its existing cookie; keep its protections.

### Top-level launch handoff (EMBED-2a owns server; 2b owns bootstrap)

1. Mint 32 random bytes per launch, base64url encoded; store only its digest with the recording ID, instance and expiry, in memory. TTL 60 seconds, maximum 32 outstanding codes, evict oldest. Mint through the inherited channel only; never via discovery, GET or an unauthenticated request.
2. UI reads the fragment once into a local variable and immediately removes it with `replaceState` before other startup work, analytics (none), navigation or external links. Do not use storage, console, errors, DOM text or React debug state for credentials.
3. `POST /v1/embed/session`, JSON `{ "code": "...", "recordingId": "..." }`, same-origin only. Apply the existing Host/Origin gate and JSON requirement **before** code validation; exact field/size validation, maximum 2 KiB. No query-string or bearer-token substitute on this endpoint. Missing Origin is permitted only as under the existing gate; possession of the unpredictable code is still mandatory.
4. Constant-time fixed-length digest comparison; atomically consume exactly once, including simultaneous requests. Wrong recording does not authenticate. Invalid, expired, evicted or replayed codes return the same generic 401. A daemon restart invalidates all codes/cookies. A lost successful response requires a fresh code; never resurrect it.
5. Issue the existing HttpOnly Strict session cookie using the same expiry, cap and revocation semantics; return `{ "ok": true, "recordingId": "..." }` with `Cache-Control: no-store`. No credential in response JSON. Then the UI opens the cleaned route. Normal authenticated API, JSON mutations and SSE remain unchanged.
6. A code establishes browser authentication, **not** workspace access, controller consent, permission approval or proof that another native client is idle. Same-user host code is trusted to hold a launch URL and can already run the CLI; Drishya does not defend against a malicious privileged host or same-user process with debugging access.

### Iframe-only hosts

**Not supported in Release 1.** `--frame-ancestor <origin>` exits with `IFRAME_UNSUPPORTED` before starting/reconfiguring a daemon, for every origin. No wildcard, exact-origin exemption, `null`, file-origin exception, dev-origin piggyback, CORS allowance, postMessage token relay, storage-access prompt or third-party-cookie fallback.

Keep CSP `frame-ancestors 'none'` and `X-Frame-Options: DENY` on normal **and embed** responses; preserve all other directives and headers, loopback binding, Host/Origin checks and JSON mutation requirements. The launch exchange is the only new authentication endpoint; it grants no wider authority than today's session exchange.

If a future host demonstrably needs an iframe, first agree a separate contract: exactly one validated origin, per-instance opt-in, session-scoped non-cookie in-memory credentials, authenticated fetch/stream handling, and independent browser threat tests. Removing DENY, enabling credentialed CORS or using a long-lived bearer in a frame is not authorized by this contract. Until then all declared origins are refused, even when a flag is supplied.

## 4. Host button, MCP and slash launchers

- Host button: **Open in Drishya**. Privileged local host spawns the installed executable with an argv array (no shell), passes its exact native session mapping where available, otherwise uses `--latest --cwd`; consumes JSON privately, then loads the URL in its pane. A native ID is not assumed to equal a recording ID; unsupported mapping is explicit.
- MCP tool name: `drishya.open_view`, input `{ "sessionId"?: "<recording-id>", "latest"?: true, "cwd"?: "<absolute-directory>" }`; exactly one selector. Its local stdio server uses the same launcher, never model-supplied shell source or arbitrary URL.
- Return the cleaned non-secret session URL and recording ID in text. A capable host receives the private launch URL through MCP tool-result `_meta` (host-only, not model content) and consumes it directly. Document this host requirement; do not assume every MCP client supports opening panes or hiding metadata. Without that capability, report `HOST_HANDOFF_UNAVAILABLE` and use the explicit local CLI/browser fallback, never expose a credential to the model as a workaround.
- `/drishya` for Claude Code and Codex is user-installed command/skill guidance invoking that tool; it cannot magically add pane support to either harness. If unavailable, explain the manual command. No automatic edits to harness config, startup files or permissions; appendix provides exact opt-in snippets and uninstall steps.
- Launching observes by default. Existing native controller eligibility, separate workspace approval and idle-client acknowledgement remain mandatory before showing/enabling a composer. Embedding or a model tool call never grants consent. Antigravity and bundles remain passive; no composer. The host gets no generic steer/approve API.

## 5. Size, full screen and example (EMBED-2b)

- **Agreed embed minimum: 360 CSS px**, desktop side panes only. Standalone app minimum stays 600; mobile apps, remote access and touch-specific work remain outside Release 1. Below 360 show a readable widen/open-window message, never scale down the whole UI.
- Conversation is the first-open default in embed. Reuse the same History and readers; no alternate renderer or forked captured content. Hide the map below 600; one reading column, local horizontal scrolling for wide material, bounded existing disclosure controls. At 600+ the ordinary session composition is available; no Home/session library in either size.
- A single quiet **Enter full screen / Exit full screen** control calls the document Fullscreen API from a deliberate click, follows `fullscreenchange`, supports Escape and restores reading position. Reuse existing paired surface transitions and reduced-motion behavior; never simulate reading. Host may expand the pane instead if it has a native action. Rejected/unavailable Fullscreen API shows an honest **Open in window** fallback, not a false active state.
- Opening an independent window/partition needs a fresh launch code via the trusted host; never copy a consumed bootstrap URL. Without that bridge, explain running the launcher again. Same-view full screen retains its cookie, controller constraints, replay step and reading position.
- `examples/embed-host/`: isolated minimal Electron package (not a product dependency/workspace member), a fake app panel and one sandboxed WebContentsView. Main process invokes the launcher, keeps the private control channel, validates exact loopback origin/recording, and loads the guest. No remote bridge or renderer-provided executable. Disallow unexpected navigation/popups, no Node access in guest; close its owned guest/child only. Plain browser fallback opens a separate window and does not pretend to be a pane.
- Visible host address/history/debug logging must scrub fragments before recording. Test that no bootstrap credential reaches screenshots, host persisted state, model transcripts or normal diagnostic logs.

## 6. T3 Code — inspected source and integration steps

Read-only inspection on 14 Nov, pinned to [`1fcb24518a04652fdc82ab6eea66b82b1a55335e`](https://github.com/pingdotgg/t3code/tree/1fcb24518a04652fdc82ab6eea66b82b1a55335e). No contact, installation, issue or upstream patch made; this is source research, not a tested T3 integration.

- [README](https://github.com/pingdotgg/t3code/blob/1fcb24518a04652fdc82ab6eea66b82b1a55335e/README.md) lists desktop, web, iOS and Android; that does not establish equal pane capability.
- [PreviewPanel](https://github.com/pingdotgg/t3code/blob/1fcb24518a04652fdc82ab6eea66b82b1a55335e/apps/web/src/components/preview/PreviewPanel.tsx) checks preview availability and scope; its unavailable state explicitly identifies desktop-only preview.
- [HostedBrowserWebview](https://github.com/pingdotgg/t3code/blob/1fcb24518a04652fdc82ab6eea66b82b1a55335e/apps/web/src/browser/HostedBrowserWebview.tsx) mounts an Electron `webview` with an attachment-time partition and configured preferences/preload. [Preview contracts](https://github.com/pingdotgg/t3code/blob/1fcb24518a04652fdc82ab6eea66b82b1a55335e/packages/contracts/src/preview.ts) accept a thread ID, optional URL and viewport/profile choice. An Electron guest is the appropriate starting point, not an iframe exemption.
- [Desktop preview manager](https://github.com/pingdotgg/t3code/blob/1fcb24518a04652fdc82ab6eea66b82b1a55335e/apps/desktop/src/preview/Manager.ts) owns guest lifecycle and security handling. Its popup sandbox settings alone do not prove every preview guest is configured safely: inspect actual guest preferences and preload when integrating. Drishya's reference uses [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view); T3 can keep its existing guest.

Maintainer-side steps to propose, not perform here:
1. Add a local desktop action to the active thread, derive its exact checkout/native-session mapping, invoke the installed Drishya launcher in the main process and validate returned fields/origin. No arbitrary remote thread may invoke local launch without the host's own permission boundary.
2. Create/reuse one dedicated preview guest for that thread, load the private URL only there. Do not save it in T3's preview snapshots, server logs, browser-history sync or model-visible preview tool output; persist only the cleaned session URL. If existing preview.open persists URLs before navigation, use a private desktop handoff rather than sending the credential through that API.
3. Keep a stable isolated partition across pane resize/full screen, preserve its cookie, do not attach model browser automation to the authenticated Drishya guest. Disable unnecessary preload capabilities, deny unexpected navigation/popups, and retain sandbox/context isolation/Node-off. Host visibility changes must not kill passive capture.
4. Use Drishya's full-screen control or a host-native expand action; verify enter, Escape/exit, re-entry and guest destruction. If guest policy denies fullscreen, offer the fresh-window handoff, never weaken all guest permissions.
5. Check latest Claude Code, Codex and Antigravity local sessions live/replayed at 360/600/1440, restart, signed-out and missing session. Browser/web-only, remote and phone clients get a local-desktop explanation; no localhost tunnelling.

## 7. Free, supported and ownership

- Apache-2.0 is the intended licence under PUBLIC-1; do not claim public availability/licensing has landed before that gate. Integrating has no fee, account, telemetry or hosted service requirement. Preserve required notices; hosts may choose their own UI around the guest.
- EMBED-2b owns `docs/guides/embed.md`, example and compatibility matrix. EMBED-2a owns `docs/guides/embed-launcher.md` (command/MCP/slash setup, lifetime, errors and platform limits). Pin tested host versions; no blanket promise for every app.
- Support entry: repository GitHub Discussions once builders enable it after PUBLIC-1; until then the repository issue tracker, if accessible, with a security-reporting route from SECURITY.md. No invented Discord invite, public support URL or outbound contact. Builders alone approach T3 maintainers.

## 8. SEC-3 additions and acceptance ownership

No existing security test is weakened. EMBED-2a adds these under `tests/security/` once SEC-3 merges; until then use `apps/daemon/test/embed-security.test.ts` and record the move. EMBED-2b adds the guest/browser assertions. Run `pnpm test:security` against the integrated candidate when available.

| Case | Exact acceptance |
| --- | --- |
| `embed-default-headers` | Normal and embed responses retain the complete current CSP, DENY, nosniff, referrer/COOP/CORP policy; no flag broadens framing. |
| `embed-frame-origins` | With flag off, same/cross-origin iframes blocked; declared exact origin, wildcard, null, file, malformed origin and multiple origins all refused by CLI. Browser proof for actual framing, not headers alone. |
| `embed-launch-once` | One code succeeds once, including concurrent exchange; wrong recording, expired at 60 s, evicted and restart codes fail; failure leaks no code. Use synthetic codes, never log them. |
| `embed-launch-gate` | Bad Host/Origin, non-loopback bind, form/text content type, oversize/malformed JSON, query token and missing/invalid code refused; existing normal launch/token checks unchanged. |
| `embed-discovery-no-secret` | Exact allowed metadata fields only; no token/code/key/native content in file, logs or stdout errors; owner-only permissions, atomic replacement, cleanup and stale/PID/port collision handling. Forged metadata grants nothing. |
| `embed-control-private` | Only inherited pipe can mint; HTTP cannot; malformed/oversize/channel-loss cases fail; no arbitrary command/path action; another invocation cannot hijack an existing listener via discovery. |
| `embed-cookie-stream` | Fresh top-level guest signs in with Strict HttpOnly cookie, loads evidence and SSE, expires/revokes normally; no third-party cookie dependence, token in storage/DOM or CORS relaxation. |
| `embed-controller-boundary` | Open does not approve a root, start a turn, answer a native question or change native policies; Antigravity/bundle never receive composer; existing supported controller still requires all consent. |
| `embed-host-secret` | Host persistence, model-visible tool content, browser history snapshots and diagnostic logs contain no credentials; fragments scrubbed before capture; external URLs/popups cannot inherit launch data. |
| `embed-refused-modes` | Iframe flag refused without starting a daemon; missing selector/session and below-minimum/unsupported host states honest; ordinary app unchanged. |

EMBED-2a accepts command/auth/discovery/launcher/security and packaging; EMBED-2b accepts view, host, guide, ordinary-view regression and integrated security. Both use scratch homes and real sessions of all three harnesses (#490 is merged), at 360/600/1440; only session prefixes, sizes and counts leave `.local/`. Live, replay, fullscreen, reduced motion and loss/reconnect must be checked. No full browser gate per item; Fable runs the combined gate before merge.

**EMBED-1 acceptance:** six decisions and auth/test contract are documented; TASKS is split; builders' agreement recorded above. No daemon/UI change, token exchange, host launch, real-session acceptance or SEC-3 execution is claimed by this docs-only item. Implementers must not treat this review as security certification.
