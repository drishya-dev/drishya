import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Hunk } from '@drishya/contracts';
import { CodeView, DiffView, ProvenanceBadge, useArtifact } from './common.tsx';
import { ToolOutput } from './ToolOutput.tsx';
import { ChangeColumns } from './ChangeColumns.tsx';
import { useReadingReference } from './ReadingReference.tsx';
import { SourceFind } from './SourceFind.tsx';
import { firstChangeOffset } from '../lib/change-preview.ts';
import { useEvidenceState, useEvidenceScroll } from './EvidenceNavigation.tsx';
import { useApp } from '../state.ts';

/** One bounded page at a time; the daemon's historical slice is never replaced with today's file. */
export function ArtifactReader({ id, kind, path, startLine = 1, fallback, provenance = false, navigationSlot = 'source', requestedLine }: {
  id?: string;
  kind: 'code' | 'output';
  path?: string;
  startLine?: number;
  fallback?: string;
  provenance?: boolean;
  navigationSlot?: string;
  requestedLine?: number;
}) {
  const scope = `${navigationSlot}/artifact/${id}`;
  const [pages, setPages] = useEvidenceState(`${scope}/pages`, [0]);
  const [index, setIndex] = useEvidenceState(`${scope}/index`, 0);
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState<string>();
  const [query, setQuery] = useEvidenceState(`${scope}/query`, '');
  const [wrap, setWrap] = useEvidenceState(`${scope}/wrap`, false);
  const [activeLine, setActiveLine] = useEvidenceState<number | undefined>(`${scope}/line`, undefined);
  const [lineInput, setLineInput] = useEvidenceState(`${scope}/lineInput`, '');
  const [lineError, setLineError] = useState<string>();
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [rangeStatus, setRangeStatus] = useState('');
  const source = useApp(s => s.source), recordingId = useApp(s => s.recordingId);
  const [finding, setFinding] = useState(false), [findStatus, setFindStatus] = useState('');
  const scan = useRef<{ identity: string; matches: number[]; cursor?: string; started: boolean; finished: boolean; skipped: number }>({ identity: '', matches: [], started: false, finished: false, skipped: 0 });
  const searchIdentity = JSON.stringify([recordingId, id, query]);
  const latestSearch = useRef(searchIdentity); latestSearch.current = searchIdentity;
  useEffect(() => {
    scan.current = { identity: searchIdentity, matches: [], started: false, finished: false, skipped: 0 };
    setFinding(false); setFindStatus('');
  }, [searchIdentity, source]);
  const reference = useReadingReference();
  const reader = useRef<HTMLDivElement>(null);
  const sourceViewport = useRef<HTMLDivElement>(null);
  const pageStart = pages[index] ?? 0;
  useEffect(() => { setRangeFrom(''); setRangeTo(''); setRangeStatus(''); }, [id, pageStart]);
  const view = useArtifact(id, { scope: 'reader', start: pageStart, count: 200, retry });
  const followedReference = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (kind !== 'code' || requestedLine === undefined || !id || view.totalLines === undefined) return;
    const reference = `${id}/${requestedLine}`;
    if (followedReference.current === reference) return;
    followedReference.current = reference;
    const base = view.artifact?.range?.start ?? startLine;
    const end = Math.min(base + view.totalLines - 1, view.artifact?.range?.end ?? Infinity);
    setLineInput(String(requestedLine));
    if (requestedLine < base || requestedLine > end) {
      setLineError(`Referenced line ${requestedLine} is outside this stored range (${base}–${end}).`);
      return;
    }
    setLineError(undefined); setActiveLine(requestedLine);
    const offset = requestedLine - base;
    if (offset < pageStart || offset >= (view.nextStart ?? pageStart)) { setPages([offset]); setIndex(0); }
  }, [requestedLine, id, kind, startLine, view.totalLines, view.artifact, pageStart, view.nextStart]);
  useEvidenceScroll(reader, `${scope}/${pageStart}`, view.text !== undefined);
  useEvidenceScroll(sourceViewport, `${scope}/${pageStart}/content`, view.text !== undefined);
  useEffect(() => setCopied(undefined), [id, pageStart]);
  const reveal = (line: number) => reader.current?.querySelector<HTMLElement>(`[data-source-line="${line}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  useLayoutEffect(() => { if (activeLine !== undefined && view.text !== undefined) reveal(activeLine); }, [activeLine, pageStart, view.text]);
  if (!id) return fallback ? <ToolOutput text={fallback} /> : <p className="muted">Not captured.</p>;
  if (view.error) return <div className="muted">Could not load captured content. <button className="btn" onClick={() => setRetry((n) => n + 1)}>Retry</button></div>;
  if (view.unavailable) return <p className="muted">{view.unavailable}{fallback ? <> Available preview: <ToolOutput text={fallback} /></> : null}</p>;
  const loading = view.text === undefined;
  const text = view.text ?? '';
  const next = view.hasMore && view.nextStart !== undefined && view.nextStart > pageStart;
  const pageLabel = loading ? 'Opening stored page' : view.artifact?.provenance.kind === 'derived' ? 'Derived page' : view.artifact?.provenance.kind === 'generated' ? 'Generated page' : 'Captured page';
  const sourceStart = (view.artifact?.range?.start ?? startLine) + pageStart;
  const sourceBase = view.artifact?.range?.start ?? startLine;
  const findStored = async () => {
    const find = source?.artifactFind;
    if (!source || !find || !recordingId || !query || finding) return;
    const identity = searchIdentity, selectedSource = source;
    const state = scan.current;
    const choose = () => {
      const offset = state.matches.shift();
      if (offset === undefined) return false;
      const line = sourceBase + offset;
      setActiveLine(line); setPages([offset]); setIndex(0);
      setFindStatus(`Stored match · source line ${line}${state.skipped ? ` · ${state.skipped} oversized lines not searched` : ''}`);
      return true;
    };
    if (choose()) return;
    if (state.finished) { setFindStatus(`End of stored search${state.skipped ? ` · ${state.skipped} oversized lines not searched` : ''}`); return; }
    setFinding(true);
    try {
      // Yield between worker batches; a click never starts an unbounded scan or
      // blocks capture. Most ordinary source searches finish within three batches.
      for (let batch = 0; batch < 3; batch++) {
        const result = await find.call(selectedSource, recordingId, id, query, state.started ? 0 : pageStart, state.cursor);
        if (latestSearch.current !== identity || useApp.getState().source !== selectedSource) return;
        if (!result.available) { state.started = false; state.cursor = undefined; setFindStatus(result.reason === 'continuation-expired' ? 'Search expired · start again' : 'Stored content unavailable for search'); return; }
        state.matches = result.matches; state.cursor = result.continuation; state.started = true; state.finished = !result.continuation; state.skipped += result.skippedLines;
        if (choose()) return;
        if (state.finished) break;
      }
      setFindStatus(state.finished ? `No more stored matches${state.skipped ? ` · ${state.skipped} oversized lines not searched` : ''}` : 'No match in this scan · continue through stored content');
    } catch { if (latestSearch.current === identity && useApp.getState().source === selectedSource) { state.started = false; state.cursor = undefined; setFindStatus('Stored search failed · retry'); } }
    finally { if (latestSearch.current === identity && useApp.getState().source === selectedSource) setFinding(false); }
  };
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
    <div className={`artifact-reader${kind === 'code' ? ` source-reading${wrap ? ' wrap-source' : ''}` : ''}`} ref={reader}>
      {provenance && <div className="snapshot-provenance"><ProvenanceBadge artifact={view.artifact} /><span className="muted small">{view.artifact?.range ? `${view.artifact.kind === 'excerpt' ? 'Excerpt' : 'Historical source'} · lines ${view.artifact.range.start}–${view.artifact.range.end}` : 'Historical artifact'}</span></div>}
      <div className="reader-tools"><span className="material-context">{pageLabel}{view.nextStart !== undefined ? ` · ${view.nextStart - pageStart} lines` : ''}</span>{kind === 'code' && <button className="btn ghost small" aria-pressed={wrap} onClick={() => setWrap(!wrap)}>Wrap lines</button>}<button className="btn ghost small" disabled={loading} onClick={() => { void navigator.clipboard.writeText(text).then(() => setCopied(`Copied ${pageLabel.toLowerCase()}`), () => setCopied('Copy unavailable · select text to copy')); }}>Copy {pageLabel.toLowerCase()}</button><span role="status" className="muted small">{copied}</span></div>
      {kind === 'code' && <SourceFind query={query} change={q => { setQuery(q); setActiveLine(undefined); }} matches={matches} activeLine={activeLine} move={moveMatch} label="Find in loaded source page" idleLabel={loading ? 'Opening stored source page…' : text ? `Source lines ${sourceStart}–${sourceStart + text.replace(/\n$/, '').split('\n').length - 1} · loaded page only` : 'Empty source page'} />}
      {kind === 'code' && source?.artifactFind && query && <div className="stored-source-find"><button className="btn ghost small" disabled={finding || loading} onClick={() => void findStored()}>{finding ? 'Searching stored content…' : 'Find next stored match'}</button><span className="muted small" role="status">{findStatus || 'Literal search from this page through the stored artifact'}</span></div>}
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
      {loading ? <div className="skeleton tall" /> : kind === 'code' ? <CodeView scrollRef={sourceViewport} text={text} startLine={sourceStart} path={path} highlightLines={matchingLines} activeLine={activeLine} /> : <ToolOutput text={text} />}
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

export function DiffReader({ hunks, path, navigationKey = path ?? 'patch', scope = 'captured' }: { hunks: Hunk[]; path?: string; navigationKey?: string; scope?: 'captured' | 'current-git' | 'git-commit' | 'source-comparison' | 'local-draft' }) {
  const [offset, setOffset] = useEvidenceState(`diff/${navigationKey}/offset`, () => firstChangeOffset(hunks));
  const [layout, setLayout] = useEvidenceState<'unified' | 'split'>(`diff/${navigationKey}/layout`, 'unified');
  const [query, setQuery] = useEvidenceState(`diff/${navigationKey}/query`, '');
  const [wrap, setWrap] = useEvidenceState(`diff/${navigationKey}/wrap`, false);
  const [active, setActive] = useEvidenceState<number | undefined>(`diff/${navigationKey}/match`, undefined);
  const lines = useMemo(() => hunks.flatMap(h => h.lines), [hunks]);
  const matches = useMemo(() => query ? lines.flatMap((line, n) => line.slice(1).toLowerCase().includes(query.toLowerCase()) ? [n] : []) : [], [lines, query]);
  const starts = useMemo(() => { let n = 0; return hunks.map(h => { const start = n; n += h.lines.length; return start; }); }, [hunks]);
  const move = (direction: 1 | -1) => {
    if (!matches.length) return;
    const current = matches.indexOf(active ?? -1);
    const next = matches[current < 0 ? direction === 1 ? 0 : matches.length - 1 : (current + direction + matches.length) % matches.length]!;
    setActive(next); setOffset(next);
  };
  const reader = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  useEvidenceScroll(reader, `diff/${navigationKey}/${offset}`);
  useEvidenceScroll(viewport, `diff/${navigationKey}/${offset}/content`);
  const total = hunks.reduce((n, h) => n + h.lines.length, 0);
  const pageSize = 120;
  return <div ref={reader} className={`artifact-reader diff-reader diff-${layout}${wrap ? ' reader-wrap' : ''}`}>
    <div className="reader-tools" aria-label="Change layout"><button className="btn ghost small" aria-pressed={layout === 'unified'} onClick={() => setLayout('unified')}>Changes</button><button className="btn ghost small" aria-pressed={layout === 'split'} onClick={() => setLayout('split')}>Side by side</button><button className="btn ghost small" aria-pressed={wrap} onClick={() => setWrap(value => !value)}>Wrap lines</button>
      <label className="patch-hunk-jump">Hunk <input type="number" aria-label="Jump to patch hunk" min={1} max={hunks.length} value={Math.max(0, starts.findLastIndex(start => start <= offset)) + 1} onChange={e => { const index = Number(e.target.value) - 1; if (Number.isInteger(index) && index >= 0 && index < starts.length) { setOffset(starts[index]!); setActive(undefined); } }} /> of {hunks.length}</label>
    </div>
    <SourceFind query={query} change={value => { setQuery(value); setActive(undefined); }} matches={matches} activeLine={active} move={move} label="Find in patch" idleLabel="Whole loaded patch" scopeLabel="this patch" />
    {offset > 0 && <div className="material-context">Focused on changed lines · earlier patch context available below</div>}
    <div ref={viewport} className="diff-scroll" tabIndex={0} role="region" aria-label="Patch content">
      <div className="unified-change"><DiffView hunks={hunks} path={path} skipLines={offset} maxLines={pageSize} activeOffset={active} showRemaining={false} /></div>
      <div className="split-change"><ChangeColumns hunks={hunks} path={path} skipLines={offset} maxLines={pageSize} scope={scope} /></div>
    </div>
    {(offset > 0 || total > pageSize) && <nav className="reader-pages" aria-label={scope === 'captured' ? 'Captured change pages' : scope === 'local-draft' ? 'Local draft change pages' : scope === 'source-comparison' ? 'Source comparison' : scope === 'git-commit' ? 'Commit change pages' : 'Current Git change pages'}>
      <button className="btn" disabled={offset === 0} onClick={() => setOffset(n => Math.max(0, n - pageSize))}>Previous change lines</button>
      <span className="muted small">{offset + 1}–{Math.min(total, offset + pageSize)} of {total} patch lines</span>
      <button className="btn" disabled={offset + pageSize >= total} onClick={() => setOffset(n => n + pageSize)}>Next change lines</button>
    </nav>}
  </div>;
}
