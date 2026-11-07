import {queuedInputChunk} from './queued-inputs.ts';
import {recordedFileRoots} from './file-roots.ts';
import {commandCursor} from '../../../packages/scene/src/commands.ts';
// Local HTTP API. Loopback only; per-launch token exchanged for an HttpOnly session cookie;
// strict Host and Origin checks; no generic filesystem access; passive capture plus explicitly opted-in native harness clients.
// Zero runtime dependencies on purpose: `node:http` + Server-Sent Events for change notices.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setImmediate as nextTurn } from 'node:timers/promises';
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
import { storageUsageReader } from './storage.ts';
import { readPersistedOutput } from './persisted-output.ts';
import {readWebResult} from './web-results.ts';
import { readCheckpointFile } from './checkpoint-file.ts';
import { readImage, referencedImagePath } from './images.ts';
import { WorkspaceAccess } from './workspace.ts';
import { GitReview } from './git-review.ts';
import { repositoryRoots } from './repository-root.ts';
import { sessionLinks } from './git-session-links.ts';
import { HarnessController } from './controller.ts';
import {sessionSegments} from './session-segments.ts';
import { readWorkingLocations, saveWorkingLocations } from './working-locations.ts';

export interface RecordingsTiming {
  probeId?: string;
  receivedAtMs: number;
  responseEndAtMs?: number;
  finishedAtMs: number;
  status: number;
}

export interface ServerOptions {
  /** In-process benchmark observer only; no endpoint, headers or persistence are added. */
  recordingsTiming?: (sample: RecordingsTiming) => void;
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
  const readStorageUsage = storageUsageReader(app.store.dataDir);
  const workspace = new WorkspaceAccess(app);
  const gitReview = new GitReview(workspace,undefined,app.history);
  const repositoryRoot = repositoryRoots();
  const imports = new Map<string, { recordingId: string; total: number }>();
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
  const onChange = (ev: ChangeEvent) => {
    broadcast(`event: change\ndata: ${JSON.stringify(ev)}\n\n`);
    // The client keeps its selected physical control id. An ancestor append still invalidates its historical view.
    for (const recording of app.store.listRecordings()) {
      if (recording.id === ev.recordingId || !app.store.lineageView(recording.id)?.recordingIds.includes(ev.recordingId)) continue;
      app.store.db.prepare('UPDATE recordings SET revision=revision+1 WHERE id=?').run(recording.id);
      broadcast(`event: change\ndata: ${JSON.stringify({ ...ev, recordingId: recording.id, revision: app.store.getRecording(recording.id)?.revision })}\n\n`);
    }
  };
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
  const timings = opts.recordingsTiming ? new WeakMap<ServerResponse, Omit<RecordingsTiming, 'finishedAtMs' | 'status'>>() : undefined;
  const server = createServer((req, res) => {
    if (timings && req.method === 'GET' && req.url?.split('?')[0] === '/v1/recordings') {
      const raw = req.headers['x-drishya-bench-id'];
      const sample = { receivedAtMs: performance.now(), probeId: typeof raw === 'string' && /^\d{1,4}$/.test(raw) ? raw : undefined, responseEndAtMs: undefined as number | undefined };
      timings.set(res, sample);
      res.once('finish', () => {
        // An observer failure must never affect the request being measured.
        try { opts.recordingsTiming!({ ...sample, finishedAtMs: performance.now(), status: res.statusCode }); } catch {}
      });
    }
    const request = handleRequest(req, res);
    inFlight.add(request);
    void request.finally(() => inFlight.delete(request));
  });

  const route = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    const m = req.method ?? 'GET';
    const parts = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent); // drop "v1"
    const [a, id, sub, subId] = parts;
    if (a === 'storage' && m === 'GET') return json(res, await readStorageUsage());
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
    if (a === 'sources' && m === 'GET') {
      const report = await app.ingest.discoverReport();
      return json(res, { ...report, sources: await Promise.all(report.sources.map(async s => ({ ...s, repositoryRoot: await repositoryRoot(s.cwd) }))) });
    }
    if (a === 'imports' && m === 'GET') return json(res, { imports: [...imports].map(([path, { recordingId, total }]) => ({ path, bytes: app.store.sourceBytes(recordingId), total })) });
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
      imports.set(src.path, { recordingId: recordingIdFor(src.adapterId, src.path), total: src.bytes });
      const r = await app.ingest.importSource(src.adapterId, src.path, { title: src.title }).finally(() => imports.delete(src.path));
      if (body.live) app.ingest.startLive(r.recordingId);
      return json(res, { ...r, recording: app.store.getRecording(r.recordingId) });
    }
    if (a === 'recordings' && !id && m === 'GET') {
      const recordings = app.store.listRecordings();
      const repositories = await Promise.all(recordings.map(r => repositoryRoot(r.workspaceRoot)));
      const result = json(res, { recordings: recordings.map((r, index) => ({ ...r, repositoryRoot: repositories[index], sourceBytes: (app.store.lineageView(r.id)?.recordingIds ?? [r.id]).reduce((bytes, id) => bytes + app.store.sourceBytes(id), 0), live: app.ingest.isLive(r.id), privacyOutdated: app.ingest.privacyOutdated(r.id), health: app.ingest.health(r.id) })) });
      const sample = timings?.get(res);
      if (sample) sample.responseEndAtMs = performance.now();
      return result;
    }

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
      if (sub === 'rescan' && (m === 'GET' || m === 'POST')) {
        if (id.includes('+')) throw new HttpError(400, 'Rescan one local recording at a time.');
        const recording = app.recording(id);
        let available = false;
        try { available = !!recording.sourcePath && statSync(recording.sourcePath).isFile(); } catch { /* Retained evidence can outlive its journal. */ }
        if (m === 'GET') return json(res, { available });
        if (!available) throw new HttpError(404, 'The original journal is unavailable. Captured history remains readable.');
        return json(res, await app.ingest.rescan(id));
      }
      if (sub === 'workspace' && !subId && m === 'GET') return json(res, workspace.status(id));
      if (sub === 'git' && !subId && m === 'GET') return json(res, gitReview.status(id));
      if (sub === 'git' && subId === 'approve' && m === 'POST') return json(res, await gitReview.approve(id));
      if (sub === 'git' && subId === 'snapshot' && m === 'GET') return json(res, await gitReview.snapshot(id, intParam(url, 'start', 0, 0, Number.MAX_SAFE_INTEGER)));
      if(sub==='git'&&subId==='history'&&m==='GET'){const page=await gitReview.history(id,{start:intParam(url,'start',0,0,10_000_000),referenceStart:intParam(url,'referenceStart',0,0,10_000_000),reference:url.searchParams.get('reference')??'all',query:url.searchParams.get('q')??'',generation:url.searchParams.get('generation')??undefined});return json(res,{...page,sessionLinks:{...sessionLinks(app.store,id,page.commits.map(commit=>commit.hash)),...page.sessionLinks}});}
      if(sub==='git'&&subId==='commit'&&m==='GET')return json(res,await gitReview.commit(id,url.searchParams.get('hash')??'',intParam(url,'parent',0,0,1023),intParam(url,'start',0,0,10_000_000),url.searchParams.get('generation')??undefined));
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
        for (const field of ['start', 'count', 'step', 'promptStep', 'since', 'previousSince']) if (body[field] !== undefined && (!Number.isSafeInteger(body[field]) || Number(body[field]) < 0)) throw new HttpError(400, `invalid ${field}`);
        for (const field of ['selectedOperationId', 'observationId']) if (body[field] !== undefined && (typeof body[field] !== 'string' || String(body[field]).length > 512)) throw new HttpError(400, `invalid ${field}`);
        if (body.pinnedPassageIds !== undefined && (!Array.isArray(body.pinnedPassageIds) || body.pinnedPassageIds.length > 3 || body.pinnedPassageIds.some((pin: unknown) => typeof pin !== 'string' || pin.length > 512))) throw new HttpError(400, 'invalid passage pins');
        if (body.filter !== undefined && (!body.filter || typeof body.filter !== 'object' || Array.isArray(body.filter))) throw new HttpError(400, 'invalid filter');
        if (body.filter) for (const [key, value] of Object.entries(body.filter)) if (!['agentId', 'kind', 'tool', 'server'].includes(key) || typeof value !== 'string' || value.length > 512) throw new HttpError(400, 'invalid filter');
        return historyJson(res, await app.history.pageBytes(app.readingId(id), body));
      }
      if(sub==='finding-members'&&m==='GET') {
        for(const part of id.split('+'))app.recording(part);
        const key=url.searchParams.get('key')??'',raw=url.searchParams.get('page')??'0',page=Number(raw),q=url.searchParams.get('q')??'';
        if(!/^(unknown|missing-change|gaps|repeat\/.+)$/.test(key)||key.length>600||q.length>200||!/^\d+$/.test(raw)||!Number.isSafeInteger(page)||page>1_000_000)throw new HttpError(400,'Invalid finding query');
        return json(res,await app.history.findingMembers(app.readingId(id),key,page,q));
      }
      if(sub==='review-insights'&&m==='GET') {
        for(const key of id.split('+'))app.recording(key);
        const raw=url.searchParams.get('page')??'0',page=Number(raw);
        if(!/^\d+$/.test(raw)||!Number.isSafeInteger(page)||page>1_000_000)throw new HttpError(400,'Invalid review page');
        const kind=url.searchParams.get('kind')??undefined;
        if(kind&&!['repeated-command','unknown-outcome','missing-change','capture-gap'].includes(kind))throw new HttpError(400,'Invalid finding category');
        return json(res,await app.history.reviewInsights(app.readingId(id),page,kind as 'repeated-command'|'unknown-outcome'|'missing-change'|'capture-gap'|undefined));
      }
      if(sub==='commands'&&m==='GET') {
        for(const key of id.split('+'))app.recording(key);
        const q=url.searchParams.get('q')??'',status=url.searchParams.get('status')??undefined,cursor=url.searchParams.get('cursor')??undefined,direction=url.searchParams.get('direction')??'older';
        if(q.length>200||status&&!['ok','error','running','unknown'].includes(status)||!['older','newer'].includes(direction))throw new HttpError(400,'Invalid command filter');
        if(cursor)try{commandCursor(cursor);}catch{throw new HttpError(400,'Invalid command cursor');}
        return json(res,await app.history.commands(app.readingId(id),{q,status:status as 'ok'|'error'|'running'|'unknown'|undefined,cursor,direction:direction as 'older'|'newer'}));
      }
      if(sub==='tools'&&m==='GET') {
        for(const key of id.split('+'))app.recording(key);
        return json(res,await app.history.tools(app.readingId(id),url.searchParams.has('step')?intParam(url,'step',0,0,Number.MAX_SAFE_INTEGER):undefined));
      }
      if(sub==='tool-trail'&&m==='GET') {
        for(const key of id.split('+'))app.recording(key);
        const field=(name:string)=>{const value=url.searchParams.get(name);if(value!==null&&(!value||value.length>300))throw new HttpError(400,'Invalid tool filter');return value??undefined;};
        const filter={tool:field('tool'),server:field('server'),kind:field('kind'),agent:field('agent')};
        if(!filter.tool&&!filter.server&&!filter.kind)throw new HttpError(400,'Name a tool, a server or a kind');
        const from={id:field('from'),at:url.searchParams.has('at')?intParam(url,'at',0,0,Number.MAX_SAFE_INTEGER):undefined};
        return json(res,await app.history.toolTrail(app.readingId(id),filter,from,url.searchParams.has('step')?intParam(url,'step',0,0,Number.MAX_SAFE_INTEGER):undefined));
      }
      if(sub==='screen'&&m==='GET') {
        for(const key of id.split('+'))app.recording(key);
        return json(res,await app.history.screen(app.readingId(id),url.searchParams.has('step')?intParam(url,'step',0,0,Number.MAX_SAFE_INTEGER):undefined));
      }
      if (sub === 'turns' && m === 'GET') {
        for (const key of id.split('+')) app.recording(key);
        return json(res, { turns: await app.history.turns(app.readingId(id)) });
      }
      if (sub === 'reading-target' && m === 'GET') {
        for (const key of id.split('+')) app.recording(key);
        const kind = url.searchParams.get('kind') ?? 'operation', direction = url.searchParams.get('direction') ?? '1', edge = url.searchParams.get('edge') ?? undefined;
        const fields = Object.fromEntries(['from', 'turnFrom', 'agent', 'tool', 'server', 'operationKind'].flatMap(key => url.searchParams.has(key) ? [[key, url.searchParams.get(key)!]] : []));
        if (!['operation','edit','failure','turn'].includes(kind) || !['1','-1'].includes(direction) || edge && !['first','last'].includes(edge) || Object.values(fields).some(value => !value || value.length > 300)) throw new HttpError(400, 'Invalid reading cursor');
        return json(res, await app.history.readingTarget(app.readingId(id), { kind: kind as 'operation'|'edit'|'failure'|'turn', direction: direction === '-1' ? -1 : 1, edge: edge as 'first'|'last'|undefined, ...fields, at: url.searchParams.has('at') ? intParam(url, 'at', 0, 0, Number.MAX_SAFE_INTEGER) : undefined }));
      }
      if (sub === 'file-evidence' && m === 'GET') {
        for (const key of id.split('+')) app.recording(key);
        const paths = url.searchParams.getAll('path');
        if (!paths.length || paths.length > 100 || paths.some(path => !path || path.length > 1024)) throw new HttpError(400, 'Choose 1 to 100 file paths');
        return json(res, await app.history.fileEvidence(app.readingId(id), paths, url.searchParams.has('step') ? intParam(url, 'step', 0, 0, Number.MAX_SAFE_INTEGER) : undefined));
      }
      if (sub === 'now' && m === 'GET') {
        for (const key of id.split('+')) app.recording(key);
        return json(res, await app.history.now(app.readingId(id)));
      }
      if (sub === 'summary' && m === 'GET') {
        for (const key of id.split('+')) app.recording(key);
        return json(res, await app.history.summary(app.readingId(id), intParam(url, 'from', 0, 0, Number.MAX_SAFE_INTEGER)));
      }
      if (sub === 'history-marker' && m === 'POST') {
        for (const key of id.split('+')) app.recording(key);
        const body = await readJson(req);
        const types = Array.isArray(body.types) ? body.types.filter((type: unknown) => ['turn', 'edit', 'fail', 'pass', 'prose', 'gap', 'spawn'].includes(String(type))) : [];
        return json(res, { step: await app.history.marker(app.readingId(id), Number(body.step) || 0, types, body.direction === -1 ? -1 : 1) });
      }
      if (sub === 'file-operations' && m === 'GET') {
        for (const key of id.split('+')) app.recording(key);
        return json(res, await app.history.file(app.readingId(id), url.searchParams.get('path') ?? '', intParam(url, 'start', 0, 0, Number.MAX_SAFE_INTEGER), intParam(url, 'count', 100, 1, 200), url.searchParams.has('step') ? intParam(url, 'step', 0, 0, Number.MAX_SAFE_INTEGER) : undefined, (url.searchParams.get('q') ?? '').slice(0, 1000), (url.searchParams.get('selected') ?? '').slice(0, 1000) || undefined));
      }
      if (sub === 'file-roots' && m === 'GET') {
        const ids=app.readingId(id).split('+'); for(const key of ids) app.recording(key);
        return json(res,await recordedFileRoots(app.store,ids));
      }
      if (sub === 'lineage' && m === 'GET') { app.recording(id); return json(res, { lineage: app.store.lineageView(id) ?? null }); }
      if (sub === 'projection' && m === 'GET') return json(res, app.projection(id));
      if(sub==='web-result'&&subId&&m==='GET'){
        const key=app.readingId(id).split('+').find(key=>subId.startsWith(`${key}.`));
        if(!key)throw new HttpError(400,'Choose a recorded web operation.');
        app.recording(key);
        const start=intParam(url,'start',0,0,Number.MAX_SAFE_INTEGER),count=intParam(url,'count',100,1,200);
        const q=url.searchParams.get('q')??'',resultId=url.searchParams.get('result')??undefined;
        if(q.length>500||(resultId&&resultId.length>1000))throw new HttpError(400,'Invalid recorded-result query.');
        try{return json(res,readWebResult(app.store,key,subId,{start,count,q,resultId}));}
        catch{throw new HttpError(404,'No matching captured web result.');}
      }
      if (sub === 'queue' && m === 'GET') {
        if (id.includes('+')) throw new HttpError(400, 'Choose a physical queue owner.');
        app.recording(id);
        const through = url.searchParams.get('through') ?? undefined;
        if (through && through.length > 1000 || subId && subId.length > 1000) throw new HttpError(400, 'Invalid queue reading.');
        try {
          if (subId) {
            const visible = await app.history.queue(app.readingId(id), id, {through, receiptId: subId, count: 1});
            if (!visible.items.some(item => item.id === subId)) throw new HttpError(404, 'Queued input was not captured at this point.');
            const chunk = queuedInputChunk(app.store, id, subId, undefined, intParam(url, 'start', 0, 0, Number.MAX_SAFE_INTEGER));
            if (!chunk) throw new HttpError(404, 'Queued input was not captured at this point.');
            return json(res, chunk);
          }
          return json(res, await app.history.queue(app.readingId(id), id, {through, before: intParam(url, 'before', Number.MAX_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER), count: intParam(url, 'count', 20, 1, 50)}));
        } catch (error) {
          if (error instanceof HttpError) throw error;
          throw new HttpError(400, 'Invalid queue reading boundary or range.');
        }
      }
      if (sub === 'observations' && m === 'GET') {
        app.recording(firstId);
        const after = intParam(url, 'after', -1, -1, Number.MAX_SAFE_INTEGER);
        const limit = intParam(url, 'limit', 200, 1, 1000);
        return json(res, { observations: app.store.observations(firstId, after, limit) });
      }
      if (sub === 'artifacts' && subId && m === 'GET') {
        if (url.searchParams.has('byteStart')) {
          for (const key of id.split('+')) app.recording(key);
          const start = intParam(url, 'byteStart', 0, 0, Number.MAX_SAFE_INTEGER);
          const field = url.searchParams.get('field') ?? undefined;
          if (field !== undefined && field !== 'text' && field !== 'structured') throw new HttpError(400, 'Invalid captured result field.');
          try { return json(res, await app.history.artifactChunk(app.readingId(id), subId, start, field)); }
          catch (error) { if (error instanceof Error && error.message.includes('UTF-8')) throw new HttpError(400, 'Invalid UTF-8 portion boundary.'); throw new HttpError(404, 'Stored result not found.'); }
        }
        if (url.searchParams.has('find')) {
          for (const key of id.split('+')) app.recording(key);
          const query = url.searchParams.get('find') ?? '', continuation = url.searchParams.get('cursor') ?? undefined;
          if (!query || query.length > 200 || /[\r\n]/.test(query) || (continuation && !/^[a-f0-9-]{36}$/.test(continuation))) throw new HttpError(400, 'Invalid stored search.');
          const result = await app.history.artifactFind(app.readingId(id), subId, query, intParam(url, 'start', 0, 0, Number.MAX_SAFE_INTEGER), continuation);
          return json(res, result ?? { matches: [], totalLines: 0, scannedThrough: 0, skippedLines: 0, available: false });
        }
        const start = intParam(url, 'start', 0, 0, Number.MAX_SAFE_INTEGER);
        const count = intParam(url, 'count', 20_000, 0, 20_000);
        if (app.paged(id)) return json(res, await app.history.artifact(app.readingId(id), subId, start, count));
        const projection=app.projection(id);
        // Bounded worker views retain long inputs as derived artifacts even when
        // this small session's ordinary projection keeps that input inline.
        if(subId.endsWith('_input')&&projection.operations.some(op=>subId===`art_${op.id}_input`))return json(res,await app.history.artifact(app.readingId(id),subId,start,count));
        return json(res, app.artifactSlice(projection, subId, start, count));
      }
      if (sub === 'graph' && !subId && m === 'GET') return json(res, await app.graph(id, url.searchParams.get('refresh') === '1'));
      // Scanning a folder for the map is an explicit approval of the captured root only (B2).
      if (sub === 'graph' && subId === 'approve' && m === 'POST') return json(res, await app.approveGraphRoot(firstId, (await readJson(req)).root as string | undefined));
      if (sub === 'search' && m === 'GET') {
        const q = url.searchParams.get('q') ?? '';
        const ids = app.readingId(id).split('+');
        const lineage = app.store.lineageForIds(ids);
        return json(res, { hits: lineage ? app.store.lineageSearch(lineage, q) : ids.flatMap(r => app.store.search(r, q, 50)) });
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
        const trail = await app.history.verification(app.readingId(id), subId);
        if (!trail) throw new HttpError(404, 'not a captured change in this recording');
        return json(res, trail);
      }
      if(sub==='delegation-thread'&&subId&&m==='GET'){
        if(id.includes('+'))throw new HttpError(400,'Choose one recording for a delegation thread.');
        app.recording(id);
        const value=await app.history.delegationThread(app.readingId(id),subId,intParam(url,'start',0,0,10_000_000),url.searchParams.has('step')?intParam(url,'step',0,0,10_000_000):undefined,intParam(url,'taskStart',0,0,10_000_000));
        if(!value)throw new HttpError(404,'No captured delegation at this position.');
        return json(res,value);
      }
      // READ-6: which lines of a file the agent had read, as recorded, before one edit.
      if (sub === 'read-before' && subId && m === 'GET') {
        if (id.includes('+')) throw new HttpError(400, 'read-before-write is computed per recording, not for a combined view');
        app.recording(firstId);
        const found = await app.history.readBefore(app.readingId(id), subId);
        if (!found) throw new HttpError(404, 'no read-before-write facts for this operation');
        return json(res, found);
      }
      // DATA-4: full output Claude Code saved to a file, read only on request and redacted.
      if (sub === 'persisted-output' && subId && m === 'GET') {
        if (id.includes('+')) throw new HttpError(400, 'saved output is read per recording, not for a combined view');
        app.recording(firstId);
        return json(res, await readPersistedOutput(app.store, firstId, subId));
      }
      // CONTENT-1: the current file behind an image path one of this recording's actions referenced.
      // Needs workspace approval; it is today's file, so it is never cached.
      if(sub==='workspace'&&subId==='image-grant'&&m==='POST') {
        if(id.includes('+'))throw new HttpError(400,'choose one session workspace');
        const body=await readJson(req,2048);
        if(typeof body.operation!=='string'||Object.keys(body).some(key=>key!=='operation'))throw new HttpError(400,'choose one recorded image operation');
        const path=referencedImagePath(app.store,firstId,body.operation);
        if(!path)throw new HttpError(404,'This action did not reference an image file.');
        return json(res,await workspace.approveImage(firstId,body.operation,path));
      }
      if (sub === 'workspace' && subId === 'image' && m === 'GET') {
        if (id.includes('+')) throw new HttpError(400, 'choose one session workspace');
        app.recording(firstId);
        const path = referencedImagePath(app.store, firstId, url.searchParams.get('operation') ?? '');
        if (!path) throw new HttpError(404, 'This action did not reference an image file.');
        const image = await workspace.recordedImage(firstId, url.searchParams.get('operation') ?? '', path);
        res.writeHead(200, { 'content-type': image.mime, 'content-length': image.body.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline', 'x-drishya-modified-at': image.modifiedAt });
        res.end(image.body);
        return;
      }
      // CONTENT-1: an image this recording captured inline, by content hash. Immutable, so cacheable.
      if (sub === 'images' && subId && m === 'GET') {
        const ids = app.readingId(id).split('+');
        for (const key of ids) app.recording(key);
        const image = readImage(app.store, ids, subId);
        if (!image) throw new HttpError(404, 'No captured image with that hash in this recording.');
        res.writeHead(200, { 'content-type': image.mime, 'content-length': image.body.length, 'cache-control': 'private, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline' });
        res.end(image.body);
        return;
      }
      // DATA-5: a file as Claude Code checkpointed it at the start of a turn; workspace approval required.
      if (sub === 'checkpoint' && subId && m === 'GET') {
        if (id.includes('+')) throw new HttpError(400, 'checkpoints are read per recording, not for a combined view');
        app.recording(firstId);
        return json(res, await readCheckpointFile(app.store, firstId, subId, workspace.status(firstId).approved));
      }
      // READ-7: a failed command, the next run of the same command and the edits between them.
      if (sub === 'fix-chain' && subId && m === 'GET') {
        if (id.includes('+')) throw new HttpError(400, 'fix chains are computed per recording, not for a combined view');
        app.recording(firstId);
        const chain = await app.history.fixChain(app.readingId(id), subId);
        if (!chain) throw new HttpError(404, 'no failure-to-later-run link for this command');
        return json(res, chain);
      }
      if (sub === 'since' && m === 'GET') {
        if (id.includes('+')) throw new HttpError(400, 'marks are kept per recording, not for a combined view');
        return json(res, await app.history.since(app.readingId(id), intParam(url, 'after', -1, -1, Number.MAX_SAFE_INTEGER), intParam(url, 'page', 0, 0, 1_000_000)));
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
      if (sub === 'bookmarks' && m === 'GET') {app.recording(firstId);return json(res,app.store.bookmarkPage(firstId,intParam(url,'start',0,0,Number.MAX_SAFE_INTEGER),intParam(url,'count',25,1,50)));}
      if (sub === 'bookmarks' && m === 'POST') {
        const body = await readJson(req);
        app.recording(firstId);
        const step=body.step??0;
        if(typeof step!=='number'||!Number.isSafeInteger(step)||step<0)throw new HttpError(400,'Bookmark step must be a nonnegative integer');
        if(app.store.bookmarkPage(firstId,0,1).total>=1000)throw new HttpError(409,'Reading-note limit reached for this recording. Existing notes remain available.');
        // A note is user-typed text, so a pasted token gets the same policy as captured text.
        const note = redactText(String(body.note ?? '')).text.slice(0, 2000);
        return json(res, { id: app.store.addBookmark(firstId, step, note) });
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
          prep = p ? prepareExplain(p, opId, art, model) : await app.history.prepare(app.readingId(id), sub, model, body);
          key = `explain:${opId}`;
        } else if (sub === 'briefing') {
          const from = body.from === undefined ? undefined : Number(body.from);
          const to = body.to === undefined ? undefined : Number(body.to);
          prep = p ? prepareBriefing(p, art, model, { from, to }) : await app.history.prepare(app.readingId(id), sub, model, body);
          key = `briefing:${from ?? 0}-${to ?? 'end'}`;
        } else {
          prep = p ? prepareLabels(p, model) : await app.history.prepare(app.readingId(id), sub, model, body);
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
  // Enrichment uses the existing passive, sealed ingest path; the server is already listening.
  void app.ingest.rescanLegacyCodex().catch(() => undefined);
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

/** Bound socket work per turn too: a single multi-megabyte end() still stalls capture. */
async function historyJson(res: ServerResponse, bytes: Uint8Array) {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': bytes.byteLength });
  async function* chunks() {
    for (let offset = 0; offset < bytes.byteLength; offset += 64 * 1024) {
      yield bytes.subarray(offset, offset + 64 * 1024);
      await nextTurn();
    }
  }
  try { await pipeline(Readable.from(chunks()), res); }
  catch { if (!res.destroyed) res.destroy(); } // A disconnected reader must not produce a second JSON response.
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
