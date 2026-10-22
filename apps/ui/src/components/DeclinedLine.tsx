import type { OperationDeclined } from '@drishya/contracts';
import './declined-line.css';

/**
 * CONTENT-3: a permission decision stopped this action before it ran. The wording is Drishya's; the
 * reason, when there is one, is the harness's own text. Not a failure, so nothing here is red.
 */
export function DeclinedLine({ declined }: { declined: OperationDeclined }) {
  const person = declined.by === 'person';
  return <div className="declined-line" title="Read from Claude Code's result for this call; the action did not run">
    <span className="declined-mark" aria-hidden="true">⊘</span>
    <span>{person ? 'You declined this action' : 'Claude Code’s auto mode blocked this action'}</span>
    <span className="declined-basis"> · it did not run{declined.reason ? ` · reason: ${declined.reason}` : ''}</span>
  </div>;
}
