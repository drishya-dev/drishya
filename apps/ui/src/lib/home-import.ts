import type { DiscoveredSource } from '@drishya/contracts';

export const DISCOVERY_MS = 10_000, IMPORT_PROGRESS_MS = 400;
/** A recent disk write is evidence of writing, never of a running process. */
export function journalWriting(modifiedAt: string | undefined, now: number): boolean {
  const changed = Date.parse(modifiedAt ?? '');
  return Number.isFinite(changed) && changed <= now && now - changed < 60_000;
}
/** Journal path to how far its import has read. An empty entry has not reported yet. */
export type ImportProgress = Record<string, { fraction?: number }>;

/** Only what a row shows: a scan that found nothing new must not re-render Home. */
export function sameSources(old: DiscoveredSource[] | undefined, next: DiscoveredSource[]) {
  if (old?.length !== next.length) return false;
  return next.every((source, index) => {
    const before = old[index]!;
    return before.path === source.path && before.bytes === source.bytes && before.modifiedAt === source.modifiedAt && before.title === source.title
      && before.importedRecordingId === source.importedRecordingId && before.repositoryRoot === source.repositoryRoot;
  });
}

export function readProgress(old: ImportProgress, reported: { path: string; bytes: number; total: number }[]): ImportProgress {
  const next = { ...old };
  for (const { path, bytes, total } of reported) if (next[path] && total > 0) next[path] = { fraction: Math.min(1, bytes / total) };
  return next;
}

// Whole journal read: what remains is the same import linking its sessions, then the session opening.
export function importLabel({ fraction }: { fraction?: number }) {
  return fraction === undefined || fraction >= 1 ? 'Opening…' : `Reading ${Math.floor(fraction * 100)}%`;
}
