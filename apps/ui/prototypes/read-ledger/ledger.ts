/** One chronological row per settled action. No production stylesheet imports this. */
export const ledger = {
  name: 'Ledger',
  axis: 'One full-width row per older action; hover its heading or press E to read.',
  css: `
    .ops-row:has(> .read3-eligible) { flex-direction: column !important; gap: 6px !important; }
    article.read3-eligible { width: 100% !important; max-width: none !important; flex: 0 0 auto !important; }
    article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) { height: 48px !important; min-height: 0 !important; }
    article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) .op-head { height: 47px; min-height: 0; padding-block: 8px; border-bottom-color: transparent; }
    article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) .studio-action-identity { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
    article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) .studio-action-identity .op-kind { flex: 0 0 auto; font-size: 11px; }
  `,
};
