import { describe, expect, it } from 'vitest';
import { resolveUIVersion, versionChoiceEnabled, versionURL } from '../src/lib/ui-version';

describe('UI version navigation', () => {
  it('lets explicit links override the saved version and rejects unknown saved choices', () => {
    expect(resolveUIVersion('?experience=classic', 'fresh')).toBe('classic');
    expect(resolveUIVersion('', 'fresh')).toBe('modern');
    expect(resolveUIVersion('?experience=fresh')).toBe('modern');
    expect(resolveUIVersion('')).toBe('modern');
    expect(resolveUIVersion('', 'modern')).toBe('modern');
    // Canvas was retired (UI-4 slice 2): saved choices and old links open Legacy, or Modern when the developer switch is off.
    expect(resolveUIVersion('', 'canvas', true)).toBe('classic');
    expect(resolveUIVersion('?experience=canvas', 'modern')).toBe('classic');
    expect(resolveUIVersion('?experience=modern', 'canvas')).toBe('modern');
    expect(resolveUIVersion('', 'classic', true)).toBe('classic');
    expect(resolveUIVersion('', 'unknown')).toBe('modern');
    expect(resolveUIVersion('?experience=studio', 'fresh')).toBe('studio');
  });
  it('makes Modern the only product choice: a saved Legacy or Canvas choice is ignored unless the developer switch is on', () => {
    expect(resolveUIVersion('', 'classic')).toBe('modern');
    expect(resolveUIVersion('', 'canvas')).toBe('modern');
    expect(resolveUIVersion('', 'classic', false)).toBe('modern');
    expect(resolveUIVersion('', 'classic', true)).toBe('classic');
    expect(resolveUIVersion('?experience=classic', 'modern')).toBe('classic');
    expect(versionChoiceEnabled('?versions')).toBe(true);
    expect(versionChoiceEnabled('?experience=classic&versions=all')).toBe(true);
    expect(versionChoiceEnabled('?experience=classic')).toBe(false);
  });
  it('drops presentation-specific subviews when changing shells', () => {
    expect(new URL(versionURL('http://localhost/?experience=modern#/r/recording/settings', 'classic')).hash).toBe('#/r/recording');
    expect(new URL(versionURL('http://localhost/?experience=modern#/settings', 'canvas')).hash).toBe('#/');
  });
  it('preserves the session, port and other query parameters when switching', () => {
    const url = new URL(versionURL('http://127.0.0.1:8894/?demo&experience=fresh#/r/recording', 'classic'));
    expect(url.port).toBe('8894'); expect(url.hash).toBe('#/r/recording');
    expect(url.searchParams.has('demo')).toBe(true); expect(url.searchParams.get('experience')).toBe('classic');
  });
});
