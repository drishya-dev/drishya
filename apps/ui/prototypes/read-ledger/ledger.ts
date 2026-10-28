/** One chronological row per settled action. No production stylesheet imports this. */
export const ledger = {
  name: 'Ledger',
  axis: 'One full-width row per older action; hover its heading or press E to read.',
  css: `
    .ops-row:has(> .read3-eligible) { flex-direction: column !important; gap: 6px !important; }
    article.read3-eligible { width: 100% !important; max-width: none !important; flex: 0 0 auto !important; }
    article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) { height: 48px !important; min-height: 0 !important; }
    article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) .op-head { display: flex !important; align-items: center !important; height: 47px; min-height: 0; padding-block: 8px; border-bottom-color: transparent; }
    article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) .studio-action-identity { display: flex !important; flex-direction: row !important; align-items: center; gap: 12px; min-width: 0; flex: 1; height: auto !important; }
    article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) .studio-action-identity .op-title { flex: 1; width: 0 !important; min-width: 0; max-width: none !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    article.read3-eligible:not(.read3-open):not(.expanded):not(.selected) .studio-action-identity .op-kind { flex: 0 1 auto; max-width: 140px; height: auto !important; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
  `,
};
