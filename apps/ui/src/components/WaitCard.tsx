/**
 * UI-48: Wait cards — shaped skeleton placeholders that hold the space of the
 * incoming content so layout shift is 0 when real data arrives.
 *
 * Rules:
 *  - One quiet fade-in on mount; no looping shimmer.
 *  - Reduced motion / low-resource: static, opacity 1, no animation.
 *  - Every colour is a CSS token from tokens.css.
 *  - Container geometry MUST match the incoming element's box exactly.
 */
import { type ReactNode } from 'react';
import './wait-card.css';

// ─── History rows (unloaded passage placeholder) ──────────────────────────────

interface HistoryWaitCardProps {
  /** Minimum height to reserve, matches the measured or estimated passage height */
  minHeight?: number;
}

/** Placeholder for an unloaded passage in the History feed. */
export function HistoryWaitCard({ minHeight = 240 }: HistoryWaitCardProps) {
  return (
    <div
      className="wait-card wait-card-history"
      role="status"
      aria-label="Loading passage"
      aria-busy="true"
      style={{ minHeight }}
    >
      {/* Agent identity line */}
      <div className="wc-row wc-row-narrow">
        <div className="wc-bar wc-bar-sm" />
      </div>
      {/* Tool op rows */}
      <div className="wc-row">
        <div className="wc-bar wc-bar-xs" />
        <div className="wc-bar wc-bar-lg" />
      </div>
      <div className="wc-row">
        <div className="wc-bar wc-bar-xs" />
        <div className="wc-bar wc-bar-md" />
      </div>
      {/* Prose lines */}
      <div className="wc-block wc-block-prose">
        <div className="wc-line" style={{ width: '88%' }} />
        <div className="wc-line" style={{ width: '72%' }} />
        <div className="wc-line" style={{ width: '80%' }} />
        <div className="wc-line" style={{ width: '55%' }} />
      </div>
    </div>
  );
}

// ─── Git graph lanes ───────────────────────────────────────────────────────────

interface GitGraphWaitCardProps {
  /** Number of lane rows to render (default 6) */
  lanes?: number;
}

/** Placeholder for the Git network graph while history is loading. */
export function GitGraphWaitCard({ lanes = 6 }: GitGraphWaitCardProps) {
  return (
    <div
      className="thread-graph network-graph wait-card wait-card-git-graph"
      role="status"
      aria-label="Loading Git graph"
      aria-busy="true"
    >
      <div className="thread-controls" aria-hidden="true">
        <span className="thread-title">
          <div className="wc-bar wc-bar-sm" style={{ width: 140 }} />
        </span>
        <div className="thread-zoom">
          <button type="button" disabled tabIndex={-1}>−</button>
          <output>100%</output>
          <button type="button" disabled tabIndex={-1}>+</button>
          <button type="button" disabled tabIndex={-1}>Fit</button>
        </div>
      </div>
      <div className="thread-viewport network-viewport" style={{ overflow: 'hidden', padding: '8px 12px' }}>
        {Array.from({ length: lanes }, (_, i) => (
          <div key={i} className="wc-git-lane">
            <div className="wc-git-node" />
            <div
              className="wc-bar"
              style={{ width: `${40 + ((i * 23 + 17) % 44)}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── File tree rows ────────────────────────────────────────────────────────────

interface FilesWaitCardProps {
  /** Number of skeleton rows to render (default 8) */
  rows?: number;
}

/** Placeholder for the Files panel tree while the graph is loading. */
export function FilesWaitCard({ rows = 8 }: FilesWaitCardProps) {
  return (
    <div
      className="wait-card wait-card-files"
      role="status"
      aria-label="Loading files"
      aria-busy="true"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="wc-file-row" style={{ paddingLeft: (8 + (i % 3) * 12) }}>
          <div className="wc-file-icon" />
          <div
            className="wc-bar"
            style={{ width: `${50 + ((i * 19 + 11) % 36)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Source reader / peek ──────────────────────────────────────────────────────

interface ReaderWaitCardProps {
  /** Number of line skeletons to render (default 12) */
  lines?: number;
}

/** Placeholder for a source file reader while the file is loading. */
export function ReaderWaitCard({ lines = 12 }: ReaderWaitCardProps) {
  return (
    <div
      className="wait-card wait-card-reader"
      role="status"
      aria-label="Loading source"
      aria-busy="true"
    >
      <div className="wc-reader-gutter" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="wc-reader-lineno" />
        ))}
      </div>
      <div className="wc-reader-code" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="wc-line wc-line-mono"
            style={{ width: `${40 + ((i * 17 + 23) % 46)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Home session list ────────────────────────────────────────────────────────

interface HomeWaitCardProps {
  /** Number of session row skeletons to render (default 5) */
  rows?: number;
}

/** Placeholder for the Home session list while sessions are loading. */
export function HomeWaitCard({ rows = 5 }: HomeWaitCardProps) {
  return (
    <div
      className="wait-card wait-card-home"
      role="status"
      aria-label="Loading sessions"
      aria-busy="true"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="wc-home-row">
          <div className="wc-home-icon" />
          <div className="wc-home-text">
            <div className="wc-bar" style={{ width: `${55 + ((i * 21 + 13) % 32)}%` }} />
            <div className="wc-bar wc-bar-xs" style={{ width: `${30 + ((i * 11 + 7) % 28)}%` }} />
          </div>
          <div className="wc-bar wc-bar-xs" style={{ width: 40, flex: 'none' }} />
        </div>
      ))}
    </div>
  );
}

// ─── Generic wrapper ──────────────────────────────────────────────────────────

type WaitCardVariant = 'history' | 'git-graph' | 'files' | 'reader' | 'home';

interface WaitCardProps {
  variant: WaitCardVariant;
  count?: number;
  minHeight?: number;
  children?: ReactNode;
}

/** Convenience wrapper; selects the right variant component. */
export function WaitCard({ variant, count, minHeight, children }: WaitCardProps) {
  if (children) return <>{children}</>;
  switch (variant) {
    case 'history': return <HistoryWaitCard minHeight={minHeight} />;
    case 'git-graph': return <GitGraphWaitCard lanes={count} />;
    case 'files': return <FilesWaitCard rows={count} />;
    case 'reader': return <ReaderWaitCard lines={count} />;
    case 'home': return <HomeWaitCard rows={count} />;
  }
}
