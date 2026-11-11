import {expect,it} from 'vitest';
import {interfaceScale,interfaceRem,currentInterfaceScale} from '../src/lib/interface-scale.ts';
import {interfaceCssLengths} from '../scale-lengths.ts';

it('never derives the interface size from the viewport: browser zoom and OS scaling own it (Yash, 11 Nov)',()=>{
  for(const [width,height] of [[600,900],[1440,900],[1920,1080],[2560,1440],[3840,2160],[3840,800],[1200,2160],[Number.NaN,1440]])expect(interfaceScale(width,height)).toBe(1);
  expect(currentInterfaceScale()).toBe(1);
  expect(interfaceRem(260)).toBe('16.25rem');
});
it('normalizes lengths while preserving hairlines, relative units, strings and resource URLs',()=>{
  expect(interfaceCssLengths('1px solid; padding: 12px 24px; margin: -8px; width:calc(100vw - 32px)')).toBe('1px solid; padding: 0.75rem 1.5rem; margin: -0.5rem; width:calc(100vw - 2rem)');
  const untouched=`url("/image-32px.svg") '12px' "24px" /* 20px */ 1px .5px 2rem 20vh 50%`;
  expect(interfaceCssLengths(untouched)).toBe(untouched);
  expect(interfaceCssLengths('"var(--reading-width, 380px)"')).toBe('"var(--reading-width, 380px)"');
  expect(interfaceCssLengths('drop-shadow(0 2px 8px #0008)')).toBe('drop-shadow(0 0.125rem 0.5rem #0008)');
});
it('scales inline design allowances once while leaving measured DOM coordinates alone',()=>{
  expect(interfaceCssLengths('min(var(--reading-width, 380px), 440px)')).toBe('min(calc(var(--reading-width, 380px) * var(--ui-scale, 1)), 27.5rem)');
  const once=interfaceCssLengths('min(var(--reading-width,380px),440px)');
  expect(interfaceCssLengths(once)).toBe(once);
  expect(interfaceCssLengths('calc(var(--workspace-header-h, 64px) + 12px)')).toBe('calc(var(--workspace-header-h, 4rem) + 0.75rem)');
});
