// @ts-check
/**
 * Reference Electron Host Integration for Drishya Embed
 * 
 * Demonstrates embedding Drishya as a native WebContentsView side pane
 * beside an Electron application window, without iframes or relaxed CSP.
 * 
 * Requirements:
 * - Electron >= 30 (WebContentsView API)
 * - Node 24 for the Drishya daemon/launcher
 */

const { app, BrowserWindow, WebContentsView } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');

// Configuration
const DRISHYA_CLI = path.resolve(__dirname, '../../apps/daemon/src/cli.ts');
const NODE_PATH = process.env.NODE_24_PATH || 'node'; // Installed Node 24 binary

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {WebContentsView | null} */
let drishyaView = null;

/** @type {import('node:child_process').ChildProcess | null} */
let embedProcess = null;

let paneWidth = 600; // Default width (supports 360, 600, 1440)
let isPaneVisible = false;

function updateViewBounds() {
  if (!mainWindow || !drishyaView || !isPaneVisible) return;
  const [winWidth, winHeight] = mainWindow.getContentSize();
  const topBarHeight = 48; // Host topbar height
  
  const width = Math.min(paneWidth, winWidth - 320); // Keep at least 320px for host chat
  const x = winWidth - width;
  const y = topBarHeight;
  const height = winHeight - topBarHeight;

  drishyaView.setBounds({ x, y, width, height });
}

async function launchDrishyaEmbed(targetCwd = process.cwd()) {
  if (embedProcess) {
    try { embedProcess.kill(); } catch {}
    embedProcess = null;
  }

  return new Promise((resolve, reject) => {
    // Spawn drishya embed with JSON output
    const child = spawn(NODE_PATH, [DRISHYA_CLI, 'embed', '--latest', '--cwd', targetCwd], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    embedProcess = child;
    let stdout = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Timeout waiting for drishya embed'));
      }
    }, 15000);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      const lines = stdout.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const data = JSON.parse(trimmed);
            if (data.url && data.recordingId) {
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                resolve(data);
                return;
              }
            }
          } catch {}
        }
      }
    });

    child.stderr.on('data', chunk => {
      console.error('[drishya embed stderr]', chunk.toString());
    });

    child.on('exit', code => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`drishya embed exited with code ${code}`));
      }
    });
  });
}

async function attachDrishyaPane(launchUrl) {
  if (!mainWindow) return;

  if (!drishyaView) {
    // Create sandboxed WebContentsView with dedicated partition
    drishyaView = new WebContentsView({
      webPreferences: {
        partition: 'persist:drishya-session',
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    });

    // Security: Prevent guest from navigating away or opening popups
    drishyaView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    drishyaView.webContents.on('will-navigate', (event, targetUrl) => {
      const parsed = new URL(targetUrl);
      if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
        event.preventDefault();
      }
    });

    mainWindow.contentView.addChildView(drishyaView);
  }

  isPaneVisible = true;
  updateViewBounds();

  // Load the private single-use launch URL
  await drishyaView.webContents.loadURL(launchUrl);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 680,
    minHeight: 480,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('resize', updateViewBounds);

  mainWindow.on('closed', () => {
    if (embedProcess) {
      try { embedProcess.kill(); } catch {}
      embedProcess = null;
    }
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
