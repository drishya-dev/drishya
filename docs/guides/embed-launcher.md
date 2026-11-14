# Local embed launcher appendix (EMBED-2a)

This appendix is the daemon half of [the agreed contract](../review/embed-1-in-app.md). The embed UI, example host and main guide belong to EMBED-2b; a launcher URL alone does not prove that UI is integrated. No iframe mode is provided. No native configuration is installed automatically.

## Run locally

Node 24 and the installed Drishya executable are required. From a source checkout, run your own `corepack pnpm install --frozen-lockfile` and `corepack pnpm ui:build`, then substitute `node /absolute/checkout/apps/daemon/src/cli.ts` for `drishya`. The packaged entry is `apps/daemon/src/cli.mjs` and needs no runtime dependency.

```sh
drishya embed --latest --cwd /absolute/checkout
drishya embed rec_0123456789abcdef
```

One JSON line is returned: `url`, `port`, `recordingId`, `mode: top-level`. The URL contains a **private single-use credential**: consume it in trusted host code, never a transcript, screenshot, telemetry, persisted preview URL or console log. This foreground command remains alive to own its worker; stopping it closes only its worker. It does not replace or kill another Drishya. Use your own scratch home (`DRISHYA_HOME`) for testing.

Exactly one of a recording ID and `--latest` is required. `--cwd` must be absolute and is compared by canonical real path, with case folding on Windows. For `--latest` it restricts discovery to that exact checkout, not sibling worktrees. Explicit IDs must already be imported. Latest chooses by source modification then stable identity. All imports use the existing sealed ingest path, and passive following starts for the selected recording. Nothing approves the root or starts a native turn.

An error exits nonzero with `{ "error": { "code": "...", "message": "..." } }`. Codes include `INVALID_SELECTION`, `CHECKOUT_UNAVAILABLE`, `CHECKOUT_MISMATCH`, `SESSION_NOT_FOUND`, `NO_SESSION`, `IFRAME_UNSUPPORTED`, `HOST_HANDOFF_UNAVAILABLE`, `EMBED_UNAVAILABLE`. Messages do not echo supplied arguments, native content or credentials. Every `--frame-ancestor` value is refused before storage/startup.

## Desktop host private channel

Use an installed Node 24 executable, not Electron's `process.execPath` (which is the Electron executable). For repeated clicks, the host main process starts one `node <absolute-cli-entry> embed-worker` with duplex **fd 3**, keeps that channel and sends newline-delimited JSON (8 KiB maximum). On Windows the parent must use Node's `overlapped` stdio option, not synchronous `pipe`, for fd 3. No command is accepted on HTTP, stdin or a public named pipe. The worker opens its daemon lazily on the first valid request.

```js
// Trusted desktop main process; do not expose a generic spawn bridge to the renderer.
const child = spawn(node24Executable, [absoluteCliEntry, 'embed-worker'], {
  windowsHide: true,
  stdio: ['ignore', 'ignore', 'ignore', 'overlapped'],
});
const channel = child.stdio[3];
channel.write(JSON.stringify({
  version: 1, requestId: '1', action: 'open', latest: true, cwd: absoluteCheckout,
}) + '\n');
// Read bounded JSON lines. A success is {version:1, requestId:'1', result:{url,port,recordingId,mode}}.
// Validate the exact loopback origin and fields; load result.url only in the owned guest.
// Never log the response. Persist only /?embed=1#/r/<recordingId> after sign-in.
```

A request can instead contain `sessionId`; never both selectors. Unknown action/version/fields, overlong frames and overload close the channel. Up to 32 pending requests; requests execute serially. Closing fd 3 invalidates outstanding codes and closes the owned daemon, live watches and metadata entry. The worker's stdout/stderr are not a diagnostic transport. This implementation deliberately does not authenticate/reuse another supervisor's discovered daemon.

`<Drishya home>/embed-discovery/<random-id>.json` contains only version, pid, port and instanceId. It is not an access grant or credential. Directories/files are owner-only; Windows uses built-in PowerShell/.NET ACL APIs and fails closed if protection cannot be applied. POSIX uses 0700/0600 and checks ownership. No token file or daemon runtime package is added. Cleanup removes only the instance's own entry. Stale/forged entries are never contacted for authentication or killed; a new supervisor starts its own ephemeral loopback port.

## Browser exchange (implemented here; bootstrap UI is EMBED-2b)

1. Privately load `/?embed=1&recording=<id>#launch=<code>` as the **top-level** document in a sandboxed guest. No Node integration or privileged preload is needed.
2. Read the fragment into a local variable and immediately scrub it with `replaceState` before doing other startup work.
3. Same-origin `POST /v1/embed/session`, `Content-Type: application/json`, exactly `{code,recordingId}`. No Authorization header or query credentials. Maximum 2 KiB.
4. The code expires after 60 seconds and succeeds once, including concurrent requests. It binds the selected recording and instance. Success sets the existing HttpOnly Strict cookie and returns `{ok:true,recordingId}`; normalize to `/?embed=1#/r/<id>`.
5. A new guest/partition, failed exchange or signed-out reload needs a **fresh** host request. Do not retry a consumed code or copy a private URL from history. Resize/fullscreen within the same guest preserves the cookie.

Ordinary `serve` keeps its existing `#token=` flow and does not expose this exchange. Headers, Host/Origin checks, JSON write gate, workspace consent, idle-other-clients acknowledgement, native policies and SSE remain unchanged. Opening a view does not make Antigravity steerable. Other clients need the already-supported controller consent before composing.

## MCP setup (user opt-in)

The server implements bounded newline JSON-RPC over stdio, protocol negotiation `2025-06-18`, `initialize`, `notifications/initialized`, `ping`, `tools/list` and `tools/call`. Tool: `drishya.open_view`, arguments `{sessionId}` or `{latest:true,cwd?}`. References: [MCP stdio](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports), [lifecycle](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle).

A host must explicitly advertise `capabilities.experimental["drishya.privateLaunch"] = true`. That promise means it excludes tool-result `_meta` from model input, logs, persistence and synchronized browser history, and loads `_meta["drishya/privateLaunch"].url` privately. Ordinary tool `content` includes only the cleaned URL and recording ID. **This is not a guarantee made by generic MCP clients.** If this capability is absent, the tool returns `HOST_HANDOFF_UNAVAILABLE` without starting a daemon. Use the trusted local CLI/host button; do not pass a credential through model text to make it work.

Claude Code, source checkout (user runs this themselves):

```sh
claude mcp add --scope local --transport stdio drishya -- node /absolute/checkout/apps/daemon/src/cli.ts embed-mcp
```

Codex, source checkout (user runs this themselves):

```sh
codex mcp add drishya -- node /absolute/checkout/apps/daemon/src/cli.ts embed-mcp
```

Alternatively, the user may add this to their Codex TOML with their own absolute path:

```toml
[mcp_servers.drishya]
command = "node"
args = ["C:/absolute/checkout/apps/daemon/src/cli.ts", "embed-mcp"]
```

For a packaged installation replace the source entry with the installed `cli.mjs`. No secret env variable is required. Native clients without the host capability will correctly refuse private pane opening; registering a tool does not add a browser pane. Local installed CLI help verified these command syntaxes; no real config was modified.

## `/drishya` guidance, user-installed only

Claude Code: create `.claude/skills/drishya/SKILL.md` in the user's chosen project (or their own personal skills folder). [Claude skill commands](https://code.claude.com/docs/en/skills) use the skill name. The user owns whether this file is committed.

```markdown
---
name: drishya
description: Open this checkout in a local Drishya pane.
disable-model-invocation: true
---
Call the configured drishya.open_view tool with latest=true and the exact current
checkout as cwd (or the exact imported recording ID the user supplies).
Do not run commands, edit files or change permissions to substitute for this tool.
If HOST_HANDOFF_UNAVAILABLE, explain that this client needs a capable local host;
show the user the manual drishya embed command with their checkout, without running
it in a model-visible terminal. Never request, echo or persist a launch credential.
```

Codex: install the equivalent named skill in the user's chosen Codex-supported skill location (project `.agents/skills/drishya/SKILL.md` where supported; consult the installed client's skill help). Use the same frontmatter name/description and body, omitting Claude's `disable-model-invocation` extension. Invoke from the skill picker or `/drishya` when that client exposes named skills as commands; `$drishya` is the explicit skill reference. This does not register an unsupported built-in slash command or grant a new tool permission. [OpenAI skill guidance](https://developers.openai.com/codex/skills/).

Uninstall: the user removes only their own `drishya` MCP registration (`claude mcp remove drishya` / `codex mcp remove drishya`) and the skill/command they created. Stop their own launcher; do not remove native settings, credentials, unrelated tools, journals or another running Drishya.

## Acceptance boundaries

EMBED-2a proves launcher, auth, discovery, framing denial, MCP redaction/handoff and packaging. EMBED-2b proves narrow view, host persistence, full-screen and whole-product visuals with these interfaces. SEC-3 is run when its branch lands; until then additive daemon tests live in `apps/daemon/test/embed-security.test.ts`. No hosted CI or full browser gate is dispatched by this item. Platform results and exact real-session checks are recorded in the PR; no unrun macOS/Linux or end-to-end private-capable native client is claimed.
