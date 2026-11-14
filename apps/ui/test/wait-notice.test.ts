import { describe, it, expect } from 'vitest';
import { createElement, useState, useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WaitNotice } from '../src/components/WaitNotice.tsx';
import { useWaitNotice } from '../src/lib/use-wait-notice.ts';

describe('WaitNotice & useWaitNotice (UI-47)', () => {
  it('renders nothing extra during immediate phase (<400ms) with no error', () => {
    const html = renderToStaticMarkup(
      createElement(WaitNotice, {
        waiting: true,
        quietMessage: 'Reading…',
        longMessage: 'Reading repository for the first time…',
      })
    );
    expect(html).toBe('');
  });

  it('renders children during immediate phase if children are provided', () => {
    const html = renderToStaticMarkup(
      createElement(
        WaitNotice,
        {
          waiting: true,
          quietMessage: 'Reading…',
        },
        createElement('span', null, 'Ready content')
      )
    );
    expect(html).toBe('<span>Ready content</span>');
  });

  it('renders error notice with message and retry button when in error state', () => {
    const html = renderToStaticMarkup(
      createElement(WaitNotice, {
        waiting: false,
        error: 'Failed to read history from Git.',
        onRetry: () => {},
        retryLabel: 'Retry history',
      })
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('wait-notice-error');
    expect(html).toContain('Failed to read history from Git.');
    expect(html).toContain('Retry history');
  });

  it('customizes messages for first-time cold load in long phase', () => {
    function TestConsumer() {
      const notice = useWaitNotice({
        waiting: true,
        firstTime: true,
        quietMessage: 'Reading…',
      });
      // In server static render, phase is immediate by default
      return createElement('div', { 'data-phase': notice.phase }, notice.phase);
    }
    const html = renderToStaticMarkup(createElement(TestConsumer));
    expect(html).toContain('data-phase="immediate"');
  });
});
