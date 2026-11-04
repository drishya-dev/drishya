import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ReplayBundle } from '@drishya/contracts';
import { presentationOf } from '../src/lib/presentation.ts';
import { StructuredResult } from '../src/components/StructuredResult.tsx';

const bundle = JSON.parse(readFileSync(new URL('../public/demo/bundle.json', import.meta.url), 'utf8')) as ReplayBundle;
describe('captured material presentation', () => {
  it('gives chained PowerShell test outcomes reading width before output exists',()=>{const op=bundle.projection.operations.find(op=>op.detail.kind==='test')!;const result=presentationOf({...op,detail:{kind:'test',command:'node cli.ts demo-bundle; npx --yes pnpm@10.34.5 ui:build; npx vitest run; npx tsc --noEmit',outputPreview:'Test Files  1 failed | 9 passed (10)\nTests  4 failed | 92 passed (96)'}});expect(result.width).toBeGreaterThanOrEqual(350);expect(result.shape).not.toBe('compact');});
  it('reserves reading space for source and for long command inputs before output exists', () => {
    const read = bundle.projection.operations.find((op) => op.detail.kind === 'read')!;
    const shell = bundle.projection.operations.find((op) => op.detail.kind === 'shell')!;
    expect(presentationOf(read).shape).toBe('source');
    expect(presentationOf({ ...shell, detail: { kind: 'shell', command: 'input '.repeat(30) } }).shape).toBe('wide');
    expect(presentationOf({ ...shell, detail: { kind: 'shell', command: 'pwd' } }).shape).toBe('compact');
  });
  it('keeps the original structured text one switch away and escapes content rather than executing markup', () => {
    const text = JSON.stringify([{ path: '<script>bad()</script>', extra: { nested: true } }]);
    const html = renderToStaticMarkup(createElement(StructuredResult, { text }));
    // UI-8: the recorded text is one Original switch away, in place of the formatted layout.
    expect(html).toContain('class="original-toggle"');
    expect(html).toContain('&lt;script&gt;');
    // A field the table leaves out (here a nested object) is in the recorded text behind the switch, not at rest.
    expect(html).not.toContain('nested');
    expect(html).not.toContain('<script>');
  });
  it('allocates reading width for long external content without making short receipts full width', () => {
    const op = bundle.projection.operations.find((op) => op.detail.kind === 'mcp')!;
    expect(presentationOf({ ...op, detail: { kind: 'mcp', server: 'docs', tool: 'query', input: { query: 'brief' } } }).shape).toBe('medium');
    expect(presentationOf({ ...op, detail: { kind: 'mcp', server: 'docs', tool: 'query', input: { query: 'input '.repeat(40) } } }).shape).toBe('reading');
    expect(presentationOf({ ...op, detail: { kind: 'mcp', server: 'docs', tool: 'query', input: {}, resultPreview: 'result '.repeat(100) } }).shape).toBe('reading');
  });
  it('preserves null, missing fields and the switch to the original in structured layouts', () => {
    const text = JSON.stringify([{ name: 'first', value: null }, { name: 'second', later: false }]);
    const html = renderToStaticMarkup(createElement(StructuredResult, { text }));
    expect(html).toContain('<th>later</th>');
    expect(html).toContain('<td>null</td>');
    expect(html).toContain('not present');
    // UI-8: the recorded text is one Original switch away, in place of the formatted layout.
    expect(html).toContain('class="original-toggle"');
    const fields = renderToStaticMarkup(createElement(StructuredResult, { text: '{"value":null}' }));
    expect(fields).toContain('<dd>null</dd>');
    expect(fields).toContain('class="original-toggle"');
  });
});
