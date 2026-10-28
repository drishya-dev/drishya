/** Collapse the captured passage, preserving prose outside the disclosure. */
export const outline = {
  name: 'Passage outline',
  axis: 'One disclosure per older passage; reopening restores every original action card.',
  css: `
    .read3-group > .ops-row { display: none !important; }
    .read3-group.read3-group-open > .ops-row { display: flex !important; }
    .read3-group-toggle { width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px 16px; text-align: left; border: 1px solid var(--line, #303033); border-radius: 9px; background: var(--surface, #151516); color: var(--fg, #ededed); font: inherit; cursor: pointer; }
    .read3-group-toggle span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .read3-group-toggle small { color: var(--muted, #adb0b9); white-space: nowrap; font-size: 11px; }
    .read3-group-toggle::before { content: '›'; width: 10px; font-size: 18px; }
    .read3-group-open > .read3-group-toggle::before { content: '⌄'; }
    .read3-group-open > .read3-group-toggle { margin-bottom: 12px; }
    .read3-group-toggle:focus-visible { outline: 2px solid var(--accent, #a6a4fa); outline-offset: 3px; }
  `,
};
