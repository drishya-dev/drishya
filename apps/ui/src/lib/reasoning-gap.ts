import type { Prose } from '@drishya/contracts';

const HARNESS: Record<string, string> = { 'claude-code': 'Claude Code', codex: 'Codex' };

/** Wording for reasoning a harness recorded without text (CONTENT-9). States only what the journal shows. */
export function reasoningGap(pr: Prose, harness?: string) {
  const who = (harness && HARNESS[harness]) ?? 'the harness';
  const count = pr.count ?? 1;
  const blocks = count === 1 ? 'one reasoning block' : `${count} reasoning blocks`;
  const why = pr.reason === 'encrypted'
    ? `${who} saved ${blocks} in this turn only in encrypted form. Drishya never decodes it.`
    : pr.reason === 'signature-only'
      ? `${who} saved ${blocks} in this turn with a signature and no text.`
      : `${who} saved ${blocks} in this turn with no text.`;
  return {
    line: `Reasoning not recorded by ${who}`,
    count: count > 1 ? `${count} blocks` : undefined,
    explain: `${why} The agent reasoned here, but the words were not written to the session journal, so nothing can show them. Reasoning that was saved as text or a summary appears in full.`,
  };
}
