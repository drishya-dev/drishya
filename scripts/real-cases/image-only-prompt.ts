import type { RealCase } from './types.ts';

// CONTENT-1: a Claude prompt record that holds an image and no text must still be a turn.
export const imageOnlyPrompt: RealCase = {
  name: 'image-only-prompt',
  about: 'Claude Code prompt records with attached images, and those with no text at all',
  harnesses: ['claude-code'],
  prefilter: '"type":"image"',
  scan(row) {
    if (row.type !== 'user' || row.isSidechain) return;
    const content = (row.message as { content?: unknown } | undefined)?.content;
    if (!Array.isArray(content) || !content.some((b) => b?.type === 'image')) return;
    const hasText = content.some((b) => b?.type === 'text' && String(b.text ?? '').trim());
    return { hits: 1, only: hasText ? 0 : 1 };
  },
  verify(p, found) {
    const turns = p.timeline.filter((t) => t.type === 'turn') as { prompt?: string; images?: unknown[] }[];
    const withImages = turns.filter((t) => t.images?.length), imageOnly = withImages.filter((t) => !t.prompt);
    return [
      `${found.hits} image prompt records in the journal; ${withImages.length} turns with images presented`,
      `${found.only} image-only records in the journal; ${imageOnly.length} image-only turns presented`,
      ...(withImages.length !== found.hits ? [`FAIL presented ${withImages.length} of ${found.hits} image prompts`] : []),
      ...(imageOnly.length !== found.only ? [`FAIL presented ${imageOnly.length} of ${found.only} image-only prompts`] : []),
    ];
  },
};
