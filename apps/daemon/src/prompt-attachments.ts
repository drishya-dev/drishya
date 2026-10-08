import { isDeniedPath, redactText } from '@drishya/privacy';
import { HttpError } from './app.ts';

export interface PromptAttachment { name: string; type: 'text' | 'image'; data: string; mime?: string }
export function prepareAttachments(value: unknown) {
  if (value === undefined) return { attachments: [] as PromptAttachment[], redacted: false };
  if (!Array.isArray(value) || value.length > 32) throw new HttpError(400, 'attach at most 32 files');
  let bytes = 0, textBytes = 0, redacted = false;
  const attachments = value.map((item): PromptAttachment => {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string' || typeof item.data !== 'string') throw new HttpError(400, 'invalid attachment');
    const name = item.name as string;
    if (!name || name.length > 512 || /[\x00-\x1f\\:]/.test(name) || name.startsWith('/') || name.split('/').some(p => !p || p === '.' || p === '..') || isDeniedPath(name) || name.startsWith('.local/')) throw new HttpError(400, 'attachment name is protected or invalid');
    const safeName = redactText(name);
    redacted ||= safeName.hits.length > 0;
    if (item.type === 'text') {
      textBytes += Buffer.byteLength(item.data); bytes += Buffer.byteLength(item.data);
      if (textBytes > 512 * 1024 || item.data.includes('\0')) throw new HttpError(400, 'text attachments must be UTF-8 text, at most 512 KiB combined');
      const safe = redactText(item.data); redacted ||= safe.hits.length > 0;
      return { name: safeName.text, type: 'text', data: safe.text };
    }
    if (item.type !== 'image' || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(item.mime) || !/^[A-Za-z0-9+/]*={0,2}$/.test(item.data) || item.data.length > 6 * 1024 * 1024) throw new HttpError(400, 'unsupported image attachment');
    const data = Buffer.from(item.data, 'base64'); bytes += data.length;
    if (!data.length || data.length > 4 * 1024 * 1024 || data.toString('base64') !== item.data) throw new HttpError(400, 'invalid or oversized image');
    const signature = item.mime === 'image/png' ? data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : item.mime === 'image/jpeg' ? data[0] === 255 && data[1] === 216 && data[2] === 255 : item.mime === 'image/webp' ? data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP' : ['GIF87a', 'GIF89a'].includes(data.toString('ascii', 0, 6));
    if (!signature) throw new HttpError(400, 'image bytes do not match its type');
    return { name: safeName.text, type: 'image', data: item.data, mime: item.mime };
  });
  if (bytes > 6 * 1024 * 1024) throw new HttpError(400, 'attachments exceed 6 MiB combined');
  return { attachments, redacted };
}

export function attachmentText(prompt: string, attachments: PromptAttachment[]) {
  return prompt + attachments.filter(a => a.type === 'text').map(a => `\n\n[Attached file: ${a.name}]\n${a.data}\n[End attached file]`).join('');
}
