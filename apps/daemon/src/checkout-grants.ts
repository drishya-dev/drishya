import {createHash,randomUUID} from 'node:crypto';
import {lstat,open,realpath} from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import {dirname,join,parse,resolve} from 'node:path';
import {homedir} from 'node:os';
import {sanitize} from '@drishya/privacy';
import type {Store} from '@drishya/store';

export interface CheckoutIdentity {
  root:string; directory:string;
  checkout:{root:string;directory:string;gitDirectory?:{root:string;directory:string}};
  repository:{kind:'git';root:string;directory:string}|{kind:'directory'};
}
interface SavedGrant {version:1;identity:CheckoutIdentity;createdAt:string;revision:string}
export interface CheckoutGrant {id:string;root:string;identity:CheckoutIdentity;createdAt:string}
const PREFIX='checkout-read-grant-v1:',LIMIT=128;
const normalize=(path:string)=>process.platform==='win32'?resolve(path).toLowerCase():resolve(path);
export const checkoutGrantKey=(path:string)=>{
  // A spelling alias is the same capability. Keep a missing path's old key so
  // revocation can still remove its grant after the checkout disappears.
  let canonical=path;try{canonical=realpathSync.native(path);}catch{}
  return createHash('sha256').update(normalize(canonical)).digest('hex');
};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const safe=(value:unknown)=>same(value,sanitize(value).value);
export class CheckoutIdentityError extends Error {
  readonly reason:string;
  constructor(reason:string){super(reason);this.reason=reason;}
}
async function directory(path:string) {
  const info=await lstat(path,{bigint:true});
  if(!info.isDirectory()||info.isSymbolicLink()||info.ino===0n||info.birthtimeNs<=0n)throw new CheckoutIdentityError('Directory identity is unavailable.');
  return `${info.dev}:${info.ino}:${info.birthtimeNs}`;
}
/** Read only bounded Git identity markers, never configuration or credentials. */
async function marker(path:string):Promise<string> {
  const before=await lstat(path,{bigint:true});
  if(!before.isFile()||before.isSymbolicLink()||before.size>4096n)throw new CheckoutIdentityError('Repository identity is unavailable.');
  const handle=await open(path,'r');
  try {
    const opened=await handle.stat({bigint:true});
    if(opened.ino!==before.ino||opened.dev!==before.dev)throw new CheckoutIdentityError('Repository identity changed.');
    const buffer=Buffer.alloc(4097),{bytesRead}=await handle.read(buffer,0,buffer.length,0),after=await lstat(path,{bigint:true});
    if(bytesRead>4096||after.isSymbolicLink()||after.ino!==opened.ino||after.dev!==opened.dev||after.mtimeNs!==opened.mtimeNs||after.size!==opened.size)throw new CheckoutIdentityError('Repository identity changed.');
    return buffer.subarray(0,bytesRead).toString('utf8');
  } finally {await handle.close();}
}
export async function checkoutIdentity(given:string):Promise<CheckoutIdentity> {
  const requested=resolve(given),root=await realpath(requested);
  const home=await realpath(homedir()).catch(()=>homedir());
  if(normalize(root)===normalize(parse(root).root)||normalize(root)===normalize(home))throw new CheckoutIdentityError('This folder is too broad to remember.');
  const identity:CheckoutIdentity={root,directory:await directory(root),checkout:{root,directory:await directory(root)},repository:{kind:'directory'}};
  let cursor=root;
  for(let depth=0;depth<64;depth++) {
    const path=join(cursor,'.git'),info=await lstat(path).catch(error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;});
    if(info) {
      if(info.isSymbolicLink())throw new CheckoutIdentityError('Redirected repository metadata cannot restore access.');
      let common:string,gitdir:string;
      if(info.isDirectory())common=gitdir=path;
      else {
        const pointer=/^gitdir: ([^\r\n]+)\r?\n?$/.exec(await marker(path));
        if(!pointer)throw new CheckoutIdentityError('Repository identity is unavailable.');
        const givenGitdir=resolve(cursor,pointer[1]!);
        if((await lstat(givenGitdir)).isSymbolicLink())throw new CheckoutIdentityError('Redirected repository metadata cannot restore access.');
        gitdir=await realpath(givenGitdir);
        await directory(gitdir);
        const relative=(await marker(join(gitdir,'commondir'))).trim();
        if(!relative||/[\x00-\x1f]/.test(relative))throw new CheckoutIdentityError('Repository identity is unavailable.');
        common=resolve(gitdir,relative);
      }
      const canonical=await realpath(common);
      if((await lstat(common)).isSymbolicLink())throw new CheckoutIdentityError('Redirected repository metadata cannot restore access.');
      // HEAD identifies a repository layout without reading remotes or user configuration.
      await marker(join(canonical,'HEAD'));
      identity.checkout={root:cursor,directory:await directory(cursor),gitDirectory:{root:gitdir,directory:await directory(gitdir)}};
      identity.repository={kind:'git',root:canonical,directory:await directory(canonical)};
      break;
    }
    const parent=dirname(cursor);
    if(parent===cursor)break;
    if(depth===63)throw new CheckoutIdentityError('Repository ancestry is too deep to validate.');
    cursor=parent;
  }
  if(!safe(identity))throw new CheckoutIdentityError('Redaction prevents a trustworthy checkout identity.');
  return identity;
}

/** Drishya-owned metadata only. No bodies or native policy are saved. */
export class CheckoutGrants {
  private store:Store;
  constructor(store:Store){this.store=store;}
  private saved(id:string):SavedGrant|undefined {
    const row=this.store.db.prepare('SELECT value FROM meta WHERE key=?').get(PREFIX+id) as {value:string}|undefined;
    if(!row)return;
    try {
      if(row.value.length>8192)throw Error();
      const value=JSON.parse(row.value) as SavedGrant;
      if(value.version!==1||typeof value.createdAt!=='string'||typeof value.revision!=='string'||!value.identity?.root||checkoutGrantKey(value.identity.root)!==id||!safe(value))throw Error();
      return value;
    } catch {this.remove(id);return;}
  }
  remove(id:string) {
    if(!/^[a-f0-9]{64}$/.test(id))throw new CheckoutIdentityError('Invalid checkout grant identity.');
    this.store.db.prepare('DELETE FROM meta WHERE key=?').run(PREFIX+id);
  }
  forget(root:string){this.remove(checkoutGrantKey(root));}
  async remember(root:string,identity:CheckoutIdentity,allowed:()=>boolean=()=>true) {
    if(!same(await checkoutIdentity(root),identity))throw new CheckoutIdentityError('Checkout identity changed during approval.');
    const id=checkoutGrantKey(root),record:SavedGrant={version:1,identity,createdAt:new Date().toISOString(),revision:randomUUID()};
    if(!safe(record))throw new CheckoutIdentityError('Redaction prevents remembering this checkout.');
    const count=this.store.db.prepare('SELECT count(*) AS n FROM meta WHERE key LIKE ?').get(PREFIX+'%') as {n:number};
    if(count.n>=LIMIT&&!this.saved(id))throw new CheckoutIdentityError('Remembered checkout limit reached; revoke an old grant first.');
    if(!allowed())throw new CheckoutIdentityError('Workspace access changed during approval.');
    this.store.db.prepare('INSERT INTO meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(PREFIX+id,JSON.stringify(record));
  }
  async restore(root:string):Promise<CheckoutIdentity|undefined> {
    const id=checkoutGrantKey(root),saved=this.saved(id);
    if(!saved)return;
    let current:CheckoutIdentity|undefined;
    try {current=await checkoutIdentity(root);} catch {/* A failed proof revokes; it never grants. */}
    if(this.saved(id)?.revision!==saved.revision)return;
    if(current&&same(current,saved.identity))return current;
    this.remove(id);
  }

  async list():Promise<CheckoutGrant[]> {
    const rows=this.store.db.prepare('SELECT key FROM meta WHERE key LIKE ? ORDER BY key LIMIT ?').all(PREFIX+'%',LIMIT+1) as {key:string}[],result:CheckoutGrant[]=[];
    for(const row of rows) {
      const id=row.key.slice(PREFIX.length);if(!/^[a-f0-9]{64}$/.test(id))continue;
      const saved=this.saved(id);if(!saved)continue;
      const current=await this.restore(saved.identity.root);if(current)result.push({id,root:current.root,identity:current,createdAt:saved.createdAt});
    }
    return result;
  }
  async sibling(identity:CheckoutIdentity):Promise<boolean> {
    if(identity.repository.kind!=='git')return false;
    return (await this.list()).some(grant=>same(grant.identity.repository,identity.repository)&&normalize(grant.identity.checkout.root)!==normalize(identity.checkout.root));
  }
}
