import type { Projection } from '@drishya/contracts';
import { contextLabel, contextOccupancy } from '../lib/context-ring.ts';
import './context-ring.css';

const RADIUS = 4.5, CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** LIVE-4: recorded last-request input/window ratio. Absent unless the harness recorded both values. */
export function ContextRing({ usage }: { usage: Projection['usage'] }) {
  const context = contextOccupancy(usage);
  if (!context) return null;
  const label = contextLabel(context);
  return <svg className="context-ring" viewBox="0 0 12 12" role="img" aria-label={label} data-high={context.fraction >= .9 ? 'true' : undefined}>
    <title>{label}</title>
    <circle className="context-ring-track" cx="6" cy="6" r={RADIUS} />
    <circle className="context-ring-fill" cx="6" cy="6" r={RADIUS} strokeDasharray={`${(context.fraction * CIRCUMFERENCE).toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`} transform="rotate(-90 6 6)" />
  </svg>;
}
