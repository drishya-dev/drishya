import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ReplayBundle } from '@drishya/contracts';
import { presentationOf } from '../src/lib/presentation.ts';
import { StructuredResult } from '../src/components/StructuredResult.tsx';

const bundle = JSON.parse(readFileSync(new URL('../public/demo/bundle.json', import.meta.url), 'utf8')) as ReplayBundle;
describe('captured material presentation', () => {
  it('reserves reading space for source and for long command inputs before output exists', () => {
    const read = bundle.projection.operations.find((op) => op.detail.kind === 'read')!;
    const shell = bundle.projection.operations.find((op) => op.detail.kind === 'shell')!;
    expect(presentationOf(read).shape).toBe('source');
    expect(presentationOf({ ...shell, detail: { kind: 'shell', command: 'input '.repeat(30) } }).shape).toBe('wide');
    expect(presentationOf({ ...shell, detail: { kind: 'shell', command: 'pwd' } }).shape).toBe('compact');
  });
  it('retains the original structured preview and escapes content rather than executing markup', () => {
    const text = JSON.stringify([{ path: '<script>bad()</script>', extra: { nested: true } }]);
    const html = renderToStaticMarkup(createElement(StructuredResult, { text }));
    expect(html).toContain('Original captured preview');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('nested');
    expect(html).not.toContain('<script>');
  });
});
