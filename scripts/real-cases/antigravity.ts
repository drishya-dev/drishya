import type { RealCase } from './types.ts';

const indices = new Set<number>();
export const antigravity: RealCase = {
  name: 'antigravity', about: 'read-only Antigravity transcript import, distinct step receipts and explicit unresolved results',
  harnesses: ['antigravity'], prefilter: '',
  reset() { indices.clear(); },
  scan(row) {
    if (!Number.isSafeInteger(row.step_index) || Number(row.step_index) < 0 || indices.has(Number(row.step_index))) return;
    indices.add(Number(row.step_index));
    return { hits: 1 };
  },
  verify(projection) {
    const inventedNativeLinks = projection.links.filter(link => link.relation === 'tool-result' && link.basis === 'source-id' && link.ruleVersion !== 'antigravity-native-task-id-v1').length;
    return [`${projection.operations.length} operations; ${projection.gaps.length} explicit gaps`,
      inventedNativeLinks ? `FAIL ${inventedNativeLinks} positional results labelled native IDs` : 'PASS recorded tool results retained without invented native call IDs'];
  },
};
