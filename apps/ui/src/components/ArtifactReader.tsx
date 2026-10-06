import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Hunk } from '@drishya/contracts';
import { CodeView, DiffView, Output, ProvenanceBadge, useArtifact } from './common.tsx';
import { ChangeColumns } from './ChangeColumns.tsx';
import { useReadingReference } from './ReadingReference.tsx';

/** One bounded page at a time; the daemon's historical slice is never replaced with today's file. */
export function ArtifactReader({ id, kind, path, startLine = 1, fallback, provenance = false }: {
  id?: string;
  kind: 'code' | 'output';
  path?: string;
  startLine?: number;
  fallback?: string;
  provenance?: boolean;
}) {
  const [pages, setPages] = useState([0]);
  const [index, setIndex] = useState(0);
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState<string>();
  const [query, setQuery] = useState('');
  const [activeLine, setActiveLine] = useState<number>();
  const [lineInput, setLineInput] = useState('');
  const [lineError, setLineError] = useState<string>();
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [rangeStatus, setRangeStatus] = useState('');
  const reference = useReadingReference();
  const reader = useRef<HTMLDivElement>(null);
  useEffect(() => { setPages([0]); setIndex(0); setQuery(''); setActiveLine(undefined); setLineInput(''); setLineError(undefined); }, [id]);
  const pageStart = pages[index] ?? 0;
  useEffect(() => { setRangeFrom(''); setRangeTo(''); setRangeStatus(''); }, [id, pageStart]);
  const view = useArtifact(id, { scope: 'reader', start: pageStart, count: 200, retry });
  useEffect(() => setCopied(undefined), [id, pageStart]);
  const reveal = (line: number) => reader.current?.querySelector<HTMLElement>(`[data-source-line="${line}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  useLayoutEffect(() => { if (activeLine !== undefined && view.text !== undefined) reveal(activeLine); }, [activeLine, pageStart, view.text]);
  if (!id) return fallback ? <Output text={fallback} /> : <p className="muted">Not captured.</p>;
  if (view.error) return <div className="muted">Could not load captured content. <button className="btn" onClick={() => setRetry((n) => n + 1)}>Retry</button></div>;
  if (view.unavailable) return <p className="muted">{view.unavailable}{fallback ? <> Available preview: <Output text={fallback} /></> : null}</p>;
  const loading = view.text === undefined;
  const text = view.text ?? '';
  const next = view.hasMore && view.nextStart !== undefined && view.nextStart > pageStart;
  const pageLabel = loading ? 'Opening stored page' : view.artifact?.provenance.kind === 'derived' ? 'Derived page' : view.artifact?.provenance.kind === 'generated' ? 'Generated page' : 'Captured page';
  const sourceStart = (view.artifact?.range?.start ?? startLine) + pageStart;
  const sourceBase = view.artifact?.range?.start ?? startLine;
  const sourceEnd = view.totalLines === undefined ? undefined : Math.min(sourceBase + view.totalLines - 1, view.artifact?.range?.end ?? Infinity);
  const sourceLines = text ? text.replace(/\n$/, '').split('\n') : [];
  const loadedEnd = Math.min(sourceStart + sourceLines.length - 1, sourceEnd ?? Infinity);
  const selectedRange = () => {
    const from = rangeFrom ? Number(rangeFrom) : sourceStart;
    const to = rangeTo ? Number(rangeTo) : loadedEnd;
    if ((rangeFrom && !/^\d+$/.test(rangeFrom)) || (rangeTo && !/^\d+$/.test(rangeTo)) || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < sourceStart || to > loadedEnd || to < from) {
      setRangeStatus(`Loaded page only · choose lines ${sourceStart}–${loadedEnd} in order`);
      return;
    }
    return { start: from, end: to, text: sourceLines.slice(from - sourceStart, to - sourceStart + 1).join('\n') };
  };
  const copyRange = async () => {
    const range = selectedRange();
    if (!range) return;
    try { await navigator.clipboard.writeText(range.text); setRangeStatus(`Copied source lines ${range.start}–${range.end}`); }
    catch { setRangeStatus('Copy unavailable · select source text to copy'); }
  };
  // Search only the bounded page already in memory, never today's file or other moments.
  const matchingLines = new Set<number>();
  const needle = query.toLowerCase();
  if (kind === 'code' && query) text.replace(/\n$/, '').split('\n').forEach((line, offset) => {
    if (line.toLowerCase().includes(needle)) matchingLines.add(sourceStart + offset);
  });
  const matches = [...matchingLines];
  const moveMatch = (direction: 1 | -1) => {
    if (!matches.length) return;
    const current = matches.indexOf(activeLine ?? -1);
    const line = matches[current < 0 ? direction === 1 ? 0 : matches.length - 1 : (current + direction + matches.length) % matches.length]!;
    setActiveLine(line);
    reveal(line);
  };
  const goToLine = () => {
    const line = Number(lineInput);
    if (!/^\d+$/.test(lineInput) || !Number.isSafeInteger(line) || sourceEnd === undefined || line < sourceBase || line > sourceEnd) {
      setLineError(sourceEnd !== undefined && sourceEnd >= sourceBase ? `Stored source only · enter line ${sourceBase}–${sourceEnd}` : 'No stored source lines available');
      return;
    }
    setLineError(undefined);
    setActiveLine(line);
    const offset = line - sourceBase;
    if (offset < pageStart || offset >= (view.nextStart ?? pageStart)) { setPages([offset]); setIndex(0); }
    else reveal(line);
  };
  return (
    <div className="artifact-reader" ref={reader}>
      {provenance && <div className="snapshot-provenance"><ProvenanceBadge artifact={view.artifact} /><span className="muted small">{view.artifact?.range ? `${view.artifact.kind === 'excerpt' ? 'Excerpt' : 'Historical source'} · lines ${view.artifact.range.start}–${view.artifact.range.end}` : 'Historical artifact'}</span></div>}
      <div className="reader-tools"><span className="material-context">{pageLabel}{view.nextStart !== undefined ? ` · ${view.nextStart - pageStart} lines` : ''}</span><button className="btn ghost small" disabled={loading} onClick={() => { void navigator.clipboard.writeText(text).then(() => setCopied(`Copied ${pageLabel.toLowerCase()}`), () => setCopied('Copy unavailable · select text to copy')); }}>Copy {pageLabel.toLowerCase()}</button><span role="status" className="muted small">{copied}</span></div>
      {kind === 'code' && <div className="source-find">
        <input type="search" aria-label="Find in loaded source page" placeholder="Find in this page" maxLength={200} value={query} onChange={(e) => { setQuery(e.target.value); setActiveLine(undefined); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); moveMatch(e.shiftKey ? -1 : 1); } }} />
        <button className="btn ghost small" disabled={!matches.length} onClick={() => moveMatch(-1)}>Previous match</button>
        <button className="btn ghost small" disabled={!matches.length} onClick={() => moveMatch(1)}>Next match</button>
        <span className="muted small" role="status">{loading ? 'Opening stored source page…' : query ? `${matchingLines.size} matching ${matchingLines.size === 1 ? 'line' : 'lines'} in this page${matches.includes(activeLine ?? -1) ? ` · ${matches.indexOf(activeLine!) + 1} of ${matches.length}` : ''}` : text ? `Source lines ${sourceStart}–${sourceStart + text.replace(/\n$/, '').split('\n').length - 1} · loaded page only` : 'Empty source page'}</span>
      </div>}
      {kind === 'code' && <details className="source-utilities">
        <summary>Source tools · go to line, copy & pin range</summary>
      <form className="source-go" onSubmit={(e) => { e.preventDefault(); goToLine(); }}>
        <input inputMode="numeric" aria-label="Go to stored source line" placeholder="Source line" maxLength={16} value={lineInput} onChange={(e) => { setLineInput(e.target.value); setLineError(undefined); }} aria-invalid={!!lineError} />
        <button className="btn ghost small" disabled={!view.totalLines}>Go to line</button>
        <span className="muted small" role="status">{lineError ?? (sourceEnd !== undefined && sourceEnd >= sourceBase ? `Stored range ${sourceBase}–${sourceEnd}` : 'No stored source lines')}</span>
      </form>
      {kind === 'code' && !loading && sourceLines.length > 0 && <div className="source-range" role="group" aria-label="Loaded source range actions">
        <span className="material-context">Range</span>
        <input inputMode="numeric" aria-label="Source range start" placeholder={String(sourceStart)} maxLength={16} value={rangeFrom} onChange={(e) => { setRangeFrom(e.target.value); setRangeStatus(''); }} />
        <span className="muted">–</span>
        <input inputMode="numeric" aria-label="Source range end" placeholder={String(loadedEnd)} maxLength={16} value={rangeTo} onChange={(e) => { setRangeTo(e.target.value); setRangeStatus(''); }} />
        <button className="btn ghost small" onClick={() => { void copyRange(); }}>Copy range</button>
        {reference && view.artifact && <button className="btn ghost small" onClick={() => {
          const range = selectedRange();
          if (!range || !view.artifact) return;
          if (range.text.length * 2 > 64 * 1024) { setRangeStatus('Reference limit · choose a smaller range (64 KiB of text)'); return; }
          reference.pin({ ...range, path: view.artifact.path ?? path, artifact: view.artifact, note: range.end === loadedEnd && view.partial?.includes('cut at the response size limit') ? 'Response size limit · the final shown line may be incomplete.' : undefined });
          setRangeStatus(`Pinned source lines ${range.start}–${range.end} · replaces the previous reference`);
        }}>Pin range</button>}
        <span className="muted small" role="status">{rangeStatus || 'Loaded page only · one temporary reference'}</span>
      </div>}
      </details>}
      {loading ? <div className="skeleton tall" /> : kind === 'code' ? <CodeView text={text} startLine={sourceStart} path={path} highlightLines={matchingLines} activeLine={activeLine} /> : <Output text={text} />}
      {view.partial && <div className="muted small reader-range">{view.partial}</div>}
      {(pageStart > 0 || next) && (
        <nav className="reader-pages" aria-label="Captured content pages">
          <button className="btn" disabled={pageStart === 0} onClick={() => { setActiveLine(undefined); if (index > 0) setIndex(index - 1); else { setPages([Math.max(0, pageStart - 200)]); setIndex(0); } }}>Previous lines</button>
          <button className="btn" disabled={!next} onClick={() => {
            if (!next) return;
            setActiveLine(undefined);
            if (pages[index + 1] !== view.nextStart) {
              const retained = pages.slice(0, index + 1).slice(-63);
              setPages([...retained, view.nextStart!]); setIndex(retained.length);
            } else setIndex(index + 1);
          }}>Next lines</button>
        </nav>
      )}
    </div>
  );
}

export function DiffReader({ hunks, path }: { hunks: Hunk[]; path?: string }) {
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState<'auto' | 'unified' | 'split'>('auto');
  const total = hunks.reduce((n, h) => n + h.lines.length, 0);
  const pageSize = 120;
  return <div className={`artifact-reader diff-reader diff-${layout}`}>
    <div className="reader-tools" aria-label="Change layout">{(['auto', 'unified', 'split'] as const).map((mode) => <button key={mode} className="btn ghost small" aria-pressed={layout === mode} onClick={() => setLayout(mode)}>{mode === 'auto' ? 'Adaptive' : mode === 'split' ? 'Side by side' : 'Unified'}</button>)}</div>
    <div className="unified-change"><DiffView hunks={hunks} path={path} skipLines={page * pageSize} maxLines={pageSize} /></div>
    <div className="split-change"><ChangeColumns hunks={hunks} path={path} skipLines={page * pageSize} maxLines={pageSize} /></div>
    {total > pageSize && <nav className="reader-pages" aria-label="Captured change pages">
      <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous change lines</button>
      <span className="muted small">{page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} of {total} captured lines</span>
      <button className="btn" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(page + 1)}>Next change lines</button>
    </nav>}
  </div>;
}
