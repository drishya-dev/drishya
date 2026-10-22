// CONTENT-3: a permission decision that stopped an action before it ran, read from the harness's
// own result text. Only the two wordings recorded in real Claude Code journals are recognised; any
// other error text stays an ordinary failure rather than being guessed at.

import type { OperationDeclined } from '@drishya/contracts';

const PERSON = /^The user doesn't want to proceed with this tool use\./;
const AUTO_MODE = /^Permission for this action was denied by the Claude Code auto mode classifier\./;
const AUTO_REASON = /\bReason:\s*(.+?)\.\s+If you have other tasks/s;

export function declinedFrom(text: string | undefined): OperationDeclined | undefined {
  if (!text) return undefined;
  if (PERSON.test(text)) return { by: 'person' };
  if (AUTO_MODE.test(text)) {
    const reason = AUTO_REASON.exec(text)?.[1]?.trim().replace(/^\[(.*)\]$/s, '$1').trim();
    return { by: 'auto-mode', ...(reason ? { reason: reason.slice(0, 200) } : {}) };
  }
  return undefined;
}
