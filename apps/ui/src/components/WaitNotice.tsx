import { type ReactNode } from 'react';
import { useWaitNotice, type UseWaitNoticeOptions } from '../lib/use-wait-notice.ts';
import './wait-notice.css';

export interface WaitNoticeProps extends UseWaitNoticeOptions {
  className?: string;
  retryLabel?: string;
  children?: ReactNode;
}

/**
 * Component providing UI-47 wait notices:
 * - Phase < 400ms: renders nothing (or children if provided as ready content)
 * - Phase 400ms-2s: renders quiet status line
 * - Phase > 2s: renders explanatory notice / one-time cost warning
 * - Phase error: renders failure description and interactive retry button
 */
export function WaitNotice({
  waiting,
  error,
  onRetry,
  firstTime,
  quietMs,
  longMs,
  quietMessage,
  longMessage,
  progress,
  className = '',
  retryLabel = 'Retry',
  children,
}: WaitNoticeProps) {
  const notice = useWaitNotice({
    waiting,
    error,
    onRetry,
    firstTime,
    quietMs,
    longMs,
    quietMessage,
    longMessage,
    progress,
  });

  if (notice.isError) {
    return (
      <div className={`wait-notice wait-notice-error ${className}`.trim()} role="alert">
        <p className="wait-notice-line">{notice.errorMessage ?? 'An error occurred.'}</p>
        {notice.retry && (
          <button type="button" className="btn ghost wait-notice-retry" onClick={notice.retry}>
            {retryLabel}
          </button>
        )}
      </div>
    );
  }

  if (notice.isImmediate) {
    return children ? <>{children}</> : null;
  }

  if (notice.isQuiet) {
    return (
      <p className={`wait-notice wait-notice-quiet ${className}`.trim()} role="status">
        <span className="wait-notice-line">{notice.message}</span>
        {notice.progressText && <small className="wait-notice-progress">{notice.progressText}</small>}
      </p>
    );
  }

  if (notice.isLong) {
    return (
      <div className={`wait-notice wait-notice-long ${className}`.trim()} role="status">
        <p className="wait-notice-line">{notice.message}</p>
        {notice.progressText && <small className="wait-notice-progress">{notice.progressText}</small>}
      </div>
    );
  }

  return children ? <>{children}</> : null;
}
