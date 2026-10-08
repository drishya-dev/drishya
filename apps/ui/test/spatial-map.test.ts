import { describe, expect, it } from 'vitest';
import { fileDepth, spatialProject } from '../src/lib/spatial-map.ts';

describe('spatial repository camera', () => {
  it('orbits real depth around both axes and preserves the centre', () => {
    const centre = spatialProject({ x: .5, y: .5, z: 0 }, 1.3, .7);
    expect(centre.x).toBe(.5); expect(centre.y).toBe(.5);
    const point = { x: .5, y: .5, z: .4 };
    const yaw = spatialProject(point, Math.PI / 2, 0);
    expect(yaw.x).toBeCloseTo(.9); expect(yaw.y).toBe(.5);
    const pitch = spatialProject(point, 0, Math.PI / 2);
    expect(pitch.x).toBe(.5); expect(pitch.y).toBeCloseTo(.1);
  });
  it('has stable independent file depths and finite camera coordinates', () => {
    const a = fileDepth('src/one.ts'), b = fileDepth('src/two.ts');
    expect(a).toBe(fileDepth('src/one.ts')); expect(a).not.toBe(b);
    for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 2]) for (const pitch of [-1.5, 0, 1.5]) {
      const p = spatialProject({ x: 1, y: 0, z: a }, yaw, pitch);
      expect(Object.values(p).every(Number.isFinite)).toBe(true);
      expect(p.z).toBeGreaterThan(-1); expect(p.z).toBeLessThan(1);
    }
  });
});

