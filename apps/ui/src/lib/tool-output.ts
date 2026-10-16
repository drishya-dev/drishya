type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);

/** Decode only complete, recognized tool envelopes. Never unescape arbitrary captured text. */
export function toolOutputText(text: string): { text: string; decoded: boolean } {
  if (text.length > 2 * 1024 * 1024) return { text, decoded:false };
  const unwrap = (value: unknown, depth: number): string | undefined => {
    if (depth > 4) return;
    if (Array.isArray(value) && value.length > 0 && value.length <= 100) {
      const parts = value.map(item => unwrap(item, depth + 1));
      return parts.every(part => part !== undefined) ? parts.join('\n\n') : undefined;
    }
    if (!record(value)) return;
    if (value.status === 'fulfilled' && 'value' in value) {
      const output = unwrap(value.value, depth + 1);
      return output === undefined ? undefined : `${Number.isInteger(value.i) ? `Request ${value.i}\n` : ''}${output}`;
    }
    if (typeof value.output === 'string' && ['exit_code','wall_time_seconds','chunk_id','session_id'].some(key => key in value)) {
      const lines = [value.output];
      if (typeof value.exit_code === 'number') lines.push(`Exit code: ${value.exit_code}`);
      if (typeof value.session_id === 'number') lines.push(`Running session: ${value.session_id}`);
      return lines.join('\n');
    }
    if (Array.isArray(value.content) && (value.isError === undefined || typeof value.isError === 'boolean') && value.content.every(item => record(item) && item.type === 'text' && typeof item.text === 'string')) {
      const body = value.content.map(item => {
        try { return unwrap(JSON.parse(item.text), depth + 1) ?? item.text; } catch { return item.text; }
      }).join('\n');
      return value.isError ? `Tool error\n${body}` : body;
    }
  };
  let decoded = false;
  const convert = (line: string) => {
    try { const result = unwrap(JSON.parse(line),0); if (result !== undefined) { decoded = true; return result; } } catch { /* Incomplete JSON and literal source remain untouched. */ }
    return line;
  };
  // An envelope can be pretty printed, or several envelopes can be newline-delimited.
  const whole = convert(text);
  if (decoded) return { text:whole, decoded };
  const lines = text.split('\n').map(convert).join('\n');
  return { text:lines, decoded };
}
