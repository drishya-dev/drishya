import { redactText } from '../../../../packages/privacy/src/index.ts';

export interface HandoffFile { path: string; fingerprint: string; note: string; patch: string; /** Which side of a changed-on-both file this patch is. */ side?: string }

/** The reviewed patches and their notes as one Markdown packet. The first words say it is a recheck of sampled content, not proof of anything else. Redacted before anyone sees it. */
export function buildHandoff(input: { sampledAt: string; lines: string[]; omitted: number; files: HandoffFile[]; unsent?: number }): string {
  const text = [
    '# Local Git changes handoff',
    `Current Git, sampled on ${input.sampledAt}`,
    input.lines.join('\n'),
    'Rechecked sampled content, not an atomic filesystem snapshot, agent attribution or proof of test coverage.',
    `Scope: explicitly reviewed patches in the files listed. ${input.omitted} paths outside this sample (other pages, protected or oversized content).${input.unsent ? ` ${input.unsent} reviewed patches are left out to keep this packet small.` : ''}`,
    ...input.files.map(file => `## ${file.path}${file.side ? ` (${file.side})` : ''}\nContent fingerprint: ${file.fingerprint}\nReview note: ${file.note}\n\n${file.patch}`),
  ].join('\n\n');
  return redactText(text).text;
}
