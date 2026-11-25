# Embed launcher: reference for host apps

For setup in Claude Code or Codex, see [embed.md](embed.md). The [embed contract](../review/embed-1-in-app.md) defines the private handoff and host acceptance.

## Five lines for a host app

```sh
drishya embed --json --session "$NATIVE_SESSION_ID" --harness codex --cwd "$PROJECT"
# -> {"url":"http://127.0.0.1:PORT/?embed=1&recording=rec_…#launch=<one-use code>","port":PORT,"recordingId":"rec_…","mode":"top-level"}
# Load `url` once as a top-level page in your webview or browser tab (never an iframe). The code signs in once, for 60 s.
# The page swaps it for an HttpOnly cookie and cleans the address bar. The view stops by itself 10 minutes after the pane closes.
# On failure: exit 1 and {"error":{"code","message"}}. Use the selected provider and its native session ID.
```

## Selectors

Exactly one of:

- `sessionId` / `drishya embed <rec_…>`: a recording already imported into this Drishya home.
- `nativeSessionId` / `--session <id>`: the harness's own session ID. It matches a discovered journal whose first records state that ID, or whose name is `<id>.jsonl` (Claude Code) or `rollout-…-<id>.jsonl` (Codex). IDs are 8–128 characters of `A-Z a-z 0-9 _ -`; nothing path-shaped is accepted.
- `latest: true` / `--latest`: the newest top-level session, by journal modification time, then stable identity.

Optionally `harness` / `--harness` (`claude-code`, `codex` or `antigravity`) restricts `latest` and `nativeSessionId` to one agent. `drishya open` is `--latest --cwd <current folder>` with the system browser (or `--print`), with a plain-text one-line result instead of JSON.

`cwd` / `--cwd` must be absolute. It is compared by canonical real path (case-folded on Windows); `latest` and `nativeSessionId` only consider journals in that exact checkout, and an explicit recording in another checkout is `CHECKOUT_MISMATCH`. Imports use the normal sealed ingest path, and passive following starts for the selected recording.

Errors exit nonzero with one JSON line, `{ "error": { "code", "message"[, "detail"] } }`, with fixed messages that never echo arguments, paths or content: `INVALID_SELECTION`, `CHECKOUT_UNAVAILABLE`, `CHECKOUT_MISMATCH`, `SESSION_NOT_FOUND`, `NO_SESSION`, `IMPORT_IN_PROGRESS` (a large first import is still running; try again, it continues), `IFRAME_UNSUPPORTED`, `EMBED_UNAVAILABLE`. Every `--frame-ancestor` value is refused before storage or any process starts.

## Processes

Each launcher owns one worker: `node <cli> embed-worker` with a private duplex pipe on fd 3 (Windows needs Node's `overlapped` stdio). Only that pipe can select a recording and mint a code; there is no HTTP mint endpoint. Requests are JSON lines of at most 8 KiB, `{ version: 1, requestId, action: "open", sessionId | nativeSessionId | latest, cwd? }`; anything else closes the channel.

- **`drishya embed`** (default) starts the worker **detached**, sends one request, prints the result and releases it. The pipe closes, so nothing can mint on that worker again; the code already printed stays valid for its 60 seconds. The worker serves its pane and stops itself once no pane has been connected for ten minutes (`DRISHYA_EMBED_IDLE_MS`, 1 s to 24 h, for tests). An agent's shell call therefore returns at once.
- **`drishya embed --attach`** keeps the worker tied to the command, as in the original contract: a host app that owns its child keeps it running and stops it by closing the command. Parent loss closes the worker within a second.
- **`drishya embed-mcp`** keeps one attached worker for the life of the MCP server, which is the life of the agent session. Repeated calls reuse it.

A first import of a large journal can take minutes. While a request is in flight the worker sends a short progress line every 5 seconds, and the launcher waits as long as they keep coming (60 seconds of silence means a hung worker and fails as `EMBED_UNAVAILABLE`). After 15 minutes it stops waiting and answers `IMPORT_IN_PROGRESS`, "still importing a large session, try again".

Concurrent launchers make separate workers on separate ephemeral loopback ports. None of them ever contacts, reuses or stops another Drishya, including a `drishya serve` on 7878. They share the store safely (appends skip duplicate observation IDs inside one transaction).

`<Drishya home>/embed-discovery/<random>.json` holds only `version`, `pid`, `port`, `instanceId`. It is a hint, never a grant. The directory is owner-only (Windows: System32 `whoami` and `icacls` remove inheritance and every other account, including the explicit SYSTEM/Administrators entries a folder gets under a parent without inheritable entries, then read the DACL back as SDDL and fail closed with the failing step named in `detail`; POSIX 0700/0600 with an ownership check). A worker removes its own entry when it stops, including on a failed start; a worker killed without a chance to clean up leaves one behind, and the next worker start or launch skips and removes every entry whose process is gone.

## The browser exchange

1. The pane loads `/?embed=1&recording=<id>#launch=<code>` as a top-level document.
2. `apps/ui/src/lib/embed-boot.ts`, the first module the page evaluates, reads the code into a module variable and replaces the address with `/?embed=1#/r/<id>` before any other module runs. The code never reaches storage, the DOM, logs or React state.
3. The page posts `{ code, recordingId }` to `POST /v1/embed/session` (same origin, `application/json`, at most 2 KiB, no query string or `Authorization`). Host, Origin and loopback checks run first.
4. A code is 32 random bytes, kept only as a SHA-256 digest with its recording and expiry, compared in constant time, and consumed exactly once, including under concurrent requests. Wrong recording, expired (60 s), evicted (over 32 outstanding), replayed or restarted-daemon codes all get the same 401.
5. Success sets the ordinary `HttpOnly; SameSite=Strict` session cookie with the usual expiry, cap and revocation, and answers `{ ok: true, recordingId }` with `Cache-Control: no-store`.

Framing stays refused: `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` on every response, normal and embed alike. **No header is relaxed.** The pane must be a top-level guest (a browser pane, Electron `WebContentsView`/`webview`, a tab or a window), never an HTML iframe.

A pane cookie is browser sign-in only. Workspace approval, controller consent and the idle-other-clients acknowledgement are still required before any composer acts; Antigravity and bundles stay passive.

## MCP: `drishya.open_view`

Stdio JSON-RPC: `initialize` (answers protocol `2024-11-05`, `2025-03-26` or `2025-06-18`), `notifications/initialized`, `ping`, `tools/list`, `tools/call`. Clients see the tool as `drishya.open_view` (Codex) or `mcp__drishya__drishya_open_view` (Claude Code). Give an exact `nativeSessionId` or `sessionId`, with optional `harness`, `cwd` and `systemBrowser: true`. The server rejects ambiguous native IDs and reserves explicit `latest` selection for the local CLI.

What the tool returns:

- **Host without private handoff:** the tool returns `HOST_HANDOFF_UNAVAILABLE` before creating a worker. Use the system browser fallback.
- **`systemBrowser: true`:** Drishya asks the OS to open the link and reports `system-browser-requested`. The result carries the cleaned `/?embed=1#/r/<id>` route. If the OS does not open a window, use the exact recording ID with `drishya embed` in a local terminal.
- **A host that keeps `_meta` private** declares `capabilities.experimental["drishya.privateLaunch"] = {}` at `initialize` (an object: MCP's schema requires one, and clients reject `true`). It then gets the link in `_meta["drishya/privateLaunch"]` and the cleaned route in content.

## Desktop host apps

A host button uses `node <cli> embed --attach --session <native id> --harness <harness> --cwd <checkout>`. Pass arguments as an array with the absolute CLI and checkout paths. Read the JSON privately, check the origin and selected recording, and load the URL in the host's sandboxed top-level guest with Node access, popups and unexpected navigation disabled. Keep the owned process while the pane is open. Persist only the cleaned route. See the contract's §6 for T3 Code.

## Windows discovery ACL

The discovery directory gets a protected current-user-only DACL. System32 `whoami` identifies the user and `icacls` reads back nonlocalized SDDL. A fixed encoded System32 PowerShell script calls `.NET Directory.SetAccessControl` to replace the DACL in one operation; the directory is passed through the environment, never interpolated into script text. This handles orphaned account SIDs for which `icacls /remove` returns 1332. No ACL reset or widened intermediate DACL is used. Every subprocess has a 30-second bound and final verification fails closed. Tests use scratch homes only.
