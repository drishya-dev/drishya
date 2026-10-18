import type { CurrentFile } from '../api.ts';
import { utf8Bytes } from './prompt-files.ts';
interface Versions {
    reading: CurrentFile;
    newer?: CurrentFile;
}
/** Eight files, at most two256KiB versions each, volatile and source-scoped. */
export class SourceVersions {
    private entries = new Map<string, Versions>();
    private requests = new Map<string, number>();
    private sequence = 0;
    private listeners = new Set<() => void>();
    begin(id:string,path:string) {
        const key=JSON.stringify([id,path]),ticket=++this.sequence;
        this.requests.delete(key);this.requests.set(key,ticket);
        while(this.requests.size>8)this.requests.delete(this.requests.keys().next().value!);
        return ticket;
    }
    subscribe(listener:()=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
    current(id:string,path:string,ticket:number){return this.requests.get(JSON.stringify([id,path]))===ticket;}
    private publish(){for(const listener of this.listeners)listener();}
    get(id: string, path: string) { return this.entries.get(JSON.stringify([id, path])); }
    offer(id: string, path: string, file: CurrentFile, ticket?:number): Versions | undefined {
        const key = JSON.stringify([id, path]), entry = this.entries.get(key);
        // Two panes can read one path concurrently. A slower earlier request
        // must not clear a newer candidate or replace its retained reading.
        if(ticket!==undefined&&this.requests.get(key)!==ticket)return entry;
        if (file.hasMore || file.start !== 0 || utf8Bytes(file.text) > 256 * 1024) {
            if (entry && entry.reading.text !== file.text)
                throw new Error('New disk version exceeds the256KiB comparison limit. Retained reading is unchanged.');
            return entry;
        }
        if (!entry) {
            if (this.entries.size >= 8)
                return undefined;
            const first = { reading: file };
            this.entries.set(key, first);
            this.publish();
            return first;
        }
        if (entry.reading.text !== file.text)
            entry.newer = file;
        else {
            entry.reading = file;
            entry.newer = undefined;
        }
        this.publish();return entry;
    }
    adopt(id: string, path: string) { const entry = this.get(id, path); if (entry?.newer) {
        entry.reading = entry.newer;
        entry.newer = undefined;
        this.publish();
    } return entry?.reading; }
    forget(id: string, path: string) { const key=JSON.stringify([id,path]);this.entries.delete(key);this.requests.delete(key); }
}
const sources = new WeakMap<object, SourceVersions>();
export function sourceVersions(source: object) { let versions = sources.get(source); if (!versions) {
    versions = new SourceVersions();
    sources.set(source, versions);
} return versions; }
