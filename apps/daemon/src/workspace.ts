// Current workspace bytes are a separate, explicitly approved reading capability.
// They never stand in for captured historical artifacts.
import { open, lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { MAX_IMAGE_BYTES, isDeniedPath, redactText, sniffImage } from '@drishya/privacy';
import { App, HttpError } from './app.ts';
import { isIndexableFile } from '@drishya/indexer';

export class WorkspaceAccess {
  private grants = new Map<string, string>();
  private app: App;
  constructor(app: App) { this.app = app; }

  async approve(id: string) {
    if (id.includes('+')) throw new HttpError(400, 'choose one session workspace');
    const rec = this.app.recording(id);
    if (!rec.workspaceRoot) throw new HttpError(400, 'no captured workspace on this machine');
    // Uses the existing drive/home checks; the API cannot select an arbitrary root.
    await this.app.approveGraphRoot(id);
    const root = await realpath(rec.workspaceRoot);
    this.grants.set(id, root);
    return this.status(id);
  }

  status(id: string) {
    const rec = this.app.recording(id);
    return { approved: this.grants.has(id), root: rec.workspaceRoot, scope: 'current-workspace' as const };
  }

  revoke(id: string) { this.grants.delete(id); }

  async root(id: string): Promise<string> {
    const rec = this.app.recording(id);
    const root = this.grants.get(id);
    if (!root || !rec.workspaceRoot || await realpath(rec.workspaceRoot) !== root) throw new HttpError(403, 'approve this session workspace first');
    return root;
  }

  /**
   * CONTENT-1: the current bytes of an image the agent referenced by path, under the same approval,
   * path and symlink rules as text reads. It is today's file, which may differ from what the agent saw.
   */
  async image(id: string, absolute: string): Promise<{ mime: string; body: Buffer; modifiedAt: string; path: string }> {
    const root = await this.root(id);
    if (!isAbsolute(absolute)) throw new HttpError(403, 'outside this workspace');
    // A journal may spell the path in another letter case on Windows; the real path decides.
    // Any difference beyond case means a link was followed, which reads refuse.
    const given = resolve(absolute);
    let file: string;
    try { file = await realpath(given); } catch { throw new HttpError(404, 'the file is no longer there'); }
    if (process.platform === 'win32' ? file.toLowerCase() !== given.toLowerCase() : file !== given) throw new HttpError(403, 'linked files are not readable');
    const rel = relative(root, file).split(sep).join('/');
    if (!isAbsolute(absolute) || rel.startsWith('..') || isAbsolute(rel) || !file.startsWith(root + sep)) throw new HttpError(403, 'outside this workspace');
    if (rel.startsWith('.local/') || rel.split('/').some(p => !p || p === '.' || p === '..' || p.includes(':')) || isDeniedPath(rel)) throw new HttpError(403, 'not a readable workspace path');
    let cursor = root;
    for (const part of rel.split('/')) {
      cursor = join(cursor, part);
      try { if ((await lstat(cursor)).isSymbolicLink()) throw new HttpError(403, 'linked files are not readable'); }
      catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(404, 'the file is no longer there'); }
    }
    const handle = await open(file, 'r');
    try {
      if (await realpath(file) !== file) throw new HttpError(403, 'file location changed');
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) throw new HttpError(413, 'current image reader supports images up to 4 MiB');
      const body = Buffer.alloc(stat.size);
      let read = 0;
      while (read < body.length) { const part = await handle.read(body, read, body.length - read, read); if (!part.bytesRead) break; read += part.bytesRead; }
      const sniff = sniffImage(body.subarray(0, 65_536));
      if (!sniff) throw new HttpError(415, 'the file is not a PNG, JPEG, GIF or WebP image');
      const after = await lstat(file);
      if (after.isSymbolicLink() || after.ino !== stat.ino || after.dev !== stat.dev || read !== stat.size) throw new HttpError(409, 'file changed while reading');
      if (await this.root(id) !== root) throw new HttpError(403, 'workspace reading access changed');
      return { mime: sniff.mime, body: body.subarray(0, read), modifiedAt: stat.mtime.toISOString(), path: rel };
    } finally { await handle.close(); }
  }

  async read(id: string, path: string, start = 0, count = 200) {
    const root = await this.root(id);
    if (!path || path.startsWith('.local/') || isAbsolute(path) || path.includes('\\') || path.split('/').some(p => !p || p === '.' || p === '..' || p.includes(':')) || isDeniedPath(path)) throw new HttpError(403, 'not a readable workspace path');
    const file = resolve(root, path);
    if (relative(root, file).startsWith('..') || !file.startsWith(root + sep)) throw new HttpError(403, 'outside this workspace');
    // Reject every symlink component, including links that resolve back inside the workspace.
    let cursor = root;
    for (const part of path.split('/')) {
      cursor = join(cursor, part);
      if ((await lstat(cursor)).isSymbolicLink()) throw new HttpError(403, 'linked files are not readable');
    }
    const graph = await this.app.graph(id);
    // A bounded or explicitly stale map is not a complete list of eligible current files.
    // Check only this path under the same index rules; content permission stays separate.
    if (!graph.nodes.some(n => n.path === path) && (!(graph.truncated || graph.stale) || !await isIndexableFile(root, path))) throw new HttpError(403, 'file is outside the indexed workspace');
    const handle = await open(file, 'r');
    try {
      if (await realpath(file) !== file) throw new HttpError(403, 'file location changed');
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new HttpError(413, 'current reader supports text files up to 2 MiB');
      // Check after opening as well, so a replacement cannot silently widen the capability.
      const after = await lstat(file);
      if (after.isSymbolicLink() || after.ino !== stat.ino || after.dev !== stat.dev) throw new HttpError(409, 'file changed while opening');
      const buffer = Buffer.alloc(2 * 1024 * 1024 + 1);
      let bytesRead = 0;
      while (bytesRead < buffer.length) {
        const part = await handle.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead);
        if (!part.bytesRead) break;
        bytesRead += part.bytesRead;
      }
      const bytes = buffer.subarray(0, bytesRead);
      if (bytes.length > 2 * 1024 * 1024 || bytes.includes(0)) throw new HttpError(413, 'not a supported text file');
      // Redact the full bounded document before slicing: secrets may span page boundaries.
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
      catch { throw new HttpError(413, 'current reader supports valid UTF-8 text files'); }
      const safe = redactText(text);
      const final = await handle.stat(), location = await lstat(file);
      if (final.size !== stat.size || final.mtimeMs !== stat.mtimeMs || final.ctimeMs !== stat.ctimeMs || location.isSymbolicLink() || location.ino !== stat.ino || location.dev !== stat.dev) throw new HttpError(409, 'file changed during reading');
      if (await this.root(id) !== root) throw new HttpError(403, 'workspace reading access changed');
      const lines = safe.text.split('\n');
      return { path, scope: 'current-workspace' as const, text: lines.slice(start, start + count).join('\n'), start, totalLines: lines.length, returnedLines: Math.min(count, Math.max(0, lines.length - start)), hasMore: start + count < lines.length, redacted: safe.hits.length > 0, modifiedAt: stat.mtime.toISOString() };
    } finally { await handle.close(); }
  }
}
