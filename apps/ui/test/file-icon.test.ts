import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FileIcon } from '../src/components/FileIcon.tsx';

describe('repository file format glyphs', () => {
  it('recognizes module/header aliases and keeps uncommon extensions identifiable', () => {
    const icon = (path: string) => renderToStaticMarkup(createElement(FileIcon, { path }));
    expect(icon('source.mts')).toContain('format-ts');
    expect(icon('header.hpp')).toContain('format-cpp');
    expect(icon('script.cjs')).toContain('format-js');
    expect(icon('model.swift')).toContain('>SWI</text>');
    expect(icon('Makefile')).toContain('>≡</text>');
  });
});
