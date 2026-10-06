import { useEffect, useState } from 'react';
import type { Hunk } from '@drishya/contracts';
import { CodeView, DiffView, Output, ProvenanceBadge, useArtifact } from './common.tsx';
import { ChangeColumns } from './ChangeColumns.tsx';

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
  useEffect(() => { setPages([0]); setIndex(0); setQuery(''); }, [id]);
  const pageStart = pages[index] ?? 0;
  const view = useArtifact(id, { scope: 'reader', start: pageStart, count: 200, retry });
  useEffect(() => setCopied(undefined), [id, pageStart]);
  if (!id) return fallback ? <Output text={fallback} /> : <p className="muted">Not captured.</p>;
  if (view.error) return <div className="muted">Could not load captured content. <button className="btn" onClick={() => setRetry((n) => n + 1)}>Retry</button></div>;
  if (view.unavailable) return <p className="muted">{view.unavailable}{fallback ? <> Available preview: <Output text={fallback} /></> : null}</p>;
  if (view.text === undefined) return <div className="skeleton tall" />;
  const next = view.hasMore && view.nextStart !== undefined && view.nextStart > pageStart;
  const pageLabel = view.artifact?.provenance.kind === 'derived' ? 'Derived page' : view.artifact?.provenance.kind === 'generated' ? 'Generated page' : 'Captured page';
  const sourceStart = (view.artifact?.range?.start ?? startLine) + pageStart;
  // Search only the bounded page already in memory, never today's file or other moments.
  const matchingLines = new Set<number>();
  const needle = query.toLowerCase();
  if (kind === 'code' && query) view.text.replace(/\n$/, '').split('\n').forEach((line, offset) => {
    if (line.toLowerCase().includes(needle)) matchingLines.add(sourceStart + offset);
  });
  return (
    <div className="artifact-reader">
      {provenance && <div className="snapshot-provenance"><ProvenanceBadge artifact={view.artifact} /><span className="muted small">{view.artifact?.range ? `${view.artifact.kind === 'excerpt' ? 'Excerpt' : 'Historical source'} · lines ${view.artifact.range.start}–${view.artifact.range.end}` : 'Historical artifact'}</span></div>}
      <div className="reader-tools"><span className="material-context">{pageLabel}{view.nextStart !== undefined ? ` · ${view.nextStart - pageStart} lines` : ''}</span><button className="btn ghost small" onClick={() => { void navigator.clipboard.writeText(view.text!).then(() => setCopied(`Copied ${pageLabel.toLowerCase()}`), () => setCopied('Copy unavailable · select text to copy')); }}>Copy {pageLabel.toLowerCase()}</button><span role="status" className="muted small">{copied}</span></div>
      {kind === 'code' && <div className="source-find">
        <input type="search" aria-label="Find in loaded source page" placeholder="Find in this page" maxLength={200} value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="muted small" role="status">{query ? `${matchingLines.size} matching ${matchingLines.size === 1 ? 'line' : 'lines'} in this page` : `Source lines ${sourceStart}–${sourceStart + view.text.replace(/\n$/, '').split('\n').length - 1} · loaded page only`}</span>
      </div>}
      {kind === 'code' ? <CodeView text={view.text} startLine={sourceStart} path={path} highlightLines={matchingLines} /> : <Output text={view.text} />}
      {view.partial && <div className="muted small reader-range">{view.partial}</div>}
      {(index > 0 || next) && (
        <nav className="reader-pages" aria-label="Captured content pages">
          <button className="btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous lines</button>
          <button className="btn" disabled={!next} onClick={() => {
            if (!next) return;
            if (pages[index + 1] !== view.nextStart) setPages([...pages.slice(0, index + 1), view.nextStart!]);
            setIndex(index + 1);
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
