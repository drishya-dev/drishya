import { expect, it } from 'vitest';
import { scrollEdgeCue } from '../src/lib/scroll-edge-cue.ts';

it('hides both edge cues when content fits within the viewport', () => {
  expect(scrollEdgeCue({ scrollTop: 0, scrollHeight: 400, clientHeight: 400 })).toEqual({ top: false, bottom: false });
  expect(scrollEdgeCue({ scrollTop: 0, scrollHeight: 402, clientHeight: 400 })).toEqual({ top: false, bottom: false });
});

it('tracks top, middle, and bottom cues cleanly when content overflows', () => {
  expect(scrollEdgeCue({ scrollTop: 0, scrollHeight: 800, clientHeight: 400 })).toEqual({ top: false, bottom: true });
  expect(scrollEdgeCue({ scrollTop: 150, scrollHeight: 800, clientHeight: 400 })).toEqual({ top: true, bottom: true });
  expect(scrollEdgeCue({ scrollTop: 400, scrollHeight: 800, clientHeight: 400 })).toEqual({ top: true, bottom: false });
  expect(scrollEdgeCue({ scrollTop: 398.5, scrollHeight: 800, clientHeight: 400 })).toEqual({ top: true, bottom: false });
});

it('rejects degenerate or non-finite container metrics without sticking a cue on', () => {
  expect(scrollEdgeCue({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 })).toEqual({ top: false, bottom: false });
  expect(scrollEdgeCue({ scrollTop: NaN, scrollHeight: 800, clientHeight: 400 })).toEqual({ top: false, bottom: false });
  expect(scrollEdgeCue({ scrollTop: -12, scrollHeight: 800, clientHeight: 400 })).toEqual({ top: false, bottom: true });
});
