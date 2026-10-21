import type { Projection } from '@drishya/contracts';

/** Derived from captured operations, never from current disk or Git status. */
export interface FileEvidence {
  path: string;
  readCalls: number;
  /** The file's latest captured change: created, edited or deleted. */
  change?: 'A' | 'E' | 'D';
  changeStatus?: 'ok' | 'unknown';
  now: boolean;
}

const indexes = new WeakMap<Projection, Map<string, FileEvidence>>();
export const evidencePath = (path: string) => !!path && !path.startsWith('/') && !/^[A-Za-z]:/.test(path) && !path.split('/').includes('..');

/** The worker holds the whole projection; only the requested visible rows cross the API. */
export function fileEvidence(projection: Projection, paths: readonly string[]): FileEvidence[] {
  let index = indexes.get(projection);
  if (!index) {
    index = new Map();
    for (const op of projection.operations) {
      // A repeated path ref is one call, not several reads.
      for (const path of new Set(op.paths.map(ref => ref.path).filter(evidencePath))) {
        const entry = index.get(path) ?? { path, readCalls: 0, now: false };
        if (op.paths.some(ref => ref.path === path && ref.role === 'read')) entry.readCalls++;
        if ((op.kind === 'edit' || op.kind === 'write') && (op.status === 'ok' || op.status === 'unknown')) {
          // `created` and `deleted` are recorded by the adapter. Empty replacement text does not prove deletion.
          // The latest change wins: a file deleted and then created again reads as created.
          const own = op.detail.kind === 'edit' && op.detail.path === path ? op.detail : undefined;
          entry.change = own?.deleted ? 'D' : entry.change === 'A' || own?.created ? 'A' : 'E';
          entry.changeStatus = op.status;
        }
        entry.now ||= op.status === 'running';
        index.set(path, entry);
      }
    }
    indexes.set(projection, index);
  }
  return [...new Set(paths)].flatMap(path => index!.has(path) ? [index!.get(path)!] : []);
}

/** Compact full-session path metadata survives history paging. Counts mean distinct files. */
export function touchedFiles(files: Projection['files']) {
  const paths = new Set<string>(), folders = new Map<string, number>();
  for (const file of files) {
    if (!evidencePath(file.path) || !file.roles.some(role => role !== 'mentioned') || paths.has(file.path)) continue;
    paths.add(file.path);
    const parts = file.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const folder = parts.slice(0, i).join('/'); folders.set(folder, (folders.get(folder) ?? 0) + 1);
    }
  }
  return { paths, folders };
}
