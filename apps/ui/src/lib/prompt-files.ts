import type { PromptAttachment } from '../api.ts';

export const PROMPT_BYTES = 64 * 1024;
export const ATTACHMENT_BYTES = 6 * 1024 * 1024;
/** Sizes as a person reads them: 309 B, 47.4 KiB, 1.2 MiB. The exact byte counts stay in the data, never in the words. */
export function formatBytes(bytes: number): string {
  const trim = (value: number) => (Math.round(value * 10) / 10).toString();
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${trim(bytes / 1024)} KiB`;
  return `${trim(bytes / (1024 * 1024))} MiB`;
}
/** What the composer says about size, and only what is true and useful: the prompt once it nears its 64 KiB limit, the attachments with the limit they count against. */
export function promptSizeNote(promptBytes: number, attachments: { count: number; bytes: number }): { text: string; over: boolean; quiet: boolean } {
  const over = promptBytes > PROMPT_BYTES;
  if (over) return { over, quiet: false, text: `Prompt exceeds 64 KiB by ${formatBytes(promptBytes - PROMPT_BYTES)}. Your draft is kept.` };
  const parts = [] as string[];
  if (promptBytes >= 48 * 1024) parts.push(`Prompt ${formatBytes(promptBytes)} of 64 KiB`);
  if (attachments.count) parts.push(`${attachments.count} ${attachments.count === 1 ? 'file' : 'files'} · ${formatBytes(attachments.bytes)} of 6 MiB`);
  return { over, quiet: !parts.length, text: parts.length ? parts.join(' · ') : `${formatBytes(PROMPT_BYTES - promptBytes)} left of 64 KiB` };
}
export const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;
export const attachmentBytes = (item: PromptAttachment) => item.type === 'text' ? utf8Bytes(item.data) : item.data.length * 3 / 4 - (item.data.endsWith('==') ? 2 : item.data.endsWith('=') ? 1 : 0);

/** Clipboard formats vary by browser. Use one file collection so an image is never attached twice. */
export function pastedFiles(data: Pick<DataTransfer, 'files' | 'items'>): File[] {
  if (data.files.length) return Array.from(data.files);
  return Array.from(data.items).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter((file): file is File => !!file);
}

function imageType(bytes: Uint8Array): string | undefined {
  const matches = (signature: number[], offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);
  if (matches([137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png';
  if (matches([255, 216, 255])) return 'image/jpeg';
  if (matches([82, 73, 70, 70]) && matches([87, 69, 66, 80], 8)) return 'image/webp';
  if (matches([71, 73, 70, 56]) && [55, 57].includes(bytes[4]!) && bytes[5] === 97) return 'image/gif';
}

export async function promptFiles(files: File[], existing: PromptAttachment[]): Promise<PromptAttachment[]> {
  if (files.length + existing.length > 32) throw new Error('Select at most 32 files; choose a smaller folder or individual files.');
  let total = existing.reduce((sum, a) => sum + attachmentBytes(a), 0);
  let text = existing.filter(a => a.type === 'text').reduce((sum, a) => sum + utf8Bytes(a.data), 0);
  const result: PromptAttachment[] = [];
  for (const file of files) {
    const name = file.webkitRelativePath || file.name;
    total += file.size;
    if (total > 6 * 1024 * 1024) throw new Error('Attachments must fit within 6 MiB combined.');
    // Windows clipboard/file providers can omit the MIME or report application/octet-stream.
    // Classify the recorded bytes, not a filename extension or an untrusted MIME label.
    let header: Uint8Array;
    try { header = new Uint8Array(await file.slice(0, 12).arrayBuffer()); } catch { throw new Error(`Cannot read ${name}; choose the file again.`); }
    const mime = imageType(header);
    if (mime) {
      if (file.size > 4 * 1024 * 1024) throw new Error(`${name}: images must be at most 4 MiB.`);
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error(`Cannot read ${name}`)); reader.onload = () => resolve(String(reader.result).split(',')[1]!); reader.readAsDataURL(file); });
      result.push({ name, type: 'image', mime, data });
    } else {
      if (file.type.startsWith('image/')) throw new Error(`${name}: attach a valid PNG, JPEG, WebP or GIF image. This image format or its bytes are not supported.`);
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
