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
  httpComplete,
  listModels,
  modelConfigFromEnv,
  prepareBriefing,
  prepareExplain,
  prepareLabels,
  preview,
  sendPrepared,
  type Complete,
  type ModelConfig,
  type Prepared,
} from '@drishya/explain';
import type { ChangeEvent, HealthEvent } from '@drishya/ingest';
import { redactText } from '@drishya/privacy';
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
  /** The model transport. Tests inject one; the default speaks HTTP to `model.baseUrl`. */
  complete?: Complete;
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
  const complete = opts.complete ?? httpComplete(model);
  const uiDir = opts.uiDir ?? defaultUiDir();
  const clients = new Set<ServerResponse>();
  let port = opts.port ?? 7878;

  const onChange = (ev: ChangeEvent) => {
    const data = `event: change\ndata: ${JSON.stringify(ev)}\n\n`;
    for (const c of clients) c.write(data);
  };
  // Capture state changes travel on their own event name, so viewers that only reload data on
  // `change` are not disturbed (B1, audit A05).
  const onHealth = (ev: HealthEvent) => {
    const data = `event: health
data: ${JSON.stringify(ev)}

`;
    for (const c of clients) c.write(data);
  };
  app.ingest.on('change', onChange);
  app.ingest.on('health', onHealth);

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
      const { status, body } = errorBody(e);
      if (status === 500) console.error(redactText(e instanceof Error ? (e.stack ?? e.message) : String(e)).text);
      if (!res.headersSent) json(res, body, status);
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
    if (a === 'sources' && m === 'GET') return json(res, await app.ingest.discoverReport());
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
    if (a === 'recordings' && !id && m === 'GET') return json(res, { recordings: app.store.listRecordings().map((r) => ({ ...r, live: app.ingest.isLive(r.id), privacyOutdated: app.ingest.privacyOutdated(r.id), health: app.ingest.health(r.id) })) });

    if (a === 'recordings' && id) {
      const firstId = id.split('+')[0]!;
      if (!sub && m === 'GET') return json(res, { recording: { ...app.recording(firstId), live: app.ingest.isLive(firstId), privacyOutdated: app.ingest.privacyOutdated(firstId), health: app.ingest.health(firstId) } });
      if (!sub && m === 'DELETE') {
        app.recording(firstId);
        return json(res, { ok: true, ...(await app.ingest.forget(firstId)) });
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
        // A note is user-typed text, so a pasted token gets the same policy as captured text.
        const note = redactText(String(body.note ?? '')).text.slice(0, 2000);
        return json(res, { id: app.store.addBookmark(firstId, Number(body.step ?? 0), note) });
      }
      if (sub === 'generated' && m === 'GET') return json(res, { generated: app.store.listGenerated(firstId) });

      // Model calls: explicit, previewable, derived (audit A04). Without `consent` the route returns
      // the exact request and its digest. With `consent`, it rebuilds the request from current
      // evidence and sends it only if the digest still matches what the person reviewed;
      // otherwise nothing is sent and the new preview comes back with 409.
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
        let prep: Prepared;
        let key: string;
        if (sub === 'explain') {
          const opId = String(body.operationId ?? '');
          if (!p.operations.some((o) => o.id === opId)) throw new HttpError(404, 'operation not found');
          prep = prepareExplain(p, opId, art, model);
          key = `explain:${opId}`;
        } else if (sub === 'briefing') {
          const from = body.from === undefined ? undefined : Number(body.from);
          const to = body.to === undefined ? undefined : Number(body.to);
          prep = prepareBriefing(p, art, model, { from, to });
          key = `briefing:${from ?? 0}-${to ?? 'end'}`;
        } else {
          prep = prepareLabels(p, model);
          key = 'labels';
        }
        const shown = preview(prep);
        if (typeof body.consent !== 'string') {
          // A cached answer is reused only if it came from this exact request.
          const stored = app.store.getGenerated(firstId, key) as { identity?: { digest?: string }; result?: unknown } | undefined;
          return json(res, { preview: shown, cached: stored?.identity?.digest === prep.digest ? stored.result : undefined });
        }
        if (!safeEqual(body.consent, prep.digest)) return json(res, { error: 'The evidence, model or destination changed since you reviewed it. Check the updated preview and confirm again.', preview: shown }, 409);
        const result = await sendPrepared(prep, complete);
        app.store.putGenerated(firstId, key, { identity: { digest: prep.digest, model: prep.request.model, endpoint: prep.request.endpoint }, result });
        return json(res, { result });
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
        app.ingest.off('health', onHealth);
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

/**
 * The response for a failed request. Messages are redacted: an upstream error (a model endpoint,
 * a parser) can quote content, and an error body is a sink like any other (audit A02).
 */
export function errorBody(e: unknown): { status: number; body: { error: string } } {
  const status = e instanceof HttpError ? e.status : 500;
  const message = e instanceof Error ? e.message : 'error';
  return { status, body: { error: redactText(message).text.slice(0, 2000) } };
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
