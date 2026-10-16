import type { CurrentFile } from '../api.ts';
import { utf8Bytes } from './prompt-files.ts';
import { WORKSPACE_DRAFT_BYTES, type WorkspaceDraft } from './workspace-drafts.ts';

/** Fetch a complete bounded document, not a concatenation of different disk versions. */
export async function loadWorkspaceDraft(read: (start: number) => Promise<CurrentFile>): Promise<WorkspaceDraft> {
  const pages: string[] = [];
  let offset = 0, version: string | undefined, total: number | undefined;
  while (true) {
    const part = await read(offset);
    if (part.redacted) throw new Error('Redacted source cannot be used as an editable draft.');
    if (!Number.isInteger(part.totalLines) || part.totalLines < 1 || part.totalLines > 5000) throw new Error('Draft editing supports files up to 5,000 lines and 256 KiB.');
    if (version !== undefined && (part.modifiedAt !== version || part.totalLines !== total)) throw new Error('File changed while opening the draft. Refresh and retry.');
    version ??= part.modifiedAt; total ??= part.totalLines;
    if (part.start !== offset || !Number.isInteger(part.returnedLines) || part.returnedLines < 1 || part.returnedLines > 5000 || part.text.split('\n').length !== part.returnedLines || offset + part.returnedLines > total) throw new Error('Incomplete source page; refresh and retry.');
    pages.push(part.text);
    const text = pages.join('\n');
    if (utf8Bytes(text) > WORKSPACE_DRAFT_BYTES) throw new Error('Local draft limit is 256 KiB of UTF-8 text.');
    offset += part.returnedLines;
    if (!part.hasMore) {
      if (offset !== total) throw new Error('Incomplete source document; refresh and retry.');
      return { base: text, text, modifiedAt: version };
    }
    if (offset >= total) throw new Error('Inconsistent source continuation; refresh and retry.');
  }
}
