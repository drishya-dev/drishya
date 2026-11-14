import type { DiscoveredSource, RecordingSummary } from '@drishya/contracts';
import type { ReactNode } from 'react';
import { SessionGroups } from '../components/SessionGroups';
import { relTime } from '../components/common';

type Session = { key: string; root?: string; time?: string; recording?: RecordingSummary; source?: DiscoveredSource };
/** Imported and discovered sessions have one home; a known imported ID removes duplicates. */
export function ModernSessions({ recordings, sources, now, busy, renderRecording, onOpen }: { recordings: RecordingSummary[]; sources: DiscoveredSource[]; now: Date; busy?: string; renderRecording: (r: RecordingSummary) => ReactNode; onOpen: (s: DiscoveredSource) => void }) {
  const imported = new Set(recordings.map(r => r.id));
  const items: Session[] = [...recordings.map(r => ({ key:r.id,root:r.workspaceRoot,time:r.lastSourceTime,recording:r })), ...sources.filter(s => !s.importedRecordingId || !imported.has(s.importedRecordingId)).map(s => ({key:s.path,root:s.cwd,time:s.modifiedAt,source:s}))];
  return <SessionGroups items={items} rootOf={s => s.root} timeOf={s => s.time} now={now} render={item => item.recording ? renderRecording(item.recording) : <div className="row modern-discovered-session" key={item.key}><div className="row-main"><div className="row-title">{item.source!.title || 'Untitled session'}</div><div className="row-sub"><span className={`harness h-${item.source!.harness}`}>{item.source!.harness === 'codex' ? 'Codex' : item.source!.harness === 'antigravity' ? 'Antigravity' : 'Claude Code'}</span><span>{relTime(item.time)}</span><span>Available locally</span></div></div><div className="row-actions"><button className="btn" disabled={!!busy} onClick={() => onOpen(item.source!)}>{busy === item.key ? 'Opening…' : 'Open session'}</button></div></div>} />;
}
