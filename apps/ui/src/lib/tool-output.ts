import { tableHeader } from './markdown-table.ts';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);

/** Read a prefix of a truncated MCP `{"content":[{"type":"text","text":"...` envelope without inventing fields. */
function unwrapTruncatedMcpContent(
  raw: string,
  depth: number,
  unwrapValue: (value: unknown, depth: number) => string | undefined,
): string | undefined {
  if (depth > 8 || raw.length > 2 * 1024 * 1024) return;
  let i = 0;
  const skipWs = () => { while (i < raw.length && (raw[i] === ' ' || raw[i] === '\t' || raw[i] === '\r' || raw[i] === '\n')) i++; };
  const readString = (): { value: string; closed: boolean } | undefined => {
    if (raw[i] !== '"') return;
    i++;
    let out = '';
    while (i < raw.length) {
      const ch = raw[i++]!;
      if (ch === '"') return { value: out, closed: true };
      if (ch !== '\\') { out += ch; continue; }
      if (i >= raw.length) return { value: out, closed: false };
      const esc = raw[i++]!;
      if (esc === '"' || esc === '\\' || esc === '/') out += esc;
      else if (esc === 'b') out += '\b';
      else if (esc === 'f') out += '\f';
      else if (esc === 'n') out += '\n';
      else if (esc === 'r') out += '\r';
      else if (esc === 't') out += '\t';
      else if (esc === 'u') {
        const hex = raw.slice(i, i + 4);
        if (hex.length < 4) return { value: out, closed: false };
        if (!/^[\da-f]{4}$/i.test(hex)) return;
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
      } else return;
    }
    return { value: out, closed: false };
  };
  skipWs();
  if (raw[i++] !== '{') return;
  let isError: boolean | undefined;
  let sawContent = false;
  let truncated = false;
  const parts: string[] = [];
  while (i < raw.length) {
    skipWs();
    if (i >= raw.length) { truncated = true; break; }
    if (raw[i] === '}') return;
    const key = readString();
    if (!key || !key.closed) return;
    skipWs();
    if (i >= raw.length) { truncated = true; break; }
    if (raw[i++] !== ':') return;
    skipWs();
    if (i >= raw.length) { truncated = true; break; }
    if (key.value === 'isError') {
      if (raw.startsWith('true', i)) { isError = true; i += 4; }
      else if (raw.startsWith('false', i)) { isError = false; i += 5; }
      else return;
    } else if (key.value === 'content') {
      sawContent = true;
      if (raw[i++] !== '[') return;
      while (i < raw.length) {
        skipWs();
        if (i >= raw.length) { truncated = true; break; }
        if (raw[i] === ']') { i++; break; }
        if (raw[i++] !== '{') return;
        let itemType: string | undefined;
        let itemText: { value: string; closed: boolean } | undefined;
        let itemDone = false;
        while (i < raw.length) {
          skipWs();
          if (i >= raw.length) { truncated = true; break; }
          if (raw[i] === '}') { i++; itemDone = true; break; }
          const k = readString();
          if (!k) return;
          if (!k.closed) { truncated = true; break; }
          skipWs();
          if (i >= raw.length) { truncated = true; break; }
          if (raw[i++] !== ':') return;
          skipWs();
          if (i >= raw.length) { truncated = true; break; }
          if (k.value === 'type') {
            const v = readString();
            if (!v || !v.closed) return;
            if (v.value !== 'text' && v.value !== 'image') return;
            itemType = v.value;
          } else if (k.value === 'text') {
            const v = readString();
            if (!v) return;
            itemText = v;
            if (!v.closed) { truncated = true; break; }
          } else if (raw[i] === '"') {
            const v = readString();
            if (!v) return;
            if (!v.closed) { truncated = true; break; }
          } else {
            return;
          }
          skipWs();
          if (i >= raw.length) { truncated = true; break; }
          if (raw[i] === ',') { i++; continue; }
          if (raw[i] === '}') { i++; itemDone = true; break; }
          return;
        }
        if (itemText !== undefined && (itemType === 'text' || (!itemType && itemDone))) {
          parts.push(itemText.value);
        } else if (itemType !== 'image' && parts.length === 0) {
          return;
        }
        if (truncated || i >= raw.length) { truncated = true; break; }
        skipWs();
        if (i >= raw.length) { truncated = true; break; }
        if (raw[i] === ',') { i++; continue; }
        if (raw[i] === ']') { i++; break; }
        return;
      }
      if (i >= raw.length) truncated = true;
    } else {
      return;
    }
    if (truncated || i >= raw.length) { truncated = true; break; }
    skipWs();
    if (i >= raw.length) { truncated = true; break; }
    if (raw[i] === ',') { i++; continue; }
    if (raw[i] === '}') return;
    return;
  }
  if (!sawContent || !truncated || !parts.length) return;
  const decoded = parts.map(part => {
    try { return unwrapValue(JSON.parse(part), depth + 1) ?? part; }
    catch { return unwrapTruncatedMcpContent(part, depth + 1, unwrapValue) ?? part; }
  }).join('\n');
  return isError ? `Tool error\n${decoded}` : decoded;
}

/** Decode only complete, recognized tool envelopes (and truncated MCP content[] prefixes). Never unescape arbitrary captured text. */
export function toolOutputText(text: string): { text: string; decoded: boolean } {
  if (text.length > 2 * 1024 * 1024) return { text, decoded: false };
  const unwrap = (value: unknown, depth: number): string | undefined => {
    if (depth > 8) return;
    if (Array.isArray(value) && value.length > 0 && value.length <= 100) {
      const parts = value.map(item => unwrap(item, depth + 1));
      return parts.every(part => part !== undefined) ? parts.join('\n\n') : undefined;
    }
    if (!record(value)) return;
    if (value.status === 'fulfilled' && 'value' in value) {
      const output = unwrap(value.value, depth + 1);
      return output === undefined ? undefined : `${Number.isInteger(value.i) ? `Request ${value.i}\n` : ''}${output}`;
    }
    if (typeof value.output === 'string' && ['exit_code', 'wall_time_seconds', 'chunk_id', 'session_id'].some(key => key in value)) {
      const lines = [value.output];
      if (typeof value.exit_code === 'number') lines.push(`Exit code: ${value.exit_code}`);
      if (typeof value.session_id === 'number') lines.push(`Running session: ${value.session_id}`);
      return lines.join('\n');
    }
    if (
      Array.isArray(value.content)
      && (value.isError === undefined || typeof value.isError === 'boolean')
      && value.content.some(item => record(item) && item.type === 'text' && typeof item.text === 'string')
      && value.content.every(item => record(item) && ((item.type === 'text' && typeof item.text === 'string') || item.type === 'image'))
    ) {
      const textItems = value.content.filter((item): item is RecordValue & { text: string } => record(item) && item.type === 'text' && typeof item.text === 'string');
      const body = textItems.map(item => {
        try { return unwrap(JSON.parse(item.text), depth + 1) ?? item.text; }
        catch { return unwrapTruncatedMcpContent(item.text, depth + 1, unwrap) ?? item.text; }
      }).join('\n');
      return value.isError ? `Tool error\n${body}` : body;
    }
  };
  let decoded = false;
  // Only an object or array can be a recognized envelope. Skipping other lines avoids a thrown
  // JSON.parse per plain-text line, which dominated decoding long terminal output.
  const candidate = (line: string) => /^\s*[[{]/.test(line);
  const convert = (line: string, allowTruncated: boolean) => {
    if (!candidate(line)) return line;
    try {
      const result = unwrap(JSON.parse(line), 0);
      if (result !== undefined) { decoded = true; return result; }
    } catch {
      if (allowTruncated) {
        const truncated = unwrapTruncatedMcpContent(line, 0, unwrap);
        if (truncated !== undefined) { decoded = true; return truncated; }
      }
    }
    return line;
  };
  // An envelope can be pretty printed, or several envelopes can be newline-delimited.
  const whole = convert(text, true);
  if (decoded) return { text: whole, decoded };
  const lines = text.split('\n').map(line => convert(line, false)).join('\n');
  return { text: lines, decoded };
}

/** Recognise genuine multi-line Markdown without misclassifying JSON, diffs, or plain shell output. */
export function looksLikeMarkdown(text: string): boolean {
  if (!text || text.length > 262144) return false;
  const trimmed = text.trimStart();
  if (!trimmed || /^[\[{]/.test(trimmed) || /^\*\*\* Begin Patch\r?\n|^diff --git /m.test(trimmed)) return false;
  const lines = text.split(/\r?\n/);
  let inFence = false;
  let hasFence = false;
  let hasHeading2Plus = false;
  let hasHeading1 = false;
  let hasList = false;
  let hasInlineMarkdown = false;
  for (let i = 0; i < lines.length && i < 300; i++) {
    const line = lines[i]!;
    if (/^\s*```/.test(line)) { inFence = !inFence; hasFence = true; continue; }
    if (inFence) continue;
    if (/^#{2,6}\s+\S/.test(line)) hasHeading2Plus = true;
    else if (/^#\s+(?!!)\S/.test(line)) hasHeading1 = true;
    else if (/^\s*(?:[-*]|\d{1,3}[.)])\s+\S/.test(line)) hasList = true;
    else if (tableHeader(lines, i)) return true;
    if (/\*\*[^*\s][^*]*\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\)|`[^`\n]+`/.test(line)) hasInlineMarkdown = true;
  }
  return hasHeading2Plus || hasFence || (hasHeading1 && (hasList || hasInlineMarkdown)) || (hasList && hasInlineMarkdown);
}
