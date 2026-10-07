import type { TestSummary } from '@drishya/contracts';
import { testTiles } from '../lib/test-tiles.ts';

/** Grouped, parsed outcomes; neither execution order nor individual identities are inferred. */
export function VerificationStrip({ summary, output, onFailure }: { summary: TestSummary; output?: string; onFailure: () => void }) {
  const groups = [{ state: 'passed', count: summary.passed }, { state: 'failed', count: summary.failed }, { state: 'skipped', count: summary.skipped }];
  const total = groups.reduce((n, group) => n + group.count, 0);
  if (!total) return <span className="muted">No test outcomes reported</span>;
  const { tiles, ordered, remaining } = testTiles(summary, output);
  return <div className="verification-strip" title={ordered ? 'Numbered outcomes parsed from captured TAP output' : 'Counts parsed from captured output, grouped by status; not execution order'}>
    <div className="verification-track">
      {tiles.map((tile, i) => <span key={i} className={`verification-tile ${tile.state}`} title={tile.index ? `Test ${tile.index} · ${tile.state} · ${tile.name}` : `${tile.state} · grouped count, runner index unavailable`} aria-label={tile.index ? `Test ${tile.index}: ${tile.state}` : undefined}>{tile.index ?? ''}</span>)}
    </div>
    {remaining > 0 && <span className="verification-basis">{remaining.toLocaleString()} additional outcomes · counts below</span>}
    <div className="verification-caption">
      <span className="good">{summary.passed} passed</span>
      {summary.failed > 0 && <button className="bad" onClick={(e) => { e.stopPropagation(); onFailure(); }}>{summary.failed} failed · inspect assertions</button>}
      {summary.skipped > 0 && <span className="muted">{summary.skipped} skipped</span>}
    </div>
    <span className="verification-basis">{ordered ? 'Captured TAP indices' : 'Grouped counts · runner indices unavailable'}</span>
  </div>;
}
