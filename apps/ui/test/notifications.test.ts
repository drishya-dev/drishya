import { describe, expect, it } from 'vitest';
import { notification, notifyKind } from '../src/lib/notifications.ts';

describe('opt-in notifications (LIVE-3)', () => {
  it('fires for a new question and for a turn that just ended, nothing else', () => {
    expect(notifyKind('running', 'asking')).toBe('asking');
    expect(notifyKind(undefined, 'asking')).toBe('asking');
    expect(notifyKind('asking', 'asking')).toBeUndefined();
    expect(notifyKind('running', 'replied')).toBe('finished');
    expect(notifyKind('working', 'replied')).toBe('finished');
  });
  it('stays quiet on first sight, idle drift and sessions that stop being live', () => {
    expect(notifyKind(undefined, 'replied')).toBeUndefined();
    expect(notifyKind('replied', 'quiet')).toBeUndefined();
    expect(notifyKind('quiet', 'replied')).toBeUndefined();
    expect(notifyKind('running', undefined)).toBeUndefined();
    expect(notifyKind('running', 'working')).toBeUndefined();
  });
  it('names the session and state, never captured content', () => {
    expect(notification('finished', { harness: 'Codex', title: 'Fix cart totals' })).toEqual({ title: 'Fix cart totals', body: 'Codex finished its turn' });
    expect(notification('asking', { harness: 'Claude', workspace: 'shop' })).toEqual({ title: 'shop', body: 'Claude is waiting for your answer' });
    expect(notification('asking', { harness: 'Claude', title: 'x'.repeat(200) }).title).toHaveLength(80);
  });
});
