# Drishya Embed Reference Host

This reference host demonstrates how a developer tool, editor, or AI coding assistant embeds Drishya as a side pane beside its own workspace UI.

## Contents

- `server.mjs`: Lightweight, zero-dependency Node HTTP server serving the host application and managing `drishya embed` child processes.
- `index.html`: Responsive developer workspace UI with an AI assistant chat thread (left) and Drishya embed pane controls (right) supporting 360 px, 600 px, and 1440 px presets.
- `electron-host.cjs`: Reference Electron integration demonstrating how desktop applications mount Drishya via `WebContentsView` with an isolated partition.
- `style.css`: Clean, calm developer UI adhering to Drishya's creative doctrine.

## Quick Start (Plain Node)

From this directory:

```bash
node server.mjs
```

Then open `http://127.0.0.1:4040` in your browser.

1. Click **Open in Drishya** in the top bar.
2. The host invokes `drishya embed --latest`, obtains a single-use launch URL, and opens the session.
3. Use the width presets (`360px`, `600px`, `1440px`) to test the embed layout across supported sizes.

## Desktop Host Integration (Electron)

Desktop apps embed Drishya as a native top-level guest using Electron's `WebContentsView`:

1. **Spawn Launcher:** The host main process spawns `drishya embed` (or keeps a persistent `embed-worker` over fd 3).
2. **Mount View:** Attach a `WebContentsView` with `partition: 'persist:drishya-session'`, `contextIsolation: true`, and `sandbox: true`.
3. **Load Private URL:** Load the single-use launch URL into the view. Once authenticated, Drishya scrubs the code from the URL and runs normally.
4. **Resize & Fullscreen:** Update view bounds on window resize; handle Drishya's full-screen toggle via the document Fullscreen API.

## Security Guarantees

- **No Iframes:** Drishya serves `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`. Framing is refused by the browser to protect local session data from unauthorized web origins.
- **Single-Use Code:** The launch code is exchanged once via `POST /v1/embed/session` for a scoped HttpOnly Strict cookie, then immediately scrubbed from the URL fragment before any other network activity.
- **Loopback Only:** Daemon binds strictly to `127.0.0.1`.
- **Zero Secrets in History:** The address bar and window history normalize to `/?embed=1#/r/<id>` with no tokens or credentials.
