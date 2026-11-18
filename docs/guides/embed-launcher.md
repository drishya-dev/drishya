# Embed launcher: reference for host apps

How the pane launch works underneath. For turning it on in Claude Code or Codex, read [embed.md](embed.md). The security contract is [embed-1-in-app.md](../review/embed-1-in-app.md); this page records where the implementation follows it and the one place the refined target (the agent opens the pane) changes it.

## Selectors

Exactly one of:

- `sessionId` / `drishya embed <rec_…>`: a recording already imported into this Drishya home.
- `nativeSessionId` / `--session <id>`: the harness's own session ID. It matches a discovered journal whose first records state that ID, or whose name is `<id>.jsonl` (Claude Code) or `rollout-…-<id>.jsonl` (Codex). IDs are 8–128 characters of `A-Z a-z 0-9 _ -`; nothing path-shaped is accepted.
- `latest: true` / `--latest`: the newest top-level session, by journal modification time, then stable identity.

`cwd` / `--cwd` must be absolute. It is compared by canonical real path (case-folded on Windows); `latest` and `nativeSessionId` only consider journals in that exact checkout, and an explicit recording in another checkout is `CHECKOUT_MISMATCH`. Imports use the normal sealed ingest path, and passive following starts for the selected recording.

Errors exit nonzero with one JSON line, `{ "error": { "code", "message" } }`, with fixed messages that never echo arguments, paths or content: `INVALID_SELECTION`, `CHECKOUT_UNAVAILABLE`, `CHECKOUT_MISMATCH`, `SESSION_NOT_FOUND`, `NO_SESSION`, `IFRAME_UNSUPPORTED`, `EMBED_UNAVAILABLE`. Every `--frame-ancestor` value is refused before storage or any process starts.

## Processes

Each launcher owns one worker: `node <cli> embed-worker` with a private duplex pipe on fd 3 (Windows needs Node's `overlapped` stdio). Only that pipe can select a recording and mint a code; there is no HTTP mint endpoint. Requests are JSON lines of at most 8 KiB, `{ version: 1, requestId, action: "open", sessionId | nativeSessionId | latest, cwd? }`; anything else closes the channel.

- **`drishya embed`** (default) starts the worker **detached**, sends one request, prints the result and releases it. The pipe closes, so nothing can mint on that worker again; the code already printed stays valid for its 60 seconds. The worker serves its pane and stops itself once no pane has been connected for ten minutes (`DRISHYA_EMBED_IDLE_MS`, 1 s to 24 h, for tests). An agent's shell call therefore returns at once.
- **`drishya embed --attach`** keeps the worker tied to the command, as in the original contract: a host app that owns its child keeps it running and stops it by closing the command. Parent loss closes the worker within a second.
- **`drishya embed-mcp`** keeps one attached worker for the life of the MCP server, which is the life of the agent session. Repeated calls reuse it.

Concurrent launchers make separate workers on separate ephemeral loopback ports. None of them ever contacts, reuses or stops another Drishya, including a `drishya serve` on 7878. They share the store safely (appends skip duplicate observation IDs inside one transaction).

`<Drishya home>/embed-discovery/<random>.json` holds only `version`, `pid`, `port`, `instanceId`. It is a hint, never a grant. The directory is owner-only (Windows: System32 `whoami` and `icacls` remove inheritance and every other account, including the explicit SYSTEM/Administrators entries a folder gets under a parent without inheritable entries, then read the DACL back as SDDL and fail closed with the failing step named in `detail`; POSIX 0700/0600 with an ownership check). A worker removes its own entry when it stops.

## The browser exchange

1. The pane loads `/?embed=1&recording=<id>#launch=<code>` as a top-level document.
2. `apps/ui/src/lib/embed-boot.ts`, the first module the page evaluates, reads the code into a module variable and replaces the address with `/?embed=1#/r/<id>` before any other module runs. The code never reaches storage, the DOM, logs or React state.
3. The page posts `{ code, recordingId }` to `POST /v1/embed/session` (same origin, `application/json`, at most 2 KiB, no query string or `Authorization`). Host, Origin and loopback checks run first.
4. A code is 32 random bytes, kept only as a SHA-256 digest with its recording and expiry, compared in constant time, and consumed exactly once, including under concurrent requests. Wrong recording, expired (60 s), evicted (over 32 outstanding), replayed or restarted-daemon codes all get the same 401.
5. Success sets the ordinary `HttpOnly; SameSite=Strict` session cookie with the usual expiry, cap and revocation, and answers `{ ok: true, recordingId }` with `Cache-Control: no-store`.

Framing stays refused: `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` on every response, normal and embed alike. **No header is relaxed.** The pane must be a top-level guest (a browser pane, Electron `WebContentsView`/`webview`, a tab or a window), never an HTML iframe.

A pane cookie is browser sign-in only. Workspace approval, controller consent and the idle-other-clients acknowledgement are still required before any composer acts; Antigravity and bundles stay passive.

## MCP: `drishya.open_view`

Stdio JSON-RPC: `initialize` (answers protocol `2024-11-05`, `2025-03-26` or `2025-06-18`), `notifications/initialized`, `ping`, `tools/list`, `tools/call`. Clients see the tool as `drishya.open_view` (Codex) or `mcp__drishya__drishya_open_view` (Claude Code). Arguments: one selector, optional `cwd`, optional `systemBrowser: true`. The input schema has no top-level `oneOf` (several clients reject it); the server enforces one selector, and treats `null`, `''` and `latest: false` as absent.

What the tool returns:

- **Default (the refined target):** the one-use launch link in the tool result, with `singleUse: true` and `expiresInSeconds: 60`, because the agent itself opens it in its pane. This is the one change from the contract, which kept the link out of model content. The EMBED (refined) task (14 Nov) accepts it on the condition that the code is single-use, short-lived and stripped from captured journals. The `drishya-launch` privacy rule removes `#launch=` / `&launch=` codes before anything is persisted.
- **`systemBrowser: true`:** Drishya opens the system browser itself; the result carries only the cleaned `/?embed=1#/r/<id>` route.
- **A host that keeps `_meta` private** declares `capabilities.experimental["drishya.privateLaunch"] = {}` at `initialize` (an object: MCP's schema requires one, and clients reject `true`). It then gets the link in `_meta["drishya/privateLaunch"]` and the cleaned route in content.

## Desktop host apps

A host button follows the same path without the agent: spawn `node <cli> embed --attach --session <native id> --cwd <checkout>` (argv array, no shell), read the one JSON line privately, check the origin is `http://127.0.0.1:<port>` and the recording matches, and load the URL in its own sandboxed top-level guest with no Node access, popups or unexpected navigation. Keep the process for as long as the pane is open; close it to stop the view. Persist only the cleaned route. See the contract's §6 for T3 Code.
