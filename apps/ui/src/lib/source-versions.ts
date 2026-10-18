import type { CurrentFile } from '../api.ts';
import { utf8Bytes } from './prompt-files.ts';
interface Versions {
    reading: CurrentFile;
    newer?: CurrentFile;
}
/** Eight files, at most two256KiB versions each, volatile and source-scoped. */
export class SourceVersions {
    private entries = new Map<string, Versions>();
    get(id: string, path: string) { return this.entries.get(JSON.stringify([id, path])); }
    offer(id: string, path: string, file: CurrentFile): Versions | undefined {
        const key = JSON.stringify([id, path]), entry = this.entries.get(key);
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
            return first;
        }
        if (entry.reading.text !== file.text)
            entry.newer = file;
        else {
            entry.reading = file;
            entry.newer = undefined;
        }
        return entry;
    }
    adopt(id: string, path: string) { const entry = this.get(id, path); if (entry?.newer) {
        entry.reading = entry.newer;
        entry.newer = undefined;
    } return entry?.reading; }
    forget(id: string, path: string) { this.entries.delete(JSON.stringify([id, path])); }
}
const sources = new WeakMap<object, SourceVersions>();
export function sourceVersions(source: object) { let versions = sources.get(source); if (!versions) {
    versions = new SourceVersions();
    sources.set(source, versions);
} return versions; }
