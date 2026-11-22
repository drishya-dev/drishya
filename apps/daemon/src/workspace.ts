import {CheckoutGrants,checkoutIdentity,checkoutGrantKey,type CheckoutIdentity} from './checkout-grants.ts';
// Current workspace bytes are a separate, explicitly approved reading capability.
// They never stand in for captured historical artifacts.
import { open, lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep, parse } from 'node:path';
import { MAX_IMAGE_BYTES, hasImageDimensions, isDeniedPath, redactText, sniffImage, tooManyPixels } from '@drishya/privacy';
import { App, HttpError } from './app.ts';
import { isIndexableFile } from '@drishya/indexer';
import { recordedFileRoots, recordedMainRootPrefixes } from './file-roots.ts';

const LINKED_GITDIR = /^gitdir:\s*(.+?)\s*$/m, WORKTREE_ADMIN = /^(.*?)[\\/]\.git[\\/]worktrees[\\/][^\\/]+$/;

/**
 * SEC-4: Git's own `--show-toplevel` check (used before every Git-review read) accepts a `.git` *file* that
 * redirects elsewhere, because the work tree it reports is still `root` — only the history and blobs come from
 * wherever the file points. A hostile repository whose `.git` is `gitdir: <path to an unrelated repository>` passed
 * that check and showed commits and file content from the other repository. Accept only a plain repository (`.git`
 * is a directory) or a genuine linked worktree of `root`: Git itself writes a two-way link for one — a forward
 * pointer here and a `gitdir` backlink in the worktree admin folder — that a `.git` file alone cannot fabricate,
 * because it would need write access to that other, real repository's `.git/worktrees/`.
 */
export async function verifyOwnGitDir(root: string): Promise<void> {
  const marker = await lstat(join(root, '.git')).catch(() => undefined);
  if (!marker) throw new HttpError(403, 'No repository there.');
  if (marker.isDirectory()) {
    // A plain repository keeps its own history: a `commondir` file here would hand Git another repository's refs and objects.
    if (await lstat(join(root, '.git', 'commondir')).catch(() => undefined)) throw new HttpError(403, 'The .git folder redirects to another repository.');
    return verifyOwnObjectStore(join(root, '.git'));
  }
  if (!marker.isFile() || marker.size > 4096) throw new HttpError(403, 'Unexpected .git entry.');
  const gitdir = LINKED_GITDIR.exec(await readFile(join(root, '.git'), 'utf8').catch(() => ''))?.[1];
  const admin = gitdir ? WORKTREE_ADMIN.exec(resolve(root, gitdir))?.[0] : undefined;
  const backlink = admin ? (await readFile(join(admin, 'gitdir'), 'utf8').catch(() => '')).trim() : undefined;
  const ownGitFile = await realpath(join(root, '.git')).catch(() => '');
  if (!admin || !backlink || !ownGitFile || await realpath(resolve(admin, backlink)).catch(() => '') !== ownGitFile) {
    throw new HttpError(403, 'The .git entry does not point to a worktree of this checkout.');
  }
  // `<repository>/.git/worktrees/<name>` shares `<repository>/.git`; Git writes `commondir` as `../..`. Any other target is another repository.
  const commonFile = (await readFile(join(admin, 'commondir'), 'utf8').catch(() => '')).trim();
  const common = join(admin, '..', '..');
  if (!commonFile || await realpath(resolve(admin, commonFile)).catch(() => '') !== await realpath(common).catch(() => '#')) {
    throw new HttpError(403, 'The worktree shares history with a different repository.');
  }
  return verifyOwnObjectStore(common);
}

/**
 * SEC-4b: objects must come from this repository's own store. A repository can borrow another folder's objects through
 * `objects/info/alternates` (or a redirected `objects` link) and then name any object it can find there. Plain repositories
 * with no alternates, and linked worktrees, are unaffected. A repository made with `clone --shared` or `--reference` must be
 * repacked first (`git repack -a -d`, then remove the alternates file).
 */
async function verifyOwnObjectStore(commonDir: string): Promise<void> {
  const own = await realpath(join(commonDir, 'objects')).catch(() => '');
  const within = (path: string, parent: string) => path === parent || path.startsWith(parent + sep);
  if (!own || !within(own, await realpath(commonDir).catch(() => '#'))) throw new HttpError(403, 'The object store is not inside this repository.');
  for (const name of ['alternates', 'http-alternates']) {
    const file = join(commonDir, 'objects', 'info', name);
    // One handle for the size check and the read, so the file cannot change between them.
    const handle = await open(file, 'r').catch(() => undefined);
    if (!handle) continue;
    let text: string;
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > 65_536) throw new HttpError(403, 'This repository borrows objects from another folder.');
      text = await handle.readFile('utf8');
    } finally { await handle.close(); }
    const entries = text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    if (name === 'http-alternates' && entries.length) throw new HttpError(403, 'This repository borrows objects from another folder.');
    for (const entry of entries) {
      if (entry.startsWith('"') || /[\x00-\x1f]/.test(entry)) throw new HttpError(403, 'This repository borrows objects from another folder.');
      const target = await realpath(resolve(commonDir, 'objects', entry)).catch(() => '');
      if (!target || !within(target, own)) throw new HttpError(403, 'This repository borrows objects from another folder. Repack it (git repack -a -d) and remove objects/info/alternates to review it here.');
    }
  }
}

/** FILES-11: a linked worktree of this same repository inside the approved root (an agent's `.local/wt-*` checkout) is read as a root of
 *  its own. Its `.git` is a one-line pointer back to this repository's `.git/worktrees`; only that pointer is read to decide. Any other
 *  nested checkout, and everything else under an ignored folder, stays refused. */
async function nestedWorktree(root: string, path: string): Promise<{ base: string; rest: string } | undefined> {
  const parts = path.split('/');
  let cursor = root;
  for (let index = 0; index < parts.length - 1; index++) {
    cursor = join(cursor, parts[index]!);
    // lstat: a linked folder is not a directory here, so a link can never lead into a worktree.
    if (!(await lstat(cursor).catch(() => undefined))?.isDirectory()) return undefined;
    const marker = await lstat(join(cursor, '.git')).catch(() => undefined);
    if (!marker) continue;
    if (!marker.isFile() || marker.size > 4096) return undefined;
    const gitdir = LINKED_GITDIR.exec(await readFile(join(cursor, '.git'), 'utf8').catch(() => ''))?.[1];
    const repository = gitdir ? WORKTREE_ADMIN.exec(resolve(cursor, gitdir))?.[1] : undefined;
    if (!repository || await realpath(repository).catch(() => '') !== root) return undefined;
    return { base: cursor, rest: parts.slice(index + 1).join('/') };
  }
  return undefined;
}

export class WorkspaceAccess {
  private grants = new Map<string, string>();
  private app: App;
  private accessEpoch=new Map<string,number>();
  private imageGrants=new Map<string,{path:string;identity:string}>();
  readonly remembered:CheckoutGrants;
  private rememberedSessions=new Set<string>();
  private rootEpoch=new Map<string,number>();
  private contextIdentity=new Map<string,CheckoutIdentity>();
  constructor(app: App) { this.app = app; this.remembered=new CheckoutGrants(app.store); }
  onClose(close:()=>Promise<void>):()=>void {return this.app.onClose(close);}

  private knownRecordingRoot(id:string) {
    try { return this.app.workspaceRecording(id).workspaceRoot; } catch { return undefined; }
  }
  evidenceId(id:string) { return this.app.readingId(id); }
  evidencePath(id:string,path:string) { const prefix=this.app.checkoutPrefix(id);return prefix?`${prefix}/${path}`:path; }
  currentPath(id:string,path:string) { const prefix=this.app.checkoutPrefix(id);return prefix&&path.startsWith(prefix+'/')?path.slice(prefix.length+1):path; }

  async approve(id: string, remember=false) {
    if (id.includes('+')) throw new HttpError(400, 'choose one session workspace');
    const rec = this.app.workspaceRecording(id);
    if (!rec.workspaceRoot) throw new HttpError(400, 'no captured workspace on this machine');
    const key=checkoutGrantKey(rec.workspaceRoot);
    // Changing this session's choice must not revoke another session's temporary grant.
    // Explicit revoke still invalidates every reader of the exact checkout.
    this.rootEpoch.set(key,(this.rootEpoch.get(key)??0)+1);this.remembered.remove(key);
    this.accessEpoch.set(id,(this.accessEpoch.get(id)??0)+1);this.grants.delete(id);this.rememberedSessions.delete(id);
    for(const image of this.imageGrants.keys())if(image.startsWith(id+'\0'))this.imageGrants.delete(image);
    const epoch=this.rootEpoch.get(key)??0;
    const identity=remember||id.includes('~')?await checkoutIdentity(rec.workspaceRoot):undefined;
    // Uses the existing drive/home checks; the API cannot select an arbitrary root.
    await this.app.approveGraphRoot(id);
    const root = await realpath(rec.workspaceRoot);
    if((this.rootEpoch.get(key)??0)!==epoch)throw new HttpError(409,'Workspace access changed during approval.');
    if(remember&&identity) {await this.remembered.remember(rec.workspaceRoot,identity,()=>(this.rootEpoch.get(key)??0)===epoch);this.rememberedSessions.add(id);}
    if((this.rootEpoch.get(key)??0)!==epoch)throw new HttpError(409,'Workspace access changed during approval.');
    if(id.includes('~')&&identity)this.contextIdentity.set(id,identity);
    this.grants.set(id, root);
    return this.status(id);
  }

  status(id: string) {
    const rec = this.app.workspaceRecording(id);
    return { approved: this.grants.has(id), root: rec.workspaceRoot, scope: 'current-workspace' as const, remembered:this.rememberedSessions.has(id) };
  }

  revokeRecording(owner:string) {
    for(const id of new Set([owner,...this.grants.keys()]))if(id===owner||id.startsWith(owner+'~'))this.revoke(id);
  }

  revoke(id:string) {
    const root=this.app.workspaceRecording(id).workspaceRoot,keys=new Set<string>();
    if(root)keys.add(checkoutGrantKey(root));
    const previous=this.grants.get(id);if(previous)keys.add(checkoutGrantKey(previous));
    for(const key of keys){this.rootEpoch.set(key,(this.rootEpoch.get(key)??0)+1);this.remembered.remove(key);}
    const affected=new Set([id,...this.grants.keys(),...[...this.imageGrants.keys()].map(key=>key.split('\0')[0]!)]);
    for(const session of affected) {
      const path=this.knownRecordingRoot(session);
      if(session!==id&&(!path||!keys.has(checkoutGrantKey(path))))continue;
      this.accessEpoch.set(session,(this.accessEpoch.get(session)??0)+1);this.grants.delete(session);this.rememberedSessions.delete(session);this.contextIdentity.delete(session);
      for(const key of this.imageGrants.keys())if(key.startsWith(session+'\0'))this.imageGrants.delete(key);
    }
  }

  async restoreStatus(id:string) {
    const rec=this.app.workspaceRecording(id),root=rec.workspaceRoot;
    if(!root||id.includes('+'))return this.status(id);
    if(this.grants.has(id)&&!this.rememberedSessions.has(id))return this.status(id);
    const key=checkoutGrantKey(root),epoch=this.rootEpoch.get(key)??0;
    const identity=await this.remembered.restore(root);
    if((this.rootEpoch.get(key)??0)!==epoch)return this.status(id);
    if(identity){
      // A remembered grant authorizes this exact root, not a sibling checkout.
      if(!this.grants.has(id))await this.app.approveGraphRoot(id);
      if((this.rootEpoch.get(key)??0)!==epoch)return this.status(id);
      if(!await this.remembered.restore(root)) {
        this.accessEpoch.set(id,(this.accessEpoch.get(id)??0)+1);this.grants.delete(id);this.rememberedSessions.delete(id);
        return this.status(id);
      }
      this.grants.set(id,identity.root);this.rememberedSessions.add(id);
    }else if(this.rememberedSessions.has(id)){
      this.accessEpoch.set(id,(this.accessEpoch.get(id)??0)+1);this.grants.delete(id);this.rememberedSessions.delete(id);
    }
    return this.status(id);
  }

  revokeRemembered(key:string) {
    this.remembered.remove(key);
    this.rootEpoch.set(key,(this.rootEpoch.get(key)??0)+1);
    for(const id of [...this.grants.keys()]) {
      const root=this.knownRecordingRoot(id);
      if(root&&checkoutGrantKey(root)===key)this.revoke(id);
    }
  }

  async setup(id:string) {
    const status=await this.restoreStatus(id);let identity:CheckoutIdentity|undefined,reason:string|undefined;
    try{if(status.root)identity=await checkoutIdentity(status.root);}catch{reason='Checkout identity is missing, redirected or cannot be validated.';}
    return {...status,identity,reason,siblingApproved:identity?await this.remembered.sibling(identity):false};
  }

  async root(id: string): Promise<string> {
    const rec = this.app.workspaceRecording(id);
    await this.restoreStatus(id);
    const root = this.grants.get(id);
    if (!root || !rec.workspaceRoot || await realpath(rec.workspaceRoot) !== root) throw new HttpError(403, 'approve this session workspace first');
    const identity=this.contextIdentity.get(id);
    if(identity&&JSON.stringify(identity)!==JSON.stringify(await checkoutIdentity(rec.workspaceRoot))){
      this.grants.delete(id);this.contextIdentity.delete(id);this.accessEpoch.set(id,(this.accessEpoch.get(id)??0)+1);
      throw new HttpError(403,'This checkout changed identity. Approve it again.');
    }
    return root;
  }

  /**
   * CONTENT-1: the current bytes of an image the agent referenced by path, under the same approval,
   * path and symlink rules as text reads. It is today's file, which may differ from what the agent saw.
   */
  async image(id: string, absolute: string): Promise<{ mime: string; body: Buffer; modifiedAt: string; path: string }> {
    const epoch=this.accessEpoch.get(id)??0,root = await this.root(id);
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
      const sniff = sniffImage(body.subarray(0, read));
      if (!hasImageDimensions(sniff)) throw new HttpError(415, 'the file has no readable PNG, JPEG, GIF or WebP image dimensions');
      if (tooManyPixels(sniff)) throw new HttpError(413, 'the image declares more pixels than the reader supports');
      const after = await lstat(file);
      if (after.isSymbolicLink() || after.ino !== stat.ino || after.dev !== stat.dev || read !== stat.size) throw new HttpError(409, 'file changed while reading');
      if (await this.root(id) !== root||(this.accessEpoch.get(id)??0)!==epoch) throw new HttpError(403, 'workspace reading access changed');
      return { mime: sniff.mime, body: body.subarray(0, read), modifiedAt: stat.mtime.toISOString(), path: rel };
    } finally { await handle.close(); }
  }

  /** Separate, volatile consent to one image already named by an owned observation. No directory access. */
  async approveImage(id:string,operation:string,path:string) {
    const epoch=this.accessEpoch.get(id)??0,root=await this.root(id);
    const file=await this.exactImageFile(path);
    const stat=await lstat(file);
    const key=id+'\0'+operation;
    if(this.imageGrants.size>=64)this.imageGrants.delete(this.imageGrants.keys().next().value!);
    const finalRoot=await this.root(id);
    if((this.accessEpoch.get(id)??0)!==epoch||finalRoot!==root)throw new HttpError(403,'workspace access changed');
    this.imageGrants.set(key,{path:file,identity:`${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`});
    return {approved:true,scope:'exact-current-image' as const};
  }
  private async exactImageFile(path:string) {
    if(!isAbsolute(path)||/^[\\/]{2}/.test(path)||isDeniedPath(path))throw new HttpError(403,'protected or remote image reference');
    const given=resolve(path);
    let file:string;try{file=await realpath(given);}catch{throw new HttpError(404,'the file is no longer there');}
    if(process.platform==='win32'?file.toLowerCase()!==given.toLowerCase():file!==given)throw new HttpError(403,'linked files are not readable');
    // Check every component, even links resolving back to the same path.
    let cursor=parse(file).root;
    for(const part of relative(cursor,file).split(sep)){cursor=join(cursor,part);if((await lstat(cursor)).isSymbolicLink()||isDeniedPath(cursor))throw new HttpError(403,'protected or linked image path');}
    const stat=await lstat(file);
    if(!stat.isFile()||stat.size>MAX_IMAGE_BYTES)throw new HttpError(413,'current image reader supports images up to 4 MiB');
    return file;
  }
  async recordedImage(id:string,operation:string,path:string) {
    const key=id+'\0'+operation,grant=this.imageGrants.get(key),epoch=this.accessEpoch.get(id)??0;
    if(!grant)return this.image(id,path);
    const root=await this.root(id),file=await this.exactImageFile(path);
    const handle=await open(file,'r');
    try{
      const stat=await handle.stat(),identity=`${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
      if(file!==grant.path||identity!==grant.identity)throw new HttpError(409,'this image changed; allow this exact image again');
      const body=Buffer.alloc(stat.size);let read=0;
      while(read<body.length){const part=await handle.read(body,read,body.length-read,read);if(!part.bytesRead)break;read+=part.bytesRead;}
      const after=await lstat(file);
      const finalFile=await this.exactImageFile(path),finalRoot=await this.root(id);
      if(this.imageGrants.get(key)!==grant||(this.accessEpoch.get(id)??0)!==epoch||read!==stat.size||after.isSymbolicLink()||`${after.dev}:${after.ino}:${after.size}:${after.mtimeMs}:${after.ctimeMs}`!==identity||finalFile!==file||finalRoot!==root)throw new HttpError(409,'image or access changed while reading');
      const sniff=sniffImage(body);
      if(!hasImageDimensions(sniff))throw new HttpError(415,'the file has no readable PNG, JPEG, GIF or WebP image dimensions');
      if(tooManyPixels(sniff))throw new HttpError(413,'the image declares more pixels than the reader supports');
      return {mime:sniff.mime,body,modifiedAt:stat.mtime.toISOString(),path:file};
    }finally{await handle.close();}
  }

  async read(id: string, path: string, start = 0, count = 200) {
    const epoch=this.accessEpoch.get(id)??0,root = await this.root(id);
    if (!path || isAbsolute(path) || path.includes('\\') || path.split('/').some(p => !p || p === '.' || p === '..' || p.includes(':')) || isDeniedPath(path)) throw new HttpError(403, 'not a readable workspace path');
    const nested = await nestedWorktree(root, path);
    if (nested ? nested.rest.startsWith('.local/') || isDeniedPath(nested.rest) : path.startsWith('.local/')) throw new HttpError(403, 'not a readable workspace path');
    const file = resolve(root, path);
    if (relative(root, file).startsWith('..') || !file.startsWith(root + sep)) throw new HttpError(403, 'outside this workspace');
    // Reject every symlink component, including links that resolve back inside the workspace.
    let cursor = root;
    for (const part of path.split('/')) {
      cursor = join(cursor, part);
      // A worktree changes branches under the session: a file it no longer has is gone, not a server error.
      const info = await lstat(cursor).catch(() => undefined);
      if (!info) throw new HttpError(404, 'the file is no longer there');
      if (info.isSymbolicLink()) throw new HttpError(403, 'linked files are not readable');
    }
    // A worktree's files are not in this root's map; the worktree's own index rules (its .gitignore, size, binary, links) decide instead.
    if (nested) { if (!await isIndexableFile(nested.base, nested.rest)) throw new HttpError(403, 'file is outside the indexed workspace'); }
    else {
    const graph = await this.app.graph(id);
    // A bounded or explicitly stale map is not a complete list of eligible current files.
    // Check only this path under the same index rules; content permission stays separate.
    if (!graph.nodes.some(n => n.path === path || n.path === this.evidencePath(id,path))) {
      let recordedMainFile = false;
      if (graph.temporal === 'recording-files-only') {
        const { roots } = await recordedFileRoots(this.app.store, this.app.readingId(id).split('+'));
        const prefixes = recordedMainRootPrefixes(roots, this.app.workspaceRecording(id).workspaceRoot);
        // A historical namespaced node can identify a main file, never grant its bytes.
        // The approved-root, link and index rules still decide every current read.
        recordedMainFile = prefixes.some(prefix => graph.nodes.some(node => node.path === `${prefix}/${path}`));
      }
      if (!(recordedMainFile || graph.truncated || graph.stale) || !await isIndexableFile(root, path)) throw new HttpError(403, 'file is outside the indexed workspace');
    }
    }
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
      if (await this.root(id) !== root||(this.accessEpoch.get(id)??0)!==epoch) throw new HttpError(403, 'workspace reading access changed');
      const lines = safe.text.split('\n');
      return { path, scope: 'current-workspace' as const, text: lines.slice(start, start + count).join('\n'), start, totalLines: lines.length, returnedLines: Math.min(count, Math.max(0, lines.length - start)), hasMore: start + count < lines.length, redacted: safe.hits.length > 0, modifiedAt: stat.mtime.toISOString() };
    } finally { await handle.close(); }
  }
}
