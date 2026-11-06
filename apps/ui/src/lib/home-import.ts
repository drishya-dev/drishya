import type { DiscoveredSource } from '@drishya/contracts';

export const DISCOVERY_MS = 10_000, IMPORT_PROGRESS_MS = 400;
/** A recent disk write is evidence of writing, never of a running process. */
export function journalWriting(modifiedAt: string | undefined, now: number): boolean {
  const changed = Date.parse(modifiedAt ?? '');
  return Number.isFinite(changed) && changed <= now && now - changed < 60_000;
}
/**
 * When a session was last seen writing, or undefined when it was not writing in the last minute. Two kinds of evidence are
 * joined, never swapped: the discovered parent journal's write time, and a followed recording's captured change time. The
 * second matters because Claude ingest also reads companion and sub-agent files, so a session can be changing while its
 * parent journal's mtime is old; and an imported recording outside the discovery roots has no discovered journal at all.
 * A 'following' recording without a change time cannot be aged, so it keeps the state the observer reported.
 */
export function writingSince(evidence: { sourceModifiedAt?: string; health?: { state: string; lastChangeAt?: string } }, now: number): number | undefined {
  const times: number[] = [];
  if (journalWriting(evidence.sourceModifiedAt, now)) times.push(Date.parse(evidence.sourceModifiedAt!));
  const health = evidence.health;
  if (health?.state === 'following') {
    const changed = Date.parse(health.lastChangeAt ?? '');
    if (!Number.isFinite(changed)) times.push(0);
    else if (journalWriting(health.lastChangeAt, now)) times.push(changed);
  }
  return times.length ? Math.max(...times) : undefined;
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
