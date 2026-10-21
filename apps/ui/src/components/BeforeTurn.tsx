import { useState } from 'react';
import type { CheckpointFile, Operation } from '@drishya/contracts';
import { useApp } from '../state.ts';
import { ToolOutput } from './ToolOutput.tsx';
import './before-turn.css';

const size = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const UNAVAILABLE: Record<Exclude<CheckpointFile, { available: true }>['reason'], string> = {
  'not-recorded': 'This recording does not name that checkpoint.',
  removed: 'Claude Code no longer keeps this backup; its retention removed it.',
  'needs-workspace-approval': 'Allow workspace reading for this session to open checkpoint backups.',
  protected: 'This is a protected file, so its backup is never shown.',
};

/** DATA-5: the file as Claude Code checkpointed it when this turn began. Read only on request. */
export function BeforeTurnPanel({ op }: { op: Operation }) {
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const [file, setFile] = useState<CheckpointFile | 'loading' | 'failed'>();
  const before = op.detail.kind === 'edit' ? op.detail.beforeTurn : undefined;
  if (!before) return null;
  if ('absent' in before) return <div className="before-turn"><div className="before-turn-line">Claude Code’s checkpoint: this file did not exist when this turn began.</div></div>;
  const canRead = !!source?.checkpoint && !!recordingId && !recordingId.includes('+');
  const read = async () => {
    setFile('loading');
    try { setFile(await source!.checkpoint!(recordingId!, before.backup)); } catch { setFile('failed'); }
  };
  return <div className="before-turn">
    <div className="before-turn-line">
      Claude Code kept a checkpoint of this file from when this turn began.
      {canRead && file === undefined && <button type="button" className="before-turn-read" onClick={(e) => { e.stopPropagation(); void read(); }}>Show file before this turn</button>}
    </div>
    {file === 'loading' && <div className="before-turn-line">Reading the checkpoint…</div>}
    {file === 'failed' && <div className="before-turn-line">The checkpoint could not be read.</div>}
    {file && typeof file === 'object' && (file.available
      ? <div className="before-turn-file">
          <div className="material-context">Before this turn · {size(file.bytes)}{file.redacted ? ' · secrets redacted' : ''}{file.truncated ? ' · first 4 MB' : ''} · read now from Claude Code’s checkpoint, not part of the recording</div>
          <ToolOutput text={file.text} inspect={false} />
        </div>
      : <div className="before-turn-line">{UNAVAILABLE[file.reason]}</div>)}
  </div>;
}
