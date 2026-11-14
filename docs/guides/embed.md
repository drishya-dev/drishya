# Drishya Embed Integration Guide

Drishya can be embedded directly into developer tools, editors, and coding assistant applications as a dedicated live replay pane. In embed mode, Drishya displays a single agent session beside the host application without top-level library navigation, home screens, or session lists.

---

## 1. Overview and Core Invariants

Drishya makes developers understand an agent's work while it happens: what it read, ran, saw fail, and edited, presented as real captured content on a map of their repository with a timeline they can scrub.

When embedded into a host application:
- **Single session focus:** The view locks to the target recording. There is no Home button, session list, or workspace switcher.
- **Narrow layout down to 360 px:** At narrow widths (360–599 px), the repository map is hidden, Conversation mode is the default, and header chrome remains compact. At 600 px and wider, the complete session view with the living repository map is displayed.
- **Quiet at rest, articulate in motion:** Clean graphite theme, GitHub-dark syntax colors, no labeled boxes, and purposeful transitions respecting `prefers-reduced-motion`.
- **Passive by default:** Launching Drishya observes passively. Existing native controller eligibility, workspace consent, and idle-client acknowledgement are strictly preserved before any composer controls are shown. Antigravity sessions and offline bundles are always passive.
- **Top-level panes only:** Drishya strictly enforces `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`. Host applications mount Drishya via desktop pane APIs (such as Electron's `WebContentsView`) or sized windows, never iframes.

---

## 2. Installation and Setup

### Prerequisites
- **Node.js 24** (Node 24 LTS or current runtime directly executing TypeScript).
- Loopback networking enabled (`127.0.0.1`).

### From Package or Source
When consuming Drishya from source:
```bash
git clone https://github.com/drishya-dev/drishya.git
cd drishya
corepack pnpm install --frozen-lockfile
corepack pnpm ui:build
```

In a packaged installation, the executable is `drishya`. From a source checkout, run:
```bash
node apps/daemon/src/cli.ts <subcommand>
```

---

## 3. The `drishya embed` Launcher

Host applications launch Drishya via the `drishya embed` CLI command.

### Syntax
```bash
# Launch the latest recording for the current or specified checkout
drishya embed --latest [--cwd /path/to/project]

# Launch a specific recorded session by ID
drishya embed <recording-id>
```

### Launcher Output
On success, `drishya embed` writes exactly one line of JSON to `stdout` and keeps its process running to supervise the ephemeral loopback worker:
```json
{
  "url": "http://127.0.0.1:49152/?embed=1&recording=rec_0123456789abcdef#launch=4f7b2c9...",
  "port": 49152,
  "recordingId": "rec_0123456789abcdef",
  "mode": "top-level"
}
```

- `url`: Private launch URL containing the single-use bootstrap credential in the URL fragment (`#launch=...`).
- `port`: Dynamically assigned ephemeral loopback port.
- `recordingId`: Canonical ID of the selected session.
- `mode`: `top-level` (indicating top-level pane or window mounting).

### Error Handling
If launch fails, `drishya embed` exits with a non-zero exit code and outputs a structured error:
```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "The requested recording could not be found."
  }
}
```
Error codes include:
- `INVALID_SELECTION`: Both or neither of `--latest` and `<recording-id>` were provided.
- `CHECKOUT_UNAVAILABLE` / `CHECKOUT_MISMATCH`: The provided `--cwd` does not exist or does not match recorded sessions.
- `SESSION_NOT_FOUND`: The explicit recording ID has not been imported.
- `NO_SESSION`: No recorded sessions exist for the target directory.
- `IFRAME_UNSUPPORTED`: Framing flags were passed (iframes are refused by design).

---

## 4. UI Architecture and Embedding

### Viewport Sizing and Breakpoints
The embed view supports desktop side panes down to **360 CSS px**:
- **< 360 px:** Displays `.embed-too-narrow-banner` prompting the user to widen the pane or enter full screen. UI content is not scaled down.
- **360 px – 599 px:** Single-column layout. The 3D repository map is hidden (`display: none`). History defaults to **Conversation** mode. Header chrome is streamlined with an unclickable brand title, search button, settings trigger, and full-screen toggle.
- **600 px and above:** Normal session composition is active, including the interactive repository map, tool dock, and evidence inspectors.

### Full-Screen Toggle
Drishya provides a quiet **Full screen** toggle in the header actions:
- Calls the browser document Fullscreen API (`document.documentElement.requestFullscreen()`).
- Observes `fullscreenchange` and handles Escape key exits automatically.
- Smooth paired enter (`embedFullscreenEnter`, 180ms cubic-bezier) and exit (`embedFullscreenExit`, 160ms) keyframe animations, disabled when `prefers-reduced-motion` is active.
- Preserves the user's active replay step, filter, and scroll reading position across full-screen transitions.

---

## 5. Security Model in Plain Words

1. **Loopback Only:**
   The Drishya daemon binds strictly to `127.0.0.1`. It never listens on external network interfaces (`0.0.0.0`) and rejects non-loopback Host headers.

2. **Why Iframes Are Blocked:**
   Drishya serves `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY` on all responses. This ensures no third-party web page can frame Drishya to extract developer source code, diffs, or agent transcripts.

3. **Single-Use Launch Credential:**
   - The launch code is generated as a cryptographically secure 32-byte hex string valid for 60 seconds.
   - It is passed to the browser in the URL fragment (`#launch=<code>`).
   - At startup, Drishya's client code reads the fragment into a local variable and immediately scrubs it via `history.replaceState` before any network or DOM operations.
   - The client exchanges the code via `POST /v1/embed/session` (`{ code, recordingId }`) for an HttpOnly, SameSite=Strict session cookie.
   - Once authenticated, the URL normalizes to `/?embed=1#/r/<id>`.
   - The launch code is never stored in `localStorage`, never logged, and cannot be reused.

4. **Zero Telemetry:**
   Drishya collects zero telemetry, usage metrics, or error pings.

---

## 6. Desktop Integration (Electron Reference)

Desktop hosts embed Drishya as an isolated `WebContentsView`:

```javascript
// Electron Main Process
const { app, BrowserWindow, WebContentsView } = require('electron');
const { spawn } = require('node:child_process');

let embedProcess = null;
let drishyaView = null;

async function openDrishyaPane(parentWindow, cwd) {
  // 1. Spawn launcher
  embedProcess = spawn('node', ['apps/daemon/src/cli.ts', 'embed', '--latest', '--cwd', cwd], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // 2. Read launch JSON from stdout
  const { url, recordingId } = await parseLaunchJson(embedProcess.stdout);

  // 3. Create sandboxed WebContentsView
  drishyaView = new WebContentsView({
    webPreferences: {
      partition: 'persist:drishya-session',
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  // 4. Secure guest boundaries
  drishyaView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  drishyaView.webContents.on('will-navigate', (event, targetUrl) => {
    const parsed = new URL(targetUrl);
    if (parsed.hostname !== '127.0.0.1') event.preventDefault();
  });

  // 5. Mount and size view
  parentWindow.contentView.addChildView(drishyaView);
  positionPane(parentWindow, drishyaView);

  // 6. Navigate to private launch URL
  await drishyaView.webContents.loadURL(url);
}
```

See `examples/embed-host/` for a complete runnable implementation.

---

## 7. T3 Code Integration Walkthrough

Research conducted on T3 Code commit [`1fcb24518a04652fdc82ab6eea66b82b1a55335e`](https://github.com/pingdotgg/t3code/tree/1fcb24518a04652fdc82ab6eea66b82b1a55335e).

### Architectural Fit
T3 Code provides a desktop preview architecture (`apps/desktop/src/preview/Manager.ts` and `apps/web/src/browser/HostedBrowserWebview.tsx`) that mounts guest preview surfaces in dedicated partitions.

### Steps for T3 Code Maintainers
1. **Thread Action:**
   Add an "Open in Drishya" action button to the active coding thread header in T3 Code's desktop interface.
2. **Main-Process Launcher Invocation:**
   In T3's desktop main process, invoke `drishya embed --latest --cwd <thread.workspaceRoot>` upon clicking the action.
3. **Dedicated Preview Guest:**
   Mount Drishya in a dedicated preview guest with its own partition (`partition: 'persist:t3-drishya'`).
4. **URL Redaction & Logging:**
   Pass the launch URL directly to the guest's `loadURL`. Ensure T3's preview snapshots, model context buffers, and diagnostic logs record only the cleaned route (`/?embed=1#/r/<id>`), never the `#launch=...` fragment.
5. **Pane Resizing & Fullscreen:**
   Bind T3's pane splitter to the guest view bounds. Allow Drishya's internal full-screen button to trigger window full-screen, or bind T3's pane expand button to widen the view.
6. **Verification Across Harnesses:**
   Verify Claude Code, Codex, and Antigravity sessions in the T3 pane at 360 px, 600 px, and 1440 px.
