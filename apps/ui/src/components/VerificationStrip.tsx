import type { TestSummary } from '@drishya/contracts';

/** Grouped, parsed outcomes; neither execution order nor individual identities are inferred. */
export function VerificationStrip({ summary, onFailure }: { summary: TestSummary; onFailure: () => void }) {
  const groups = [{ state: 'passed', count: summary.passed }, { state: 'failed', count: summary.failed }, { state: 'skipped', count: summary.skipped }];
  const total = groups.reduce((n, group) => n + group.count, 0);
  if (!total) return <span className="muted">No test outcomes reported</span>;
  return <div className="verification-strip" title="Counts parsed from captured output, grouped by status; not execution order">
    <div className="verification-track" aria-hidden="true">
      {groups.filter((group) => group.count > 0).map((group) => <span key={group.state} className={`verification-group ${group.state}`} style={{ flex: group.count }}>
        {total <= 60 ? Array.from({ length: group.count }, (_, i) => <i key={i} />) : <i className="aggregate" />}
      </span>)}
    </div>
    <div className="verification-caption">
      <span className="good">{summary.passed} passed</span>
      {summary.failed > 0 && <button className="bad" onClick={(e) => { e.stopPropagation(); onFailure(); }}>{summary.failed} failed · inspect assertions</button>}
      {summary.skipped > 0 && <span className="muted">{summary.skipped} skipped</span>}
    </div>
    <span className="verification-basis">Parsed from captured output</span>
  </div>;
}
