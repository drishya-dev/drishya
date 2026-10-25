import type { WebResult } from '@drishya/contracts';
import './web-results.css';

// Offline bundles need the same click-only HTTP(S) boundary as reduced native results.
const navigable = (value: string): boolean => {
  if (!/^https?:\/\//i.test(value)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; }
  catch { return false; }
};

/** Recorded search results as a reading list. Links open only when clicked; nothing is fetched to show them. */
export function WebResults({ results, limit, snippets = false }: { results: WebResult[]; limit?: number; snippets?: boolean }) {
  const shown = limit ? results.slice(0, limit) : results;
  return <div className={`web-results${snippets ? ' web-results-full' : ''}`}>
    <ol>{shown.map((result, i) => <li key={`${i}:${result.url}`}>
      {navigable(result.url) ? <a href={result.url} target="_blank" rel="noopener noreferrer" title={result.url} onClick={(event) => event.stopPropagation()}>
        <span className="web-domain">{result.domain}</span>
        <span className="web-title">{result.title ?? result.url}</span>
      </a> : <div className="web-reference">
        <span className="web-title">{result.title ?? result.url}</span>
        {result.title && <span className="web-snippet">{result.url}</span>}
      </div>}
      {snippets && result.snippet && <p className="web-snippet">{result.snippet}</p>}
    </li>)}</ol>
    {limit && results.length > limit && <small className="web-more">{results.length - limit} more results</small>}
  </div>;
}
