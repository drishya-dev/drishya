import type { TestSummary } from '@drishya/contracts';

export type TestTile = { state: 'passed' | 'failed' | 'skipped'; index?: number; name?: string };
/** Only complete, flat numbered TAP output supplies runner indices. Nested suites,
 * duplicate indices and partial previews fall back to honest summary counts. */
export function testTiles(summary: TestSummary, output = ''): { tiles: TestTile[]; ordered: boolean; remaining: number } {
  const total = summary.passed + summary.failed + summary.skipped;
  const lines = output.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').split(/\r?\n/);
  const cases: TestTile[] = [];
  let nested = false;
  for (const line of lines) {
    if (/^\s+(?:not )?ok\s+\d+\b/.test(line)) nested = true;
    const match = /^(not ok|ok)\s+(\d+)\b(?:\s*-?\s*)(.*)$/.exec(line);
    if (match) cases.push({ state: /#\s*(SKIP|TODO)\b/i.test(match[3]!) ? 'skipped' : match[1] === 'ok' ? 'passed' : 'failed', index: Number(match[2]), name: match[3]!.slice(0, 180) });
    if (cases.length > 240) break;
  }
  const ordered = !nested && total <= 240 && cases.length === total && cases.every((item, i) => item.index === i + 1) && ['passed', 'failed', 'skipped'].every(state => cases.filter(item => item.state === state).length === summary[state as 'passed' | 'failed' | 'skipped']);
  if (ordered) return { tiles: cases, ordered: true, remaining: 0 };
  const tiles: TestTile[] = [];
  for (const state of ['passed', 'failed', 'skipped'] as const) {
    // Bound DOM work even for six-figure summaries; preserve minority outcomes.
    const count = Math.min(summary[state], 80);
    for (let i = 0; i < count; i++) tiles.push({ state });
  }
  return { tiles, ordered: false, remaining: total - tiles.length };
}
