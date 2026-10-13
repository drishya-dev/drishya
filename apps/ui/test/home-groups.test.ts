import { describe, expect, it } from 'vitest';
import { timeSection, workspaceGroups } from '../src/lib/home-groups.ts';

describe('Home workspace and calendar groups', () => {
  const now = new Date(2026, 9, 13, 12);
  const local = (day: number, hour = 12) => new Date(2026, 9, day, hour).toISOString();
  it('uses local midnight instead of rolling 24 hour or UTC buckets', () => {
    expect(timeSection(local(13, 0), now)).toBe('Today');
    expect(timeSection(local(12, 23), now)).toBe('Yesterday');
    expect(timeSection(local(6, 0), now)).toBe('Previous 7 days');
    expect(timeSection(local(5, 23), now)).toBe('Older');
    expect(timeSection(local(14), now)).toBe('Future date');
    expect(timeSection('invalid', now)).toBe('Time unavailable');
    expect(timeSection(undefined, now)).toBe('Time unavailable');
  });
  it('does not merge equal basenames or invent roots and dates', () => {
    const rows = [{ root: '/one/shop', time: local(12) }, { root: '/two/shop', time: local(13) }, { root: undefined, time: undefined }, { root: '/one/shop', time: local(13) }];
    const groups = workspaceGroups(rows, r => r.root, r => r.time);
    expect(groups.map(g => g.key)).toEqual(['root:/two/shop', 'root:/one/shop', 'unassigned']);
    expect(groups[0]!.name).toBe('shop');
    expect(groups[1]!.items.map(r => r.time)).toEqual([local(13), local(12)]);
    expect(groups[2]!.name).toBe('Unassigned workspace');
    expect(rows[0]!.time).toBe(local(12));
  });
  it('retains every session and full Windows identity before presentation bounds', () => {
    const rows = Array.from({ length: 800 }, (_, n) => ({ root: n % 2 ? 'C:\\work\\app' : 'D:\\work\\app', time: local(13), n }));
    const groups = workspaceGroups(rows, r => r.root, r => r.time);
    expect(groups).toHaveLength(2);
    expect(groups.every(g => g.name === 'app' && g.items.length === 400)).toBe(true);
    expect(groups.flatMap(g => g.items)).toHaveLength(800);
  });
});
