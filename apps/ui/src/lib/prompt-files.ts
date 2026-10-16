import type { PromptAttachment } from '../api.ts';

export const PROMPT_BYTES = 64 * 1024;
export const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;
export const attachmentBytes = (item: PromptAttachment) => item.type === 'text' ? utf8Bytes(item.data) : item.data.length * 3 / 4 - (item.data.endsWith('==') ? 2 : item.data.endsWith('=') ? 1 : 0);

export async function promptFiles(files: File[], existing: PromptAttachment[]): Promise<PromptAttachment[]> {
  if (files.length + existing.length > 32) throw new Error('Select at most 32 files; choose a smaller folder or individual files.');
  let total = existing.reduce((sum, a) => sum + attachmentBytes(a), 0);
  let text = existing.filter(a => a.type === 'text').reduce((sum, a) => sum + utf8Bytes(a.data), 0);
  const result: PromptAttachment[] = [];
  for (const file of files) {
    const name = file.webkitRelativePath || file.name;
    total += file.size;
    if (total > 6 * 1024 * 1024) throw new Error('Attachments must fit within 6 MiB combined.');
    const image = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type);
    if (image) {
      if (file.size > 4 * 1024 * 1024) throw new Error(`${name}: images must be at most 4 MiB.`);
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error(`Cannot read ${name}`)); reader.onload = () => resolve(String(reader.result).split(',')[1]!); reader.readAsDataURL(file); });
      result.push({ name, type: 'image', mime: file.type, data });
    } else {
      text += file.size;
      if (text > 512 * 1024) throw new Error('Text/code files must fit within 512 KiB combined.');
      let data: string;
      try { data = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); } catch { throw new Error(`${name}: attach UTF-8 text/code or PNG, JPEG, WebP, GIF images. Binary documents are not supported.`); }
      if (data.includes('\0')) throw new Error(`${name}: binary documents are not supported.`);
      result.push({ name, type: 'text', data });
    }
  }
  return [...existing, ...result];
}
