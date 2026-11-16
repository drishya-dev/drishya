import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Artifact } from '@drishya/contracts';
import { useApp } from '../state.ts';
import { CodeView, ProvenanceBadge } from './common.tsx';
import { useReveal } from '../lib/reveal.ts';

export interface SourceReference {
  text: string;
  path?: string;
  start: number;
  end: number;
  artifact: Artifact;
  note?: string;
}

const ReferenceContext = createContext<{ pin(reference: SourceReference): void } | undefined>(undefined);
export const useReadingReference = () => useContext(ReferenceContext);

/** One ephemeral bounded snapshot, independent of history virtualization. Never persisted. */
export function ReadingReferenceProvider({ children }: { children: ReactNode }) {
  const source = useApp((s) => s.source);
  const recordingId = useApp((s) => s.recordingId);
  const mode = useApp((s) => s.mode);
  const cutoff = useApp((s) => s.mode === 'replay' ? s.step : undefined);
  const available = useApp((s) => !!s.projection);
  const [pin, setPin] = useState<{ source: typeof source; recordingId: typeof recordingId; mode: typeof mode; cutoff: typeof cutoff; reference: SourceReference }>();
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const toggle = useRef<HTMLButtonElement>(null);
  const reveal = useReveal<HTMLDivElement>(open);
  const close = useRef<HTMLButtonElement>(null);
  // Check during render as well: no stale reference flashes across a session or replay boundary.
  const reference = available && pin && pin.source === source && pin.recordingId === recordingId && pin.mode === mode && pin.cutoff === cutoff ? pin.reference : undefined;
  useEffect(() => { setPin(undefined); setOpen(false); setCopyStatus(''); }, [source, recordingId, mode, cutoff, available]);
  useLayoutEffect(() => { if (open && reference) close.current?.focus(); }, [open, reference]);
  const minimize = () => { setOpen(false); toggle.current?.focus(); };
  return <ReferenceContext.Provider value={{ pin(reference) {
    // Defense in depth: callers cannot retain an oversized or multi-page reference.
    if (reference.text.length * 2 > 64 * 1024 || reference.end - reference.start + 1 > 200) return;
    setPin({ source, recordingId, mode, cutoff, reference: { ...reference, artifact: structuredClone(reference.artifact) } });
    setOpen(false); setCopyStatus('');

  } }}>
    {children}
    {reference && <aside className={`pinned-reference${open ? ' open' : ''}`} aria-label="Pinned source reference" tabIndex={-1} onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('button, input, a')) e.currentTarget.focus({ preventScroll: true }); }} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' && open) { e.preventDefault(); minimize(); } }}>
      <div className="reference-heading">
        <button className="btn ghost reference-toggle" ref={toggle} aria-expanded={open} aria-controls="pinned-source-content" onClick={() => { setOpen(!open); }}>
          <span className="material-context">Pinned source · {reference.start}–{reference.end}</span>
          <span className="reference-path">{reference.path ?? 'Historical source'}</span>
        </button>
        <button className="btn ghost small" aria-label="Remove pinned source reference" onClick={() => { setPin(undefined); setOpen(false); }}>Remove</button>
      </div>
      {reveal.shown && <div id="pinned-source-content" ref={reveal.ref}>
        <div className="reader-tools"><ProvenanceBadge artifact={reference.artifact} /><span className="muted small">Temporary historical range · not current workspace</span><button className="btn ghost small" ref={close} onClick={minimize}>Minimize reference</button></div>
        {/* CodeView removes one terminator; preserve a selected final blank source line. */}
        <div className="reference-content"><CodeView text={`${reference.text}\n`} startLine={reference.start} path={reference.path} /></div>
        {reference.note && <p className="muted small">{reference.note}</p>}
        <div className="reader-tools"><button className="btn ghost small" onClick={() => { void (async () => {
          try { await navigator.clipboard.writeText(reference.text); setCopyStatus('Copied pinned range'); }
          catch { setCopyStatus('Copy unavailable · select source text to copy'); }
        })(); }}>Copy pinned range</button><span className="muted small" role="status">{copyStatus}</span></div>
      </div>}
    </aside>}
  </ReferenceContext.Provider>;
}
