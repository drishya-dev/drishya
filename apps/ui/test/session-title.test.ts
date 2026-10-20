import { expect, it } from 'vitest';
import { cleanSessionTitle } from '../src/lib/session-title.ts';

it('drops continuation boilerplate and bare links but keeps what the person asked', () => {
  expect(cleanSessionTitle('This session is being continued from a previous conversation that ran out of context. Fix the cart total')).toBe('Fix the cart total');
  expect(cleanSessionTitle('Check https://example.com/a/b?x=1 and the cart')).toBe('Check and the cart');
  expect(cleanSessionTitle('  Plain   title ')).toBe('Plain title');
});
it('never leaves a row empty, and keeps a lone link readable', () => {
  expect(cleanSessionTitle('This session is being continued from a previous conversation that ran out of context.')).toBe('Continued session');
  expect(cleanSessionTitle('https://example.com/only')).toBe('https://example.com/only');
  expect(cleanSessionTitle('')).toBe('Untitled session');
  expect(cleanSessionTitle('x'.repeat(300))).toHaveLength(160);
});
