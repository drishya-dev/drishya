import { useState } from 'react';
import type { Operation, PersistedOutput } from '@drishya/contracts';
import { useApp } from '../state.ts';
import { ToolOutput } from './ToolOutput.tsx';
import './command-run.css';

const size = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const duration = (ms: number) => ms < 1000 ? `${ms} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60_000)} min`;

/** A page fetch as the harness recorded it: status, size, time. */
export function fetchFacts(fetch: { status?: number; statusText?: string; bytes?: number; durationMs?: number }) {
  return [fetch.status !== undefined ? `${fetch.status}${fetch.statusText ? ` ${fetch.statusText}` : ''}` : undefined, fetch.bytes !== undefined ? size(fetch.bytes) : undefined, fetch.durationMs !== undefined ? duration(fetch.durationMs) : undefined].filter(Boolean).join(' · ');
}

const UNAVAILABLE: Record<Exclude<PersistedOutput, { available: true }>['reason'], string> = {
  'not-recorded': 'The saved output is not referenced by this recording.',
  removed: 'Claude Code no longer keeps this file; its retention removed it.',
  'outside-harness-folder': 'The recorded path is outside Claude Code’s own folder for this project, so it is not opened.',
  protected: 'This command touched a protected file, so its output is never shown.',
};

/** DATA-4: what the harness recorded about how a command ran. Each line only when recorded. */
export function CommandRunNotes({ op }: { op: Operation }) {
  const run = op.run ?? {};
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const [saved, setSaved] = useState<PersistedOutput | 'loading' | 'failed'>();
  const notes = [
    run.interrupted ? 'Interrupted before it finished' : undefined,
    run.backgroundTaskId ? (run.timedOutAfterMs ? `Moved to the background after ${duration(run.timedOutAfterMs)}` : 'Ran in the background') : undefined,
    run.exitNote ? `Harness note on the exit: ${run.exitNote}` : undefined,
  ].filter((note): note is string => !!note);
  const spilled = run.persistedOutput;
  const canRead = !!spilled && !!source?.persistedOutput && !!recordingId && !recordingId.includes('+');
  if (!notes.length && !spilled) return null;
  const read = async () => {
    if (!canRead) return;
    setSaved('loading');
    try { setSaved(await source!.persistedOutput!(recordingId!, op.id)); } catch { setSaved('failed'); }
  };
  return <div className="command-run">
    {notes.map((note) => <div key={note} className="command-run-note">{note}</div>)}
    {spilled && <div className="command-run-note">
      Full output saved by Claude Code{spilled.bytes !== undefined ? ` (${size(spilled.bytes)})` : ''}; the journal keeps only part of it.
      {canRead && saved === undefined && <button type="button" className="command-run-read" onClick={(e) => { e.stopPropagation(); void read(); }}>Read full output</button>}
    </div>}
    {saved === 'loading' && <div className="command-run-note">Reading the saved file…</div>}
    {saved === 'failed' && <div className="command-run-note">The saved file could not be read.</div>}
    {saved && typeof saved === 'object' && (saved.available
      ? <div className="command-run-full">
          <div className="material-context">Saved output · {size(saved.bytes)}{saved.redacted ? ' · secrets redacted' : ''}{saved.truncated ? ' · first 4 MB' : ''} · read now from Claude Code’s file, not part of the recording</div>
          <ToolOutput text={saved.text} inspect={false} />
        </div>
      : <div className="command-run-note">{UNAVAILABLE[saved.reason]}</div>)}
  </div>;
}
