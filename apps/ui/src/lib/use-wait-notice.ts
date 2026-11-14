import { useState, useEffect, useRef } from 'react';

export type WaitPhase = 'immediate' | 'quiet' | 'long' | 'error';

export interface UseWaitNoticeOptions {
  /** Whether the surface is actively waiting for data or an operation to complete. */
  waiting: boolean;
  /** Error message or object, if an error occurred. */
  error?: string | Error | null;
  /** Optional callback to retry the failed operation. */
  onRetry?: () => void;
  /** Whether this is a first-time / cold-cache load (e.g., initial git graph scan). */
  firstTime?: boolean;
  /** Milliseconds before showing a quiet waiting state (default: 400). */
  quietMs?: number;
  /** Milliseconds before showing a longer explanation / advice (default: 2000). */
  longMs?: number;
  /** Message displayed during the quiet phase (400ms – 2s). */
  quietMessage?: string;
  /** Message displayed during the long phase (> 2s). */
  longMessage?: string;
  /** Optional real measured progress (e.g. { loaded: 120, total: 500, unit: 'files' }). Fake progress is never displayed. */
  progress?: { loaded: number; total?: number; unit?: string };
}

export interface WaitNoticeState {
  /** Current waiting phase: 'immediate' (<400ms), 'quiet' (400ms-2s), 'long' (>2s), or 'error'. */
  phase: WaitPhase;
  /** Whether the wait is currently within the immediate/silent window (<400ms) with no error. */
  isImmediate: boolean;
  /** Whether the wait is in the quiet window (400ms–2s). */
  isQuiet: boolean;
  /** Whether the wait has exceeded the long window (>2s). */
  isLong: boolean;
  /** Whether an error occurred. */
  isError: boolean;
  /** Current status line or description. Undefined during the immediate phase. */
  message?: string;
  /** Error text, if any. */
  errorMessage?: string;
  /** Retry handler, if provided. */
  retry?: () => void;
  /** Real progress formatted string, if progress was provided. */
  progressText?: string;
}

/**
 * Shared hook implementing the UI-47 wait threshold contract:
 * - < 400 ms: silent (show nothing extra)
 * - 400 ms – 2000 ms: quiet placeholder
 * - > 2000 ms: plain explanation, noting one-time cost where true
 * - Error: plain failure message with interactive retry
 */
export function useWaitNotice(options: UseWaitNoticeOptions): WaitNoticeState {
  const {
    waiting,
    error,
    onRetry,
    firstTime = false,
    quietMs = 400,
    longMs = 2000,
    quietMessage = 'Reading…',
    longMessage,
    progress,
  } = options;

  const [phase, setPhase] = useState<WaitPhase>(() => (error ? 'error' : 'immediate'));
  const waitingRef = useRef(waiting);
  waitingRef.current = waiting;

  useEffect(() => {
    if (error) {
      setPhase('error');
      return;
    }

    if (!waiting) {
      setPhase('immediate');
      return;
    }

    // Waiting just began: start in 'immediate' phase
    setPhase('immediate');

    const quietTimer = setTimeout(() => {
      if (waitingRef.current) {
        setPhase('quiet');
      }
    }, quietMs);

    const longTimer = setTimeout(() => {
      if (waitingRef.current) {
        setPhase('long');
      }
    }, longMs);

    return () => {
      clearTimeout(quietTimer);
      clearTimeout(longTimer);
    };
  }, [waiting, error, quietMs, longMs]);

  const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;

  let message: string | undefined;
  if (phase === 'quiet') {
    message = quietMessage;
  } else if (phase === 'long') {
    if (longMessage) {
      message = longMessage;
    } else if (firstTime) {
      message = "Reading for the first time. This can take a minute; you can keep working, but leave the window open.";
    } else {
      message = quietMessage.endsWith('…') ? quietMessage : `${quietMessage}…`;
    }
  }

  let progressText: string | undefined;
  if (progress && (phase === 'quiet' || phase === 'long')) {
    if (progress.total !== undefined && progress.total > 0) {
      progressText = `${progress.loaded} of ${progress.total}${progress.unit ? ` ${progress.unit}` : ''}`;
    } else {
      progressText = `${progress.loaded}${progress.unit ? ` ${progress.unit}` : ''}`;
    }
  }

  return {
    phase,
    isImmediate: phase === 'immediate' && !error,
    isQuiet: phase === 'quiet',
    isLong: phase === 'long',
    isError: phase === 'error' || !!error,
    message,
    errorMessage,
    retry: onRetry,
    progressText,
  };
}
