import { describe, expect, it } from 'vitest';
import { contextReport } from '../src/lib/context-report.ts';
const table = `# Context Usage\n| Category | Tokens | Usage |\n|:---|---:|---:|\n| Messages | 24.0k | 12.0% |\n| Unknown recorded category | unavailable | — |\n| Free space | 150k | 75% |`;
const captured = (s: string) => `<local-command-stdout>${s}</local-command-stdout>`;
describe('captured context report', () => {
  it('requires captured stdout plus the report heading and table, never a prose mention or quoted example', () => {
    expect(contextReport(table)).toBeUndefined();
    expect(contextReport(`Please explain ${captured(table)}`)).toBeUndefined();
    expect(contextReport(captured('A note about /context\n' + table.replace('# Context Usage','')))).toBeUndefined();
    expect(contextReport(captured('# Context Usage\nNo recorded table'))).toBeUndefined();
  });
  it('preserves recorded categories, units, order, unknown rows and raw report', () => {
    const source = captured(table), report = contextReport(source)!;
    expect(report.raw).toBe(source);
    expect(report.rows).toEqual([{label:'Messages',value:'24.0k · 12.0%',percent:12},{label:'Unknown recorded category',value:'unavailable · —'},{label:'Free space',value:'150k · 75%',percent:75}]);
  });
  it('keeps malformed percentages as text, strips ANSI only for parsing and bounds category rows', () => {
    const source = captured('\x1b[32m# Context Usage\x1b[0m\n| Category | Usage |\n' + Array.from({length:60},(_,i)=>`| row ${i} | 120% |`).join('\n'));
    const report = contextReport(source)!;
    expect(report.rows).toHaveLength(48); expect(report.rows[0]!.percent).toBeUndefined(); expect(report.clipped).toBe(true); expect(report.raw).toBe(source);
  });
});
