import { workingLocations, type WorkingLocations } from '../../../packages/contracts/src/working-locations.ts';
import { sanitize } from '@drishya/privacy';
import { App, HttpError } from './app.ts';

const key='ui-working-locations-v1';
/** Lives in our own store, independent of port, browser profile and launch credentials.
 * A tab writes only when its own reading moved, so with two tabs on a session the later write wins. */
export function readWorkingLocations(app:App):WorkingLocations {
  const row=app.store.db.prepare('SELECT value FROM meta WHERE key=?').get(key) as {value:string}|undefined;
  try { return row&&row.value.length<=256*1024?workingLocations(JSON.parse(row.value)):{version:1,sessions:[]}; }
  catch { return {version:1,sessions:[]}; }
}
export function saveWorkingLocations(app:App,input:unknown) {
  const clean=workingLocations(sanitize(workingLocations(input)).value);
  clean.sessions=clean.sessions.filter(session=>session.id==='@home'||session.id.split('+').every(id=>!!app.store.getRecording(id)));
  const encoded=JSON.stringify(clean);
  if(Buffer.byteLength(encoded)>256*1024)throw new HttpError(413,'Saved reading locations exceed 256 KiB.');
  const previous=readWorkingLocations(app);
  const sessions=new Map(previous.sessions.filter(session=>session.id==='@home'||session.id.split('+').every(id=>!!app.store.getRecording(id))).map(session=>[session.id,session]));
  for(const session of clean.sessions) {
    const old=sessions.get(session.id);
    sessions.delete(session.id);sessions.set(session.id,{...session,revision:(old?.revision??0)+1});
  }
  const merged=workingLocations({version:1,last:clean.last??previous.last,sessions:[...sessions.values()]});
  if(!merged.sessions.some(s=>s.id===merged.last))delete merged.last;
  const safe=JSON.stringify(merged);
  if(Buffer.byteLength(safe)>256*1024)throw new HttpError(413,'Saved reading locations exceed 256 KiB.');
  app.store.db.prepare('INSERT INTO meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,safe);
  return {saved:true,revisions:Object.fromEntries(merged.sessions.map(session=>[session.id,session.revision??0]))};
}
