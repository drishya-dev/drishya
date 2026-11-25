import {expect,it} from 'vitest';
import {modeAnchorOffset} from '../src/lib/mode-anchor.ts';

it('preserves exact pixels when returning to unchanged or expanded material',()=>{
  expect(modeAnchorOffset(-108.5625,111.546875,111.546875)).toBe(-108.5625);
  expect(modeAnchorOffset(-108.5625,111.546875,151.546875)).toBe(-108.5625);
});
it('keeps a folded/shortened material visible while retaining valid earlier offsets',()=>{
  expect(modeAnchorOffset(-200,2400,24)).toBe(-12);
  expect(modeAnchorOffset(-5,2400,24)).toBe(-5);
  expect(modeAnchorOffset(30,2400,24)).toBe(30);
});
