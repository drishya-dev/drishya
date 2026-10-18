import { expect, it } from 'vitest';
import { mapFileLabel } from '../src/lib/map-label.ts';
it('names files literally with parent context, including root and Windows paths',()=>{
  expect(mapFileLabel('apps/ui/src/index.ts')).toEqual({name:'index.ts',parent:'apps/ui/src'});
  expect(mapFileLabel('packages\\store\\index.ts')).toEqual({name:'index.ts',parent:'packages/store'});
  expect(mapFileLabel('README.md')).toEqual({name:'README.md',parent:'Repository root'});
});
