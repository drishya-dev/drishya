import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const DAEMON_CLI = path.resolve(REPO_ROOT, 'apps/daemon/src/cli.ts');

const PORT = Number(process.env.PORT) || 4040;
const HOST = '127.0.0.1';

// Active child process running drishya embed
let activeWorker = null;

function killActiveWorker() {
  if (activeWorker) {
    try {
      activeWorker.kill();
    } catch {
      // Ignore exit errors
    }
    activeWorker = null;
  }
}

process.on('exit', killActiveWorker);
process.on('SIGINT', () => { killActiveWorker(); process.exit(0); });
process.on('SIGTERM', () => { killActiveWorker(); process.exit(0); });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  // Disallow cross-origin requests
  const host = req.headers.host;
  if (!host || !host.startsWith('127.0.0.1:') && !host.startsWith('localhost:')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden: loopback access only');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // API: Launch Drishya embed
  if (url.pathname === '/api/launch' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let payload = {};
      try {
        if (body) payload = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON request body' }));
        return;
      }

      const cwd = payload.cwd || REPO_ROOT;
      const targetSession = payload.sessionId;

      killActiveWorker();

      // Launch drishya embed via node running cli.ts or drishya binary
      const args = [
        '--no-warnings',
        DAEMON_CLI,
        'embed',
      ];

      if (targetSession) {
        args.push(targetSession);
      } else {
        args.push('--latest');
      }

      if (cwd) {
        args.push('--cwd', cwd);
      }

      // Safe environment with no leaked tokens or external credentials
      const env = {
        ...process.env,
        NODE_ENV: 'development',
      };

      try {
        const child = spawn(process.execPath, args, {
          cwd: REPO_ROOT,
          env,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        activeWorker = child;

        let stdoutData = '';
        let stderrData = '';
        let responded = false;

        const timer = setTimeout(() => {
          if (!responded) {
            responded = true;
            res.writeHead(504, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Timed out waiting for Drishya embed launcher' }));
          }
        }, 15000);

        child.stdout.on('data', chunk => {
          stdoutData += chunk.toString();
          const lines = stdoutData.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              try {
                const parsed = JSON.parse(trimmed);
                if (parsed.url && parsed.recordingId) {
                  if (!responded) {
                    responded = true;
                    clearTimeout(timer);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(parsed));
                    return;
                  }
                } else if (parsed.error) {
                  if (!responded) {
                    responded = true;
                    clearTimeout(timer);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(parsed));
                    return;
                  }
                }
              } catch {
                // Ignore incomplete json lines
              }
            }
          }
        });

        child.stderr.on('data', chunk => {
          stderrData += chunk.toString();
        });

        child.on('error', err => {
          if (!responded) {
            responded = true;
            clearTimeout(timer);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Spawn failed: ${err.message}` }));
          }
        });

        child.on('exit', (code) => {
          if (!responded) {
            responded = true;
            clearTimeout(timer);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: `Launcher exited with code ${code}`,
              stderr: stderrData.slice(0, 500),
            }));
          }
        });
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Execution error: ${err.message}` }));
      }
    });
    return;
  }

  // API: Stop active embed worker
  if (url.pathname === '/api/stop' && req.method === 'POST') {
    killActiveWorker();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'stopped' }));
    return;
  }

  // Static files
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Access denied');
    return;
  }

  try {
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Drishya Reference Host listening at http://${HOST}:${PORT}`);
  console.log(`Press Ctrl+C to terminate.`);
});
