import { useEffect, useMemo } from 'react';
import { turnLedgers } from '../../../../packages/scene/src/turns.ts';
import { useApp } from '../state.ts';
import { publishTurns } from '../lib/turns-store.ts';

/**
 * Keeps each turn's ledger current without rendering anything. Large recordings only ever hold a window of
 * passages, so their ledgers come from the daemon, which counts the whole recording; small ones are counted here.
 */
export function TurnsWatcher() {
  const source = useApp((s) => s.source);
  const id = useApp((s) => s.recordingId);
  const recording = useApp((s) => s.recording);
  const projection = useApp((s) => s.projection);
  const paged = useApp((s) => !!s.historyPage);

  const local = useMemo(() => paged || !projection ? undefined : turnLedgers(projection), [paged, projection]);
  useEffect(() => { if (local) publishTurns(local); }, [local]);

  useEffect(() => {
    if (!paged || !source?.turns || !id) return;
    let cancelled = false;
    const timer = setTimeout(() => { void source.turns!(id).then((result) => { if (!cancelled) publishTurns(result.turns); }, () => {}); }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [paged, source, id, recording?.revision, recording?.observationCount]);

  useEffect(() => () => publishTurns([]), [id]);
  return null;
}
