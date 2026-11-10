import { describe, expect, it } from 'vitest';
import { contextReport } from '../src/lib/context-report.ts';
const table = `# Context Usage\n| Category | Tokens | Usage |\n|:---|---:|---:|\n| Messages | 24.0k | 12.0% |\n| Unknown recorded category | unavailable | — |\n| Free space | 150k | 75% |`;
const captured = (s: string) => `<local-command-stdout>${s}</local-command-stdout>`;
describe('captured context report', () => {
  it('requires stdout plus the report heading and table, never a prose mention or quoted example', () => {
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
describe('a report with several tables', () => {
  // Shape recorded by Claude Code 2.1.316 for `/context`: categories first, then one table per listed kind.
  const real = captured('## Context Usage\n\n**Model:** m  \n**Tokens:** 28.1k / 1m (3%)\n\n### Estimated usage by category\n\n| Category | Tokens | Percentage |\n|----------|--------|------------|\n| System prompt | 2.9k | 0.3% |\n| Free space | 938.9k | 93.9% |\n\n### Skills\n\n| Skill | Source | Tokens |\n|-------|--------|--------|\n| animate | User | ~160 |\n| loop | Built-in | ~120 |\n\n### MCP Tools\n\n| Tool | Server | Tokens |\n|------|--------|--------|\n| search | web | ~40 |\n');
  it('keeps the categories apart from the other tables, each named by its own heading', () => {
    const report = contextReport(real)!;
    expect(report.rows).toEqual([{ label: 'System prompt', value: '2.9k · 0.3%', percent: 0.3 }, { label: 'Free space', value: '938.9k · 93.9%', percent: 93.9 }]);
    expect(report.sections).toEqual([
      { title: 'Skills', rows: [{ label: 'animate', value: 'User · ~160' }, { label: 'loop', value: 'Built-in · ~120' }] },
      { title: 'MCP Tools', rows: [{ label: 'search', value: 'web · ~40' }] },
    ]);
    expect(report.clipped).toBe(false); expect(report.raw).toBe(real);
  });
  it('bounds sections and rows and says so', () => {
    const many = captured('# Context Usage\n| Category | Tokens |\n| a | 1 |\n\n' + Array.from({ length: 10 }, (_, i) => `### T${i}\n| Name | Tokens |\n| x | ${i} |\n`).join('\n'));
    const report = contextReport(many)!;
    expect(report.sections).toHaveLength(8); expect(report.clipped).toBe(true);
    const long = captured('# Context Usage\n| Category | Tokens |\n| a | 1 |\n\n### Big\n| Name | Tokens |\n' + Array.from({ length: 130 }, (_, i) => `| r${i} | ${i} |`).join('\n'));
    expect(contextReport(long)!.sections[0]!.rows).toHaveLength(100);
  });
});
describe('the interactive report', () => {
  const grid = '\x1b[38;2;1;2;3m⛁ ⛁ ⛶ ⛶\x1b[0m';
  const interactive = captured(` Context Usage\n${grid}   model-name\n${grid}   293k/1M tokens (29%)\n${grid}   \x1b[2mEstimated usage by category\x1b[0m\n${grid}   \x1b[38;2;1;2;3m⛁\x1b[0m System prompt: 2.3k tokens (0.2%)\n${grid}   \x1b[38;2;1;2;3m⛁\x1b[0m Messages: 266.9k tokens (26.7%)\n${grid}   ⛶ Free space: 672.5k (67.3%)\n${grid}   ⛝ Autocompact buffer: 33k tokens (3.3%)\n\nMemory files · /memory\n└ 8 files · 0 tokens\n\nSkills · /skills\n└ 28 skills · 5.4k tokens\n`);
  it('reads the legend as the categories and each "Title · /command" block as its own list', () => {
    const report = contextReport(interactive)!;
    expect(report.heading).toBe('Context Usage');
    expect(report.rows).toEqual([
      { label: 'System prompt', value: '2.3k tokens · 0.2%', percent: 0.2 }, { label: 'Messages', value: '266.9k tokens · 26.7%', percent: 26.7 },
      { label: 'Free space', value: '672.5k · 67.3%', percent: 67.3 }, { label: 'Autocompact buffer', value: '33k tokens · 3.3%', percent: 3.3 },
    ]);
    expect(report.sections).toEqual([{ title: 'Memory files · /memory', rows: [{ label: '8 files', value: '0 tokens' }] }, { title: 'Skills · /skills', rows: [{ label: '28 skills', value: '5.4k tokens' }] }]);
    expect(report.raw).toBe(interactive);
  });
  it('stays ordinary output without the report heading or at least two recorded categories', () => {
    expect(contextReport(captured(`${grid}   Messages: 1k tokens (1%)`))).toBeUndefined();
    expect(contextReport(captured(` Context Usage\n${grid}   ⛁ Messages: 1k tokens (1%)`))).toBeUndefined();
    expect(contextReport(captured('Skills · /skills\n└ 28 skills · 5.4k tokens'))).toBeUndefined();
  });
});
describe('the window a report prints', () => {
  it('keeps the used/window line as printed from both report shapes', () => {
    const table = contextReport(captured('## Context Usage\n\n**Model:** m  \n**Tokens:** 28.1k / 1m (3%)\n\n| Category | Tokens | Percentage |\n|---|---|---|\n| System prompt | 2.9k | 0.3% |\n| Free space | 938.9k | 93.9% |'))!;
    expect(table.total).toEqual({ text: '28.1k of 1m tokens', used: 28100, window: 1_000_000, percent: 3 });
    const grid = '\x1b[38;2;1;2;3m⛁ ⛁ ⛶ ⛶\x1b[0m';
    const interactive = contextReport(captured(` Context Usage\n${grid}   model-name\n${grid}   293k/1M tokens (29%)\n${grid}   ⛁ System prompt: 2.3k tokens (0.2%)\n${grid}   ⛁ Messages: 266.9k tokens (26.7%)\n${grid}   ⛶ Free space: 672.5k (67.3%)`))!;
    expect(interactive.total).toEqual({ text: '293k of 1M tokens', used: 293000, window: 1_000_000, percent: 29 });
  });
  it('has no total when the report prints none, and never takes one from a row', () => {
    expect(contextReport(captured(table))!.total).toBeUndefined();
    expect(contextReport(captured('# Context Usage\n| Category | Tokens |\n| a | 5 / 3 (50%) |\n| b | 2 |'))!.total).toBeUndefined();
  });
});
