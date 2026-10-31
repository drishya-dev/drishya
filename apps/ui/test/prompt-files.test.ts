import { describe, expect, it } from 'vitest';
import { attachmentBytes, formatBytes, promptFiles, promptSizeNote, utf8Bytes, PROMPT_BYTES } from '../src/lib/prompt-files.ts';

describe('local attachment preparation', () => {
  it('counts UTF-8 prompt bytes and exact base64 image padding', () => {
    expect(utf8Bytes('🙂')).toBe(4);
    expect(utf8Bytes('🙂'.repeat(16_385))).toBeGreaterThan(PROMPT_BYTES);
    expect(attachmentBytes({ type: 'image', name: 'x.png', data: 'YQ==' })).toBe(1);
    expect(attachmentBytes({ type: 'image', name: 'x.png', data: 'YWI=' })).toBe(2);
  });
  it('checks combined UTF-8 bytes including already prepared files without changing them', async () => {
    const existing = [{ type: 'text' as const, name: 'first.txt', data: '🙂'.repeat(131_071) }];
    await expect(promptFiles([new File(['12345'], 'second.txt')], existing)).rejects.toThrow('512 KiB');
    expect(existing).toHaveLength(1);
    const files = await promptFiles([new File(['✓'], 'second.txt')], existing);
    expect(files).toHaveLength(2);
    expect(attachmentBytes(files[1]!)).toBe(3);
  });
  it('rejects binary, excessive count and aggregate image/text size', async () => {
    await expect(promptFiles([new File(['\0'], 'binary')], [])).rejects.toThrow('binary');
    await expect(promptFiles(Array.from({ length: 33 }, () => new File(['a'], 'a.txt')), [])).rejects.toThrow('32');
    await expect(promptFiles([new File(['a'], 'a.txt')], [{ type: 'image', name: 'large.png', data: 'A'.repeat(8 * 1024 * 1024) }])).rejects.toThrow('6 MiB');
  });
});

describe('what the composer says about size', () => {
  it('reads sizes as a person does', () => {
    expect([0, 309, 1023, 1024, 48556, 36008, 1048576, 6291456].map(formatBytes)).toEqual(['0 B', '309 B', '1023 B', '1 KiB', '47.4 KiB', '35.2 KiB', '1 MiB', '6 MiB']);
  });
  it('is silent for a small prompt, names the limit it counts against, and warns only when it matters', () => {
    expect(promptSizeNote(309, { count: 0, bytes: 0 })).toMatchObject({ quiet: true, over: false });
    expect(promptSizeNote(309, { count: 1, bytes: 48556 })).toEqual({ over: false, quiet: false, text: '1 file · 47.4 KiB of 6 MiB' });
    expect(promptSizeNote(309, { count: 3, bytes: 2048 }).text).toBe('3 files · 2 KiB of 6 MiB');
    expect(promptSizeNote(50 * 1024, { count: 0, bytes: 0 }).text).toBe('Prompt 50 KiB of 64 KiB');
    expect(promptSizeNote(65_536 + 1500, { count: 1, bytes: 10 })).toMatchObject({ over: true, text: 'Prompt exceeds 64 KiB by 1.5 KiB. Your draft is kept.' });
  });
});
