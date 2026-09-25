// Local HTTP API. Loopback only; per-launch token exchanged for an HttpOnly session cookie;
// strict Host and Origin checks; no generic filesystem access; no agent control of any kind.
// Zero runtime dependencies on purpose: `node:http` + Server-Sent Events for change notices.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordingIdFor } from '@drishya/capture-core';
import {
  briefing,
  evidenceForBriefing,
  evidenceForOperation,
  explainOperation,
  labelPassages,
  listModels,
  modelConfigFromEnv,
  preview,
  type ModelConfig,
} from '@drishya/explain';
import type { ChangeEvent } from '@drishya/ingest';
import { App, HttpError, VERSION } from './app.ts';

export interface ServerOptions {
  port?: number;
  host?: string;
  dataDir?: string;
  /** Extra origins allowed to call the API, e.g. the Vite dev server. */
  devOrigins?: string[];
  uiDir?: string;
  token?: string;
  app?: App;
  model?: ModelConfig;
}

export interface RunningServer {
  url: string;
  token: string;
  launchUrl: string;
  app: App;
  server: Server;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.map': 'application/json',
};

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

export const defaultUiDir = () => resolve(fileURLToPath(new URL('../../ui/dist', import.meta.url)));

export async function startServer(opts: ServerOptions = {}): Promise<RunningServer> {
  const host = opts.host ?? '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Drishya binds to loopback only.');
  const app = opts.app ?? new App(opts.dataDir);
  app.ingest.resetLiveFlags();
  const token = opts.token ?? randomBytes(24).toString('hex');
  const sessions = new Set<string>();
  const model = opts.model ?? modelConfigFromEnv();
  const uiDir = opts.uiDir ?? defaultUiDir();
  const clients = new Set<ServerResponse>();
  let port = opts.port ?? 7878;

  const onChange = (ev: ChangeEvent) => {
    const data = `event: change\ndata: ${JSON.stringify(ev)}\n\n`;
    for (const c of clients) c.write(data);
  };
  app.ingest.on('change', onChange);
  app.ingest.on('error', () => undefined); // tailing errors surface as gaps, never crash capture

  const allowedHosts = () => new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
  const allowedOrigins = () => new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`, ...(opts.devOrigins ?? [])]);

  const authed = (req: IncomingMessage): boolean => {
    const bearer = /^Bearer\s+(\S+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (bearer && safeEqual(bearer, token)) return true;
    const cookie = /(?:^|;\s*)drishya_session=([a-f0-9]+)/.exec(req.headers.cookie ?? '')?.[1];
    return !!cookie && sessions.has(cookie);
  };

  const server = createServer(async (req, res) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    try {
      // DNS-rebinding and cross-site defences: the Host must be us, and so must any Origin.
      if (!allowedHosts().has(String(req.headers.host ?? ''))) throw new HttpError(421, 'unexpected host');
      const origin = req.headers.origin;
      if (origin && !allowedOrigins().has(origin)) throw new HttpError(403, 'unexpected origin');
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

      if (!url.pathname.startsWith('/v1/')) return serveStatic(uiDir, url.pathname, res);
      if (url.pathname === '/v1/health') return json(res, { ok: true, version: VERSION });
      if (url.pathname === '/v1/session' && req.method === 'POST') {
        const bearer = /^Bearer\s+(\S+)$/.exec(req.headers.authorization ?? '')?.[1];
        if (!bearer || !safeEqual(bearer, token)) throw new HttpError(401, 'invalid launch token');
        const sid = randomBytes(24).toString('hex');
        sessions.add(sid);
        res.setHeader('set-cookie', `drishya_session=${sid}; HttpOnly; SameSite=Strict; Path=/`);
        return json(res, { ok: true });
      }
      if (!authed(req)) throw new HttpError(401, 'not signed in to this Drishya launch — open the link printed by `drishya serve`');
      // State-changing requests need an explicit JSON content type: a CSRF form cannot send one.
      if (req.method !== 'GET' && req.method !== 'HEAD' && !(req.headers['content-type'] ?? '').startsWith('application/json')) throw new HttpError(415, 'JSON body required');

      await route(req, res, url);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      if (!res.headersSent) json(res, { error: e instanceof Error ? e.message : 'error' }, status);
      else res.end();
    }
  });

  const route = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    const m = req.method ?? 'GET';
    const parts = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent); // drop "v1"
    const [a, id, sub, subId] = parts;

    if (a === 'config' && m === 'GET') {
      return json(res, {
        version: VERSION,
        dataDir: app.store.dataDir,
        adapters: Object.values(app.ingest.descriptors),
        llm: { configured: !!model.apiKey, baseUrl: model.baseUrl, models: { nano: model.nanoModel, super: model.superModel, ultra: model.ultraModel } },
      });
    }
    if (a === 'models' && m === 'GET') return json(res, { models: await listModels(model) });
    if (a === 'changes' && m === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(': connected\n\n');
      clients.add(res);
      const beat = setInterval(() => res.write(': beat\n\n'), 25_000);
      req.on('close', () => {
        clearInterval(beat);
        clients.delete(res);
      });
      return;
    }
    if (a === 'sources' && m === 'GET') return json(res, { sources: await app.ingest.discover() });
    if (a === 'import' && m === 'POST') {
      const body = await readJson(req);
      // Only sources that discovery found may be imported over the API: no arbitrary file reads.
      const sources = await app.ingest.discover();
      const src = sources.find((s) => samePath(s.path, String(body.path ?? '')) && (!body.adapterId || s.adapterId === body.adapterId));
      if (!src) throw new HttpError(400, 'not a discovered harness session');
      const r = await app.ingest.importSource(src.adapterId, src.path, { title: src.title });
      if (body.live) app.ingest.startLive(r.recordingId);
      return json(res, { ...r, recording: app.store.getRecording(r.recordingId) });
    }
    if (a === 'recordings' && !id && m === 'GET') return json(res, { recordings: app.store.listRecordings().map((r) => ({ ...r, live: app.ingest.isLive(r.id) })) });

    if (a === 'recordings' && id) {
      const firstId = id.split('+')[0]!;
      if (!sub && m === 'GET') return json(res, { recording: { ...app.recording(firstId), live: app.ingest.isLive(firstId) } });
      if (!sub && m === 'DELETE') {
        app.ingest.forget(firstId);
        app.store.deleteRecording(firstId);
        return json(res, { ok: true });
      }
      if (sub === 'projection' && m === 'GET') return json(res, app.projection(id));
      if (sub === 'observations' && m === 'GET') {
        app.recording(firstId);
        const after = Number(url.searchParams.get('after') ?? -1);
        const limit = Math.min(1000, Number(url.searchParams.get('limit') ?? 200));
        return json(res, { observations: app.store.observations(firstId, after, limit) });
      }
      if (sub === 'artifacts' && subId && m === 'GET') {
        const { artifact, text } = app.artifactText(app.projection(id), subId);
        const lines = text.split('\n');
        const start = Math.max(0, Number(url.searchParams.get('start') ?? 0));
        const count = Math.min(20_000, Number(url.searchParams.get('count') ?? 20_000));
        return json(res, { artifact, totalLines: lines.length, start, text: lines.slice(start, start + count).join('\n') });
      }
      if (sub === 'graph' && m === 'GET') return json(res, await app.graph(id, url.searchParams.get('refresh') === '1'));
      if (sub === 'search' && m === 'GET') {
        const q = url.searchParams.get('q') ?? '';
        const ids = id.split('+');
        return json(res, { hits: ids.flatMap((r) => app.store.search(r, q, 50)) });
      }
      if (sub === 'live' && m === 'POST') {
        const body = await readJson(req);
        app.recording(firstId);
        if (body.on) app.ingest.startLive(firstId);
        else await app.ingest.stopLive(firstId);
        return json(res, { live: app.ingest.isLive(firstId) });
      }
      if (sub === 'sync' && m === 'POST') return json(res, await app.ingest.sync(firstId));
      if (sub === 'export' && m === 'GET') {
        const bundle = await app.exportBundle(id);
        res.setHeader('content-disposition', `attachment; filename="drishya-${firstId}.json"`);
        return json(res, bundle);
      }
      if (sub === 'bookmarks' && m === 'GET') return json(res, { bookmarks: app.store.bookmarks(firstId) });
      if (sub === 'bookmarks' && m === 'POST') {
        const body = await readJson(req);
        app.recording(firstId);
        return json(res, { id: app.store.addBookmark(firstId, Number(body.step ?? 0), String(body.note ?? '').slice(0, 2000)) });
      }
      if (sub === 'generated' && m === 'GET') return json(res, { generated: app.store.listGenerated(firstId) });

      // Model calls: explicit, previewable, derived. `confirm: false` returns what would be sent.
      if ((sub === 'explain' || sub === 'briefing' || sub === 'labels') && m === 'POST') {
        const body = await readJson(req);
        const p = app.projection(id);
        const art = (artId: string) => {
          try {
            return app.artifactText(p, artId).text;
          } catch {
            return undefined;
          }
        };
        if (sub === 'explain') {
          const opId = String(body.operationId ?? '');
          const key = `explain:${opId}`;
          if (!body.confirm) {
            const cached = app.store.getGenerated(firstId, key);
            return json(res, { preview: preview(evidenceForOperation(p, opId, art), model, 'explain'), cached });
          }
          const r = await explainOperation(p, opId, art, model);
          app.store.putGenerated(firstId, key, r);
          return json(res, { result: r });
        }
        if (sub === 'briefing') {
          const from = body.from === undefined ? undefined : Number(body.from);
          const to = body.to === undefined ? undefined : Number(body.to);
          const key = `briefing:${from ?? 0}-${to ?? 'end'}`;
          if (!body.confirm) return json(res, { preview: preview(evidenceForBriefing(p, art, from, to), model, 'briefing'), cached: app.store.getGenerated(firstId, key) });
          const r = await briefing(p, art, model, { from, to });
          app.store.putGenerated(firstId, key, r);
          return json(res, { result: r });
        }
        if (!body.confirm) return json(res, { preview: { endpoint: model.baseUrl, model: model.nanoModel, items: p.passages.length }, cached: app.store.getGenerated(firstId, 'labels') });
        const r = await labelPassages(p, model);
        app.store.putGenerated(firstId, 'labels', r);
        return json(res, { result: r });
      }
    }
    throw new HttpError(404, 'no such route');
  };

  await new Promise<void>((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => {
      server.off('error', fail);
      ok();
    });
  });
  const addr = server.address();
  if (addr && typeof addr === 'object') port = addr.port;
  const url = `http://127.0.0.1:${port}`;
  return {
    url,
    token,
    // The token travels in the fragment, which browsers never send to a server or a log.
    launchUrl: `${url}/#token=${token}`,
    app,
    server,
    close: () =>
      new Promise<void>((ok) => {
        for (const c of clients) c.end();
        app.ingest.off('change', onChange);
        server.close(() => ok());
        server.closeAllConnections();
      }),
  };
}

function serveStatic(uiDir: string, pathname: string, res: ServerResponse) {
  if (!existsSync(uiDir)) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><title>Drishya</title><body style="font:14px system-ui;background:#0a0a0c;color:#e4e4e7;padding:40px">The UI is not built yet. Run <code>pnpm ui:build</code>, or <code>pnpm ui:dev</code> for development.</body>');
    return;
  }
  let rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  let file = resolve(uiDir, rel);
  if (!file.startsWith(resolve(uiDir) + sep) && file !== resolve(uiDir)) throw new HttpError(403, 'outside the UI directory');
  if (!existsSync(file) || statSync(file).isDirectory()) {
    rel = 'index.html';
    file = join(uiDir, rel);
  }
  const ext = extname(file);
  res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable' });
  createReadStream(file).pipe(res);
}

function json(res: ServerResponse, body: unknown, status = 200) {
  const s = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(s);
}

async function readJson(req: IncomingMessage, limit = 1024 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let n = 0;
  for await (const c of req) {
    n += (c as Buffer).length;
    if (n > limit) throw new HttpError(413, 'body too large');
    chunks.push(c as Buffer);
  }
  if (!n) return {};
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return v && typeof v === 'object' ? v : {};
  } catch {
    throw new HttpError(400, 'invalid JSON');
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function samePath(a: string, b: string) {
  const n = (p: string) => resolve(p).replace(/\\/g, '/');
  return process.platform === 'win32' ? n(a).toLowerCase() === n(b).toLowerCase() : n(a) === n(b);
}

export { recordingIdFor };
