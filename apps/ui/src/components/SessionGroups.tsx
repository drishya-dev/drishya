import { useState, type ReactNode } from 'react';
import { timeSection, workspaceGroups, type WorkspaceGroup } from '../lib/home-groups.ts';

export function SessionGroups<T>({ items, rootOf, timeOf, render, now }: { items: T[]; rootOf: (item: T) => string | undefined; timeOf: (item: T) => string | undefined; render: (item: T) => ReactNode; now: Date }) {
  const [shown, setShown] = useState(20);
  const groups = workspaceGroups(items, rootOf, timeOf);
  return <div className="rows session-groups">
    {groups.slice(0, shown).map((group, index) => <SessionGroup key={group.key} group={group} timeOf={timeOf} render={render} now={now} initiallyOpen={index < 3} />)}
    {groups.length > shown && <button className="btn" onClick={() => setShown(n => n + 20)}>Show more workspaces · {groups.length - shown} remaining</button>}
  </div>;
}

function SessionGroup<T>({ group, timeOf, render, now, initiallyOpen }: { group: WorkspaceGroup<T>; timeOf: (item: T) => string | undefined; render: (item: T) => ReactNode; now: Date; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [shown, setShown] = useState(20);
  const sections = new Map<string, T[]>();
  // Only expanded rows mount; complete counts and remaining controls stay truthful.
  if (open) for (const item of group.items.slice(0, shown)) {
    const section = timeSection(timeOf(item), now);
    const rows = sections.get(section) ?? []; rows.push(item); sections.set(section, rows);
  }
  return <section className="session-group" aria-label={`${group.name} sessions`}>
    <button className="workspace-group-heading" aria-expanded={open} onClick={() => setOpen(value => !value)} title={group.root}>
      <span aria-hidden="true">{open ? '▾' : '▸'}</span><span className="workspace-group-label"><strong>{group.name}</strong><small>{group.root ?? 'No workspace recorded'}</small></span><span className="workspace-group-count">{group.items.length}</span>
    </button>
    {open && <div>{[...sections].map(([label, rows]) => <div key={label} className="session-time-section"><h3>{label}</h3>{rows.map(render)}</div>)}
      {group.items.length > shown && <button className="btn session-more" onClick={() => setShown(n => n + 20)}>Show more sessions · {group.items.length - shown} remaining in {group.name}</button>}
    </div>}
  </section>;
}
