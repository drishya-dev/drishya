// CONTENT-3: a permission decision that stopped an action before it ran, read from the harness's
// own result text. Only the two wordings recorded in real Claude Code journals are recognised; any
// other error text stays an ordinary failure rather than being guessed at.

import type { OperationDeclined } from '@drishya/contracts';

const PERSON = /^The user doesn't want to proceed with this tool use\./;
const AUTO_MODE = /^Permission for this action was denied by the Claude Code auto mode classifier\./;

function autoReason(text: string): string | undefined {
  const label = /\bReason:/.exec(text);
  if (!label) return;
  const body = text.slice(label.index + label[0].length).trimStart();
  // A reason has at least one character. Each possible trailer starts with a period,
  // so its whitespace scan cannot overlap the scan from a different period.
  const trailer = body.slice(1).search(/\.\s+If you have other tasks/);
  if (trailer === -1) return;
  const reason = body.slice(0, trailer + 1).trim();
  return reason.startsWith('[') && reason.endsWith(']') ? reason.slice(1, -1).trim() : reason;
}

export function declinedFrom(text: string | undefined): OperationDeclined | undefined {
  if (!text) return undefined;
  if (PERSON.test(text)) return { by: 'person' };
  if (AUTO_MODE.test(text)) {
    const reason = autoReason(text);
    return { by: 'auto-mode', ...(reason ? { reason: reason.slice(0, 200) } : {}) };
  }
  return undefined;
}
