import { describe, expect, it } from 'vitest';
import { resolveUIVersion, versionURL } from '../src/lib/ui-version';

describe('UI version navigation', () => {
  it('lets explicit links override the saved version and rejects unknown saved choices', () => {
    expect(resolveUIVersion('?experience=classic', 'fresh')).toBe('classic');
    expect(resolveUIVersion('', 'fresh')).toBe('fresh');
    expect(resolveUIVersion('', 'canvas')).toBe('canvas');
    expect(resolveUIVersion('', 'classic')).toBe('classic');
    expect(resolveUIVersion('', 'unknown')).toBe('classic');
    expect(resolveUIVersion('?experience=studio', 'fresh')).toBe('studio');
  });
  it('preserves the session, port and other query parameters when switching', () => {
    const url = new URL(versionURL('http://127.0.0.1:8894/?demo&experience=fresh#/r/recording', 'classic'));
    expect(url.port).toBe('8894'); expect(url.hash).toBe('#/r/recording');
    expect(url.searchParams.has('demo')).toBe(true); expect(url.searchParams.get('experience')).toBe('classic');
  });
});
