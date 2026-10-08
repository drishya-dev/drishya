import type { PromptAttachment } from '../api.ts';

export async function promptFiles(files: File[], existing: PromptAttachment[]): Promise<PromptAttachment[]> {
  if (files.length + existing.length > 32) throw new Error('Select at most 32 files; choose a smaller folder or individual files.');
  let total = existing.reduce((sum, a) => sum + (a.type === 'image' ? a.data.length * .75 : new TextEncoder().encode(a.data).length), 0);
  let text = existing.filter(a => a.type === 'text').reduce((sum, a) => sum + new TextEncoder().encode(a.data).length, 0);
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
