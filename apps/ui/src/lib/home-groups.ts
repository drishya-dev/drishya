export type TimeSection = 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older' | 'Future date' | 'Time unavailable';
export interface WorkspaceGroup<T> { key: string; root?: string; name: string; items: T[] }

export function timestamp(value?: string): number | undefined {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : undefined;
}

/** Calendar boundaries follow the viewer's local timezone, including DST days. */
export function timeSection(value: string | undefined, now: Date): TimeSection {
  const time = timestamp(value);
  if (time === undefined) return 'Time unavailable';
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(start); yesterday.setDate(start.getDate() - 1);
  const week = new Date(start); week.setDate(start.getDate() - 7);
  const tomorrow = new Date(start); tomorrow.setDate(start.getDate() + 1);
  if (time >= tomorrow.getTime()) return 'Future date';
  if (time >= start.getTime()) return 'Today';
  if (time >= yesterday.getTime()) return 'Yesterday';
  if (time >= week.getTime()) return 'Previous 7 days';
  return 'Older';
}

/** Full captured roots are identities; a basename is only a display label. */
export function workspaceGroups<T>(items: T[], rootOf: (item: T) => string | undefined, timeOf: (item: T) => string | undefined): WorkspaceGroup<T>[] {
  const groups = new Map<string, WorkspaceGroup<T>>();
  for (const item of [...items].sort((a, b) => (timestamp(timeOf(b)) ?? -Infinity) - (timestamp(timeOf(a)) ?? -Infinity))) {
    const root = rootOf(item)?.trim() || undefined;
    const key = root ? `root:${root}` : 'unassigned';
    let group = groups.get(key);
    if (!group) {
      group = { key, root, name: root ? root.replace(/[\\/]+$/, '').split(/[\\/]/).at(-1) || root : 'Unassigned workspace', items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()];
}
