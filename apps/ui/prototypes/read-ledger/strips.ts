/** Retain the passage's left-to-right grammar, with compact older action headers. */
export const strips = {
  name: 'Passage strips',
  axis: 'Older actions stay left to right; the chosen material opens across its passage.',
  css: `
    .ops-row:has(> .read3-eligible) { gap: 8px !important; align-items: flex-start !important; }
    article.read3-eligible { width: min(100%, 260px) !important; flex: 1 1 240px !important; max-width: none !important; }
    article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) { height: 68px !important; min-height: 0 !important; }
    article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) .op-head { height: 67px; min-height: 0; border-bottom-color: transparent; }
    article.read3-eligible:is(.read3-open,.expanded,.selected) { width: 100% !important; flex-basis: 100% !important; }
    article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) .op-expand { font-size: 0; width: 24px; }
    article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) .op-expand::after { content: '↗'; font-size: 14px; }
  `,
};
