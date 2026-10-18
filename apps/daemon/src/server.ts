import {commandCursor} from '../../../packages/scene/src/commands.ts';
// Local HTTP API. Loopback only; per-launch token exchanged for an HttpOnly session cookie;
// strict Host and Origin checks; no generic filesystem access; passive capture plus explicitly opted-in native harness clients.
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
import { storageUsage } from './storage.ts';
import { WorkspaceAccess } from './workspace.ts';
import { GitReview } from './git-review.ts';
import { HarnessController } from './controller.ts';
import {sessionSegments} from './session-segments.ts';
import { readWorkingLocations, saveWorkingLocations } from './working-locations.ts';

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
  /** Clock in ms, injectable for session-lifetime tests. */
  now?: () => number;
  /** A session unused for this long is signed out. Default 12 h. */
  sessionIdleMs?: number;
  /** A session older than this is signed out however active. Default 7 days. */
  sessionMaxAgeMs?: number;
  /** At most this many sessions; signing in beyond it drops the least recently used. Default 32. */
  maxSessions?: number;
  /** Synthetic/native transport substitution for integration tests; never exposed over HTTP. */
  controllerFactory?: (app: App, workspace: WorkspaceAccess) => HarnessController;
}

/** A subscriber this far behind is disconnected; on reconnect it resyncs from revisions (B1b). */
const MAX_SSE_BUFFER = 1024 * 1024;

/**
 * Writes one SSE message, or disconnects a subscriber that has stopped reading, so a slow or
 * frozen tab can never make capture hold memory for it. Returns whether the client is kept.
 */
export function writeEvent(res: ServerResponse, data: string, maxBuffered = MAX_SSE_BUFFER): boolean {
  if (res.destroyed) return false;
  if (res.writableLength + Buffer.byteLength(data) > maxBuffered) {
    res.end();
    return false;
  }
  res.write(data);
  return true;
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
  const workspace = new WorkspaceAccess(app);
  const gitReview = new GitReview(workspace);
  const controller = opts.controllerFactory?.(app, workspace) ?? new HarnessController(app, workspace);
  app.ingest.resetLiveFlags();
  const token = opts.token ?? randomBytes(24).toString('hex');
  // The launch token is valid for this server's lifetime: it is the credential printed to the
  // person who started it, and scripts may use it as a bearer token. Browser sessions derived from
  // it expire when idle or old, are capped in number, and can be revoked (audit A10).
  const now = opts.now ?? (() => Date.now());
  const idleMs = opts.sessionIdleMs ?? 12 * 60 * 60 * 1000;
  const maxAgeMs = opts.sessionMaxAgeMs ?? 7 * 24 * 60 * 60 * 1000;
  const maxSessions = opts.maxSessions ?? 32;
  const sessions = new Map<string, { created: number; lastSeen: number }>();
  const sessionValid = (sid: string): boolean => {
    const s = sessions.get(sid);
    if (!s) return false;
    const t = now();
    if (t - s.lastSeen > idleMs || t - s.created > maxAgeMs) {
      sessions.delete(sid);
      return false;
    }
    s.lastSeen = t;
    return true;
  };
  const model = opts.model ?? modelConfigFromEnv();
  const complete = opts.complete ?? httpComplete(model);
  const uiDir = opts.uiDir ?? defaultUiDir();
  const clients = new Set<ServerResponse>();
  let port = opts.port ?? 7878;

  const broadcast = (data: string) => {
    for (const c of clients) if (!writeEvent(c, data)) clients.delete(c);
  };
  const onChange = (ev: ChangeEvent) => broadcast(`event: change\ndata: ${JSON.stringify(ev)}\n\n`);
  // Capture state changes travel on their own event name, so viewers that only reload data on
  // `change` are not disturbed (B1, audit A05).
  const onHealth = (ev: HealthEvent) => broadcast(`event: health\ndata: ${JSON.stringify(ev)}\n\n`);
  app.ingest.on('change', onChange);
  app.ingest.on('health', onHealth);

  const allowedHosts = () => new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
  const allowedOrigins = () => new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`, ...(opts.devOrigins ?? [])]);

  const authed = (req: IncomingMessage): boolean => {
    const bearer = /^Bearer\s+(\S+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (bearer && safeEqual(bearer, token)) return true;
    const sid = sessionOf(req);
    return !!sid && sessionValid(sid);
  };

  const inFlight = new Set<Promise<void>>();
  const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
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
        const t = now();
        for (const [k, v] of sessions) if (t - v.lastSeen > idleMs || t - v.created > maxAgeMs) sessions.delete(k);
        while (sessions.size >= maxSessions) {
          const oldest = [...sessions].sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0]!;
          sessions.delete(oldest[0]);
        }
        const sid = randomBytes(24).toString('hex');
        sessions.set(sid, { created: t, lastSeen: t });
        res.setHeader('set-cookie', `drishya_session=${sid}; Max-Age=${Math.floor(maxAgeMs / 1000)}; HttpOnly; SameSite=Strict; Path=/`);
        return json(res, { ok: true });
      }
      if (!authed(req)) throw new HttpError(401, 'not signed in to this Drishya launch — open the link printed by `drishya serve`');
      // Sign-out. A cross-site form cannot send DELETE, and Origin is already checked above.
      if (url.pathname === '/v1/session' && req.method === 'DELETE') {
        const sid = sessionOf(req);
        if (sid) sessions.delete(sid);
        res.setHeader('set-cookie', 'drishya_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/');
        return json(res, { ok: true });
      }
      // State-changing requests need an explicit JSON content type: a CSRF form cannot send one.
      if (req.method !== 'GET' && req.method !== 'HEAD' && !(req.headers['content-type'] ?? '').startsWith('application/json')) throw new HttpError(415, 'JSON body required');

      await route(req, res, url);
    } catch (e) {
      const { status, body } = errorBody(e);
      if (status === 500) console.error(redactText(e instanceof Error ? (e.stack ?? e.message) : String(e)).text);
      if (!res.headersSent) json(res, body, status);
      else res.end();
    }
  };
  const server = createServer((req, res) => {
    const request = handleRequest(req, res);
    inFlight.add(request);
    void request.finally(() => inFlight.delete(request));
  });

  const route = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    const m = req.method ?? 'GET';
    const parts = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent); // drop "v1"
    const [a, id, sub, subId] = parts;
    if (a === 'storage' && m === 'GET') return json(res, await storageUsage(app.store.dataDir));
    if (a === 'working-locations' && m === 'GET') return json(res, readWorkingLocations(app));
    if (a === 'working-locations' && m === 'PUT') return json(res, saveWorkingLocations(app, await readJson(req,256*1024)));
    if (a === 'working-locations' && m === 'DELETE') {app.store.db.prepare("DELETE FROM meta WHERE key='ui-working-locations-v1'").run();return json(res,{cleared:true});}

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
      // Every (re)connect starts with the current revisions, so a viewer that missed notices
      // converges even if nothing new is ever written (audit A07).
      res.write(`event: sync\ndata: ${JSON.stringify({ revisions: app.store.revisions() })}\n\n`);
      clients.add(res);
      const beat = setInterval(() => writeEvent(res, ': beat\n\n') || clients.delete(res), 25_000);
      req.on('close', () => {
        clearInterval(beat);
        clients.delete(res);
      });
      return;
    }
    if (a === 'revisions' && m === 'GET') return json(res, { revisions: app.store.revisions() });
    if (a === 'sources' && m === 'GET') return json(res, await app.ingest.discoverReport());
    if(a==='search-library'&&m==='GET') {
      const q=url.searchParams.get('q')??'',root=url.searchParams.get('root')??undefined,harness=url.searchParams.get('harness')??undefined;
      const from=url.searchParams.get('from')??undefined,to=url.searchParams.get('to')??undefined;
      if(q.trim().length<2||q.length>200||/[\r\n]/.test(q)||(root&&root.length>2048)||(harness&&!['codex','claude-code'].includes(harness)))throw new HttpError(400,'Invalid library search');
      for(const value of [from,to])if(value&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value))throw new HttpError(400,'Invalid search date');
      if(from&&to&&from>to)throw new HttpError(400,'Search date range is reversed');
      const positive=(key:string,max:number)=>{const raw=url.searchParams.get(key);if(raw===null)return undefined;const value=Number(raw);if(!/^\d+$/.test(raw)||!Number.isSafeInteger(value)||value<1||value>max)throw new HttpError(400,`Invalid search ${key}`);return value;};
      return json(res,await app.history.searchLibrary({q,root,harness:harness as 'codex'|'claude-code'|undefined,from,to,count:positive('count',50),before:positive('before',Number.MAX_SAFE_INTEGER)}));
    }
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
    if (a === 'recordings' && !id && m === 'GET') return json(res, { recordings: app.store.listRecordings().map((r) => ({ ...r, sourceBytes: app.store.sourceBytes(r.id), live: app.ingest.isLive(r.id), privacyOutdated: app.ingest.privacyOutdated(r.id), health: app.ingest.health(r.id) })) });

    if (a === 'recordings' && id) {
      const firstId = id.split('+')[0]!;
      if(sub==='segments'&&m==='GET') {
        const recording=app.recording(firstId);
        if(id.includes('+')||recording.harness!=='codex'||!recording.sourcePath) return json(res,{items:[],partial:false});
        return json(res,await sessionSegments(recording.sourcePath,await app.ingest.discover('codex')));
      }
      if (sub === 'refresh' && m === 'POST') {
        if(id.includes('+')) throw new HttpError(400,'Refresh one local session at a time.');
        const recording=app.recording(id);
        if(!recording.sourcePath) return json(res,{added:0,more:false});
        return json(res,await app.ingest.sync(id,{turnBytes:16*1024*1024,acceptUnterminated:false}));
      }
      if (sub === 'workspace' && !subId && m === 'GET') return json(res, workspace.status(id));
      if (sub === 'git' && !subId && m === 'GET') return json(res, gitReview.status(id));
      if (sub === 'git' && subId === 'approve' && m === 'POST') return json(res, await gitReview.approve(id));
      if (sub === 'git' && subId === 'snapshot' && m === 'GET') return json(res, await gitReview.snapshot(id, intParam(url, 'start', 0, 0, Number.MAX_SAFE_INTEGER)));
      if (sub === 'workspace' && subId === 'approve' && m === 'POST') return json(res, await workspace.approve(id));
      if (sub === 'workspace' && subId === 'file' && m === 'GET') return json(res, await workspace.read(id, url.searchParams.get('path') ?? '', intParam(url, 'start', 0, 0, Number.MAX_SAFE_INTEGER), intParam(url, 'count', 200, 1, 200)));
      if (sub === 'workspace' && subId === 'document' && m === 'GET') return json(res, await workspace.read(id, url.searchParams.get('path') ?? '', 0, Number.MAX_SAFE_INTEGER));
      if (sub === 'controller' && !subId && m === 'GET') return json(res, controller.status(id));
      if (sub === 'controller' && subId === 'settings' && m === 'POST') return json(res, await controller.inspect(id));
      if (sub === 'controller' && subId === 'prompt' && m === 'POST') {
        const body = await readJson(req, 9 * 1024 * 1024);
        return json(res, await controller.start(id, body.prompt, body.exclusive, body.attachments, body.options));
      }
      if(sub==='controller'&&subId==='answer'&&m==='POST') {const body=await readJson(req,32000);return json(res,controller.answer(id,body.runId,body.requestId,body.answers));}
      if (sub === 'controller' && subId === 'approval' && m === 'POST') {
        const body = await readJson(req);
        return json(res, controller.decide(id, body.runId, body.approvalId, body.allow));
      }
      if (sub === 'controller' && subId === 'stop' && m === 'POST') return json(res, await controller.stop(id, (await readJson(req)).runId));
      if (!sub && m === 'GET') return json(res, { recording: { ...app.recording(firstId), live: app.ingest.isLive(firstId), privacyOutdated: app.ingest.privacyOutdated(firstId), health: app.ingest.health(firstId) } });
      if (!sub && m === 'DELETE') {
        app.recording(firstId);
        await controller.forget(firstId); workspace.revoke(firstId); gitReview.revoke(firstId);
        const removed = await app.forget(firstId);
        return json(res, { ok: true, ...removed });
      }
      if (sub === 'history' && m === 'POST') {
        for (const key of id.split('+')) app.recording(key);
        const body = await readJson(req);
        for (const field of ['start', 'count', 'step', 'promptStep']) if (body[field] !== undefined && (!Number.isSafeInteger(body[field]) || Number(body[field]) < 0)) throw new HttpError(400, `invalid ${field}`);
        for (const field of ['selectedOperationId', 'observationId']) if (body[field] !== undefined && (typeof body[field] !== 'string' || String(body[field]).length > 512)) throw new HttpError(400, `invalid ${field}`);
        if (body.pinnedPassageIds !== undefined && (!Array.isArray(body.pinnedPassageIds) || body.pinnedPassageIds.length > 3 || body.pinnedPassageIds.some((pin: unknown) => typeof pin !== 'string' || pin.length > 512))) throw new HttpError(400, 'invalid passage pins');
        if (body.filter !== undefined && (!body.filter || typeof body.filter !== 'object' || Array.isArray(body.filter))) throw new HttpError(400, 'invalid filter');
        if (body.filter) for (const [key, value] of Object.entries(body.filter)) if (!['agentId', 'kind', 'tool', 'server'].includes(key) || typeof value !== 'string' || value.length > 512) throw new HttpError(400, 'invalid filter');
        return json(res, await app.history.page(id, body));
      }
      if(sub==='commands'&&m==='GET') {
        for(const key of id.split('+'))app.recording(key);
        const q=url.searchParams.get('q')??'',status=url.searchParams.get('status')??undefined,cursor=url.searchParams.get('cursor')??undefined,direction=url.searchParams.get('direction')??'older';
        if(q.length>200||status&&!['ok','error','running','unknown'].includes(status)||!['older','newer'].includes(direction))throw new HttpError(400,'Invalid command filter');
        if(cursor)try{commandCursor(cursor);}catch{throw new HttpError(400,'Invalid command cursor');}
        return json(res,await app.history.commands(id,{q,status:status as 'ok'|'error'|'running'|'unknown'|undefined,cursor,direction:direction as 'older'|'newer'}));
      }
      if (sub === 'summary' && m === 'GET') {
        for (const key of id.split('+')) app.recording(key);
        return json(res, await app.history.summary(id, intParam(url, 'from', 0, 0, Number.MAX_SAFE_INTEGER)));
      }
      if (sub === 'history-marker' && m === 'POST') {
        for (const key of id.split('+')) app.recording(key);
        const body = await readJson(req);
        const types = Array.isArray(body.types) ? body.types.filter((type: unknown) => ['turn', 'edit', 'fail', 'pass', 'prose', 'gap', 'spawn'].includes(String(type))) : [];
        return json(res, { step: await app.history.marker(id, Number(body.step) || 0, types, body.direction === -1 ? -1 : 1) });
      }
      if (sub === 'file-operations' && m === 'GET') {
        for (const key of id.split('+')) app.recording(key);
        return json(res, await app.history.file(id, url.searchParams.get('path') ?? '', intParam(url, 'start', 0, 0, Number.MAX_SAFE_INTEGER), intParam(url, 'count', 100, 1, 200), url.searchParams.has('step') ? intParam(url, 'step', 0, 0, Number.MAX_SAFE_INTEGER) : undefined, (url.searchParams.get('q') ?? '').slice(0, 1000)));
      }
      if (sub === 'projection' && m === 'GET') return json(res, app.projection(id));
      if (sub === 'observations' && m === 'GET') {
        app.recording(firstId);
        const after = intParam(url, 'after', -1, -1, Number.MAX_SAFE_INTEGER);
        const limit = intParam(url, 'limit', 200, 1, 1000);
        return json(res, { observations: app.store.observations(firstId, after, limit) });
      }
      if (sub === 'artifacts' && subId && m === 'GET') {
        if (url.searchParams.has('find')) {
          for (const key of id.split('+')) app.recording(key);
          const query = url.searchParams.get('find') ?? '', continuation = url.searchParams.get('cursor') ?? undefined;
          if (!query || query.length > 200 || /[\r\n]/.test(query) || (continuation && !/^[a-f0-9-]{36}$/.test(continuation))) throw new HttpError(400, 'Invalid stored search.');
          const result = await app.history.artifactFind(id, subId, query, intParam(url, 'start', 0, 0, Number.MAX_SAFE_INTEGER), continuation);
          return json(res, result ?? { matches: [], totalLines: 0, scannedThrough: 0, skippedLines: 0, available: false });
        }
        const start = intParam(url, 'start', 0, 0, Number.MAX_SAFE_INTEGER);
        const count = intParam(url, 'count', 20_000, 0, 20_000);
        if (app.paged(id)) return json(res, await app.history.artifact(id, subId, start, count));
        const projection=app.projection(id);
        // Bounded worker views retain long inputs as derived artifacts even when
        // this small session's ordinary projection keeps that input inline.
        if(subId.endsWith('_input')&&projection.operations.some(op=>subId===`art_${op.id}_input`))return json(res,await app.history.artifact(id,subId,start,count));
        return json(res, app.artifactSlice(projection, subId, start, count));
      }
      if (sub === 'graph' && !subId && m === 'GET') return json(res, await app.graph(id, url.searchParams.get('refresh') === '1'));
      // Scanning a folder for the map is an explicit approval of the captured root only (B2).
      if (sub === 'graph' && subId === 'approve' && m === 'POST') return json(res, await app.approveGraphRoot(firstId, (await readJson(req)).root as string | undefined));
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
      // The reader's "seen through here" mark for one recording (P2-A). It moves only on this
      // explicit request; opening or scrolling a recording never advances it.
      // P2-C: test runs recorded after one change, computed on the whole session in the worker.
      // Order only, never coverage; see packages/scene/src/verification.ts.
      if (sub === 'verification' && subId && m === 'GET') {
        if (id.includes('+')) throw new HttpError(400, 'verification is computed per recording, not for a combined view');
        app.recording(firstId);
        const trail = await app.history.verification(id, subId);
        if (!trail) throw new HttpError(404, 'not a captured change in this recording');
        return json(res, trail);
      }
      if (sub === 'since' && m === 'GET') {
        if (id.includes('+')) throw new HttpError(400, 'marks are kept per recording, not for a combined view');
        return json(res, await app.history.since(id, intParam(url, 'after', -1, -1, Number.MAX_SAFE_INTEGER), intParam(url, 'page', 0, 0, 1_000_000)));
      }
      if (sub === 'boundary' && m === 'GET') {
        if (id.includes('+')) throw new HttpError(400, 'marks are kept per recording, not for a combined view');
        app.recording(firstId);
        return json(res, { boundary: app.store.getBoundary(firstId) ?? null });
      }
      if (sub === 'boundary' && m === 'POST') {
        const rec = app.recording(firstId);
        if (id.includes('+')) throw new HttpError(400, 'marks are kept per recording, not for a combined view');
        const sequence = (await readJson(req)).sequence;
        const last = app.store.countObservations(firstId) - 1;
        if (typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < -1 || sequence > last) throw new HttpError(400, `sequence must be an integer from -1 to ${last}`);
        app.store.setBoundary(firstId, sequence, rec.revision ?? 0);
        return json(res, { boundary: app.store.getBoundary(firstId) });
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
        const large = app.paged(id);
        const p = large ? undefined : app.projection(id);
        const art = (artId: string) => {
          try {
            return p ? app.artifactText(p, artId).text : undefined;
          } catch {
            return undefined;
          }
        };
        let prep: Prepared;
        let key: string;
        if (sub === 'explain') {
          const opId = String(body.operationId ?? '');
          if (p && !p.operations.some((o) => o.id === opId)) throw new HttpError(404, 'operation not found');
          prep = p ? prepareExplain(p, opId, art, model) : await app.history.prepare(id, sub, model, body);
          key = `explain:${opId}`;
        } else if (sub === 'briefing') {
          const from = body.from === undefined ? undefined : Number(body.from);
          const to = body.to === undefined ? undefined : Number(body.to);
          prep = p ? prepareBriefing(p, art, model, { from, to }) : await app.history.prepare(id, sub, model, body);
          key = `briefing:${from ?? 0}-${to ?? 'end'}`;
        } else {
          prep = p ? prepareLabels(p, model) : await app.history.prepare(id, sub, model, body);
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
    close: async () => {
      await controller.close();
      await new Promise<void>((ok) => {
        for (const c of clients) c.end();
        app.ingest.off('change', onChange);
        app.ingest.off('health', onHealth);
        server.close(() => ok());
        server.closeAllConnections();
      });
      // Aborting a socket does not cancel discovery/import already awaiting disk I/O. Let
      // handlers finish before the caller closes SQLite, or they race a finalized statement.
      await Promise.allSettled([...inFlight]);
    },
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
  // Only content-hashed build assets are immutable. Public fixture/design files keep
  // their names across builds; a year-long cache otherwise shows obsolete recordings/UI.
  const hashedAsset = rel.startsWith(`assets${sep}`) && /-[\w-]{8,}\.[a-z0-9]+$/i.test(rel);
  res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream', 'cache-control': hashedAsset ? 'public, max-age=31536000, immutable' : 'no-store' });
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

function sessionOf(req: IncomingMessage): string | undefined {
  return /(?:^|;\s*)drishya_session=([a-f0-9]+)/.exec(req.headers.cookie ?? '')?.[1];
}

/** An integer query parameter, clamped to [min, max]; anything non-numeric is a 400, never NaN. */
function intParam(url: URL, name: string, fallback: number, min: number, max: number): number {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  if (!/^-?\d+$/.test(raw)) throw new HttpError(400, `${name} must be an integer`);
  return Math.min(max, Math.max(min, Number(raw)));
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
