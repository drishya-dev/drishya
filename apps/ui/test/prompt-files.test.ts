import { describe, expect, it } from 'vitest';
import { attachmentBytes, promptFiles, utf8Bytes, PROMPT_BYTES } from '../src/lib/prompt-files.ts';

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
