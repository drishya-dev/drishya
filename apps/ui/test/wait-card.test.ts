import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  WaitCard,
  HistoryWaitCard,
  GitGraphWaitCard,
  FilesWaitCard,
  ReaderWaitCard,
  HomeWaitCard,
} from '../src/components/WaitCard.tsx';

describe('WaitCard (UI-48)', () => {
  it('renders history wait card with role status and configured minHeight', () => {
    const html = renderToStaticMarkup(createElement(HistoryWaitCard, { minHeight: 320 }));
    expect(html).toContain('class="wait-card wait-card-history"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('min-height:320px');
    expect(html).toContain('wc-block wc-block-prose');
  });

  it('renders git graph wait card with specified lane count', () => {
    const html = renderToStaticMarkup(createElement(GitGraphWaitCard, { lanes: 5 }));
    expect(html).toContain('wait-card-git-graph');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    const laneMatches = html.match(/class="wc-git-lane"/g);
    expect(laneMatches).toHaveLength(5);
  });

  it('renders files wait card with specified row count', () => {
    const html = renderToStaticMarkup(createElement(FilesWaitCard, { rows: 6 }));
    expect(html).toContain('class="wait-card wait-card-files"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    const rowMatches = html.match(/class="wc-file-row"/g);
    expect(rowMatches).toHaveLength(6);
  });

  it('renders source reader wait card with gutter and code lines', () => {
    const html = renderToStaticMarkup(createElement(ReaderWaitCard, { lines: 8 }));
    expect(html).toContain('class="wait-card wait-card-reader"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('wc-reader-gutter');
    expect(html).toContain('wc-reader-code');
    const linenoMatches = html.match(/class="wc-reader-lineno"/g);
    expect(linenoMatches).toHaveLength(8);
  });

  it('renders home wait card with session card placeholders', () => {
    const html = renderToStaticMarkup(createElement(HomeWaitCard, { rows: 4 }));
    expect(html).toContain('class="wait-card wait-card-home"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    const rowMatches = html.match(/class="wc-home-row"/g);
    expect(rowMatches).toHaveLength(4);
  });

  it('supports the generic WaitCard wrapper for all variants', () => {
    const historyHtml = renderToStaticMarkup(createElement(WaitCard, { variant: 'history' }));
    expect(historyHtml).toContain('wait-card-history');

    const graphHtml = renderToStaticMarkup(createElement(WaitCard, { variant: 'git-graph', count: 4 }));
    expect(graphHtml).toContain('wait-card-git-graph');

    const filesHtml = renderToStaticMarkup(createElement(WaitCard, { variant: 'files', count: 5 }));
    expect(filesHtml).toContain('wait-card-files');

    const readerHtml = renderToStaticMarkup(createElement(WaitCard, { variant: 'reader', count: 6 }));
    expect(readerHtml).toContain('wait-card-reader');

    const homeHtml = renderToStaticMarkup(createElement(WaitCard, { variant: 'home', count: 3 }));
    expect(homeHtml).toContain('wait-card-home');
  });
});
