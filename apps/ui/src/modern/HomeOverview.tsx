import { relTime } from '../components/common.tsx';
import './home-overview.css';

// SHIP-3 (Yash, 12 Nov): a small overview above the session list, built only from what the list itself holds:
// when each session was last written, its harness and its workspace. Nothing here is estimated.
export interface OverviewSession { key: string; harness: string; time?: string }
export interface OverviewGroup { key: string; name: string; minor?: boolean; latest?: string; count: number }

const day = 86400000, weeks = 12;
const dayLabel = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' });

export function HomeOverview({ sessions, groups, now, onGroup }: { sessions: OverviewSession[]; groups: OverviewGroup[]; now: Date; onGroup: (key: string) => void }) {
  if (!sessions.length) return null;
  // Whole local days, oldest first, ending today.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), first = today - (weeks * 7 - 1) * day;
  const counts = new Array<number>(weeks * 7).fill(0);
  let week = 0, claude = 0, codex = 0, antigravity = 0;
  for (const session of sessions) {
    const time = Date.parse(session.time ?? '');
    if (session.harness === 'codex') codex++; else if (session.harness === 'claude-code') claude++; else if (session.harness === 'antigravity') antigravity++;
    if (!Number.isFinite(time)) continue;
    if (now.getTime() - time < 7 * day) week++;
    const date = new Date(time), index = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - first) / day);
    if (index >= 0 && index < counts.length) counts[index]!++;
  }
  const most = Math.max(1, ...counts), projects = groups.filter(group => !group.minor);
  const recent = [...projects].sort((a, b) => (Date.parse(b.latest ?? '') || 0) - (Date.parse(a.latest ?? '') || 0) || b.count - a.count).slice(0, 4);
  return <section className="mh-overview" aria-label="Overview">
    <div className="mh-ov-activity">
      <div className="mh-ov-grid" role="img" aria-label={`Sessions by the day they were last written, last ${weeks} weeks. ${counts.reduce((a, b) => a + b, 0)} in all, ${most} on the busiest day.`}>
        {counts.map((count, index) => <i key={index} data-level={count ? Math.ceil(4 * count / most) : 0} title={`${count} session${count === 1 ? '' : 's'} · ${dayLabel.format(first + index * day)}`}/>)}
      </div>
      <small>Last {weeks} weeks</small>
    </div>
    <dl className="mh-ov-totals">
      <div><dt>Sessions</dt><dd>{sessions.length}</dd></div>
      <div><dt>This week</dt><dd>{week}</dd></div>
      <div><dt>Workspaces</dt><dd>{projects.length}</dd></div>
      <div className="mh-ov-harness"><dt>Claude Code <b>{claude}</b> · Codex <b>{codex}</b> � Antigravity <b>{antigravity}</b></dt><dd aria-hidden="true"><span style={{ flexGrow: claude }} className="claude-code"/><span style={{ flexGrow: codex }} className="codex"/><span style={{ flexGrow: antigravity, background: "var(--t2)" }}/></dd></div>
    </dl>
    {recent.length > 0 && <div className="mh-ov-recent" role="group" aria-label="Recent workspaces">
      {recent.map(group => <button key={group.key} type="button" onClick={() => onGroup(group.key)} title={`Show ${group.name}'s sessions`}>
        <strong>{group.name}</strong><span>{group.count} session{group.count === 1 ? '' : 's'}{group.latest ? ` · ${relTime(group.latest)}` : ''}</span>
      </button>)}
    </div>}
  </section>;
}
