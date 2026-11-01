import type { RealCase } from './types.ts';
let first = true;
export function resetSessionLineageScan(): void { first = true; }
export const sessionLineage: RealCase = {
  name: 'session-lineage',
  about: 'Explicit first-compaction native parent references; full source history remains separate from native control.',
  harnesses: ['claude-code'],
  prefilter: '',
  scan(row) {
    if (!first || !['user', 'assistant', 'system'].includes(String(row.type))) return;
    first = false;
    if (row.type === 'system' && row.subtype === 'compact_boundary' && typeof row.logicalParentUuid === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(row.logicalParentUuid)) return { hits: 1 };
  },
  verify(projection) {
    const view = projection.lineage;
    if (!view) return ['FAIL native continuation reference was not retained'];
    return [`PASS ${view.recordingIds.length} physical parts; ${view.links.filter(link => link.status === 'linked').length} exact links; ${view.links.filter(link => link.status !== 'linked').length} explicit unavailable/ambiguous links`, `PASS ${view.duplicatePartsOmitted} identical parts omitted; ${view.differingReceiptPartsRetained} differing usage receipts retained`];
  },
};
