import { describe, expect, it } from 'vitest';
import { QUIET_FEATHER, quietEdgePoints, quietFactor, type QuietZone } from '../src/lib/map-quiet.ts';
import { LABEL_BOX, labelRect, placeLabels, type LabelCandidate } from '../src/lib/map-labels.ts';
import { groupMemberPaths } from '../src/lib/map-detail.ts';

const zone: QuietZone = { left: 300, right: 900, top: 0, bottom: 800 };

describe('quiet zone', () => {
  it('is full strength away from the zone and at the floor inside it', () => {
    expect(quietFactor(100, 400, [zone], .2)).toBe(1);
    expect(quietFactor(300 - QUIET_FEATHER, 400, [zone], .2)).toBe(1);
    expect(quietFactor(600, 400, [zone], .2)).toBe(.2);
    expect(quietFactor(300, 400, [zone], .2)).toBe(.2);
  });
  it('falls off smoothly and monotonically across the soft edge', () => {
    const samples = [0, .25, .5, .75, 1].map(f => quietFactor(300 - QUIET_FEATHER * f, 400, [zone], .2));
    for (let i = 1; i < samples.length; i++) expect(samples[i]!).toBeGreaterThan(samples[i - 1]!);
  });
  it('leaves no zones untouched', () => {
    expect(quietFactor(600, 400, [], .2)).toBe(1);
    const points = quietEdgePoints(0, 0, 50, 50, [], .05);
    expect(points.map(p => p.t)).toEqual([0, 1]);
    expect(points.every(p => p.factor === 1)).toBe(true);
  });
  it('cuts a line that crosses prose so its middle is quiet and its ends are not', () => {
    const points = quietEdgePoints(100, 400, 1100, 400, [zone], .05);
    expect(points[0]!.factor).toBe(1);
    expect(points.at(-1)!.factor).toBe(1);
    const inside = points.filter(p => p.x >= zone.left && p.x <= zone.right);
    expect(inside.length).toBeGreaterThanOrEqual(2);
    expect(inside.every(p => p.factor === .05)).toBe(true);
    // No cut may leave a long, bright run beneath the column.
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!, b = points[i]!;
      const mid = (a.x + b.x) / 2;
      if (mid > zone.left && mid < zone.right) expect(Math.max(a.factor, b.factor)).toBeLessThanOrEqual(.05 + 1e-9);
    }
  });
  it('keeps a line that stays outside the feather band whole', () => {
    const points = quietEdgePoints(10, 10, 100, 700, [zone], .05);
    expect(points.length).toBe(2);
    expect(points.every(p => p.factor === 1)).toBe(true);
  });
  it('handles a vertical line and a line that starts inside the zone', () => {
    expect(quietEdgePoints(600, -50, 600, 900, [zone], .05).some(p => p.factor === .05)).toBe(true);
    const from = quietEdgePoints(600, 400, 1200, 400, [zone], .05);
    expect(from[0]!.factor).toBe(.05);
    expect(from.at(-1)!.factor).toBe(1);
  });
});

describe('label placement', () => {
  const measure = (text: string) => text.length * 6.6;
  const map = { width: 1200, height: 800 };
  const file = (id: string, x: number, y: number, text = 'apps/ui/src/a.ts'): LabelCandidate => ({ id, x, y, kind: 'file', text });
  const group = (id: string, x: number, y: number, count = 8): LabelCandidate => ({ id, x, y, kind: 'group', text: 'Mixed files', count });

  it('never shows two overlapping labels', () => {
    const candidates: LabelCandidate[] = [];
    for (let i = 0; i < 200; i++) candidates.push(i % 3 ? file(`f${i}`, 40 + (i * 37) % 1000, 100 + (i * 53) % 600) : group(`g${i}`, 40 + (i * 61) % 1000, 100 + (i * 29) % 600));
    const placed = placeLabels(candidates, map, [], measure, 100);
    expect(placed.length).toBeGreaterThan(5);
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]!.rect, b = placed[j]!.rect;
      const touching = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      expect(touching).toBe(false);
    }
  });
  it('keeps the higher-priority label and drops the one it would cover', () => {
    const placed = placeLabels([file('first', 400, 300), file('second', 420, 310)], map, [], measure, 10);
    expect(placed.map(p => p.id)).toEqual(['first']);
  });
  it('keeps labels inside the map and clear of controls', () => {
    const placed = placeLabels([file('edge', 1195, 300), file('under', 500, 300), file('ok', 100, 300)], map, [{ left: 480, top: 280, right: 1000, bottom: 340 }], measure, 10);
    expect(placed.map(p => p.id)).toEqual(['ok']);
  });
  it('places the working set first and does not let it be dropped for room', () => {
    const pinned: LabelCandidate = { ...file('root', 400, 300), pinned: true };
    const placed = placeLabels([file('crowd', 402, 300), pinned], map, [], measure, 10);
    expect(placed.map(p => p.id)).toEqual(['root']);
  });
  it('stops at the limit for ordinary labels', () => {
    const many = Array.from({ length: 30 }, (_, i) => file(`f${i}`, 20 + (i % 5) * 220, 100 + Math.floor(i / 5) * 60));
    expect(placeLabels(many, map, [], measure, 7)).toHaveLength(7);
  });
  it('sizes a group from its text and count and caps it', () => {
    const narrow = labelRect(group('g', 0, 100), measure), long = labelRect({ ...group('g', 0, 100), text: 'x'.repeat(100) }, measure);
    expect(narrow.right - narrow.left).toBeCloseTo(LABEL_BOX.group.padX + 'Mixed files'.length * 6.6 + LABEL_BOX.group.gap + 6.6, 5);
    expect(long.right - long.left).toBe(LABEL_BOX.maxWidth);
    expect(narrow.bottom - narrow.top).toBe(LABEL_BOX.group.height);
  });
});

describe('group members', () => {
  const paths: Record<string, string> = { a: 'docs/a.md', b: 'apps/b.ts', c: 'apps/c.ts', d: 'z/d.ts', e: 'z/e.ts', f: 'z/f.ts' };
  it('names touched members first, then the rest in path order, and counts what it left out', () => {
    const result = groupMemberPaths(['a', 'b', 'c', 'd', 'e', 'f'], id => paths[id], id => id === 'f', 3);
    expect(result).toEqual({ paths: ['z/f.ts', 'apps/b.ts', 'apps/c.ts'], more: 3 });
  });
  it('skips members it cannot resolve', () => {
    expect(groupMemberPaths(['a', 'missing'], id => paths[id], () => false)).toEqual({ paths: ['docs/a.md'], more: 0 });
  });
});
